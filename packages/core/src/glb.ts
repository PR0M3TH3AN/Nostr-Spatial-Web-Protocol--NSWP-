/**
 * Reading a model file before anything draws it (protocol/17-items.md, "Holding one").
 *
 * An item's model is somebody else's file. Before it is handed to whatever draws the world, it is read here, as
 * bytes and nothing more, and counted: how many triangles, meshes and materials it has, how large its pictures
 * are, and whether it asks for anything from anywhere else. This is the same count for every engine, made before
 * any engine's own reader sees the file: so a model too heavy for one world is too heavy for all of them, and a
 * file can never send a visitor's browser to fetch something from an address its maker chose.
 *
 * It reads only a binary glTF (GLB) that holds everything it needs inside itself. It decodes no geometry and no
 * picture: sizes are read from each picture's own first few bytes.
 */

/**
 * Which of an item's colours a material is, if it is one a holder may choose: it is named `tint:<slot>`, or
 * `tint_<slot>` (some tools, Godot among them, won't write a colon in a name). "" for any other material.
 */
export function tintSlot(name: unknown): string {
  return typeof name === "string" ? (/^tint[:_]([a-z][a-z0-9-]{0,23})$/.exec(name)?.[1] ?? "") : "";
}

/** The most a carried model may be. One budget, whatever draws it. */
export const MODEL_BUDGET = {
  /** The most a model file may weigh, in bytes. */
  bytes: 2_000_000,
  /** The most triangles, meshes and materials a model may have. */
  triangles: 20_000,
  meshes: 40,
  materials: 16,
  /** The longest side of any picture a model's surfaces may use, in pixels. */
  texture: 1024,
} as const;

/** A budget a model is read against: an item's (`MODEL_BUDGET`) or a look's (`LOOK_BUDGET`, look-model.ts). */
export interface ModelBudget {
  bytes: number;
  triangles: number;
  meshes: number;
  materials: number;
  texture: number;
  /** The most joints its skins may have, all told. Left out, no limit. */
  joints?: number;
  /** The most morph targets any one of its meshes may have. Left out, no limit. */
  morphs?: number;
  /** Extensions it may say it requires, beyond none: each read for what the kit uses of it and otherwise ignored. */
  extensions?: readonly string[];
}

export interface GlbCount {
  triangles: number;
  meshes: number;
  materials: number;
  /** The longest side of its largest picture, or 0 where it has none. */
  texture: number;
  animations: string[];
  /** The names of its materials, in order: a renderer colours the ones named `tint:<slot>`. */
  materialNames: string[];
  /** How many joints its skins have, all told (each joint once): 0 for a model with no skeleton. */
  joints: number;
  /** The most morph targets any one of its meshes has. */
  morphs: number;
}

export type GlbRead = { ok: true; count: GlbCount } | { ok: false; why: "not-glb" | "too-big" | "outside" | "needs-more" | "over-budget" | "unreadable" };

const u32 = (b: Uint8Array, at: number): number => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

/** How large a picture is, from its own first bytes: PNG, JPEG or WebP. Null for anything else. */
function pictureSize(b: Uint8Array): [number, number] | null {
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const be = (at: number) => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
    return [be(16), be(20)];
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let at = 2; at + 9 < b.length; ) {
      if (b[at] !== 0xff) return null;
      const marker = b[at + 1]!;
      const length = (b[at + 2]! << 8) | b[at + 3]!;
      // A frame header says how large the picture is.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [(b[at + 7]! << 8) | b[at + 8]!, (b[at + 5]! << 8) | b[at + 6]!];
      if (length < 2) return null;
      at += 2 + length;
    }
    return null;
  }
  if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const kind = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
    if (kind === "VP8X") return [1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16))];
    if (kind === "VP8 ") return [(b[26]! | (b[27]! << 8)) & 0x3fff, (b[28]! | (b[29]! << 8)) & 0x3fff];
    if (kind === "VP8L") return [1 + (((b[22]! & 0x3f) << 8) | b[21]!), 1 + (((b[24]! & 0x0f) << 10) | (b[23]! << 2) | ((b[22]! & 0xc0) >> 6))];
  }
  return null;
}

/**
 * How large a model is as it stands, and the colours its maker left for a holder to choose: for someone
 * describing an item made in any tool (`nswp make-item`). The box is what its meshes fill, with every node's
 * place and turn taken into account, in metres: width, height, depth. A tint is a material named `tint:<slot>`
 * or `tint_<slot>` (`tintSlot`), and its colour is the one the material has. Null for a file `readGlb` would refuse.
 */
export function measureGlb(bytes: Uint8Array): { size: [number, number, number]; tints: { slot: string; color: string }[]; count: GlbCount } | null {
  const read = readGlb(bytes);
  if (!read.ok) return null;
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + u32(bytes, 12)))) as Record<string, unknown>;
  const list = (name: string): Record<string, unknown>[] => (Array.isArray(json[name]) ? (json[name] as Record<string, unknown>[]) : []);
  const nodes = list("nodes");
  const meshes = list("meshes");
  const accessors = list("accessors");
  type M = number[]; // a transform, as glTF writes one: sixteen numbers, column by column
  const one: M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const times = (a: M, b: M): M => {
    const o = new Array<number>(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
    return o;
  };
  const own = (n: Record<string, unknown>): M => {
    if (Array.isArray(n.matrix) && n.matrix.length === 16) return n.matrix as M;
    const [x, y, z, w] = Array.isArray(n.rotation) && n.rotation.length === 4 ? (n.rotation as number[]) : [0, 0, 0, 1];
    const [sx, sy, sz] = Array.isArray(n.scale) && n.scale.length === 3 ? (n.scale as number[]) : [1, 1, 1];
    const [tx, ty, tz] = Array.isArray(n.translation) && n.translation.length === 3 ? (n.translation as number[]) : [0, 0, 0];
    return [
      (1 - 2 * (y! * y! + z! * z!)) * sx!, 2 * (x! * y! + z! * w!) * sx!, 2 * (x! * z! - y! * w!) * sx!, 0,
      2 * (x! * y! - z! * w!) * sy!, (1 - 2 * (x! * x! + z! * z!)) * sy!, 2 * (y! * z! + x! * w!) * sy!, 0,
      2 * (x! * z! + y! * w!) * sz!, 2 * (y! * z! - x! * w!) * sz!, (1 - 2 * (x! * x! + y! * y!)) * sz!, 0,
      tx!, ty!, tz!, 1,
    ];
  };
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const walk = (index: number, above: M, depth: number): void => {
    const node = nodes[index];
    if (!node || depth > 32) return;
    const here = times(above, own(node));
    const mesh = typeof node.mesh === "number" ? meshes[node.mesh] : undefined;
    for (const p of Array.isArray(mesh?.primitives) ? (mesh!.primitives as Record<string, unknown>[]) : []) {
      const a = accessors[(p.attributes as Record<string, number> | undefined)?.POSITION ?? -1];
      const [min, max] = [a?.min as number[] | undefined, a?.max as number[] | undefined];
      if (!Array.isArray(min) || !Array.isArray(max) || min.length !== 3 || max.length !== 3) continue;
      // The eight corners of this part's own box, each put where the node puts it.
      for (let corner = 0; corner < 8; corner++) {
        const c = [corner & 1 ? max[0]! : min[0]!, corner & 2 ? max[1]! : min[1]!, corner & 4 ? max[2]! : min[2]!];
        for (let i = 0; i < 3; i++) {
          const v = here[i]! * c[0]! + here[4 + i]! * c[1]! + here[8 + i]! * c[2]! + here[12 + i]!;
          lo[i] = Math.min(lo[i]!, v);
          hi[i] = Math.max(hi[i]!, v);
        }
      }
    }
    for (const child of Array.isArray(node.children) ? (node.children as number[]) : []) walk(child, here, depth + 1);
  };
  const scenes = list("scenes");
  const roots = (scenes[typeof json.scene === "number" ? json.scene : 0]?.nodes as number[] | undefined) ?? nodes.map((_, i) => i);
  for (const root of roots) walk(root, one, 0);
  if (!lo.every(Number.isFinite) || !hi.every(Number.isFinite)) return null;
  const mm = (x: number) => Math.max(0.001, Math.round(x * 1000) / 1000);
  // A colour as a file has it (in linear light), as it is written for a screen.
  const hex = (c: number) => Math.round(Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)) * 255).toString(16).padStart(2, "0");
  const tints: { slot: string; color: string }[] = [];
  for (const m of list("materials")) {
    const slot = tintSlot(m.name);
    const base = (m.pbrMetallicRoughness as Record<string, unknown> | undefined)?.baseColorFactor;
    const [r, g, b] = Array.isArray(base) && base.length >= 3 ? (base as number[]) : [1, 1, 1];
    if (slot && !tints.some((t) => t.slot === slot)) tints.push({ slot, color: `#${hex(r!)}${hex(g!)}${hex(b!)}` });
  }
  return { size: [mm(hi[0]! - lo[0]!), mm(hi[1]! - lo[1]!), mm(hi[2]! - lo[2]!)], tints: tints.slice(0, 4), count: read.count };
}

/**
 * Read a model file and count it. It is refused where it isn't a binary glTF, is over the budget, needs something
 * a plain reader doesn't have (`needs-more`), or names anything outside itself (`outside`): a buffer or a picture
 * at an address. Nothing is fetched and nothing is drawn.
 */
export function readGlb(bytes: Uint8Array, budget: ModelBudget = MODEL_BUDGET): GlbRead {
  if (!(bytes instanceof Uint8Array) || bytes.length < 20 || u32(bytes, 0) !== 0x46546c67 || u32(bytes, 4) !== 2) return { ok: false, why: "not-glb" };
  if (bytes.length > budget.bytes) return { ok: false, why: "too-big" };
  const total = u32(bytes, 8);
  const jsonLength = u32(bytes, 12);
  if (total > bytes.length || u32(bytes, 16) !== 0x4e4f534a || 20 + jsonLength > bytes.length) return { ok: false, why: "not-glb" };
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(20, 20 + jsonLength))) as Record<string, unknown>;
  } catch {
    return { ok: false, why: "unreadable" };
  }
  if (!json || typeof json !== "object") return { ok: false, why: "unreadable" };
  // The one binary chunk, where everything it names must be.
  const binAt = 20 + jsonLength;
  const bin = binAt + 8 <= bytes.length && u32(bytes, binAt + 4) === 0x004e4942 ? bytes.subarray(binAt + 8, Math.min(bytes.length, binAt + 8 + u32(bytes, binAt))) : new Uint8Array(0);
  const list = (name: string): Record<string, unknown>[] => (Array.isArray(json[name]) ? (json[name] as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);
  // Anything it would have a reader go and get is refused: a model is whole, or it isn't used.
  if (list("buffers").some((b) => b.uri !== undefined) || list("images").some((i) => i.uri !== undefined)) return { ok: false, why: "outside" };
  // Anything it needs a special reader for is refused too: what every engine reads is plain glTF.
  // A look's budget lets a few through by name (VRM's own): the kit reads what it uses of them and ignores the rest.
  if (Array.isArray(json.extensionsRequired) && json.extensionsRequired.some((x) => !budget.extensions?.includes(x as string))) return { ok: false, why: "needs-more" };
  const accessors = list("accessors");
  const views = list("bufferViews");
  const meshes = list("meshes");
  let triangles = 0;
  let parts = 0;
  let morphs = 0;
  for (const mesh of meshes) {
    for (const p of Array.isArray(mesh.primitives) ? (mesh.primitives as Record<string, unknown>[]) : []) {
      parts++;
      if (Array.isArray(p.targets)) morphs = Math.max(morphs, p.targets.length);
      const mode = typeof p.mode === "number" ? p.mode : 4;
      const from = typeof p.indices === "number" ? p.indices : ((p.attributes as Record<string, unknown> | undefined)?.POSITION as number | undefined);
      const count = typeof from === "number" && typeof accessors[from]?.count === "number" ? (accessors[from]!.count as number) : 0;
      // Triangles, strips and fans; lines and points cost a little, counted as if they were.
      triangles += mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : Math.ceil(count / 3);
    }
  }
  let texture = 0;
  for (const image of list("images")) {
    const view = typeof image.bufferView === "number" ? views[image.bufferView] : undefined;
    const at = typeof view?.byteOffset === "number" ? view.byteOffset : 0;
    const length = typeof view?.byteLength === "number" ? view.byteLength : 0;
    const size = view && at + length <= bin.length ? pictureSize(bin.subarray(at, at + length)) : null;
    // A picture whose size can't be read is one that can't be counted: it is refused.
    if (!size) return { ok: false, why: "needs-more" };
    texture = Math.max(texture, size[0], size[1]);
  }
  const materials = list("materials");
  const joints = new Set<number>();
  for (const skin of list("skins")) for (const j of Array.isArray(skin.joints) ? skin.joints : []) if (typeof j === "number") joints.add(j);
  const count: GlbCount = {
    triangles,
    // What a renderer makes a mesh of is each part of each mesh.
    meshes: parts,
    materials: materials.length,
    texture,
    animations: list("animations")
      .map((a) => (typeof a.name === "string" ? a.name : ""))
      .filter(Boolean)
      .slice(0, 8),
    materialNames: materials.map((m) => (typeof m.name === "string" ? m.name : "")),
    joints: joints.size,
    morphs,
  };
  const within = parts > 0 && parts <= budget.meshes && triangles <= budget.triangles && count.materials <= budget.materials && texture <= budget.texture && count.joints <= (budget.joints ?? Infinity) && morphs <= (budget.morphs ?? Infinity);
  return within ? { ok: true, count } : { ok: false, why: "over-budget" };
}
