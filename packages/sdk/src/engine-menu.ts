/**
 * The kit's own menu and sounds, for an engine that isn't JavaScript's.
 *
 * A world made in another engine draws its own place. What a visitor uses to
 * get about in it should still be what they know from every other world: the
 * same menu in the same corner, the same sounds at the same volumes they set,
 * the same words on the same controls. None of that needs a renderer. The
 * menu is drawn by the page over the engine's canvas, and the sounds are made
 * by the page beside the engine's own.
 *
 * So this is the reference kit's menu (`ui/`) and its sounds (`sound.ts`)
 * themselves, not a copy of them, with a way for an engine to hear what the
 * visitor chose. As everywhere in the engine script, text goes in and text
 * comes out: the engine asks for what happened since it last asked.
 *
 *   NSWP.menu('{"title":"My world","kit":"sounds/kit/"}');
 *   // every frame:
 *   for (const e of JSON.parse(NSWP.events())) ...   // {"type":"moving","moving":"intense"}
 *   NSWP.moved(0.04);                                // they walked that far: steps are heard
 *   NSWP.play("cross");
 *
 * What the engine still does itself: move the visitor, draw the doors, and
 * start a headset session when asked to.
 */
import { checkDestination } from "@nswp/core";
import { DESK_WORDS, hasMouse, keepIntense, LOOK_SPEED, PITCH_LIMIT, SPRINT, startsIntense } from "./fps.js";
import { PORTAL_HEIGHT, PORTAL_SIGN_HEIGHT, PORTAL_SPRING, PORTAL_WIDTH } from "./gate-size.js";
import { arrival, portal } from "./index.js";
import { addSoundControls, createSounds, CUES, type Cue, type Sounds, type SoundTheme } from "./sound.js";
import { JUMP_GRAVITY, JUMP_HEIGHT } from "./jump.js";
import { DOUBLE_TAP, DRAG_LOOK, TAP_REACH, WALK_SPEED } from "./stroll.js";
import { fullscreenAction } from "./ui/fullscreen.js";
import { mountHud, type Hud } from "./ui/hud.js";
import { createControls, type Controls } from "./ui/model.js";

const read = (text: unknown): Record<string, unknown> => {
  try {
    const v: unknown = typeof text === "string" && text ? JSON.parse(text) : text;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const words = (v: unknown, most: number): string => (typeof v === "string" ? v.slice(0, most) : "");

/** What happened that the engine should know of, until it asks. Never more than a frame or two's worth. */
const queue: Record<string, unknown>[] = [];
const tell = (event: Record<string, unknown>): void => {
  if (queue.length < 64) queue.push(event);
};

let controls: Controls | null = null;
let hud: Hud | null = null;
let sounds: Sounds | null = null;
let moving: "casual" | "intense" = "casual";
const vr = { supported: false, presenting: false };
const doors = new Map<string, string>();

/**
 * The numbers every world shares, as JSON: how fast a visitor walks, how far
 * a tap takes them, how a drag and a mouse turn the view, and the size of the standard
 * doorway. An engine reads them here so that they are the kit's and not a
 * copy that drifts. Lengths are metres, angles radians, speeds per second.
 */
export function kit(): string {
  return JSON.stringify({
    walkSpeed: WALK_SPEED,
    tapReach: TAP_REACH,
    sprint: SPRINT,
    dragLook: DRAG_LOOK,
    lookSpeed: LOOK_SPEED,
    pitchLimit: PITCH_LIMIT,
    doubleTap: DOUBLE_TAP,
    jumpHeight: JUMP_HEIGHT,
    jumpGravity: JUMP_GRAVITY,
    gateWidth: PORTAL_WIDTH,
    gateHeight: PORTAL_HEIGHT,
    gateSpring: PORTAL_SPRING,
    gateSignHeight: PORTAL_SIGN_HEIGHT,
    cues: CUES,
  });
}

/**
 * How a door's address should be read on its sign, as JSON: `domain` is the
 * part that says whose site it is, and `prefix` what comes before it. A sign
 * shows the domain, never a name alone. `ok` is false, with `code` saying
 * why, for an address a door can't lead to.
 */
export function check(url: string): string {
  const c = checkDestination(typeof url === "string" ? url : "");
  if (!c.ok) return JSON.stringify({ ok: false, code: c.error.code, domain: "", prefix: "", host: "" });
  return JSON.stringify({ ok: true, code: "", domain: c.value.registrableDomain ?? c.value.hostname, prefix: c.value.hostPrefix, host: c.value.hostname });
}

/**
 * Put the kit's menu over the engine's canvas, and start its sounds. Call it
 * once, after `start()`. `options` is JSON:
 *
 * - `title`: the world's name.
 * - `accent`: its colour, as `#rrggbb`. The visitor's own choice of look overrides it.
 * - `kit`: where the page serves the kit's sound files (a folder holding `sounds.json`), for example `"sounds/kit/"`.
 *   Left out, the sounds are the ones made in the browser.
 * - `sounds`: the world's own sounds, as in a world's settings (`docs/controls-kit.md`, "Sound"). Left out, the defaults.
 * - `help`: a few lines for the Help section.
 *
 * Returns JSON: `moving` is how the visitor starts out moving ("casual" or
 * "intense": as they arrived, or as they chose here before), and `mouse`
 * whether there is a mouse to move the intense way with.
 */
export function menu(options?: string): string {
  if (controls) return JSON.stringify({ moving, mouse: hasMouse() });
  const o = read(options);
  const title = words(o.title, 80) || "A world";
  const accent = /^#[0-9a-f]{6}$/i.test(String(o.accent)) ? String(o.accent) : undefined;
  const c = (controls = createControls({ title, address: location.host, ...(accent ? { theme: { accent } } : {}) }));
  const h = (hud = mountHud(c));
  const s = (sounds = createSounds({
    seed: title,
    ...(typeof o.kit === "string" && o.kit ? { kit: o.kit } : {}),
    ...(o.sounds && typeof o.sounds === "object" ? { theme: o.sounds as SoundTheme } : {}),
  }));
  addSoundControls(c, s);

  // The way home, or to their doors from a world that is their home. The engine does the going: it may have a headset session to end first.
  const atHome = arrival.atHome();
  c.add({
    id: "home",
    section: "travel",
    icon: "home",
    hotbar: true,
    label: atHome ? "Your doors" : "Go home",
    short: atHome ? "Doors" : "Home",
    hidden: () => portal.airlockFor() === null,
    act: () => tell({ type: atHome ? "doors" : "home" }),
  });

  // How they move at a desk. The same control, the same words and the same memory as in a Three.js world (fps.ts).
  const context = arrival.read().context;
  moving = startsIntense(context?.moving === "intense") ? "intense" : "casual";
  c.add({
    id: "fps",
    section: "moving",
    icon: "step",
    on: () => moving === "intense",
    hidden: () => !hasMouse() || vr.presenting,
    label: () => (moving === "intense" ? DESK_WORDS.intense : DESK_WORDS.casual),
    act: () => {
      moving = moving === "intense" ? "casual" : "intense";
      keepIntense(moving === "intense");
      tell({ type: "moving", moving });
      c.say(moving === "intense" ? DESK_WORDS.nowIntense : DESK_WORDS.nowCasual);
    },
  });

  // A jump. The engine does the jumping, and hears Space itself: this is the way to ask where there is no keyboard.
  c.add({
    id: "jump",
    section: "moving",
    icon: "step",
    label: "Jump",
    short: "Jump",
    hotbar: !hasMouse(),
    hidden: () => vr.presenting,
    act: () => tell({ type: "jump" }),
  });

  c.add(
    {
      id: "vr",
      section: "view",
      icon: "vr",
      tone: "primary",
      hotbar: true,
      hidden: () => !vr.supported,
      label: () => (vr.presenting ? "Leave VR" : "Enter VR"),
      short: "VR",
      // A browser starts a headset session only on a press. This is one, and the engine hears of it within a frame.
      act: () => tell({ type: "vr", enter: !vr.presenting }),
    },
    fullscreenAction(c, () => vr.presenting),
  );
  document.addEventListener("fullscreenchange", () => c.setTarget(""));
  c.addSection({
    id: "help",
    label: "Help",
    icon: "help",
    note:
      words(o.help, 600) ||
      "Drag to look around. Walk with W, A, S, D, or click the floor to step there: twice to run. Shift runs and Space jumps. The key left of 1 brings these controls up in any world, whatever is on screen; on a touch screen, hold two fingers still. Walk into a doorway to go through it: your own Airlock shows where it really leads, and asks, before you go. These controls are this world's own: your headset's or browser's own controls always get you out.",
  });

  // The menu opening and closing: the engine stops moving the visitor, and lets the pointer go.
  let closedAt = -1;
  c.onSignal((name) => {
    if (name === "menuOpen") tell({ type: "menu", open: true });
    if (name === "menuClose") {
      closedAt = performance.now();
      tell({ type: "menu", open: false });
      // The keys go back to the world.
      document.querySelector("canvas")?.focus();
    }
  });
  // Moving the intense way, the pointer is the view's. When the visitor takes it back with Escape, that is the menu.
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement || moving !== "intense" || vr.presenting || h.open) return;
    if (performance.now() - closedAt > 80) h.setOpen(true);
  });
  addEventListener("keydown", (e) => {
    if (e.code !== "Escape" || moving !== "intense" || vr.presenting || h.open || document.pointerLockElement) return;
    if (performance.now() - closedAt > 80) h.setOpen(true);
  });
  return JSON.stringify({ moving, mouse: hasMouse() });
}

/** What happened since the engine last asked, as a JSON list, oldest first. Ask every frame. */
export function events(): string {
  if (!queue.length) return "[]";
  const out = JSON.stringify(queue);
  queue.length = 0;
  return out;
}

/** Play one of the kit's cues by name (`kit().cues`): the world's own sound for it, or the default. */
export function play(cue: string): void {
  if ((CUES as readonly string[]).includes(cue)) sounds?.play(cue as Cue);
}

/** Say how far the visitor was moved this frame, in metres, by what moves them: their steps are heard. */
export function moved(metres: number): void {
  if (typeof metres === "number" && Number.isFinite(metres) && metres > 0) sounds?.moved(metres);
}

/** They walked into something. */
export function bump(): void {
  sounds?.bump();
}

/** A few words shown for a moment, where the menu shows them. */
export function say(text: string): void {
  const t = words(text, 300);
  if (t) controls?.say(t);
}

/**
 * Say what the visitor is pointing at, or "" for nothing. `detail` is a JSON
 * list of a few more lines. On a flat screen it is shown beside the controls,
 * the same size wherever the thing is, so a world needn't hang a sign in
 * front of it.
 */
export function target(name: string, detail?: string): void {
  let lines: string[] = [];
  try {
    const d: unknown = detail ? JSON.parse(detail) : [];
    if (Array.isArray(d)) lines = d.filter((l): l is string => typeof l === "string").slice(0, 6).map((l) => l.slice(0, 200));
  } catch {
    /* no more lines */
  }
  controls?.setTarget(words(name, 120), lines);
}

/**
 * Tell the menu about a headset, as JSON: `supported` (this browser can start
 * a session, so the way in is offered) and `presenting` (one is running, so
 * the page's menu is put away and the control becomes the way out).
 */
export function headset(state: string): void {
  const s = read(state);
  vr.supported = s.supported === true;
  vr.presenting = s.presenting === true;
  hud?.setHidden(vr.presenting);
  controls?.setTarget("");
}

/**
 * How much of the screen the controls take: "full", "quiet" (one small mark
 * in a corner) or "hidden" (nothing at all). For a world with an interface
 * of its own, which leads. Whatever is chosen, the visitor can still bring
 * the controls up with the summons, which is theirs in every world: the key
 * left of 1, or two fingers held still (protocol/11-the-visitors-console.md).
 * The engine hears `menu` events as they come and go, and should stop
 * taking the visitor's input while they are up.
 */
export function presence(level: string): void {
  if (level === "full" || level === "quiet" || level === "hidden") controls?.setPresence(level);
}

/**
 * Take every key for the world ("1" or "true"), or give them back. While
 * claimed, the menu answers to none of its own keys. The summons still works.
 */
export function claim(on: unknown): void {
  controls?.claimInput(on === true || on === "true" || on === "1" || on === 1);
}

/**
 * List a door in the menu, as JSON: `id` and `label`. Choosing it there tells
 * the engine (`{"type":"door","id":...}`), which goes through it. With
 * `remove` true, the door is taken off the list.
 */
export function door(entry: string): void {
  const d = read(entry);
  const id = words(d.id, 60);
  if (!id || !controls) return;
  const menuId = `door-${id}`;
  if (d.remove === true) {
    doors.delete(id);
    controls.remove(menuId);
    return;
  }
  if (doors.has(id) || doors.size >= 24) return;
  doors.set(id, words(d.label, 80) || "A door");
  controls.add({ id: menuId, section: "travel", icon: "door", label: () => doors.get(id) ?? "A door", short: "Door", act: () => tell({ type: "door", id }) });
}
