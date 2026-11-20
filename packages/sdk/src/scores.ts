/**
 * A world's scores (protocol/15-scores.md): the visitor's best on each of the world's boards, posting it when
 * they say to, and reading the board.
 *
 *   const scores = createScores({ world, worldUrl, boards, hand });
 *   scores.record("main", 42_500);              // a run just ended: kept on the device if it is their best
 *   await scores.post("main");                  // from their press: signed by them, and sent to relays
 *   const board = await scores.standings("main");
 *
 * Optional, like everything about scores: a world that names no boards has none of this.
 *
 * A visitor's best is kept on the device, whoever they are. It becomes public only when they post it, which
 * they do by pressing: a score on a board says that this person was in this world, and how they did.
 */
import { cleanBoard, cleanScore, DEFAULT_RELAYS, publishEvent, queryRelays, rankScores, readRelayList, RELAY_LIST_KIND, SCORE_KIND, scoreWords, worldCoordinate, type Board, type NostrEvent, type Standings } from "@nswp/core";
import { askWell, sendWell } from "./relay-book.js";

export interface ScoreHand {
  /** Who is signed in here, or null for a guest. */
  pubkey(): string | null;
  /** Have a score signed for this world. Null if it couldn't be. */
  sign(world: string, board: string, score: number): Promise<NostrEvent | null>;
}

export interface ScoresOptions {
  /** This world's own coordinate: `37300:<publisher>:<d>`. */
  world: string;
  /** This world's address. A score counts on its board only if it was asked for here. */
  worldUrl: string;
  boards: Board[];
  hand: ScoreHand;
  /** The people the visitor has reason to know: listed first. Usually who they follow, where that is known. */
  counted?: () => Iterable<string>;
  relays?: string[];
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  now?: () => number;
  query?: typeof queryRelays;
  publish?: typeof publishEvent;
}

export interface Scores {
  readonly boards: Board[];
  /** Their best on a board, as kept on this device, or null. */
  best(board: string): number | null;
  /** What they last posted to a board from this device, or null. */
  posted(board: string): number | null;
  /** A score they just made. True if it is their best: it is kept. Nothing is sent. */
  record(board: string, score: number): boolean;
  /** Post their best to the board: signed by them, sent to relays. From their press. */
  post(board: string): Promise<{ ok: boolean; said: string }>;
  /** The board, from relays: asked again only after a minute, unless `fresh`. Null where no relay answered. */
  standings(board: string, fresh?: boolean): Promise<Standings | null>;
  /** A score in the board's own words: "42.5 s". */
  words(board: string, score: number): string;
  onChange(fn: () => void): () => void;
}

export function createScores(opts: ScoresOptions): Scores {
  const world = worldCoordinate(opts.world);
  const now = opts.now ?? (() => Date.now());
  const query = opts.query ?? queryRelays;
  const publish = opts.publish ?? publishEvent;
  const usual = () => opts.relays ?? DEFAULT_RELAYS;
  const boards = opts.boards.filter((b) => cleanBoard(b.id));
  const boardOf = (id: string) => boards.find((b) => b.id === id) ?? null;
  const better = (b: Board, a: number, than: number | null) => than === null || (b.order === "low" ? a < than : a > than);
  const store = (() => {
    if (opts.storage !== undefined) return opts.storage;
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  })();
  const watchers = new Set<() => void>();
  const changed = () => {
    for (const fn of watchers) fn();
  };

  // Kept apart for each person who has signed in on the device, and for a guest. What a guest scored is theirs
  // once they sign in: the better of the two is their best.
  type Kept = Record<string, { best?: number; posted?: number }>;
  const keyFor = (who: string | null) => `nswp:scores:${world}:${who ?? "guest"}`;
  const read = (who: string | null): Kept => {
    try {
      const kept = JSON.parse(store?.getItem(keyFor(who)) ?? "{}") as unknown;
      return kept && typeof kept === "object" && !Array.isArray(kept) ? (kept as Kept) : {};
    } catch {
      return {};
    }
  };
  const write = (who: string | null, kept: Kept) => {
    try {
      store?.setItem(keyFor(who), JSON.stringify(kept));
    } catch {
      /* a private window: kept for this page only, below */
    }
  };
  const held = new Map<string, Kept>();
  const of = (who: string | null): Kept => {
    const k = keyFor(who);
    if (!held.has(k)) held.set(k, read(who));
    return held.get(k)!;
  };
  const best = (id: string): number | null => {
    const b = boardOf(id);
    if (!b) return null;
    const mine = cleanScore(of(opts.hand.pubkey())[id]?.best);
    const guest = opts.hand.pubkey() ? cleanScore(of(null)[id]?.best) : null;
    if (mine === null) return guest;
    return guest !== null && better(b, guest, mine) ? guest : mine;
  };

  let relaysKept: { key: string; at: number; found: Promise<string[]> } | null = null;
  const ownRelays = (key: string): Promise<string[]> => {
    if (relaysKept && relaysKept.key === key && now() - relaysKept.at < 600_000) return relaysKept.found;
    const found = askWell({ kinds: [RELAY_LIST_KIND], authors: [key], limit: 4 }, { own: [], usual: usual(), query, timeoutMs: 2500, now })
      .then((got) => readRelayList(got.events, key)?.write ?? [])
      .catch(() => []);
    relaysKept = { key, at: now(), found };
    return found;
  };

  let events: NostrEvent[] = [];
  let asked = 0;
  let answered = false;
  const fetchAll = async (fresh: boolean): Promise<void> => {
    if (!fresh && asked && now() - asked < 60_000) return;
    asked = now();
    // Asked by world, never by person: nobody is told whose scores are being looked for.
    const got = await askWell({ kinds: [SCORE_KIND], "#a": [world], limit: 500 }, { own: [], usual: usual(), query, timeoutMs: 4000, now }).catch(() => null);
    answered = !!got && Object.values(got.relays).some((said) => said === "eose");
    const byId = new Map([...events, ...(got?.events ?? [])].map((e) => [e.id, e]));
    events = [...byId.values()];
  };

  return {
    boards,
    best,
    posted: (id) => cleanScore(of(opts.hand.pubkey())[id]?.posted),
    record(id, score) {
      const b = boardOf(id);
      const made = cleanScore(score);
      if (!world || !b || made === null || !better(b, made, best(id))) return false;
      const who = opts.hand.pubkey();
      const kept = of(who);
      kept[id] = { ...kept[id], best: made };
      write(who, kept);
      changed();
      return true;
    },
    async post(id) {
      const b = boardOf(id);
      const who = opts.hand.pubkey();
      if (!world || !b) return { ok: false, said: "This world has no such board." };
      if (!who) return { ok: false, said: "Sign in here to post a score: it is under You." };
      const mine = best(id);
      if (mine === null) return { ok: false, said: "You have no score here yet." };
      const kept = of(who);
      const had = cleanScore(kept[id]?.posted);
      if (had !== null && !better(b, mine, had)) return { ok: true, said: `Your best, ${scoreWords(b, mine)}, is already on the board.` };
      const signed = await opts.hand.sign(world, id, mine).catch(() => null);
      if (!signed) return { ok: false, said: "It couldn't be signed, so nothing was posted. Your best is still kept on this device." };
      const sent = await sendWell(signed, { own: await ownRelays(who), usual: usual(), publish, query, now }).catch(() => null);
      if (!sent || sent.took === 0) return { ok: false, said: "No relay took it. Your best is still kept on this device: try again in a moment." };
      kept[id] = { best: mine, posted: mine };
      write(who, kept);
      events = [...events.filter((e) => e.id !== signed.id), signed];
      changed();
      return { ok: true, said: `${scoreWords(b, mine)} is on the board, as yours. Anyone can see it.` };
    },
    async standings(id, fresh = false) {
      const b = boardOf(id);
      if (!world || !b) return null;
      await fetchAll(fresh);
      if (!answered && events.length === 0) return null;
      return rankScores(events, { world, board: id, order: b.order, worldUrl: opts.worldUrl, counted: opts.counted?.() ?? [], me: opts.hand.pubkey() });
    },
    words: (id, score) => {
      const b = boardOf(id);
      return b ? scoreWords(b, score) : String(score);
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
  };
}
