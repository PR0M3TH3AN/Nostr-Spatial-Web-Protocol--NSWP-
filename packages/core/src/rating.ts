/**
 * What a visitor thought of a world: a rating (protocol/13-ratings.md).
 *
 * One person, one world, one to five stars, and a few words if they like. It is a note of its own kind, signed
 * by the person, and replaced when they change their mind.
 *
 * Keys cost nothing, so a count of everyone's ratings says nothing. What this file gives a client is a tally of
 * the ratings of people it was told to count: the visitor, the people they follow, the curators whose lists
 * they use. Who that is, is the client's to decide and to say.
 */
import { cleanLine } from "./chat.js";
import { WORLD_KIND } from "./constants.js";
import { cleanOrigin } from "./destination.js";
import { getTags, isHex64, verifyEvent, type EventTemplate, type NostrEvent } from "./event.js";
import { parseCoordinate } from "./nip19.js";

/** A rating: addressable, one for each world a person has rated. Experimental; not allocated by the NIPs process. */
export const RATING_KIND = 37305;

export const RATING_LIMITS = {
  /** Stars run from 1 to this. */
  most: 5,
  /** The longest the words may be, in characters. A review longer than that is a comment (NIP-22), not a rating. */
  words: 280,
} as const;

/**
 * Marks a signer puts on what it signs, naming the site that asked: NSWP's own for a world, and BitLogin's for an
 * application. A rating that carries one naming the world it rates was asked for by that world, and isn't counted.
 */
export const SITE_MARKS: readonly string[] = ["nswp:world", "bitlogin:site"];

export interface Rating {
  /** Who gave it. */
  by: string;
  /** The world it is of: `37300:<publisher>:<d>`. */
  world: string;
  /** 1 to 5. */
  stars: number;
  /** Their words, or "". Shown as text, never as markup. */
  words: string;
  /** When, in seconds. */
  at: number;
  /** The sites a signer says asked for it, as origins. Empty when no signer said. */
  askedAt: string[];
}

/** A world's coordinate as a rating may name it, or "". */
export function worldCoordinate(input: unknown): string {
  if (typeof input !== "string" || input.length > 200) return "";
  const c = parseCoordinate(input);
  return c && c.kind === WORLD_KIND && isHex64(c.pubkey) && c.identifier !== "" ? `${WORLD_KIND}:${c.pubkey}:${c.identifier}` : "";
}

/** Whole stars, 1 to 5, or 0 for anything else. */
export function cleanStars(input: unknown): number {
  const n = typeof input === "string" && /^[1-5]$/.test(input) ? Number(input) : input;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= RATING_LIMITS.most ? n : 0;
}

/**
 * A rating, ready to be signed by the person giving it. Null if the world isn't a world's coordinate or the stars
 * aren't 1 to 5. `relay` is a hint for whoever reads it: where the world's announcement can be found.
 */
export function buildRating(o: { world: string; stars: number; words?: string; relay?: string; now: number }): EventTemplate | null {
  const world = worldCoordinate(o.world);
  const stars = cleanStars(o.stars);
  if (!world || !stars) return null;
  return {
    kind: RATING_KIND,
    created_at: Math.floor(o.now),
    tags: [
      ["d", world],
      ["a", world, ...(o.relay ? [o.relay] : [])],
      ["rating", String(stars)],
      ["alt", `A rating of a world: ${stars} of ${RATING_LIMITS.most}`],
    ],
    content: cleanLine(o.words ?? "", RATING_LIMITS.words),
  };
}

/** Read a rating. Null for anything that isn't one. The signature is checked by `tallyRatings`, or by the caller. */
export function parseRating(event: NostrEvent | null | undefined): Rating | null {
  if (!event || event.kind !== RATING_KIND || !isHex64(event.pubkey) || !Array.isArray(event.tags)) return null;
  const world = worldCoordinate(getTags(event, "d")[0]?.[1]);
  const stars = cleanStars(getTags(event, "rating")[0]?.[1]);
  // It names the world twice: where it is kept, and what it is about. A rating whose two disagree is nobody's.
  if (!world || !stars || getTags(event, "a")[0]?.[1] !== world) return null;
  const askedAt = event.tags
    .filter((t) => SITE_MARKS.includes(t[0] ?? ""))
    .map((t) => cleanOrigin(t[1]))
    .filter(Boolean);
  return { by: event.pubkey, world, stars, words: cleanLine(typeof event.content === "string" ? event.content : "", RATING_LIMITS.words), at: Number.isInteger(event.created_at) ? event.created_at : 0, askedAt };
}

export interface Tally {
  /** How many of the people counted have rated it. */
  count: number;
  /** Their average, to one decimal place; 0 when nobody has. */
  average: number;
  /** What `me` gave it, or 0. */
  mine: number;
  /** The ratings counted, newest first: for showing whose they are and what they wrote. */
  ratings: Rating[];
}

/**
 * The tally for one world, from the ratings of the people a client counts.
 *
 * - Only a real signature counts, and only the newest rating each person has given that world.
 * - Only people in `counted` count. `me`, the visitor, always does.
 * - A rating that a signer says was asked for at the world it rates isn't counted: a world may not have its
 *   visitors rate it from inside. Pass the world's address as `worldUrl` for this to be checked.
 * - A world's own publisher doesn't count for it.
 */
export function tallyRatings(events: readonly NostrEvent[], o: { world: string; counted: Iterable<string>; me?: string | null; worldUrl?: string | null }): Tally {
  const world = worldCoordinate(o.world);
  const counted = new Set(o.counted);
  if (o.me) counted.add(o.me);
  const publisher = world.split(":")[1];
  const own = cleanOrigin(o.worldUrl);
  const newest = new Map<string, Rating>();
  for (const event of events) {
    const r = parseRating(event);
    if (!r || r.world !== world || !counted.has(r.by) || r.by === publisher) continue;
    if (own && r.askedAt.includes(own)) continue;
    const had = newest.get(r.by);
    if (had && had.at >= r.at) continue;
    if (!verifyEvent(event)) continue;
    newest.set(r.by, r);
  }
  const ratings = [...newest.values()].sort((a, b) => b.at - a.at);
  const sum = ratings.reduce((n, r) => n + r.stars, 0);
  return { count: ratings.length, average: ratings.length ? Math.round((sum / ratings.length) * 10) / 10 : 0, mine: (o.me && newest.get(o.me)?.stars) || 0, ratings };
}

/** A tally as a few words: "4.5 of 5, from 12". "" when nobody counted has rated it. */
export function tallyWords(tally: Pick<Tally, "count" | "average">): string {
  return tally.count ? `${tally.average.toFixed(1)} of ${RATING_LIMITS.most}, from ${tally.count}` : "";
}
