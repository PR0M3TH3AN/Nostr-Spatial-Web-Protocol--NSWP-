/**
 * What the people a visitor has reason to trust thought of the places a world's doors lead to
 * (protocol/13-ratings.md, "On a world's own doors").
 *
 *   const ratings = createDoorRatings({ doors, me, counted });
 *   await ratings.load();
 *   gate.setRating(ratings.mark(doorsWorld));   // "★ 4.5 from 3", or "" where nobody they know has rated it
 *
 * A world is a Nostr client like any other. One its visitor has let see who they follow can count their
 * ratings as their own client does: the visitor's, and the people they follow. A world that hasn't been let
 * counts only the visitor's own. For a guest nothing is asked, and nothing is shown.
 *
 * Relays are asked by world, never by person. And this only shows ratings: giving one is done at the visitor's
 * own client, never from inside a world.
 */
import { DEFAULT_RELAYS, queryRelays, RATING_KIND, tallyMark, tallyRatings, worldCoordinate, type NostrEvent, type Tally } from "@nswp/core";
import { askWell } from "./relay-book.js";

export interface DoorRatingsOptions {
  /** Where this world's doors lead: each place's coordinate and its address. */
  doors: { world: string; url: string }[];
  /** The visitor's key here, or null for a guest. */
  me(): string | null;
  /** The people the visitor follows, where they have let this world see who that is; null where they haven't. */
  counted(): readonly string[] | null;
  relays?: string[];
  now?: () => number;
  query?: typeof queryRelays;
}

export interface DoorRatings {
  /** Ask relays what people thought of these places: again only after a few minutes, unless `fresh`. */
  load(fresh?: boolean): Promise<void>;
  /** The tally for one of them, from what was read and who is counted now. */
  tally(world: string): Tally | null;
  /** As a door's sign says it: "★ 4.5 from 3". "" where nobody counted has rated it. */
  mark(world: string): string;
  /** In full, with whose it is: "4.5 of 5, from you and 2 people you follow". "" where there is none. */
  words(world: string): string;
  onChange(fn: () => void): () => void;
}

const FRESH_MS = 5 * 60_000;

export function createDoorRatings(opts: DoorRatingsOptions): DoorRatings {
  const now = opts.now ?? (() => Date.now());
  const query = opts.query ?? queryRelays;
  const doors = new Map(opts.doors.map((d) => [worldCoordinate(d.world), d.url] as const).filter(([world]) => world));
  const watchers = new Set<() => void>();
  let events: NostrEvent[] = [];
  let asked = 0;
  let askedFor: string | null = null;
  const tally = (worldIn: string): Tally | null => {
    const world = worldCoordinate(worldIn);
    const me = opts.me();
    const url = doors.get(world);
    if (!me || !url || events.length === 0) return null;
    const got = tallyRatings(events, { world, counted: opts.counted() ?? [], me, worldUrl: url });
    return got.count ? got : null;
  };
  return {
    async load(fresh = false) {
      const me = opts.me();
      // A guest: nothing is asked, and what was read for someone else is put away.
      if (!me || doors.size === 0) {
        if (events.length || askedFor) {
          events = [];
          askedFor = null;
          asked = 0;
          for (const fn of watchers) fn();
        }
        return;
      }
      if (!fresh && askedFor === me && now() - asked < FRESH_MS) return;
      asked = now();
      askedFor = me;
      // By world: nobody is told whose ratings are being looked for, or who is standing at which door.
      const got = await askWell({ kinds: [RATING_KIND], "#a": [...doors.keys()], limit: 500 }, { own: [], usual: opts.relays ?? DEFAULT_RELAYS, query, timeoutMs: 4000, now }).catch(() => null);
      if (opts.me() !== me) return;
      const byId = new Map((got?.events ?? []).filter((e) => e.kind === RATING_KIND).map((e) => [e.id, e]));
      events = [...byId.values()];
      for (const fn of watchers) fn();
    },
    tally,
    mark: (world) => tallyMark(tally(world)),
    words(world) {
      const t = tally(world);
      if (!t) return "";
      const others = t.count - (t.mine ? 1 : 0);
      const stars = `${t.average.toFixed(1)} of 5`;
      if (t.mine && others === 0) return `You gave it ${t.mine} of 5`;
      const them = `${others} ${others === 1 ? "person" : "people"} you follow`;
      return `Rated ${stars}, by ${t.mine ? `you and ${them}` : them}`;
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
  };
}
