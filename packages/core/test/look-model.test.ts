// A model of your own, as your look: the budget it is read against, how tall it is drawn, and what its note says.
import { describe, expect, it } from "vitest";
import { AVATAR_KIND, LOOK_BUDGET, LOOK_HEIGHT, lookHeight, MODEL_BUDGET, parseManifest, readGlb, readLookModel } from "../src/index.js";

const glb = (json: unknown): Uint8Array => {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const head = new Uint8Array(text.length + ((4 - (text.length % 4)) % 4)).fill(0x20);
  head.set(text);
  const out = new Uint8Array(20 + head.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, out.length, true);
  v.setUint32(12, head.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(head, 20);
  return out;
};
const body = { asset: { version: "2.0" }, meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, targets: [{}, {}, {}] }] }], materials: [{}], accessors: [{ count: 8 }, { count: 36 }], buffers: [{ byteLength: 0 }] };
const skinned = (joints: number, extra: Record<string, unknown> = {}) => ({ ...body, nodes: Array.from({ length: joints }, () => ({})), skins: [{ joints: Array.from({ length: joints }, (_, i) => i) }, { joints: [0, 1] }], ...extra });
const H = "c".repeat(64);
const note = (tags: string[][]) => ({ kind: AVATAR_KIND, tags: [["d", "default"], ...tags] });

describe("a look's model, read before anything draws it", () => {
  it("counts joints (each once) and the most morph targets on a mesh", () => {
    const read = readGlb(glb(skinned(40)), LOOK_BUDGET);
    expect(read.ok && read.count.joints).toBe(40);
    expect(read.ok && read.count.morphs).toBe(3);
    const plain = readGlb(glb(body), LOOK_BUDGET);
    expect(plain.ok && plain.count.joints).toBe(0);
  });

  it("is held to a budget lower than an item's", () => {
    expect(LOOK_BUDGET.bytes).toBeLessThan(MODEL_BUDGET.bytes);
    expect(LOOK_BUDGET.triangles).toBeLessThan(MODEL_BUDGET.triangles);
    expect(readGlb(glb(skinned(LOOK_BUDGET.joints + 1)), LOOK_BUDGET)).toEqual({ ok: false, why: "over-budget" });
    const faces = { ...body, meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, targets: Array.from({ length: LOOK_BUDGET.morphs + 1 }, () => ({})) }] }] };
    expect(readGlb(glb(faces), LOOK_BUDGET)).toEqual({ ok: false, why: "over-budget" });
    expect(readGlb(glb({ ...body, accessors: [{ count: 8 }, { count: 3 * (LOOK_BUDGET.triangles + 1) }] }), LOOK_BUDGET)).toEqual({ ok: false, why: "over-budget" });
    // An item's budget sets no limit on joints or morphs.
    expect(readGlb(glb(skinned(LOOK_BUDGET.joints + 1))).ok).toBe(true);
  });

  it("lets VRM's own required extensions through, and nothing else", () => {
    expect(readGlb(glb(skinned(20, { extensionsUsed: ["VRMC_vrm"], extensionsRequired: ["VRMC_vrm", "VRMC_materials_mtoon"] })), LOOK_BUDGET).ok).toBe(true);
    expect(readGlb(glb(skinned(20, { extensionsRequired: ["VRMC_springBone"] })), LOOK_BUDGET)).toEqual({ ok: false, why: "needs-more" });
    expect(readGlb(glb(skinned(20, { extensionsRequired: ["KHR_draco_mesh_compression"] })), LOOK_BUDGET)).toEqual({ ok: false, why: "needs-more" });
    // An item still takes none.
    expect(readGlb(glb(skinned(20, { extensionsRequired: ["VRMC_vrm"] })))).toEqual({ ok: false, why: "needs-more" });
  });
});

describe("how tall a look is drawn", () => {
  it("is what was asked, held within the kit's limits", () => {
    expect(lookHeight("1.72")).toBe(1.72);
    expect(lookHeight(0.2)).toBe(LOOK_HEIGHT.least);
    expect(lookHeight(9)).toBe(LOOK_HEIGHT.most);
    expect(lookHeight("tall")).toBe(LOOK_HEIGHT.standard);
    expect(lookHeight(undefined)).toBe(LOOK_HEIGHT.standard);
    expect(lookHeight(-1)).toBe(LOOK_HEIGHT.standard);
  });

  it("is narrowed by a world, never widened", () => {
    expect(lookHeight(2.5, [1.5, 2])).toBe(2);
    expect(lookHeight(1, [1.5, 2])).toBe(1.5);
    expect(lookHeight(2.5, [0.1, 9])).toBe(2.5);
    expect(lookHeight(0.5, [0.1, 9])).toBe(LOOK_HEIGHT.least);
    // Limits that would leave nothing are the kit's own.
    expect(lookHeight(2.5, [3, 4])).toBe(2.5);
  });
});

describe("a look note's model", () => {
  it("is read with its height and picture", () => {
    expect(readLookModel(note([["model", "https://files.example/x.vrm", "vrm", H], ["height", "2.1"], ["thumb", "https://files.example/x.webp", H]]))).toEqual({ url: "https://files.example/x.vrm", format: "vrm", sha256: H, height: 2.1, thumb: { url: "https://files.example/x.webp", sha256: H } });
    expect(readLookModel(note([["model", "https://files.example/x.glb", "glb", H], ["height", "4"], ["thumb", "https://files.example/x.webp"]]))).toEqual({ url: "https://files.example/x.glb", format: "glb", sha256: H, height: LOOK_HEIGHT.most });
  });

  it("is none for a simple look, another kind, or a model that can't be worn", () => {
    expect(readLookModel(note([["simple", "head", "tall"]]))).toBeNull();
    expect(readLookModel({ kind: 1, tags: [["model", "https://files.example/x.vrm", "vrm", H]] })).toBeNull();
    expect(readLookModel(note([["model", "http://files.example/x.vrm", "vrm", H]]))).toBeNull();
    expect(readLookModel(note([["model", "https://files.example/x.fbx", "fbx", H]]))).toBeNull();
    expect(readLookModel(note([["model", "https://files.example/x.vrm", "vrm", "nothash"]]))).toBeNull();
  });
});

describe("a world's word on looks, in its manifest", () => {
  it("reads avatar.height and avatar.dress, and ignores what isn't one", () => {
    const m = (avatar: unknown) => ({ schema: "nswp/manifest/0.3", publishers: { ["01b5370e39784301c3e347b0130266ebb005c5c6141be582e32cda7c367285c6"]: { worlds: ["main"] } }, worlds: { main: { entry: { url: "https://x.example/", modes: ["inline-3d"] }, capabilities: [], avatar } }, relays: ["wss://relay.example"] });
    const good = parseManifest(m({ formats: ["vrm"], height: [1.2, 2], dress: "own" }));
    expect(good.ok && good.value.worlds.main?.avatar).toEqual({ formats: ["vrm"], height: [1.2, 2], dress: "own" });
    const bad = parseManifest(m({ formats: ["vrm"], height: [2, 1], dress: "theirs" }));
    expect(bad.ok && bad.value.worlds.main?.avatar).toEqual({ formats: ["vrm"] });
    expect(bad.warnings.map((w) => w.path)).toEqual(["worlds.main.avatar.height", "worlds.main.avatar.dress"]);
  });
});

describe("the model tier's vectors", () => {
  it("are what the reader makes of them", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const v = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "vectors", "looks.json"), "utf8"));
    expect(v.budget).toEqual(LOOK_BUDGET);
    for (const m of v.models) expect(readLookModel(m.note), m.name).toEqual(m.expect);
    for (const h of v.heights) expect(lookHeight(h.asked, h.world ?? undefined)).toBe(h.expect);
  });
});
