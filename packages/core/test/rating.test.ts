import { describe, expect, it } from "vitest";
import { buildRating, cleanStars, finalizeEvent, getPublicKey, parseRating, RATING_KIND, signClass, tallyRatings, tallyWords } from "../src/index.js";
import { TEST_KEY_1, TEST_KEY_2 } from "./helpers.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

const key = (n: number) => sha256(utf8ToBytes(`nswp rating test key ${n}`));
const PUBLISHER = getPublicKey(TEST_KEY_2);
const ARCADE = `37300:${PUBLISHER}:arcade`;
const OTHER = `37300:${PUBLISHER}:grove`;
const me = getPublicKey(TEST_KEY_1);
const rate = (by: Uint8Array, stars: number, o: { world?: string; now?: number; words?: string; extra?: string[][] } = {}) => {
  const made = buildRating({ world: o.world ?? ARCADE, stars, words: o.words, now: o.now ?? 1_800_000_000 })!;
  return finalizeEvent({ ...made, tags: [...made.tags, ...(o.extra ?? [])] }, by);
};
const friends = [1, 2, 3].map(key);
const counted = friends.map(getPublicKey);

describe("a rating", () => {
  it("is one person's stars for one world, with a few words", () => {
    const e = rate(TEST_KEY_1, 4, { words: "  Caught all twelve.\n Good fun.  " });
    expect(e.kind).toBe(RATING_KIND);
    expect(parseRating(e)).toEqual({ by: me, world: ARCADE, stars: 4, words: "Caught all twelve. Good fun.", at: 1_800_000_000, askedAt: [] });
    expect(e.tags.find((t) => t[0] === "d")?.[1]).toBe(ARCADE);
    expect(e.tags.find((t) => t[0] === "a")?.[1]).toBe(ARCADE);
  });

  it("is whole stars from one to five, of a world, or it is nothing", () => {
    for (const bad of [0, 6, 2.5, -1, Number.NaN]) expect(buildRating({ world: ARCADE, stars: bad, now: 1 })).toBeNull();
    expect(buildRating({ world: "30004:" + PUBLISHER + ":a-list", stars: 5, now: 1 })).toBeNull();
    expect(buildRating({ world: "not a world", stars: 5, now: 1 })).toBeNull();
    expect(cleanStars("3")).toBe(3);
    expect(cleanStars("3.5")).toBe(0);
    expect(cleanStars("five")).toBe(0);
    const e = rate(TEST_KEY_1, 5);
    expect(parseRating({ ...e, tags: e.tags.map((t) => (t[0] === "rating" ? ["rating", "11"] : t)) })).toBeNull();
    // Kept at one world's address and about another: nobody's.
    expect(parseRating({ ...e, tags: e.tags.map((t) => (t[0] === "a" ? ["a", OTHER] : t)) })).toBeNull();
    expect(parseRating({ ...e, kind: 1 })).toBeNull();
    expect(parseRating(null)).toBeNull();
    expect(buildRating({ world: ARCADE, stars: 5, words: "x".repeat(900), now: 1 })!.content).toHaveLength(280);
  });

  it("is not something a world can have signed from inside", () => {
    expect(signClass(RATING_KIND)).not.toBe("ordinary");
  });
});

describe("the tally", () => {
  it("counts the people a client was told to count, and the visitor, and nobody else", () => {
    const events = [rate(friends[0]!, 5), rate(friends[1]!, 4), rate(key(99), 1), rate(TEST_KEY_1, 3)];
    const t = tallyRatings(events, { world: ARCADE, counted, me });
    expect(t.count).toBe(3);
    expect(t.average).toBe(4);
    expect(t.mine).toBe(3);
    expect(tallyWords(t)).toBe("4.0 of 5, from 3");
    // Signed out: the same people, without the visitor.
    expect(tallyRatings(events, { world: ARCADE, counted })).toMatchObject({ count: 2, average: 4.5, mine: 0 });
    // A crowd of keys nobody knows changes nothing.
    const crowd = Array.from({ length: 30 }, (_, i) => rate(key(1000 + i), 1));
    expect(tallyRatings([...events, ...crowd], { world: ARCADE, counted, me }).average).toBe(4);
  });

  it("takes each person's newest, and only a real signature", () => {
    const first = rate(friends[0]!, 1, { now: 100 });
    const changed = rate(friends[0]!, 5, { now: 200 });
    expect(tallyRatings([changed, first], { world: ARCADE, counted }).average).toBe(5);
    expect(tallyRatings([first, changed], { world: ARCADE, counted }).average).toBe(5);
    const forged = { ...rate(friends[1]!, 5), pubkey: getPublicKey(friends[2]!) };
    expect(tallyRatings([forged], { world: ARCADE, counted }).count).toBe(0);
    // A forgery with a later time doesn't push out the real one.
    const later = { ...changed, created_at: 300, tags: changed.tags.map((t) => (t[0] === "rating" ? ["rating", "1"] : t)) };
    expect(tallyRatings([changed, later], { world: ARCADE, counted }).average).toBe(5);
  });

  it("keeps worlds apart", () => {
    const events = [rate(friends[0]!, 5), rate(friends[1]!, 2, { world: OTHER })];
    expect(tallyRatings(events, { world: ARCADE, counted })).toMatchObject({ count: 1, average: 5 });
    expect(tallyRatings(events, { world: OTHER, counted })).toMatchObject({ count: 1, average: 2 });
    expect(tallyRatings([], { world: ARCADE, counted })).toEqual({ count: 0, average: 0, mine: 0, ratings: [] });
    expect(tallyWords({ count: 0, average: 0 })).toBe("");
  });

  it("doesn't count a rating the world asked for itself, or its own maker's", () => {
    const url = "https://arcade.example/play/";
    const inside = rate(friends[0]!, 5, { extra: [["bitlogin:site", "https://arcade.example"]] });
    const alsoInside = rate(friends[1]!, 5, { extra: [["nswp:world", "https://arcade.example"]] });
    const atHome = rate(friends[2]!, 3, { extra: [["bitlogin:site", "https://portal.example"]] });
    expect(parseRating(inside)?.askedAt).toEqual(["https://arcade.example"]);
    expect(tallyRatings([inside, alsoInside, atHome], { world: ARCADE, counted, worldUrl: url })).toMatchObject({ count: 1, average: 3 });
    // Its own publisher, counted by someone: still not for its own world.
    const own = rate(TEST_KEY_2, 5);
    expect(tallyRatings([own, atHome], { world: ARCADE, counted: [...counted, PUBLISHER], worldUrl: url })).toMatchObject({ count: 1, average: 3 });
  });

  it("rounds to one place", () => {
    const events = [rate(friends[0]!, 5), rate(friends[1]!, 4), rate(friends[2]!, 4)];
    expect(tallyRatings(events, { world: ARCADE, counted }).average).toBe(4.3);
  });
});
