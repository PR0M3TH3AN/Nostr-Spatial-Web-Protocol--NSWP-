/**
 * Places to arrive (protocol/01-worlds.md, "Places to arrive"; the owner, 2026-11-21: "We need designated spawn
 * locations in each world with a minimum number set so that the game can always find a clear area to spawn if
 * someone else is there.").
 *
 * An entry point is a set of places, not one spot: at least `ENTRY_PLACES_LEAST`, and `ENTRY_PLACES_ROOMS` for a
 * world that is for meeting people. Arriving, a visitor takes the first place nobody is within `ENTRY_CLEAR` of,
 * never one the world says nobody may stand on; if every place is taken, the one with the most room. An entry point
 * written the old way, as one spot, still works: its places are a ring round it, filled to the least number.
 *
 * Which places are taken is what the visitor's own kit can see: the people in the room it has joined. Nothing here
 * moves anyone already in the room; it only says where the one arriving should stand.
 */

/** The least number of places an entry point gives. */
export const ENTRY_PLACES_LEAST = 4;
/** The least for a world whose rooms are for meeting people: one with "rooms" or "multiplayer" among what it offers. */
export const ENTRY_PLACES_ROOMS = 8;
/** The least room between an arriving visitor and anyone already there, in metres: closer, and they are inside them. */
export const ENTRY_CLEAR = 1;
/** How far out from a single spot the ring of places an old-style entry point gets is, in metres (as before). */
export const ENTRY_RING = 1.3;

/** One place to arrive: where (metres) and which way they face (degrees, 0 facing -Z), as entry points are written. */
export interface EntryPlace {
  position: [number, number, number];
  yaw: number;
}

/** An entry point as a world writes it in its code: its own spot, and optionally the rest of its places. */
export interface EntryPointSpec extends EntryPlace {
  places?: EntryPlace[];
}

/** The least number of places for a world that offers these (its capabilities). */
export function leastEntryPlaces(capabilities: readonly string[] = []): number {
  return capabilities.includes("rooms") || capabilities.includes("multiplayer") ? ENTRY_PLACES_ROOMS : ENTRY_PLACES_LEAST;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const placeOk = (p: unknown): p is EntryPlace =>
  !!p && typeof p === "object" && Array.isArray((p as EntryPlace).position) && (p as EntryPlace).position.length === 3 && (p as EntryPlace).position.every(finite) && finite((p as EntryPlace).yaw);

/**
 * The places of an entry point. Its own spot is always the first, so a door or link naming it lands where it did.
 * Places it gives come next, as given. An entry point that gives fewer than `least` has the rest filled with a ring
 * `ENTRY_RING` round its own spot, each facing the way the spot does: so a world written the old way, with one spot,
 * still keeps people from arriving inside each other.
 */
export function entryPlaces(point: EntryPointSpec, least = ENTRY_PLACES_LEAST): EntryPlace[] {
  const own: EntryPlace = { position: [...point.position], yaw: point.yaw };
  const given = (point.places ?? []).filter(placeOk).map((p) => ({ position: [...p.position] as [number, number, number], yaw: p.yaw }));
  const places = [own, ...given];
  const missing = Math.max(0, least - places.length);
  for (let i = 0; i < missing; i++) {
    // Evenly round the spot, starting to its right as it faces, so the first filled place is never behind the door.
    const a = (point.yaw * Math.PI) / 180 + Math.PI / 2 + (i * 2 * Math.PI) / missing;
    places.push({ position: [own.position[0] + Math.cos(a) * ENTRY_RING, own.position[1], own.position[2] - Math.sin(a) * ENTRY_RING], yaw: point.yaw });
  }
  return places;
}

/**
 * Where an arriving visitor should stand: the index of the first place they may stand on (`canStand`) with nobody
 * of `others` (each `[x, z]`) within `ENTRY_CLEAR`. With every such place taken, the place they may stand on with
 * the most room round it (the farthest from its nearest person; ties to the earlier place). Only where none may be
 * stood on at all, the first place. Never decided by anything but these: the same answer everywhere.
 */
export function pickEntryPlace(places: readonly EntryPlace[], others: readonly (readonly [number, number])[] = [], canStand: (x: number, z: number) => boolean = () => true): number {
  if (!places.length) return -1;
  const near = (p: EntryPlace) => others.reduce((best, [x, z]) => Math.min(best, Math.hypot(p.position[0] - x, p.position[2] - z)), Number.POSITIVE_INFINITY);
  const standing = places.map((p, i) => ({ i, room: near(p), ok: safe(canStand, p) })).filter((p) => p.ok);
  if (!standing.length) return 0;
  const clear = standing.find((p) => p.room >= ENTRY_CLEAR);
  if (clear) return clear.i;
  return standing.reduce((best, p) => (p.room > best.room ? p : best)).i;
}

function safe(canStand: (x: number, z: number) => boolean, p: EntryPlace): boolean {
  try {
    return canStand(p.position[0], p.position[2]) === true;
  } catch {
    return false;
  }
}

/** What a world's check says about its entry points. */
export interface EntryPlacesIssue {
  level: "error" | "warn";
  code: "too_few" | "too_close" | "single_spot" | "invalid";
  entry: string;
  message: string;
}

/**
 * Check a world's entry points as its code writes them. A set of places given but smaller than the least is an
 * error, and so are two places nearer each other than `ENTRY_CLEAR` (a set packed tighter than one person's room
 * keeps nobody apart). An entry point written the old way, as one spot, is a warning: it works, with a ring filled
 * in, but its places should be chosen by whoever knows where people may stand.
 */
export function checkEntryPlaces(entryPoints: Record<string, EntryPointSpec>, opts: { capabilities?: readonly string[] } = {}): EntryPlacesIssue[] {
  const least = leastEntryPlaces(opts.capabilities);
  const issues: EntryPlacesIssue[] = [];
  for (const [entry, point] of Object.entries(entryPoints ?? {})) {
    if (!placeOk(point)) {
      issues.push({ level: "error", code: "invalid", entry, message: `Entry point "${entry}" needs a position [x, y, z] and a yaw.` });
      continue;
    }
    if (!point.places) {
      issues.push({ level: "warn", code: "single_spot", entry, message: `Entry point "${entry}" is one spot: give it places (at least ${least}, counting its own spot) so people arriving together land apart. Until then a ring round it is used.` });
      continue;
    }
    const bad = point.places.filter((p) => !placeOk(p)).length;
    if (bad) issues.push({ level: "error", code: "invalid", entry, message: `Entry point "${entry}" has ${bad} place${bad === 1 ? "" : "s"} without a position [x, y, z] and a yaw.` });
    const places = [point, ...point.places.filter(placeOk)];
    if (places.length < least) issues.push({ level: "error", code: "too_few", entry, message: `Entry point "${entry}" has ${places.length} place${places.length === 1 ? "" : "s"}, counting its own spot; it needs at least ${least}.` });
    for (let i = 0; i < places.length; i++) {
      for (let j = i + 1; j < places.length; j++) {
        const d = Math.hypot(places[i]!.position[0] - places[j]!.position[0], places[i]!.position[2] - places[j]!.position[2]);
        if (d < ENTRY_CLEAR) {
          issues.push({ level: "error", code: "too_close", entry, message: `Entry point "${entry}": places ${i + 1} and ${j + 1} are ${d.toFixed(2)} m apart; they must be at least ${ENTRY_CLEAR} m apart.` });
        }
      }
    }
  }
  return issues;
}
