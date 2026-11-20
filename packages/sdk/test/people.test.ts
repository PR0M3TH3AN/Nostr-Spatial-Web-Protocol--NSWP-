import { changeFollows, finalizeEvent, followForWorld, FOLLOWS_KIND, followsIn, getPublicKey, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createPeople, type FollowHand } from "../src/people.js";
import { forgetRelays } from "../src/relay-book.js";

const KEY = sha256(utf8ToBytes("nswp test vector key 1"));
const me = getPublicKey(KEY);
const ann = "a".repeat(64);
const bo = "b".repeat(64);
const cy = "c".repeat(64);
const T = 1_800_000_000_000;

/** Relays that keep what they are sent and answer by kind and author. */
const relays = () => {
  const net = {
    kept: [] as NostrEvent[],
    down: false,
    /** Answers when asked, and takes nothing sent. */
    full: false,
    query: async (asked: string[], filter: Filter) => ({
      events: net.down ? [] : net.kept.filter((e) => (!filter.kinds || filter.kinds.includes(e.kind)) && (!filter.authors || filter.authors.includes(e.pubkey))),
      relays: Object.fromEntries(asked.map((r) => [r, net.down ? "timeout" : "eose"])),
    }),
    publish: async (to: string[], event: NostrEvent) => {
      const took = !net.down && !net.full;
      if (took) net.kept.push(event);
      return { relays: Object.fromEntries(to.map((r) => [r, took ? "ok" : "timeout"])) };
    },
  };
  return net;
};
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
/** A hand as a visitor's signer is for a world they have let follow for them. */
const hand = (clock: () => number) => {
  const h = {
    who: me as string | null,
    allowed: true,
    refuse: false,
    signed: 0,
    pubkey: () => h.who,
    ready: () => h.allowed,
    change: async (list: NostrEvent | null, change: { add: string } | { remove: string }) => {
      if (h.refuse) return null;
      const made = followForWorld({ list, ...change, pubkey: me, now: clock() / 1000 });
      h.signed++;
      return made ? finalizeEvent(made, KEY) : null;
    },
  };
  return h as typeof h & FollowHand;
};
const list = (tags: string[][], at = T / 1000 - 100) => finalizeEvent({ kind: FOLLOWS_KIND, created_at: at, tags, content: "kept" }, KEY);
const set = (o: { had?: NostrEvent | null } = {}) => {
  let t = T;
  const clock = () => (t += 1000);
  const net = relays();
  if (o.had) net.kept.push(o.had);
  const h = hand(clock);
  const storage = memory();
  const people = createPeople({ hand: h, relays: ["wss://one.example", "wss://two.example"], storage, now: clock, query: net.query, publish: net.publish });
  return { people, net, h, storage, clock };
};

beforeEach(() => forgetRelays());

describe("who a visitor follows", () => {
  it("is read from their own newest list", async () => {
    const { people } = set({ had: list([["p", ann], ["p", bo]]) });
    expect(people.follows()).toBeNull();
    expect(people.isFollowing(ann)).toBeNull();
    expect(await people.load()).toEqual([ann, bo]);
    expect(people.isFollowing(ann)).toBe(true);
    expect(people.isFollowing(cy)).toBe(false);
  });

  it("is nobody's for a guest", async () => {
    const { people, h } = set({ had: list([["p", ann]]) });
    h.who = null;
    expect(await people.load()).toBeNull();
    expect((await people.follow(ann)).why).toBe("signed-out");
  });
});

describe("following someone", () => {
  it("adds them to the newest list and keeps the rest", async () => {
    const had = list([["p", ann, "wss://relay.example", "Ann"], ["t", "worlds"]]);
    const { people, net } = set({ had });
    const done = await people.follow(bo, "Bo");
    expect(done).toEqual({ ok: true, said: "You follow Bo. Anyone can see who you follow." });
    const sent = net.kept.at(-1)!;
    expect(sent.tags).toEqual([...had.tags, ["p", bo]]);
    expect(sent.content).toBe("kept");
    expect(sent.created_at).toBeGreaterThan(had.created_at);
    expect(people.isFollowing(bo)).toBe(true);
  });

  it("starts from the newest list there is now, not the one it knew", async () => {
    const { people, net } = set({ had: list([["p", ann]]) });
    await people.load();
    // Another client of theirs follows someone meanwhile.
    net.kept.push(list([["p", ann], ["p", cy]], T / 1000 + 5));
    await people.follow(bo);
    expect(followsIn(net.kept.at(-1)!)).toEqual([ann, cy, bo]);
  });

  it("changes nothing when no relay could be reached", async () => {
    const { people, net, h } = set({ had: list([["p", ann]]) });
    net.down = true;
    const done = await people.follow(bo);
    expect(done.ok).toBe(false);
    expect(done.why).toBe("unreachable");
    expect(h.signed).toBe(0);
  });

  it("writes a first list only on a second press", async () => {
    const { people, net, h } = set();
    const first = await people.follow(ann, "Ann");
    expect(first.why).toBe("no-list");
    expect(h.signed).toBe(0);
    // Pressing for someone else is not the second press.
    expect((await people.follow(bo)).why).toBe("no-list");
    expect((await people.follow(bo)).ok).toBe(true);
    expect(followsIn(net.kept.at(-1)!)).toEqual([bo]);
  });

  it("signs nothing for someone already followed, or for oneself", async () => {
    const { people, h } = set({ had: list([["p", ann]]) });
    expect((await people.follow(ann)).why).toBe("already");
    expect((await people.follow(me)).why).toBe("refused");
    expect(h.signed).toBe(0);
  });

  it("is refused where the visitor hasn't let this place", async () => {
    const { people, h, net } = set({ had: list([["p", ann]]) });
    h.allowed = false;
    expect((await people.follow(bo)).why).toBe("not-allowed");
    expect(net.kept.length).toBe(1);
  });

  it("is not taken from a hand that gives back something else", async () => {
    const had = list([["p", ann]]);
    const { people, h, net } = set({ had });
    // A signer that drops everyone else, or slips someone in.
    h.change = async () => finalizeEvent({ kind: FOLLOWS_KIND, created_at: T / 1000 + 50, tags: [["p", bo]], content: "kept" }, KEY);
    expect((await people.follow(bo)).why).toBe("refused");
    h.change = async (l) => finalizeEvent({ ...changeFollows(l, { add: bo, now: T / 1000 + 50 })!, tags: [...l!.tags, ["p", bo], ["p", cy]] }, KEY);
    expect((await people.follow(bo)).why).toBe("refused");
    expect(net.kept).toEqual([had]);
    expect(people.isFollowing(bo)).toBe(false);
  });

  it("keeps what was signed when no relay took it, and sends it again", async () => {
    const { people, net, storage } = set({ had: list([["p", ann]]) });
    net.full = true;
    const done = await people.follow(bo);
    expect(done.why).toBe("not-sent");
    expect(people.isFollowing(bo)).toBe(true);
    expect([...storage.m.keys()]).toEqual([`nswp:follows:${me}`]);
    // The next time it is looked for, the device has the newer one: it goes out.
    net.full = false;
    expect(await people.load(true)).toEqual([ann, bo]);
    await new Promise((r) => setTimeout(r, 0));
    expect(followsIn(net.kept.at(-1)!)).toEqual([ann, bo]);
  });
});

describe("unfollowing someone", () => {
  it("takes them out and nobody else", async () => {
    const { people, net } = set({ had: list([["p", ann], ["p", bo], ["p", cy]]) });
    expect((await people.unfollow(bo, "Bo")).said).toBe("You no longer follow Bo.");
    expect(followsIn(net.kept.at(-1)!)).toEqual([ann, cy]);
    expect((await people.unfollow(bo, "Bo")).why).toBe("already");
  });
});
