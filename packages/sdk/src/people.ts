/**
 * Who the visitor follows, and following and unfollowing someone (protocol/14-people-and-messages.md).
 *
 *   const people = createPeople({ hand });
 *   await people.load();                       // who they follow, from their own relays
 *   people.isFollowing(theirKey);              // true, false, or null while it isn't known
 *   const r = await people.follow(theirKey);   // { ok, why, said }
 *
 * A follow list is one note that is replaced whole, so the one thing this must never do is write a list that
 * leaves people out. Every change starts from the newest list that can be found now, on the person's own relays
 * and the usual ones and on this device, and changes one line of it. If no relay could be reached, nothing is
 * changed. If relays answered and had no list, a first one is written only on a second press.
 *
 * The `hand` is whatever can have the list signed: in a world, the visitor's signer, once they have let that
 * world follow for them; in the visitor's own client, its own signer. Nothing here holds a key.
 */
import { DEFAULT_RELAYS, FOLLOWS_KIND, followsIn, isFollowAsked, isHex64, newestFollows, publishEvent, queryRelays, readRelayList, RELAY_LIST_KIND, verifyEvent, type NostrEvent } from "@nswp/core";
import { askWell, sendWell } from "./relay-book.js";

export interface FollowHand {
  /** Whose follows these are: the key signed in here, or null for a guest. */
  pubkey(): string | null;
  /** Whether a change can be signed now, with nothing more asked of the visitor. */
  ready(): boolean;
  /** Have their list signed with one change. `list` null is a first list. Null if it couldn't be. */
  change(list: NostrEvent | null, change: { add: string } | { remove: string }): Promise<NostrEvent | null>;
}

export interface PeopleOptions {
  hand: FollowHand;
  /** The usual relays: asked beside the person's own, and written to when too few of their own are up. */
  relays?: string[];
  /** Where the newest list is kept on the device. Null keeps nothing. Left out, the browser's own. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  now?: () => number;
  query?: typeof queryRelays;
  publish?: typeof publishEvent;
}

export type FollowWhy = "signed-out" | "not-allowed" | "unreachable" | "no-list" | "refused" | "not-sent" | "already";

export interface FollowResult {
  ok: boolean;
  /** Why not, or why nothing changed. */
  why?: FollowWhy;
  /** A sentence to say to the visitor. */
  said: string;
}

export interface People {
  /** Who they follow, as last found. Null while it hasn't been looked for, or for a guest. */
  follows(): string[] | null;
  /** True, false, or null while it isn't known. */
  isFollowing(pubkey: string): boolean | null;
  /** Look for their newest list: on their relays and on this device. Asked again only after a minute, unless `fresh`. */
  load(fresh?: boolean): Promise<string[] | null>;
  follow(pubkey: string, name?: string): Promise<FollowResult>;
  unfollow(pubkey: string, name?: string): Promise<FollowResult>;
  /** Be told when what is known changes. Returns how to stop. */
  onChange(fn: () => void): () => void;
}

/** A list bigger than this isn't kept on the device: it is asked for each time. */
const KEPT_MOST = 400_000;
const FRESH_MS = 60_000;

export function createPeople(opts: PeopleOptions): People {
  const { hand } = opts;
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

  const keyFor = (who: string) => `nswp:follows:${who}`;
  const readKept = (who: string): NostrEvent | null => {
    try {
      const kept = JSON.parse(store?.getItem(keyFor(who)) ?? "null") as unknown;
      return verifyEvent(kept) && kept.kind === FOLLOWS_KIND && kept.pubkey === who ? kept : null;
    } catch {
      return null;
    }
  };
  const keep = (list: NostrEvent) => {
    try {
      const text = JSON.stringify(list);
      if (text.length <= KEPT_MOST) store?.setItem(keyFor(list.pubkey), text);
      else store?.removeItem(keyFor(list.pubkey));
    } catch {
      /* a private window, or a full one: asked for again next time */
    }
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

  /** What is known: whose it is, their newest list, whether any relay answered, and when it was looked for. */
  let known: { who: string; list: NostrEvent | null; answered: boolean; at: number } | null = null;
  let looking: Promise<void> | null = null;
  /** Someone they pressed to follow when no list was found: a second press starts a list. */
  let offered: { who: string; at: number } | null = null;

  const look = async (who: string): Promise<void> => {
    const kept = readKept(who);
    const own = await ownRelays(who);
    const got = await askWell({ kinds: [FOLLOWS_KIND], authors: [who], limit: 4 }, { own, usual: usual(), query, timeoutMs: 4000, now }).catch(() => null);
    const answered = !!got && Object.values(got.relays).some((said) => said === "eose");
    const found = newestFollows((got?.events ?? []).filter((e) => verifyEvent(e)), who);
    const list = found && kept ? (kept.created_at > found.created_at ? kept : found) : (found ?? kept);
    // The device has a newer one than any relay: it was signed here and never arrived. It is sent again.
    if (kept && list === kept && answered && (!found || found.id !== kept.id)) void sendWell(kept, { own, usual: usual(), publish, now }).catch(() => null);
    if (list && list !== kept) keep(list);
    if (hand.pubkey() !== who) return;
    known = { who, list, answered, at: now() };
    changed();
  };

  const load = async (fresh = false): Promise<string[] | null> => {
    const who = hand.pubkey();
    if (!who) {
      if (known) {
        known = null;
        changed();
      }
      return null;
    }
    if (known && known.who !== who) known = null;
    if (!fresh && known && now() - known.at < FRESH_MS) return followsIn(known.list);
    looking ??= look(who).finally(() => {
      looking = null;
    });
    await looking;
    return known && known.who === who ? followsIn(known.list) : null;
  };

  const change = async (pubkey: string, adding: boolean, name: string): Promise<FollowResult> => {
    const who = hand.pubkey();
    const them = name || "them";
    if (!who) return { ok: false, why: "signed-out", said: "Sign in to follow people." };
    if (!isHex64(pubkey) || pubkey === who) return { ok: false, why: "refused", said: "That isn't someone who can be followed." };
    if (!hand.ready()) return { ok: false, why: "not-allowed", said: "This place hasn't been let change who you follow." };
    // Always from the newest that can be found now: never from what was known a minute ago.
    await load(true);
    const at = known && known.who === who ? known : null;
    if (!at) return { ok: false, why: "unreachable", said: "Your follow list couldn't be looked for. Nothing was changed." };
    const list = at.list;
    if (!list) {
      if (!at.answered) return { ok: false, why: "unreachable", said: "No relay could be reached to find who you follow, so nothing was changed. Try again in a moment." };
      if (!adding) return { ok: false, why: "already", said: `You don't follow ${them}.` };
      // Relays answered, and none has a list of theirs. A first list is written only on a second press: writing
      // one over a list that merely wasn't found would lose everyone on it.
      if (!offered || offered.who !== pubkey || now() - offered.at > 120_000) {
        offered = { who: pubkey, at: now() };
        return { ok: false, why: "no-list", said: `No follow list of yours was found. If you follow nobody yet, press again to start one with ${them}.` };
      }
    }
    offered = null;
    const follows = followsIn(list).includes(pubkey);
    if (adding === follows) return { ok: true, why: "already", said: adding ? `You already follow ${them}.` : `You don't follow ${them}.` };
    const asked = adding ? { add: pubkey } : { remove: pubkey };
    const signed = await hand.change(list, asked).catch(() => null);
    // Checked again here, whoever the hand is: their own list, really signed, with that one change and no other.
    if (!signed || !isFollowAsked(signed, { list, ...asked, pubkey: who })) return { ok: false, why: "refused", said: "It couldn't be signed. Who you follow is as it was." };
    keep(signed);
    known = { who, list: signed, answered: true, at: now() };
    changed();
    const sent = await sendWell(signed, { own: await ownRelays(who), usual: usual(), publish, now }).catch(() => null);
    if (!sent || sent.took === 0) return { ok: false, why: "not-sent", said: `Signed, but no relay took it. It is kept on this device and will be sent again.` };
    return { ok: true, said: adding ? `You follow ${them}. Anyone can see who you follow.` : `You no longer follow ${them}.` };
  };

  return {
    follows: () => (known && known.who === hand.pubkey() ? followsIn(known.list) : null),
    isFollowing(pubkey) {
      return known && known.who === hand.pubkey() && (known.list || known.answered) ? followsIn(known.list).includes(pubkey) : null;
    },
    load,
    follow: (pubkey, name = "") => change(pubkey, true, name),
    unfollow: (pubkey, name = "") => change(pubkey, false, name),
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
  };
}
