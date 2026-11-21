/**
 * The way back into a headset, for someone who left a session to come here. The same in every world, whatever
 * draws it.
 *
 * A browser ends a headset session whenever the page changes, and starts one only on a press: nothing a page does
 * can change either, and no browser hands a session from one site to another. So a visitor who walked through a
 * door in a headset arrives looking at a flat page, and what is asked of them is made as small as it can be: the
 * whole page is the button. A press anywhere on it, with anything, takes them back in. They needn't aim at
 * anything, or read anything first. (The world's own controls over it, the menu and the few kept at hand, stay
 * what they are.)
 */
import { holdFullscreen } from "./fullscreen.js";

let granted = false;
const waitingForGrant = new Set<() => void>();
// Where a browser does carry a session on (a headset's own may, between two pages of one site), it says so with
// this event, and says it early: before a world is built. So it is listened for from the moment this is loaded.
// (One browser stops running the page altogether when asked to listen: it is left alone.)
try {
  if (typeof navigator !== "undefined" && navigator.xr && !/WebXRViewer\//i.test(navigator.userAgent)) {
    (navigator.xr as unknown as EventTarget).addEventListener("sessiongranted", () => {
      granted = true;
      for (const fn of [...waitingForGrant]) fn();
      waitingForGrant.clear();
    });
  }
} catch {
  /* not offered here */
}
/** Run this when the browser says a session may start with no press at all: now, if it already has. */
export function whenSessionGranted(fn: () => void): void {
  if (granted) fn();
  else waitingForGrant.add(fn);
}

export interface HeadsetOffer {
  remove(): void;
  /** The press that was taken didn't start a session. The next one is tried. */
  failed(): void;
}

/** A press of one of these is somebody finding their way round the page, not an answer. */
const NOT_A_PRESS = new Set(["Tab", "Shift", "Control", "Alt", "Meta", "CapsLock", "ContextMenu"]);
/** How long one press is given to start a session before another is taken. Several things are heard for each press. */
const TRYING_MS = 2000;
/** How long a press that nothing was heard of is waited on. A headset may ask them something first. */
const GIVE_UP_MS = 12_000;

/**
 * Put the offer up. `enter` is called on a press anywhere but on the way to stay, and must start the session in
 * that same turn (a browser allows it only then). `stay` is called when they would rather look round on the
 * screen: with the link, or Escape. Whoever put it up takes it down (`remove`), once a session has started or
 * they have chosen to stay.
 */
export function offerHeadset(title: string, enter: () => void, stay: () => void): HeadsetOffer {
  const scrim = document.createElement("div");
  scrim.id = "nswp-enter";
  scrim.setAttribute("role", "dialog");
  scrim.setAttribute("aria-label", `You've arrived at ${title}`);
  Object.assign(scrim.style, { position: "fixed", inset: "0", zIndex: "50", display: "grid", placeContent: "center", justifyItems: "center", gap: "18px", padding: "24px", background: "rgba(4, 7, 11, 0.62)", textAlign: "center", cursor: "pointer" });
  const heading = document.createElement("p");
  heading.textContent = title;
  Object.assign(heading.style, { margin: "0", font: "700 clamp(28px, 6vw, 56px)/1.1 system-ui, sans-serif", color: "#eef5fb" });
  const go = document.createElement("button");
  go.type = "button";
  go.id = "nswp-enter-vr";
  go.textContent = "Enter VR";
  // Large, for whoever does aim at it. Nobody has to: the page behind it does the same.
  Object.assign(go.style, { font: "700 clamp(24px, 5vw, 40px)/1 system-ui, sans-serif", minWidth: "min(78vw, 520px)", minHeight: "120px", padding: "0 32px", border: "0", borderRadius: "18px", background: "#eef5fb", color: "#04070b", cursor: "pointer" });
  const hint = document.createElement("p");
  hint.id = "nswp-enter-hint";
  hint.setAttribute("aria-live", "polite");
  hint.textContent = "Press anywhere, with anything, to go back in.";
  Object.assign(hint.style, { margin: "0", font: "500 clamp(18px, 3vw, 24px)/1.3 system-ui, sans-serif", color: "#eef5fb" });
  const flat = document.createElement("button");
  flat.type = "button";
  flat.id = "nswp-enter-flat";
  flat.textContent = "Look around on this screen";
  Object.assign(flat.style, { font: "500 18px/1 system-ui, sans-serif", padding: "14px 20px", border: "0", background: "none", color: "#eef5fb", textDecoration: "underline", cursor: "pointer" });
  scrim.append(heading, go, hint, flat);

  let tried = -Infinity;
  let up = true;
  let gaveUp: ReturnType<typeof setTimeout> | undefined;
  const presses = ["pointerup", "touchend", "keydown"] as const;
  const onPress = (e: Event) => {
    if (!up) return;
    const key = (e as KeyboardEvent).key;
    if (e.type === "keydown") {
      if (key === "Escape") return void stay();
      if (NOT_A_PRESS.has(key) || (e as KeyboardEvent).repeat) return;
    }
    // The way to stay is the one thing on the page that isn't the way in: a press on it, or the keys that press
    // it once they have moved to it. Any other key is still the way in.
    const at = e.target instanceof Element ? e.target : null;
    const onStay = !!at && flat.contains(at);
    if (onStay && (e.type !== "keydown" || key === "Enter" || key === " ")) return;
    // And the world's own controls, which sit over this, are still themselves: a press on the menu opens the menu.
    // Everything else is this page, however it is drawn.
    if (at && !scrim.contains(at) && at !== document.body && at !== document.documentElement && !(at instanceof HTMLCanvasElement)) return;
    // A browser says one press several ways. The first is taken, and the rest are that same press.
    const now = performance.now();
    if (now - tried < TRYING_MS) return;
    tried = now;
    hint.textContent = "Starting VR…";
    // Nothing came of it, and nobody said so: they aren't left reading that it is starting.
    clearTimeout(gaveUp);
    gaveUp = setTimeout(failed, GIVE_UP_MS);
    enter();
  };
  const failed = () => {
    clearTimeout(gaveUp);
    if (!up) return;
    tried = -Infinity;
    hint.textContent = "That press didn't start VR. Press again, anywhere.";
  };
  flat.addEventListener("click", stay);
  for (const type of presses) addEventListener(type, onPress, true);
  // A browser gives one press to one thing. While this is up, the press is for the headset, not the screen.
  holdFullscreen(true);
  document.body.append(scrim);
  go.focus();
  return {
    remove() {
      if (!up) return;
      up = false;
      clearTimeout(gaveUp);
      for (const type of presses) removeEventListener(type, onPress, true);
      holdFullscreen(false);
      scrim.remove();
    },
    failed,
  };
}
