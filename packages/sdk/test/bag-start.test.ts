import { BAG_KIND, bagIn, finalizeEvent, getPublicKey, RELAY_LIST_KIND, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createBag, type BagHand } from "../src/bag.js";
import { forgetRelays } from "../src/relay-book.js";

/**
 * A first bag started with a client's starter things, in one note (`bag.start`): for BitPortal's guests, whose bags
 * BitLogin signs with no press, at three signatures a minute. The rule from the empty-Bag fault: it is written only
 * where there is surely none (enough relays answered, none had one, and the device keeps none), never over a bag
 * found anywhere, and never where the relays didn't answer. The relays are stand-ins, one by one.
 */
const KEY = sha256(utf8ToBytes("nswp sdk bag start test key"));
const MAKER = sha256(utf8ToBytes("nswp sdk bag start test maker"));
const me = getPublicKey(KEY);
const maker = getPublicKey(MAKER);
const STARTER = ["brass-lantern", "old-book", "dart-blaster", "lute", "map", "kite"].map((d) => `37303:${maker}:${d}`);
/** Their own relays, as their relay list says (NIP-65), and the place's usual ones. */
const OWN = ["wss://one.example", "wss://two.example", "wss://three.example", "wss://four.example", "wss://five.example", "wss://six.example"];
const USUAL = ["wss://usual-a.example", "wss://usual-b.example", "wss://usual-c.example"];
let T = 1_800_000_000_000;
const clock = () => (T += 1000);

/** Relays that each keep what they keep: `holding` has the visitor's old bag, `silent` never answers. */
const relays = (o: { holding?: string[]; silent?: string[] | "all" } = {}) => {
  const old = finalizeEvent({ kind: BAG_KIND, created_at: T / 1000 - 1000, tags: [["d", "bag"], ["a", STARTER[0]!]], content: "" }, KEY);
  const list = finalizeEvent({ kind: RELAY_LIST_KIND, created_at: T / 1000 - 5000, tags: OWN.map((r) => ["r", r]), content: "" }, KEY);
  const silent = (r: string) => o.silent === "all" || (o.silent ?? []).includes(r);
  const net = {
    sent: [] as NostrEvent[],
    query: async (asked: string[], filter: Filter) => ({
      events: [
        // Their relay list is on the usual relays; their bag only where `holding` says.
        ...asked.filter((r) => !silent(r) && USUAL.includes(r) && filter.kinds?.includes(RELAY_LIST_KIND)).map(() => list),
        ...asked.filter((r) => !silent(r) && (o.holding ?? []).includes(r) && filter.kinds?.includes(BAG_KIND)).map(() => old),
      ],
      relays: Object.fromEntries(asked.map((r) => [r, silent(r) ? "timeout" : "eose"])),
    }),
    publish: async (to: string[], event: NostrEvent) => {
      net.sent.push(event);
      return { relays: Object.fromEntries(to.map((r) => [r, silent(r) ? "timeout" : "ok"])) };
    },
  };
  return net;
};
const memory = (kept?: NostrEvent) => {
  const m = new Map<string, string>(kept ? [[`nswp:bag:${me}`, JSON.stringify(kept)]] : []);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const hand = () => {
  const h = { signed: 0, ready: () => true, sign: async (bag: Parameters<BagHand["sign"]>[0]) => (h.signed++, finalizeEvent(bag, KEY)) };
  return h;
};
const set = (net: ReturnType<typeof relays>, storage = memory()) => {
  const h = hand();
  const bag = createBag({ me: () => me, hand: h, relays: USUAL, storage, now: clock, query: net.query, publish: net.publish });
  return { bag, h };
};

beforeEach(() => forgetRelays());

describe("starting a visitor's first bag", () => {
  it("writes all the starter things in one note, where there is surely none", async () => {
    const net = relays();
    const { bag, h } = set(net);
    const done = await bag.start(STARTER);
    expect(done).toEqual({ ok: true, said: "Your bag is started, with 6 things in it. Anyone can see what is in it." });
    expect(h.signed).toBe(1);
    const written = net.sent.filter((e) => e.kind === BAG_KIND);
    expect(new Set(written.map((e) => e.id)).size).toBe(1);
    expect(bagIn(written[0]!)).toEqual(STARTER);
    expect(bag.items()).toEqual(STARTER);
    // Asked again: it has one now, and nothing more is written.
    expect((await bag.start(STARTER)).why).toBe("already");
    expect(h.signed).toBe(1);
  });

  it("writes nothing where a bag is found on one of their relays of many", async () => {
    const net = relays({ holding: ["wss://five.example"] });
    const { bag, h } = set(net);
    const done = await bag.start(STARTER);
    expect(done.why).toBe("already");
    expect(h.signed).toBe(0);
    expect(net.sent.filter((e) => e.kind === BAG_KIND && e.created_at > T / 1000 - 500)).toEqual([]);
    expect(bag.items()).toEqual([STARTER[0]]);
  });

  it("writes nothing where the relays didn't answer", async () => {
    const net = relays({ silent: "all" });
    const { bag, h } = set(net);
    const done = await bag.start(STARTER);
    expect(done.why).toBe("unreachable");
    expect(h.signed).toBe(0);
    expect(net.sent).toEqual([]);
  });

  it("writes nothing on a partial answer: the usual relays answered, their own didn't", async () => {
    const net = relays({ silent: OWN });
    const { bag, h } = set(net);
    expect((await bag.start(STARTER)).why).toBe("unreachable");
    expect(h.signed).toBe(0);
    expect(net.sent.filter((e) => e.kind === BAG_KIND)).toEqual([]);
  });

  it("writes nothing where this device keeps a bag of theirs, whatever the relays say", async () => {
    const kept = finalizeEvent({ kind: BAG_KIND, created_at: T / 1000 - 10, tags: [["d", "bag"], ["a", STARTER[1]!]], content: "" }, KEY);
    const net = relays();
    const { bag, h } = set(net, memory(kept));
    expect((await bag.start(STARTER)).why).toBe("already");
    expect(h.signed).toBe(0);
  });

  it("is one start when asked twice at once: the second finds the bag the first made", async () => {
    const net = relays();
    const { bag, h } = set(net);
    const [a, b] = await Promise.all([bag.start(STARTER), bag.start(STARTER)]);
    expect([a.ok, b.why]).toEqual([true, "already"]);
    expect(h.signed).toBe(1);
  });
});
