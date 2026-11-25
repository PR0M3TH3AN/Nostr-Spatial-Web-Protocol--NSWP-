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
import { aimScale, lookScale } from "./desk.js";
import { startingForm } from "./form.js";
import { clientPanelOpen, onClientSignIn } from "./client-frame.js";
import { arrivedSettings, reportSettings } from "./settings.js";
import { mayAskHowTheyMove } from "./ask-once.js";
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
  nowIntense: "Intense: the mouse looks round. W, A, S, D walk, Shift runs, Space jumps, F uses what is in front of you, and Escape brings up this menu.",
  nowCasual: "Casual: click where you want to stand, twice to run there, and drag to look round. W, A, S, D walk, Shift runs and Space jumps.",
} as const;
/**
 * A way of moving that needs a mouse is not offered where there isn't one, or to a visitor who arrived using
 * their fingers on a device that has both (form.ts).
 */
export const hasMouse = (): boolean => startingForm() === "desk";
/** Whether a visitor starts out moving the intense way at a desk: they arrived so, or chose it here before. */
export function startsIntense(arrived: boolean, key = DESK_KEY): boolean {
  if (!hasMouse()) return false;
  // Their settings say which they prefer: that is it, either way, in place of what this site remembered.
  const prefers = arrivedSettings().intense;
  if (typeof prefers === "boolean") return prefers;
  try {
    return arrived || localStorage.getItem(key) === "1";
  } catch {
    return arrived;
  }
}
/** Keep the choice: casual is kept as plainly as intense, so a visitor who chose casual isn't asked again. */
export function keepIntense(on: boolean, key = DESK_KEY): void {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* it lasts for this visit */
  }
}
/** Whether this site keeps a choice of how they move at a desk. */
export function keptIntense(key = DESK_KEY): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
/** The words of the question asked once, the first time a visitor is at a desk with a mouse and no choice said or kept. */
export const DESK_QUESTION = {
  casual: "Casual: click to walk, drag to look",
  intense: "Intense: the mouse looks, keys walk",
} as const;

export interface FpsOptions {
  /** What is clicked to look round: the canvas. */
  dom: HTMLElement;
  camera: THREE.Object3D;
  /** What is turned and moved: the camera's parent. */
  rig: THREE.Object3D;
  controls: Controls;
  /** The menu, so Escape can bring it up and looking can stop while it is open. */
  hud?: { readonly open: boolean; setOpen(open: boolean): void } | null;
  /**
   * Whether the one-time question, "how you move at a desk", is this page's to ask. False where the visitor's
   * client draws the menu above this world: whoever draws the console asks, and the answer comes down as a setting
   * (visitor-switches.ts, `askDeskMoving`). Left out, it is this page's.
   */
  mayAsk?: () => boolean;
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
  // Whether they have said how they move at a desk: in their settings as they arrived, moving the intense way where
  // they came from, or kept on this site. Until they have, nothing is said about it to the next place.
  let answered = typeof arrivedSettings().intense === "boolean" || o.arrived === true || keptIntense(key);
  if (mouse) {
    // What they arrived preferring is kept here too, and what they prefer now goes on with them. Where there is
    // no mouse nothing is said, so the preference passes through a phone untouched.
    if (typeof arrivedSettings().intense === "boolean" || o.arrived) keepIntense(enabled, key);
    // Their client's menu changed how they move at a desk (settings.ts, `changeSettings`).
    reportSettings("moving", () => (answered ? { intense: enabled } : {}), (now) => void (typeof now.intense === "boolean" && setEnabled(now.intense)));
  }
  const held: Held = {};
  let pitch = 0;
  let weLetGo = false;
  let closedAt = -1;
  let shown = false;
  const looking = () => document.pointerLockElement === o.dom;
  /** Whether this held the pointer when the browser last said: a change that changes nothing is not acted on. */
  let lockedBefore = typeof document !== "undefined" && looking();
  const active = () => enabled && !o.presenting();

  // A dot in the middle of the view: what F and a click will use.
  const dot = document.createElement("div");
  dot.setAttribute("aria-hidden", "true");
  dot.style.cssText = "position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#fff;opacity:.75;box-shadow:0 0 0 1px rgba(0,0,0,.55);pointer-events:none;z-index:5;display:none";
  document.body.append(dot);

  // The client above has a panel of the sign-in address's up over this world (client-frame.ts). It is drawn by the
  // client's page, over the view, and is the visitor's to press: while it is up this takes no pointer, no key and no
  // movement of the mouse. The owner, 2026-11-24, of 0.87.0: "the bitlogin panels force me to hit escape again to
  // use. The game just playes behind them". The menu steps aside as the panel comes up; closing the menu asks for
  // the pointer again, a moment after the visitor's own press, and the browser gave it: the panel came up over a
  // world that held the pointer and the keys, and the only way out was Escape, which also ends full screen.
  const panelUp = () => clientPanelOpen();
  const look = () => {
    if (!active() || o.hud?.open || looking() || panelUp()) return;
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

  // A browser gives a page the pointer only after a press, and a visitor who has just arrived from another world
  // has pressed nothing here yet. They are still moving the intense way: the mouse looks round at once, over the
  // view, with the pointer hidden. The pointer itself is taken at their first key or click, without their being
  // asked for either. So nobody is put back to the casual way by going through a door.
  const free = (e: MouseEvent) => !looking() && !o.hud?.open && !panelUp() && e.target === o.dom && e.buttons === 0;
  const onMove = (e: MouseEvent) => {
    // With the panel up the mouse turns nothing, whoever has the pointer (see `onLock`).
    if (!active() || panelUp() || !(looking() || free(e))) return;
    const next = lookAfter(o.rig.rotation.y, pitch, e.movementX, e.movementY, LOOK_SPEED * lookScale() * aimScale());
    o.rig.rotation.y = next.yaw;
    pitch = next.pitch;
    o.camera.rotation.x = pitch;
  };
  const onDown = (e: MouseEvent) => {
    // With the client's panel up, a press on what shows of the view beside it is not a press in the world.
    if (!active() || e.button !== 0 || panelUp()) return;
    // The first click takes the pointer; from then on a click uses what is in the middle of the view.
    if (looking()) o.onUse();
    else look();
  };
  const onLock = () => {
    // A browser may tell of the same change more than once (given three times over, let go twice, seen 2026-11-24 on
    // a quiet machine). A second "let go" after the one we asked for was read as the visitor's Escape, and brought
    // the menu up that the visitor had just put away: their next press of the key then put it away again. Only a
    // change from what was is acted on; the browser's own letting go, at Escape, is still the first one.
    const now = looking();
    if (now === lockedBefore) return;
    lockedBefore = now;
    if (now) {
      // The pointer has just been given. A browser takes a moment to give it, and the panel or the menu may have
      // come up in that moment: asked for as the client's menu went, with the panel said up 30 ms later, there was
      // nothing yet to let go when the panel came, and the pointer then arrived under it (found 2026-11-24 by
      // `trials/panel-pointer.mjs` on a loaded machine, one run in five; a fault in 0.88.0). Given so, it is let
      // go at once.
      if (panelUp() || o.hud?.open) letGo();
      return;
    }
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
      // The menu took this press already (it is mounted first, and says so with preventDefault): in fullscreen
      // with the key held, the first press opened it and the next leaves fullscreen. Opening it again here would
      // make one press both, so all that is left is to give the pointer back.
      if (e.defaultPrevented) {
        if (looking()) letGo();
        return;
      }
      // Where a browser gives the page Escape (in fullscreen, with the key held for it), it is the menu here too.
      if (looking()) {
        letGo();
        o.hud?.setOpen(true);
      } else if (o.hud && !o.hud.open && performance.now() - closedAt > 80) o.hud.setOpen(true);
      return;
    }
    if (o.hud?.open || panelUp()) return;
    // Any key is a press as far as a browser is concerned: the pointer is taken now, so nothing need be clicked.
    if (!looking() && !e.repeat) look();
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
  // Holding Escape in fullscreen is the kit's for every visitor now, casual or intense (ui/fullscreen.ts,
  // `watchEscape`): the first press is the menu, the next leaves. Nothing here locks or unlocks the key.
  o.dom.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("pointerlockchange", onLock);
  addEventListener("keydown", onKey);
  addEventListener("keyup", onKeyUp);
  addEventListener("blur", onBlur);
  // The panel comes up: the pointer is let go, as for the menu, and whatever key was held is let go with it. This
  // is also a panel asked for with the menu down and the pointer held (a world's own thing that needs the visitor
  // signed in). When it goes there is nothing to do: a menu that stepped aside for it comes back by itself, and
  // otherwise the next press on the view takes the pointer, as after the menu.
  const stopPanel = onClientSignIn((up) => {
    if (!up) return;
    for (const k of Object.keys(held) as (keyof Held)[]) held[k] = false;
    letGo();
  });
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
    // Their own hand on it is a choice, even one that changes nothing: from now on it goes with them.
    if (mouse) {
      answered = true;
      keepIntense(next, key);
    }
    if (next === enabled) return;
    enabled = next;
    if (!enabled) {
      letGo();
      pitch = 0;
      o.camera.rotation.x = 0;
      onBlur();
      dot.style.display = "none";
      o.dom.style.cursor = "";
    }
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

  // The first time they are at a desk with a mouse here, with no choice said or kept: asked once, on the screen,
  // and remembered. Put away without an answer, it is casual. Choosing intense takes nothing: the pointer is taken
  // when they press the view, as always. A phone is never asked, and never offered the intense way.
  // (The owner, 2026-11-21: "the first time someone enters the game in 2D desktop mode. Casual or intense.")
  let asking = false;
  const answer = (intense: boolean) => {
    asking = false;
    setEnabled(intense);
    o.controls.say(intense ? DESK_WORDS.nowIntense : DESK_WORDS.nowCasual);
  };
  o.controls.addSection({ id: "how-you-move-desk", label: "How you move", icon: "step", note: () => (asking ? "You can change this whenever you like, in Moving." : "") });
  o.controls.add(
    { id: "desk-casual", section: "how-you-move-desk", icon: "step", hidden: () => !asking || o.presenting(), label: DESK_QUESTION.casual, act: () => answer(false) },
    { id: "desk-intense", section: "how-you-move-desk", icon: "look", hidden: () => !asking || o.presenting(), label: DESK_QUESTION.intense, act: () => answer(true) },
  );
  const stopAskingDesk = o.controls.onSignal((name) => {
    if (name === "menuClose" && asking) answer(false);
  });
  let askTimer = 0;
  if (mouse && !answered && mayAskHowTheyMove()) {
    // A moment after the place is up, so the question isn't the first thing drawn over a page still building.
    askTimer = window.setTimeout(() => {
      if (answered || o.presenting() || o.mayAsk?.() === false) return;
      asking = true;
      o.controls.signal("show:how-you-move-desk");
    }, 1200);
  }

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
        if (shown) {
          shown = false;
          dot.style.display = "none";
          o.dom.style.cursor = "";
        }
        return false;
      }
      // The middle of the view is what they point with, whether or not the browser has given the pointer over
      // yet: the dot is there and the pointer's own picture is not, except while the menu needs it.
      const aiming = !o.hud?.open;
      if (aiming !== shown) {
        shown = aiming;
        dot.style.display = aiming ? "block" : "none";
      }
      o.dom.style.cursor = aiming ? "none" : "";
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
      clearTimeout(askTimer);
      stopAskingDesk();
      letGo();
      dot.remove();
      stopSignals();
      stopPanel();
      o.controls.remove("fps");
      o.dom.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("pointerlockchange", onLock);
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onKeyUp);
      removeEventListener("blur", onBlur);
    },
  };
}
