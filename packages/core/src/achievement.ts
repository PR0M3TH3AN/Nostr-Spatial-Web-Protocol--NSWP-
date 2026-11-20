/**
 * Something a visitor did in a world that the world thought worth marking: an achievement
 * (protocol/16-achievements.md).
 *
 * A world that has achievements may let its visitor show the ones they earned: a note of its own kind for each,
 * signed by the visitor's key, saying which achievement of which world. Like a score (score.ts), it is a claim:
 * nothing checks that it was earned. And like a score, two things are true of one all the same:
 *
 * - It was asked for at the world it is of. A visitor's signer marks what it signs with the site that asked, so
 *   another site can't hand out this world's achievements.
 * - It is somebody's own. A reader shows whose it is, and counts first the people they have reason to know.
 *
 * An achievement granted by someone a reader trusts (a badge, NIP-58) is a later thing, laid over this one.
 */
import { cleanLine } from "./chat.js";
import { cleanOrigin } from "./destination.js";
import { getTags, isHex64, verifyEvent, type EventTemplate, type NostrEvent } from "./event.js";
import { SITE_MARKS, worldCoordinate } from "./rating.js";

/** An achievement held: addressable, one for each person for each achievement of a world. Experimental; not allocated by the NIPs process. */
export const ACHIEVEMENT_KIND = 37307;

export const ACHIEVEMENT_LIMITS = {
  /** A world may have no more than this many signed in `perMs`, and in an hour. */
  burst: 6,
  perMs: 60_000,
  hourly: 60,
  /** The longest a title may be, and the words about it, in characters. */
  title: 60,
  about: 160,
} as const;

/** One of a world's achievements, as the world describes it. */
export interface Achievement {
  /** Its name among this world's achievements: lower-case letters, digits and hyphens, 32 at most. */
  id: string;
  /** What it is called, for a reader. */
  title: string;
  /** What it is for, in a few words. */
  about?: string;
  /** Not named to someone who hasn't earned it. */
  hidden?: boolean;
}

const NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** An achievement's name as it may be used, or "". */
export function cleanAchievementId(input: unknown): string {
  return typeof input === "string" && NAME.test(input) ? input : "";
}

/**
 * An achievement someone holds, ready to be signed by them. Null if the world isn't a world's coordinate, the name
 * isn't one, or there is no title. The title goes with it so that it can be shown anywhere: it is the holder's
 * word for what the world called it.
 */
export function buildAchievement(o: { world: string; id: string; title: string; relay?: string; now: number }): EventTemplate | null {
  const world = worldCoordinate(o.world);
  const id = cleanAchievementId(o.id);
  const title = cleanLine(o.title, ACHIEVEMENT_LIMITS.title);
  if (!world || !id || !title) return null;
  return {
    kind: ACHIEVEMENT_KIND,
    created_at: Math.floor(o.now),
    tags: [
      ["d", `${world}/${id}`],
      ["a", world, ...(o.relay ? [o.relay] : [])],
      ["achievement", id],
      ["title", title],
      ["alt", `An achievement in a world: ${title}`],
    ],
    content: "",
  };
}

/**
 * What a signer does when a world asks for its visitor's achievement to be signed: the same note, marked with the
 * site that asked, which the signer takes from the browser and never from the world. Null for anything malformed.
 */
export function achievementForWorld(o: { world: unknown; id: unknown; title: unknown; origin: string; now: number }): EventTemplate | null {
  const origin = cleanOrigin(o.origin);
  const made = typeof o.world === "string" && typeof o.id === "string" && typeof o.title === "string" ? buildAchievement({ world: o.world, id: o.id, title: o.title, now: o.now }) : null;
  if (!origin || !made) return null;
  return { ...made, tags: [...made.tags, [SITE_MARKS[0]!, origin]] };
}

export interface HeldAchievement {
  /** Who holds it. */
  by: string;
  /** The world: `37300:<publisher>:<d>`. */
  world: string;
  id: string;
  /** What they say the world called it. Shown as text. */
  title: string;
  /** When they showed it, in seconds. */
  at: number;
  /** The sites a signer says asked for it, as origins. Empty when no signer said. */
  askedAt: string[];
}

/** Read an achievement someone holds. Null for anything that isn't one. The signature is checked by `achievementsIn`, or by the caller. */
export function parseAchievement(event: NostrEvent | null | undefined): HeldAchievement | null {
  if (!event || event.kind !== ACHIEVEMENT_KIND || !isHex64(event.pubkey) || !Array.isArray(event.tags)) return null;
  const world = worldCoordinate(getTags(event, "a")[0]?.[1]);
  const id = cleanAchievementId(getTags(event, "achievement")[0]?.[1]);
  const title = cleanLine(getTags(event, "title")[0]?.[1], ACHIEVEMENT_LIMITS.title);
  // Where it is kept says which world and which achievement again: one whose two disagree is nobody's.
  if (!world || !id || !title || getTags(event, "d")[0]?.[1] !== `${world}/${id}`) return null;
  const askedAt = event.tags
    .filter((t) => SITE_MARKS.includes(t[0] ?? ""))
    .map((t) => cleanOrigin(t[1]))
    .filter(Boolean);
  return { by: event.pubkey, world, id, title, at: Number.isInteger(event.created_at) ? event.created_at : 0, askedAt };
}

/** Whether a signed achievement is the one that was asked for: by the key the signer holds, really signed, that one, marked with this site. */
export function isAchievementAsked(signed: unknown, o: { pubkey: string | null; world: string; id: string; title: string; origin: string }): signed is NostrEvent {
  if (!o.pubkey || !verifyEvent(signed) || signed.pubkey !== o.pubkey) return false;
  const a = parseAchievement(signed);
  return !!a && a.world === worldCoordinate(o.world) && a.id === o.id && a.title === cleanLine(o.title, ACHIEVEMENT_LIMITS.title) && a.askedAt.includes(cleanOrigin(o.origin));
}

/** Who holds one of a world's achievements, as far as a reader can tell. */
export interface AchievementHolders {
  id: string;
  /** How many people show it. */
  holders: number;
  /** Which of them the reader has reason to know. */
  known: string[];
  /** Whether the reader shows it themselves. */
  mine: boolean;
}

/**
 * Who holds what in one world, from what relays have.
 *
 * - Only a real signature counts, and only an achievement a signer says was asked for at the world itself
 *   (`worldUrl`): another site can't hand them out.
 * - `counted` are the people the reader has reason to know: they are named, the rest are only counted.
 */
export function achievementsIn(events: readonly NostrEvent[], o: { world: string; worldUrl: string; counted?: Iterable<string>; me?: string | null }): { byId: Map<string, AchievementHolders>; held: HeldAchievement[] } {
  const world = worldCoordinate(o.world);
  const own = cleanOrigin(o.worldUrl);
  const counted = new Set(o.counted ?? []);
  const newest = new Map<string, HeldAchievement>();
  if (world && own) {
    for (const event of events) {
      const a = parseAchievement(event);
      if (!a || a.world !== world || !a.askedAt.includes(own)) continue;
      const key = `${a.by} ${a.id}`;
      const had = newest.get(key);
      if (had && had.at >= a.at) continue;
      if (!verifyEvent(event)) continue;
      newest.set(key, a);
    }
  }
  const byId = new Map<string, AchievementHolders>();
  for (const a of newest.values()) {
    const row = byId.get(a.id) ?? { id: a.id, holders: 0, known: [], mine: false };
    row.holders++;
    if (a.by === o.me) row.mine = true;
    else if (counted.has(a.by)) row.known.push(a.by);
    byId.set(a.id, row);
  }
  return { byId, held: [...newest.values()].sort((x, y) => y.at - x.at) };
}
