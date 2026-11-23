/**
 * The control that fills the screen with the world, and gives it back. The
 * same in every world, whatever draws it.
 */
import { askClientForScreen, clientHoldsScreen, clientScreenFilled, framed, meetClient, onClientScreen } from "../client-frame.js";
import { currentForm } from "../form.js";
import { arrivedSettings, reportSettings } from "../settings.js";
import type { Controls, UiAction } from "./model.js";

let resumed = false;
let waiting = false;
/** Where the preference is kept, for this site. */
export const FULL_KEY = "nswp:full";
/**
 * Whether the visitor prefers a filled screen. It is what they chose with the
 * control, not how the screen happens to be: pressing Escape for a moment in
 * one world doesn't change what they prefer in the next.
 */
let prefers = false;
const keepFull = (on: boolean): void => {
  prefers = on;
  try {
    if (on) localStorage.setItem(FULL_KEY, "1");
    else localStorage.removeItem(FULL_KEY);
  } catch {
    /* it lasts for this visit */
  }
};
export const prefersFullscreen = (): boolean => prefers;

let held = false;
/**
 * Something else is waiting for the visitor's next press (the way back into a headset, ui/headset.ts). A browser
 * gives one press to one thing, so while that is so the screen isn't filled by it.
 */
export const holdFullscreen = (on: boolean): void => {
  held = on;
};

/**
 * A visitor who prefers the world filling their screen has it filling their
 * screen, as early as a browser allows.
 *
 * A browser gives up fullscreen whenever the page changes, and fills the
 * screen again only on a press: nothing a page does can change either. So
 * this is the first thing looked at when a world reads how its visitor
 * arrived, before the place is built or anything is drawn, and it takes the
 * very first press of any kind: a key, a click, a touch, and a key that was
 * already held down as they walked through the door. It keeps trying until
 * the screen is filled. Leaving fullscreen with the browser's own key holds
 * for the rest of this visit, and changes nothing about what they prefer:
 * the next world fills the screen again. Only the control turns it off.
 *
 * `arrival.read()` calls it. A client's own page calls it itself, after
 * saying what the visitor arrived with (`arriveWith`).
 */
export function resumeFullscreen(presenting: () => boolean = () => false): void {
  if (resumed || typeof document === "undefined") return;
  resumed = true;
  // What they arrived with comes first: it is what they prefer now, wherever they said so.
  const came = arrivedSettings().full;
  let kept = false;
  try {
    kept = localStorage.getItem(FULL_KEY) === "1";
  } catch {
    /* nothing kept */
  }
  if (came === undefined) prefers = kept;
  else keepFull(came);
  reportSettings("screen", () => ({ full: prefers }));
  // Shown inside their client, which holds the screen (client-frame.ts): it is asked, and says when it is filled.
  // Whether it does hold it is heard a moment after this page loads, so a framed page waits to hear.
  meetClient();
  const mayAsk = framed();
  waiting = prefers && ((document.fullscreenEnabled && !document.fullscreenElement) || mayAsk);
  if (!waiting) return;
  const presses = ["keydown", "pointerdown", "pointerup", "touchend"] as const;
  const stop = () => {
    waiting = false;
    for (const type of presses) removeEventListener(type, onPress, true);
    document.removeEventListener("fullscreenchange", onChange);
    forget();
  };
  const onChange = () => {
    // Filled: done. And once it has been filled, leaving it is theirs to do and is never undone here.
    if (document.fullscreenElement || clientScreenFilled()) stop();
  };
  const forget = onClientScreen(onChange);
  const onPress = (e: Event) => {
    // Escape is how a visitor leaves fullscreen: never the press that enters it.
    if ((e as KeyboardEvent).code === "Escape" || held || presenting() || document.fullscreenElement) return;
    if (clientHoldsScreen()) return void (clientScreenFilled() ? stop() : askClientForScreen(true));
    // In a frame whose page hasn't said it holds the screen, and may not fill it itself: nothing to ask.
    if (!document.fullscreenEnabled) return;
    // Some presses a browser won't take (it decides which). The next one is tried, until one is.
    void document.documentElement.requestFullscreen().then(stop, () => {});
  };
  for (const type of presses) addEventListener(type, onPress, true);
  document.addEventListener("fullscreenchange", onChange);
  onChange();
}

/** Whether the screen is filled just now: by this page, or by the client it is shown in. */
const isFilled = (): boolean => (clientHoldsScreen() ? clientScreenFilled() : !!document.fullscreenElement);
/** Whether there is any way to fill it here: this page may, or the client that holds it can be asked. */
const canFill = (): boolean => clientHoldsScreen() || document.fullscreenEnabled;

/** Whether the screen is still waiting for a press to fill it again. */
export const fullscreenWaiting = (): boolean => waiting && canFill() && !isFilled();

export function fullscreenAction(controls: Controls, presenting: () => boolean): UiAction {
  resumeFullscreen(presenting);
  presentingNow = presenting;
  watchEscape();
  // Still waiting once there is somewhere to say so: tell them the one thing that will do it.
  setTimeout(() => {
    if (waiting && !held && !presenting() && canFill() && !isFilled()) controls.say("Press any key, or click, to fill the screen again.");
  }, 600);
  // What the client says of the screen changes what this control says, and whether there is one.
  onClientScreen(() => controls.setTarget(""));
  return {
    id: "fullscreen",
    section: "view",
    icon: "full",
    on: () => prefers,
    // Not every browser lets a page fill the screen (a phone's often won't), and a headset already does.
    hidden: () => !canFill() || presenting(),
    // It says what they prefer, in every world, and whether the screen is filled just now.
    label: () => (!prefers ? "Fullscreen: off" : isFilled() ? "Fullscreen: on, in every world" : "Fullscreen: on, in every world. Press to fill the screen again"),
    act: async () => {
      // Preferred, and not filled just now (they pressed Escape, or have only just arrived): fill it. Otherwise
      // this is them changing what they prefer.
      const fill = !isFilled();
      if (!fill) keepFull(false);
      // Their client holds the screen: it is asked, from this press, and says when it is done.
      if (clientHoldsScreen()) {
        if (fill) keepFull(true);
        askClientForScreen(fill);
        return void controls.setTarget("");
      }
      try {
        if (fill) {
          await document.documentElement.requestFullscreen();
          keepFull(true);
        } else await leaveFullscreen();
      } catch {
        controls.say("This browser wouldn't go fullscreen.");
      }
      controls.setTarget("");
    },
  };
}

// ------------------------------------------------------------------ Escape, and the button at the top
// The owner, 2026-11-21: "when the player is not in full screen mode, there should be a little fullscreen button
// somewhere. Like at the top center or something. And then when i am in fullscreen mode. Escape once should not exit
// full screen. It should pull up the menu. Escape again from the menu should exit full screen."
//
// A browser lets Escape leave fullscreen whatever a page wants, with one exception: where the Keyboard Lock API is
// offered (Chromium: Chrome, Brave, Edge), a page in fullscreen may hold Escape, and then the browser leaves only
// on a long hold of it. There, the first Escape opens the menu and the next, with the menu open, leaves. Elsewhere
// (Firefox, Safari) the first Escape leaves fullscreen, as the browser insists, and the menu comes up as it does.

type KeyboardLock = { lock?(keys: string[]): Promise<void>; unlock?(): void };
const keyboard = (): KeyboardLock | undefined => (typeof navigator === "undefined" ? undefined : (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard);
/** Whether this page holds Escape now: it is in fullscreen and the browser let it lock the key. */
let holding = false;
/** The page itself is leaving fullscreen (the second Escape, or the control): that isn't the browser taking it. */
let leaving = false;
let watching = false;
const leftByBrowser = new Set<() => void>();
/** Be told when the browser itself took the visitor out of fullscreen (its own Escape): the menu comes up then. */
export function onBrowserLeftFullscreen(fn: () => void): () => void {
  leftByBrowser.add(fn);
  return () => void leftByBrowser.delete(fn);
}

/**
 * Hold Escape whenever this page fills the screen, where the browser lets it; and say when the browser took the
 * screen back by itself. Called once, by the control; idempotent.
 */
export function watchEscape(): void {
  if (watching || typeof document === "undefined") return;
  watching = true;
  let wasFilled = !!document.fullscreenElement;
  const onChange = () => {
    const filled = !!document.fullscreenElement;
    if (filled) {
      holding = false;
      try {
        const asked = keyboard()?.lock?.(["Escape"]);
        if (asked) void asked.then(() => (holding = !!document.fullscreenElement), () => (holding = false));
      } catch {
        /* not offered here */
      }
    } else {
      holding = false;
      try {
        keyboard()?.unlock?.();
      } catch {
        /* nothing held */
      }
      if (wasFilled && !leaving) for (const fn of [...leftByBrowser]) fn();
      leaving = false;
    }
    wasFilled = filled;
  };
  document.addEventListener("fullscreenchange", onChange);
}

/** Whether Escape is this page's just now: in fullscreen, with the key held by it. */
export const escapeHeld = (): boolean => holding && typeof document !== "undefined" && !!document.fullscreenElement;

/**
 * What Escape does, given how things stand. One rule, asked by the menu and by the intense way of moving, so the
 * two never answer the same press differently.
 *
 * - The menu open, in fullscreen with Escape held: leave fullscreen (the menu stays open).
 * - The menu open otherwise: close it.
 * - The menu closed, in fullscreen with Escape held: open it.
 * - The menu closed otherwise: nothing here (moving the intense way, the pointer coming back opens it).
 */
export function escapeDoes(state: { menuOpen: boolean; held: boolean }): "leave-fullscreen" | "close-menu" | "open-menu" | "nothing" {
  if (state.menuOpen) return state.held ? "leave-fullscreen" : "close-menu";
  return state.held ? "open-menu" : "nothing";
}

/** Leave fullscreen from the page's own doing: not taken for the browser's. */
export async function leaveFullscreen(): Promise<void> {
  if (typeof document === "undefined" || !document.fullscreenElement) return;
  leaving = true;
  try {
    await document.exitFullscreen();
  } catch {
    leaving = false;
  }
}

let presentingNow: () => boolean = () => false;
/**
 * The small "Full screen" button at the top centre: shown on a desk, where this page may fill the screen and
 * doesn't yet, never in a headset session, and never on a touch screen (a phone that offers fullscreen at all keeps
 * it in the menu). Pressing it fills the screen, as the menu's control does, and keeps that as what they prefer.
 */
export const fullscreenButton = {
  shown(): boolean {
    if (typeof document === "undefined" || presentingNow()) return false;
    return canFill() && !isFilled() && currentForm() === "desk";
  },
  label: "Full screen",
  async press(controls?: Pick<Controls, "say">): Promise<void> {
    if (clientHoldsScreen()) {
      keepFull(true);
      askClientForScreen(true);
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
      keepFull(true);
    } catch {
      controls?.say("This browser wouldn't go fullscreen.");
    }
  },
};

