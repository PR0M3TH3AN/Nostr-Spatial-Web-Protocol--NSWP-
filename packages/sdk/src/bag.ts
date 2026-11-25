/**
 * A visitor's bag: the items they have, and putting one in or taking one out (protocol/17-items.md).
 *
 *   const bag = createBag({ hand });
 *   await bag.load();                 // their bag, from their own relays
 *   await bag.add(itemsCoordinate);   // { ok, why, said }
 *
 * A bag is one note that is replaced whole, like a follow list. So it is changed the way a follow list is
 * (people.ts): from the newest that can be found now, one item at a time, with everything else kept; nothing is
 * changed when no relay could be reached; and a first bag is written only on a second press.
 *
 * The `hand` is whatever can have the bag signed. Reading a bag needs none: a bag is public.
 */
import { BAG_KIND, bagIn, bagTints, changeBag, tintBag, DEFAULT_RELAYS, itemCoordinate, newestBag, publishEvent, queryRelays, RELAY_PICK, SITE_MARKS, verifyEvent, type NostrEvent } from "@nswp/core";
import { askOwn, sendWell } from "./relay-book.js";

export interface BagHand {
  /** Whether a change can be signed now, with nothing more asked of the visitor. */
  ready(): boolean;
  /** Have a changed bag signed. Null if it couldn't be. */
  sign(bag: { kind: number; created_at: number; tags: string[][]; content: string }): Promise<NostrEvent | null>;
}

export interface BagOptions {
  /** Whose bag: the key signed in here, or null for a guest. */
  me(): string | null;
  /** What signs a change, where this place can: a visitor's own client. Left out, the bag can only be read. */
  hand?: BagHand | null;
  relays?: string[];
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  now?: () => number;
  query?: typeof queryRelays;
  publish?: typeof publishEvent;
}

export interface BagResult {
  ok: boolean;
  why?: "signed-out" | "read-only" | "not-allowed" | "unreachable" | "no-bag" | "refused" | "not-sent" | "already";
  said: string;
}

export interface Bag {
  /** The items in it, as last found. Null while it hasn't been looked for, or for a guest. */
  items(): string[] | null;
  load(fresh?: boolean): Promise<string[] | null>;
  /** Whether this place can change it at all. */
  canChange(): boolean;
  add(item: string, title?: string): Promise<BagResult>;
  remove(item: string, title?: string): Promise<BagResult>;
  /**
   * The colours they chose for one of their things (protocol/17-items.md, "A holder's own colours"): what this
   * device keeps for this place, over what their bag says. Empty where they chose none.
   */
  tints(item: string): Record<string, string>;
  /**
   * Choose them. They are kept on this device at once. Where this place can change the bag, they are written into
   * it a moment after the last change, so that they go with the thing to every world; elsewhere they are for here.
   */
  setTints(item: string, tints: Record<string, string>): void;
  onChange(fn: () => void): () => void;
}

const FRESH_MS = 60_000;

export function createBag(opts: BagOptions): Bag {
  const now = opts.now ?? (() => Date.now());
  const query = opts.query ?? queryRelays;
  const publish = opts.publish ?? publishEvent;
  const usual = () => opts.relays ?? DEFAULT_RELAYS;
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
  const keyFor = (who: string) => `nswp:bag:${who}`;
  const readKept = (who: string): NostrEvent | null => {
    try {
      const kept = JSON.parse(store?.getItem(keyFor(who)) ?? "null") as unknown;
      return verifyEvent(kept) && kept.kind === BAG_KIND && kept.pubkey === who ? kept : null;
    } catch {
      return null;
    }
  };
  const keep = (bag: NostrEvent) => {
    try {
      store?.setItem(keyFor(bag.pubkey), JSON.stringify(bag));
    } catch {
      /* a private window, or a full one: asked for again next time */
    }
  };
  // A bag signed here that fewer than RELAY_PICK.took relays took: marked, and sent again at every look until enough have.
  const unsentKey = (who: string) => `nswp:bag:${who}:unsent`;
  const unsent = (who: string): string | null => {
    try {
      return store?.getItem(unsentKey(who)) ?? null;
    } catch {
      return null;
    }
  };
  const markSent = (bag: NostrEvent, took: number) => {
    try {
      if (took >= RELAY_PICK.took) store?.removeItem(unsentKey(bag.pubkey));
      else store?.setItem(unsentKey(bag.pubkey), bag.id);
    } catch {
      /* a private window: sent again only from this page */
    }
  };

  /** What the last look found. `answered`: enough relays answered to say there is none, or one was found. `own`: their relays. */
  let known: { who: string; bag: NostrEvent | null; answered: boolean; own: string[]; at: number } | null = null;
  let looking: Promise<void> | null = null;
  let offered: { item: string; at: number } | null = null;

  const look = async (who: string): Promise<void> => {
    const kept = readKept(who);
    // Their own bag, on their own device: looked for until it is found or every relay of theirs was asked, and put
    // back where it is missing (relay-book.ts, `askOwn`).
    // A newer bag from a slower relay, after this look has shown what came first: taken, kept and drawn.
    const onNewer = (later: { events: NostrEvent[] }) => {
      const newer = newestBag(later.events.filter((e) => verifyEvent(e)), who);
      if (!newer || !known || known.who !== who || (known.bag && newer.created_at <= known.bag.created_at)) return;
      keep(newer);
      known = { ...known, bag: newer, answered: true };
      changed();
    };
    const got = await askOwn({ kinds: [BAG_KIND], authors: [who], limit: 4 }, who, { usual: usual(), mine: { kept }, query, publish, timeoutMs: 4000, now, onNewer }).catch(() => null);
    const answered = !!got && got.state !== "unreached";
    const own = got?.own ?? [];
    const found = newestBag((got?.events ?? []).filter((e) => verifyEvent(e)), who);
    const bag = found && kept ? (kept.created_at > found.created_at ? kept : found) : (found ?? kept);
    // The device has a newer one than any relay has, or one too few relays took: it is sent again.
    if (kept && bag === kept && (unsent(who) === kept.id || (answered && (!found || found.id !== kept.id))))
      void sendWell(kept, { own, usual: usual(), publish, query, now })
        .then((sent) => markSent(kept, sent.took))
        .catch(() => null);
    if (bag && bag !== kept) keep(bag);
    if (opts.me() !== who) return;
    known = { who, bag, answered, own, at: now() };
    changed();
  };
  /** What is in the bag, where it is known: nothing found where too few relays answered to say so is not "empty". */
  const inBag = (at: NonNullable<typeof known>): string[] | null => (at.bag || at.answered ? bagIn(at.bag) : null);

  const load = async (fresh = false): Promise<string[] | null> => {
    const who = opts.me();
    if (!who) {
      if (known) {
        known = null;
        changed();
      }
      return null;
    }
    if (known && known.who !== who) known = null;
    if (!fresh && known && now() - known.at < FRESH_MS) return inBag(known);
    looking ??= look(who).finally(() => {
      looking = null;
    });
    await looking;
    return known && known.who === who ? inBag(known) : null;
  };

  const change = async (itemIn: string, adding: boolean, title: string): Promise<BagResult> => {
    const who = opts.me();
    const it = title || "It";
    const item = itemCoordinate(itemIn);
    if (!who) return { ok: false, why: "signed-out", said: "Sign in to keep a bag." };
    if (!opts.hand) return { ok: false, why: "read-only", said: "Your bag is changed at your home, not from here." };
    if (!item) return { ok: false, why: "refused", said: "That isn't an item." };
    if (!opts.hand.ready()) return { ok: false, why: "not-allowed", said: "This place hasn't been let change your bag." };
    await load(true);
    const at = known && known.who === who ? known : null;
    if (!at) return { ok: false, why: "unreachable", said: "Your bag couldn't be looked for. Nothing was changed." };
    if (!at.bag) {
      if (!at.answered) return { ok: false, why: "unreachable", said: "No relay could be reached to find your bag, so nothing was changed. Try again in a moment." };
      if (!adding) return { ok: false, why: "already", said: `${it} isn't in your bag.` };
      if (!offered || offered.item !== item || now() - offered.at > 120_000) {
        offered = { item, at: now() };
        return { ok: false, why: "no-bag", said: "No bag of yours was found. If you have none yet, press again to start one." };
      }
    }
    offered = null;
    const has = bagIn(at.bag).includes(item);
    if (adding === has) return { ok: true, why: "already", said: adding ? `${it} is already in your bag.` : `${it} isn't in your bag.` };
    const made = changeBag(at.bag, { ...(adding ? { add: item } : { remove: item }), now: now() / 1000, fromNothing: at.bag === null });
    const signed = made ? await opts.hand.sign(made).catch(() => null) : null;
    // What comes back is checked: theirs, really signed, and the bag that was asked for, give or take a signer's mark.
    const same = signed && verifyEvent(signed) && signed.pubkey === who && signed.kind === BAG_KIND && JSON.stringify(signed.tags.filter((t) => !SITE_MARKS.includes(t[0] ?? ""))) === JSON.stringify(made!.tags);
    if (!signed || !same) return { ok: false, why: "refused", said: "It couldn't be signed. Your bag is as it was." };
    keep(signed);
    known = { who, bag: signed, answered: true, own: at.own, at: now() };
    changed();
    const sent = await sendWell(signed, { own: at.own, usual: usual(), publish, query, now }).catch(() => null);
    markSent(signed, sent?.took ?? 0);
    if (!sent || sent.took === 0) return { ok: false, why: "not-sent", said: "Signed, but no relay took it. It is kept on this device and will be sent again." };
    const done = adding ? `${it} is in your bag. Anyone can see what is in it.` : `${it} is out of your bag.`;
    // Fewer than enough took it: said, with how many, and sent again at the next look.
    if (sent.took < RELAY_PICK.took) return { ok: true, said: `${done} Only ${sent.took === 1 ? "1 relay has" : `${sent.took} relays have`} it so far; it is sent again the next time your bag is looked at.` };
    return { ok: true, said: done };
  };

  // ---- Colours. Kept on the device as they are chosen; written into the bag, where this place can, once the
  // choosing has stopped for a moment, so that stepping through ten colours is one signature and not ten.
  const TINTS_KEY = "nswp:tints";
  const keptTints = (): Record<string, Record<string, string>> => {
    try {
      const kept = JSON.parse(store?.getItem(TINTS_KEY) ?? "{}") as unknown;
      return kept && typeof kept === "object" && !Array.isArray(kept) ? (kept as Record<string, Record<string, string>>) : {};
    } catch {
      return {};
    }
  };
  const tintTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const writeTints = async (item: string): Promise<void> => {
    const who = opts.me();
    if (!who || !opts.hand?.ready()) return;
    await load(true);
    const at = known && known.who === who ? known : null;
    const made = at?.bag ? tintBag(at.bag, { item, tints: keptTints()[item] ?? {}, now: now() / 1000 }) : null;
    const signed = made ? await opts.hand.sign(made).catch(() => null) : null;
    const same = signed && verifyEvent(signed) && signed.pubkey === who && signed.kind === BAG_KIND && JSON.stringify(signed.tags.filter((t) => !SITE_MARKS.includes(t[0] ?? ""))) === JSON.stringify(made!.tags);
    if (!signed || !same) return;
    keep(signed);
    known = { who, bag: signed, answered: true, own: at?.own ?? [], at: now() };
    changed();
    const sent = await sendWell(signed, { own: at?.own ?? [], usual: usual(), publish, query, now }).catch(() => null);
    markSent(signed, sent?.took ?? 0);
  };

  return {
    tints(itemIn) {
      const item = itemCoordinate(itemIn);
      const fromBag = known && known.who === opts.me() ? (bagTints(known.bag)[item] ?? {}) : {};
      const here = keptTints()[item];
      const clean = (o: unknown): Record<string, string> => Object.fromEntries(Object.entries(o && typeof o === "object" ? (o as Record<string, unknown>) : {}).filter((e): e is [string, string] => typeof e[1] === "string" && /^#[0-9a-f]{6}$/.test(e[1])));
      return { ...fromBag, ...clean(here) };
    },
    setTints(itemIn, tints) {
      const item = itemCoordinate(itemIn);
      if (!item) return;
      try {
        store?.setItem(TINTS_KEY, JSON.stringify({ ...keptTints(), [item]: tints }));
      } catch {
        /* a private window: for this page only */
      }
      changed();
      if (!opts.hand) return;
      clearTimeout(tintTimers.get(item));
      tintTimers.set(item, setTimeout(() => void writeTints(item).catch(() => null), 2500));
    },
    items: () => (known && known.who === opts.me() ? inBag(known) : null),
    load,
    canChange: () => !!opts.hand,
    add: (item, title = "") => change(item, true, title),
    remove: (item, title = "") => change(item, false, title),
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
  };
}
