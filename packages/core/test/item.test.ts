import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { buildItem, buildWorldEvent, cleanItemsRule, finalizeEvent, getPublicKey, ITEM_KIND, ITEM_LIMITS, itemsWords, parseItem, parseWorldEvent, signClass, type ItemInput } from "../src/index.js";

const KEY = sha256(utf8ToBytes("nswp item test key"));
const maker = getPublicKey(KEY);
const HASH = "a".repeat(64);
const T = 1_800_000_000;
const lantern: ItemInput = {
  d: "brass-lantern",
  title: "Brass lantern",
  summary: "A lantern that swings as you walk.",
  model: { url: `https://items.example/${HASH}.glb`, sha256: HASH },
  thumb: { url: `https://items.example/${"b".repeat(64)}.webp`, sha256: "b".repeat(64) },
  size: [0.18, 0.42, 0.18],
  colliders: [{ shape: "box", centre: [0, 0.21, 0], size: [0.18, 0.42, 0.18] }],
  clips: { idle: "Swing", use: "Flare" },
  behaviors: ["holdable"],
  fits: ["hand-right", "place", "hand-left"],
  script: { url: `https://items.example/${"c".repeat(64)}.js`, sha256: "c".repeat(64) },
  license: "CC-BY-4.0",
};
const signed = (o: ItemInput) => finalizeEvent(buildItem({ ...o, now: T })!, KEY);

describe("an item's description", () => {
  it("says what the thing is, and names every file with its hash", () => {
    const e = signed(lantern);
    expect(e.kind).toBe(ITEM_KIND);
    expect(parseItem(e)).toEqual({
      maker,
      id: `37303:${maker}:brass-lantern`,
      d: "brass-lantern",
      title: "Brass lantern",
      summary: "A lantern that swings as you walk.",
      model: lantern.model,
      thumb: lantern.thumb,
      size: [0.18, 0.42, 0.18],
      colliders: lantern.colliders,
      clips: { idle: "Swing", use: "Flare" },
      behaviors: ["holdable"],
      fits: ["place", "hand-left", "hand-right"],
      use: "anyone",
      script: lantern.script,
      license: "CC-BY-4.0",
      at: T,
    });
    expect(e.tags.find((t) => t[0] === "model")).toEqual(["model", lantern.model.url, "glb", HASH]);
  });

  it("is the least it can be: a name, a title, a model and a size", () => {
    const plain = parseItem(signed({ d: "chair", title: "Chair", model: lantern.model, size: [0.5, 0.9, 0.5] }))!;
    expect(plain).toMatchObject({ summary: "", thumb: null, colliders: [], clips: {}, behaviors: [], fits: [], use: "anyone", script: null });
    expect(parseItem(signed({ d: "ticket", title: "Ticket", model: lantern.model, size: [0.1, 0.1, 0.1], use: "granted" }))!.use).toBe("granted");
  });

  it("is not written with anything that couldn't be used", () => {
    const bad = (o: Partial<ItemInput>) => buildItem({ ...lantern, ...o, now: T });
    expect(bad({ d: "Brass Lantern" })).toBeNull();
    expect(bad({ title: "  " })).toBeNull();
    expect(bad({ model: { url: "http://items.example/a.glb", sha256: HASH } })).toBeNull();
    expect(bad({ model: { url: lantern.model.url, sha256: "not a hash" } })).toBeNull();
    expect(bad({ size: [0.2, 0, 0.2] })).toBeNull();
    expect(bad({ size: [0.2, ITEM_LIMITS.metres + 1, 0.2] })).toBeNull();
    expect(bad({ script: { url: "javascript:alert(1)", sha256: HASH } })).toBeNull();
    expect(bad({ colliders: [{ shape: "sphere", centre: [0, 0, 0], radius: -1 }] })).toBeNull();
    expect(bad({ clips: { idle: "<script>" } })).toBeNull();
  });

  it("is read without what a reader doesn't understand, and not at all without a usable model", () => {
    const e = signed(lantern);
    const withMore = { ...e, tags: [...e.tags, ["behavior", "explodes"], ["collider", "blob", "0 0 0", "1"], ["clip", "dance", "Jig"], ["fits", "tail"]] };
    expect(parseItem(withMore)).toMatchObject({ behaviors: ["holdable"], colliders: lantern.colliders, clips: { idle: "Swing", use: "Flare" } });
    const drop = (name: string) => ({ ...e, tags: e.tags.filter((t) => t[0] !== name) });
    expect(parseItem(drop("model"))).toBeNull();
    expect(parseItem(drop("size"))).toBeNull();
    expect(parseItem(drop("title"))).toBeNull();
    expect(parseItem({ ...e, tags: e.tags.map((t) => (t[0] === "model" ? ["model", t[1]!, "fbx", t[3]!] : t)) })).toBeNull();
    expect(parseItem({ ...e, kind: 1 })).toBeNull();
    // A script that isn't an https address with a hash is left out; the item is still an item.
    expect(parseItem({ ...e, tags: e.tags.map((t) => (t[0] === "script" ? ["script", "data:text/javascript,alert(1)", HASH] : t)) })!.script).toBeNull();
  });

  it("is its maker's to sign, and never a world's", () => {
    expect(signClass(ITEM_KIND)).toBe("careful");
  });
});

describe("what a world does with items", () => {
  const world = { d: "arena", title: "The Arena", url: "https://arena.example/", summary: "A place to play.", modes: ["inline-3d" as const], createdAt: T };

  it("is one of three things, and nothing where it doesn't say", () => {
    expect(cleanItemsRule("play")).toBe("play");
    expect(cleanItemsRule("allowed")).toBe("allowed");
    for (const other of ["none", "", "everything", undefined, 5]) expect(cleanItemsRule(other)).toBe("none");
  });

  it("is said in its announcement only where it is more than nothing", () => {
    const tags = (items?: "none" | "allowed" | "play") => buildWorldEvent({ ...world, ...(items ? { items } : {}) }).tags.filter((t) => t[0] === "items");
    expect(tags("play")).toEqual([["items", "play"]]);
    expect(tags("allowed")).toEqual([["items", "allowed"]]);
    expect(tags("none")).toEqual([]);
    expect(tags()).toEqual([]);
  });

  it("is read back, and an unknown rule is none, with a word of warning", () => {
    const read = (value: string) => parseWorldEvent(finalizeEvent({ ...buildWorldEvent(world), tags: [...buildWorldEvent(world).tags, ["items", value]] }, KEY), { requireSigned: true });
    const play = read("play");
    expect(play.ok && play.value.items).toBe("play");
    const odd = read("anything-goes");
    expect(odd.ok && odd.value.items).toBeUndefined();
    expect(odd.warnings.map((w) => w.code)).toContain("unknown_items_rule");
  });

  it("is told to a visitor before they go in, in the same words everywhere", () => {
    expect(itemsWords("play")).toBe("Items are part of play here");
    expect(itemsWords("allowed")).toBe("Items work here");
    expect(itemsWords("none")).toBeNull();
    expect(itemsWords(undefined)).toBeNull();
  });
});
