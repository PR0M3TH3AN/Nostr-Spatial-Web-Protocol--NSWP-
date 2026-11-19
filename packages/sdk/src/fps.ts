/**
 * The intense way of moving at a desk: the way games have taught hands to move.
 *
 * There are two ways to move, on a desk and in a headset, and the menu calls
 * them the same things in both: casual and intense. Casual at a desk is made
 * for someone who has never played anything: click where you want to stand,
 * drag to look round. Intense is for people who have: the mouse looks, W A S
 * D walk, Shift runs, F uses what is in front of you, and Escape brings up
 * the menu. A visitor chooses in the menu, under Moving, and it is kept. (In
 * a headset the two are stepping and walking smoothly: see input.ts.)
 *
 * It needs a mouse or a trackpad, so it isn't offered on a phone, and it
 * stands down in a headset, where hands already do all of this.
 *
 *   const fps = createFps({ dom: renderer.domElement, camera, rig, controls, hud, canStand, presenting: () => renderer.xr.isPresenting, onUse });
 *   // each frame, in place of the page's own keys:
 *   if (!fps.update(dt)) walkWithKeys(dt);
 *   // in the page's own click handlers:  if (fps.enabled) return;
 *
 * Looking takes the pointer (the browser hides it and gives the page its
 * movements), which a browser grants only on a click and takes back on
 * Escape. So Escape is the menu: when the pointer comes back, the menu is
 * what the visitor finds, and a click on the view takes them in again.
 */
import type * as THREE from "three";
import { startingForm } from "./form.js";
import { RUN } from "./stroll.js";
import type { Controls } from "./ui/model.js";

/** Radians of turn for each pixel the mouse moves. */
export const LOOK_SPEED = 0.0022;
/** How far up or down a visitor can look: a little short of straight up, so the view never flips. */
export const PITCH_LIMIT = (85 * Math.PI) / 180;
/** Running is this many times walking. */
export const SPRINT = RUN;

/** Where a visitor is looking after the mouse moved by (dx, dy) pixels. Yaw turns left for a move left; pitch is held within its limit. */
export function lookAfter(yaw: number, pitch: number, dx: number, dy: number, speed = LOOK_SPEED): { yaw: number; pitch: number } {
  const clean = (n: number) => (Number.isFinite(n) ? n : 0);
  return { yaw: yaw - clean(dx) * speed, pitch: Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch - clean(dy) * speed)) };
}

export interface Held {
  forward?: boolean;
  back?: boolean;
  left?: boolean;
  right?: boolean;
  sprint?: boolean;
}

/**
 * How far the held keys move a visitor facing `yaw` in `dt` seconds, over
 * the floor: [dx, dz] in metres. Walking diagonally is no faster than
 * walking straight, and looking up or down doesn't change the pace.
 */
export function strideOf(held: Held, yaw: number, speed: number, dt: number, sprint = SPRINT): [number, number] {
  const f = (held.forward ? 1 : 0) - (held.back ? 1 : 0);
  const s = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (!f && !s) return [0, 0];
  const pace = (speed * (held.sprint ? sprint : 1) * Math.max(0, dt)) / Math.hypot(f, s);
  // Forward is -Z for a visitor with no turn; yaw turns them left about Y.
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return [(s * cos - f * sin) * pace, (-s * sin - f * cos) * pace];
}

/** Which held thing a key is, or null for a key this doesn't move with. */
export function heldKey(code: string): keyof Held | null {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      return "forward";
    case "KeyS":
    case "ArrowDown":
      return "back";
    case "KeyA":
    case "ArrowLeft":
      return "left";
    case "KeyD":
    case "ArrowRight":
      return "right";
    case "ShiftLeft":
    case "ShiftRight":
      return "sprint";
    default:
      return null;
  }
}

/** Where the choice is kept, for this site, unless a world names another place. */
export const DESK_KEY = "nswp:fps";
/** What the control says, and what is said when it is pressed. One wording, whatever draws the world. */
export const DESK_WORDS = {
  intense: "Desk controls: intense",
  casual: "Desk controls: casual",
  nowIntense: "Intense: click the view to look round with the mouse. W, A, S, D walk, Shift runs, Space jumps, F uses what is in front of you, and Escape brings up this menu.",
  nowCasual: "Casual: click where you want to stand, twice to run there, and drag to look round. W, A, S, D walk, Shift runs and Space jumps.",
  click: "Click the view to look round. Escape brings up the menu.",
} as const;
/**
 * A way of moving that needs a mouse is not offered where there isn't one, or to a visitor who arrived using
 * their fingers on a device that has both (form.ts).
 */
export const hasMouse = (): boolean => startingForm() === "desk";
/** Whether a visitor starts out moving the intense way at a desk: they arrived so, or chose it here before. */
export function startsIntense(arrived: boolean, key = DESK_KEY): boolean {
  if (!hasMouse()) return false;
  try {
    return arrived || localStorage.getItem(key) === "1";
  } catch {
    return arrived;
  }
}
/** Keep the choice, or forget it. */
export function keepIntense(on: boolean, key = DESK_KEY): void {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* it lasts for this visit */
  }
}

export interface FpsOptions {
  /** What is clicked to look round: the canvas. */
  dom: HTMLElement;
  camera: THREE.Object3D;
  /** What is turned and moved: the camera's parent. */
  rig: THREE.Object3D;
  controls: Controls;
  /** The menu, so Escape can bring it up and looking can stop while it is open. */
  hud?: { readonly open: boolean; setOpen(open: boolean): void } | null;
  canStand(x: number, z: number): boolean;
  /** In a headset: this stands down. */
  presenting(): boolean;
  /** F, or a click while looking: use what the middle of the view points at. */
  onUse(): void;
  /** Walking pace, in metres a second. */
  speed?: number;
  /** They walked into something. */
  onBlocked?(): void;
  /** Start in it: their own client says they were moving this way where they came from. */
  arrived?: boolean;
  /** Keep the choice under this name, for this site. */
  keep?: string;
}

export interface Fps {
  /** Whether the visitor has chosen this way of moving. */
  readonly enabled: boolean;
  setEnabled(on: boolean): void;
  /** Whether the mouse is looking round now (the pointer is the page's). */
  readonly looking: boolean;
  /**
   * Call every frame. Returns true when this has the visitor's movement, and
   * the page's own keys and clicks should stand down.
   */
  update(dt: number): boolean;
  dispose(): void;
}

export function createFps(o: FpsOptions): Fps {
  const key = o.keep ?? DESK_KEY;
  const mouse = hasMouse();
  let enabled = startsIntense(o.arrived === true, key);
  const held: Held = {};
  let pitch = 0;
  let weLetGo = false;
  let closedAt = -1;
  let told = false;
  const looking = () => document.pointerLockElement === o.dom;
  const active = () => enabled && !o.presenting();

  // A dot in the middle of the view: what F and a click will use.
  const dot = document.createElement("div");
  dot.setAttribute("aria-hidden", "true");
  dot.style.cssText = "position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#fff;opacity:.75;box-shadow:0 0 0 1px rgba(0,0,0,.55);pointer-events:none;z-index:5;display:none";
  document.body.append(dot);

  const look = () => {
    if (!active() || o.hud?.open || looking()) return;
    try {
      const asked = o.dom.requestPointerLock() as unknown as Promise<void> | undefined;
      // A browser refuses for a moment after Escape; the next click asks again.
      asked?.catch?.(() => {});
    } catch {
      /* not this time */
    }
  };
  const letGo = () => {
    if (!looking()) return;
    weLetGo = true;
    document.exitPointerLock();
  };

  const onMove = (e: MouseEvent) => {
    if (!active() || !looking()) return;
    const next = lookAfter(o.rig.rotation.y, pitch, e.movementX, e.movementY);
    o.rig.rotation.y = next.yaw;
    pitch = next.pitch;
    o.camera.rotation.x = pitch;
  };
  const onDown = (e: MouseEvent) => {
    if (!active() || e.button !== 0) return;
    // The first click takes the pointer; from then on a click uses what is in the middle of the view.
    if (looking()) o.onUse();
    else look();
  };
  const onLock = () => {
    dot.style.display = looking() ? "block" : "none";
    if (looking()) return;
    for (const k of Object.keys(held) as (keyof Held)[]) held[k] = false;
    // The pointer came back without our asking: the visitor pressed Escape, and Escape is the menu.
    if (active() && !weLetGo && o.hud && !o.hud.open) o.hud.setOpen(true);
    weLetGo = false;
  };
  const typing = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
  };
  const onKey = (e: KeyboardEvent) => {
    if (!active() || typing(e)) return;
    if (e.code === "Escape") {
      // Where a browser gives the page Escape (in fullscreen, with the key held for it), it is the menu here too.
      if (looking()) {
        letGo();
        o.hud?.setOpen(true);
      } else if (o.hud && !o.hud.open && performance.now() - closedAt > 80) o.hud.setOpen(true);
      return;
    }
    if (o.hud?.open) return;
    const which = heldKey(e.code);
    if (which) {
      held[which] = true;
      // Shift with a letter is still walking, and an arrow key must not scroll the page under the world.
      if (e.code.startsWith("Arrow")) e.preventDefault();
      return;
    }
    if (e.code === "KeyF" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) o.onUse();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const which = heldKey(e.code);
    if (which) held[which] = false;
  };
  const onBlur = () => {
    for (const k of Object.keys(held) as (keyof Held)[]) held[k] = false;
  };
  // In fullscreen a browser may hand the page Escape instead of leaving: then one press is the menu, and holding it leaves.
  const onFullscreen = () => {
    const keyboard = (navigator as Navigator & { keyboard?: { lock?(keys: string[]): Promise<void>; unlock?(): void } }).keyboard;
    try {
      if (document.fullscreenElement && active()) void keyboard?.lock?.(["Escape"])?.catch?.(() => {});
      else keyboard?.unlock?.();
    } catch {
      /* not offered here */
    }
  };
  o.dom.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("pointerlockchange", onLock);
  document.addEventListener("fullscreenchange", onFullscreen);
  addEventListener("keydown", onKey);
  addEventListener("keyup", onKeyUp);
  addEventListener("blur", onBlur);
  const stopSignals = o.controls.onSignal((name) => {
    // The menu is open: the pointer is needed for it. Closed: the next click on the view looks round again.
    if (name === "menuOpen") letGo();
    if (name === "menuClose") {
      closedAt = performance.now();
      // Closing the menu goes back to looking, where the browser allows it; where it doesn't, a click does.
      setTimeout(look, 0);
    }
  });

  const setEnabled = (on: boolean) => {
    const next = on && mouse;
    if (next === enabled) return;
    enabled = next;
    keepIntense(enabled, key);
    if (!enabled) {
      letGo();
      pitch = 0;
      o.camera.rotation.x = 0;
      onBlur();
    }
    onFullscreen();
  };

  o.controls.add({
    id: "fps",
    section: "moving",
    icon: "step",
    on: () => enabled,
    // No mouse, no mouse look. And not in a headset, where it has no meaning.
    hidden: () => !mouse || o.presenting(),
    label: () => (enabled ? DESK_WORDS.intense : DESK_WORDS.casual),
    act: () => {
      setEnabled(!enabled);
      o.controls.say(enabled ? DESK_WORDS.nowIntense : DESK_WORDS.nowCasual);
    },
  });

  const at = o.camera.position.clone();
  return {
    get enabled() {
      return enabled;
    },
    setEnabled,
    get looking() {
      return looking();
    },
    update(dt) {
      if (!active()) {
        if (looking()) letGo();
        return false;
      }
      // Said once, to someone who has it on and hasn't clicked yet: nothing happens until they do.
      if (!told && !looking() && !o.hud?.open) {
        told = true;
        o.controls.say(DESK_WORDS.click);
      }
      if (o.hud?.open) return true;
      const [dx, dz] = strideOf(held, o.rig.rotation.y, o.speed ?? 2.4, dt);
      if (!dx && !dz) return true;
      o.camera.getWorldPosition(at);
      // The whole step, then each direction alone, so a visitor slides along a wall instead of sticking to it.
      if (o.canStand(at.x + dx, at.z + dz)) {
        o.rig.position.x += dx;
        o.rig.position.z += dz;
      } else if (o.canStand(at.x + dx, at.z)) o.rig.position.x += dx;
      else if (o.canStand(at.x, at.z + dz)) o.rig.position.z += dz;
      else o.onBlocked?.();
      return true;
    },
    dispose() {
      letGo();
      dot.remove();
      stopSignals();
      o.controls.remove("fps");
      o.dom.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("pointerlockchange", onLock);
      document.removeEventListener("fullscreenchange", onFullscreen);
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onKeyUp);
      removeEventListener("blur", onBlur);
    },
  };
}
