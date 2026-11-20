import type { Item } from "@nswp/core";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createItemPreviews } from "../src/item-preview.js";

const item = { id: "37303:" + "a".repeat(64) + ":mug", model: { url: "https://x.example/m.glb", sha256: "b".repeat(64) }, size: [0.1, 0.1, 0.1] } as unknown as Item;

describe("a picture of an item, for the bag", () => {
  it("has none where there is no page to draw on, and asks for no model", () => {
    const model = vi.fn(async () => new THREE.Group());
    const previews = createItemPreviews({ model });
    expect(previews.still(item)).toBeNull();
    expect(previews.turning(item, { accent: "#ff0000" })).toBeNull();
    expect(model).not.toHaveBeenCalled();
  });
});
