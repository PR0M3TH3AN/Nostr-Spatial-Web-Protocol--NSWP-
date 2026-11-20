/**
 * A score someone made in a world, and the board it stands on (protocol/15-scores.md).
 *
 * A world that keeps score may let its visitor post one: a note of its own kind, signed by the visitor's key,
 * saying what they scored on which of the world's boards. One for each person on each board, replaced when they
 * do better.
 *
 * A score here is a claim. Nothing checks that it was earned: whoever holds the key can sign any number. Two
 * things are true of one all the same, and a board is built on them:
 *
 * - It was asked for at the world it is for. A visitor's signer marks what it signs with the site that asked, so
 *   another site can't post scores to this world's board.
 * - It is somebody's. Keys cost nothing, so a board lists the people a reader has reason to know first, and
 *   everyone else apart.
 *
 * A score that has been checked by someone a reader trusts is a later thing, laid over this one.
 */
import { cleanLine } from "./chat.js";
import { cleanOrigin } from "./destination.js";
import { getTags, isHex64, verifyEvent, type EventTemplate, type NostrEvent } from "./event.js";
import { SITE_MARKS, worldCoordinate } from "./rating.js";

/** A score: addressable, one for each person on each board of a world. Experimental; not allocated by the NIPs process. */
export const SCORE_KIND = 37306;

export const SCORE_LIMITS = {
  /** A world may have no more than this many scores signed in `perMs`, and in an hour. */
  burst: 6,
  perMs: 60_000,
  hourly: 60,
  /** The most a score may be. A whole number from 0 to this: what it counts is the board's to say. */
  most: 9_007_199_254_740_991,
  /** The longest a board's title may be, in characters. */
  title: 60,
} as const;

/** One of a world's boards, as the world describes it. */
export interface Board {
  /** Its name among this world's boards: lower-case letters, digits and hyphens, 32 at most. */
  id: string;
  /** What it is called, for a reader. */
  title: string;
  /** Whether more is better, or less. */
  order: "high" | "low";
  /** What a score counts: a plain number, or a time in thousandths of a second. */
  format: "number" | "time";
}

const BOARD = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** A board's name as it may be used, or "". */
export function cleanBoard(input: unknown): string {
  return typeof input === "string" && BOARD.test(input) ? input : "";
}

/** A score as it may be used: a whole number, zero or more. Null for anything else. */
export function cleanScore(input: unknown): number | null {
  const n = typeof input === "string" && /^\d{1,16}$/.test(input) ? Number(input) : input;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= SCORE_LIMITS.most ? n : null;
}

/** A score in a few words, as its board counts it: "1,200", or "42.5 s" for a time. */
export function scoreWords(board: Pick<Board, "format">, score: number): string {
  if (board.format !== "time") return String(score).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const tenths = Math.round(score / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  return minutes ? `${minutes} min ${seconds.toFixed(1)} s` : `${seconds.toFixed(1)} s`;
}

/**
 * A score, ready to be signed by the person who made it. Null if the world isn't a world's coordinate, the board
 * isn't a board's name, or the score isn't one. `relay` is a hint: where the world's announcement can be found.
 */
export function buildScore(o: { world: string; board: string; score: number; title?: string; format?: Board["format"]; relay?: string; now: number }): EventTemplate | null {
  const world = worldCoordinate(o.world);
  const board = cleanBoard(o.board);
  const score = cleanScore(o.score);
  if (!world || !board || score === null) return null;
  // What the board is called and how it counts go with the score, so that it can be shown anywhere, by a client
  // that has never been to the world: "Lantern Run: 42.5 s".
  const title = cleanLine(o.title ?? "", SCORE_LIMITS.title);
  return {
    kind: SCORE_KIND,
    created_at: Math.floor(o.now),
    tags: [
      ["d", `${world}/${board}`],
      ["a", world, ...(o.relay ? [o.relay] : [])],
      ["board", board, ...(title ? [title] : [])],
      ["score", String(score), ...(o.format === "time" ? ["time"] : [])],
      ["alt", `A score in a world: ${title ? `${title}: ` : ""}${scoreWords({ format: o.format === "time" ? "time" : "number" }, score)}`],
    ],
    content: "",
  };
}

/**
 * What a signer does when a world asks for its visitor's score to be signed: the same note, marked with the site
 * that asked, which the signer takes from the browser and never from the world. Null for anything malformed.
 */
export function scoreForWorld(o: { world: unknown; board: unknown; score: unknown; title?: unknown; format?: unknown; origin: string; now: number }): EventTemplate | null {
  const origin = cleanOrigin(o.origin);
  const made =
    typeof o.world === "string" && typeof o.board === "string" && cleanScore(o.score) !== null
      ? buildScore({ world: o.world, board: o.board, score: cleanScore(o.score)!, ...(typeof o.title === "string" ? { title: o.title } : {}), ...(o.format === "time" ? { format: "time" as const } : {}), now: o.now })
      : null;
  if (!origin || !made) return null;
  return { ...made, tags: [...made.tags, [SITE_MARKS[0]!, origin]] };
}

export interface Score {
  /** Who made it. */
  by: string;
  /** The world: `37300:<publisher>:<d>`. */
  world: string;
  board: string;
  score: number;
  /** What the board is called, as the score says, or "". The poster's word for what the world called it. */
  title: string;
  /** How the board counts, as the score says: a plain number where it doesn't say. */
  format: Board["format"];
  /** When it was posted, in seconds. */
  at: number;
  /** The sites a signer says asked for it, as origins. Empty when no signer said. */
  askedAt: string[];
}

/** Read a score. Null for anything that isn't one. The signature is checked by `rankScores`, or by the caller. */
export function parseScore(event: NostrEvent | null | undefined): Score | null {
  if (!event || event.kind !== SCORE_KIND || !isHex64(event.pubkey) || !Array.isArray(event.tags)) return null;
  const world = worldCoordinate(getTags(event, "a")[0]?.[1]);
  const board = cleanBoard(getTags(event, "board")[0]?.[1]);
  const score = cleanScore(getTags(event, "score")[0]?.[1]);
  // Where it is kept says which world and which board again: a score whose two disagree is nobody's.
  if (!world || !board || score === null || getTags(event, "d")[0]?.[1] !== `${world}/${board}`) return null;
  const askedAt = event.tags
    .filter((t) => SITE_MARKS.includes(t[0] ?? ""))
    .map((t) => cleanOrigin(t[1]))
    .filter(Boolean);
  const title = cleanLine(getTags(event, "board")[0]?.[2] ?? "", SCORE_LIMITS.title);
  const format: Board["format"] = getTags(event, "score")[0]?.[2] === "time" ? "time" : "number";
  return { by: event.pubkey, world, board, score, title, format, at: Number.isInteger(event.created_at) ? event.created_at : 0, askedAt };
}

/**
 * Whether a signed score is the one that was asked for: by the key the signer holds, really signed, for that
 * world and board with that score, and marked with this site.
 */
export function isScoreAsked(signed: unknown, o: { pubkey: string | null; world: string; board: string; score: number; title?: string; format?: Board["format"]; origin: string }): signed is NostrEvent {
  if (!o.pubkey || !verifyEvent(signed) || signed.pubkey !== o.pubkey) return false;
  const s = parseScore(signed);
  if (!s || s.world !== worldCoordinate(o.world) || s.board !== o.board || s.score !== o.score || !s.askedAt.includes(cleanOrigin(o.origin))) return false;
  return s.title === cleanLine(o.title ?? "", SCORE_LIMITS.title) && s.format === (o.format === "time" ? "time" : "number");
}

/** Someone's place on a board. */
export interface Standing {
  by: string;
  score: number;
  /** When they posted it, in seconds. */
  at: number;
  /** Their place among everyone on the board, from 1. Two with the same score: whoever posted first is ahead. */
  rank: number;
  /** Someone the reader has reason to know, or the reader. */
  known: boolean;
}

export interface Standings {
  /** The people the reader has reason to know, and the reader: best first. */
  known: Standing[];
  /** Everyone else: best first, a few at most. */
  others: Standing[];
  /** The reader's own, or null. */
  mine: Standing | null;
  /** How many people are on the board in all. */
  count: number;
}

/**
 * A board, from the scores relays have of it.
 *
 * - Only a real signature counts, and each person's newest score on that board.
 * - Only a score that a signer says was asked for at the world itself (`worldUrl`). A score signed anywhere
 *   else isn't on the board: another site can't put one there.
 * - `counted` are the people the reader has reason to know (the people they follow, say). They are listed apart
 *   and first. Everyone else is listed after, a few at most: keys cost nothing, and anyone can claim anything.
 */
export function rankScores(events: readonly NostrEvent[], o: { world: string; board: string; order: Board["order"]; worldUrl: string; counted?: Iterable<string>; me?: string | null; most?: number }): Standings {
  const world = worldCoordinate(o.world);
  const own = cleanOrigin(o.worldUrl);
  const counted = new Set(o.counted ?? []);
  if (o.me) counted.add(o.me);
  const newest = new Map<string, Score>();
  if (world && own) {
    for (const event of events) {
      const s = parseScore(event);
      if (!s || s.world !== world || s.board !== o.board || !s.askedAt.includes(own)) continue;
      const had = newest.get(s.by);
      if (had && had.at >= s.at) continue;
      if (!verifyEvent(event)) continue;
      newest.set(s.by, s);
    }
  }
  const all = [...newest.values()].sort((a, b) => (o.order === "low" ? a.score - b.score : b.score - a.score) || a.at - b.at || (a.by < b.by ? -1 : 1));
  const ranked: Standing[] = all.map((s, i) => ({ by: s.by, score: s.score, at: s.at, rank: i + 1, known: counted.has(s.by) }));
  const most = o.most ?? 20;
  return { known: ranked.filter((s) => s.known).slice(0, most), others: ranked.filter((s) => !s.known).slice(0, most), mine: ranked.find((s) => s.by === o.me) ?? null, count: ranked.length };
}
