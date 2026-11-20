/**
 * Where the visitor is, for a world drawn by an engine that isn't JavaScript's (docs/other-engines.md).
 *
 * The kit's own code for people and for the things they carry works on places and directions, and was written
 * for a Three.js scene. Here is such a scene with nothing in it to draw: the visitor's view is put where the
 * engine says it is, once a frame, and the kit's code is run on that. So nothing about who is where, or what
 * flew where, is written a second time for another engine.
 *
 * One call a frame, `frame`, carries everything both ways: the engine says where the visitor is and what it found
 * out, and is given back everything there is to draw. Each part of this script that has something to draw adds
 * its share (`addFramePart`).
 */
import * as THREE from "three";

export const read = (text: unknown): Record<string, unknown> => {
  try {
    const v: unknown = typeof text === "string" && text ? JSON.parse(text) : text;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
export const three = (v: unknown): [number, number, number] | null => (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? (v as [number, number, number]) : null);
export const num = (v: unknown, otherwise: number): number => (typeof v === "number" && Number.isFinite(v) ? v : otherwise);

/** Bytes as base64, a piece at a time: a model is too long to hand to the browser in one go. */
export function base64(bytes: Uint8Array): string {
  let text = "";
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

export interface EngineWorld {
  scene: THREE.Scene;
  /** Where the visitor's view is, and which way it faces. */
  camera: THREE.PerspectiveCamera;
  /** Where they stand: under their view, on the floor. The kit moves this to move them (`nudge` in a frame). */
  rig: THREE.Group;
  /** In a headset, as the engine last said. */
  presenting: boolean;
  /** Their item is up at their eye, as the engine last said. */
  sighting: boolean;
}

let world: (EngineWorld & { set: { x: number; z: number } | null }) | null = null;

/** The one place every part of this script works in. Made when first asked for. */
export function engineWorld(): EngineWorld {
  if (world) return world;
  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(70, 1.6, 0.1, 100);
  scene.add(rig, camera);
  world = { scene, camera, rig, presenting: false, sighting: false, set: null };
  return world;
}

/** What a part of this script does each frame: it is given what the engine said, and returns its share of what to draw. */
export type FramePart = (said: Record<string, unknown>, dt: number) => Record<string, unknown>;
const parts: FramePart[] = [];
/** Take part in every frame from now on. */
export function addFramePart(part: FramePart): void {
  parts.push(part);
}

/**
 * Every frame. `view` is JSON saying where the visitor is and what the engine found: `dt`, seconds since the last;
 * `head` and `turn`, where their view is and which way it faces (x, y, z, w); `floor`, how high the floor under
 * them is; `fov` and `aspect`; `presenting`, in a headset; `sighting`, whether their item is up at their eye; and
 * whatever each part asks of the engine (for items: `met` and `floors`).
 *
 * Returns everything there is to draw, as JSON: each part's share (`held`, `things`, `trails`, `own` for items;
 * `people` and `room` for people), and `nudge` when the visitor is to be moved a little along the floor (x and z,
 * in metres: they arrived on top of someone). Add it to where they stand.
 */
export function frame(view?: string): string {
  if (!world || !parts.length) return "{}";
  const w = world;
  const i = read(view);
  // The kit moved them since the last frame (two people arriving in the same spot step apart): the engine is told.
  const nudge = w.set && (Math.abs(w.rig.position.x - w.set.x) > 1e-4 || Math.abs(w.rig.position.z - w.set.z) > 1e-4) ? [w.rig.position.x - w.set.x, w.rig.position.z - w.set.z] : null;
  const head = three(i.head);
  const turn = Array.isArray(i.turn) && i.turn.length === 4 && i.turn.every((x) => typeof x === "number" && Number.isFinite(x)) ? (i.turn as number[]) : null;
  if (head) {
    w.camera.position.fromArray(head);
    w.rig.position.set(head[0], num(i.floor, head[1] - 1.6), head[2]);
    w.set = { x: head[0], z: head[2] };
  }
  if (turn) w.camera.quaternion.fromArray(turn).normalize();
  w.camera.fov = Math.min(140, Math.max(10, num(i.fov, w.camera.fov)));
  w.camera.aspect = Math.min(8, Math.max(0.1, num(i.aspect, w.camera.aspect)));
  w.presenting = i.presenting === true;
  w.sighting = i.sighting === true;
  w.scene.updateMatrixWorld(true);
  const dt = Math.min(0.5, Math.max(0, num(i.dt, 0.016)));
  const out: Record<string, unknown> = {};
  for (const part of parts) Object.assign(out, part(i, dt));
  // Where each voice comes from follows where its speaker was just put.
  w.scene.updateMatrixWorld(true);
  if (nudge) out.nudge = nudge;
  return JSON.stringify(out);
}
