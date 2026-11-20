import { finalizeEvent, getPublicKey, scoreForWorld, SCORE_KIND, type Board, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { forgetRelays } from "../src/relay-book.js";
import { createScores } from "../src/scores.js";

const key = (n: number) => sha256(utf8ToBytes(`nswp scores test key ${n}`));
const pk = (n: number) => getPublicKey(key(n));
const WORLD = `37300:${pk(90)}:arcade`;
const ORIGIN = "https://arcade.example";
const BOARDS: Board[] = [{ id: "lantern-run", title: "Lantern Run", order: "low", format: "time" }];
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
/** Scores as one visitor's device keeps them, with a signer that signs for this world as `who` (0 for a guest). */
const visitor = (net: ReturnType<typeof relays>, who: number, o: { storage?: ReturnType<typeof memory>; counted?: string[] } = {}) => {
  const v = { who, signed: 0 };
  const scores = createScores({
    world: WORLD,
    worldUrl: `${ORIGIN}/`,
    boards: BOARDS,
    hand: {
      pubkey: () => (v.who ? pk(v.who) : null),
      sign: async (world, board, score, said) => {
        v.signed++;
        return finalizeEvent(scoreForWorld({ world, board, score, ...said, origin: ORIGIN, now: T / 1000 })!, key(v.who));
      },
    },
    counted: () => o.counted ?? [],
    relays: ["wss://one.example"],
    storage: o.storage ?? memory(),
    now: clock,
    query: net.query,
    publish: net.publish,
  });
  return Object.assign(v, { scores });
};

beforeEach(() => forgetRelays());

describe("a visitor's best", () => {
  it("is kept on the device, and is the better of what they make", () => {
    const v = visitor(relays(), 1);
    expect(v.scores.best("lantern-run")).toBeNull();
    expect(v.scores.record("lantern-run", 50_000)).toBe(true);
    expect(v.scores.record("lantern-run", 61_000)).toBe(false);
    expect(v.scores.record("lantern-run", 42_500)).toBe(true);
    expect(v.scores.best("lantern-run")).toBe(42_500);
    expect(v.scores.words("lantern-run", 42_500)).toBe("42.5 s");
    expect(v.scores.record("no-such-board", 1)).toBe(false);
    expect(v.scores.record("lantern-run", -1)).toBe(false);
  });

  it("sends nothing until they post it", async () => {
    const net = relays();
    const v = visitor(net, 1);
    v.scores.record("lantern-run", 42_500);
    expect(net.kept).toEqual([]);
    expect(v.signed).toBe(0);
    expect(await v.scores.post("lantern-run")).toEqual({ ok: true, said: "42.5 s is on the board, as yours. Anyone can see it." });
    expect(net.kept.map((e) => e.kind)).toEqual([SCORE_KIND]);
    expect(v.scores.posted("lantern-run")).toBe(42_500);
    // Posting again what is already there signs nothing.
    expect((await v.scores.post("lantern-run")).said).toContain("already on the board");
    expect(v.signed).toBe(1);
  });

  it("can't be posted by a guest, and what a guest made is theirs once they sign in", async () => {
    const net = relays();
    const storage = memory();
    const v = visitor(net, 0, { storage });
    v.scores.record("lantern-run", 39_000);
    expect((await v.scores.post("lantern-run")).ok).toBe(false);
    v.who = 1;
    expect(v.scores.best("lantern-run")).toBe(39_000);
    expect((await v.scores.post("lantern-run")).ok).toBe(true);
    expect(net.kept.length).toBe(1);
  });

  it("stays on the device when it can't be signed or sent", async () => {
    const net = relays();
    const v = visitor(net, 1);
    v.scores.record("lantern-run", 42_500);
    net.down = true;
    const done = await v.scores.post("lantern-run");
    expect(done.ok).toBe(false);
    expect(v.scores.posted("lantern-run")).toBeNull();
    expect(v.scores.best("lantern-run")).toBe(42_500);
  });
});

describe("the board a world shows", () => {
  it("lists who the visitor follows first, then everyone else, each by their place", async () => {
    const net = relays();
    for (const [who, score] of [[2, 39_500], [3, 41_000], [4, 60_000]] as const) {
      const other = visitor(net, who);
      other.scores.record("lantern-run", score);
      await other.scores.post("lantern-run");
    }
    const me = visitor(net, 1, { counted: [pk(4)] });
    me.scores.record("lantern-run", 50_000);
    await me.scores.post("lantern-run");
    const board = (await me.scores.standings("lantern-run", true))!;
    expect(board.known.map((s) => [s.by, s.rank])).toEqual([[pk(1), 3], [pk(4), 4]]);
    expect(board.others.map((s) => s.by)).toEqual([pk(2), pk(3)]);
    expect(board.mine?.rank).toBe(3);
    // Where anyone stands, for saying so on their card: from what was read, with nothing more asked.
    expect(me.scores.standingOf("lantern-run", pk(2))).toEqual({ score: 39_500, rank: 1, of: 4 });
    expect(me.scores.standingOf("lantern-run", pk(77))).toBeNull();
    expect(net.kept.every((e) => e.tags.some((t) => t[0] === "board" && t[2] === "Lantern Run"))).toBe(true);
  });

  it("is nothing where no relay answered, and has no boards a world didn't name", async () => {
    const net = relays();
    net.down = true;
    const v = visitor(net, 1);
    expect(await v.scores.standings("lantern-run")).toBeNull();
    expect(await v.scores.standings("another")).toBeNull();
  });
});
