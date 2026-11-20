import { buildRating, finalizeEvent, getPublicKey, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createDoorRatings } from "../src/door-ratings.js";
import { forgetRelays } from "../src/relay-book.js";

const key = (n: number) => sha256(utf8ToBytes(`nswp door ratings test key ${n}`));
const pk = (n: number) => getPublicKey(key(n));
const ARCADE = { world: `37300:${pk(90)}:arcade`, url: "https://arcade.example/" };
const GROVE = { world: `37300:${pk(90)}:grove`, url: "https://grove.example/" };
const T = 1_800_000_000;
const rate = (by: number, door: { world: string }, stars: number, extra: string[][] = []): NostrEvent => {
  const made = buildRating({ world: door.world, stars, now: T })!;
  return finalizeEvent({ ...made, tags: [...made.tags, ...extra] }, key(by));
};
const set = (kept: NostrEvent[], o: { me?: number | null; counted?: string[] | null } = {}) => {
  const v = { me: o.me === undefined ? 1 : o.me, counted: o.counted === undefined ? [] : o.counted, asked: [] as Filter[] };
  const ratings = createDoorRatings({
    doors: [ARCADE, GROVE],
    me: () => (v.me ? pk(v.me) : null),
    counted: () => v.counted,
    relays: ["wss://one.example"],
    now: () => T * 1000,
    query: async (relays, filter) => {
      v.asked.push(filter);
      return { events: kept.filter((e) => filter["#a"]?.includes(e.tags.find((t) => t[0] === "a")?.[1] ?? "")), relays: Object.fromEntries(relays.map((r) => [r, "eose"])) };
    },
  });
  return Object.assign(v, { ratings });
};

beforeEach(() => forgetRelays());

describe("what people thought of where a door leads", () => {
  it("counts the people the visitor follows, where this world was let see who they are, and the visitor", async () => {
    const v = set([rate(2, ARCADE, 5), rate(3, ARCADE, 4), rate(4, ARCADE, 1), rate(1, ARCADE, 3)], { counted: [pk(2), pk(3)] });
    await v.ratings.load();
    expect(v.ratings.mark(ARCADE.world)).toBe("★ 4.0 from 3");
    expect(v.ratings.words(ARCADE.world)).toBe("Rated 4.0 of 5, by you and 2 people you follow");
    expect(v.ratings.mark(GROVE.world)).toBe("");
  });

  it("counts only the visitor's own where this world wasn't let see who they follow", async () => {
    const v = set([rate(2, ARCADE, 5), rate(1, ARCADE, 3)], { counted: null });
    await v.ratings.load();
    expect(v.ratings.mark(ARCADE.world)).toBe("★ 3.0 from 1");
    expect(v.ratings.words(ARCADE.world)).toBe("You gave it 3 of 5");
  });

  it("says nothing where nobody they know has rated it: never a count of strangers", async () => {
    const v = set([rate(4, ARCADE, 1), rate(5, ARCADE, 5)], { counted: [pk(2)] });
    await v.ratings.load();
    expect(v.ratings.mark(ARCADE.world)).toBe("");
    expect(v.ratings.words(ARCADE.world)).toBe("");
  });

  it("asks relays by world, never by person, and asks nothing for a guest", async () => {
    const v = set([rate(2, ARCADE, 5)], { counted: [pk(2)] });
    await v.ratings.load();
    expect(v.asked).toHaveLength(1);
    expect(v.asked[0]!.authors).toBeUndefined();
    expect(v.asked[0]!["#a"]).toEqual([ARCADE.world, GROVE.world]);
    const guest = set([rate(2, ARCADE, 5)], { me: null, counted: [pk(2)] });
    await guest.ratings.load();
    expect(guest.asked).toEqual([]);
    expect(guest.ratings.mark(ARCADE.world)).toBe("");
  });

  it("leaves out a rating the rated world asked for itself, and its own maker's", async () => {
    const fromInside = rate(2, ARCADE, 5, [["nswp:world", "https://arcade.example"]]);
    const itsMaker = rate(90, ARCADE, 5);
    const v = set([fromInside, itsMaker, rate(3, ARCADE, 2)], { counted: [pk(2), pk(3), pk(90)] });
    await v.ratings.load();
    expect(v.ratings.mark(ARCADE.world)).toBe("★ 2.0 from 1");
  });

  it("follows who is counted as that changes, without asking again, and forgets when they sign out", async () => {
    const v = set([rate(2, ARCADE, 5), rate(1, ARCADE, 3)], { counted: null });
    let told = 0;
    v.ratings.onChange(() => told++);
    await v.ratings.load();
    expect(v.ratings.mark(ARCADE.world)).toBe("★ 3.0 from 1");
    v.counted = [pk(2)];
    expect(v.ratings.mark(ARCADE.world)).toBe("★ 4.0 from 2");
    await v.ratings.load();
    expect(v.asked).toHaveLength(1);
    v.me = null;
    await v.ratings.load();
    expect(v.ratings.mark(ARCADE.world)).toBe("");
    expect(told).toBe(2);
  });
});
