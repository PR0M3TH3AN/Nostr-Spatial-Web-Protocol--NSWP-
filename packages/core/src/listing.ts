/**
 * A listing: a thing for sale, as its seller signed it (docs/plans/paying-for-things.md, section 4;
 * protocol/10-identity.md, "A listing").
 *
 * A world sells nothing itself. Its seller signs a note saying what is for sale, for how much and for how long, and
 * naming the service that sells it; a world that is paid names such notes as what it is entered by (`access`, in its
 * announcement and its manifest: protocol/01-worlds.md). This file reads one so that its name, its price and how
 * long it lasts can be shown before anyone is asked to pay. It reads what it is given: no key, no network.
 *
 * What is shown here is only ever shown. The visitor's own sign-in address reads the listing again for itself
 * before it asks them to pay, and the selling service holds the price it registered: nothing a world shows decides
 * what is charged.
 */
import { verifyEvent, type NostrEvent } from "./event.js";
import { cleanListing, listingSeller, RECEIPT_ISSUERS, type ReceiptIssuer } from "./receipt.js";
import { SHARE_TAG } from "./shares.js";

/** The kind a listing is: application data, addressed by its own name. */
export const LISTING_KIND = 30078;
/**
 * The least anything is sold for, in sats (the owner, 2026-11-21: section 13, 28 and 39). The selling service
 * registers nothing under it and the sign-in address shows no purchase under it; the kit shows nothing for sale
 * under it either.
 */
export const LEAST_PRICE_SATS = 500;
/** How many listings a world may be entered by: a day, a month, a year, for good, and room for a few more. */
export const ACCESS_MOST = 8;
/** How a listing says it is sold through a service that signs receipts. */
const DELIVERY = "seller-unlock-service-v1";
/** The longest a listing's name is shown at. */
const NAME_MOST = 80;

/** What a listing says, once it has been checked. */
export interface Listing {
  /** Its coordinate: `30078:<the seller's key>:<its name>`. */
  readonly coordinate: string;
  /** Who sells it: the key that signed it. */
  readonly seller: string;
  /** What it is called, in the seller's words. Plain text, and theirs: show it as a name, never as a fact. */
  readonly name: string;
  /** What it costs, in sats. */
  readonly sats: number;
  /** How long it lasts, in seconds, or null for something bought for good. */
  readonly term: number | null;
  /** What buying it gives, where it says: the coordinate of a world or an item. "" where it doesn't. */
  readonly for: string;
  /** The service that sells it and signs its receipts: one the kit believes. */
  readonly issuer: ReceiptIssuer;
}

export type ListingRefusal = "not-a-listing" | "other-seller" | "not-signed" | "other-listing" | "not-for-sale" | "unknown-service" | "too-cheap" | "shared";
export type ListingRead = { readonly ok: true; readonly listing: Listing } | { readonly ok: false; readonly why: ListingRefusal };

const no = (why: ListingRefusal): ListingRead => ({ ok: false, why });
const only = (tags: readonly string[][], name: string): string[] | null => {
  const found = tags.filter((t) => t[0] === name);
  return found.length === 1 ? found[0]! : null;
};

/**
 * A name as it may be shown: one line of plain text, at most eighty characters, with nothing in it a reader can't
 * see. Control characters and the marks that hide or reorder text are dropped, so a name can't rearrange the line
 * it is shown on.
 */
export function cleanListingName(input: unknown): string {
  if (typeof input !== "string") return "";
  const seen = Array.from(input.normalize("NFC")).filter((ch) => {
    const c = ch.codePointAt(0)!;
    return c >= 0x20 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x2028 && c <= 0x202f) && !(c >= 0x2060 && c <= 0x206f) && c !== 0xfeff;
  });
  return Array.from(seen.join("").trim()).slice(0, NAME_MOST).join("").trim();
}

/**
 * Read a listing a relay gave, as the one asked for. Good only if all of these hold, and refused with the first
 * that doesn't:
 *
 * - it is a note of the listing's kind, and `coordinate` is a listing's coordinate;
 * - it was signed by the seller the coordinate names (`other-seller`: nobody prices what isn't theirs), and the
 *   signature is real (`not-signed`);
 * - its own name is the one in the coordinate (`other-listing`);
 * - it is for sale now, through a service that signs receipts (`not-for-sale`);
 * - it has one price, in whole sats, and, if it lasts a time, says so once and properly (`not-a-listing`);
 * - the service it names is one whose receipts the kit believes (`unknown-service`): a purchase anywhere else
 *   would end in a receipt nothing here could take;
 * - it costs at least `LEAST_PRICE_SATS` (`too-cheap`);
 * - its price is not divided between several people (`shared`): shares are written down and not in force, and
 *   selling such a listing with them ignored would pay the seller what they wrote was someone else's.
 *
 * `issuers` is for a test or a trial against a service on one machine. Nothing in the kit lets a page pass it.
 */
export function readListing(event: unknown, coordinate: string, o: { issuers?: readonly ReceiptIssuer[] } = {}): ListingRead {
  const wanted = cleanListing(coordinate);
  const e = event as NostrEvent | null;
  if (!wanted || !e || typeof e !== "object" || e.kind !== LISTING_KIND || typeof e.content !== "string" || e.content.length > 8000) return no("not-a-listing");
  if (!Array.isArray(e.tags) || !e.tags.every((t) => Array.isArray(t) && t.every((x) => typeof x === "string"))) return no("not-a-listing");
  if (e.pubkey !== listingSeller(wanted)) return no("other-seller");
  let signed = false;
  try {
    // A copy is checked: checking must never change what the caller holds.
    signed = verifyEvent({ ...e, tags: e.tags.map((t) => [...t]) });
  } catch {
    signed = false;
  }
  if (!signed) return no("not-signed");
  const d = only(e.tags, "d");
  if (!d || `${LISTING_KIND}:${e.pubkey}:${d[1] ?? ""}` !== wanted) return no("other-listing");
  if (only(e.tags, "status")?.[1] !== "active" || only(e.tags, "br:delivery")?.[1] !== DELIVERY) return no("not-for-sale");
  const price = only(e.tags, "price");
  if (!price || price[2] !== "SAT" || !/^[1-9][0-9]{0,11}$/.test(price[1] ?? "")) return no("not-a-listing");
  const sats = Number(price[1]);
  // How long it lasts: said once, in whole seconds, or not said at all (bought for good). A term that doesn't
  // read is never taken as "for good".
  const terms = e.tags.filter((t) => t[0] === "nswp:term");
  if (terms.length > 1 || (terms.length === 1 && (terms[0]!.length !== 2 || !/^[1-9][0-9]{0,9}$/.test(terms[0]![1] ?? "")))) return no("not-a-listing");
  const term = terms.length ? Number(terms[0]![1]) : null;
  const issuer = (o.issuers ?? RECEIPT_ISSUERS).find((i) => i.service === only(e.tags, "br:unlock-service")?.[1] && i.pubkey === only(e.tags, "br:unlock-service-pubkey")?.[1]);
  if (!issuer) return no("unknown-service");
  if (sats < LEAST_PRICE_SATS) return no("too-cheap");
  if (e.tags.some((t) => t[0] === SHARE_TAG)) return no("shared");
  let words: { title?: unknown; name?: unknown } = {};
  try {
    const parsed: unknown = JSON.parse(e.content || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) words = parsed as typeof words;
  } catch {
    words = {};
  }
  // Its name: the seller's own, from the tag or the words inside, and failing those the name it is filed under.
  const name = cleanListingName(only(e.tags, "title")?.[1]) || cleanListingName(words.title) || cleanListingName(words.name) || cleanListingName(d[1]);
  const said = only(e.tags, "nswp:for")?.[1] ?? "";
  return { ok: true, listing: { coordinate: wanted, seller: e.pubkey, name, sats, term, for: /^3730[0-9]:[0-9a-f]{64}:[^\s]{1,200}$/.test(said) ? said : "", issuer } };
}

/**
 * How long something lasts, in words to put after a price: "for 30 days", "for 1 hour", and "once" for something
 * bought for good. In the largest whole unit that says it exactly.
 */
export function termWords(term: number | null): string {
  if (term === null || !Number.isSafeInteger(term) || term < 1) return "once";
  for (const [unit, seconds] of [["day", 86_400], ["hour", 3600], ["minute", 60]] as const) {
    if (term % seconds === 0) return `for ${term / seconds} ${unit}${term === seconds ? "" : "s"}`;
  }
  return `for ${term} second${term === 1 ? "" : "s"}`;
}

/** A listing's price and how long it lasts, in words: "500 sats, for 30 days". */
export function priceWords(listing: Pick<Listing, "sats" | "term">): string {
  return `${listing.sats} sats, ${termWords(listing.term)}`;
}

/**
 * What a world's page may reach beyond itself and relays because it is paid: the address of each service whose
 * receipts the kit believes, by name, so its gate can ask whether a receipt was taken back. For a world that names
 * no listing: nothing at all. A free world's rules must not change because paid worlds exist.
 */
export function paidWorldReaches(access: unknown): string[] {
  return cleanAccess(access).length ? RECEIPT_ISSUERS.map((i) => i.service) : [];
}

/**
 * What a world may say it is entered by: listings' coordinates, each once, at most `ACCESS_MOST`, and, where
 * `sellers` is given, only those sold by one of those keys. Anything else is dropped. Empty means free.
 */
export function cleanAccess(input: unknown, sellers?: readonly string[]): string[] {
  const out: string[] = [];
  for (const said of Array.isArray(input) ? input : [input]) {
    const listing = cleanListing(said);
    if (!listing || out.includes(listing) || (sellers && !sellers.includes(listingSeller(listing)))) continue;
    if (out.length < ACCESS_MOST) out.push(listing);
  }
  return out;
}
