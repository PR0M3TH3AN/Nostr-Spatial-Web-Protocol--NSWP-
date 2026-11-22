import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanSettings } from "@nswp/core";
import { DESK_QUESTION, keepIntense, keptIntense } from "../src/fps.js";
import { hasComfort, saveComfort, DEFAULT_COMFORT, INTENSE_COMFORT } from "../src/actions.js";
import { MOVE_QUESTION } from "../src/input.js";

// A page's own storage, for a test.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});
afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("how a visitor moves, said both ways and asked once", () => {
  it("a headset's choice travels as casual or intense, and nothing else", () => {
    expect(cleanSettings({ headset: "casual" })).toEqual({ headset: "casual" });
    expect(cleanSettings({ headset: "intense" })).toEqual({ headset: "intense" });
    for (const odd of ["smooth", true, 1, null, "INTENSE"]) expect(cleanSettings({ headset: odd })).toEqual({});
  });

  it("at a desk, casual is kept as plainly as intense, so someone who chose casual isn't asked again", () => {
    expect(keptIntense()).toBe(false);
    keepIntense(false);
    expect(keptIntense()).toBe(true);
    expect(store.get("nswp:fps")).toBe("0");
    keepIntense(true);
    expect(store.get("nswp:fps")).toBe("1");
  });

  it("in a headset, a choice is kept once made, and not before", () => {
    expect(hasComfort()).toBe(false);
    saveComfort({ ...DEFAULT_COMFORT, ...INTENSE_COMFORT });
    expect(hasComfort()).toBe(true);
  });

  it("asks in plain words, the two questions apart", () => {
    expect(MOVE_QUESTION).toEqual({ casual: "Casual: point to step, turn in notches", intense: "Intense: walk and turn smoothly with the sticks" });
    expect(DESK_QUESTION).toEqual({ casual: "Casual: click to walk, drag to look", intense: "Intense: the mouse looks, keys walk" });
  });
});
