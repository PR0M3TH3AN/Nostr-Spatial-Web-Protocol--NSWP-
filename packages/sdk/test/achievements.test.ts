import { ACHIEVEMENT_KIND, achievementForWorld, finalizeEvent, getPublicKey, type Achievement, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createAchievements } from "../src/achievements.js";
import { forgetRelays } from "../src/relay-book.js";

const key = (n: number) => sha256(utf8ToBytes(`nswp achievements test key ${n}`));
const pk = (n: number) => getPublicKey(key(n));
const WORLD = `37300:${pk(90)}:arcade`;
const ORIGIN = "https://arcade.example";
const LIST: Achievement[] = [
  { id: "first-lantern", title: "First light", about: "Catch a lantern" },
  { id: "all-twelve", title: "All twelve" },
  { id: "under-thirty", title: "Lamplighter", hidden: true },
];
let T = 1_800_000_000_000;
const clock = () => (T += 1000);
const relays = () => {
  const net = {
    kept: [] as NostrEvent[],
    down: false,
    query: async (asked: string[], filter: Filter) => ({
      events: net.down ? [] : net.kept.filter((e) => (!filter.kinds || filter.kinds.includes(e.kind)) && (!filter.authors || filter.authors.includes(e.pubkey)) && (!filter["#a"] || e.tags.some((t) => t[0] === "a" && filter["#a"]!.includes(t[1]!)))),
      relays: Object.fromEntries(asked.map((r) => [r, net.down ? "timeout" : "eose"])),
    }),
    publish: async (to: string[], event: NostrEvent) => {
      if (!net.down) net.kept.push(event);
      return { relays: Object.fromEntries(to.map((r) => [r, net.down ? "timeout" : "ok"])) };
    },
  };
  return net;
};
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const visitor = (net: ReturnType<typeof relays>, who: number, o: { counted?: string[]; storage?: ReturnType<typeof memory> } = {}) => {
  const v = { who, signed: 0 };
  const achievements = createAchievements({
    world: WORLD,
    worldUrl: `${ORIGIN}/`,
    list: LIST,
    hand: {
      pubkey: () => (v.who ? pk(v.who) : null),
      sign: async (world, id, title) => {
        v.signed++;
        return finalizeEvent(achievementForWorld({ world, id, title, origin: ORIGIN, now: T / 1000 })!, key(v.who));
      },
    },
    counted: () => o.counted ?? [],
    relays: ["wss://one.example"],
    storage: o.storage ?? memory(),
    now: clock,
    query: net.query,
    publish: net.publish,
  });
  return Object.assign(v, { achievements });
};

beforeEach(() => forgetRelays());

describe("what a visitor earned", () => {
  it("is kept on the device, once each, and only if the world names it", () => {
    const v = visitor(relays(), 1);
    const heard: string[] = [];
    v.achievements.onEarn((a) => heard.push(a.title));
    expect(v.achievements.earn("first-lantern")).toBe(true);
    expect(v.achievements.earn("first-lantern")).toBe(false);
    expect(v.achievements.earn("made-up")).toBe(false);
    expect(v.achievements.earned()).toEqual(["first-lantern"]);
    expect(heard).toEqual(["First light"]);
  });

  it("is sent nowhere until they show it, and then each is signed as theirs", async () => {
    const net = relays();
    const v = visitor(net, 1);
    v.achievements.earn("first-lantern");
    v.achievements.earn("all-twelve");
    expect(net.kept).toEqual([]);
    expect(await v.achievements.show()).toEqual({ ok: true, said: "2 achievements are shown as yours. Anyone can see them." });
    expect(net.kept.map((e) => e.kind)).toEqual([ACHIEVEMENT_KIND, ACHIEVEMENT_KIND]);
    expect(v.achievements.shown()).toEqual(["first-lantern", "all-twelve"]);
    // Nothing more is signed for what is already shown.
    expect((await v.achievements.show()).said).toContain("already shown");
    expect(v.signed).toBe(2);
  });

  it("can't be shown by a guest, and what a guest earned is theirs once they sign in", async () => {
    const net = relays();
    const v = visitor(net, 0);
    v.achievements.earn("all-twelve");
    expect((await v.achievements.show()).ok).toBe(false);
    v.who = 1;
    expect(v.achievements.earned()).toEqual(["all-twelve"]);
    expect((await v.achievements.show()).ok).toBe(true);
    expect(net.kept.length).toBe(1);
  });

  it("stays on the device when it can't be sent", async () => {
    const net = relays();
    const v = visitor(net, 1);
    v.achievements.earn("all-twelve");
    net.down = true;
    expect((await v.achievements.show()).ok).toBe(false);
    expect(v.achievements.shown()).toEqual([]);
    expect(v.achievements.earned()).toEqual(["all-twelve"]);
  });
});

describe("who else holds one", () => {
  it("is counted, and the people the visitor knows are named", async () => {
    const net = relays();
    for (const who of [2, 3]) {
      const other = visitor(net, who);
      other.achievements.earn("all-twelve");
      await other.achievements.show();
    }
    const me = visitor(net, 1, { counted: [pk(3)] });
    const got = (await me.achievements.holders(true))!;
    expect(got.get("all-twelve")).toEqual({ id: "all-twelve", holders: 2, known: [pk(3)], mine: false });
    expect(got.get("first-lantern")).toBeUndefined();
  });

  it("is nothing where no relay answered", async () => {
    const net = relays();
    net.down = true;
    expect(await visitor(net, 1).achievements.holders()).toBeNull();
  });
});
