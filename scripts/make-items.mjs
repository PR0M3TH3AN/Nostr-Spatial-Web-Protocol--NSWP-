// The starter items (protocol/17-items.md): a few small things to carry, made here in code.
//
//   node scripts/make-items.mjs
//
// It writes each model as a binary glTF named by its SHA-256 in sites/items/models/, and what describes each in
// sites/items/items.json, ready for `nswp sign-item`. Nothing is drawn from a file made elsewhere: every shape is
// a box or a prism written out below, so the same script always gives the same bytes and the same hash. The
// models are committed: a description names its file by hash, and a hash that moved would orphan every bag.
//
// Change a shape and its hash changes: the item must then be signed and published again, and the old file kept
// where it is for the bags that still name it.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BLASTER_CLIPS, BLASTER_PARTS, DART_PARTS, MATERIALS as BLASTER_MATERIALS, SIGHT as BLASTER_SIGHT, TINTS as BLASTER_TINTS } from "./blaster-model.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "sites", "items");
/** Where the files are served from: the world sites.json says keeps them (scripts/build-sites.mjs). */
const sites = JSON.parse(readFileSync(join(root, "sites", "sites.json"), "utf8"));
const HOST = `${sites.worlds[sites.keepsItems].url}items/`;

// ---------------------------------------------------------------- shapes
// A shape is a list of triangles, each three points, with a material's name. Every solid here is convex, so its
// faces are turned outward by looking at which way they face from its own middle.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
function solid(material, tris) {
  const all = tris.flat();
  const mid = [0, 1, 2].map((i) => all.reduce((s, p) => s + p[i], 0) / all.length);
  return tris
    .filter(([a, b, c]) => Math.hypot(...cross(sub(b, a), sub(c, a))) > 1e-12)
    .map(([a, b, c]) => {
      const n = cross(sub(b, a), sub(c, a));
      const face = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      return { material, points: dot(n, sub(face, mid)) >= 0 ? [a, b, c] : [a, c, b] };
    });
}
/** A box, by its middle and its size. */
function box(material, [cx, cy, cz], [sx, sy, sz]) {
  const [x0, x1, y0, y1, z0, z1] = [cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, cz - sz / 2, cz + sz / 2];
  const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const quads = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [1, 2, 6, 5], [0, 3, 7, 4]];
  return solid(material, quads.flatMap(([a, b, c, d]) => [[p[a], p[b], p[c]], [p[a], p[c], p[d]]]));
}
/** A prism standing on the y axis: `sides` flat faces, one radius at the bottom and another at the top. */
function prism(material, { r0, r1 = r0, y0, y1, sides = 8, at = [0, 0], turn = 0 }) {
  const ring = (r, y) => Array.from({ length: sides }, (_, i) => {
    const a = turn + (i / sides) * Math.PI * 2;
    return [at[0] + Math.cos(a) * r, y, at[1] + Math.sin(a) * r];
  });
  const low = ring(r0, y0);
  const high = ring(r1, y1);
  const tris = [];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    tris.push([low[i], low[j], high[j]], [low[i], high[j], high[i]]);
    tris.push([[at[0], y0, at[1]], low[i], low[j]], [[at[0], y1, at[1]], high[i], high[j]]);
  }
  return solid(material, tris);
}
/** A shape turned about the z axis through a point, in degrees. */
function turned(shape, degrees, [px, py]) {
  const a = (degrees * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return shape.map((t) => ({ ...t, points: t.points.map(([x, y, z]) => [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c, z]) }));
}

// ---------------------------------------------------------------- materials
const M = {
  brass: { color: [0.8, 0.6, 0.22], metal: 0.6, rough: 0.4 },
  glow: { color: [1, 0.84, 0.45], metal: 0, rough: 0.6, emit: [1, 0.7, 0.3] },
  iron: { color: [0.12, 0.12, 0.14], metal: 0.5, rough: 0.6 },
  leather: { color: [0.36, 0.1, 0.08], metal: 0, rough: 0.8 },
  paper: { color: [0.93, 0.88, 0.74], metal: 0, rough: 0.9 },
  enamel: { color: [0.2, 0.34, 0.43], metal: 0.2, rough: 0.35 },
  tea: { color: [0.42, 0.22, 0.08], metal: 0, rough: 0.3 },
  clay: { color: [0.62, 0.3, 0.18], metal: 0, rough: 0.9 },
  soil: { color: [0.1, 0.07, 0.05], metal: 0, rough: 1 },
  bark: { color: [0.16, 0.13, 0.12], metal: 0, rough: 0.9 },
  leaf: { color: [0.85, 0.62, 0.25], metal: 0.1, rough: 0.7 },
  leafDark: { color: [0.55, 0.38, 0.14], metal: 0.1, rough: 0.7 },
  wood: { color: [0.5, 0.36, 0.2], metal: 0, rough: 0.8 },
  amber: { color: [0.95, 0.72, 0.25], metal: 0, rough: 0.7 },
  teal: { color: [0.25, 0.65, 0.62], metal: 0, rough: 0.7 },
};

// ---------------------------------------------------------------- the items
const ITEMS = [
  {
    d: "brass-lantern",
    title: "Brass lantern",
    summary: "A small lantern with a warm light, like the ones in the Grove's trees.",
    shape: [
      ...prism("brass", { r0: 0.07, y0: 0, y1: 0.03 }),
      ...prism("brass", { r0: 0.056, y0: 0.03, y1: 0.05 }),
      ...prism("glow", { r0: 0.046, y0: 0.05, y1: 0.25, sides: 6 }),
      ...[0, 1, 2, 3].flatMap((i) => box("brass", [Math.cos((i + 0.5) * (Math.PI / 2)) * 0.054, 0.15, Math.sin((i + 0.5) * (Math.PI / 2)) * 0.054], [0.008, 0.2, 0.008])),
      ...prism("brass", { r0: 0.08, r1: 0.03, y0: 0.25, y1: 0.31 }),
      ...prism("brass", { r0: 0.015, y0: 0.31, y1: 0.335 }),
      ...box("iron", [-0.03, 0.365, 0], [0.006, 0.06, 0.006]),
      ...box("iron", [0.03, 0.365, 0], [0.006, 0.06, 0.006]),
      ...box("iron", [0, 0.397, 0], [0.066, 0.006, 0.006]),
    ],
  },
  {
    d: "old-book",
    title: "Old book",
    summary: "A worn book with a leather cover. Nobody has said what is in it.",
    shape: [
      ...box("leather", [0, 0.12, 0.0195], [0.17, 0.24, 0.006]),
      ...box("leather", [0, 0.12, -0.0195], [0.17, 0.24, 0.006]),
      ...box("leather", [-0.082, 0.12, 0], [0.006, 0.24, 0.045]),
      ...box("paper", [0.004, 0.12, 0], [0.156, 0.228, 0.033]),
      ...box("brass", [0, 0.19, 0.0228], [0.11, 0.012, 0.0008]),
      ...box("brass", [0, 0.05, 0.0228], [0.11, 0.012, 0.0008]),
    ],
  },
  {
    d: "tin-mug",
    title: "Tin mug",
    summary: "An enamel mug of tea that never goes cold.",
    shape: [
      ...prism("enamel", { r0: 0.04, r1: 0.043, y0: 0, y1: 0.095, sides: 12 }),
      ...prism("tea", { r0: 0.037, y0: 0.095, y1: 0.097, sides: 12 }),
      ...box("enamel", [0.056, 0.075, 0], [0.03, 0.008, 0.012]),
      ...box("enamel", [0.056, 0.03, 0], [0.03, 0.008, 0.012]),
      ...box("enamel", [0.071, 0.0525, 0], [0.008, 0.053, 0.012]),
    ],
  },
  {
    d: "lantern-seedling",
    title: "Lantern-tree seedling",
    summary: "A seedling of the Grove's lantern trees, in a clay pot. Its tip already glows.",
    shape: [
      ...prism("clay", { r0: 0.05, r1: 0.066, y0: 0, y1: 0.08, sides: 10 }),
      ...prism("soil", { r0: 0.058, y0: 0.08, y1: 0.083, sides: 10 }),
      ...prism("bark", { r0: 0.012, r1: 0.008, y0: 0.083, y1: 0.36, sides: 6 }),
      ...prism("leafDark", { r0: 0.11, r1: 0.03, y0: 0.17, y1: 0.225, sides: 6 }),
      ...prism("leaf", { r0: 0.085, r1: 0.022, y0: 0.25, y1: 0.305, sides: 6, turn: Math.PI / 6 }),
      ...prism("leafDark", { r0: 0.06, r1: 0.012, y0: 0.33, y1: 0.385, sides: 6 }),
      ...prism("glow", { r0: 0.014, r1: 0, y0: 0.385, y1: 0.42, sides: 4 }),
    ],
  },
  {
    d: "paper-pinwheel",
    title: "Paper pinwheel",
    summary: "A pinwheel of folded paper on a stick.",
    shape: [
      ...box("wood", [0, 0.17, 0], [0.012, 0.34, 0.012]),
      ...prism("brass", { r0: 0.012, y0: -0.006, y1: 0.006, sides: 8 }).map((t) => ({ ...t, points: t.points.map(([x, y, z]) => [x, z + 0.34, y + 0.016]) })),
      ...[0, 1, 2, 3].flatMap((i) => turned(box(i % 2 ? "teal" : "amber", [0.062, 0.34 + 0.02, 0.012], [0.11, 0.05, 0.003]), 20 + i * 90, [0, 0.34])),
    ],
  },
];

// ---------------------------------------------------------------- a binary glTF
function glb(shape) {
  const names = [...new Set(shape.map((t) => t.material))];
  const round = (x) => Math.round(x * 1e5) / 1e5;
  const json = { asset: { version: "2.0", generator: "nswp make-items" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [] }], materials: [], buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [] };
  const parts = [];
  let offset = 0;
  const view = (bytes, target) => {
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target });
    parts.push(new Uint8Array(bytes.buffer));
    offset += bytes.byteLength;
    return json.bufferViews.length - 1;
  };
  for (const name of names) {
    const m = M[name];
    const tris = shape.filter((t) => t.material === name);
    const pos = new Float32Array(tris.flatMap((t) => t.points.flat().map(round)));
    const nor = new Float32Array(tris.flatMap((t) => { const n = unit(cross(sub(t.points[1], t.points[0]), sub(t.points[2], t.points[0]))).map(round); return [...n, ...n, ...n]; }));
    const count = tris.length * 3;
    const xs = [0, 1, 2].map((i) => Array.from({ length: count }, (_, k) => pos[k * 3 + i]));
    json.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [...m.color, 1], metallicFactor: m.metal, roughnessFactor: m.rough }, ...(m.emit ? { emissiveFactor: m.emit } : {}) });
    json.accessors.push({ bufferView: view(pos, 34962), componentType: 5126, count, type: "VEC3", min: xs.map((x) => Math.min(...x)), max: xs.map((x) => Math.max(...x)) });
    json.accessors.push({ bufferView: view(nor, 34962), componentType: 5126, count, type: "VEC3" });
    json.meshes[0].primitives.push({ attributes: { POSITION: json.accessors.length - 2, NORMAL: json.accessors.length - 1 }, material: json.materials.length - 1 });
  }
  json.buffers[0].byteLength = offset;
  const pad = (bytes, fill) => {
    const padded = new Uint8Array(bytes.length + ((4 - (bytes.length % 4)) % 4)).fill(fill);
    padded.set(bytes);
    return padded;
  };
  const head = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const bin = new Uint8Array(offset);
  let at = 0;
  for (const p of parts) {
    bin.set(p, at);
    at += p.length;
  }
  const body = pad(bin, 0);
  const file = new Uint8Array(12 + 8 + head.length + 8 + body.length);
  const v = new DataView(file.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, file.length, true);
  v.setUint32(12, head.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  file.set(head, 20);
  v.setUint32(20 + head.length, body.length, true);
  v.setUint32(24 + head.length, 0x004e4942, true);
  file.set(body, 28 + head.length);
  return file;
}

// ---------------------------------------------------------------- a thing with parts that move
// The first five items are one still shape each, and are written exactly as they were: their files are named by
// their bytes, and those names are published. A thing with moving parts is written by this, apart: each part is a
// node of its own, and an animation moves the nodes.
function glbMoving(parts, clips, M) {
  const names = [...new Set(parts.flatMap((p) => p.shape.map((t) => t.material)))];
  const round = (x) => Math.round(x * 1e5) / 1e5;
  const json = {
    asset: { version: "2.0", generator: "nswp make-items" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "all", children: parts.filter((p) => !p.under).map((p) => parts.indexOf(p) + 1) }, ...parts.map((p) => ({ name: p.name, mesh: parts.indexOf(p), ...(parts.some((c) => c.under === p.name) ? { children: parts.filter((c) => c.under === p.name).map((c) => parts.indexOf(c) + 1) } : {}) }))],
    meshes: [],
    materials: names.map((name) => ({ name, pbrMetallicRoughness: { baseColorFactor: [...M[name].color, M[name].alpha ?? 1], metallicFactor: M[name].metal, roughnessFactor: M[name].rough }, ...(M[name].emit ? { emissiveFactor: M[name].emit } : {}), ...(M[name].alpha === undefined ? {} : { alphaMode: "BLEND" }) })),
    animations: [],
    buffers: [{ byteLength: 0 }],
    bufferViews: [],
    accessors: [],
  };
  const chunks = [];
  let offset = 0;
  const view = (bytes, target) => {
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, ...(target ? { target } : {}) });
    chunks.push(new Uint8Array(bytes.buffer));
    offset += bytes.byteLength;
    return json.bufferViews.length - 1;
  };
  for (const part of parts) {
    const mesh = { name: part.name, primitives: [] };
    for (const name of names) {
      const tris = part.shape.filter((t) => t.material === name);
      if (!tris.length) continue;
      const pos = new Float32Array(tris.flatMap((t) => t.points.flat().map(round)));
      // A shape that says which way each corner faces is shaded as round; one that doesn't, as flat faces.
      const nor = new Float32Array(tris.flatMap((t) => { if (t.normals) return t.normals.flat().map(round); const n = unit(cross(sub(t.points[1], t.points[0]), sub(t.points[2], t.points[0]))).map(round); return [...n, ...n, ...n]; }));
      const count = tris.length * 3;
      const xs = [0, 1, 2].map((i) => Array.from({ length: count }, (_, k) => pos[k * 3 + i]));
      json.accessors.push({ bufferView: view(pos, 34962), componentType: 5126, count, type: "VEC3", min: xs.map((x) => Math.min(...x)), max: xs.map((x) => Math.max(...x)) });
      json.accessors.push({ bufferView: view(nor, 34962), componentType: 5126, count, type: "VEC3" });
      mesh.primitives.push({ attributes: { POSITION: json.accessors.length - 2, NORMAL: json.accessors.length - 1 }, material: names.indexOf(name) });
    }
    json.meshes.push(mesh);
  }
  for (const clip of clips) {
    const animation = { name: clip.name, samplers: [], channels: [] };
    for (const move of clip.moves) {
      const times = new Float32Array(move.times);
      const values = new Float32Array(move.values.flat().map(round));
      json.accessors.push({ bufferView: view(times), componentType: 5126, count: times.length, type: "SCALAR", min: [Math.min(...times)], max: [Math.max(...times)] });
      json.accessors.push({ bufferView: view(values), componentType: 5126, count: move.values.length, type: move.path === "rotation" ? "VEC4" : "VEC3" });
      animation.samplers.push({ input: json.accessors.length - 2, output: json.accessors.length - 1, interpolation: "LINEAR" });
      animation.channels.push({ sampler: animation.samplers.length - 1, target: { node: parts.findIndex((p) => p.name === move.node) + 1, path: move.path } });
    }
    json.animations.push(animation);
  }
  json.buffers[0].byteLength = offset;
  const pad = (bytes, fill) => {
    const padded = new Uint8Array(bytes.length + ((4 - (bytes.length % 4)) % 4)).fill(fill);
    padded.set(bytes);
    return padded;
  };
  const head = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const bin = new Uint8Array(offset);
  let at = 0;
  for (const c of chunks) {
    bin.set(c, at);
    at += c.length;
  }
  const body = pad(bin, 0);
  const file = new Uint8Array(12 + 8 + head.length + 8 + body.length);
  const v = new DataView(file.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, file.length, true);
  v.setUint32(12, head.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  file.set(head, 20);
  v.setUint32(20 + head.length, body.length, true);
  v.setUint32(24 + head.length, 0x004e4942, true);
  file.set(body, 28 + head.length);
  return file;
}
/** A prism lying along z, from `z0` back to `z1`, at height `y`: a barrel. */
const along = (material, o) => prism(material, { r0: o.r0, r1: o.r1 ?? o.r0, y0: o.z0, y1: o.z1, sides: o.sides ?? 10 }).map((t) => ({ ...t, points: t.points.map(([x, y, z]) => [x, z + o.y, y]) }));
/** A turn about the x axis, as glTF says one: x, y, z, w. */
const tip = (degrees) => [Math.sin((degrees * Math.PI) / 360), 0, 0, Math.cos((degrees * Math.PI) / 360)];

// ---------------------------------------------------------------- the dart blaster
// A toy: bright plastic, and nothing about it like a firearm. It points away from whoever holds it (toward -z).
// What it does is its script's to say, below. Its sounds are the owner's to pick by ear before it is signed: until
// then it is a draft, written to drafts.json and signed by nobody.
// The blaster has materials of its own (blaster-model.mjs): the ones above belong to the items already published,
// whose files are named by their bytes, and are never touched.
const BLASTER_SCRIPT = `// Dart blaster: five darts, then a reload. There is no end of darts.
var FULL = 5;
var darts = FULL;
var busy = false;
function show() {
  item.show(busy ? "Reloading" : darts + " / " + FULL);
}
function reload() {
  if (busy || darts === FULL) return;
  busy = true;
  show();
  item.play("reload");
  item.clip("reload");
  item.after(1400, function () {
    darts = FULL;
    busy = false;
    show();
  });
}
item.on("held", function () {
  item.play("equip");
  show();
});
item.on("away", function () {
  item.play("unequip");
});
item.on("use", function () {
  if (busy) return;
  if (darts === 0) return reload();
  darts -= 1;
  item.send("dart", { speed: 14, stick: 3 });
  item.play("fire");
  item.clip("fire");
  show();
  if (darts === 0) reload();
});
item.on("second", reload);
`;

// ---------------------------------------------------------------- written out
mkdirSync(join(out, "models"), { recursive: true });
const described = [];
const made = new Set();
for (const item of ITEMS) {
  const points = item.shape.flatMap((t) => t.points);
  const span = [0, 1, 2].map((i) => [Math.min(...points.map((p) => p[i])), Math.max(...points.map((p) => p[i]))]);
  const mm = (x) => Math.round(x * 1000) / 1000;
  const size = span.map(([a, b]) => mm(b - a));
  const centre = span.map(([a, b]) => mm((a + b) / 2));
  const bytes = glb(item.shape);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(join(out, "models", `${sha256}.glb`), bytes);
  made.add(`${sha256}.glb`);
  described.push({
    d: item.d,
    title: item.title,
    summary: item.summary,
    model: { url: `${HOST}${sha256}.glb`, sha256 },
    size,
    colliders: [{ shape: "box", centre, size }],
    behaviors: ["holdable"],
    fits: ["place", "hand-left", "hand-right"],
  });
  console.log(`${item.d}: ${item.shape.length} triangles, ${bytes.length} bytes, ${size.join(" × ")} m, ${sha256.slice(0, 12)}…`);
}
writeFileSync(join(out, "items.json"), `${JSON.stringify(described, null, 2)}\n`);

// The drafts: described, and signed by nobody yet.
const keep = (bytes, ext) => {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(join(out, "models", `${sha256}.${ext}`), bytes);
  made.add(`${sha256}.${ext}`);
  return { url: `${HOST}${sha256}.${ext}`, sha256 };
};
const boxOf = (shape) => {
  const points = shape.flatMap((t) => t.points);
  return [0, 1, 2].map((i) => Math.round((Math.max(...points.map((p) => p[i])) - Math.min(...points.map((p) => p[i]))) * 1000) / 1000);
};
const blasterShape = BLASTER_PARTS.flatMap((p) => p.shape);
// Where its sight is, as the kit draws it: a model is stood on the middle of its base, so the point is said from there.
const sightAt = (() => {
  const points = blasterShape.flatMap((t) => t.points);
  const [lo, hi] = [0, 1, 2].reduce((acc, i) => [[...acc[0], Math.min(...points.map((p) => p[i]))], [...acc[1], Math.max(...points.map((p) => p[i]))]], [[], []]);
  const mm = (x) => Math.round(x * 1000) / 1000;
  return [mm(0 - (lo[0] + hi[0]) / 2), mm(BLASTER_SIGHT.v - lo[1]), mm(-BLASTER_SIGHT.u - (lo[2] + hi[2]) / 2)];
})();
// Sounds the owner has picked are kept beside the models, each under the name the script and the dart use.
// A sound may have more takes than one, named `<name>-2` up to `<name>-4`: the kit plays one of them each time.
const SOUND_NAMES = ["equip", "unequip", "reload", "fire", "impact", "impact-2", "fall", "hit", "tick"];
/** What the blaster needs before it is signed: one of each of these. */
const NEEDED = ["equip", "unequip", "reload", "fire", "impact", "fall", "hit", "tick"];
const picked = Object.fromEntries(SOUND_NAMES.filter((name) => existsSync(join(out, "sounds", `${name}.ogg`))).map((name) => [name, keep(readFileSync(join(out, "sounds", `${name}.ogg`)), "ogg")]));
const has = (name) => (picked[name] ? { [({ impact: "lands", fall: "drops", hit: "strikes", tick: "tells" })[name]]: name } : {});
const drafts = [
  {
    d: "dart-blaster",
    title: "Dart blaster",
    summary: "A toy blaster. Five foam darts, then a reload. Darts stick where they land for a moment, then drop off.",
    model: keep(glbMoving(BLASTER_PARTS, BLASTER_CLIPS, BLASTER_MATERIALS), "glb"),
    size: boxOf(blasterShape),
    behaviors: ["holdable"],
    fits: ["hand-left", "hand-right"],
    script: keep(new TextEncoder().encode(BLASTER_SCRIPT), "js"),
    ...(Object.keys(picked).length ? { sounds: picked } : {}),
    sends: [{ name: "dart", model: keep(glbMoving(DART_PARTS, [], BLASTER_MATERIALS), "glb"), size: boxOf(DART_PARTS[0].shape), ...has("impact"), ...has("fall"), ...has("hit"), ...has("tick"), trail: 0.22 }],
    effects: [{ of: "dart", state: "health", take: 1 }],
    does: { use: "Fire", second: "Reload" },
    // Aimed by its sight: an eye brought to that point sees a little narrower, as through a toy scope.
    aim: { at: sightAt, zoom: 0.6 },
    // Two colours are the holder's to choose: the rear, muzzle and magazine; and the darts, with everything that glows.
    tints: [
      { slot: "accent", label: "Accent", color: BLASTER_TINTS.accent },
      { slot: "dart", label: "Darts", color: BLASTER_TINTS.dart },
    ],
  },
];
// With every sound picked it is no longer a draft: it is written with the rest, to be signed. Until then it waits.
const ready = NEEDED.every((name) => picked[name]);
if (ready) {
  described.push(...drafts);
  writeFileSync(join(out, "items.json"), `${JSON.stringify(described, null, 2)}\n`);
}
writeFileSync(join(out, "drafts.json"), `${JSON.stringify(ready ? [] : drafts, null, 2)}\n`);
for (const d of drafts) console.log(`${ready ? "ready to sign" : "draft"} ${d.d}: ${d.size.join(" × ")} m, model ${d.model.sha256.slice(0, 12)}…, script ${d.script.sha256.slice(0, 12)}…, sounds: ${Object.keys(d.sounds ?? {}).join(", ") || "none picked yet"}`);
// A model no item names any more is still named by the bags that hold the older one: it is kept, and said.
const older = readdirSync(join(out, "models")).filter((f) => !made.has(f));
if (older.length) console.log(`kept, and named by no item now: ${older.join(", ")}`);
