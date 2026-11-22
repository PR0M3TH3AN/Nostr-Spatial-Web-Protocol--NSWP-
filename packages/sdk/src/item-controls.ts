/**
 * Pressing what is in your hand (protocol/17-items.md): the same two presses on every kind of device.
 *
 * An item that does something says what its presses are called ("Fire", "Reload"). They are offered the way
 * everything else is:
 *
 * - **On a touch screen, under the thumb** (thumb-presses.ts; the owner, 2026-11-22, option B): a sight in the
 *   middle of the view, the first press as a large round button by the right thumb and the second as a smaller one
 *   (by the left thumb, if the visitor says so). The first press sends along the sight. A tap on the view is a walk,
 *   exactly as with nothing in hand: on a touch screen a tap never fires.
 * - **On the bar,** as its first two buttons, everywhere but a touch screen (where they are under the thumb): the
 *   1 and 2 keys at a desk, a press on the wrist in a headset. They lead the bar while the item is in hand, so a
 *   narrow screen never leaves one off.
 * - **A click on the view, at a desk,** is the first press, and what it sends out goes where the visitor clicked
 *   (`tap`, which the world calls from its own handling of a press, after its panels). A press held is not: that
 *   is still how they walk. So an item that reloads on a press when it is empty is reloaded by a click.
 * - **At a desk in the intense way of moving,** the mouse button is the first press, since the pointer is the
 *   view's there, and the other mouse button, held, aims along the item's sight where it has one. R is the second
 *   press, in either way of moving.
 * - **In a headset,** the trigger of the hand that holds it is the first press (`trigger`, which the world calls
 *   from its own handling of a trigger, after anything of its console that the hand was pointing at).
 *
 * Nothing is offered while the item in hand does nothing, or its logic isn't running.
 */
import type * as THREE from "three";
import type { Play } from "./play.js";
import type { Controls } from "./ui/model.js";
import { currentForm } from "./form.js";
import { createThumbPresses, setThumbSide, thumbSide } from "./thumb-presses.js";

export interface ItemControlsOptions {
  /** What is in play now (`presence.play`), or null in a world with no items. */
  play(): Play | null;
  /** Which hand holds the item in a headset (`presence.holdingHand`): its controller's index, or -1. */
  holdingHand(): number;
  /** The view: a press of the mouse on it, while the pointer is the view's, is the first press. */
  dom?: HTMLElement | null;
  /** They began, or stopped, aiming along the sight of what they hold (`presence.setSighting`). */
  sight?: (on: boolean) => void;
  /** Whether a headset session is running: nothing is put under the thumb then. */
  presenting?: () => boolean;
}

/** A press shorter than this is a tap; one held longer is the visitor walking, as it always was. */
export const TAP_MS = 320;

export interface ItemControls {
  /** Call when what is held, or what it does, may have changed. */
  refresh(): void;
  /** A trigger was pressed in a headset, on nothing of the console: true if that was the item's first press. */
  trigger(hand: number): boolean;
  /**
   * The view was pressed, at a desk, on none of the visitor's panels: `ray` is where, and `heldMs` for how long.
   * True if that was the item's first press, sent the way they pressed: the world then does nothing else with it.
   * `pointerType` is the press's own (a `PointerEvent`'s): a touch is never the item's, it is a walk. Left out,
   * the device they last pressed with decides.
   */
  tap(ray: { origin: THREE.Vector3; direction: THREE.Vector3 }, heldMs: number, pointerType?: string): boolean;
  /** What is under the thumb now, for tests. */
  thumbs(): ReturnType<ReturnType<typeof createThumbPresses>["info"]>;
  dispose(): void;
}

export function addItemControls(controls: Controls, o: ItemControlsOptions): ItemControls {
  let shown = "";
  let menuOpen = false;
  const does = () => o.play()?.does ?? null;
  const touch = () => currentForm() === "touch";
  const thumbs = createThumbPresses({ use: () => o.play()?.use(), second: () => o.play()?.second() });
  const refresh = () => {
    const now = does();
    const onTouch = touch();
    // Under the thumb, on a touch screen, while there is something to press and nothing is over the view.
    thumbs.show(now && onTouch && !menuOpen && !o.presenting?.() ? now : null, thumbSide(), controls.theme);
    const key = now ? `${now.use}|${now.second}|${onTouch}` : "";
    if (key === shown) return;
    const taken = !shown.startsWith(`${now?.use ?? ""}|${now?.second ?? ""}|`) || !shown;
    shown = key;
    controls.remove("item-use");
    controls.remove("item-second");
    // Nothing in hand that is aimed: the sight is down.
    if (!now) return void sight(false);
    // In the menu always, one press away; on the bar everywhere but a touch screen, where they are under the thumb.
    if (now.use) controls.add({ id: "item-use", section: "bag", icon: "check", tone: "primary", hotbar: !onTouch, lead: !onTouch, label: now.use, short: now.use, act: () => o.play()?.use() });
    if (now.second) controls.add({ id: "item-second", section: "bag", icon: "turn", hotbar: !onTouch, lead: !onTouch, label: now.second, short: now.second, act: () => o.play()?.second() });
    // Said once each time something that does something is taken up: how it is pressed.
    if (now.use && taken) {
      if (onTouch) controls.say(`${now.use} is by your ${thumbSide()} thumb, and goes where the ring in the middle is. Tap to walk; drag to look round.`);
      else controls.say(`Click where you want to ${now.use.toLowerCase()}. Hold a press to walk.`);
    }
  };
  // Which thumb, for someone on a touch screen: in the Bag tab, beside what they hold.
  controls.add({
    id: "item-thumbs",
    section: "bag",
    icon: "turn",
    hidden: () => !touch() || !does(),
    label: () => `Buttons by your ${thumbSide()} thumb`,
    act: () => {
      setThumbSide(thumbSide() === "left" ? "right" : "left");
      refresh();
    },
  });
  const stopSignals = controls.onSignal((name) => {
    if (name !== "menuOpen" && name !== "menuClose") return;
    menuOpen = name === "menuOpen";
    refresh();
  });
  // What is held, and whether its logic is running, can change at any moment, and the device with it: looked at a
  // few times a second, and nothing is redrawn unless it changed.
  const watching = typeof setInterval === "function" ? setInterval(refresh, 250) : null;
  const typing = (e: Event): boolean => {
    const at = e.target as HTMLElement | null;
    return !!at && (at.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(at.tagName ?? ""));
  };
  let sighting = false;
  const sight = (on: boolean) => {
    if (on === sighting) return;
    sighting = on;
    o.sight?.(on);
  };
  const onDown = (e: MouseEvent) => {
    if (!document.pointerLockElement || !does()) return;
    if (e.button === 0 && does()?.use) o.play()?.use();
    // The other button brings the sight up and leaves it up, and the next press of it puts it down: nothing has
    // to be held while they aim (the owner, 2026-11-20).
    else if (e.button === 2) sight(!sighting);
  };
  // The other mouse button is the item's while the pointer is the view's: no menu comes up for it.
  const onMenu = (e: Event) => {
    if (document.pointerLockElement && does()) e.preventDefault();
  };
  const onLock = () => {
    if (!document.pointerLockElement) sight(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyR" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e) && does()?.second) o.play()?.second();
  };
  o.dom?.addEventListener("mousedown", onDown);
  o.dom?.addEventListener("contextmenu", onMenu);
  if (typeof document !== "undefined") document.addEventListener("pointerlockchange", onLock);
  if (typeof addEventListener === "function") addEventListener("keydown", onKey);
  refresh();
  return {
    refresh,
    tap(ray, heldMs, pointerType) {
      // A touch is a walk, as it is with nothing in hand: the first press is under the thumb there.
      if ((pointerType ?? (touch() ? "touch" : "mouse")) === "touch") return false;
      if (heldMs >= TAP_MS || !does()?.use) return false;
      o.play()?.use(ray.origin.clone().addScaledVector(ray.direction, 18));
      return true;
    },
    trigger(hand) {
      if (hand < 0 || hand !== o.holdingHand() || !does()?.use) return false;
      o.play()?.use();
      return true;
    },
    thumbs: () => thumbs.info(),
    dispose() {
      if (watching) clearInterval(watching);
      stopSignals();
      thumbs.dispose();
      controls.remove("item-thumbs");
      o.dom?.removeEventListener("mousedown", onDown);
      o.dom?.removeEventListener("contextmenu", onMenu);
      if (typeof document !== "undefined") document.removeEventListener("pointerlockchange", onLock);
      sight(false);
      if (typeof removeEventListener === "function") removeEventListener("keydown", onKey);
      controls.remove("item-use");
      controls.remove("item-second");
    },
  };
}
