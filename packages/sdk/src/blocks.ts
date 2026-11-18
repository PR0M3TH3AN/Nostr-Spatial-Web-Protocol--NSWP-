/**
 * Things built from blocks: dark boxes with lit edges, the solid half of the
 * grid look. Furniture, walls, trees, whatever a place is made of.
 *
 * Every box added to one builder is drawn together: one mesh and one set of
 * lines, however many boxes there are. Nothing is lit by the scene's lights.
 * Each face carries its own shade instead, which is what keeps a room of
 * furniture at two draw calls on a headset.
 *
 *   const blocks = createBlocks("#3df2a0");
 *   blocks.box([0.6, 1, 0.6], [0, 0.5, 0]);              // a plinth
 *   blocks.box([0.3, 0.3, 0.3], [0, 1.2, 0], { lit: true }); // a glowing cube on it
 *   scene.add(blocks.build());
 */
import * as THREE from "three";

export interface BlockOptions {
  /** The box's own colour. Dark by default. */
  color?: THREE.ColorRepresentation;
  /** Drawn at full brightness on every face, like something giving off light. */
  lit?: boolean;
  /** Leave its edges undrawn. */
  bare?: boolean;
}

export interface Blocks {
  /** Add a box: its size, then where its centre is. */
  box(size: [number, number, number], at: [number, number, number], opts?: BlockOptions): void;
  /** Place and turn every box added from now on: an item's position, and its rotation in degrees about the vertical. */
  at(position: [number, number, number], degrees?: number): void;
  readonly count: number;
  build(): THREE.Group;
}

/** The colour blocks are unless told otherwise. */
export const BLOCK = 0x0c151d;

// The six faces of a unit box: four corners each, and how brightly each is shaded.
const FACES: { corners: [number, number, number][]; shade: number }[] = [
  { corners: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], shade: 1 }, // top
  { corners: [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]], shade: 0.45 }, // bottom
  { corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], shade: 0.8 }, // front (+Z)
  { corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], shade: 0.62 }, // back
  { corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], shade: 0.7 }, // right
  { corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], shade: 0.55 }, // left
];
// The twelve edges of a unit box, as pairs of corners.
const EDGES: [number, number, number][][] = [
  [[-1, -1, -1], [1, -1, -1]], [[1, -1, -1], [1, -1, 1]], [[1, -1, 1], [-1, -1, 1]], [[-1, -1, 1], [-1, -1, -1]],
  [[-1, 1, -1], [1, 1, -1]], [[1, 1, -1], [1, 1, 1]], [[1, 1, 1], [-1, 1, 1]], [[-1, 1, 1], [-1, 1, -1]],
  [[-1, -1, -1], [-1, 1, -1]], [[1, -1, -1], [1, 1, -1]], [[1, -1, 1], [1, 1, 1]], [[-1, -1, 1], [-1, 1, 1]],
];

export function createBlocks(accent: THREE.ColorRepresentation): Blocks {
  const positions: number[] = [];
  const colors: number[] = [];
  const lines: number[] = [];
  const frame = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  let count = 0;

  return {
    get count() {
      return count;
    },
    at(position, degrees = 0) {
      frame.makeRotationY(THREE.MathUtils.degToRad(degrees)).setPosition(...position);
    },
    box(size, at, opts = {}) {
      count++;
      const put = (corner: [number, number, number], into: number[]) => {
        v.set(at[0] + (corner[0] * size[0]) / 2, at[1] + (corner[1] * size[1]) / 2, at[2] + (corner[2] * size[2]) / 2).applyMatrix4(frame);
        into.push(v.x, v.y, v.z);
      };
      for (const face of FACES) {
        c.set(opts.color ?? BLOCK);
        if (!opts.lit) c.multiplyScalar(face.shade);
        for (const i of [0, 1, 2, 0, 2, 3]) {
          put(face.corners[i]!, positions);
          colors.push(c.r, c.g, c.b);
        }
      }
      if (!opts.bare) for (const [a, b] of EDGES) {
        put(a!, lines);
        put(b!, lines);
      }
    },
    build() {
      const group = new THREE.Group();
      group.name = "blocks";
      const solid = new THREE.BufferGeometry();
      solid.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      solid.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      solid.computeVertexNormals();
      const edges = new THREE.BufferGeometry();
      edges.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
      group.add(
        new THREE.Mesh(solid, new THREE.MeshBasicMaterial({ vertexColors: true })),
        new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.9 })),
      );
      return group;
    },
  };
}
