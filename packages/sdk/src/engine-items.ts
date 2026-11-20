/**
 * Items, for a world drawn by an engine that isn't JavaScript's (protocol/17-items.md; docs/other-engines.md).
 *
 * Everything about an item that isn't drawing is here, and is the very same code a Three.js world runs, through
 * the very same presence (engine-presence.ts): the Bag tab, fetching and checking what an item names, its script
 * in its locked box, the flight of what it sends out, who it reaches, what the room is told, and how someone is. So an item behaves the same in every world, whatever the world is made
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
 *   const now = JSON.parse(NSWP.frame(JSON.stringify(view)));  // every frame: what to draw (engine-world.ts)
 *   NSWP.model(now.held.model);                              // a model's checked bytes, as base64
 *
 * On a flat screen the ring to aim by, the mark of a hit, how the visitor is and their item's counter are drawn
 * by the page, over the canvas, as the menu is. In a headset they are the engine's to draw, from the same numbers.
 */
import * as THREE from "three";
import { createBag } from "./bag.js";
import { addBagControls } from "./bagging.js";
import { engineParts } from "./engine-menu.js";
import { enginePresence, engineAllowsItems, engineItemStore, onEnginePresence } from "./engine-presence.js";
import { addFramePart, addFrameStart, base64, engineWorld, num, read, three, type EngineWorld } from "./engine-world.js";
import { addItemControls, type ItemControls } from "./item-controls.js";
import type { ModelNamed } from "./item-store.js";
import { paintHealth, type Play, type PlaySnapshot } from "./play.js";
import type { Presence } from "./presence.js";
import { hereAs, onHereAs } from "./ui/identity.js";


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
  world: EngineWorld;
  presence: Presence;
  play: Play;
  presses: ItemControls;
  wantSight: boolean;
  accent: string;
  overlay: Overlay | null;
} | null = null;

/** A model's checked bytes, as text an engine can take: by the hash its file is named by. "!" where it failed. */
const models = new Map<string, string>();

/** Have a model's bytes fetched and checked, to be handed over when the engine asks. */
function want(named: ModelNamed): void {
  if (models.has(named.model.sha256)) return;
  models.set(named.model.sha256, "");
  void engineItemStore()
    .modelBytes(named)
    .then((got) => models.set(named.model.sha256, got ? base64(got.bytes) : "!"));
}
/** Everything an item draws: itself, and each thing it sends out. */
function wantAll(item: { model: ModelNamed["model"]; size: ModelNamed["size"]; sends: ModelNamed[] }): void {
  want(item);
  for (const send of item.sends) want(send);
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
  if (!parts) return JSON.stringify({ ok: false, rule: "none", why: "menu-first" });
  const relays = Array.isArray(o.relays) ? o.relays.filter((r): r is string => typeof r === "string") : undefined;
  const rule = engineAllowsItems(o.rule, o.box === false ? false : typeof o.box === "string" && o.box ? { url: o.box } : true, relays);
  const presence = rule === "none" ? null : enginePresence();
  const play = presence?.play;
  if (!presence || !play) return JSON.stringify({ ok: false, rule, why: "no-items" });
  const world = engineWorld();
  const { controls } = parts;
  const me = (): string | null => hereAs()?.pubkey ?? null;
  const state = (on = {
    rule,
    world,
    presence,
    play,
    wantSight: false as boolean,
    accent: controls.theme.accent,
    overlay: makeOverlay(),
    presses: null as unknown as ItemControls,
  });
  const bag = createBag({ me, ...(relays?.length ? { relays } : {}) });
  const bagging = addBagControls(controls, {
    bag,
    items: engineItemStore(),
    me,
    rule: () => rule,
    place: () => controls.view().title,
    holding: () => presence.holding,
    hold: async (item, tints) => {
      const done = await presence.setHolding(item, tints);
      if (!presence.holding) state.wantSight = false;
      return done;
    },
    tinted: (item, tints) => void (presence.holding === item && presence.setTints(tints)),
    presenting: () => world.presenting,
  });
  onHereAs(() => bagging.refresh());
  state.presses = addItemControls(controls, {
    play: () => play,
    holdingHand: () => -1,
    dom: typeof document === "undefined" ? null : document.querySelector("canvas"),
    sight: (wanted) => void (state.wantSight = wanted),
  });
  onEnginePresence(() => state.presses.refresh());
  addFrameStart(itemsHeard);
  addFramePart(itemsFrame);
  return JSON.stringify({ ok: true, rule });
}

/** What the engine found out since the last frame: what each thing ran into (`met`), and where the floor is under those that fell (`floors`). */
function itemsHeard(i: Record<string, unknown>): void {
  const state = on;
  if (!state) return;
  for (const m of Array.isArray(i.met) ? (i.met as Record<string, unknown>[]).slice(0, 64) : []) {
    const at = three(m?.at);
    if (at && typeof m.key === "string") state.play.met(m.key, num(m.step, -1), num(m.f, 0), at, typeof m.ref === "string" ? m.ref : "");
  }
  for (const f of Array.isArray(i.floors) ? (i.floors as Record<string, unknown>[]).slice(0, 64) : []) {
    if (typeof f?.key === "string") state.play.floored(f.key, num(f.y, NaN));
  }
}

/**
 * The items' share of a frame (engine-world.ts, `frame`): `held` (the thing in their hand: its model, box,
 * colours, where its sight is and whether it does anything), `sight` (whether they are holding the press that
 * aims), and the things, streaks of light and the visitor's own state, as `PlaySnapshot` has them. Things are
 * everyone's: what the visitor sent out, and what anyone else in the room did.
 */
function itemsFrame(): Record<string, unknown> {
  const state = on;
  if (!state) return {};
  const presenting = state.world.presenting;
  const store = engineItemStore();
  const item = state.presence.holding ? store.known(state.presence.holding) : null;
  if (item) wantAll(item);
  else state.wantSight = false;
  // What anyone else holds, and what it may send out, is something to draw too: fetched and checked the same way.
  for (const person of state.presence.drawn()) {
    const theirs = person.holding && person.held ? store.known(person.holding) : null;
    if (theirs) wantAll(theirs);
  }
  const now = state.play.snapshot();
  // A thing in the air whose model nobody here was found to hold is drawn as a plain box of its size.
  for (const thing of now.things) if (!models.has(thing.model)) models.set(thing.model, "!");
  if (state.overlay) paint(state.overlay, now.own, state.accent, presenting);
  const tints = state.presence.tints;
  return {
    rule: state.rule,
    held: item ? { id: item.id, title: item.title, model: item.model.sha256, size: item.size, tints: Object.fromEntries(item.tints.map((t) => [t.slot, tints[t.slot] ?? t.color])), aim: item.aim, acts: !!state.play.does } : null,
    sight: state.wantSight && !!item?.aim && !presenting,
    ...now,
  };
}

/**
 * A model's bytes, as base64, by the hash its file is named by (`held.model`, `things[].model`). They have been
 * fetched, checked against that hash and counted: the engine reads them as a binary glTF. "" while they are on
 * their way, and "!" where the file failed a check: then a plain box of the thing's size is drawn in its place.
 */
export function model(sha: unknown): string {
  return typeof sha === "string" ? (models.get(sha) ?? "") : "";
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

/** What is in play for this visitor, as JSON: for tests. */
export function itemsInfo(): string {
  return JSON.stringify(on ? on.play.info() : null);
}

/** The item's second press. */
export function itemSecond(): boolean {
  if (!on?.play.does?.second) return false;
  on.play.second();
  return true;
}
