/**
 * Shares: how the price of one thing is divided between several people (docs/plans/paying-for-things.md, section 8;
 * protocol/10-identity.md, "Shares").
 *
 * WRITTEN DOWN, AND NOT IN FORCE. Nothing in the kit, and no service, pays a share yet: a listing is paid to its
 * seller whole, as it always was. The owner asked for this to be built and tried and left switched off (2026-11-21),
 * and it stays off until they say, which waits on a lawyer's answer. This file is the one statement of the rule, so
 * that the three who must agree on it (the service that sells, the sign-in address that pays, and anything that shows
 * a price) can each be checked against the same examples (`vectors/shares.json`).
 *
 * The rule, in short. A seller writes one `nswp:share` on a listing for each person the price is divided between,
 * themselves included: who, how many parts in ten thousand, and a word for what it is for. The parts add up to the
 * whole. Each other person is paid their parts of the price, rounded down to a whole sat; the seller is paid what is
 * left, and the service's own charge comes out of the seller's part and nobody else's. One share may be for "the
 * client": whichever client brought the buyer. Where none did, it is the seller's.
 *
 * Nothing here moves money or says who a client is. It only reads and divides.
 */
import { isHex64 } from "./event.js";

/** The tag a share is written in, on a listing. */
export const SHARE_TAG = "nswp:share";
/** Who a share is for when it is for whichever client brought the buyer: this word, where a key would be. */
export const SHARE_CLIENT = "client";
/**
 * The limits. `most`: how many shares a listing may have, the seller's among them (each is its own payment, from
 * its own place, and a buyer waits for every one: four to begin, at the selling service's asking).
 * `whole`: what the parts add up to. `least`: the least any one payment may be, in sats (a smaller one costs more to
 * send than it carries). `label`: the longest a share's word may be.
 */
export const SHARE_LIMITS = { most: 4, whole: 10_000, least: 10, label: 32 } as const;

/** One share, as a listing gives it. */
export interface Share {
  /** Whose it is: a key, or `client`. */
  readonly to: string;
  /** How much: parts in ten thousand of the price. */
  readonly parts: number;
  /** What it is for, in a word or two, as the buyer is shown it. */
  readonly label: string;
}

export type SharesRefusal = "not-a-share" | "too-many" | "twice" | "not-whole" | "no-seller";
export type SharesRead = { readonly ok: true; readonly shares: readonly Share[] } | { readonly ok: false; readonly why: SharesRefusal };

/** A share's word, as one: a line of at most `SHARE_LIMITS.label` characters with nothing unseen in it, or "". */
export function cleanShareLabel(input: unknown): string {
  if (typeof input !== "string") return "";
  const text = input.trim();
  // Nothing a reader can't see: no line breaks, no control characters, none of the marks that hide or reorder text.
  if (!text || text.length > SHARE_LIMITS.label || /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/.test(text)) return "";
  return text;
}

/**
 * The shares a listing's tags give, for a listing sold by `seller`. A listing with no `nswp:share` at all has none
 * (`shares` is empty: the seller is paid everything). One with any must have them all right, or the listing can't be
 * sold with shares at all: nothing is guessed, dropped or made to fit.
 *
 * Right means: each is exactly `["nswp:share", <a key, or "client">, <parts: 1 to 10000, in digits>]` with, if it
 * likes, a word after; at most `SHARE_LIMITS.most` of them; nobody twice; the seller among them; adding up to the whole.
 */
export function readShares(tags: unknown, seller: unknown): SharesRead {
  const no = (why: SharesRefusal): SharesRead => ({ ok: false, why });
  if (!Array.isArray(tags)) return no("not-a-share");
  const mine = tags.filter((t): t is unknown[] => Array.isArray(t) && t[0] === SHARE_TAG);
  if (mine.length === 0) return { ok: true, shares: [] };
  if (!isHex64(seller)) return no("no-seller");
  if (mine.length > SHARE_LIMITS.most) return no("too-many");
  const shares: Share[] = [];
  for (const t of mine) {
    const [, to, parts, label] = t;
    if (t.length < 3 || t.length > 4) return no("not-a-share");
    if (to !== SHARE_CLIENT && !isHex64(to)) return no("not-a-share");
    if (typeof parts !== "string" || !/^[1-9][0-9]{0,4}$/.test(parts) || Number(parts) > SHARE_LIMITS.whole) return no("not-a-share");
    const word = label === undefined ? (to === SHARE_CLIENT ? "client" : to === seller ? "seller" : "share") : cleanShareLabel(label);
    if (!word) return no("not-a-share");
    if (shares.some((s) => s.to === to)) return no("twice");
    shares.push({ to: to as string, parts: Number(parts), label: word });
  }
  if (!shares.some((s) => s.to === seller)) return no("no-seller");
  if (shares.reduce((sum, s) => sum + s.parts, 0) !== SHARE_LIMITS.whole) return no("not-whole");
  return { ok: true, shares };
}

/** One payment a price comes to. */
export interface SharePart {
  /** Who is paid: a key. */
  readonly to: string;
  /** How much, in sats. */
  readonly sats: number;
  /** What it is for, as the buyer is shown it. */
  readonly label: string;
  /** Whether this is the seller's own part: the one paid last, and the one the service's charge came out of. */
  readonly seller: boolean;
}

export type SplitRefusal = "not-a-price" | "no-seller" | "too-small";
export type SplitRead = { readonly ok: true; readonly parts: readonly SharePart[] } | { readonly ok: false; readonly why: SplitRefusal };

/**
 * What a price comes to, person by person, in the order it is to be paid: the smallest first and the seller last,
 * so that a payment cut short leaves as little astray as it can.
 *
 * `shares` is what `readShares` gave (empty for a listing with none). `client` is the key of the client that brought
 * the buyer, where one did and can be paid; left out, or the seller's own, and the client's share is the seller's.
 * `charge` is what the selling service takes, in sats: it comes out of the seller's part.
 *
 * Whether a client can be paid is the selling service's to say (it pays only someone who has agreed to be paid, and
 * told it where). So for one listing and one client there are two right answers, this with `client` and this without,
 * and whoever checks the service's plan against the listing takes either, and nothing else.
 *
 * Refused, and so not to be sold this way, where any one payment would be under `SHARE_LIMITS.least`.
 */
export function splitPrice(price: unknown, shares: readonly Share[], seller: unknown, o: { client?: string; charge?: number } = {}): SplitRead {
  const no = (why: SplitRefusal): SplitRead => ({ ok: false, why });
  const charge = o.charge ?? 0;
  if (typeof price !== "number" || !Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(price * SHARE_LIMITS.whole)) return no("not-a-price");
  if (!Number.isSafeInteger(charge) || charge < 0) return no("not-a-price");
  if (!isHex64(seller)) return no("no-seller");
  if (shares.length > 0 && !shares.some((s) => s.to === seller)) return no("no-seller");
  const client = isHex64(o.client) && o.client !== seller ? o.client : null;
  // Everyone but the seller: their parts of the price, rounded down. A client's share with no client is the seller's.
  const others = new Map<string, { sats: number; label: string }>();
  for (const s of shares) {
    if (s.to === seller) continue;
    const to = s.to === SHARE_CLIENT ? client : s.to;
    if (!to) continue;
    const sats = Math.floor((price * s.parts) / SHARE_LIMITS.whole);
    const had = others.get(to);
    // A client who is also named in the listing is one person, paid once.
    others.set(to, had ? { sats: had.sats + sats, label: had.label } : { sats, label: s.label });
  }
  const given = [...others.values()].reduce((sum, p) => sum + p.sats, 0);
  const left = price - given - charge;
  const label = shares.find((s) => s.to === seller)?.label ?? "seller";
  const parts: SharePart[] = [...others].map(([to, p]) => ({ to, sats: p.sats, label: p.label, seller: false }));
  // Smallest first, and where two are the same, in the order of their keys: so that everyone computes one order.
  parts.sort((a, b) => a.sats - b.sats || (a.to < b.to ? -1 : 1));
  parts.push({ to: seller as string, sats: left, label, seller: true });
  if (parts.some((p) => p.sats < SHARE_LIMITS.least)) return no("too-small");
  return { ok: true, parts };
}
