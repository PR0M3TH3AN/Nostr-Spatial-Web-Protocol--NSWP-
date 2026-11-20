import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { BAG_KIND, bagIn, changeBag, finalizeEvent, getPublicKey, itemCoordinate, newestBag, signClass } from "../src/index.js";

const KEY = sha256(utf8ToBytes("nswp bag test key"));
const me = getPublicKey(KEY);
const maker = "a".repeat(64);
const LANTERN = `37303:${maker}:brass-lantern`;
const BOOK = `37303:${maker}:old-book`;
const HAT = `37303:${"b".repeat(64)}:paper-hat`;
const T = 1_800_000_000;
const bag = (items: string[], o: { at?: number; extra?: string[][] } = {}) => finalizeEvent({ kind: BAG_KIND, created_at: o.at ?? T, tags: [["d", "bag"], ...items.map((i) => ["a", i]), ...(o.extra ?? [])], content: "" }, KEY);

describe("a bag", () => {
  it("is the items it names, each once, and only things that are items", () => {
    expect(bagIn(bag([LANTERN, BOOK, LANTERN], { extra: [["a", `37300:${maker}:a-world`], ["a", "not an item"], ["t", "mine"]] }))).toEqual([LANTERN, BOOK]);
    expect(itemCoordinate(`37303:${maker}:Brass Lantern`)).toBe("");
    expect(itemCoordinate(`30004:${maker}:a-list`)).toBe("");
    expect(bagIn(null)).toEqual([]);
  });

  it("is read from the person's own newest", () => {
    const old = bag([LANTERN]);
    const newer = bag([BOOK], { at: T + 5 });
    const someoneElses = finalizeEvent({ kind: BAG_KIND, created_at: T + 99, tags: [["d", "bag"], ["a", HAT]], content: "" }, sha256(utf8ToBytes("another")));
    expect(newestBag([old, someoneElses, newer], me)?.id).toBe(newer.id);
    expect(newestBag([someoneElses], me)).toBeNull();
  });

  it("has one item put in or taken out, and keeps the rest as it was", () => {
    const had = bag([LANTERN, BOOK], { extra: [["t", "mine"]] });
    const more = changeBag(had, { add: HAT, now: T + 10 })!;
    expect(bagIn(more)).toEqual([LANTERN, BOOK, HAT]);
    expect(more.tags).toContainEqual(["t", "mine"]);
    expect(more.tags.filter((t) => t[0] === "d")).toEqual([["d", "bag"]]);
    const less = changeBag(had, { remove: LANTERN, now: T + 10 })!;
    expect(bagIn(less)).toEqual([BOOK]);
    expect(changeBag(bag([LANTERN], { at: T + 500 }), { add: BOOK, now: T })!.created_at).toBe(T + 501);
  });

  it("signs nothing when there is nothing to change, or no bag to change", () => {
    const had = bag([LANTERN]);
    expect(changeBag(had, { add: LANTERN, now: T })).toBeNull();
    expect(changeBag(had, { remove: BOOK, now: T })).toBeNull();
    expect(changeBag(had, { add: "a lantern", now: T })).toBeNull();
    expect(changeBag(had, { now: T })).toBeNull();
    expect(changeBag(null, { add: LANTERN, now: T })).toBeNull();
    expect(bagIn(changeBag(null, { add: LANTERN, now: T, fromNothing: true })!)).toEqual([LANTERN]);
  });

  it("drops the last signer's mark, and is never a world's to sign", () => {
    const marked = bag([LANTERN], { extra: [["bitlogin:site", "https://portal.example"]] });
    expect(changeBag(marked, { add: BOOK, now: T + 1 })!.tags.some((t) => t[0] === "bitlogin:site")).toBe(false);
    expect(signClass(BAG_KIND)).toBe("careful");
  });
});
