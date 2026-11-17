import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BUILTIN_ITEMS, buildLayoutEvent, checkPictureBytes, finalizeEvent, HOME_LAYOUT_KIND, LAYOUT_LIMITS, parseLayoutEvent, portalTarget, verifyEvent } from "../src/index.js";
import { T0, TEST_KEY_1, ZERO_AUX } from "./helpers.js";

const hash = "a".repeat(64);
const pub = "b".repeat(64);
const base = { d: "home", createdAt: T0 };
const withItems = (...items: string[][]) => parseLayoutEvent({ kind: HOME_LAYOUT_KIND, created_at: T0, tags: [["d", "home"], ...items], content: "" });

describe("home layouts (spec §4.5)", () => {
  it("round-trips a layout through build, sign and parse", () => {
    const event = finalizeEvent(
      buildLayoutEvent({
        ...base,
        title: "Ada's place",
        room: { template: "hall", color: "#101217", accent: "#3fc584" },
        items: [
          { type: "frame", position: [0, 1.6, -3], args: ["https://blossom.example/a.webp", hash] },
          { type: "portal", position: [2.5, 0, -2.5], rotation: -40, args: [`37300:${pub}:example-museum`] },
          { type: "plant", position: [-2, 0, -1] },
          { type: "note", position: [-3, 1.5, 0], rotation: 90, args: ["Welcome. Shoes off."] },
        ],
        access: "follows",
      }),
      TEST_KEY_1,
      ZERO_AUX,
    );
    expect(verifyEvent(event)).toBe(true);
    const r = parseLayoutEvent(event);
    expect(r.ok && r.warnings).toEqual([]);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ d: "home", title: "Ada's place", access: "follows", room: { template: "hall", accent: "#3fc584" }, pubkey: event.pubkey });
    expect(r.value.items.map((i) => i.type)).toEqual(["frame", "portal", "plant", "note"]);
    expect(r.value.items[1]).toMatchObject({ source: "builtin", position: [2.5, 0, -2.5], rotation: -40 });
  });

  it("has a room even when the event names none", () => {
    const r = withItems();
    expect(r.ok && r.value.room).toEqual({ template: "hall", color: "#101217", accent: "#3fc584" });
  });

  it("drops a bad placement and keeps the rest", () => {
    const r = withItems(
      ["item", "plant", "0 0 0", "0"],
      ["item", "plant", "0 0", "0"],
      ["item", "plant", "0 0 9999", "0"],
      ["item", "jacuzzi", "0 0 0", "0"],
      ["item", "frame", "0 1 0", "0", "http://insecure.example/a.webp", hash],
      ["item", "frame", "0 1 0", "0", "https://ok.example/a.webp", "nothex"],
      ["item", "portal", "0 0 0", "0", "javascript:alert(1)"],
      ["item", "portal", "0 0 0", "0", `1:${pub}:not-a-world`],
      ["item", "note", "0 1 0", "0"],
    );
    expect(r.ok && r.value.items).toHaveLength(1);
    expect(r.warnings.map((w) => w.code)).toEqual([
      "item_position_invalid",
      "item_position_invalid",
      "item_unknown",
      "item_args_invalid",
      "item_args_invalid",
      "item_args_invalid",
      "item_args_invalid",
      "item_args_invalid",
    ]);
  });

  it("keeps a published item as a reference, for renderers that draw them", () => {
    const r = withItems(["item", `37303:${pub}:brass-lantern`, "1 0.9 -2", "30", "c".repeat(64)], ["item", `37300:${pub}:a-world`, "0 0 0", "0"]);
    expect(r.ok && r.value.items).toEqual([{ source: "published", type: `37303:${pub}:brass-lantern`, position: [1, 0.9, -2], rotation: 30, args: ["c".repeat(64)] }]);
    expect(r.warnings.map((w) => w.code)).toEqual(["item_unknown"]);
  });

  it("holds at most 64 placements and 16 different published items", () => {
    const many = withItems(...Array.from({ length: 70 }, (_, i) => ["item", "plinth", `${i % 10} 0 0`, "0"]));
    expect(many.ok && many.value.items).toHaveLength(LAYOUT_LIMITS.placements);
    expect(many.warnings.map((w) => w.code)).toEqual(["too_many_items"]);
    const items = withItems(...Array.from({ length: 18 }, (_, i) => ["item", `37303:${pub}:thing-${i}`, "0 0 0", "0"]));
    expect(items.ok && items.value.items).toHaveLength(LAYOUT_LIMITS.publishedItems);
  });

  it("shortens an over-long note instead of dropping it", () => {
    const r = withItems(["item", "note", "0 1 0", "0", "x".repeat(400)]);
    expect(r.ok && r.value.items[0]!.args[0]).toHaveLength(LAYOUT_LIMITS.noteChars);
  });

  it("refuses something that isn't a layout", () => {
    expect(parseLayoutEvent({ kind: 1, tags: [["d", "home"]] }).ok).toBe(false);
    expect(parseLayoutEvent({ kind: HOME_LAYOUT_KIND, tags: [] }).ok).toBe(false);
    expect(parseLayoutEvent("nope").ok).toBe(false);
  });

  it("reads a portal's target as a world or an address, never anything else", () => {
    expect(portalTarget(`37300:${pub}:museum`)).toEqual({ coordinate: `37300:${pub}:museum`, pubkey: pub, d: "museum" });
    expect(portalTarget("https://museum.example/world")).toEqual({ url: "https://museum.example/world" });
    expect(portalTarget("http://museum.example/")).toBeNull();
    expect(portalTarget(`30004:${pub}:a-list`)).toBeNull();
    expect(portalTarget(undefined)).toBeNull();
  });

  it("checks a frame's picture against its hash and the size ceiling", () => {
    const bytes = new TextEncoder().encode("a picture");
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(checkPictureBytes(sha, bytes)).toBe(true);
    expect(checkPictureBytes(hash, bytes)).toBe(false);
    const big = new Uint8Array(LAYOUT_LIMITS.pictureBytes + 1);
    expect(checkPictureBytes(createHash("sha256").update(big).digest("hex"), big)).toBe(false);
  });

  it("ships a catalogue that includes the spec's example items", () => {
    for (const t of ["frame", "portal", "plant", "note"]) expect(BUILTIN_ITEMS).toContain(t);
  });
});
