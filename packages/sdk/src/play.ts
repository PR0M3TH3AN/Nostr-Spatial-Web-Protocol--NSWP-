/**
 * Items in play, drawn (protocol/17-items.md): the things an item sends out, what they do to the people they
 * reach, and the item's own logic.
 *
 * Who decides what, here:
 * - **The item's script** runs in its locked box on the device of whoever carries it (`item-box.ts`). It asks for
 *   one of a few things; this file does them, or doesn't.
 * - **Every device flies a thing the same way,** from the few numbers its sender said (`shotAt` in the core):
 *   straight on and falling, so it has to be aimed higher to go further.
 * - **It sticks to whatever solid shape it meets:** any mesh of the world. Nothing of the world has to be an
 *   item. It lets go after a few seconds, drops, and is gone.
 * - **The person a thing reaches decides that it did,** on their own device, and says so. Until they have, it
 *   only looks stuck to them, and drops off if they never say so.
 * - **What it does to them is the world's rule.** Where the world has none, it takes from their health
 *   (`HEALTH`), which comes back by itself.
 *
 * Nothing here runs anything of an item on anyone's device but its carrier's. What the others get is words: a
 * thing was sent out from here, going this way.
 */
import {
  buildDid,
  buildHit,
  buildShot,
  buildState,
  cleanItemsRule,
  isPose,
  createRate,
  GRAVITY,
  HEALTH,
  meetsPerson,
  parseDid,
  parseHit,
  parseShot,
  parseState,
  PERSON_SHAPE,
  PLAY_LIMITS,
  shotAt,
  struck,
  type Item,
  type ItemSend,
  type Shot,
} from "@nswp/core";
import * as THREE from "three";
import { allowScript, mayHold, scriptAllowed } from "./hold.js";
import { runInBox, type BoxAsk, type BoxRun, type ItemBoxOptions } from "./item-box.js";
import { showsItems } from "./item-store.js";
import type { Items } from "./items.js";
import type { ForeignSound, Sounds } from "./sound.js";

/** Someone else in the room, as this needs them: where they are, what to stick things to, what they hold. */
export interface PlayPerson {
  pubkey: string;
  /** Where their head is, in the world. */
  head: THREE.Vector3;
  /** Something of theirs that moves with them, for a thing to stay stuck to. */
  body: THREE.Object3D;
  /** Their head, to put a bar over. */
  over: THREE.Object3D;
  /** The whole of their figure, which blinks while they have nothing left. */
  root?: THREE.Object3D;
  /** The item they say they hold, by its coordinate, and what is drawn for it. */
  holding: string;
  held: THREE.Object3D | null;
}

export interface PlayOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** What the visitor stands on: its height is the floor under them. */
  rig: THREE.Object3D;
  items: Items;
  sounds?: Sounds | null;
  /** What this place does with items. Nothing happens here where it is "none". */
  rule(): string;
  /** Whether an item's own logic runs in this world, and where its box is served. Left out, items are shapes. */
  scripts?: boolean | ItemBoxOptions;
  /** Who this visitor is in the room, or null while they are in none. */
  me(): string | null;
  people(): PlayPerson[];
  /** Whether this visitor has muted what that person's items do. Asked only where items are allowed, not where they are the game. */
  itemsMuted?(pubkey: string): boolean;
  /** Say something of an item in play to the room. */
  tell(said: string): void;
  /** Where a thing leaves from when this visitor sends one out, and which way. Left out, from beside their view, to where it looks. */
  aim?: () => { from: THREE.Vector3; to: THREE.Vector3 } | null;
  /** Whether a shape of the world is solid to things sent out. Left out, every mesh that can be seen is. */
  solid?: (mesh: THREE.Mesh) => boolean;
  /** Be told when a thing sticks to a shape of the world: the world's own rule decides what that means. */
  onStruck?: (what: { object: THREE.Object3D; point: THREE.Vector3; by: string; name: string }) => void;
  /** Be told when this visitor's state changes, or what their item shows. */
  onChange?: () => void;
  /** Whether they are in a headset now: there, a thing goes where the hand points, and no ring is drawn. */
  presenting?: () => boolean;
  /** The world's own colour, for what is drawn of how the visitor is, and whether things may move for them. */
  theme?: () => { accent?: string; motion?: boolean };
  /** Whether they are aiming along their item's sight now: then its own mark is what they aim by, and no ring is drawn. */
  sighting?: () => boolean;
  /**
   * The world is drawn by something else (another engine), which is the one that knows its shapes. Then nothing
   * here looks for what a thing ran into: each frame `snapshot()` says where each thing went, whatever draws the
   * world tests that, and says what it met with `met()` and where the floor is with `floored()`, a frame later.
   * Everything else is exactly as it is for a world drawn here: one flight, one set of rules.
   */
  deferred?: boolean;
  /**
   * The colours someone chose for what they hold: the visitor's own for their own key (or null, outside a room),
   * anyone else's as they said them. Left out, everything is the colour its maker gave it.
   */
  tintsOf?: (pubkey: string | null) => Record<string, string>;
}

export interface Play {
  /** This visitor took an item in hand, with what is drawn for it; or put it away, with nulls. */
  held(item: Item | null, model: THREE.Object3D | null): Promise<void>;
  /**
   * The item's first press, and its second: what they do is its own to say. With `toward`, whatever the first
   * press sends out goes that way: where a visitor tapped or clicked.
   */
  use(toward?: THREE.Vector3): void;
  second(): void;
  /** Whether what they hold does anything on a press, and what its presses are called. */
  readonly does: { use: string; second: string } | null;
  /** What their item shows of itself: its counter. */
  readonly words: string;
  /** How they are, by the rules of this place. */
  readonly health: { value: number; full: number };
  /** A member said something of an item in play. */
  heard(from: string, said: string): void;
  /** A member left: what was theirs goes with them. */
  left(pubkey: string): void;
  update(dt: number): void;
  /** For tests: what is in the air, stuck and lying, and what has happened. */
  info(): PlayInfo;
  /** Everything there is to draw this frame, as plain numbers: for a world drawn by another engine (`deferred`). */
  snapshot(): PlaySnapshot;
  /** A thing met a shape of the world, part of the way along a step `snapshot()` asked to have tested. */
  met(key: string, step: number, fraction: number, point: [number, number, number], ref?: string): void;
  /** Where the floor is under a thing that has let go. */
  floored(key: string, y: number): void;
  dispose(): void;
}

export interface PlayInfo {
  flying: number;
  stuck: number;
  falling: number;
  /** Where each thing is, and what it is stuck to: "world", a person's key, or "" in the air. */
  things: { by: string; id: number; state: string; on: string; onto: string; at: [number, number, number] }[];
  sent: number;
  /** How many of this visitor's things reached someone who said so. */
  landed: number;
  /** How many of other people's things reached this visitor. */
  taken: number;
  health: { value: number; full: number };
  words: string;
  script: "none" | "running" | "stopped";
  /** Why the script last stopped, where it did: "silent", "asked", "no box", "failed". */
  stoppedBecause: string;
  /** Whether the mark that says "you hit someone" is showing. */
  marked: boolean;
  bars: Record<string, { value: number; full: number }>;
}

/** What there is to draw, with nothing of any renderer in it. Distances are metres; a turn is x, y, z, w. */
export interface PlaySnapshot {
  things: {
    key: string;
    /** Which model: the hash its file is named by, and its box. */
    model: string;
    size: [number, number, number];
    /** The colours whoever sent it chose. */
    tints: Record<string, string>;
    state: "flying" | "stuck" | "falling" | "lying";
    /** What it is stuck to: "world", a person's key, or "". And what the engine said it met, where it said. */
    on: string;
    ref: string;
    at: [number, number, number];
    turn: [number, number, number, number];
    scale: number;
    /**
     * A step to test against the world's shapes: from `a` to `b`. Null where there is nothing to test. A thing
     * falls as it flies, so a step that took a while is a curve: `via` is then the places it passed between the
     * two, evenly spaced in time. Test from `a` through each to `b`, in order, and say how far along the whole
     * step the first meeting was (a meeting half way along the second of four pieces is 0.375).
     */
    test: { step: number; a: [number, number, number]; b: [number, number, number]; via?: [number, number, number][] } | null;
    /** It has let go and is falling: where is the floor under it? */
    down: boolean;
  }[];
  /** A streak of light behind a thing: points along its middle, each with how bright it is there, from 0 to 1. */
  trails: { key: string; color: string; width: number; points: [number, number, number, number][] }[];
  own: {
    /** The ring that says where a thing will go, and the mark that says one reached someone. */
    cross: boolean;
    mark: boolean;
    /** How they are, and how much of the bar to show, from 0 to 1. */
    health: { value: number; full: number; growing: number; down: boolean; shown: number };
    /** How red the edge of the view is, from 0 to 1, and whether the view is breaking up. */
    red: number;
    glitch: boolean;
    /** What their item shows of itself. */
    words: string;
  };
  /** Animations of an item's own that began since the last snapshot: whose ("" for the visitor's own), and which. */
  clips: { who: string; name: string }[];
}

interface Thing {
  by: string;
  shot: Shot;
  send: ItemSend;
  item: Item;
  object: THREE.Object3D;
  t: number;
  state: "flying" | "stuck" | "falling" | "lying";
  /** What it is stuck to: "world", or a person's key. */
  on: string;
  /** While it is stuck to someone who hasn't yet said it reached them: when to give up, in seconds of its life. */
  agreeBy: number | null;
  /** Whether the person it reached has said so. */
  agreed: boolean;
  /** The streak of light behind it, where its item gives it one, and how far into its flight it stopped. */
  trail: THREE.Mesh | null;
  trailSeconds: number;
  landedAt: number | null;
  /** The colours it was sent in. */
  tints: Record<string, string>;
  /** In a world drawn by another engine: the steps it has taken that are still to be answered for, what it was
   * said to have met, and whether the floor under it has been said. */
  steps: { n: number; t0: number; t1: number }[];
  stepNo: number;
  late: { t: number; point: THREE.Vector3; ref: string } | null;
  ref: string;
  flooredAt: boolean;
  until: number;
  fall: number;
  floor: number;
}

export { allowScript, mayHold, scriptAllowed };

/** A flat picture that always faces the viewer, drawn by a small function. */
function drawn(width: number, height: number, paint: (g: CanvasRenderingContext2D) => void): THREE.Sprite {
  if (typeof document === "undefined") {
    // Nothing to draw on (a test): the thing is there, and blank.
    const blank = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
    blank.userData.nswpNoHit = true;
    return blank;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (g) paint(g);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false }));
  sprite.renderOrder = 999;
  sprite.userData.nswpNoHit = true;
  return sprite;
}
const repaint = (sprite: THREE.Sprite, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void): void => {
  const map = sprite.material.map as THREE.CanvasTexture | null;
  if (!map) return;
  const canvas = map.image as HTMLCanvasElement;
  const g = canvas.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, canvas.width, canvas.height);
  paint(g, canvas.width, canvas.height);
  map.needsUpdate = true;
};
/**
 * How someone is, drawn the way the rest of the kit's controls are: a dark glass pill with an edge of the world's
 * own colour, a small heart, and a block for each of what they have. The block that is coming back fills as it
 * comes. With nothing left it says so, in the colour of a warning.
 */
const WARN = "#ff5d52";
export const paintHealth = (g: CanvasRenderingContext2D, w: number, h: number, o: { value: number; full: number; accent: string; growing?: number; down?: boolean; heart?: boolean }): void => {
  const low = o.value <= Math.ceil(o.full / 3);
  const ink = o.down || low ? WARN : o.accent;
  g.fillStyle = "rgba(10,12,16,0.8)";
  g.beginPath();
  g.roundRect(1.5, 1.5, w - 3, h - 3, (h - 3) / 2);
  g.fill();
  g.globalAlpha = 0.5;
  g.strokeStyle = ink;
  g.lineWidth = 2.5;
  g.stroke();
  g.globalAlpha = 1;
  let x0 = h * 0.42;
  if (o.heart !== false) {
    // A heart, at the left: two rounds and a point.
    const [cx, cy, r] = [h * 0.56, h * 0.47, h * 0.13];
    g.fillStyle = ink;
    g.beginPath();
    g.arc(cx - r, cy, r, Math.PI, 0);
    g.arc(cx + r, cy, r, Math.PI, 0);
    g.lineTo(cx, cy + r * 2.5);
    g.closePath();
    g.fill();
    x0 = h * 1.02;
  }
  const x1 = w - h * 0.42;
  if (o.down) {
    g.fillStyle = WARN;
    g.font = `600 ${Math.round(h * 0.42)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("Tagged out", (x0 + x1) / 2, h / 2 + 1, x1 - x0);
    return;
  }
  const gap = h * 0.11;
  const each = (x1 - x0 - gap * (o.full - 1)) / o.full;
  const [top, tall] = [h * 0.3, h * 0.4];
  for (let i = 0; i < o.full; i++) {
    const x = x0 + i * (each + gap);
    g.fillStyle = "rgba(255,255,255,0.14)";
    g.beginPath();
    g.roundRect(x, top, each, tall, tall / 3);
    g.fill();
    const part = i < o.value ? 1 : i === o.value ? Math.max(0, Math.min(1, o.growing ?? 0)) : 0;
    if (part <= 0) continue;
    g.globalAlpha = i < o.value ? 1 : 0.55;
    g.fillStyle = ink;
    g.beginPath();
    g.roundRect(x, top, Math.max(tall / 2, each * part), tall, tall / 3);
    g.fill();
    g.globalAlpha = 1;
  }
};

/**
 * The places a thing passed between two moments of its flight, for an engine that tests its path a frame at a
 * time: none where the frame was short, and otherwise one every few hundredths of a second, so that the pieces
 * tested are as short on a device drawing five frames a second as on one drawing sixty.
 */
function viaOf(shot: Shot, t0: number, t1: number): { via?: [number, number, number][] } {
  const pieces = Math.min(24, Math.ceil((t1 - t0) / 0.03 - 1e-9));
  if (!(pieces > 1)) return {};
  return { via: Array.from({ length: pieces - 1 }, (_, i) => shotAt(shot, t0 + ((t1 - t0) * (i + 1)) / pieces)) };
}

export function createPlay(o: PlayOptions): Play {
  const things: Thing[] = [];
  /** Things said to have been sent out whose shape is still being fetched. */
  const pending = new Set<string>();
  /**
   * Things already taken from each sender, and when: by sender and number. A thing is said twice, a moment apart,
   * and one that reaches someone close by is over and gone before the second saying arrives. Without this the
   * second would be a new thing, and would reach them again.
   */
  const heardShots = new Map<string, number>();
  const rates = new Map<string, ReturnType<typeof createRate>>();
  const bars = new Map<string, { value: number; full: number; sprite: THREE.Sprite; until: number }>();
  /** Whose figure is blinking, to put it right again after. */
  const blinking = new Set<string>();
  const mixers = new Map<THREE.Object3D, THREE.AnimationMixer>();
  const soundsOf = new Map<string, Promise<ForeignSound | null>>();
  const ray = new THREE.Raycaster();
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  let clock = 0;
  let lastAt: number | null = null;
  let sent = 0;
  let landed = 0;
  let taken = 0;
  let nextId = Math.floor(Math.random() * 1000);

  const active = () => cleanItemsRule(o.rule()) !== "none" && showsItems();
  /** Muting is for a place that only allows items. Where they are the game, nobody is out of their reach. */
  const muted = (pubkey: string) => cleanItemsRule(o.rule()) === "allowed" && !!o.itemsMuted?.(pubkey);

  // ---------------------------------------------------------------- what this visitor sees of themself
  const hud = new THREE.Group();
  hud.userData.nswpNoHit = true;
  // In a world drawn by another engine nothing here is drawn: these are kept as the state of what to draw there.
  if (!o.deferred) o.camera.add(hud);
  const cross = drawn(64, 64, (g) => {
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(32, 32, 9, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(31, 31, 2, 2);
  });
  cross.position.set(0, 0, -1);
  cross.scale.setScalar(0.035);
  cross.visible = false;
  const mark = drawn(64, 64, (g) => {
    g.strokeStyle = "#ffffff";
    g.lineWidth = 6;
    g.lineCap = "round";
    for (const [a, b, c, e] of [[10, 10, 24, 24], [54, 10, 40, 24], [10, 54, 24, 40], [54, 54, 40, 40]] as const) {
      g.beginPath();
      g.moveTo(a, b);
      g.lineTo(c, e);
      g.stroke();
    }
  });
  mark.position.set(0, 0, -1);
  mark.scale.setScalar(0.07);
  mark.visible = false;
  let markUntil = 0;
  const accent = (): string => o.theme?.().accent ?? "#7be495";
  /** Whether things may move for this visitor: not where they asked for none of it, and gently in a headset. */
  const lively = (): boolean => (o.theme?.().motion ?? true) && !isPresenting();
  const own = { value: HEALTH.full as number, full: HEALTH.full as number, struckAt: -1e9, downUntil: 0, shownUntil: 0, regenAt: 0, flash: 0, painted: -1, shown: 0 };
  const ownBar = drawn(384, 64, (g) => paintHealth(g, 384, 64, { value: own.value, full: own.full, accent: accent() }));
  ownBar.scale.set(0.3, 0.05, 1);
  ownBar.material.opacity = 0;
  ownBar.visible = false;
  // The edge of the view, reddened for a moment when something reaches them, and while they have next to nothing.
  const edge = drawn(256, 256, (g) => {
    const fade = g.createRadialGradient(128, 128, 70, 128, 128, 180);
    fade.addColorStop(0, "rgba(255,70,60,0)");
    fade.addColorStop(1, "rgba(255,70,60,0.95)");
    g.fillStyle = fade;
    g.fillRect(0, 0, 256, 256);
  });
  edge.position.set(0, 0, -0.6);
  edge.renderOrder = 997;
  edge.visible = false;
  // With nothing left, the view breaks up for a moment: bands of light that jump about. Not for anyone who has
  // asked for stillness, and not in a headset.
  const glitch = drawn(8, 128, (g) => {
    for (let y = 0; y < 128; ) {
      const tall = 1 + Math.floor(Math.random() * 7);
      const kind = Math.random();
      g.fillStyle = kind < 0.55 ? "rgba(0,0,0,0)" : kind < 0.75 ? "rgba(255,255,255,0.5)" : kind < 0.9 ? "rgba(80,240,255,0.45)" : "rgba(255,70,160,0.45)";
      g.fillRect(0, y, 8, tall);
      y += tall;
    }
  });
  if (glitch.material.map) glitch.material.map.wrapT = THREE.RepeatWrapping;
  glitch.position.set(0, 0, -0.58);
  glitch.renderOrder = 998;
  glitch.visible = false;
  hud.add(cross, mark, ownBar, edge, glitch);
  const paintOwn = (): void => {
    const down = own.downUntil > 0;
    const growing = own.regenAt ? (clock - own.regenAt) / HEALTH.regenSeconds : 0;
    repaint(ownBar, (g, cw, ch) => paintHealth(g, cw, ch, { value: own.value, full: own.full, accent: accent(), growing, down }));
    own.painted = clock;
  };

  const sayState = () => {
    const said = buildState({ name: "health", value: own.value, full: own.full });
    if (said && o.me()) o.tell(said);
    paintOwn();
    own.shownUntil = clock + 2.5;
    o.onChange?.();
  };

  // ---------------------------------------------------------------- an item's own sounds and animations
  const soundOf = (item: Item, name: string): Promise<ForeignSound | null> => {
    const named = item.sounds[name];
    if (!named || !o.sounds) return Promise.resolve(null);
    let got = soundsOf.get(named.sha256);
    if (!got) {
      got = o.items.sound(item, name).then((bytes) => (bytes && o.sounds ? o.sounds.decode(bytes) : null));
      soundsOf.set(named.sha256, got);
    }
    return got;
  };
  /**
   * A sound may have more takes than one: `impact`, and beside it `impact-2` up to `impact-4`. One is chosen each
   * time, and not the same twice running, so that five darts landing don't sound like one dart five times.
   */
  const lastTake = new Map<string, string>();
  const take = (item: Item, name: string): string => {
    const takes = [name, ...[2, 3, 4].map((n) => `${name}-${n}`)].filter((n) => item.sounds[n]);
    if (takes.length < 2) return name;
    const others = takes.filter((n) => n !== lastTake.get(`${item.id}:${name}`));
    const chosen = others[Math.floor(Math.random() * others.length)]!;
    lastTake.set(`${item.id}:${name}`, chosen);
    return chosen;
  };
  /** Heard from where it happened: quieter and duller the further off, and not at all a long way away. */
  const hear = (item: Item, said: string | undefined, at: THREE.Vector3 | null): void => {
    if (!said || !o.sounds || !active()) return;
    const name = take(item, said);
    void soundOf(item, name).then((sound) => {
      if (!sound || !o.sounds) return;
      if (!at) return o.sounds.playForeign(sound);
      o.camera.getWorldPosition(v);
      const to = w.copy(at).sub(v);
      const distance = to.length();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(o.camera.getWorldQuaternion(new THREE.Quaternion()));
      const pan = distance < 0.01 ? 0 : THREE.MathUtils.clamp(to.normalize().dot(right), -1, 1) * Math.min(1, distance / 1.5);
      o.sounds.playForeign(sound, { distance, pan });
    });
  };
  /** The pose each thing was last put in. */
  const poses = new WeakMap<THREE.Object3D, THREE.AnimationAction>();
  /** Animations begun since the last snapshot, for a world drawn by another engine to play on what it drew. */
  let clipsSaid: { who: string; name: string }[] = [];
  const animate = (item: Item, model: THREE.Object3D | null, name: string, who = ""): void => {
    if (o.deferred && clipsSaid.length < 16) clipsSaid.push({ who, name });
    if (!model) return;
    const clip = o.items.clips(item).find((c) => c.name === name);
    if (!clip) return;
    let mixer = mixers.get(model);
    if (!mixer) {
      mixer = new THREE.AnimationMixer(model);
      mixers.set(model, mixer);
    }
    const action = mixer.clipAction(clip);
    // A pose stays as it ended, and takes the place of the pose before it. Anything else is a moment: played
    // once, over whatever pose the thing is in, and gone.
    const pose = isPose(name);
    if (pose) {
      const was = poses.get(model);
      if (was && was !== action) was.stop();
      poses.set(model, action);
    }
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = pose;
    action.play();
  };

  // ---------------------------------------------------------------- the shapes of the world
  let solids: THREE.Object3D[] = [];
  let solidsAt = -1e9;
  const worldShapes = (): THREE.Object3D[] => {
    if (clock - solidsAt < 1.5) return solids;
    solidsAt = clock;
    const found: THREE.Object3D[] = [];
    const walk = (node: THREE.Object3D): void => {
      // Not the visitor's own rig, not a person, not anything that says it isn't solid, and nothing unseen.
      if (node === o.rig || node === o.camera || node.userData.nswpNoHit || !node.visible) return;
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material | undefined;
        // A sky is drawn from the inside, and a glow lets what is behind it through: neither is a thing to hit.
        const shape = material && material.side !== THREE.BackSide && !(material.transparent && material.opacity < 0.35) && material.blending !== THREE.AdditiveBlending;
        if (shape && (o.solid ? o.solid(mesh) : true)) found.push(mesh);
      }
      for (const child of node.children) walk(child);
    };
    walk(o.scene);
    solids = found;
    return solids;
  };
  const floorUnder = (at: THREE.Vector3): number => {
    ray.set(w.set(at.x, at.y + 0.05, at.z), new THREE.Vector3(0, -1, 0));
    ray.far = 60;
    const hit = ray.intersectObjects(worldShapes(), false)[0];
    return hit ? hit.point.y : o.rig.getWorldPosition(new THREE.Vector3()).y;
  };

  // ---------------------------------------------------------------- things in the air
  const drop = (thing: Thing): void => {
    if (thing.state === "falling" || thing.state === "lying") return;
    o.scene.attach(thing.object);
    thing.state = "falling";
    thing.fall = 0;
    // Where another engine draws the world it says where the floor is, a frame on: until then, the visitor's own.
    thing.floor = o.deferred ? o.rig.getWorldPosition(new THREE.Vector3()).y : floorUnder(thing.object.getWorldPosition(new THREE.Vector3()));
  };
  // ---- A streak of light behind a thing, along the arc it flew: a ribbon that always faces the viewer, bright at
  // the thing and fading to nothing behind it. It is worked out from the same arc the thing flies on, so it bends
  // exactly as the flight did, and it draws itself in after the thing has stopped.
  const TRAIL_STEPS = 14;
  const TRAIL_WIDTH = 0.026;
  const makeTrail = (color: string): THREE.Mesh => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array((TRAIL_STEPS + 1) * 6), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array((TRAIL_STEPS + 1) * 6), 3));
    const index: number[] = [];
    for (let i = 0; i < TRAIL_STEPS; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    mesh.frustumCulled = false;
    mesh.userData.nswpNoHit = true;
    mesh.userData.base = new THREE.Color(color);
    o.scene.add(mesh);
    return mesh;
  };
  const dropTrail = (thing: Thing): void => {
    if (!thing.trail) return;
    thing.trail.removeFromParent();
    thing.trail.geometry.dispose();
    (thing.trail.material as THREE.Material).dispose();
    thing.trail = null;
  };
  const eye = new THREE.Vector3();
  const drawTrail = (thing: Thing): void => {
    const mesh = thing.trail;
    if (!mesh) return;
    const head = thing.landedAt ?? thing.t;
    const tail = Math.max(0, thing.t - thing.trailSeconds);
    if (tail >= head - 1e-4) return thing.landedAt === null ? void (mesh.visible = false) : dropTrail(thing);
    mesh.visible = true;
    o.camera.getWorldPosition(eye);
    const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const color = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    const base = mesh.userData.base as THREE.Color;
    // How much of its full length is left: as it draws itself in, it dims as well.
    const left = Math.min(1, (head - tail) / thing.trailSeconds);
    const p = new THREE.Vector3();
    const q = new THREE.Vector3();
    const side = new THREE.Vector3();
    for (let i = 0; i <= TRAIL_STEPS; i++) {
      const f = i / TRAIL_STEPS;
      const t = head - (head - tail) * f;
      p.fromArray(shotAt(thing.shot, t));
      q.fromArray(shotAt(thing.shot, Math.max(0, t - 0.01)));
      side.copy(p).sub(q).cross(w.copy(eye).sub(p)).normalize().multiplyScalar((TRAIL_WIDTH / 2) * (1 - f * 0.85));
      position.setXYZ(i * 2, p.x + side.x, p.y + side.y, p.z + side.z);
      position.setXYZ(i * 2 + 1, p.x - side.x, p.y - side.y, p.z - side.z);
      const bright = (1 - f) ** 1.6 * (0.35 + 0.65 * left);
      color.setXYZ(i * 2, base.r * bright, base.g * bright, base.b * bright);
      color.setXYZ(i * 2 + 1, base.r * bright, base.g * bright, base.b * bright);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
  };
  const gone = (thing: Thing): void => {
    dropTrail(thing);
    thing.object.removeFromParent();
    const at = things.indexOf(thing);
    if (at >= 0) things.splice(at, 1);
  };
  const launch = async (by: string, item: Item, shot: Shot): Promise<void> => {
    const send = item.sends.find((s) => s.name === shot.name);
    if (!send || !active()) return;
    const born = clock;
    pending.add(`${by}:${shot.id}`);
    // In the colours whoever sent it chose for the item it came from.
    const tints = o.tintsOf?.(by === (o.me() ?? "") ? null : by) ?? {};
    const inner = await o.items.sent(item, shot.name, tints);
    if (!active()) return void pending.delete(`${by}:${shot.id}`);
    // A model stands on its base. In the air it is carried by its middle, pointing the way it goes.
    inner.position.y -= send.size[1] / 2;
    const object = new THREE.Group();
    object.userData.nswpNoHit = true;
    object.add(inner);
    object.position.fromArray(shot.from);
    o.scene.add(object);
    while (things.length >= PLAY_LIMITS.flown) gone(things[0]!);
    const trailSeconds = send.trail ?? 0;
    // Its trail is the colour of the tint that has the thing's own name: a dart's, for a dart.
    const trailColor = tints[send.name] ?? item.tints.find((t) => t.slot === send.name)?.color ?? "#ffffff";
    const thing: Thing = { by, shot, send, item, object, t: 0, state: "flying", on: "", agreeBy: null, agreed: false, until: 0, fall: 0, floor: 0, trail: trailSeconds > 0 ? makeTrail(trailColor) : null, trailSeconds, landedAt: null, tints, steps: [], stepNo: 0, late: null, ref: "", flooredAt: false };
    things.push(thing);
    pending.delete(`${by}:${shot.id}`);
    // Its shape took a moment to fetch: it is flown on to where it would be by now, a little at a time, so that it
    // can't have passed through anything on the way.
    const late = Math.min(PLAY_LIMITS.life, clock - born);
    while (thing.state === "flying" && things.includes(thing) && thing.t < late) fly(thing, Math.min(0.03, late - thing.t + 1e-6));
  };
  const stick = (thing: Thing, at: THREE.Vector3, onto: THREE.Object3D | null, on: string): void => {
    thing.object.position.copy(at);
    const going = new THREE.Vector3(thing.shot.velocity[0], thing.shot.velocity[1] - GRAVITY * thing.t, thing.shot.velocity[2]);
    if (going.lengthSq() > 1e-6) thing.object.lookAt(w.copy(at).add(going));
    if (onto) onto.attach(thing.object);
    thing.state = "stuck";
    thing.on = on;
    thing.until = thing.t + thing.shot.stick;
  };

  /** This visitor, as a shape for things to reach: where their feet are, and how tall they stand. */
  const self = (): { feet: THREE.Vector3; height: number } => {
    const head = o.camera.getWorldPosition(new THREE.Vector3());
    const floor = o.rig.getWorldPosition(new THREE.Vector3()).y;
    return { feet: new THREE.Vector3(head.x, floor, head.z), height: THREE.MathUtils.clamp(head.y - floor + 0.12, 0.6, 2.4) };
  };
  /** Someone else, as far as can be told from where their head is. They are the one who really decides. */
  const shapeOf = (p: PlayPerson): { feet: THREE.Vector3; height: number } => ({ feet: new THREE.Vector3(p.head.x, p.head.y - 1.5, p.head.z), height: 1.62 });

  /** A thing reached this visitor: by the rules of this place, it takes from their health, and they say so. */
  const reached = (thing: Thing, at: THREE.Vector3): void => {
    const me = self();
    taken++;
    const effect = thing.item.effects.find((e) => e.of === thing.shot.name && e.state === "health");
    const said = buildHit({ by: thing.by, id: thing.shot.id, at: [at.x - me.feet.x, at.y - me.feet.y, at.z - me.feet.z] });
    if (said) o.tell(said);
    hear(thing.item, thing.send.strikes, null);
    if (effect && clock >= own.downUntil) {
      own.value = struck(own.value, effect.take);
      own.struckAt = clock;
      own.regenAt = 0;
      own.flash = 1;
      if (own.value === 0) own.downUntil = clock + HEALTH.downSeconds;
      sayState();
    }
    // It is on them, where they can't see it: it is simply gone for them.
    gone(thing);
  };

  const fly = (thing: Thing, dt: number): void => {
    const a = new THREE.Vector3().fromArray(shotAt(thing.shot, thing.t));
    const b = new THREE.Vector3().fromArray(shotAt(thing.shot, thing.t + dt));
    const step = b.clone().sub(a);
    const length = step.length();
    let first = 1.0001;
    let done: (() => void) | null = null;
    // In a world drawn by another engine, that engine said what an earlier step met: it stops there.
    if (o.deferred && thing.late) {
      const late = thing.late;
      thing.late = null;
      thing.landedAt = late.t;
      thing.ref = late.ref;
      stick(thing, late.point, null, "world");
      hear(thing.item, thing.send.lands, late.point);
      return;
    }
    // The shapes of the world.
    if (!o.deferred && length > 1e-6) {
      ray.set(a, step.clone().divideScalar(length));
      ray.far = length;
      const hit = ray.intersectObjects(worldShapes(), false)[0];
      if (hit) {
        first = hit.distance / length;
        done = () => {
          stick(thing, hit.point, hit.object, "world");
          hear(thing.item, thing.send.lands, hit.point);
          o.onStruck?.({ object: hit.object, point: hit.point.clone(), by: thing.by, name: thing.shot.name });
        };
      }
    }
    const me = o.me();
    // This visitor: they decide, here, whether somebody else's thing reached them.
    if (me && thing.by !== me && !muted(thing.by)) {
      const mine = self();
      const t = meetsPerson(a.toArray(), b.toArray(), mine.feet.toArray(), mine.height, PERSON_SHAPE.radius);
      if (t !== null && t < first) {
        first = t;
        done = () => reached(thing, a.clone().addScaledVector(step, t));
      }
    }
    // Everyone else: it looks stuck to them at once, and stays if they say it reached them.
    for (const p of o.people()) {
      if (p.pubkey === thing.by) continue;
      const shape = shapeOf(p);
      const t = meetsPerson(a.toArray(), b.toArray(), shape.feet.toArray(), shape.height, PERSON_SHAPE.radius);
      if (t !== null && t < first) {
        first = t;
        done = () => {
          stick(thing, a.clone().addScaledVector(step, t), p.body, p.pubkey);
          thing.agreeBy = thing.t + PLAY_LIMITS.agree;
        };
      }
    }
    const before = thing.t;
    thing.t += dt;
    if (done) {
      // Where along this step it stopped: its trail ends there, and not a step further on.
      thing.landedAt = before + dt * Math.min(1, first);
      return done();
    }
    thing.object.position.copy(b);
    const going = new THREE.Vector3(thing.shot.velocity[0], thing.shot.velocity[1] - GRAVITY * thing.t, thing.shot.velocity[2]);
    thing.object.lookAt(w.copy(b).add(going));
    if (thing.t > PLAY_LIMITS.life) gone(thing);
  };

  // ---------------------------------------------------------------- this visitor's own item
  let item: Item | null = null;
  let model: THREE.Object3D | null = null;
  let box: BoxRun | null = null;
  let scriptState: PlayInfo["script"] = "none";
  let stoppedBecause = "";
  let words = "";
  let wordsSprite: THREE.Sprite | null = null;
  let holdingNo = 0;
  const showWords = (text: string): void => {
    words = text;
    if (wordsSprite) {
      repaint(wordsSprite, (g, cw, ch) => {
        if (!text) return;
        g.font = '600 44px system-ui, sans-serif';
        g.textAlign = "center";
        g.textBaseline = "middle";
        const wide = Math.min(cw - 8, g.measureText(text).width + 36);
        g.fillStyle = "rgba(8,10,14,0.72)";
        g.beginPath();
        g.roundRect((cw - wide) / 2, 6, wide, ch - 12, 18);
        g.fill();
        g.fillStyle = "#ffffff";
        g.fillText(text, cw / 2, ch / 2 + 2, cw - 24);
      });
    }
    o.onChange?.();
  };
  /**
   * Where the next thing sent out is to go, after a tap or a click said so. It belongs to that press: the next
   * thing the item sends out takes it, and the next press of any kind replaces it. It is not a moment of time.
   * The item's own logic answers from its locked box when it can, and on a device that is struggling that may be
   * a second or more later: timed (in frames at first, then on the clock), a tap there sent its thing to the
   * middle of the view instead of where it was pressed. The limit left is only so that something forgotten
   * can't aim a thing sent out long afterwards.
   */
  let pointed: { to: THREE.Vector3; until: number } | null = null;
  const wall = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const aim = (lift: number, spread = 0): { from: THREE.Vector3; dir: THREE.Vector3 } => {
    const said = o.aim?.();
    let from: THREE.Vector3;
    let to: THREE.Vector3;
    const tapped = pointed && wall() < pointed.until ? pointed.to : null;
    pointed = null;
    if (said) ({ from, to } = said);
    else if (tapped || o.sighting?.()) {
      // Where they tapped or clicked; or, aiming along the sight, straight out through its mark.
      const q = o.camera.getWorldQuaternion(new THREE.Quaternion());
      const eye = o.camera.getWorldPosition(new THREE.Vector3());
      from = eye.clone().add(new THREE.Vector3(tapped ? 0.14 : 0, tapped ? -0.12 : -0.05, -0.35).applyQuaternion(q));
      to = tapped ?? eye.clone().add(new THREE.Vector3(0, 0, -18).applyQuaternion(q));
    }
    else {
      // From just beside the view, toward the middle of what it looks at: a thing lands where the ring is.
      const q = o.camera.getWorldQuaternion(new THREE.Quaternion());
      const eye = o.camera.getWorldPosition(new THREE.Vector3());
      from = eye.clone().add(new THREE.Vector3(0.14, -0.12, -0.35).applyQuaternion(q));
      to = eye.clone().add(new THREE.Vector3(0, 0, -18).applyQuaternion(q));
    }
    const dir = to.clone().sub(from).normalize();
    if (lift) dir.applyAxisAngle(new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), lift);
    if (spread > 0) {
      // Thrown off a little, anywhere within a small circle round where it was aimed: no two go quite the same
      // way. Worked out here, once, and sent as where it really went: so everyone sees the same flight.
      const across = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      if (across.lengthSq() < 1e-6) across.set(1, 0, 0);
      across.normalize();
      const over = new THREE.Vector3().crossVectors(across, dir).normalize();
      const off = spread * Math.sqrt(Math.random());
      const round = Math.random() * Math.PI * 2;
      dir.applyAxisAngle(over, off * Math.cos(round)).applyAxisAngle(across, off * Math.sin(round)).normalize();
    }
    return { from, dir };
  };
  const asked = (ask: BoxAsk): void => {
    if (!item || !active()) return;
    if (ask.ask === "show") return showWords(ask.text);
    if (ask.ask === "play") {
      if (!item.sounds[ask.name]) return;
      hear(item, ask.name, null);
      const said = buildDid({ kind: "sound", name: ask.name });
      if (said && o.me()) o.tell(said);
      return;
    }
    if (ask.ask === "clip") {
      animate(item, model, ask.name);
      const said = buildDid({ kind: "clip", name: ask.name });
      if (said && o.me()) o.tell(said);
      return;
    }
    if (ask.ask !== "send" || !item.sends.some((s) => s.name === ask.name)) return;
    const { from, dir } = aim(ask.lift, ask.spread);
    const shot: Shot = { id: nextId++, name: ask.name, from: from.toArray() as Shot["from"], velocity: dir.multiplyScalar(ask.speed).toArray() as Shot["velocity"], stick: ask.stick };
    const said = buildShot(shot);
    const read = said ? parseShot(said) : null;
    if (!said || !read) return;
    sent++;
    // Flown here from the same words everyone else gets, so everyone sees the same flight.
    void launch(o.me() ?? "", item, read);
    if (o.me()) o.tell(said);
  };

  const refreshOwn = (): void => {
    // The ring that says where a thing will go: only while something that sends things out is in hand.
    cross.visible = !!item && !!box && !!item.does.use && active() && !isPresenting() && !o.sighting?.();
  };
  const isPresenting = (): boolean => !!o.presenting?.();

  return {
    async held(next, drawnFor) {
      const no = ++holdingNo;
      if (box) {
        box.tell("away");
        const old = box;
        box = null;
        setTimeout(() => old.stop(), 250);
      }
      if (model) mixers.delete(model);
      wordsSprite?.removeFromParent();
      wordsSprite = null;
      item = next;
      model = drawnFor;
      scriptState = "none";
      stoppedBecause = "";
      words = "";
      refreshOwn();
      o.onChange?.();
      if (!next || !drawnFor || !active()) return;
      if (next.does.use || next.script) {
        wordsSprite = drawn(256, 72, () => {});
        wordsSprite.scale.set(0.1, 0.028, 1);
        wordsSprite.position.set(0, next.size[1] + 0.028, 0);
        drawnFor.add(wordsSprite);
      }
      // What it sends out and what it sounds like are fetched now, so the first one isn't late.
      for (const s of next.sends) void o.items.sent(next, s.name);
      for (const name of Object.keys(next.sounds)) void soundOf(next, name);
      if (!next.script || !o.scripts || !scriptAllowed(next.script.sha256)) return;
      const text = await o.items.script(next);
      if (!text || no !== holdingNo) return;
      // A box that ends is this item's box: one put away a moment ago, ending late, must not be taken for the one
      // that has just been taken in hand.
      const run = await runInBox(
        text,
        {
          ask: (ask) => void (no === holdingNo && asked(ask)),
          stopped: (why) => {
            if (no !== holdingNo) return;
            scriptState = "stopped";
            stoppedBecause = why;
            box = null;
            showWords("");
          },
        },
        typeof o.scripts === "object" ? o.scripts : {},
      );
      if (no !== holdingNo) return run?.stop();
      box = run;
      scriptState = run ? "running" : "stopped";
      if (!run) stoppedBecause = "no box";
      run?.tell("held");
      o.onChange?.();
    },
    use(toward) {
      if (!active() || !box) return;
      pointed = toward ? { to: toward.clone(), until: wall() + 10_000 } : null;
      box.tell("use");
    },
    second() {
      // Another press: whatever an earlier one pointed at is no longer where anything goes.
      pointed = null;
      if (active()) box?.tell("second");
    },
    get does() {
      return item && box && (item.does.use || item.does.second) ? { use: item.does.use ?? "", second: item.does.second ?? "" } : null;
    },
    get words() {
      return words;
    },
    get health() {
      return { value: own.value, full: own.full };
    },
    heard(from, said) {
      if (!active() || muted(from)) return;
      const person = o.people().find((p) => p.pubkey === from);
      if (!person) return;
      const state = parseState(said);
      if (state) {
        let shown = bars.get(from);
        if (!shown) {
          const sprite = drawn(320, 56, () => {});
          sprite.scale.set(0.44, 0.077, 1);
          sprite.position.set(0, 0.62, 0);
          shown = { value: state.value, full: state.full, sprite, until: 0 };
          bars.set(from, shown);
        }
        shown.value = state.value;
        shown.full = Math.min(state.full, 12);
        shown.until = clock + (state.value < state.full ? 30 : 2);
        person.over.add(shown.sprite);
        repaint(shown.sprite, (g, cw, ch) => paintHealth(g, cw, ch, { value: Math.min(shown!.value, shown!.full), full: shown!.full, accent: accent(), down: shown!.value === 0, heart: false }));
        return;
      }
      const hit = parseHit(said);
      if (hit) {
        // They say one of somebody's things reached them. It stays on them; whoever sent it is told it landed.
        // Only of a thing that really was sent out and is still about, and only once: nobody can say they were
        // reached by something that never flew.
        const thing = things.find((t) => t.by === hit.by && t.shot.id === hit.id);
        if (!thing || thing.agreed || thing.state === "falling" || thing.state === "lying") return;
        thing.agreed = true;
        const feet = shapeOf(person).feet;
        const at = new THREE.Vector3(feet.x + hit.at[0], feet.y + hit.at[1], feet.z + hit.at[2]);
        if (thing.on !== from) stick(thing, at, person.body, from);
        thing.agreeBy = null;
        hear(thing.item, thing.send.strikes, at);
        if (hit.by === o.me()) {
          hear(thing.item, thing.send.tells, null);
          landed++;
          mark.visible = true;
          markUntil = clock + 0.22;
          o.onChange?.();
        }
        return;
      }
      if (!person.holding) return;
      const did = parseDid(said);
      const shot = did ? null : parseShot(said);
      if (!did && !shot) return;
      if (shot) {
        // No more of them than anyone may send, and each only once.
        let rate = rates.get(from);
        if (!rate) rates.set(from, (rate = createRate(PLAY_LIMITS.burst, PLAY_LIMITS.perSecond)));
        // Said twice, because the channel may lose one: the second is the same thing, and counts for nothing.
        if (pending.has(`${from}:${shot.id}`) || heardShots.has(`${from}:${shot.id}`) || things.some((t) => t.by === from && t.shot.id === shot.id)) return;
        if (!rate.take(clock * 1000)) return;
        // It leaves from where they are: a thing said to start far from its sender isn't theirs to send.
        if (person.head.distanceTo(v.fromArray(shot.from)) > 3) return;
      }
      if (shot) {
        // Remembered for as long as a second saying could still come, and no longer.
        heardShots.set(`${from}:${shot.id}`, clock);
        if (heardShots.size > 256) for (const [key, at] of heardShots) if (clock - at > 10) heardShots.delete(key);
      }
      const does = (holding: Item | null): void => {
        if (!holding) return;
        if (did?.kind === "sound") hear(holding, holding.sounds[did.name] ? did.name : undefined, person.head);
        else if (did) animate(holding, person.held, did.name, from);
        // Only one of the things the item in their hand says it sends out.
        else if (shot) void launch(from, holding, shot);
      };
      // What they hold may not have been read yet, where they have only just been seen: it is read first, then.
      const known = o.items.known(person.holding);
      if (known) does(known);
      else {
        if (shot) pending.add(`${from}:${shot.id}`);
        const born = clock;
        void o.items.describe(person.holding).then((found) => {
          if (shot) pending.delete(`${from}:${shot.id}`);
          // A sound that is late is a wrong one: only a thing sent out is still worth showing, a little on its way.
          if (found && (shot ? clock - born < 2 : clock - born < 0.3)) does(found);
        });
      }
    },
    left(pubkey) {
      for (const thing of [...things]) if (thing.by === pubkey || thing.on === pubkey) gone(thing);
      bars.get(pubkey)?.sprite.removeFromParent();
      bars.delete(pubkey);
      rates.delete(pubkey);
      for (const key of heardShots.keys()) if (key.startsWith(`${pubkey}:`)) heardShots.delete(key);
    },
    update(frame) {
      // By the real clock, not by how the page counts its frames: a page drawing slowly, or one that caps the
      // step it hands on, would otherwise leave a dart stuck for longer than it says and health slow to return.
      const at = typeof performance === "undefined" ? null : performance.now();
      const dt = at === null || lastAt === null ? frame : Math.min(1, Math.max(0, (at - lastAt) / 1000));
      lastAt = at;
      clock += dt;
      for (const mixer of mixers.values()) mixer.update(dt);
      if (mark.visible && clock > markUntil) mark.visible = false;
      refreshOwn();
      // Health comes back by itself: one at a time after a rest, and all at once a little while after there was
      // none left. Nothing else happens to anyone here: what running out means beyond this is a world's own rule.
      if (own.downUntil) {
        if (clock >= own.downUntil) {
          own.value = own.full;
          own.downUntil = 0;
          own.regenAt = 0;
          sayState();
        }
      } else if (own.value < own.full && clock - own.struckAt >= HEALTH.restSeconds) {
        if (!own.regenAt) own.regenAt = clock;
        if (clock - own.regenAt >= HEALTH.regenSeconds) {
          own.value += 1;
          own.regenAt = own.value < own.full ? clock : 0;
          sayState();
        }
      }
      const on = active();
      const down = own.downUntil > 0;
      // Its counter is out of the way while they aim along its sight.
      if (wordsSprite) wordsSprite.visible = !o.sighting?.();
      // The pill: where the kit's other controls leave room for it, low in the middle of the view; lower still in
      // a headset, where it is out of the way. It comes and goes softly, and is redrawn as a block fills.
      const tall = Math.tan(THREE.MathUtils.degToRad(o.camera.fov / 2));
      const wide = tall * o.camera.aspect;
      ownBar.position.set(0, isPresenting() ? -0.3 : -tall * (o.camera.aspect < 1 ? 0.5 : 0.66), -1);
      const scale = Math.min(0.3, wide * 0.62);
      ownBar.scale.set(scale, scale / 6, 1);
      const want = on && (own.value < own.full || clock < own.shownUntil) ? 1 : 0;
      own.shown += (want - own.shown) * Math.min(1, dt * 9);
      ownBar.visible = own.shown > 0.02;
      ownBar.material.opacity = own.shown * (down && lively() ? 0.55 + 0.45 * Math.abs(Math.sin(clock * 9)) : 1);
      if (ownBar.visible && (own.regenAt || down) && clock - own.painted > 0.08) paintOwn();
      // The edge of the view: a flash when something reaches them, a slow pulse while they have next to nothing.
      own.flash = Math.max(0, own.flash - dt / 0.55);
      const low = !down && own.value < own.full && own.value <= 1;
      const red = on && !isPresenting() ? Math.max(own.flash * 0.8, down ? 0.5 : low ? 0.2 + (lively() ? 0.1 * Math.abs(Math.sin(clock * 3.2)) : 0) : 0) : 0;
      edge.visible = red > 0.01;
      edge.material.opacity = red;
      edge.scale.set(wide * 1.2 * 1.02, tall * 1.2 * 1.02, 1);
      // With nothing left, the view breaks up, for as long as it takes to come back.
      glitch.visible = on && down && lively() && Math.random() < 0.8;
      if (glitch.visible) {
        glitch.scale.set(wide * 1.16 * 1.02, tall * 1.16 * 1.02 * (0.6 + Math.random() * 0.8), 1);
        glitch.position.y = (Math.random() - 0.5) * tall * 0.5;
        glitch.material.opacity = 0.18 + Math.random() * 0.3;
        if (glitch.material.map) glitch.material.map.offset.y = Math.random();
      }
      // Everyone else: their bar, and their figure blinking while they have nothing left.
      const people = o.people();
      for (const [who, shown] of bars) {
        shown.sprite.visible = on && clock < shown.until && !muted(who);
        const person = people.find((x) => x.pubkey === who);
        const out = on && shown.value === 0 && clock < shown.until && !muted(who);
        if (person?.root) {
          if (out && lively()) {
            person.root.visible = person.root.visible && Math.random() > 0.3;
            person.root.scale.set(1 + (Math.random() - 0.5) * 0.14, 1, 1);
            blinking.add(who);
          } else if (blinking.delete(who)) person.root.scale.set(1, 1, 1);
        }
      }
      for (const thing of [...things]) {
        if (thing.state === "flying") {
          // Flown in short steps however slowly the page is drawing: never one so long that a thing could pass
          // through a wall between two frames, and never slower than it really goes.
          let left = Math.min(dt, 0.5);
          const from = thing.t;
          while (left > 1e-6 && thing.state === "flying" && things.includes(thing)) {
            const step = Math.min(0.03, left);
            fly(thing, step);
            left -= step;
          }
          // For a world drawn by another engine: this frame's flight is one step for it to test. A few are kept,
          // since its answer comes a frame or two on.
          if (o.deferred && thing.state === "flying" && thing.t > from) {
            thing.steps.push({ n: ++thing.stepNo, t0: from, t1: thing.t });
            if (thing.steps.length > 6) thing.steps.shift();
          }
          drawTrail(thing);
        } else if (thing.state === "stuck") {
          thing.t += dt;
          drawTrail(thing);
          // Stuck to someone who never said it reached them: it drops off.
          if (thing.agreeBy !== null && thing.t > thing.agreeBy) drop(thing);
          else if (thing.t > thing.until) drop(thing);
          else if (thing.on !== "world" && !o.people().some((p) => p.pubkey === thing.on)) gone(thing);
        } else if (thing.state === "falling") {
          thing.t += dt;
          drawTrail(thing);
          thing.fall += GRAVITY * dt;
          thing.object.position.y -= thing.fall * dt;
          thing.object.rotation.x += dt * 5;
          if (thing.object.position.y <= thing.floor + 0.02) {
            thing.object.position.y = thing.floor + 0.02;
            thing.state = "lying";
            thing.until = 0.6;
            hear(thing.item, thing.send.drops, thing.object.position);
          }
        } else {
          thing.until -= dt;
          thing.object.scale.setScalar(Math.max(0.01, thing.until / 0.6));
          if (thing.until <= 0) gone(thing);
        }
      }
    },
    snapshot() {
      const clips = clipsSaid;
      clipsSaid = [];
      const q = new THREE.Quaternion();
      const at = new THREE.Vector3();
      const three = (x: THREE.Vector3): [number, number, number] => [x.x, x.y, x.z];
      return {
        things: things.map((t) => {
          t.object.getWorldPosition(at);
          t.object.getWorldQuaternion(q);
          const last = t.state === "flying" ? t.steps[t.steps.length - 1] : undefined;
          return {
            key: `${t.by}:${t.shot.id}`,
            model: t.send.model.sha256,
            size: t.send.size,
            tints: t.tints,
            state: t.state,
            on: t.on,
            ref: t.ref,
            at: three(at),
            turn: [q.x, q.y, q.z, q.w] as [number, number, number, number],
            scale: t.object.scale.x,
            test: last ? { step: last.n, a: shotAt(t.shot, last.t0), b: shotAt(t.shot, last.t1), ...viaOf(t.shot, last.t0, last.t1) } : null,
            down: t.state === "falling" && !t.flooredAt,
          };
        }),
        trails: things.flatMap((t) => {
          const mesh = t.trail;
          if (!mesh || !mesh.visible) return [];
          // The streak is kept as two edges: its middle is between them, and how bright it is there is its colour's share.
          const position = mesh.geometry.getAttribute("position");
          const color = mesh.geometry.getAttribute("color");
          const base = mesh.userData.base as THREE.Color;
          const most = Math.max(base.r, base.g, base.b, 1e-6);
          const points: [number, number, number, number][] = [];
          for (let i = 0; i < position.count; i += 2) {
            points.push([(position.getX(i) + position.getX(i + 1)) / 2, (position.getY(i) + position.getY(i + 1)) / 2, (position.getZ(i) + position.getZ(i + 1)) / 2, Math.max(color.getX(i), color.getY(i), color.getZ(i)) / most]);
          }
          return [{ key: `${t.by}:${t.shot.id}`, color: `#${base.getHexString()}`, width: TRAIL_WIDTH, points }];
        }),
        own: {
          cross: cross.visible,
          mark: mark.visible,
          health: { value: own.value, full: own.full, growing: own.regenAt ? Math.min(1, (clock - own.regenAt) / HEALTH.regenSeconds) : 0, down: own.downUntil > 0, shown: own.shown },
          red: edge.visible ? edge.material.opacity : 0,
          glitch: glitch.visible,
          words,
        },
        clips,
      };
    },
    met(key, step, fraction, point, ref = "") {
      const thing = things.find((t) => `${t.by}:${t.shot.id}` === key);
      const tested = thing?.steps.find((s) => s.n === step);
      if (!thing || !tested || thing.state !== "flying" || thing.late || !point.every((x) => Number.isFinite(x))) return;
      const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
      thing.late = { t: tested.t0 + (tested.t1 - tested.t0) * f, point: new THREE.Vector3().fromArray(point), ref: String(ref).slice(0, 120) };
    },
    floored(key, y) {
      const thing = things.find((t) => `${t.by}:${t.shot.id}` === key);
      if (!thing || !Number.isFinite(y) || thing.flooredAt) return;
      thing.flooredAt = true;
      thing.floor = y;
    },
    info() {
      const count = (state: Thing["state"]) => things.filter((t) => t.state === state).length;
      return {
        flying: count("flying"),
        stuck: count("stuck"),
        falling: count("falling") + count("lying"),
        things: things.map((t) => ({ by: t.by, id: t.shot.id, state: t.state, on: t.on, onto: `${t.object.parent?.type ?? ""}:${t.object.parent?.name ?? ""}`, at: t.object.getWorldPosition(new THREE.Vector3()).toArray().map((n) => Math.round(n * 100) / 100) as [number, number, number] })),
        sent,
        landed,
        taken,
        health: { value: own.value, full: own.full },
        words,
        script: scriptState,
        stoppedBecause,
        marked: mark.visible,
        bars: Object.fromEntries([...bars].map(([who, b]) => [who, { value: b.value, full: b.full }])),
      };
    },
    dispose() {
      box?.stop();
      for (const thing of [...things]) gone(thing);
      for (const b of bars.values()) b.sprite.removeFromParent();
      hud.removeFromParent();
    },
  };
}
