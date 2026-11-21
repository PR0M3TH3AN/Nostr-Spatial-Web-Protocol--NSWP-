/**
 * Where doors may stand beside each other: never nearer than `DOOR_SPACING`.
 *
 * No renderer here, only numbers, so a world, a client's room, a build
 * script and another engine's export can all lay doors out the same way, or
 * ask whether the places they chose by hand are far enough apart.
 */
import { DOOR_SPACING } from "./gate-size.js";

/** Two places this much nearer than the spacing are still far enough: sums of fractions don't come out exact. */
const SLACK = 1e-6;

/**
 * A straight row of doors, as distances along the wall from its middle, left
 * to right: the least a wall can be and hold them. `apart` may be more than
 * the spacing, never less.
 */
export function doorRow(count: number, apart = DOOR_SPACING): number[] {
  const step = Math.max(apart, DOOR_SPACING);
  const n = Math.max(0, Math.floor(count));
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step);
}

/**
 * The angle between two neighbouring doors standing on a circle of this
 * radius, facing its middle, in radians: the smallest that keeps their
 * middles `DOOR_SPACING` apart in a straight line. A circle too small to
 * hold two doors at all gives a half turn.
 */
export function doorArcStep(radius: number): number {
  if (!(radius > DOOR_SPACING / 2)) return Math.PI;
  return 2 * Math.asin(DOOR_SPACING / (2 * radius));
}

/**
 * How many doors a wall that curves through `span` radians of a circle of
 * this radius holds. More than that go somewhere else: a list, another wall.
 * A door is never squeezed in.
 */
export function doorsOnArc(radius: number, span: number): number {
  if (!(span >= 0) || !(radius > 0)) return 0;
  return Math.floor(span / doorArcStep(radius) + SLACK) + 1;
}

/** A door's place on the floor: `[x, y, z]` as a world writes it, or its `x` and `z`. */
export type DoorPlace = readonly [number, number, number] | { readonly x: number; readonly z: number };

const xz = (p: DoorPlace): [number, number] => ("x" in p ? [p.x, p.z] : [p[0], p[2]]);

/**
 * Every two doors standing nearer than `DOOR_SPACING`: which two, by their
 * place in the list, and how far apart they are. Empty when all is well.
 * Height is left out: doors on two floors, one over the other, are a
 * building's business.
 */
export function doorsTooClose(doors: readonly DoorPlace[]): { a: number; b: number; apart: number }[] {
  const close: { a: number; b: number; apart: number }[] = [];
  for (let a = 0; a < doors.length; a++) {
    const [ax, az] = xz(doors[a]!);
    for (let b = a + 1; b < doors.length; b++) {
      const [bx, bz] = xz(doors[b]!);
      const apart = Math.hypot(ax - bx, az - bz);
      if (apart < DOOR_SPACING - SLACK) close.push({ a, b, apart });
    }
  }
  return close;
}
