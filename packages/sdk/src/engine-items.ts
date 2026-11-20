/**
 * Items, for a world drawn by an engine that isn't JavaScript's (protocol/17-items.md; docs/other-engines.md).
 *
 * Everything about an item that isn't drawing is here, and is the very same code a Three.js world runs: the Bag
 * tab, fetching and checking what an item names, its script in its locked box, the flight of what it sends out,
 * who it reaches, and how someone is. So an item behaves the same in every world, whatever the world is made
 * with, and nothing about it is written twice.
 *
 * What is left for the engine is what only it can do:
 *
 * - **draw:** the thing in the visitor's hand, the things in the air, their streaks of light;
 * - **know its own shapes:** each frame it is told where each thing went, and says what it ran into.
 *
 * Like the rest of this script, every call takes text and gives text back.
 *
 *   NSWP.items('{"rule":"allowed"}');                       // once, after NSWP.menu
 *   const now = JSON.parse(NSWP.frame(JSON.stringify(view)));  // every frame: what to draw
 *   NSWP.model(now.held.model);                              // a model's checked bytes, as base64
 *
 * On a flat screen the ring to aim by, the mark of a hit, how the visitor is and their item's counter are drawn
 * by the page, over the canvas, as the menu is. In a headset they are the engine's to draw, from the same numbers.
 */
import { cleanItemsRule, cleanTints, type Item } from "@nswp/core";
import * as THREE from "three";
import { createBag } from "./bag.js";
import { addBagControls } from "./bagging.js";
import { engineParts } from "./engine-menu.js";
import { addItemControls, type ItemControls } from "./item-controls.js";
import { createItemStore, showsItems, type ItemStore, type ModelNamed } from "./item-store.js";
import type { Items } from "./items.js";
import { createPlay, mayHold, paintHealth, type Play, type PlaySnapshot } from "./play.js";
import { hereAs, onHereAs } from "./ui/identity.js";

const read = (text: unknown): Record<string, unknown> => {
  try {
    const v: unknown = typeof text === "string" && text ? JSON.parse(text) : text;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const three = (v: unknown): [number, number, number] | null => (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? (v as [number, number, number]) : null);
const num = (v: unknown, otherwise: number): number => (typeof v === "number" && Number.isFinite(v) ? v : otherwise);

interface Held {
  item: Item;
  tints: Record<string, string>;
}

interface Overlay {
  root: HTMLElement;
  cross: HTMLElement;
  mark: HTMLElement;
  pill: HTMLCanvasElement;
  edge: HTMLElement;
  glitch: HTMLElement;
  words: HTMLElement;
  painted: string;
}

let on: {
  rule: string;
  store: ItemStore;
  play: Play;
  presses: ItemControls;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rig: THREE.Group;
  held: Held | null;
  asked: { sha: string };
  /** A model's checked bytes, as text an engine can take: by the hash its file is named by. "!" where it failed. */
  models: Map<string, string>;
  wantSight: boolean;
  sighting: boolean;
  presenting: boolean;
  accent: string;
  overlay: Overlay | null;
} | null = null;

/** Bytes as base64, a piece at a time: a model is too long to hand to the browser in one go. */
function base64(bytes: Uint8Array): string {
  let text = "";
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

/** Have a model's bytes fetched and checked, to be handed over when the engine asks. */
function want(named: ModelNamed): void {
  const state = on;
  if (!state || state.models.has(named.model.sha256)) return;
  state.models.set(named.model.sha256, "");
  void state.store.modelBytes(named).then((got) => state.models.set(named.model.sha256, got ? base64(got.bytes) : "!"));
}

// ---------------------------------------------------------------- what the page draws, on a flat screen
function makeOverlay(): Overlay | null {
  if (typeof document === "undefined") return null;
  const el = (css: string, tag = "div"): HTMLElement => {
    const e = document.createElement(tag);
    e.style.cssText = css;
    return e;
  };
  // Under the menu, over the canvas, and never in the way of a press.
  const root = el("position:fixed;inset:0;z-index:2147482000;pointer-events:none;overflow:hidden;contain:strict");
  root.setAttribute("aria-hidden", "true");
  const centre = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;";
  const cross = el(`${centre}width:16px;height:16px;border:2px solid rgba(255,255,255,.9);border-radius:50%;box-sizing:border-box`);
  const mark = el(`${centre}width:34px;height:34px;background:linear-gradient(45deg,transparent 46%,#fff 46%,#fff 54%,transparent 54%),linear-gradient(-45deg,transparent 46%,#fff 46%,#fff 54%,transparent 54%);-webkit-mask:radial-gradient(circle,transparent 5px,#000 6px);mask:radial-gradient(circle,transparent 5px,#000 6px)`);
  const edge = el("position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,rgba(255,70,60,0) 52%,rgba(255,70,60,.95) 100%)");
  const glitch = el("position:absolute;left:0;right:0;height:40%;display:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.5) 0 2px,transparent 2px 9px,rgba(80,240,255,.45) 9px 12px,transparent 12px 23px,rgba(255,70,160,.45) 23px 25px,transparent 25px 41px)");
  const pill = el("position:absolute;left:50%;bottom:104px;width:240px;height:40px;transform:translateX(-50%);opacity:0", "canvas") as HTMLCanvasElement;
  pill.width = 384;
  pill.height = 64;
  // Its counter: above where the thing sits in their hand, low and to the right, as it is in a world drawn in Three.js.
  const words = el("position:absolute;right:17%;bottom:47%;padding:5px 13px;border-radius:13px;background:rgba(8,10,14,.72);color:#fff;font:600 20px system-ui,sans-serif;display:none");
  root.append(edge, glitch, cross, mark, pill, words);
  document.body.append(root);
  return { root, cross, mark, pill, edge, glitch, words, painted: "" };
}

function paint(o: Overlay, own: PlaySnapshot["own"], accent: string, presenting: boolean): void {
  // In a headset the page isn't what they see: all of this is the engine's to draw there.
  o.root.style.display = presenting ? "none" : "block";
  if (presenting) return;
  o.cross.style.display = own.cross ? "block" : "none";
  o.mark.style.display = own.mark ? "block" : "none";
  o.edge.style.opacity = String(Math.round(own.red * 100) / 100);
  o.glitch.style.display = own.glitch ? "block" : "none";
  if (own.glitch) {
    o.glitch.style.top = `${Math.round(Math.random() * 60)}%`;
    o.glitch.style.opacity = String(0.2 + Math.random() * 0.3);
  }
  o.words.style.display = own.words ? "block" : "none";
  if (o.words.textContent !== own.words) o.words.textContent = own.words;
  // On a screen taller than it is wide the bar runs the whole way across, and what is said sits above it.
  const narrow = innerWidth < innerHeight;
  o.pill.style.bottom = narrow ? "24%" : "104px";
  o.pill.style.opacity = String(Math.round(own.health.shown * 100) / 100);
  const what = `${own.health.value}/${own.health.full}/${Math.round(own.health.growing * 12)}/${own.health.down}/${accent}`;
  if (what !== o.painted && own.health.shown > 0.02) {
    o.painted = what;
    const g = o.pill.getContext("2d");
    if (g) {
      g.clearRect(0, 0, o.pill.width, o.pill.height);
      paintHealth(g, o.pill.width, o.pill.height, { value: own.health.value, full: own.health.full, accent, growing: own.health.growing, down: own.health.down });
    }
  }
}

// ---------------------------------------------------------------- the calls

/**
 * Begin. Call once, after `menu`. `options` is JSON: `rule`, what this world does with items ("allowed" or "play":
 * it must be what the world's announcement says), `box`, where the page serves the locked box for an item's own
 * logic (left out, `item-box.html` beside the page; `false` for none, and items are then shapes), and `relays`.
 * Returns `{ ok, rule }`. With no rule, or "none", there is nothing to begin: nothing carried is drawn here.
 */
export function items(options?: string): string {
  const parts = engineParts();
  if (on) return JSON.stringify({ ok: true, rule: on.rule });
  const o = read(options);
  const rule = cleanItemsRule(o.rule);
  if (!parts) return JSON.stringify({ ok: false, rule, why: "menu-first" });
  if (rule === "none") return JSON.stringify({ ok: false, rule, why: "no-items" });
  const relays = Array.isArray(o.relays) ? o.relays.filter((r): r is string => typeof r === "string") : undefined;
  const store = createItemStore(relays?.length ? { relays } : {});
  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(70, 1.6, 0.1, 100);
  scene.add(rig, camera);
  // What this script holds of a thing is where it is and which way it faces: the engine has its shape.
  const nothing = async () => new THREE.Group();
  const shapeless = { ...store, model: nothing, sent: nothing, marker: () => new THREE.Group(), clips: () => [] } as unknown as Items;
  const { controls, sounds } = parts;
  const me = (): string | null => hereAs()?.pubkey ?? null;
  const state = (on = {
    rule,
    store,
    scene,
    camera,
    rig,
    held: null as Held | null,
    asked: { sha: "" },
    models: new Map<string, string>(),
    wantSight: false as boolean,
    sighting: false as boolean,
    presenting: false as boolean,
    accent: controls.theme.accent,
    overlay: makeOverlay(),
    play: null as unknown as Play,
    presses: null as unknown as ItemControls,
  });
  state.play = createPlay({
    scene,
    camera,
    rig,
    items: shapeless,
    sounds,
    rule: () => rule,
    ...(o.box === false ? {} : { scripts: typeof o.box === "string" && o.box ? { url: o.box } : true }),
    // With nobody else to be seen yet in a world drawn this way, there is nobody to tell and nobody to reach.
    me: () => null,
    people: () => [],
    tell: () => {},
    deferred: true,
    presenting: () => state.presenting,
    sighting: () => state.sighting,
    theme: () => ({ accent: controls.theme.accent, motion: controls.theme.motion }),
    onChange: () => state.presses?.refresh(),
  });
  const hold = async (coordinate: string, tints?: Record<string, string>): Promise<{ ok: boolean; said: string }> => {
    if (!coordinate) {
      const had = !!state.held;
      state.held = null;
      state.wantSight = false;
      await state.play.held(null, null);
      return { ok: true, said: had ? "Put away." : "You are holding nothing." };
    }
    const described = showsItems() ? await store.describe(coordinate) : null;
    const may = mayHold(described, { rule, scripts: o.box !== false, asked: state.asked });
    if (!may.ok || !described) return may.ok ? { ok: false, said: "That item's description couldn't be found." } : may;
    state.held = { item: described, tints: cleanTints(described, tints ?? {}) };
    want(described);
    for (const send of described.sends) want(send);
    await state.play.held(described, new THREE.Group());
    return { ok: true, said: `You are holding ${described.title}.` };
  };
  const bag = createBag({ me, ...(relays?.length ? { relays } : {}) });
  const bagging = addBagControls(controls, {
    bag,
    items: store,
    me,
    rule: () => rule,
    holding: () => state.held?.item.id ?? "",
    hold,
    tinted: (item, tints) => {
      if (state.held?.item.id === item) state.held = { item: state.held.item, tints: cleanTints(state.held.item, tints) };
    },
    presenting: () => state.presenting,
  });
  onHereAs(() => bagging.refresh());
  state.presses = addItemControls(controls, {
    play: () => state.play,
    holdingHand: () => -1,
    dom: typeof document === "undefined" ? null : document.querySelector("canvas"),
    sight: (wanted) => void (state.wantSight = wanted),
  });
  return JSON.stringify({ ok: true, rule });
}

/**
 * Every frame. `view` is JSON saying where the visitor is and what the engine found: `dt`, seconds since the last;
 * `head` and `turn`, where their view is and which way it faces (x, y, z, w); `floor`, how high the floor under
 * them is; `fov` and `aspect`; `presenting`, in a headset; `sighting`, whether their item is up at their eye; and
 * `met` and `floors`, the engine's answers about what things ran into and where the floor is under them.
 *
 * Returns everything there is to draw, as JSON: `held` (the thing in their hand: its model, box, colours, where
 * its sight is and whether it does anything), `sight` (whether they are holding the press that aims), and the
 * things, streaks of light and the visitor's own state, as `PlaySnapshot` has them.
 */
export function frame(view?: string): string {
  const state = on;
  if (!state) return "{}";
  const i = read(view);
  const head = three(i.head);
  const turn = Array.isArray(i.turn) && i.turn.length === 4 && i.turn.every((x) => typeof x === "number" && Number.isFinite(x)) ? (i.turn as number[]) : null;
  if (head) {
    state.camera.position.fromArray(head);
    state.rig.position.set(head[0], num(i.floor, head[1] - 1.6), head[2]);
  }
  if (turn) state.camera.quaternion.fromArray(turn).normalize();
  state.camera.fov = Math.min(140, Math.max(10, num(i.fov, state.camera.fov)));
  state.camera.aspect = Math.min(8, Math.max(0.1, num(i.aspect, state.camera.aspect)));
  state.presenting = i.presenting === true;
  state.sighting = i.sighting === true;
  state.scene.updateMatrixWorld(true);
  for (const m of Array.isArray(i.met) ? (i.met as Record<string, unknown>[]).slice(0, 64) : []) {
    const at = three(m?.at);
    if (at && typeof m.key === "string") state.play.met(m.key, num(m.step, -1), num(m.f, 0), at, typeof m.ref === "string" ? m.ref : "");
  }
  for (const f of Array.isArray(i.floors) ? (i.floors as Record<string, unknown>[]).slice(0, 64) : []) {
    if (typeof f?.key === "string") state.play.floored(f.key, num(f.y, NaN));
  }
  state.play.update(Math.min(0.5, Math.max(0, num(i.dt, 0.016))));
  const now = state.play.snapshot();
  // Whatever is in the air is something to draw: its model is fetched and checked, to be handed over when asked for.
  for (const thing of now.things) if (!state.models.has(thing.model)) state.models.set(thing.model, "!");
  if (state.overlay) paint(state.overlay, now.own, state.accent, state.presenting);
  const held = state.held;
  return JSON.stringify({
    rule: state.rule,
    held: held
      ? { id: held.item.id, title: held.item.title, model: held.item.model.sha256, size: held.item.size, tints: Object.fromEntries(held.item.tints.map((t) => [t.slot, held.tints[t.slot] ?? t.color])), aim: held.item.aim, acts: !!state.play.does }
      : null,
    sight: state.wantSight && !!held?.item.aim && !state.presenting,
    ...now,
  });
}

/**
 * A model's bytes, as base64, by the hash its file is named by (`held.model`, `things[].model`). They have been
 * fetched, checked against that hash and counted: the engine reads them as a binary glTF. "" while they are on
 * their way, and "!" where the file failed a check: then a plain box of the thing's size is drawn in its place.
 */
export function model(sha: unknown): string {
  return typeof sha === "string" ? (on?.models.get(sha) ?? "") : "";
}

/**
 * The view was pressed, on none of the engine's own controls: `press` is JSON with `from` and `dir`, where the
 * press points from and which way, and `heldMs`, how long it was held. True if that was the item's first press
 * (a tap, with something in hand that does something), sent the way they pressed: the engine then does nothing
 * else with it. A press held is still how they walk.
 */
export function itemTap(press?: string): boolean {
  const p = read(press);
  const from = three(p.from);
  const dir = three(p.dir);
  if (!on || !from || !dir) return false;
  return on.presses.tap({ origin: new THREE.Vector3().fromArray(from), direction: new THREE.Vector3().fromArray(dir).normalize() }, num(p.heldMs, 0));
}

/** The item's first press, from a control of the engine's own (a trigger in a headset). `toward` is where to send what it sends out, or nothing for where they look. */
export function itemUse(toward?: string): boolean {
  if (!on?.play.does?.use) return false;
  const to = three(read(toward).to);
  on.play.use(to ? new THREE.Vector3().fromArray(to) : undefined);
  return true;
}

/** The item's second press. */
export function itemSecond(): boolean {
  if (!on?.play.does?.second) return false;
  on.play.second();
  return true;
}
