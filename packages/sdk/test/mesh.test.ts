import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MeshBuilder } from "../src/mesh.js";
import { addArchFrame, addBench, addCrystal, addGyro, addKnot, addLamp, addPictureFrame, addPlant, addPlinth, addSpiral, addTable, addTree, addWall, PORTAL_HEIGHT, PORTAL_WIDTH } from "../src/models.js";

/** Each triangle of a geometry: its middle and the normal its corners carry. */
function faces(g: THREE.BufferGeometry): { mid: THREE.Vector3; normal: THREE.Vector3; area: number }[] {
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const out = [];
  for (let i = 0; i < p.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(p, i + k)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    const wound = b.clone().sub(a).cross(c.clone().sub(a));
    const normal = new THREE.Vector3().fromBufferAttribute(n, i);
    // The way the corners wind must agree with the normal stored, or the face is drawn inside out.
    // (Not exactly: a face that twists is two triangles sharing one normal.)
    if (wound.length() > 1e-9) expect(wound.clone().normalize().dot(normal)).toBeGreaterThan(0.5);
    out.push({ mid: a.add(b).add(c).multiplyScalar(1 / 3), normal, area: wound.length() });
  }
  return out;
}

describe("MeshBuilder", () => {
  it("builds a bevelled box whose faces all point outward", () => {
    const b = new MeshBuilder().at();
    b.box([2, 1, 3], [5, 0.5, -1], { bevel: 0.05 });
    const centre = new THREE.Vector3(5, 0.5, -1);
    const all = faces(b.geometry()).filter((f) => f.area > 1e-9);
    // Six faces, twelve bevelled edges, eight cut corners.
    expect(all.length).toBe(6 * 2 + 12 * 2 + 8);
    for (const f of all) expect(f.normal.dot(f.mid.clone().sub(centre))).toBeGreaterThan(0);
  });

  it("presses panels into a box: only the panels' own walls face inward", () => {
    const b = new MeshBuilder().at();
    b.box([2, 1, 3], [0, 0.5, 0], { bevel: 0.05, panel: { margin: 0.2, depth: 0.03 } });
    const centre = new THREE.Vector3(0, 0.5, 0);
    const all = faces(b.geometry()).filter((f) => f.area > 1e-9);
    const inward = all.filter((f) => f.normal.dot(f.mid.clone().sub(centre)) <= 0);
    // Four sides have a panel, and each panel has four walls of two triangles.
    expect(inward.length).toBe(4 * 4 * 2);
  });

  it("turns a profile on a lathe with every face pointing away from the axis", () => {
    const b = new MeshBuilder().at();
    b.lathe([[0.3, 0], [0.5, 0.4], [0.2, 1]], [0, 0, 0], 8);
    for (const f of faces(b.geometry())) {
      if (f.area < 1e-9) continue;
      expect(f.normal.x * f.mid.x + f.normal.z * f.mid.z).toBeGreaterThan(0);
    }
  });

  it("sweeps a profile along a path with its faces pointing away from the path", () => {
    const b = new MeshBuilder().at();
    const square: [number, number][] = [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]];
    // Travel runs along x × y: here, up.
    b.sweep(square, [{ p: [0, 0, 0], x: [1, 0, 0], y: [0, 0, -1] }, { p: [0, 2, 0], x: [1, 0, 0], y: [0, 0, -1] }]);
    for (const f of faces(b.geometry())) {
      if (f.area < 1e-9) continue;
      const fromAxis = new THREE.Vector3(f.mid.x, 0, f.mid.z);
      const cap = Math.abs(f.normal.y) > 0.9;
      if (cap) expect(f.normal.y * (f.mid.y - 1)).toBeGreaterThan(0);
      else expect(f.normal.dot(fromAxis)).toBeGreaterThan(0);
    }
  });

  it("places and turns what is added", () => {
    const b = new MeshBuilder().at([10, 0, 0], 90);
    b.box([1, 1, 4], [0, 0.5, 0]);
    const box = new THREE.Box3().setFromBufferAttribute(b.geometry().getAttribute("position") as THREE.BufferAttribute);
    expect(box.max.x - box.min.x).toBeCloseTo(4, 5);
    expect(box.max.z - box.min.z).toBeCloseTo(1, 5);
    expect((box.max.x + box.min.x) / 2).toBeCloseTo(10, 5);
  });
});

describe("the modelled pieces", () => {
  const pieces: [string, (b: MeshBuilder) => void, number][] = [
    ["doorway frame", (b) => addArchFrame(b), 3],
    ["wall", (b) => addWall(b, 8, 4), 9],
    ["plinth", (b) => addPlinth(b), 2],
    ["bench", (b) => addBench(b, "#123"), 2],
    ["table", (b) => addTable(b, "#123"), 2],
    ["lamp", (b) => addLamp(b), 2.5],
    ["plant", (b) => addPlant(b, "#123", 3), 2.5],
    ["picture frame", (b) => addPictureFrame(b, 1.2, 0.9), 2],
    ["knot", (b) => addKnot(b), 1],
    ["gyro", (b) => addGyro(b), 1],
    ["crystal", (b) => addCrystal(b), 1.5],
    ["spiral", (b) => addSpiral(b), 1],
    ["tree", (b) => addTree(b, "#123", 4), 5],
  ];
  for (const [name, add, reach] of pieces) {
    it(`${name}: sound geometry, the right size, consistently wound`, () => {
      const b = new MeshBuilder().at();
      add(b);
      const g = b.geometry();
      expect(b.triangles).toBeGreaterThan(8);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count * 3; i++) expect(Number.isFinite(p.array[i])).toBe(true);
      expect(g.boundingSphere!.radius).toBeLessThan(reach * 2);
      expect(g.boundingSphere!.radius).toBeGreaterThan(0.2);
      faces(g);
      // Nothing is so bright or so dark that the shader can't draw it.
      const glow = g.getAttribute("glow");
      for (let i = 0; i < glow.count; i++) expect(glow.getX(i)).toBeGreaterThanOrEqual(0);
    });
  }

  it("the doorway frame leaves the opening clear", () => {
    const b = new MeshBuilder().at();
    addArchFrame(b);
    const spring = PORTAL_HEIGHT - PORTAL_WIDTH / 2;
    // Above the blocks it stands on, nothing comes inside the opening by more than the blocks the arch springs from.
    for (const f of faces(b.geometry())) {
      if (f.mid.y < 0.26) continue;
      const inside = f.mid.y < spring ? PORTAL_WIDTH / 2 - Math.abs(f.mid.x) : PORTAL_WIDTH / 2 - Math.hypot(f.mid.x, f.mid.y - spring);
      expect(inside).toBeLessThan(0.04);
    }
  });
});
