/** Staying put through a refresh (stay.ts). */
import { describe, expect, it } from "vitest";
import { cleanStood, createStay } from "../src/stay.js";

const store = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const T = 1_800_000_000;

describe("where a visitor stood", () => {
  it("is given back after a refresh, and only after a refresh", () => {
    const s = store();
    createStay({ name: "/w/", storage: s, refreshed: false, now: () => T }).keep({ x: 3.5, z: -2, yaw: 450, headset: true });
    expect(createStay({ name: "/w/", storage: s, refreshed: true, now: () => T + 5 }).before).toEqual({ x: 3.5, z: -2, yaw: 90, headset: true, at: T });
    // A link, a door, a new visit: an arrival, at the entrance.
    expect(createStay({ name: "/w/", storage: s, refreshed: false, now: () => T + 5 }).before).toBeNull();
    // Another page of the same site keeps its own.
    expect(createStay({ name: "/other/", storage: s, refreshed: true, now: () => T + 5 }).before).toBeNull();
  });

  it("is forgotten when it is old, when they leave, and when nothing can be kept", () => {
    const s = store();
    const stay = createStay({ name: "/w/", storage: s, refreshed: false, now: () => T });
    stay.keep({ x: 1, z: 1, yaw: 0, headset: false });
    expect(createStay({ name: "/w/", storage: s, refreshed: true, now: () => T + 13 * 3600 }).before).toBeNull();
    stay.clear();
    expect(createStay({ name: "/w/", storage: s, refreshed: true, now: () => T + 5 }).before).toBeNull();
    const none = createStay({ name: "/w/", storage: null, refreshed: true, now: () => T });
    none.keep({ x: 1, z: 1, yaw: 0, headset: false });
    expect(none.before).toBeNull();
  });

  it("is never a place nobody could have stood", () => {
    for (const bad of [null, "here", {}, { x: 1, z: 1, yaw: 0 }, { x: NaN, z: 1, yaw: 0, at: T }, { x: 1e9, z: 1, yaw: 0, at: T }, { x: 1, z: 1, yaw: 0, at: T + 9999 }]) expect(cleanStood(bad, T), JSON.stringify(bad)).toBeNull();
    const s = store();
    s.m.set("nswp:stood:/w/", "{not json");
    expect(createStay({ name: "/w/", storage: s, refreshed: true, now: () => T }).before).toBeNull();
    createStay({ name: "/w/", storage: s, refreshed: false, now: () => T }).keep({ x: Infinity, z: 0, yaw: 0, headset: false });
    expect(s.m.get("nswp:stood:/w/")).toBe("{not json");
  });
});
