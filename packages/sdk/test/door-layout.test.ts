import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { doorArcStep, doorRow, doorsOnArc, doorsTooClose } from "../src/door-layout.js";
import { DOOR_SPACING, PORTAL_WIDTH } from "../src/gate-size.js";
import { kit } from "../src/engine-menu.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("how far apart doors stand", () => {
  it("is more than a door's own width, so two frames never touch", () => {
    expect(DOOR_SPACING).toBeGreaterThan(PORTAL_WIDTH + 0.5);
  });

  it("a row is never laid nearer than the spacing, whatever is asked", () => {
    for (const count of [0, 1, 2, 3, 7, 12, 40]) {
      for (const apart of [undefined, 0, 1, DOOR_SPACING, 4]) {
        const row = doorRow(count, apart);
        expect(row).toHaveLength(count);
        expect(doorsTooClose(row.map((x) => ({ x, z: 0 })))).toEqual([]);
        // Centred on the middle of the wall.
        if (count) expect(row[0]! + row[count - 1]!).toBeCloseTo(0, 9);
      }
    }
    expect(doorRow(2)).toEqual([-DOOR_SPACING / 2, DOOR_SPACING / 2]);
    expect(doorRow(3, 4)).toEqual([-4, 0, 4]);
  });

  it("doors on a circle are never nearer than the spacing, at any radius", () => {
    for (const radius of [1.3, 2, 5, 8, 10, 11.5, 40]) {
      const step = doorArcStep(radius);
      const count = doorsOnArc(radius, Math.PI);
      const doors = Array.from({ length: count }, (_, i) => ({ x: Math.sin(i * step) * radius, z: -Math.cos(i * step) * radius }));
      expect(doorsTooClose(doors)).toEqual([]);
      // And one more would not fit the same half circle.
      expect(count * step).toBeGreaterThan(Math.PI - 1e-9);
      // Neighbours are exactly the spacing apart: no wall is wasted.
      if (count > 1) expect(Math.hypot(doors[1]!.x - doors[0]!.x, doors[1]!.z - doors[0]!.z)).toBeCloseTo(DOOR_SPACING, 9);
    }
  });

  it("a circle too small for two doors holds one", () => {
    expect(doorArcStep(DOOR_SPACING / 2)).toBe(Math.PI);
    expect(doorArcStep(0)).toBe(Math.PI);
    expect(doorsOnArc(1, Math.PI / 2)).toBe(1);
    expect(doorsOnArc(0, Math.PI)).toBe(0);
    expect(doorsOnArc(8, 0)).toBe(1);
  });

  it("says which two doors are too close, and how far apart they are", () => {
    expect(doorsTooClose([[0, 0, 0], [DOOR_SPACING, 0, 0], [DOOR_SPACING, 0, DOOR_SPACING]])).toEqual([]);
    expect(doorsTooClose([[0, 0, 0], [5, 0, 0], [5, 0, 1.5]])).toEqual([{ a: 1, b: 2, apart: 1.5 }]);
    // Height is not distance along the floor: a door over a door is not beside it.
    expect(doorsTooClose([[0, 0, 0], [0, 4, 0]])).toEqual([{ a: 0, b: 1, apart: 0 }]);
    expect(doorsTooClose([{ x: 0, z: 0 }, [1.81, 0, 0]])).toEqual([{ a: 0, b: 1, apart: 1.81 }]);
  });

  it("is the number another engine is given", () => {
    expect(JSON.parse(kit()).doorSpacing).toBe(DOOR_SPACING);
    expect(readFileSync(join(root, "engines", "godot", "addons", "nswp", "nswp.gd"), "utf8")).toContain(`"doorSpacing": ${DOOR_SPACING},`);
  });
});

describe("every reference world keeps its doors apart", () => {
  // A world writes its doors in src/main.ts as `{ to: "…", …, position: [x, y, z] }`, inside `doors: [ … ]`.
  const sites = join(root, "sites");
  const worlds = readdirSync(sites).filter((name) => existsSync(join(sites, name, "src", "main.ts")) && existsSync(join(sites, name, "world.json")));
  const doorsOf = (name: string): [number, number, number][] => {
    const text = readFileSync(join(sites, name, "src", "main.ts"), "utf8");
    const list = /\bdoors: \[([\s\S]*?)\n  \]/.exec(text)?.[1] ?? "";
    return [...list.matchAll(/\{\s*to: "[^"]+"[^}]*?position: \[\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
  };

  it("finds the worlds and their doors", () => {
    expect(worlds.length).toBeGreaterThanOrEqual(7);
    for (const name of worlds) expect(doorsOf(name).length, `${name} has doors`).toBeGreaterThanOrEqual(2);
  });

  it.each(worlds)("%s", (name) => {
    expect(doorsTooClose(doorsOf(name)), `${name}'s doors, by their place in its list`).toEqual([]);
  });
});
