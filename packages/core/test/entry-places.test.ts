// Places to arrive (entry-places.ts): enough of them that nobody arrives inside someone.
import { describe, expect, it } from "vitest";
import { checkEntryPlaces, ENTRY_CLEAR, ENTRY_PLACES_LEAST, ENTRY_PLACES_ROOMS, ENTRY_RING, entryPlaces, leastEntryPlaces, pickEntryPlace, type EntryPointSpec } from "../src/entry-places.js";

const spot: EntryPointSpec = { position: [0, 0, 5], yaw: 0 };
const row = (n: number, gap = 1.5): EntryPointSpec => ({ position: [0, 0, 5], yaw: 0, places: Array.from({ length: n - 1 }, (_, i) => ({ position: [(i + 1) * gap, 0, 5] as [number, number, number], yaw: 0 })) });

describe("the places of an entry point", () => {
  it("start with its own spot, so a door naming it lands where it always did", () => {
    expect(entryPlaces(row(8), 8)[0]).toEqual({ position: [0, 0, 5], yaw: 0 });
    expect(entryPlaces(row(8), 8)).toHaveLength(8);
  });

  it("are filled to the least with a ring round a spot written the old way", () => {
    const places = entryPlaces(spot, ENTRY_PLACES_LEAST);
    expect(places).toHaveLength(ENTRY_PLACES_LEAST);
    for (const p of places.slice(1)) expect(Math.hypot(p.position[0] - 0, p.position[2] - 5)).toBeCloseTo(ENTRY_RING, 9);
    // Each at least a person's room from the others.
    for (let i = 0; i < places.length; i++) for (let j = i + 1; j < places.length; j++) expect(Math.hypot(places[i]!.position[0] - places[j]!.position[0], places[i]!.position[2] - places[j]!.position[2])).toBeGreaterThanOrEqual(ENTRY_CLEAR);
  });

  it("are eight for a world for meeting people, four otherwise", () => {
    expect(leastEntryPlaces(["rooms"])).toBe(ENTRY_PLACES_ROOMS);
    expect(leastEntryPlaces(["multiplayer"])).toBe(8);
    expect(leastEntryPlaces(["saves"])).toBe(4);
    expect(leastEntryPlaces()).toBe(4);
  });
});

describe("where an arriving visitor stands", () => {
  const places = entryPlaces(row(4), 4); // x = 0, 1.5, 3, 4.5 along z = 5

  it("is the first place, with nobody about", () => {
    expect(pickEntryPlace(places, [])).toBe(0);
  });

  it("is the first place nobody is within a metre of", () => {
    expect(pickEntryPlace(places, [[0.2, 5]])).toBe(1);
    expect(pickEntryPlace(places, [[0.2, 5], [1.5, 5.4]])).toBe(2);
    // Exactly a metre off is clear.
    expect(pickEntryPlace(places, [[0, 5 + ENTRY_CLEAR]])).toBe(0);
  });

  it("is never where nobody may stand", () => {
    expect(pickEntryPlace(places, [], (x) => x > 2)).toBe(2);
    // A world's own check that throws is a place nobody may stand on.
    expect(pickEntryPlace(places, [], (x) => { if (x < 1) throw new Error("no"); return true; })).toBe(1);
  });

  it("with every place taken, is the one with the most room, never on top of someone", () => {
    const crowd: [number, number][] = [[0, 5], [1.5, 5], [3, 5], [4.5, 5.6]];
    expect(pickEntryPlace(places, crowd)).toBe(3);
  });

  it("is the first place only when nowhere may be stood on at all, and nothing with no places", () => {
    expect(pickEntryPlace(places, [], () => false)).toBe(0);
    expect(pickEntryPlace([], [])).toBe(-1);
  });
});

describe("a world's check of its entry points", () => {
  it("warns for one spot written the old way, and is happy with enough places a metre apart", () => {
    expect(checkEntryPlaces({ "main-entrance": spot })).toEqual([expect.objectContaining({ level: "warn", code: "single_spot", entry: "main-entrance" })]);
    expect(checkEntryPlaces({ "main-entrance": row(4) })).toEqual([]);
    expect(checkEntryPlaces({ "main-entrance": row(8) }, { capabilities: ["rooms"] })).toEqual([]);
  });

  it("fails a set given but too small, or packed tighter than a person's room", () => {
    expect(checkEntryPlaces({ a: row(3) }).map((i) => [i.level, i.code])).toEqual([["error", "too_few"]]);
    expect(checkEntryPlaces({ a: row(4) }, { capabilities: ["rooms"] }).map((i) => i.code)).toEqual(["too_few"]);
    expect(checkEntryPlaces({ a: row(4, 0.5) }).filter((i) => i.code === "too_close").length).toBeGreaterThan(0);
  });

  it("fails a place without a position or a yaw", () => {
    const broken = { position: [0, 0, 5], yaw: 0, places: [{ position: [1, 0], yaw: 0 }] } as unknown as EntryPointSpec;
    expect(checkEntryPlaces({ a: broken }).map((i) => i.code)).toContain("invalid");
  });
});
