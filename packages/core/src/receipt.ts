/**
 * A receipt: proof that someone bought something (docs/plans/paying-for-things.md; protocol/10-identity.md,
 * "Buying, and receipts").
 *
 * A world sells nothing itself. A selling service does (BitUnlock), and signs a note saying which key bought which
 * listing, and until when. That note is the receipt, and it is the only thing a world believes: never a flag in an
 * address, never the visitor's say-so, and never the word "bought" from anyone but the note itself. This file reads
 * one and checks it, the same way for every world and every client, with no call to anyone.
 *
 * What it can't tell is whether a receipt was taken back since it was signed (a refund, a seller's decision). That
 * is a fact from after the signature, and only the service that signed it knows.
 */
import { isHex64, verifyEvent, type NostrEvent } from "./event.js";

/** The kind a receipt is: application data, addressed by its own name. */
export const RECEIPT_KIND = 30078;
/** How a receipt's own name begins, at the one service that signs them today. */
const RECEIPT_NAME = "bitunlock:entitlement:v1";
/** The form of receipt this reads. One that says anything else is not read at all. */
const RECEIPT_FORM = { schemaVersion: 1, protocolVersion: "seller-unlock-service-v1" } as const;

/** A service whose receipts are believed: its name for people, its address, and the key it signs with. */
export interface ReceiptIssuer {
  readonly name: string;
  readonly service: string;
  readonly pubkey: string;
}
/**
 * The services whose receipts the kit believes. A list, and a short one: BitUnlock, whose key was read from its own
 * signed policy at `/.well-known/bitunlock.json` on 2026-11-21. Another service that signs receipts the same way is
 * one more line here, and adding a line is the owner's decision, not a world's.
 */
export const RECEIPT_ISSUERS: readonly ReceiptIssuer[] = Object.freeze([
  Object.freeze({ name: "BitUnlock", service: "https://api.bitunlock.network", pubkey: "66be61cf5b8d286391f7b1a72ffa7c799ec2dc49eff0830c40df1cc964e6787d" }),
]);

/**
 * A listing's coordinate, as it may be asked about: `30078:<the seller's key>:<its name>`. "" for anything else.
 * The seller's key is in it, which is what lets anyone see whose thing was sold with no call to anyone.
 */
export function cleanListing(input: unknown): string {
  if (typeof input !== "string" || input.length > 300) return "";
  // As the selling service takes one: its name may hold anything but a line break.
  return /^30078:[0-9a-f]{64}:.{1,200}$/.test(input) ? input : "";
}
/** The key that sells a listing: the one in its coordinate. "" where it isn't one. */
export function listingSeller(listing: unknown): string {
  return cleanListing(listing).slice(6, 70);
}

/** What a receipt says, once it has been checked. */
export interface Receipt {
  /** Who signed it. */
  readonly issuer: ReceiptIssuer;
  /** What was bought: the listing's coordinate. */
  readonly listing: string;
  /** Whose it is. */
  readonly buyer: string;
  /** Who sold it. */
  readonly seller: string;
  /** When it was signed, in seconds. */
  readonly issuedAt: number;
  /** When it stops, in seconds, or null for something bought for good. */
  readonly expiresAt: number | null;
  /** Its own name at the service: what a "was this taken back?" question is asked about. */
  readonly fulfillment: string;
}

export type ReceiptRefusal = "not-a-receipt" | "not-signed" | "unknown-issuer" | "other-listing" | "other-buyer" | "run-out";
export type ReceiptCheck = { readonly ok: true; readonly receipt: Receipt } | { readonly ok: false; readonly why: ReceiptRefusal };

const no = (why: ReceiptRefusal): ReceiptCheck => ({ ok: false, why });
const text = (v: unknown, most = 300): v is string => typeof v === "string" && v.length > 0 && v.length <= most;

/**
 * Read a receipt and check it. Good only if: it is really signed, by a service on the list; it is a receipt in the
 * form this knows, under its own right name; and, where asked, it is for this listing, it is this buyer's, and it
 * has not run out. `now` is in seconds.
 *
 * It does not ask whether the receipt was taken back: nothing in a receipt can say.
 */
export function readReceipt(event: unknown, expect: { listing?: string; buyer?: string; now?: number; issuers?: readonly ReceiptIssuer[] } = {}): ReceiptCheck {
  const e = event as NostrEvent | null;
  if (!e || typeof e !== "object" || e.kind !== RECEIPT_KIND || typeof e.content !== "string" || e.content.length > 8000 || !Array.isArray(e.tags) || !isHex64(e.pubkey)) return no("not-a-receipt");
  const issuer = (expect.issuers ?? RECEIPT_ISSUERS).find((i) => i.pubkey === e.pubkey);
  if (!issuer) return no("unknown-issuer");
  let signed = false;
  try {
    // A copy is checked: checking must never change what the caller holds.
    signed = verifyEvent({ ...e, tags: e.tags.map((t) => [...t]) });
  } catch {
    signed = false;
  }
  if (!signed) return no("not-signed");
  let d: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(e.content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return no("not-a-receipt");
    d = parsed as Record<string, unknown>;
  } catch {
    return no("not-a-receipt");
  }
  if (d.schemaVersion !== RECEIPT_FORM.schemaVersion || d.protocolVersion !== RECEIPT_FORM.protocolVersion || d.status !== "active") return no("not-a-receipt");
  const listing = cleanListing(d.productCoordinate);
  const issuedAt = d.issuedAt;
  if (!listing || !isHex64(d.buyerPubkey) || !isHex64(d.sellerPubkey) || !text(d.fulfillmentId) || typeof issuedAt !== "number" || !Number.isSafeInteger(issuedAt) || issuedAt < 1) return no("not-a-receipt");
  // The seller it names is the seller in the listing's own coordinate, or it is not a receipt for that listing.
  if (d.sellerPubkey !== listingSeller(listing)) return no("not-a-receipt");
  // Its own name, as the service gives one: a receipt filed under another's name is not that receipt.
  const names = e.tags.filter((t) => t[0] === "d");
  if (names.length !== 1 || names[0]![1] !== `${RECEIPT_NAME}:${d.fulfillmentId}`) return no("not-a-receipt");
  // For good, or until a time after it was signed. Anything else is not a form this knows.
  let expiresAt: number | null = null;
  const policy = d.accessPolicy;
  if (policy !== undefined && policy !== "perpetual-v1") {
    const term = policy as { kind?: unknown; expiresAt?: unknown } | null;
    if (!term || typeof term !== "object" || term.kind !== "term-v1" || typeof term.expiresAt !== "number" || !Number.isSafeInteger(term.expiresAt) || term.expiresAt <= issuedAt) return no("not-a-receipt");
    expiresAt = term.expiresAt;
  }
  if (expect.listing !== undefined && listing !== expect.listing) return no("other-listing");
  if (expect.buyer !== undefined && d.buyerPubkey !== expect.buyer) return no("other-buyer");
  if (expiresAt !== null && (expect.now ?? Math.floor(Date.now() / 1000)) >= expiresAt) return no("run-out");
  return { ok: true, receipt: { issuer, listing, buyer: d.buyerPubkey, seller: d.sellerPubkey, issuedAt, expiresAt, fulfillment: d.fulfillmentId } };
}

/** A lightning address, as one: `name@host`, lower case. "" for anything else. Public: typing or showing one gives nothing away. */
export function cleanLightningAddress(input: unknown): string {
  if (typeof input !== "string" || input.length > 200) return "";
  const address = input.trim().toLowerCase();
  return /^[a-z0-9._+-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/.test(address) ? address : "";
}

/** The least and the most that may be asked for in one tip, in sats: what the sign-in address will take as a request at all. */
export const TIP_LIMITS = { least: 1, most: 1_000_000 } as const;
/** An amount for a tip, as one: a whole number of sats within the limits, or null. */
export function cleanTip(input: unknown): number | null {
  return typeof input === "number" && Number.isSafeInteger(input) && input >= TIP_LIMITS.least && input <= TIP_LIMITS.most ? input : null;
}
