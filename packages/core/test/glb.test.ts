// Reading a model before anything draws it: the same count for every engine.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { measureGlb, MODEL_BUDGET, readGlb, tintSlot } from "../src/index.js";

const models = join(__dirname, "..", "..", "..", "sites", "items", "models");
const files = readdirSync(models).filter((f) => f.endsWith(".glb"));

/** A binary glTF from its JSON part and whatever binary goes with it. */
const glb = (json: unknown, bin = new Uint8Array(0)): Uint8Array => {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const head = new Uint8Array(text.length + ((4 - (text.length % 4)) % 4)).fill(0x20);
  head.set(text);
  const body = new Uint8Array(bin.length + ((4 - (bin.length % 4)) % 4));
  body.set(bin);
  const out = new Uint8Array(12 + 8 + head.length + (body.length ? 8 + body.length : 0));
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, out.length, true);
  v.setUint32(12, head.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(head, 20);
  if (body.length) {
    v.setUint32(20 + head.length, body.length, true);
    v.setUint32(24 + head.length, 0x004e4942, true);
    out.set(body, 28 + head.length);
  }
  return out;
};
const box = { asset: { version: "2.0" }, meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }], materials: [{ name: "tint:accent" }], accessors: [{ count: 8 }, { count: 36 }], buffers: [{ byteLength: 0 }] };

describe("a model file, read before anything draws it", () => {
  it("counts every starter item's model within the budget, and finds what the blaster's parts are called", () => {
    expect(files.length).toBeGreaterThan(5);
    let animated = 0;
    for (const f of files) {
      const read = readGlb(new Uint8Array(readFileSync(join(models, f))));
      expect(read.ok, f).toBe(true);
      if (!read.ok) continue;
      expect(read.count.triangles).toBeGreaterThan(0);
      expect(read.count.triangles).toBeLessThanOrEqual(MODEL_BUDGET.triangles);
      if (read.count.animations.length) {
        animated++;
        expect(read.count.animations).toEqual(["reload", "fire"]);
        expect(read.count.materialNames).toContain("tint:accent");
        expect(read.count.materialNames).toContain("tint:dart");
      }
    }
    expect(animated).toBe(1);
  });

  it("measures the blaster as it was made, and finds the colours left to its holder", () => {
    const described = JSON.parse(readFileSync(join(models, "..", "items.json"), "utf8")) as { d: string; model: { sha256: string }; size: number[]; tints?: { slot: string; color: string }[] }[];
    for (const item of described) {
      const got = measureGlb(new Uint8Array(readFileSync(join(models, `${item.model.sha256}.glb`))))!;
      // To the millimetre, give or take the rounding of each side.
      for (let i = 0; i < 3; i++) expect(Math.abs(got.size[i]! - item.size[i]!), `${item.d} side ${i}`).toBeLessThan(0.002);
      expect(got.tints.map((t) => t.slot).sort()).toEqual((item.tints ?? []).map((t) => t.slot).sort());
      for (const tint of item.tints ?? []) expect(got.tints.find((t) => t.slot === tint.slot)!.color, `${item.d} ${tint.slot}`).toBe(tint.color);
    }
  });

  it("measures a part where its node puts it: moved, turned and scaled", () => {
    const moved = { ...box, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, translation: [5, 0, 0], scale: [2, 1, 1], rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] }], accessors: [{ count: 8, min: [0, 0, 0], max: [1, 2, 3] }, { count: 36 }] };
    // A box 1 by 2 by 3, made twice as wide and then turned a quarter about z: 2 high, 2 wide, 3 deep.
    expect(measureGlb(glb(moved))!.size).toEqual([2, 2, 3]);
    expect(measureGlb(new TextEncoder().encode("not a model"))).toBeNull();
  });

  it("knows a colour left to a holder by its material's name, with a colon or, as Godot writes it, without", () => {
    expect(tintSlot("tint:accent")).toBe("accent");
    expect(tintSlot("tint_accent")).toBe("accent");
    for (const not of ["accent", "tint:", "tint:Accent", "tinted", "tint-accent", 7, null]) expect(tintSlot(not), String(not)).toBe("");
    const made = measureGlb(glb({ ...box, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], materials: [{ name: "tint_accent", pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } }], accessors: [{ count: 8, min: [0, 0, 0], max: [1, 1, 1] }, { count: 36 }] }))!;
    expect(made.tints).toEqual([{ slot: "accent", color: "#ff0000" }]);
  });

  it("counts a plain box", () => {
    expect(readGlb(glb(box))).toEqual({ ok: true, count: { triangles: 12, meshes: 1, materials: 1, texture: 0, animations: [], materialNames: ["tint:accent"] } });
  });

  it("refuses a file that would have a reader fetch something from somewhere else", () => {
    expect(readGlb(glb({ ...box, buffers: [{ uri: "https://elsewhere.example/a.bin", byteLength: 4 }] }))).toEqual({ ok: false, why: "outside" });
    expect(readGlb(glb({ ...box, images: [{ uri: "https://elsewhere.example/tracker.png" }] }))).toEqual({ ok: false, why: "outside" });
    // An address written into the file itself is still an address.
    expect(readGlb(glb({ ...box, images: [{ uri: "data:image/png;base64,AAAA" }] }))).toEqual({ ok: false, why: "outside" });
  });

  it("refuses what is over the budget, what needs a special reader, and what isn't a model", () => {
    expect(readGlb(glb({ ...box, accessors: [{ count: 8 }, { count: 3 * (MODEL_BUDGET.triangles + 1) }] }))).toEqual({ ok: false, why: "over-budget" });
    expect(readGlb(glb({ ...box, materials: Array.from({ length: MODEL_BUDGET.materials + 1 }, () => ({})) }))).toEqual({ ok: false, why: "over-budget" });
    expect(readGlb(glb({ ...box, meshes: [] }))).toEqual({ ok: false, why: "over-budget" });
    expect(readGlb(glb({ ...box, extensionsRequired: ["KHR_draco_mesh_compression"] }))).toEqual({ ok: false, why: "needs-more" });
    expect(readGlb(new TextEncoder().encode("not a model at all, just words"))).toEqual({ ok: false, why: "not-glb" });
    expect(readGlb(new Uint8Array(MODEL_BUDGET.bytes + 1).fill(1))).toEqual({ ok: false, why: "not-glb" });
  });

  it("reads how large a picture is from its first bytes, and refuses one too large or one it can't measure", () => {
    const png = (w: number, h: number) => {
      const b = new Uint8Array(24);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      new DataView(b.buffer).setUint32(16, w);
      new DataView(b.buffer).setUint32(20, h);
      return b;
    };
    const withPicture = (bin: Uint8Array) => glb({ ...box, images: [{ bufferView: 0, mimeType: "image/png" }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }], buffers: [{ byteLength: bin.length }] }, bin);
    const fine = readGlb(withPicture(png(512, 256)));
    expect(fine.ok && fine.count.texture).toBe(512);
    expect(readGlb(withPicture(png(4096, 4096)))).toEqual({ ok: false, why: "over-budget" });
    expect(readGlb(withPicture(new Uint8Array(64).fill(7)))).toEqual({ ok: false, why: "needs-more" });
  });
});
