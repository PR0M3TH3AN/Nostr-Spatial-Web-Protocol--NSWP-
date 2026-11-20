import { describe, expect, it } from "vitest";
import { changeFollows, finalizeEvent, followsIn, FOLLOWS_KIND, getPublicKey, newestFollows, signClass } from "../src/index.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { TEST_KEY_1, TEST_KEY_2 } from "./helpers.js";

const TEST_KEY_3 = sha256(utf8ToBytes("nswp people test key 3"));

const me = getPublicKey(TEST_KEY_1);
const ann = getPublicKey(TEST_KEY_2);
const bo = getPublicKey(TEST_KEY_3);
const cy = "c".repeat(64);
const T = 1_800_000_000;
const list = (tags: string[][], o: { at?: number; content?: string } = {}) => finalizeEvent({ kind: FOLLOWS_KIND, created_at: o.at ?? T, tags, content: o.content ?? "" }, TEST_KEY_1);

describe("who someone follows", () => {
  it("is the people their list names, each once, in its order", () => {
    expect(followsIn(list([["p", ann], ["t", "worlds"], ["p", bo, "wss://relay.example", "Bo"], ["p", ann], ["p", "not a key"]]))).toEqual([ann, bo]);
    expect(followsIn(null)).toEqual([]);
  });

  it("is read from their newest list, and nobody else's", () => {
    const old = list([["p", ann]]);
    const newer = list([["p", bo]], { at: T + 5 });
    const someoneElses = finalizeEvent({ kind: FOLLOWS_KIND, created_at: T + 99, tags: [["p", cy]], content: "" }, TEST_KEY_2);
    expect(newestFollows([old, someoneElses, newer], me)?.id).toBe(newer.id);
    expect(newestFollows([someoneElses], me)).toBeNull();
  });
});

describe("following someone", () => {
  it("adds them and keeps everything else as it was", () => {
    const had = list([["p", ann, "wss://relay.example", "Ann"], ["t", "worlds"], ["a", "30000:" + ann + ":friends"]], { content: '{"wss://old.example":{"read":true,"write":true}}' });
    const next = changeFollows(had, { add: bo, relay: "wss://bo.example", now: T + 10 })!;
    expect(next.kind).toBe(FOLLOWS_KIND);
    expect(next.tags).toEqual([...had.tags, ["p", bo, "wss://bo.example"]]);
    expect(next.content).toBe(had.content);
    expect(next.created_at).toBe(T + 10);
  });

  it("is never older than the list it replaces", () => {
    const had = list([["p", ann]], { at: T + 500 });
    expect(changeFollows(had, { add: bo, now: T })!.created_at).toBe(T + 501);
  });

  it("signs nothing when there is nothing to change", () => {
    const had = list([["p", ann]]);
    expect(changeFollows(had, { add: ann, now: T })).toBeNull();
    expect(changeFollows(had, { add: ann.toUpperCase(), now: T })).toBeNull();
    expect(changeFollows(had, { remove: bo, now: T })).toBeNull();
    expect(changeFollows(had, { add: me, now: T })).toBeNull();
    expect(changeFollows(had, { add: "nobody", now: T })).toBeNull();
    expect(changeFollows(had, { now: T })).toBeNull();
    expect(changeFollows(had, { add: bo, remove: ann, now: T })).toBeNull();
  });

  it("is refused with no list to change, unless they truly follow nobody", () => {
    expect(changeFollows(null, { add: ann, now: T })).toBeNull();
    expect(changeFollows(null, { add: ann, now: T, fromNothing: true })).toEqual({ kind: FOLLOWS_KIND, created_at: T, tags: [["p", ann]], content: "" });
    expect(changeFollows({ ...list([]), kind: 1 }, { add: ann, now: T, fromNothing: true })).toBeNull();
  });
});

describe("unfollowing someone", () => {
  it("takes out every line that names them, and nobody else", () => {
    const had = list([["p", ann], ["p", bo, "", "Bo"], ["t", "worlds"], ["p", ann, "wss://relay.example"], ["p", cy]]);
    expect(changeFollows(had, { remove: ann, now: T + 1 })!.tags).toEqual([["p", bo, "", "Bo"], ["t", "worlds"], ["p", cy]]);
  });
});

describe("a world", () => {
  it("never has a follow list signed for it", () => {
    expect(signClass(FOLLOWS_KIND)).toBe("careful");
  });
});
