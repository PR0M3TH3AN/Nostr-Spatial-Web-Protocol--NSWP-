// Writes the standard doorway's frame, as the reference kit models it (packages/sdk/src/models.ts, addArchFrame),
// to a Wavefront OBJ on standard output, for an engine that can't run the kit's own modelling code.
//
// What the kit's surface (alloy.ts) needs of each corner goes in the places an OBJ has for it:
//   v  x y z r g b    where it is, and its tone (the metal's own colour), as sRGB: an importer may keep a colour in
//                     eight bits, which is too few for a dark metal's light-linear numbers and enough for these
//   vt glow flow      how much of a light it is (0 to 1), and how far along its seam (metres)
//   vn x y z          which way it faces
//
// Run by scripts/build-engine.mjs. Not for running by hand.
import { MeshBuilder } from "../packages/sdk/src/mesh.js";
import { addArchFrame } from "../packages/sdk/src/models.js";

const b = new MeshBuilder().at();
addArchFrame(b);
const g = b.geometry();
const at = (name: string) => g.getAttribute(name).array as ArrayLike<number>;
const [p, n, tone, glow, flow] = [at("position"), at("normal"), at("tone"), at("glow"), at("flow")];
const f = (x: number) => {
  const s = x.toFixed(5).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};
// A light-linear amount as the number a screen is given for it.
const srgb = (x: number) => (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const count = p.length / 3;
const out: string[] = [
  "# The standard NSWP doorway's frame. Made from packages/sdk/src/models.ts by scripts/build-engine.mjs: change it there, not here.",
  "# v: place and tone (sRGB). vt: glow, flow. vn: facing. Metres, y up, the opening facing +z and -z.",
  "o nswp_gate_frame",
];
for (let i = 0; i < count; i++) out.push(`v ${f(p[i * 3]!)} ${f(p[i * 3 + 1]!)} ${f(p[i * 3 + 2]!)} ${f(srgb(tone[i * 3]!))} ${f(srgb(tone[i * 3 + 1]!))} ${f(srgb(tone[i * 3 + 2]!))}`);
for (let i = 0; i < count; i++) out.push(`vt ${f(glow[i]!)} ${f(flow[i]!)}`);
for (let i = 0; i < count; i++) out.push(`vn ${f(n[i * 3]!)} ${f(n[i * 3 + 1]!)} ${f(n[i * 3 + 2]!)}`);
const index = g.getIndex();
const corner = (i: number) => `${i + 1}/${i + 1}/${i + 1}`;
const faces = index ? index.count / 3 : count / 3;
for (let t = 0; t < faces; t++) {
  const [a, c, d] = index ? [index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2];
  out.push(`f ${corner(a)} ${corner(c)} ${corner(d)}`);
}
process.stdout.write(out.join("\n") + "\n");
