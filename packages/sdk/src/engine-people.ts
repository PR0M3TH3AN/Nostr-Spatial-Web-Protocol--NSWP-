/**
 * Other people, for a world drawn by an engine that isn't JavaScript's (spec §9.4; docs/other-engines.md).
 *
 * Everything about a room that isn't drawing is the very code a Three.js world runs (presence.ts, room-controls.ts):
 * joining and leaving, who is here, where each of them is, their voices from where they stand, chat, the list of
 * people and a card for each, muting and blocking. Their figures, names, pictures and words are made here too, so
 * people look the same in every world, whatever it is made with.
 *
 * What is left for the engine is to draw what it is handed:
 *
 * - **a figure** for each person: three shapes (head, body, a hand), as corners with colours, in the kit's metal;
 * - **boards:** flat pictures that always face the viewer (a name, a picture, a few written words, a light);
 * - and to say where its own visitor's view is, each frame, as it already does.
 *
 *   NSWP.people('{}');                                        // once, after NSWP.menu
 *   const now = JSON.parse(NSWP.frame(JSON.stringify(view)));  // every frame: now.people
 *   NSWP.figure(person.figure);  NSWP.board(board.key);      // once each: what to draw them with
 */
import * as THREE from "three";
import { engineParts } from "./engine-menu.js";
import { enginePresence, engineItemStore, onEnginePresence } from "./engine-presence.js";
import { addFramePart, base64, engineWorld, read, type EngineWorld } from "./engine-world.js";
import type { Figure } from "./figure.js";
import { arrival } from "./index.js";
import type { PersonDrawn, Presence } from "./presence.js";
import { addRoomControls, type Travelling } from "./room-controls.js";

let on: {
  world: EngineWorld;
  presence: Presence;
  travelling: () => Travelling;
  /** A name for each figure that has been made, and the figure for each name still in use. */
  figureNames: WeakMap<Figure, string>;
  figures: Map<string, Figure>;
  /** A board's picture, for each one still in use. */
  boards: Map<string, THREE.Texture>;
  made: number;
} | null = null;

const round = (n: number, places = 3): number => Math.round(n * 10 ** places) / 10 ** places;
const v = new THREE.Vector3();
const q = new THREE.Quaternion();
const placed = (o: THREE.Object3D): { p: number[]; q: number[] } => {
  o.getWorldPosition(v);
  o.getWorldQuaternion(q);
  return { p: [round(v.x), round(v.y), round(v.z)], q: [round(q.x, 4), round(q.y, 4), round(q.z, 4), round(q.w, 4)] };
};

/** A flat picture that faces the viewer, as the engine is to draw it. */
interface Board {
  /** Ask `board(key)` for its picture, once. */
  key: string;
  /** Where its middle is, or the middle of its bottom edge where `foot` is true. */
  at: number[];
  /** How wide and tall, in metres. */
  w: number;
  h: number;
  foot: boolean;
  opacity: number;
  /** A colour to draw it in, as #rrggbb, where its picture is plain white light. */
  tint?: string;
}

function boardOf(state: NonNullable<typeof on>, sprite: THREE.Sprite): Board | null {
  const map = sprite.material.map;
  if (!map || !sprite.visible) return null;
  const opacity = sprite.material.opacity;
  sprite.getWorldPosition(v);
  // A picture that is drawn over again (how someone is, as it changes) is a new picture to hand over.
  const key = `${map.uuid}:${map.version}`;
  state.boards.set(key, map);
  const tint = sprite.material.color.getHexString();
  return {
    key,
    at: [round(v.x), round(v.y), round(v.z)],
    w: round(sprite.scale.x),
    h: round(sprite.scale.y),
    foot: sprite.center.y === 0,
    opacity: round(Math.min(1, Math.max(0, opacity)), 2),
    ...(tint === "ffffff" ? {} : { tint: `#${tint}` }),
  };
}

function personOf(state: NonNullable<typeof on>, p: PersonDrawn): Record<string, unknown> {
  let name = state.figureNames.get(p.figure);
  if (!name) {
    name = `f${++state.made}`;
    state.figureNames.set(p.figure, name);
  }
  state.figures.set(name, p.figure);
  // Everything flat that is over their head: their name, their picture, what they wrote, a light while they
  // record, a column of light while they are pointed out, and how they are where items are in play.
  const boards = p.figure.head.children
    .filter((c): c is THREE.Sprite => (c as THREE.Sprite).isSprite === true)
    .map((sprite) => boardOf(state, sprite))
    .filter((b): b is Board => b !== null);
  // What they hold, where this world draws what people carry and it has been read and checked.
  const item = p.holding && p.held ? engineItemStore().known(p.holding) : null;
  return {
    key: p.pubkey,
    name: p.name,
    figure: name,
    opacity: round(p.opacity, 2),
    head: placed(p.figure.head),
    body: placed(p.figure.torso),
    hands: p.figure.hands.map((h) => (h.visible ? placed(h) : null)),
    boards,
    ...(item && p.held ? { held: { id: p.holding, model: item.model.sha256, size: item.size, tints: Object.fromEntries(item.tints.map((t) => [t.slot, p.tints[t.slot] ?? t.color])), ...placed(p.held) } } : {}),
  };
}

/** The people's share of a frame (engine-world.ts, `frame`): `people`, everyone to draw, and `room`, a word on it. */
function peopleFrame(): Record<string, unknown> {
  const state = on;
  if (!state) return {};
  // Only what is on show now is kept to hand over: someone who left takes their figure and their boards with them.
  state.figures.clear();
  state.boards.clear();
  const people = state.presence.drawn().map((p) => personOf(state, p));
  const session = state.presence.session;
  return { people, room: { joined: !!session, mic: state.presence.micOn, here: session ? state.presence.people().length : 0 } };
}

/**
 * Begin. Call once, after `menu`. `options` is JSON: `sharedMusic` false for a place that wants none of its
 * visitors' music shared. The room's part of the menu is added: Join, the
 * microphone, chat, who is here. Nobody is joined to anything until they ask, having been told what it shows
 * of them, as in every world. Returns `{ ok }`.
 */
export function people(options?: string): string {
  if (on) return JSON.stringify({ ok: true });
  const parts = engineParts();
  const presence = enginePresence();
  if (!parts || !presence) return JSON.stringify({ ok: false, why: "menu-first" });
  const o = read(options);
  const world = engineWorld();
  const { controls, sounds } = parts;
  const room = addRoomControls(controls, presence, {
    arrived: arrival.read().context,
    // A screen someone shares is watched on a panel, and an engine has none of the kit's panels to open one on.
    panels: null,
    sounds,
    presenting: () => world.presenting,
    ...(o.sharedMusic === false ? { sharedMusic: false } : {}),
  });
  onEnginePresence(room.refresh);
  on = { world, presence, travelling: room.travelling, figureNames: new WeakMap(), figures: new Map(), boards: new Map(), made: 0 };
  addFramePart(peopleFrame);
  return JSON.stringify({ ok: true });
}

/** How the visitor is leaving, for the link that takes them on: joined, their microphone, whom they blocked here. */
export function travellingNow(): Partial<Travelling> {
  return on ? on.travelling() : {};
}

const srgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const packed = (values: ArrayLike<number>, map?: (n: number) => number): string => {
  const f = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) f[i] = map ? map(values[i]!) : values[i]!;
  return base64(new Uint8Array(f.buffer));
};
function shapeOf(mesh: THREE.Mesh): Record<string, unknown> {
  const g = mesh.geometry;
  const at = (name: string): ArrayLike<number> => (g.getAttribute(name)?.array ?? []) as ArrayLike<number>;
  return {
    count: g.getAttribute("position")?.count ?? 0,
    // Each as little-endian 32-bit floats in base64: three for a place, three for which way it faces, three for
    // its tone (as sRGB), and one each for how much of a light it is and how far along its seam.
    position: packed(at("position")),
    normal: packed(at("normal")),
    tone: packed(at("tone"), srgb),
    glow: packed(at("glow")),
    flow: packed(at("flow")),
  };
}

/**
 * What to draw a figure with, as JSON, by the name a person in a frame gave (`figure`): `head`, `body` and `hand`
 * (the one shape for both), each a list of triangles' corners, and what the kit's metal needs to draw them:
 * `accent`, the colour of its lights, `gloss` and `sheen`. "" for a name no longer in use.
 *
 * A head faces -Z with its origin between the eyes. Each frame says where the head, the body and each hand are.
 */
export function figure(name: unknown): string {
  const f = typeof name === "string" ? on?.figures.get(name) : null;
  if (!f) return "";
  const u = (f.metal as { uniforms?: Record<string, { value: unknown }> }).uniforms ?? {};
  const accent = u.uAccent?.value instanceof THREE.Color ? `#${u.uAccent.value.getHexString()}` : f.look.light;
  const head = f.head.children.find((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh === true);
  return JSON.stringify({
    head: head ? shapeOf(head) : null,
    body: shapeOf(f.torso),
    hand: shapeOf(f.hands[0]),
    accent,
    gloss: typeof u.uGloss?.value === "number" ? u.uGloss.value : 0.7,
    sheen: typeof u.uSheen?.value === "number" ? u.uSheen.value : 0,
  });
}

/** A board's picture, as a PNG in base64, by the key a frame gave. "" for a key no longer in use. */
export function board(key: unknown): string {
  const map = typeof key === "string" ? on?.boards.get(key) : null;
  const image = map?.image as HTMLCanvasElement | undefined;
  try {
    return typeof image?.toDataURL === "function" ? image.toDataURL("image/png").replace(/^data:image\/png;base64,/, "") : "";
  } catch {
    return "";
  }
}

/** What this visitor sees of each person, as JSON: for tests. */
export function peopleInfo(): string {
  return JSON.stringify(on ? { joined: !!on.presence.session, me: on.presence.session?.self.pubkey ?? null, room: on.presence.roomName, people: on.presence.info() } : null);
}
