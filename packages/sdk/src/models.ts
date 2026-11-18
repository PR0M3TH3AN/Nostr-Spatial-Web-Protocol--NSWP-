/**
 * The pieces the reference places are made of, modelled with mesh.ts: the
 * doorway's frame, walls, furniture, and a few things to look at.
 *
 * Each is a function that adds itself to a builder, standing at the builder's
 * current place. So a whole room is still one mesh, however much is in it.
 * Sizes are in metres and match what a home layout expects (spec §4.5).
 */
import * as THREE from "three";
import type { Frame, MeshBuilder, P2, V3 } from "./mesh.js";

/** The doorway's opening, in metres. */
export const PORTAL_WIDTH = 1.5;
export const PORTAL_HEIGHT = 2.1;
const SPRING = PORTAL_HEIGHT - PORTAL_WIDTH / 2;

/**
 * The outline of the doorway's moulding, to sweep along a path: `hw` half its
 * width across the opening, `hd` half its depth, its corners cut by `bev`, and
 * a channel `c` to each side of the middle and `cd` deep let into its front and
 * its back. Paint it with `mouldingPaint`, which puts the light in the channels.
 */
export function mouldingProfile(hw: number, hd: number, bev: number, c: number, cd: number): P2[] {
  return [
    [-hw, -hd + bev], [-hw + bev, -hd], [-c, -hd], [-c, -hd + cd], [c, -hd + cd], [c, -hd], [hw - bev, -hd], [hw, -hd + bev],
    [hw, hd - bev], [hw - bev, hd], [c, hd], [c, hd - cd], [-c, hd - cd], [-c, hd], [-hw + bev, hd], [-hw, hd - bev],
  ];
}

export function mouldingPaint(side: number): { glow?: number; shade?: number } {
  if (side === 3 || side === 11) return { glow: 1 };
  if (side === 2 || side === 4 || side === 10 || side === 12) return { shade: 0.55 };
  if (side === 0 || side === 6 || side === 8 || side === 14) return { shade: 1.35 };
  return side === 15 ? { shade: 0.8 } : {};
}

/**
 * The doorway's frame: a moulding swept up one side, over the arch and down
 * the other, with a channel of light let into its face. It stands on two
 * blocks and a threshold, and has a keystone at the top.
 */
export function addArchFrame(b: MeshBuilder): void {
  const hw = 0.09; // half the moulding's width, across the opening
  const hd = 0.11; // half its depth, front to back
  const bev = 0.028;
  const R = PORTAL_WIDTH / 2 + hw;
  const foot = 0.2;
  const profile = mouldingProfile(hw, hd, bev, 0.017, 0.022);
  const frames: Frame[] = [];
  let t = 0;
  const add = (p: V3, x: V3) => {
    const prev = frames[frames.length - 1];
    if (prev) t += Math.hypot(p[0] - prev.p[0], p[1] - prev.p[1]);
    frames.push({ p, x, y: [0, 0, 1], t });
  };
  add([-R, foot, 0], [-1, 0, 0]);
  const STEPS = 30;
  for (let i = 0; i <= STEPS; i++) {
    const a = Math.PI - (i / STEPS) * Math.PI;
    add([Math.cos(a) * R, SPRING + Math.sin(a) * R, 0], [Math.cos(a), Math.sin(a), 0]);
  }
  add([R, foot, 0], [1, 0, 0]);
  b.sweep(profile, frames, mouldingPaint);

  // What it stands on: a block under each side, and a threshold between them with a line of light along its edge.
  for (const x of [-R, R]) {
    b.box([0.3, foot, 0.36], [x, foot / 2, 0], { bevel: 0.025, panel: { margin: 0.05, depth: 0.018, faces: "z+ z-" } });
    b.box([0.34, 0.03, 0.4], [x, foot + 0.005, 0], { bevel: 0.01, shade: 1.3 });
  }
  b.box([PORTAL_WIDTH + 0.02, 0.05, 0.42], [0, 0.025, 0], { bevel: 0.015 });
  b.line([-PORTAL_WIDTH / 2, 0.051, 0.17], [PORTAL_WIDTH / 2, 0.051, 0.17], 0.03, [0, 1, 0]);
  b.line([-PORTAL_WIDTH / 2, 0.051, -0.17], [PORTAL_WIDTH / 2, 0.051, -0.17], 0.03, [0, 1, 0]);

  // A block where each side's arch begins, and the keystone, marked with a point of light.
  for (const x of [-R, R]) b.box([0.24, 0.1, 0.28], [x, SPRING, 0], { bevel: 0.02, shade: 1.2 });
  const top = SPRING + R;
  b.box([0.24, 0.26, 0.28], [0, top + 0.02, 0], { bevel: 0.03, shade: 1.15 });
  for (const z of [0.141, -0.141])
    b.quad([0, top + 0.09, z], [0.05, top + 0.02, z], [0, top - 0.05, z], [-0.05, top + 0.02, z], { glow: 1 }, [0, 0, z > 0 ? 1 : -1]);
}

/** A run of wall, `length` long and `height` high, standing along x with its face to +Z. Bays of panels between posts with a seam of light. */
export function addWall(b: MeshBuilder, length: number, height: number, o: { color?: THREE.ColorRepresentation } = {}): void {
  const bays = Math.max(1, Math.round(length / 2));
  const bay = length / bays;
  const paint = { color: o.color };
  b.box([length, 0.2, 0.3], [0, 0.1, 0], { ...paint, bevel: 0.03, shade: 1.15 });
  b.box([length, 0.14, 0.34], [0, height - 0.07, 0], { ...paint, bevel: 0.03, shade: 1.2 });
  b.line([-length / 2, 0.205, 0.13], [length / 2, 0.205, 0.13], 0.025, [0, 1, 0], { glow: 0.9 });
  for (let i = 0; i < bays; i++) {
    const x = -length / 2 + bay * (i + 0.5);
    b.box([bay - 0.16, height - 0.34, 0.16], [x, height / 2, 0], { ...paint, bevel: 0.02, panel: { margin: 0.16, depth: 0.035, faces: "z+" } });
    // A smaller panel within the first, and a short bar of light near the top of each bay.
    b.box([bay - 0.9, 0.05, 0.02], [x, height - 0.62, 0.062], { glow: 0.55 });
  }
  for (let i = 0; i <= bays; i++) {
    const x = -length / 2 + bay * i;
    b.box([0.16, height - 0.3, 0.26], [x, height / 2, 0.02], { ...paint, bevel: 0.025, shade: 1.1 });
    b.line([x, 0.24, 0.151], [x, height - 0.2, 0.151], 0.022, [0, 0, 1], { glow: 0.8 });
  }
}

export function addPlinth(b: MeshBuilder): void {
  b.box([0.7, 0.08, 0.7], [0, 0.04, 0], { bevel: 0.02, shade: 1.15 });
  b.box([0.54, 0.76, 0.54], [0, 0.46, 0], { bevel: 0.02, panel: { margin: 0.07, depth: 0.02 } });
  b.box([0.46, 0.04, 0.46], [0, 0.86, 0], { glow: 0.85 });
  b.box([0.66, 0.1, 0.66], [0, 0.95, 0], { bevel: 0.03, shade: 1.2 });
}

export function addBench(b: MeshBuilder, soft: THREE.ColorRepresentation): void {
  b.box([1.4, 0.07, 0.46], [0, 0.45, 0], { bevel: 0.02, color: soft });
  b.line([-0.66, 0.412, 0.2], [0.66, 0.412, 0.2], 0.018, [0, -1, 0], { glow: 0.9 });
  // The back is on the far side, so someone sitting faces +Z like everything else: slats under a rail.
  for (let i = 0; i < 6; i++) b.box([0.17, 0.3, 0.03], [-0.575 + i * 0.23, 0.69, -0.2], { bevel: 0.008, color: soft });
  b.box([1.4, 0.05, 0.06], [0, 0.88, -0.2], { bevel: 0.015, shade: 1.2 });
  for (const x of [-0.64, 0.64]) {
    b.box([0.05, 0.86, 0.05], [x, 0.45, -0.2], { bevel: 0.012 });
    b.box([0.05, 0.42, 0.05], [x, 0.21, 0.18], { bevel: 0.012 });
    b.box([0.06, 0.04, 0.46], [x, 0.02, 0], { bevel: 0.01, shade: 1.2 });
    b.box([0.05, 0.035, 0.36], [x, 0.4, 0], { bevel: 0.008 });
  }
}

export function addTable(b: MeshBuilder, soft: THREE.ColorRepresentation): void {
  b.box([1.2, 0.05, 0.7], [0, 0.725, 0], { bevel: 0.018, color: soft });
  // A line of light let into the top, a hand's width in from the edge.
  const y = 0.751;
  const [x, z] = [0.5, 0.25];
  b.line([-x, y, z], [x, y, z], 0.014, [0, 1, 0]);
  b.line([x, y, z], [x, y, -z], 0.014, [0, 1, 0]);
  b.line([x, y, -z], [-x, y, -z], 0.014, [0, 1, 0]);
  b.line([-x, y, -z], [-x, y, z], 0.014, [0, 1, 0]);
  b.box([1.06, 0.07, 0.56], [0, 0.665, 0], { bevel: 0.012, shade: 0.8 });
  for (const [lx, lz] of [[-0.5, -0.24], [0.5, -0.24], [-0.5, 0.24], [0.5, 0.24]] as const)
    b.lathe([[0.022, 0], [0.03, 0.04], [0.04, 0.63]], [lx, 0, lz], 4, () => ({ shade: 1.1 }), { turn: Math.PI / 4 });
}

export function addLamp(b: MeshBuilder): void {
  b.lathe([[0.21, 0], [0.21, 0.03], [0.1, 0.07], [0.035, 0.11]], [0, 0, 0], 8, (row) => ({ shade: row === 1 ? 1.3 : 1 }));
  b.lathe([[0.03, 0.11], [0.022, 1.42]], [0, 0, 0], 6);
  b.lathe([[0.022, 1.42], [0.15, 1.46], [0.15, 1.49], [0.13, 1.49]], [0, 0, 0], 8, () => ({ shade: 1.2 }));
  // The lantern: a cage of four ribs round a light, under a cap.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.box([0.022, 0.3, 0.022], [Math.cos(a) * 0.13, 1.64, Math.sin(a) * 0.13], { bevel: 0.005 });
  }
  b.lathe([[0.001, 1.5], [0.085, 1.64], [0.001, 1.78]], [0, 0, 0], 4, () => ({ glow: 1 }), { turn: Math.PI / 4 });
  b.lathe([[0.16, 1.79], [0.16, 1.82], [0.06, 1.88], [0.001, 1.9]], [0, 0, 0], 8, () => ({ shade: 1.2 }));
}

/** A planter with a spray of blades growing from it, their tips lit. */
export function addPlant(b: MeshBuilder, soft: THREE.ColorRepresentation, seed = 1): void {
  b.lathe([[0.17, 0], [0.25, 0.32], [0.27, 0.34], [0.27, 0.37], [0.22, 0.37]], [0, 0, 0], 4, (row) => ({ shade: row >= 2 ? 1.3 : 1 }), { turn: Math.PI / 4 });
  b.line([-0.2, 0.2, 0.211], [0.2, 0.2, 0.211], 0.016, [0, 0, 1], { glow: 0.7 });
  b.line([0.2, 0.2, -0.211], [-0.2, 0.2, -0.211], 0.016, [0, 0, -1], { glow: 0.7 });
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const blades = 11;
  for (let i = 0; i < blades; i++) {
    const turn = (i / blades) * Math.PI * 2 + rand() * 0.5;
    const lean = 0.18 + rand() * 0.75; // how far it falls outward
    const long = 0.55 + rand() * 0.5;
    const wide = 0.07 + rand() * 0.04;
    const [cx, cz] = [Math.cos(turn), Math.sin(turn)];
    const out = (d: number, h: number, side: number): V3 => [cx * d - cz * side, 0.37 + h, cz * d + cx * side];
    const base = out(0.05, 0, 0);
    const mid = long * 0.55;
    const [l, r] = [out(Math.sin(lean) * mid, Math.cos(lean) * mid, wide), out(Math.sin(lean) * mid, Math.cos(lean) * mid, -wide)];
    const keel = out(Math.sin(lean) * mid * 0.86, Math.cos(lean) * mid * 0.86 - 0.03, 0);
    const tip = out(Math.sin(lean * 1.25) * long, Math.cos(lean * 1.25) * long, 0);
    const up: V3 = [cx * Math.cos(lean), Math.sin(lean), cz * Math.cos(lean)];
    const down: V3 = [-up[0], -up[1], -up[2]];
    // Each blade is folded along its keel: two faces above, two below, and a lit tip.
    b.tri(base, l, keel, { color: soft, shade: 1.15 }, up);
    b.tri(base, keel, r, { color: soft, shade: 0.9 }, up);
    b.tri(l, tip, keel, { color: soft, shade: 1.3, glow: 0.12 }, up);
    b.tri(keel, tip, r, { color: soft, shade: 1.05, glow: 0.12 }, up);
    b.tri(base, l, keel, { color: soft, shade: 0.6 }, down);
    b.tri(base, keel, r, { color: soft, shade: 0.5 }, down);
    b.tri(l, tip, keel, { color: soft, shade: 0.7 }, down);
    b.tri(keel, tip, r, { color: soft, shade: 0.6 }, down);
  }
}

/** The border of a picture: `w` by `h` inside, centred on the builder's place, facing +Z. */
export function addPictureFrame(b: MeshBuilder, w: number, h: number): void {
  const bar = 0.07;
  b.box([w + bar * 2, bar, 0.06], [0, h / 2 + bar / 2, 0], { bevel: 0.014, shade: 1.15 });
  b.box([w + bar * 2, bar, 0.06], [0, -h / 2 - bar / 2, 0], { bevel: 0.014, shade: 1.15 });
  b.box([bar, h, 0.06], [-w / 2 - bar / 2, 0, 0], { bevel: 0.014, shade: 1.15 });
  b.box([bar, h, 0.06], [w / 2 + bar / 2, 0, 0], { bevel: 0.014, shade: 1.15 });
  b.box([w + 0.02, h + 0.02, 0.02], [0, 0, -0.02], { shade: 0.5 });
  b.line([-w / 2, -h / 2 - bar - 0.001, 0.02], [w / 2, -h / 2 - bar - 0.001, 0.02], 0.014, [0, -1, 0], { glow: 0.8 });
}

/** Frames for sweeping a profile round a closed curve. `at(u)` gives a point for u from 0 to 1. */
export function loopFrames(at: (u: number) => V3, steps: number): Frame[] {
  const pts = Array.from({ length: steps }, (_, i) => new THREE.Vector3(...at(i / steps)));
  const middle = pts.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / steps);
  let length = 0;
  return pts.map((p, i) => {
    const next = pts[(i + 1) % steps]!;
    const prev = pts[(i + steps - 1) % steps]!;
    const tangent = next.clone().sub(prev).normalize();
    // Across the path: away from the middle of the whole curve, squared up to the direction of travel.
    const away = p.clone().sub(middle);
    const y = tangent.clone().cross(away).normalize();
    const x = y.clone().cross(tangent).normalize();
    if (i > 0) length += p.distanceTo(prev);
    return { p: [p.x, p.y, p.z], x: [x.x, x.y, x.z], y: [y.x, y.y, y.z], t: length };
  });
}

/** A flattened band, for a ribbon: `wide` across and `thick` through, with its edges eased and a seam of light along the outside. */
export function bandProfile(wide: number, thick: number): P2[] {
  const [w, t, e] = [wide / 2, thick / 2, Math.min(thick, wide) * 0.3];
  return [[-t, -w + e], [-t + e, -w], [t - e, -w], [t, -w + e], [t, -0.012], [t + 0.004, -0.012], [t + 0.004, 0.012], [t, 0.012], [t, w - e], [t - e, w], [-t + e, w], [-t, w - e]];
}

/** The metal a place's things are made of: a few shades up from its ground, so they stand out from it. */
export function metalTone(ground: THREE.ColorRepresentation): THREE.Color {
  return new THREE.Color(ground).multiplyScalar(2.4).lerp(new THREE.Color(0x16222e), 0.5);
}

/**
 * A ribbon tied in a knot, `size` across, centred on the builder's place, with
 * a seam of light round its outside. `p` and `q` choose the knot: 2 and 3 is a
 * trefoil, 2 and 5 a cinquefoil, 3 and 4 something busier.
 */
export function addKnot(b: MeshBuilder, size = 0.7, p = 2, q = 3): void {
  // A torus knot: p times round the hole while q times through it.
  const [R, r] = [1, 0.48];
  const k = size / (2 * (R + r));
  const frames = loopFrames((u) => {
    const t = u * Math.PI * 2;
    const out = R + r * Math.cos(q * t);
    return [out * Math.cos(p * t) * k, out * Math.sin(p * t) * k, r * Math.sin(q * t) * k * 1.3];
  }, 60 * Math.max(p, q));
  const wide = size * (q > 3 ? 0.1 : 0.14);
  b.sweep(bandProfile(wide, size * 0.04), frames, (side) => (side === 5 ? { glow: 1 } : side === 1 || side === 9 ? { shade: 1.35 } : side === 11 || side === 0 || side === 10 ? { shade: 0.75 } : {}), { loop: true });
}

/** Two ribbons winding round each other as they rise, `size` high, centred on the builder's place. */
export function addHelix(b: MeshBuilder, size = 0.8): void {
  const radius = size * 0.2;
  const turns = 1.5;
  const steps = 64;
  for (const start of [0, Math.PI]) {
    const frames: Frame[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = start + u * turns * Math.PI * 2;
      // Thinner at the ends, so the pair closes to a point top and bottom.
      const out = radius * (0.25 + 0.75 * Math.sin(u * Math.PI));
      const x = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const travel = new THREE.Vector3(-Math.sin(a) * out * turns * Math.PI * 2, size, Math.cos(a) * out * turns * Math.PI * 2).normalize();
      const y = travel.clone().cross(x).normalize();
      frames.push({ p: [x.x * out, size * (u - 0.5), x.z * out], x: [x.x, x.y, x.z], y: [y.x, y.y, y.z], t: u * size * 3 });
    }
    b.sweep(bandProfile(size * 0.1, size * 0.03), frames, (side) => (side === 5 ? { glow: 1 } : side === 1 || side === 9 ? { shade: 1.35 } : side >= 10 || side === 0 ? { shade: 0.7 } : {}));
  }
  // Rungs between them, every so often, each a bar of light.
  for (let i = 1; i < 9; i++) {
    const u = i / 9;
    const a = u * turns * Math.PI * 2;
    const out = radius * (0.25 + 0.75 * Math.sin(u * Math.PI));
    b.place(new THREE.Matrix4().makeRotationY(-a).setPosition(0, size * (u - 0.5), 0));
    b.box([out * 2, size * 0.012, size * 0.012], [0, 0, 0], { glow: 0.8 });
  }
  b.at();
}

/** Three hoops, one inside another and each tipped a different way, round a point of light. */
export function addGyro(b: MeshBuilder, size = 0.7): void {
  const hoops: [number, V3, V3][] = [
    [0.5, [1, 0, 0], [0, 1, 0]],
    [0.39, [0, 0, 1], [0.34, 0.94, 0]],
    [0.28, [0.8, 0, 0.6], [-0.3, 0.87, 0.4]],
  ];
  for (const [radius, e1raw, e2raw] of hoops) {
    const e1 = new THREE.Vector3(...e1raw).normalize();
    const n = e1.clone().cross(new THREE.Vector3(...e2raw)).normalize();
    const e2 = n.clone().cross(e1);
    const frames: Frame[] = [];
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const out = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));
      frames.push({ p: [out.x * radius * size, out.y * radius * size, out.z * radius * size], x: [out.x, out.y, out.z], y: [-n.x, -n.y, -n.z], t: a * radius * size });
    }
    b.sweep(bandProfile(size * 0.075, size * 0.03), frames, (side) => (side === 5 ? { glow: 1 } : side === 1 || side === 9 ? { shade: 1.35 } : side >= 10 || side === 0 ? { shade: 0.7 } : {}), { loop: true });
  }
  const r = size * 0.1;
  b.lathe([[0.0005, -r * 1.5], [r, 0], [0.0005, r * 1.5]], [0, 0, 0], 4, () => ({ glow: 0.9 }));
}

/** A cluster of crystals growing from one root, the tallest in the middle. About `size` high, standing on the builder's place. */
export function addCrystal(b: MeshBuilder, size = 0.8, seed = 1, at: V3 = [0, 0, 0], degrees = 0): void {
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const base = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(degrees)).setPosition(...at);
  const shard = (lean: number, turn: number, long: number, thick: number, sides: number) => {
    const m = new THREE.Matrix4().makeRotationY(turn).multiply(new THREE.Matrix4().makeRotationZ(lean));
    b.place(base.clone().multiply(m));
    const lit = 0.1 + rand() * 0.15;
    b.lathe([[0.0005, 0], [thick, long * 0.1], [thick * 0.92, long * 0.72], [0.0005, long]], [0, 0, 0], sides, (row) => (row === 2 ? { shade: 1.5, glow: lit } : row === 0 ? { shade: 0.7 } : { shade: 0.95 + rand() * 0.3 }), { turn: rand() * 3 });
  };
  shard(0.04, 0, size, size * 0.13, 6);
  const more = 6;
  for (let i = 0; i < more; i++) shard(0.35 + rand() * 0.5, (i / more) * Math.PI * 2 + rand() * 0.6, size * (0.35 + rand() * 0.4), size * (0.05 + rand() * 0.045), 5);
}

/**
 * A tower of square frames, each turned a little further than the one below
 * and widest at the middle, so its corners draw four spirals. Every third
 * frame is lit. About `size` high, centred on the builder's place.
 */
export function addSpiral(b: MeshBuilder, size = 0.8): void {
  const count = 17;
  const bar = size * 0.02;
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const half = size * (0.1 + 0.2 * Math.sin(u * Math.PI));
    b.place(new THREE.Matrix4().makeRotationY(u * 2.4).setPosition(0, size * (u - 0.5), 0));
    const lit = i % 3 === 1 ? { glow: 0.9 } : { bevel: bar * 0.3, shade: 1 + (i % 2) * 0.25 };
    for (const k of [1, -1]) {
      b.box([half * 2 + bar, bar, bar], [0, 0, k * half], lit);
      b.box([bar, bar, half * 2 - bar], [k * half, 0, 0], lit);
    }
  }
  // What holds them: a thin spine up the middle, and a point of light at each end.
  b.at();
  b.lathe([[size * 0.012, -size * 0.5], [size * 0.012, size * 0.5]], [0, 0, 0], 4);
  for (const k of [1, -1]) b.lathe([[0.0005, k * size * 0.5 - size * 0.05], [size * 0.035, k * size * 0.5], [0.0005, k * size * 0.5 + size * 0.05]], [0, 0, 0], 4, () => ({ glow: 1 }));
}

/**
 * A tree: a trunk that turns a little as it rises, and tiers of leaves, each
 * edged with light and lit a little from beneath, like a lantern. `leaf` is the leaves' colour.
 */
export function addTree(b: MeshBuilder, leaf: THREE.ColorRepresentation, seed = 1, tall = 2.4): void {
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const turn = rand() * Math.PI;
  b.lathe([[0.2, 0], [0.13, 0.22], [0.1, tall * 0.5], [0.07, tall]], [0, 0, 0], 6, (row) => ({ shade: row === 0 ? 1.2 : 0.9 }), { twist: 0.9, turn });
  // Roots: a few low fins where the trunk meets the ground.
  for (let i = 0; i < 3; i++) {
    const a = turn + (i / 3) * Math.PI * 2;
    const [cx, cz] = [Math.cos(a), Math.sin(a)];
    const side: V3 = [-cz * 0.05, 0, cx * 0.05];
    for (const k of [1, -1])
      b.tri([cx * 0.14 + side[0] * k, 0, cz * 0.14 + side[2] * k], [cx * 0.42, 0, cz * 0.42], [cx * 0.12, 0.3, cz * 0.12], { shade: k > 0 ? 1.1 : 0.8 }, [side[0] * k, 0.02, side[2] * k]);
  }
  const tiers = 3 + (seed % 2);
  let y = tall * 0.58;
  for (let i = 0; i < tiers; i++) {
    const u = i / tiers;
    const r = (1.02 - u * 0.7) * (0.9 + rand() * 0.2);
    const high = 0.62 - u * 0.12;
    b.lathe(
      [[r * 0.2, y + 0.06], [r, y], [r * 0.985, y + 0.035], [r * 0.42, y + high * 0.6], [0.03, y + high]],
      [0, 0, 0],
      7,
      (row) => (row === 0 ? { color: leaf, glow: 0.22, shade: 1.2 } : row === 1 ? { glow: 0.9 } : { color: leaf, shade: row === 2 ? 1 : 0.7 }),
      { turn: turn + i * 0.45 },
    );
    y += high * 0.62;
  }
  b.lathe([[0.0005, y + 0.16], [0.07, y + 0.27], [0.0005, y + 0.4]], [0, 0, 0], 4, () => ({ glow: 1 }), { turn });
}
