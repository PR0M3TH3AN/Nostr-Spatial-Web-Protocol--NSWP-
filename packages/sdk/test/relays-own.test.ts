// A visitor's own notes, looked for and sent well: on stand-in relays that answer late, refuse, or keep nothing.
// Each of these failed on kit 0.89.0, in what is live (the owner's empty bag on his phone, 2026-11-24). Nothing here
// reaches a real relay: every asking and every sending is the stand-in's.
import { BAG_KIND, bagIn, finalizeEvent, getPublicKey, RELAY_LIST_KIND, RELAY_PICK, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createBag, type BagHand } from "../src/bag.js";
import { askOwn, forgetRelays } from "../src/relay-book.js";

const KEY = sha256(utf8ToBytes("nswp sdk own-notes test key"));
const OTHER = sha256(utf8ToBytes("nswp sdk own-notes test someone else"));
const me = getPublicKey(KEY);
const them = getPublicKey(OTHER);
const MAKER = getPublicKey(sha256(utf8ToBytes("nswp sdk own-notes test maker")));
const LANTERN = `37303:${MAKER}:brass-lantern`;
const BOOK = `37303:${MAKER}:old-book`;
const USUAL = ["wss://usual-1.example", "wss://usual-2.example", "wss://usual-3.example", "wss://usual-4.example"];
const own = (n: number) => Array.from({ length: n }, (_, i) => `wss://own-${i + 1}.example`);
let T = 1_800_000_000_000;
const clock = () => (T += 1000);

/** How one stand-in relay behaves. */
interface Relay {
  /** What it keeps. */
  kept: NostrEvent[];
  /** How long it takes to answer a question, in milliseconds; past the wait it was given, it ran out of time. */
  late?: number;
  /** Never answers. */
  down?: boolean;
  /** Answers a question with CLOSED "auth-required:". */
  readClosed?: boolean;
  /** Answers a note with OK false "restricted:" (a paid relay), or takes nothing at all ("full"). */
  writeClosed?: boolean;
  full?: boolean;
}
const matches = (e: NostrEvent, f: Filter) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey));

/** Stand-in relays by address; anything not named is down. Counts the sockets each asking and sending opens. */
const net = (relays: Record<string, Relay>) => {
  const n = {
    relays,
    asked: [] as { url: string; kinds: number[]; ms: number }[],
    sent: [] as { url: string; id: string }[],
    query: async (urls: string[], filter: Filter, ms = 4000) => {
      const events: NostrEvent[] = [];
      const said: Record<string, string> = {};
      for (const url of urls) {
        n.asked.push({ url, kinds: filter.kinds ?? [], ms });
        const r = relays[url];
        if (!r || r.down || (r.late ?? 0) > ms) said[url] = "timeout";
        else if (r.readClosed) said[url] = "closed: auth-required: sign in first";
        else {
          events.push(...r.kept.filter((e) => matches(e, filter)));
          said[url] = "eose";
        }
      }
      return { events, relays: said };
    },
    publish: async (urls: string[], event: NostrEvent) => {
      const said: Record<string, string> = {};
      for (const url of urls) {
        n.sent.push({ url, id: event.id });
        const r = relays[url];
        if (!r || r.down || r.full) said[url] = "timeout";
        else if (r.writeClosed) said[url] = "rejected: restricted: a paid relay";
        else {
          if (!r.kept.some((e) => e.id === event.id)) r.kept.push(event);
          said[url] = "ok";
        }
      }
      return { relays: said };
    },
    has: (url: string, id: string) => !!relays[url]?.kept.some((e) => e.id === id),
  };
  return n;
};

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const hand = (): BagHand => ({ ready: () => true, sign: async (bag) => finalizeEvent(bag, KEY) });
const bagNote = (items: string[], at = T / 1000 - 100, key = KEY) => finalizeEvent({ kind: BAG_KIND, created_at: at, tags: [["d", "bag"], ...items.map((i) => ["a", i])], content: "" }, key);
const listNote = (relays: string[], key = KEY) => finalizeEvent({ kind: RELAY_LIST_KIND, created_at: T / 1000 - 1000, tags: relays.map((r) => ["r", r]), content: "" }, key);
/** Every relay here, each up and keeping nothing, with what is named over it. */
const all = (urls: string[], over: Record<string, Partial<Relay>> = {}): Record<string, Relay> =>
  Object.fromEntries(urls.map((u) => [u, { kept: [], ...over[u] } as Relay]));
const bagOn = (n: ReturnType<typeof net>, o: { hand?: boolean } = {}) =>
  createBag({ me: () => me, ...(o.hand ? { hand: hand() } : {}), relays: USUAL, storage: memory(), now: clock, query: n.query, publish: n.publish });

beforeEach(() => forgetRelays());

describe("a look for a visitor's own bag", () => {
  it("is never 'empty' where nobody answered: it couldn't be looked for", async () => {
    const n = net({});
    expect(await bagOn(n).load()).toBeNull();
  });

  it("finds it on their own relays where their relay list comes late, at three seconds", async () => {
    const mine = own(6);
    const bag = bagNote([LANTERN]);
    const n = net(all([...USUAL, ...mine], Object.fromEntries(mine.map((u) => [u, { kept: [bag] }]))));
    // The list is on the usual relays, answering after three seconds; the bag is on none of the usual relays.
    for (const u of USUAL) n.relays[u] = { kept: [listNote(mine)], late: 3000 };
    expect(await bagOn(n).load()).toEqual([LANTERN]);
  });

  it("finds it on the twentieth of twenty-three relays of theirs, asked in waves", async () => {
    const mine = own(23);
    const bag = bagNote([LANTERN, BOOK]);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine)] }, [mine[19]!]: { kept: [bag] } }));
    expect(await bagOn(n).load()).toEqual([LANTERN, BOOK]);
    // Sockets: the first look's (usual ones and six of theirs), then waves of four, each relay asked once, and no
    // late asking once it is found.
    const forBag = n.asked.filter((a) => a.kinds.includes(BAG_KIND));
    expect(forBag.length).toBe(new Set(forBag.map((a) => a.url)).size);
    expect(forBag.filter((a) => a.ms === RELAY_PICK.waveMs).length).toBeLessThanOrEqual(Math.ceil((23 - RELAY_PICK.most) / RELAY_PICK.wave) * RELAY_PICK.wave);
    expect(forBag.some((a) => a.ms === RELAY_PICK.lateMs)).toBe(false);
  });

  it("finds it on a relay that answers at four and a half seconds, asked once more and waited for longer", async () => {
    const mine = own(3);
    const bag = bagNote([BOOK]);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine)] }, [mine[1]!]: { kept: [bag], late: 4500 } }));
    expect(await bagOn(n).load()).toEqual([BOOK]);
    expect(n.asked.some((a) => a.url === mine[1] && a.ms === RELAY_PICK.lateMs)).toBe(true);
  });

  it("says 'empty' only once every relay of theirs was asked and enough answered to the end", async () => {
    const mine = own(10);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine)] } }));
    expect(await bagOn(n).load()).toEqual([]);
    const asked = new Set(n.asked.filter((a) => a.kinds.includes(BAG_KIND)).map((a) => a.url));
    for (const u of mine) expect(asked.has(u), u).toBe(true);
    // Most of them down: too few answered to say so.
    const few = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine)] }, ...Object.fromEntries([...USUAL.slice(1), ...mine].map((u) => [u, { kept: [], down: true }])) }));
    expect(await bagOn(few).load()).toBeNull();
  });
});

describe("a visitor's own bag, sent", () => {
  it("says how many relays have it where fewer than three took it, and sends it again at the next look", async () => {
    const mine = own(6);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine), bagNote([LANTERN])] } }));
    // Only one of all of them takes anything.
    for (const u of [...USUAL.slice(1), ...mine]) n.relays[u]!.full = true;
    const bag = bagOn(n, { hand: true });
    const said = await bag.add(BOOK, "Old book");
    expect(said.ok).toBe(true);
    expect(said.said).toContain("Only 1 relay has it so far");
    // Two more take things now; the next look sends it again, to make three.
    n.relays[mine[0]!]!.full = false;
    n.relays[mine[1]!]!.full = false;
    await bag.load(true);
    await new Promise((r) => setTimeout(r, 0));
    const newest = n.relays[USUAL[0]!]!.kept.filter((e) => e.kind === BAG_KIND).sort((a, b) => b.created_at - a.created_at)[0]!;
    expect(bagIn(newest)).toEqual([LANTERN, BOOK]);
    expect([USUAL[0]!, mine[0]!, mine[1]!].filter((u) => n.has(u, newest.id)).length).toBe(3);
  });

  it("always reaches at least one usual relay, even with three of their own working", async () => {
    const mine = own(4);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine), bagNote([LANTERN])] } }));
    const bag = bagOn(n, { hand: true });
    expect((await bag.add(BOOK, "Old book")).ok).toBe(true);
    const sent = n.sent.at(-1)!.id;
    expect(USUAL.filter((u) => n.has(u, sent)).length).toBeGreaterThanOrEqual(RELAY_PICK.usual);
    expect(mine.filter((u) => n.has(u, sent)).length).toBeGreaterThanOrEqual(3);
  });

  it("is put back on the relays of theirs that answered without it", async () => {
    const mine = own(5);
    const bag = bagNote([LANTERN]);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine)] }, [mine[0]!]: { kept: [bag] } }));
    expect(await bagOn(n).load()).toEqual([LANTERN]);
    await new Promise((r) => setTimeout(r, 0));
    const backOn = mine.slice(1).filter((u) => n.has(u, bag.id));
    expect(backOn.length).toBe(4);
    // Nothing new was signed: what was sent is the very bag, or their relay list put back beside it.
    const list = n.relays[USUAL[0]!]!.kept[0]!;
    expect(n.sent.every((s) => s.id === bag.id || s.id === list.id)).toBe(true);
    // Once a day at most for each relay.
    const before = n.sent.length;
    for (const u of mine.slice(1)) n.relays[u]!.kept = [];
    await bagOn(n).load();
    await new Promise((r) => setTimeout(r, 0));
    expect(n.sent.filter((s) => s.id === bag.id).length - before).toBeLessThanOrEqual(0);
  });

  it("puts their relay list back on a usual relay that answered without it", async () => {
    const mine = own(3);
    const list = listNote(mine);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [list] }, [mine[0]!]: { kept: [bagNote([BOOK])] } }));
    await bagOn(n).load();
    await new Promise((r) => setTimeout(r, 0));
    expect(USUAL.slice(1).filter((u) => n.has(u, list.id)).length).toBe(3);
  });
});

describe("a relay that asks for a sign-in or a payment", () => {
  it("found closed to reading takes no place in the next look", async () => {
    // Six of theirs: all within the first look, so only being closed can leave one out.
    const mine = own(RELAY_PICK.most);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine)] }, [mine[0]!]: { kept: [], readClosed: true }, [mine[5]!]: { kept: [bagNote([LANTERN])] } }));
    await bagOn(n).load();
    const firstTime = n.asked.filter((a) => a.url === mine[0] && a.kinds.includes(BAG_KIND)).length;
    n.asked.length = 0;
    await bagOn(n).load(true);
    expect(firstTime).toBe(1);
    expect(n.asked.filter((a) => a.url === mine[0] && a.kinds.includes(BAG_KIND)).length).toBe(0);
  });

  it("paid, refusing a note and answering a question: keeps its place in a look, and loses it in a send", async () => {
    const mine = own(4);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine), bagNote([LANTERN])] }, [mine[0]!]: { kept: [bagNote([LANTERN])], writeClosed: true } }));
    const bag = bagOn(n, { hand: true });
    expect((await bag.add(BOOK, "Old book")).ok).toBe(true);
    expect(n.sent.filter((s) => s.url === mine[0]).length).toBe(1);
    n.sent.length = 0;
    n.asked.length = 0;
    expect((await bag.remove(BOOK, "Old book")).ok).toBe(true);
    // Asked when looking, as before; not sent to again.
    expect(n.asked.some((a) => a.url === mine[0] && a.kinds.includes(BAG_KIND))).toBe(true);
    expect(n.sent.some((s) => s.url === mine[0])).toBe(false);
  });
});

describe("someone else's note", () => {
  it("gets the first look and no more: no waves, nothing put back", async () => {
    const theirs = own(23);
    const note = bagNote([LANTERN], T / 1000 - 100, OTHER);
    const n = net(all([...USUAL, ...theirs], { [USUAL[0]!]: { kept: [listNote(theirs, OTHER)] }, [theirs[19]!]: { kept: [note] } }));
    const got = await askOwn({ kinds: [BAG_KIND], authors: [them] }, them, { usual: USUAL, query: n.query, publish: n.publish, now: clock });
    // Not found: it is on a relay of theirs past the first look, which is all someone else's note is given.
    expect(got.events).toEqual([]);
    // The list's four, three usual and six of theirs: no more.
    expect(new Set(n.asked.map((a) => a.url)).size).toBeLessThanOrEqual(USUAL.length + RELAY_PICK.most);
    expect(n.asked.some((a) => a.kinds.includes(BAG_KIND) && (a.ms === RELAY_PICK.waveMs || a.ms === RELAY_PICK.lateMs))).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(n.sent).toEqual([]);
  });
});
