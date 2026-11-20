/**
 * The visitor's private messages (protocol/14-people-and-messages.md): Nostr's own, NIP-17, the same ones every
 * other Nostr app that speaks it shows.
 *
 *   const messages = createMessages({ hand });
 *   await messages.load();                       // what has been sent to them, and what they sent
 *   messages.conversations();                    // one for each person, newest first
 *   await messages.send(theirKey, "Hello.");     // { ok, said }
 *
 * The `hand` is whatever seals and opens for the visitor: in a world, their signer, once they have let that world
 * handle their messages; in their own client, its own signer. Nothing here holds a key, and nothing that was
 * read is kept once the page is closed: only how far each conversation had been read.
 *
 * A relay is told who a message is for, and nothing of who sent it or what it says.
 */
import { DEFAULT_RELAYS, isHex64, looksLikeWrap, MESSAGE_RELAYS_KIND, publishEvent, queryRelays, readMessageRelays, readRelayList, RELAY_LIST_KIND, WRAP_KIND, wrapSeal, writtenWith, type Message, type NostrEvent, type SealedMessage } from "@nswp/core";
import { askWell, learnFrom, sendWell } from "./relay-book.js";

export interface MessageHand {
  /** Whose messages: the key signed in here, or null for a guest. */
  pubkey(): string | null;
  /** Whether a message can be sealed and opened now, with nothing more asked of the visitor. */
  ready(): boolean;
  /** Write a message and seal it: for its reader, then for its writer. Null if it couldn't be. */
  seal(to: string, text: string): Promise<SealedMessage | null>;
  /** Open a wrapped message that a relay gave. Null if it isn't a message for them. */
  open(wrap: NostrEvent): Promise<Message | null>;
  /** Sign the list of where their messages reach them. Null if it couldn't be. */
  reach(relays: readonly string[]): Promise<NostrEvent | null>;
}

export interface MessagesOptions {
  hand: MessageHand;
  /** The usual relays. */
  relays?: string[];
  /** Whether a message from this person is one the visitor would expect: someone they follow. */
  known?: (pubkey: string) => boolean;
  /** Where how far each conversation was read is kept. Null keeps nothing. Left out, the browser's own. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  now?: () => number;
  query?: typeof queryRelays;
  publish?: typeof publishEvent;
}

export interface Conversation {
  /** The other person. */
  with: string;
  last: Message;
  /** How many of theirs have arrived since the visitor last looked. */
  unread: number;
  /** From someone they follow, or someone they have written to. Anything else is a request. */
  known: boolean;
}

/**
 * - "off": nobody is signed in, or this place hasn't been let.
 * - "looking": being asked for.
 * - "unreachable": no relay answered.
 * - "no-inbox": they haven't said where messages reach them, so nobody can write to them this way yet.
 * - "ready".
 */
export type MessagesState = "off" | "looking" | "unreachable" | "no-inbox" | "ready";

export interface Messages {
  state(): MessagesState;
  /** Where their messages reach them, as they have said. */
  inbox(): string[];
  /** The relays offered when they have said nowhere: their own, or the usual ones. */
  offered(): string[];
  load(fresh?: boolean): Promise<void>;
  /** Say where messages reach them: the relays offered. Signed by them, and sent to their relays. */
  setUp(): Promise<{ ok: boolean; said: string }>;
  conversations(): Conversation[];
  /** One conversation, oldest first. */
  thread(peer: string): Message[];
  send(to: string, text: string, name?: string): Promise<{ ok: boolean; said: string }>;
  /** The visitor is looking at this conversation: what has arrived in it is read. */
  seen(peer: string): void;
  /** How many unread there are, from people they would expect. */
  unread(): number;
  onChange(fn: () => void): () => void;
  /** Be told of each message from someone else as it is first read, after the first look. */
  onNew(fn: (message: Message) => void): () => void;
}

/** No more wraps than this are asked for, or opened, in one look. */
const MOST = 300;
const FRESH_MS = 45_000;

export function createMessages(opts: MessagesOptions): Messages {
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
  const newcomers = new Set<(m: Message) => void>();
  const changed = () => {
    for (const fn of watchers) fn();
  };

  let who: string | null = null;
  let state: MessagesState = "off";
  let inbox: string[] = [];
  let own: { read: string[]; write: string[] } = { read: [], write: [] };
  const read = new Map<string, Message>();
  /** Wraps that have been handed to the signer: each is opened once. */
  const tried = new Set<string>();
  let looked = 0;
  let looking: Promise<void> | null = null;
  let first = true;

  const seenKey = (me: string) => `nswp:messages:seen:${me}`;
  let marks: Record<string, number> | null = null;
  const seenAt = (): Record<string, number> => {
    if (marks) return marks;
    marks = {};
    try {
      const kept = JSON.parse((who && store?.getItem(seenKey(who))) || "{}") as unknown;
      if (kept && typeof kept === "object" && !Array.isArray(kept)) for (const [k, v] of Object.entries(kept as Record<string, unknown>)) if (isHex64(k) && typeof v === "number") marks[k] = v;
    } catch {
      /* nothing kept */
    }
    return marks;
  };

  const reset = (me: string | null) => {
    who = me;
    state = me && hand.ready() ? "looking" : "off";
    inbox = [];
    own = { read: [], write: [] };
    read.clear();
    tried.clear();
    marks = null;
    looked = 0;
    first = true;
  };

  const threads = (): Map<string, Message[]> => {
    const by = new Map<string, Message[]>();
    if (!who) return by;
    for (const m of read.values()) {
      const peer = writtenWith(m, who);
      // A message among several isn't shown in this version.
      if (!peer) continue;
      by.set(peer, [...(by.get(peer) ?? []), m]);
    }
    for (const list of by.values()) list.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    return by;
  };
  const unreadIn = (peer: string, list: Message[]) => list.filter((m) => m.from === peer && m.at > (seenAt()[peer] ?? 0)).length;
  const knownTo = (peer: string, list: Message[]) => !!opts.known?.(peer) || list.some((m) => m.from === who);

  const look = async (me: string): Promise<void> => {
    // Their own relays, and where they have said messages reach them.
    const lists = await askWell({ kinds: [RELAY_LIST_KIND, MESSAGE_RELAYS_KIND], authors: [me], limit: 8 }, { own: [], usual: usual(), query, timeoutMs: 3500, now }).catch(() => null);
    if (hand.pubkey() !== me) return;
    const answered = !!lists && Object.values(lists.relays).some((said) => said === "eose");
    const relayList = readRelayList(lists?.events ?? [], me);
    own = { read: relayList?.read ?? [], write: relayList?.write ?? [] };
    const found = readMessageRelays(lists?.events ?? [], me);
    if (found.length) inbox = found;
    if (!inbox.length) {
      state = answered ? "no-inbox" : "unreachable";
      looked = now();
      return changed();
    }
    const got = await query(inbox, { kinds: [WRAP_KIND], "#p": [me], limit: MOST }, 5000).catch(() => null);
    if (hand.pubkey() !== me) return;
    if (got) learnFrom(got.relays, now());
    const wraps = (got?.events ?? []).filter((e) => !tried.has(e.id) && looksLikeWrap(e, me)).slice(0, MOST);
    for (const wrap of wraps) {
      tried.add(wrap.id);
      const message = await hand.open(wrap).catch(() => null);
      if (hand.pubkey() !== me) return;
      if (!message || read.has(message.id)) continue;
      read.set(message.id, message);
      // Word of it, once the first look is done: what was already there isn't news.
      if (!first && message.from !== me) for (const fn of newcomers) fn(message);
    }
    first = false;
    state = got && Object.values(got.relays).some((said) => said === "eose") ? "ready" : read.size ? "ready" : "unreachable";
    looked = now();
    changed();
  };

  const load = async (fresh = false): Promise<void> => {
    const me = hand.ready() ? hand.pubkey() : null;
    if (me !== who || (!me && state !== "off")) {
      reset(me);
      changed();
    }
    if (!me) return;
    if (!fresh && looked && now() - looked < FRESH_MS) return;
    looking ??= look(me).finally(() => {
      looking = null;
    });
    await looking;
  };

  const offered = (): string[] => (own.read.length ? own.read : usual()).slice(0, 3);

  return {
    state: () => (hand.ready() && hand.pubkey() === who && who ? state : "off"),
    inbox: () => [...inbox],
    offered,
    load,
    async setUp() {
      const me = hand.pubkey();
      if (!me || !hand.ready()) return { ok: false, said: "Sign in first." };
      const relays = offered();
      const signed = await hand.reach(relays).catch(() => null);
      if (!signed) return { ok: false, said: "It couldn't be signed. Nothing was changed." };
      const sent = await sendWell(signed, { own: own.write, usual: usual(), publish, now }).catch(() => null);
      if (!sent || sent.took === 0) return { ok: false, said: "No relay took it. Try again in a moment." };
      inbox = relays;
      state = "ready";
      changed();
      void load(true);
      return { ok: true, said: `Private messages now reach you at ${relays.map((r) => r.replace(/^wss:\/\//, "")).join(", ")}.` };
    },
    conversations() {
      const out: Conversation[] = [];
      for (const [peer, list] of threads()) out.push({ with: peer, last: list[list.length - 1]!, unread: unreadIn(peer, list), known: knownTo(peer, list) });
      return out.sort((a, b) => b.last.at - a.last.at);
    },
    thread: (peer) => threads().get(peer) ?? [],
    async send(to, text, name = "") {
      const me = hand.pubkey();
      const them = name || "them";
      if (!me || !hand.ready()) return { ok: false, said: "Sign in to write to people." };
      if (!isHex64(to) || to === me) return { ok: false, said: "That isn't someone who can be written to." };
      if (!inbox.length) return { ok: false, said: "Say where your own messages reach you first: without that you couldn't read back what you sent, or be answered." };
      // Where their messages reach them: asked of the usual relays and of the visitor's own.
      const asked = await askWell({ kinds: [MESSAGE_RELAYS_KIND], authors: [to], limit: 4 }, { own: inbox, usual: usual(), query, timeoutMs: 3500, now }).catch(() => null);
      const theirs = readMessageRelays(asked?.events ?? [], to);
      if (!theirs.length) {
        const answered = !!asked && Object.values(asked.relays).some((said) => said === "eose");
        return { ok: false, said: answered ? `${name || "They"} ${name ? "hasn't" : "haven't"} said where private messages reach them, so one can't be sent. Nothing was sent.` : "No relay could be reached. Nothing was sent." };
      }
      const sealed = await hand.seal(to, text).catch(() => null);
      if (!sealed) return { ok: false, said: "It couldn't be signed. Nothing was sent." };
      const t = now() / 1000;
      const forThem = wrapSeal(sealed.seals[0], to, { now: t });
      const forMe = wrapSeal(sealed.seals[1], me, { now: t });
      if (!forThem || !forMe) return { ok: false, said: "It couldn't be wrapped. Nothing was sent." };
      const sent = await publish(theirs, forThem).catch(() => null);
      if (sent) learnFrom(sent.relays, now());
      if (!sent || !Object.values(sent.relays).some((said) => said === "ok")) return { ok: false, said: `None of the relays ${them === "them" ? "they use" : `${them} uses`} for messages took it. It wasn't sent.` };
      // Their own copy: so they can read back what they sent, here and in any other app.
      tried.add(forMe.id);
      void publish(inbox, forMe)
        .then((kept) => learnFrom(kept.relays, now()))
        .catch(() => undefined);
      const m = sealed.message;
      read.set(m.id, { id: m.id, from: me, to: [to], text: m.content, at: m.created_at });
      changed();
      return { ok: true, said: "" };
    },
    seen(peer) {
      if (!who) return;
      const newest = (threads().get(peer) ?? []).reduce((at, m) => Math.max(at, m.at), 0);
      if (!newest || (seenAt()[peer] ?? 0) >= newest) return;
      seenAt()[peer] = newest;
      try {
        store?.setItem(seenKey(who), JSON.stringify(seenAt()));
      } catch {
        /* a private window: read for this page only */
      }
      changed();
    },
    unread() {
      let n = 0;
      for (const [peer, list] of threads()) if (knownTo(peer, list)) n += unreadIn(peer, list);
      return n;
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
    onNew(fn) {
      newcomers.add(fn);
      return () => void newcomers.delete(fn);
    },
  };
}
