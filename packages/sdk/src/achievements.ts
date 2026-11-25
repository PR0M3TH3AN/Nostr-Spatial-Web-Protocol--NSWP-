/**
 * A world's achievements (protocol/16-achievements.md): which ones the visitor has earned, showing them when
 * they say to, and how many other people hold each.
 *
 *   const achievements = createAchievements({ world, worldUrl, list, hand });
 *   achievements.earn("all-twelve");        // they just did it: kept on the device
 *   await achievements.show();              // from their press: each is signed by them, and sent to relays
 *
 * Optional, like everything about achievements: a world that names none has none of this.
 *
 * What a visitor earned is kept on the device, whoever they are. It becomes public only when they show it, which
 * they do by pressing: an achievement shown says that this person was in this world, and what they did there.
 */
import { achievementsIn, cleanAchievementId, DEFAULT_RELAYS, publishEvent, queryRelays, ACHIEVEMENT_KIND, worldCoordinate, type Achievement, type AchievementHolders, type NostrEvent } from "@nswp/core";
import { askWell, relaysOf, sendWell } from "./relay-book.js";

export interface AchievementHand {
  /** Who is signed in here, or null for a guest. */
  pubkey(): string | null;
  /** Have it signed that they hold one. Null if it couldn't be. */
  sign(world: string, id: string, title: string): Promise<NostrEvent | null>;
}

export interface AchievementsOptions {
  /** This world's own coordinate: `37300:<publisher>:<d>`. */
  world: string;
  /** This world's address. An achievement counts only if it was asked for here. */
  worldUrl: string;
  list: Achievement[];
  hand: AchievementHand;
  /** The people the visitor has reason to know: named among who holds each. */
  counted?: () => Iterable<string>;
  relays?: string[];
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  now?: () => number;
  query?: typeof queryRelays;
  publish?: typeof publishEvent;
}

export interface Achievements {
  readonly list: Achievement[];
  /** The ones they have earned, as kept on this device. */
  earned(): string[];
  /** The ones they have shown from this device. */
  shown(): string[];
  /** They just earned one. True if it is new to them: it is kept. Nothing is sent. */
  earn(id: string): boolean;
  /** Show everything they have earned and not yet shown: each signed by them, sent to relays. From their press. */
  show(): Promise<{ ok: boolean; said: string }>;
  /** Who holds each, from relays: asked again only after a minute, unless `fresh`. Null where no relay answered. */
  holders(fresh?: boolean): Promise<Map<string, AchievementHolders> | null>;
  /**
   * Which of this world's achievements someone shows, from what was last read: for saying so on their card.
   * Nothing is asked of a relay by this.
   */
  heldBy(pubkey: string): Achievement[];
  onChange(fn: () => void): () => void;
  /** Be told when they earn one that is new to them. */
  onEarn(fn: (achievement: Achievement) => void): () => void;
}

export function createAchievements(opts: AchievementsOptions): Achievements {
  const world = worldCoordinate(opts.world);
  const now = opts.now ?? (() => Date.now());
  const query = opts.query ?? queryRelays;
  const publish = opts.publish ?? publishEvent;
  const usual = () => opts.relays ?? DEFAULT_RELAYS;
  const list = opts.list.filter((a) => cleanAchievementId(a.id) && a.title);
  const one = (id: string) => list.find((a) => a.id === id) ?? null;
  const store = (() => {
    if (opts.storage !== undefined) return opts.storage;
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  })();
  const watchers = new Set<() => void>();
  const earners = new Set<(a: Achievement) => void>();
  const changed = () => {
    for (const fn of watchers) fn();
  };

  // Kept apart for each person who has signed in on the device, and for a guest. What a guest earned is theirs
  // once they sign in.
  type Kept = { earned: string[]; shown: string[] };
  const keyFor = (who: string | null) => `nswp:achievements:${world}:${who ?? "guest"}`;
  const held = new Map<string, Kept>();
  const of = (who: string | null): Kept => {
    const k = keyFor(who);
    if (!held.has(k)) {
      let kept: Kept = { earned: [], shown: [] };
      try {
        const read = JSON.parse(store?.getItem(k) ?? "{}") as Partial<Kept> | null;
        const ids = (v: unknown) => (Array.isArray(v) ? v.filter((id): id is string => !!cleanAchievementId(id)) : []);
        kept = { earned: ids(read?.earned), shown: ids(read?.shown) };
      } catch {
        /* nothing kept */
      }
      held.set(k, kept);
    }
    return held.get(k)!;
  };
  const write = (who: string | null) => {
    try {
      store?.setItem(keyFor(who), JSON.stringify(of(who)));
    } catch {
      /* a private window: kept for this page only */
    }
  };
  const earned = (): string[] => {
    const who = opts.hand.pubkey();
    const all = new Set([...of(who).earned, ...(who ? of(null).earned : [])]);
    return list.filter((a) => all.has(a.id)).map((a) => a.id);
  };

  // Their own relays, by the relay book's rules for a person's list (relay-book.ts, `relaysOf`): waited for while
  // the usual relays answer, kept on the device once known, a miss never kept.
  const ownRelays = (key: string): Promise<string[]> => relaysOf(key, { usual: usual(), mine: true, query, publish, now });

  let events: NostrEvent[] = [];
  let asked = 0;
  let answered = false;

  return {
    list,
    earned,
    shown: () => of(opts.hand.pubkey()).shown.filter((id) => !!one(id)),
    earn(id) {
      const a = one(id);
      if (!world || !a || earned().includes(id)) return false;
      const who = opts.hand.pubkey();
      of(who).earned.push(id);
      write(who);
      changed();
      for (const fn of earners) fn(a);
      return true;
    },
    async show() {
      const who = opts.hand.pubkey();
      if (!world) return { ok: false, said: "This world has no achievements." };
      if (!who) return { ok: false, said: "Sign in to show what you have earned." };
      const kept = of(who);
      const waiting = earned().filter((id) => !kept.shown.includes(id));
      if (waiting.length === 0) return { ok: true, said: earned().length ? "Everything you have earned here is already shown." : "You haven't earned anything here yet." };
      const own = await ownRelays(who);
      let done = 0;
      for (const id of waiting) {
        const a = one(id)!;
        const signed = await opts.hand.sign(world, id, a.title).catch(() => null);
        if (!signed) break;
        const sent = await sendWell(signed, { own, usual: usual(), publish, query, now }).catch(() => null);
        if (!sent || sent.took === 0) break;
        kept.shown.push(id);
        if (!kept.earned.includes(id)) kept.earned.push(id);
        write(who);
        events = [...events.filter((e) => e.id !== signed.id), signed];
        done++;
      }
      changed();
      if (done === 0) return { ok: false, said: "It couldn't be signed or sent, so nothing was shown. What you earned is still kept on this device." };
      const rest = waiting.length - done;
      return { ok: rest === 0, said: `${done === 1 ? "1 achievement is" : `${done} achievements are`} shown as yours. Anyone can see ${done === 1 ? "it" : "them"}.${rest ? ` ${rest} more couldn't be sent: try again in a moment.` : ""}` };
    },
    async holders(fresh = false) {
      if (!world) return null;
      if (fresh || !asked || now() - asked >= 60_000) {
        asked = now();
        // Asked by world, never by person: nobody is told whose achievements are being looked for.
        const got = await askWell({ kinds: [ACHIEVEMENT_KIND], "#a": [world], limit: 500 }, { own: [], usual: usual(), query, timeoutMs: 4000, now }).catch(() => null);
        answered = !!got && Object.values(got.relays).some((said) => said === "eose");
        const byId = new Map([...events, ...(got?.events ?? [])].map((e) => [e.id, e]));
        events = [...byId.values()];
      }
      if (!answered && events.length === 0) return null;
      return achievementsIn(events, { world, worldUrl: opts.worldUrl, counted: opts.counted?.() ?? [], me: opts.hand.pubkey() }).byId;
    },
    heldBy(pubkey) {
      if (!world || events.length === 0) return [];
      const theirs = new Set(achievementsIn(events, { world, worldUrl: opts.worldUrl }).held.filter((h) => h.by === pubkey).map((h) => h.id));
      return list.filter((a) => theirs.has(a.id));
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
    onEarn(fn) {
      earners.add(fn);
      return () => void earners.delete(fn);
    },
  };
}
