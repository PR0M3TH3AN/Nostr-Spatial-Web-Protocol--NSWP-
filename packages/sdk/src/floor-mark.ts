/**
 * Marks on the floor for a visitor moving the casual way on a flat screen:
 * where a click or a tap would take them, and, once they have pressed, where
 * they are going and the way there.
 *
 * - A **ring** under the pointer, on the spot a press would walk them to. It
 *   is never further off than one press reaches, so it also shows how far
 *   that is.
 * - A **dot** where they are headed, once they have pressed.
 * - A **dotted line** from their feet to it, which they walk along. A path
 *   tapped out in several presses is drawn whole: the line through every
 *   spot, a small mark at each turn, and the dot where it ends.
 *
 * They are drawn for this visitor alone. Nothing about them is sent to
 * anyone else in the room: other people see someone walking, as before.
 *
 *   const marks = createFloorMarks(accent);
 *   scene.add(marks.group);
 *   // every frame, on a flat screen, moving the casual way:
 *   marks.update({ hover: spotUnderThePointer, from: [head.x, head.z], to: stroll.target, t });
 *   // otherwise:
 *   marks.update({ hover: null, from: [head.x, head.z], to: null, t });
 */
import * as THREE from "three";
import { dotsBetween } from "./stroll.js";

export interface FloorMarks {
  group: THREE.Group;
  /**
   * `path` is the way they are going, each spot in order (a stroll's `path`). `to` is the same for one spot, and
   * is what this took before paths: either may be given.
   */
  update(o: { hover: readonly [number, number] | null; from: readonly [number, number]; to?: readonly [number, number] | null; path?: readonly (readonly [number, number])[] | null; t: number }): void;
  /** How many dots the line has now, how many turns are marked, and what is showing. For tests. */
  info(): { ring: [number, number] | null; dot: [number, number] | null; dots: number; turns: number };
  dispose(): void;
}

const MOST = 140;
/** The most turns a path is marked at. */
const TURNS = 16;

export function createFloorMarks(accent: THREE.ColorRepresentation, opts: { height?: number } = {}): FloorMarks {
  const y = opts.height ?? 0.02;
  const group = new THREE.Group();
  group.name = "floor-marks";
  // Drawn over the floor whatever the floor is made of, and never hit by anything looking for what is pointed at.
  const paint = (opacity: number) => new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity, depthTest: false, depthWrite: false });
  const flat = <T extends THREE.Object3D>(o: T): T => {
    o.rotation.x = -Math.PI / 2;
    o.renderOrder = 5;
    o.raycast = () => {};
    o.visible = false;
    group.add(o);
    return o;
  };
  const ring = flat(new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 48), paint(0.85)));
  const dot = flat(new THREE.Mesh(new THREE.CircleGeometry(0.14, 28), paint(0.95)));
  const halo = flat(new THREE.Mesh(new THREE.RingGeometry(0.26, 0.3, 48), paint(0.7)));
  const line = flat(new THREE.InstancedMesh(new THREE.CircleGeometry(0.07, 14), paint(0.8), MOST));
  line.rotation.x = 0; // each dot is laid flat by its own place below
  line.frustumCulled = false;
  // Where a tapped-out path turns: a small ring at each spot on the way that isn't the last.
  const knots = flat(new THREE.InstancedMesh(new THREE.RingGeometry(0.1, 0.15, 24), paint(0.85), TURNS));
  knots.rotation.x = 0;
  knots.frustumCulled = false;
  const place = new THREE.Matrix4();
  const lie = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let shown = { ring: null as [number, number] | null, dot: null as [number, number] | null, dots: 0, turns: 0 };
  return {
    group,
    update(o) {
      ring.visible = !!o.hover;
      if (o.hover) ring.position.set(o.hover[0], y, o.hover[1]);
      const way = o.path?.length ? o.path : o.to ? [o.to] : [];
      const end = way[way.length - 1] ?? null;
      dot.visible = !!end;
      halo.visible = !!end;
      let dots = 0;
      let turns = 0;
      if (end) {
        dot.position.set(end[0], y, end[1]);
        halo.position.copy(dot.position);
        // The ring round where they are going opens and fades, over and over, so it reads as somewhere to go.
        const pulse = (o.t * 0.9) % 1;
        halo.scale.setScalar(1 + pulse * 0.9);
        (halo.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - pulse);
        let from = o.from;
        way.forEach((spot, leg) => {
          // The first stretch starts clear of their feet; the rest start clear of the mark at the turn.
          for (const [x, z] of dotsBetween(from[0], from[1], spot[0], spot[1], { most: MOST - dots, clear: leg === 0 ? 0.45 : 0.32, short: leg === way.length - 1 ? 0.3 : 0.32 })) {
            place.compose(at.set(x, y, z), lie, one);
            line.setMatrixAt(dots++, place);
          }
          if (leg < way.length - 1 && turns < TURNS) {
            place.compose(at.set(spot[0], y, spot[1]), lie, one);
            knots.setMatrixAt(turns++, place);
          }
          from = spot;
        });
        line.instanceMatrix.needsUpdate = true;
        knots.instanceMatrix.needsUpdate = true;
      }
      line.count = dots;
      line.visible = dots > 0;
      knots.count = turns;
      knots.visible = turns > 0;
      shown = { ring: o.hover ? [o.hover[0], o.hover[1]] : null, dot: end ? [end[0], end[1]] : null, dots, turns };
    },
    info: () => shown,
    dispose() {
      for (const o of [ring, dot, halo, line, knots]) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
      group.removeFromParent();
    },
  };
}
