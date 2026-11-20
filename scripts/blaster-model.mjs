// The dart blaster's shape (protocol/17-items.md), made in code: a rounded toy of cream plastic with a coloured
// rear, muzzle and magazine, a grip, a flip-up sight, a chamber that glows, and a clear magazine with darts in it.
//
// It is drawn in a side view and given its width: `u` runs forward along the barrel, `v` up, `x` across. A model
// points away from whoever holds it, which is toward -z, so a point (u, v, x) is written out as [x, v, -u].
//
// Two of its materials are for the holder to colour (`tint:accent`, `tint:dart`): the kit recolours any material
// whose name begins "tint:" with what the holder chose, or leaves it as it is here.
//
// Every shape is a list of triangles, each with a material's name, three points, and where it is curved, the way
// each corner faces, so that a round thing is shaded as round.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
/** A place in the side view, as the model has it. And a direction. */
const at = (u, v, x = 0) => [x, v, -u];
const way = (du, dv, dx = 0) => unit([dx, dv, -du]);

/** One triangle, turned so that it faces the way its corners say it does. */
function face(material, points, normals) {
  const n = cross(sub(points[1], points[0]), sub(points[2], points[0]));
  if (Math.hypot(...n) < 1e-12) return [];
  const toward = [normals[0][0] + normals[1][0] + normals[2][0], normals[0][1] + normals[1][1] + normals[2][1], normals[0][2] + normals[1][2] + normals[2][2]];
  return dot(n, toward) >= 0 ? [{ material, points, normals }] : [{ material, points: [points[0], points[2], points[1]], normals: [normals[0], normals[2], normals[1]] }];
}
const quad = (material, [a, b, c, d], [na, nb, nc, nd]) => [...face(material, [a, b, c], [na, nb, nc]), ...face(material, [a, c, d], [na, nc, nd])];

/** An outline with its corners rounded: `pts` go round anticlockwise in the side view, and it bulges nowhere inward. */
export function rounded(pts, radius, steps = 4) {
  const out = [];
  pts.forEach((b, i) => {
    const a = pts[(i + pts.length - 1) % pts.length];
    const c = pts[(i + 1) % pts.length];
    const r = Array.isArray(radius) ? radius[i] : radius;
    const d1 = [a[0] - b[0], a[1] - b[1]];
    const d2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(...d1);
    const l2 = Math.hypot(...d2);
    const e1 = [d1[0] / l1, d1[1] / l1];
    const e2 = [d2[0] / l2, d2[1] / l2];
    const half = Math.acos(Math.max(-1, Math.min(1, e1[0] * e2[0] + e1[1] * e2[1]))) / 2;
    const reach = Math.min(r / Math.tan(half), l1 / 2.05, l2 / 2.05);
    const rr = reach * Math.tan(half);
    if (!(rr > 1e-5)) return void out.push(b);
    const mid = unit([e1[0] + e2[0], e1[1] + e2[1], 0]);
    const o = [b[0] + (mid[0] * rr) / Math.sin(half), b[1] + (mid[1] * rr) / Math.sin(half)];
    const p1 = [b[0] + e1[0] * reach, b[1] + e1[1] * reach];
    const p2 = [b[0] + e2[0] * reach, b[1] + e2[1] * reach];
    let a1 = Math.atan2(p1[1] - o[1], p1[0] - o[0]);
    let a2 = Math.atan2(p2[1] - o[1], p2[0] - o[0]);
    while (a2 - a1 > Math.PI) a2 -= Math.PI * 2;
    while (a2 - a1 < -Math.PI) a2 += Math.PI * 2;
    for (let k = 0; k <= steps; k++) {
      const t = a1 + ((a2 - a1) * k) / steps;
      out.push([o[0] + Math.cos(t) * rr, o[1] + Math.sin(t) * rr]);
    }
  });
  return out;
}

/** A slab: an outline in the side view, given a width, with its edges rounded over. */
export function slab(material, outline, half, bevel = 0.004, steps = 3, x0 = 0) {
  const n = outline.length;
  // Which way each corner of the outline faces, in the side view.
  const facing = outline.map((p, i) => {
    const a = outline[(i + n - 1) % n];
    const c = outline[(i + 1) % n];
    const e1 = unit([p[1] - a[1], -(p[0] - a[0]), 0]);
    const e2 = unit([c[1] - p[1], -(c[0] - p[0]), 0]);
    return unit([e1[0] + e2[0], e1[1] + e2[1], 0]);
  });
  const middle = [outline.reduce((s, p) => s + p[0], 0) / n, outline.reduce((s, p) => s + p[1], 0) / n];
  const tris = [];
  const b = Math.min(bevel, half * 0.9);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // The wall round the middle.
    tris.push(
      ...quad(
        material,
        [at(outline[i][0], outline[i][1], x0 - (half - b)), at(outline[j][0], outline[j][1], x0 - (half - b)), at(outline[j][0], outline[j][1], x0 + (half - b)), at(outline[i][0], outline[i][1], x0 + (half - b))],
        [way(facing[i][0], facing[i][1]), way(facing[j][0], facing[j][1]), way(facing[j][0], facing[j][1]), way(facing[i][0], facing[i][1])],
      ),
    );
    for (const side of [-1, 1]) {
      // The edge rounded over, in a few steps, to the flat of the side.
      for (let k = 0; k < steps; k++) {
        const ring = (kk, q) => {
          const a = ((kk / steps) * Math.PI) / 2;
          const inset = b * (1 - Math.cos(a));
          return { p: at(outline[q][0] - facing[q][0] * inset, outline[q][1] - facing[q][1] * inset, x0 + side * (half - b + b * Math.sin(a))), n: way(facing[q][0] * Math.cos(a), facing[q][1] * Math.cos(a), side * Math.sin(a)) };
        };
        const [p, q, r, s] = [ring(k, i), ring(k, j), ring(k + 1, j), ring(k + 1, i)];
        tris.push(...quad(material, [p.p, q.p, r.p, s.p], [p.n, q.n, r.n, s.n]));
      }
      // And the flat of the side.
      const flat = (q) => at(outline[q][0] - facing[q][0] * b, outline[q][1] - facing[q][1] * b, x0 + side * half);
      const out = way(0, 0, side);
      tris.push(...face(material, [at(middle[0], middle[1], x0 + side * half), flat(i), flat(j)], [out, out, out]));
    }
  }
  return tris;
}

/** A round thing lying along the barrel: from `u0` to `u1`, of one radius at each end, with its ends closed or not. */
export function tube(material, { u0, u1, r0, r1 = r0, v, x = 0, sides = 20, ends = [true, true], flat = false }) {
  const tris = [];
  const ring = (u, r, i) => {
    const a = (i / sides) * Math.PI * 2;
    return { p: at(u, v + Math.cos(a) * r, x + Math.sin(a) * r), n: way(flat ? 0 : (r0 - r1) / Math.max(1e-6, Math.abs(u1 - u0)) * 0.6, Math.cos(a), Math.sin(a)) };
  };
  for (let i = 0; i < sides; i++) {
    const [a, b, c, d] = [ring(u0, r0, i), ring(u0, r0, i + 1), ring(u1, r1, i + 1), ring(u1, r1, i)];
    tris.push(...quad(material, [a.p, b.p, c.p, d.p], [a.n, b.n, c.n, d.n]));
    if (ends[0] && r0 > 0) tris.push(...face(material, [at(u0, v, x), a.p, b.p], [way(-1, 0), way(-1, 0), way(-1, 0)]));
    if (ends[1] && r1 > 0) tris.push(...face(material, [at(u1, v, x), d.p, c.p], [way(1, 0), way(1, 0), way(1, 0)]));
  }
  return tris;
}

/** A round thing lying across: a hinge. */
export function axle(material, { u, v, r, half, sides = 14 }) {
  const tris = [];
  const ring = (x, i) => {
    const a = (i / sides) * Math.PI * 2;
    return { p: at(u + Math.cos(a) * r, v + Math.sin(a) * r, x), n: way(Math.cos(a), Math.sin(a)) };
  };
  for (let i = 0; i < sides; i++) {
    const [a, b, c, d] = [ring(-half, i), ring(-half, i + 1), ring(half, i + 1), ring(half, i)];
    tris.push(...quad(material, [a.p, b.p, c.p, d.p], [a.n, b.n, c.n, d.n]));
    for (const side of [-1, 1]) tris.push(...face(material, [at(u, v, side * half), ring(side * half, i).p, ring(side * half, i + 1).p], [way(0, 0, side), way(0, 0, side), way(0, 0, side)]));
  }
  return tris;
}

/** A rod bent along part of a circle, in the side view: a trigger guard. */
export function hoop(material, { u, v, radius, from, to, r, along = 12, round = 8 }) {
  const tris = [];
  const point = (i, k) => {
    const t = ((from + ((to - from) * i) / along) * Math.PI) / 180;
    const a = (k / round) * Math.PI * 2;
    const out = [Math.cos(t), Math.sin(t)];
    return { p: at(u + out[0] * (radius + Math.cos(a) * r), v + out[1] * (radius + Math.cos(a) * r), Math.sin(a) * r), n: way(out[0] * Math.cos(a), out[1] * Math.cos(a), Math.sin(a)) };
  };
  for (let i = 0; i < along; i++) {
    for (let k = 0; k < round; k++) {
      const [a, b, c, d] = [point(i, k), point(i + 1, k), point(i + 1, k + 1), point(i, k + 1)];
      tris.push(...quad(material, [a.p, b.p, c.p, d.p], [a.n, b.n, c.n, d.n]));
    }
  }
  return tris;
}

/** A flat mark on each side of a slab: an outline in the side view, just proud of the surface at `x`. */
export function mark(material, outline, x) {
  const middle = [outline.reduce((s, p) => s + p[0], 0) / outline.length, outline.reduce((s, p) => s + p[1], 0) / outline.length];
  const tris = [];
  for (const side of [-1, 1]) {
    const out = way(0, 0, side);
    outline.forEach((p, i) => {
      const q = outline[(i + 1) % outline.length];
      tris.push(...face(material, [at(middle[0], middle[1], side * x), at(p[0], p[1], side * x), at(q[0], q[1], side * x)], [out, out, out]));
    });
  }
  return tris;
}

/** A stripe that follows a line across the side, wider at one end than the other. */
export function stripe(material, line, widths, x) {
  const tris = [];
  const edge = (i, sign) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const across = unit([-(b[1] - a[1]), b[0] - a[0], 0]);
    const w = widths[0] + ((widths[1] - widths[0]) * i) / (line.length - 1);
    return [line[i][0] + (across[0] * w * sign) / 2, line[i][1] + (across[1] * w * sign) / 2];
  };
  for (let i = 0; i + 1 < line.length; i++) tris.push(...mark(material, [edge(i, -1), edge(i + 1, -1), edge(i + 1, 1), edge(i, 1)], x));
  return tris;
}
/** A smooth line through a few points, as many more. */
const curve = (pts, steps = 6) => {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [p0, p1, p2, p3] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t * t * t)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};
const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

// ---------------------------------------------------------------- what it is made of
/** A colour as it is written for a screen, as glTF wants it: in linear light. */
const hex = (h) => [1, 3, 5].map((i) => {
  const c = parseInt(h.slice(i, i + 2), 16) / 255;
  return Math.round((c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * 1e4) / 1e4;
});
/** The colours the holder's two choices start from. The kit reads them from here too (`tint` in the description). */
export const TINTS = { accent: "#f2691c", dart: "#35f0e0" };
export const MATERIALS = {
  cream: { color: hex("#f4e7cd"), metal: 0, rough: 0.42 },
  teal: { color: hex("#12898b"), metal: 0, rough: 0.4 },
  // The holder's own colour for the rear, the muzzle and the magazine. Orange, unless they say otherwise.
  "tint:accent": { color: hex(TINTS.accent), metal: 0, rough: 0.4 },
  // The holder's own colour for the darts, and for everything about the blaster that glows.
  "tint:dart": { color: hex(TINTS.dart), metal: 0, rough: 0.5, emit: hex(TINTS.dart) },
  yellow: { color: hex("#f8bb2c"), metal: 0, rough: 0.5 },
  foam: { color: hex("#e8482c"), metal: 0, rough: 0.95 },
  dark: { color: hex("#14161a"), metal: 0, rough: 0.8 },
  glass: { color: hex("#0f5f66"), metal: 0, rough: 0.12, alpha: 0.78 },
  clear: { color: hex("#e8f4ff"), metal: 0, rough: 0.08, alpha: 0.2 },
};

const BODY = 0.027; // half its width
const AXIS = 0.135; // how high the barrel runs

const gun = [
  // The body: one long rounded shape, cut away to a slope at the back.
  ...slab("cream", rounded([[0.03, 0.098], [0.238, 0.098], [0.238, 0.172], [0.06, 0.172], [0.02, 0.152], [0.014, 0.118]], [0.012, 0.01, 0.012, 0.02, 0.014, 0.014]), BODY, 0.012, 5),
  // Its rear, in the holder's colour, a little prouder than the body it wraps.
  ...slab("tint:accent", rounded([[0.004, 0.12], [0.03, 0.097], [0.05, 0.097], [0.076, 0.1765], [0.05, 0.1765], [0.01, 0.156]], [0.012, 0.008, 0.004, 0.006, 0.02, 0.014]), BODY + 0.0016, 0.014, 5),
  // The two stripes that sweep along each side from the rear.
  ...stripe("tint:accent", curve([[0.066, 0.156], [0.1, 0.153], [0.128, 0.138], [0.16, 0.127], [0.212, 0.1215]]), [0.012, 0.0025], BODY + 0.0006),
  ...stripe("yellow", curve([[0.064, 0.144], [0.096, 0.14], [0.122, 0.126], [0.155, 0.117], [0.214, 0.113]]), [0.0055, 0.0018], BODY + 0.0006),
  // The chamber: dark glass on each side, with two rings of light in it and a small light ahead of it.
  ...slab("glass", rounded(rect(0.128, 0.139, 0.196, 0.166), 0.012), BODY + 0.0022, 0.004),
  ...mark("tint:dart", rounded(rect(0.1485, 0.1425, 0.1525, 0.1625), 0.0018, 2), BODY + 0.0028),
  ...mark("tint:dart", rounded(rect(0.1705, 0.1425, 0.1745, 0.1625), 0.0018, 2), BODY + 0.0028),
  ...mark("tint:dart", rounded(rect(0.206, 0.1205, 0.233, 0.1275), 0.0033, 3), BODY + 0.0007),
  // The muzzle: a broad ring in the holder's colour, a ring of light inside it, and the foam end of a dart.
  ...tube("tint:accent", { u0: 0.236, u1: 0.244, r0: 0.032, r1: 0.0375, v: AXIS, ends: [true, false] }),
  ...tube("tint:accent", { u0: 0.244, u1: 0.266, r0: 0.0375, v: AXIS, ends: [false, false] }),
  ...tube("tint:accent", { u0: 0.266, u1: 0.273, r0: 0.0375, r1: 0.032, v: AXIS, ends: [false, true] }),
  ...tube("tint:dart", { u0: 0.273, u1: 0.2745, r0: 0.0285, v: AXIS }),
  ...tube("dark", { u0: 0.2745, u1: 0.2752, r0: 0.0235, v: AXIS }),
  ...tube("foam", { u0: 0.27, u1: 0.299, r0: 0.0155, v: AXIS }),
  ...tube("dark", { u0: 0.299, u1: 0.2996, r0: 0.0085, v: AXIS }),
  // The grip, raked back, with a panel let into each side.
  ...slab("cream", rounded([[0.024, 0.106], [0.078, 0.106], [0.05, 0.0], [-0.002, 0.0]], [0.006, 0.006, 0.012, 0.014]), 0.0225, 0.009),
  ...mark("teal", rounded([[0.034, 0.092], [0.062, 0.092], [0.041, 0.014], [0.012, 0.014]], 0.007), 0.0231),
  // The guard, and the trigger inside it.
  ...hoop("cream", { u: 0.099, v: 0.094, radius: 0.027, from: 180, to: 360, r: 0.0048 }),
  ...slab("tint:accent", rounded([[0.086, 0.1], [0.1, 0.1], [0.0955, 0.072], [0.089, 0.074]], 0.003), 0.006, 0.002),
  // The sight's hinge.
  ...axle("tint:accent", { u: 0.2, v: 0.179, r: 0.011, half: 0.021 }),
  // The sight: a frame leaning forward, a pane of lit glass in it, and a mark to aim by.
  ...slab("teal", rounded([[0.2085, 0.184], [0.2165, 0.184], [0.2345, 0.228], [0.2265, 0.228]], 0.002, 2), 0.0195, 0.003),
  ...slab("glass", [[0.2095, 0.193], [0.2187, 0.193], [0.2327, 0.222], [0.2235, 0.222]], 0.014, 0.001, 1),
  ...slab("tint:dart", [[0.2106, 0.2068], [0.2222, 0.2068], [0.2228, 0.2082], [0.2112, 0.2082]], 0.0075, 0.0003, 1),
  ...slab("tint:dart", [[0.2085, 0.2], [0.2205, 0.2], [0.2255, 0.2148], [0.2135, 0.2148]], 0.0009, 0.0003, 1),
];

// The top rail slides back as a dart is fed in.
const slide = slab("teal", rounded([[0.086, 0.1705], [0.168, 0.1705], [0.158, 0.187], [0.098, 0.187]], [0.003, 0.003, 0.008, 0.008]), 0.0145, 0.005);

// The magazine comes away and goes back on a reload: two ends in the holder's colour, a clear middle, darts inside.
const dartIn = (v) => [...tube("tint:dart", { u0: 0.149, u1: 0.186, r0: 0.0082, v, sides: 12 }), ...tube("foam", { u0: 0.186, u1: 0.197, r0: 0.0088, v, sides: 12 })];
const clip = [
  ...slab("tint:accent", rounded(rect(0.116, 0.03, 0.146, 0.1005), [0.012, 0.004, 0.004, 0.012]), BODY, 0.009),
  ...slab("tint:accent", rounded(rect(0.199, 0.03, 0.229, 0.1005), [0.004, 0.016, 0.014, 0.004]), BODY, 0.009),
  ...slab("tint:accent", rect(0.144, 0.03, 0.201, 0.0355), BODY - 0.0008, 0.003, 2),
  ...slab("tint:accent", rect(0.144, 0.095, 0.201, 0.1005), BODY - 0.0008, 0.003, 2),
  ...dartIn(0.0475),
  ...dartIn(0.0655),
  ...dartIn(0.0835),
  ...slab("clear", rect(0.1445, 0.035, 0.2005, 0.0955), BODY - 0.0018, 0.002, 1),
];

export const BLASTER_PARTS = [
  { name: "gun", shape: gun },
  { name: "slide", under: "gun", shape: slide },
  { name: "clip", under: "gun", shape: clip },
];

/** A turn about the x axis, as glTF says one: x, y, z, w. */
const tip = (degrees) => [Math.sin((degrees * Math.PI) / 360), 0, 0, Math.cos((degrees * Math.PI) / 360)];
export const BLASTER_CLIPS = [
  {
    name: "reload",
    moves: [
      { node: "clip", path: "translation", times: [0, 0.28, 0.75, 1.05, 1.4], values: [[0, 0, 0], [0, -0.11, 0.012], [0, -0.11, 0.012], [0, 0, 0], [0, 0, 0]] },
      { node: "slide", path: "translation", times: [0, 1.05, 1.2, 1.32, 1.4], values: [[0, 0, 0], [0, 0, 0], [0, 0, 0.05], [0, 0, 0], [0, 0, 0]] },
      { node: "gun", path: "rotation", times: [0, 0.25, 0.9, 1.25, 1.4], values: [tip(0), tip(-22), tip(-22), tip(4), tip(0)] },
    ],
  },
  {
    name: "fire",
    moves: [
      { node: "gun", path: "rotation", times: [0, 0.04, 0.16], values: [tip(0), tip(8), tip(0)] },
      { node: "slide", path: "translation", times: [0, 0.04, 0.16], values: [[0, 0, 0], [0, 0, 0.028], [0, 0, 0]] },
    ],
  },
];

// A dart lies along the barrel with its tip forward; it is written out the other way round (tip toward +z), which
// is the way the kit turns a thing to where it is going. Foam in the holder's colour, and it glows.
const flip = (shape) => shape.map((t) => ({ ...t, points: [t.points[0], t.points[2], t.points[1]].map(([x, y, z]) => [x, y, -z]), normals: [t.normals[0], t.normals[2], t.normals[1]].map(([x, y, z]) => [x, y, -z]) }));
export const DART_PARTS = [{ name: "dart", shape: flip([...tube("tint:dart", { u0: -0.036, u1: 0.03, r0: 0.0085, v: 0.0125, sides: 10 }), ...tube("foam", { u0: 0.03, u1: 0.046, r0: 0.0122, r1: 0.0105, v: 0.0125, sides: 10 })]) }];
