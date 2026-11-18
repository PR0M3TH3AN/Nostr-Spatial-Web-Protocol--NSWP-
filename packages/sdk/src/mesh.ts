/**
 * Modelling in code: the kit the reference places are built with.
 *
 * A builder collects faces and hands back one mesh. Every face is flat, with
 * its own normal, so bevels and insets catch the light as edges. Each vertex
 * carries three things the surface shader (alloy.ts) draws from:
 *
 *  - a tone: the face's own colour, already darkened where it is recessed;
 *  - a glow: how much of it is a light, 0 to 1;
 *  - a flow: a distance along the piece, which light travels along.
 *
 * Shapes are made the way a modeller would make them: boxes with their edges
 * bevelled and panels pressed into their faces, a profile swept along a path,
 * a profile turned on a lathe. Everything added to one builder is one draw
 * call, which is what lets a detailed room run on a headset.
 */
import * as THREE from "three";

export type V3 = [number, number, number];
export type P2 = [number, number];

export interface Paint {
  /** The face's colour. The builder's current tone when left out. */
  color?: THREE.ColorRepresentation;
  /** How much of a light it is, 0 to 1. */
  glow?: number;
  /** Darken (below 1) or lift (above 1): what a recess or a raised lip does. */
  shade?: number;
  /** Distance along the piece, for light that travels. One number, or one per corner. */
  flow?: number | [number, number, number, number];
}

export interface BoxOptions extends Paint {
  /** How much is cut from every edge. */
  bevel?: number;
  /** Press a panel into faces: how far in from the edge, how deep, and whether its rim is lit. */
  panel?: { margin: number; depth: number; glow?: number; faces?: string };
}

/** A point on a path, with the two directions a profile is drawn in there. Travel must run along x × y. */
export interface Frame {
  p: V3;
  x: V3;
  y: V3;
  /** Distance along the path, for flow. */
  t?: number;
}

const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
const vd = new THREE.Vector3();
const e1 = new THREE.Vector3();
const e2 = new THREE.Vector3();
const nn = new THREE.Vector3();
const hint = new THREE.Vector3();
const col = new THREE.Color();

export class MeshBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private tones: number[] = [];
  private glows: number[] = [];
  private flows: number[] = [];
  private matrix = new THREE.Matrix4();
  private rotation = new THREE.Matrix3();
  /** The colour faces take when they don't say. */
  tone = new THREE.Color(0x0c151d);
  /** The colour of this piece's lights, for a material that reads plain vertex colours (see `geometry`). */
  light = new THREE.Color(0xffffff);
  private colors: number[] = [];

  get triangles(): number {
    return this.positions.length / 9;
  }

  /** Place and turn everything added from now on: a position, and degrees about the vertical. */
  at(position: V3 = [0, 0, 0], degrees = 0, scale = 1): this {
    this.matrix.makeRotationY(THREE.MathUtils.degToRad(degrees)).scale(vc.set(scale, scale, scale)).setPosition(position[0], position[1], position[2]);
    this.rotation.setFromMatrix4(this.matrix);
    return this;
  }

  /** Place everything added from now on by any matrix: for a piece that leans or lies on its side. */
  place(matrix: THREE.Matrix4): this {
    this.matrix.copy(matrix);
    this.rotation.setFromMatrix4(this.matrix);
    return this;
  }

  /** A flat four-sided face. Pass `out`, roughly which way it faces, and the corners may be given in either order. */
  quad(a: V3, b: V3, c: V3, d: V3, paint: Paint = {}, out?: V3): void {
    const f = paint.flow;
    const fl: [number, number, number, number] = Array.isArray(f) ? f : [f ?? 0, f ?? 0, f ?? 0, f ?? 0];
    va.set(...a);
    vb.set(...b);
    vc.set(...c);
    vd.set(...d);
    nn.crossVectors(e1.subVectors(vb, va), e2.subVectors(vd, va));
    if (nn.lengthSq() < 1e-12) nn.crossVectors(e1.subVectors(vc, vb), e2.subVectors(vd, vb));
    let order = [va, vb, vc, va, vc, vd];
    let fo = [fl[0], fl[1], fl[2], fl[0], fl[2], fl[3]];
    if (out && nn.dot(hint.set(...out)) < 0) {
      nn.negate();
      order = [va, vd, vc, va, vc, vb];
      fo = [fl[0], fl[3], fl[2], fl[0], fl[2], fl[1]];
    }
    nn.applyMatrix3(this.rotation).normalize();
    col.set(paint.color ?? this.tone).multiplyScalar(paint.shade ?? 1);
    for (let i = 0; i < 6; i++) {
      const v = e1.copy(order[i]!).applyMatrix4(this.matrix);
      this.positions.push(v.x, v.y, v.z);
      this.normals.push(nn.x, nn.y, nn.z);
      this.tones.push(col.r, col.g, col.b);
      this.glows.push(paint.glow ?? 0);
      const g = paint.glow ?? 0;
      this.colors.push(col.r + (this.light.r - col.r) * g, col.g + (this.light.g - col.g) * g, col.b + (this.light.b - col.b) * g);
      this.flows.push(fo[i]!);
    }
  }

  tri(a: V3, b: V3, c: V3, paint: Paint = {}, out?: V3): void {
    this.quad(a, b, c, c, paint, out);
  }

  /** A face with a panel pressed into it. Corners in order round the face; `out` is which way it faces. */
  panel(corners: [V3, V3, V3, V3], out: V3, o: { margin: number; depth: number; glow?: number }, paint: Paint = {}): void {
    const [a, b, c, d] = corners.map((p) => new THREE.Vector3(...p)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
    const n = new THREE.Vector3(...out).normalize();
    const mid = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25);
    // Each inner corner sits `margin` in from both edges that meet at its outer corner.
    const inner = [a, b, c, d].map((p, i, all) => {
      const next = all[(i + 1) % 4]!;
      const prev = all[(i + 3) % 4]!;
      return p.clone().add(next.clone().sub(p).setLength(o.margin)).add(prev.clone().sub(p).setLength(o.margin));
    });
    const deep = inner.map((p) => p.clone().addScaledVector(n, -o.depth));
    const arr = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];
    const all = [a, b, c, d];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      // The rim round the panel, then the wall down into it.
      this.quad(arr(all[i]!), arr(all[j]!), arr(inner[j]!), arr(inner[i]!), paint, out);
      const wallMid = inner[i]!.clone().add(inner[j]!).multiplyScalar(0.5);
      const inward = mid.clone().sub(wallMid);
      this.quad(arr(inner[i]!), arr(inner[j]!), arr(deep[j]!), arr(deep[i]!), { ...paint, glow: o.glow ?? 0, shade: (paint.shade ?? 1) * (o.glow ? 1 : 0.6) }, arr(inward));
    }
    this.quad(arr(deep[0]!), arr(deep[1]!), arr(deep[2]!), arr(deep[3]!), { ...paint, shade: (paint.shade ?? 1) * 0.55 }, out);
  }

  /** A box with its edges bevelled, and panels pressed into the faces named: "x+ x- y+ y- z+ z-", or "sides". */
  box(size: V3, at: V3, o: BoxOptions = {}): void {
    const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
    const b = Math.min(o.bevel ?? 0, hx * 0.9, hy * 0.9, hz * 0.9);
    const h = [hx, hy, hz];
    const want = (o.panel?.faces ?? "sides").replace("sides", "x+ x- z+ z-").split(/\s+/);
    // For a corner (which side of each axis) the point on the face across `axis`.
    const point = (axis: number, s: number[]): V3 => {
      const p: V3 = [0, 0, 0];
      for (let k = 0; k < 3; k++) p[k] = at[k]! + s[k]! * (k === axis ? h[k]! : h[k]! - b);
      return p;
    };
    const signs = [-1, 1];
    for (let axis = 0; axis < 3; axis++) {
      const [u, v] = [(axis + 1) % 3, (axis + 2) % 3];
      for (const s of signs) {
        const corner = (su: number, sv: number): V3 => {
          const q = [0, 0, 0];
          q[axis] = s;
          q[u] = su;
          q[v] = sv;
          return point(axis, q);
        };
        const out: V3 = [0, 0, 0];
        out[axis] = s;
        const face: [V3, V3, V3, V3] = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
        const name = `${"xyz"[axis]}${s > 0 ? "+" : "-"}`;
        if (o.panel && want.includes(name) && Math.min(h[u]!, h[v]!) - b > o.panel.margin * 1.2) this.panel(face, out, o.panel, o);
        else this.quad(...face, o, out);
      }
    }
    if (b <= 0) return;
    // A bevel along each of the twelve edges, and a triangle on each of the eight corners.
    for (let axis = 0; axis < 3; axis++) {
      const [u, v] = [(axis + 1) % 3, (axis + 2) % 3];
      for (const su of signs)
        for (const sv of signs) {
          const s = (along: number) => {
            const q = [0, 0, 0];
            q[axis] = along;
            q[u] = su;
            q[v] = sv;
            return q;
          };
          const out: V3 = [0, 0, 0];
          out[u] = su;
          out[v] = sv;
          this.quad(point(u, s(-1)), point(u, s(1)), point(v, s(1)), point(v, s(-1)), { ...o, shade: (o.shade ?? 1) * 1.25 }, out);
        }
    }
    for (const sx of signs) for (const sy of signs) for (const sz of signs) this.tri(point(0, [sx, sy, sz]), point(1, [sx, sy, sz]), point(2, [sx, sy, sz]), { ...o, shade: (o.shade ?? 1) * 1.25 }, [sx, sy, sz]);
  }

  /**
   * Sweep a profile along a path. The profile is a closed outline drawn
   * anticlockwise in each frame's own x and y; `paint(i)` colours the side that
   * runs from point i to the next. Open ends are capped.
   */
  sweep(profile: P2[], frames: Frame[], paint: (side: number) => Paint = () => ({}), o: { caps?: boolean; loop?: boolean } = {}): void {
    const at = (k: number, i: number): V3 => {
      const f = frames[k]!;
      const [u, v] = profile[i % profile.length]!;
      return [f.p[0] + f.x[0] * u + f.y[0] * v, f.p[1] + f.x[1] * u + f.y[1] * v, f.p[2] + f.x[2] * u + f.y[2] * v];
    };
    const last = o.loop ? frames.length : frames.length - 1;
    for (let k = 0; k < last; k++) {
      const k2 = (k + 1) % frames.length;
      const [t1, t2] = [frames[k]!.t ?? k, frames[k2]!.t ?? k + 1];
      for (let i = 0; i < profile.length; i++) {
        const p = paint(i);
        // Anticlockwise profile, travel along x × y: this order faces outward.
        this.quad(at(k, i), at(k, i + 1), at(k2, i + 1), at(k2, i), { ...p, flow: p.flow ?? [t1, t1, t2, t2] });
      }
    }
    if (o.loop || o.caps === false) return;
    for (const [k, dir] of [[0, -1], [frames.length - 1, 1]] as const) {
      const f = frames[k]!;
      const tangent = new THREE.Vector3(...f.x).cross(new THREE.Vector3(...f.y)).multiplyScalar(dir);
      for (let i = 1; i < profile.length - 1; i++) this.tri(at(k, 0), at(k, i), at(k, i + 1), paint(-1), [tangent.x, tangent.y, tangent.z]);
    }
  }

  /**
   * Turn a profile on a lathe about the vertical through `at`. The profile is
   * [radius, height] pairs from the bottom up. `sides` is how many faces round:
   * 4 makes a square column, 6 a hexagon, 24 a round one. `twist` turns it as it rises.
   * `paint(row, side)` colours each face: `row` counts up the profile, `side` round it.
   */
  lathe(profile: P2[], at: V3, sides: number, paint: (row: number, side: number) => Paint = () => ({}), o: { twist?: number; turn?: number } = {}): void {
    const top = profile[profile.length - 1]![1];
    const ring = (row: number, s: number): V3 => {
      const [r, y] = profile[row]!;
      const a = (s / sides) * Math.PI * 2 + (o.turn ?? 0) + (o.twist ?? 0) * (top ? y / top : 0);
      return [at[0] + Math.cos(a) * r, at[1] + y, at[2] + Math.sin(a) * r];
    };
    for (let row = 0; row < profile.length - 1; row++) {
      const [r1, y1] = profile[row]!;
      const [r2, y2] = profile[row + 1]!;
      for (let s = 0; s < sides; s++) {
        const a = ((s + 0.5) / sides) * Math.PI * 2 + (o.turn ?? 0);
        // Going up the profile, outward is to its right: (dy, -dr), turned to this side.
        const out: V3 = [Math.cos(a) * (y2 - y1), -(r2 - r1), Math.sin(a) * (y2 - y1)];
        if (Math.abs(out[0]) + Math.abs(out[1]) + Math.abs(out[2]) < 1e-9) continue;
        const p = paint(row, s);
        this.quad(ring(row, s), ring(row, s + 1), ring(row + 1, s + 1), ring(row + 1, s), { ...p, flow: p.flow ?? [y1, y1, y2, y2] }, out);
      }
    }
  }

  /** A thin lit line lying just proud of a surface: from a to b, `width` wide, on a face that points `out`. */
  line(a: V3, b: V3, width: number, out: V3, paint: Paint = {}): void {
    const n = new THREE.Vector3(...out).normalize();
    const along = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const side = along.clone().cross(n).setLength(width / 2);
    const lift = n.clone().multiplyScalar(0.004);
    const A = new THREE.Vector3(...a).add(lift);
    const B = new THREE.Vector3(...b).add(lift);
    const len = along.length();
    this.quad(
      [A.x - side.x, A.y - side.y, A.z - side.z],
      [B.x - side.x, B.y - side.y, B.z - side.z],
      [B.x + side.x, B.y + side.y, B.z + side.z],
      [A.x + side.x, A.y + side.y, A.z + side.z],
      { glow: 1, ...paint, flow: paint.flow ?? [0, len, len, 0] },
      out,
    );
  }

  /** Everything added, as one geometry. */
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute("tone", new THREE.Float32BufferAttribute(this.tones, 3));
    g.setAttribute("glow", new THREE.Float32BufferAttribute(this.glows, 1));
    g.setAttribute("flow", new THREE.Float32BufferAttribute(this.flows, 1));
    // The same thing as plain vertex colours, lights included, for any material
    // of a world's own: `new THREE.MeshStandardMaterial({ vertexColors: true })`.
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    g.computeBoundingSphere();
    return g;
  }

  /** Everything added, as one mesh in this material (see alloy.ts). */
  build(material: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(this.geometry(), material);
  }
}
