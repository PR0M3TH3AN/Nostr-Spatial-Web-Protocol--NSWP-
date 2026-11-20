/**
 * Pressing what is in your hand (protocol/17-items.md): the same two presses on every kind of device.
 *
 * An item that does something says what its presses are called ("Fire", "Reload"). They are offered the way
 * everything else is:
 *
 * - **On the bar,** as its first two buttons: a tap on a phone, the 1 and 2 keys at a desk, a press on the wrist
 *   in a headset. They lead the bar while the item is in hand, so a narrow screen never leaves one off.
 * - **A tap, or a click, on the view** is the first press, and what it sends out goes where the visitor pressed
 *   (`tap`, which the world calls from its own handling of a press, after its panels). A press held is not: that
 *   is still how they walk. So an item that reloads on a press when it is empty is reloaded by a tap.
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

export interface ItemControlsOptions {
  /** What is in play now (`presence.play`), or null in a world with no items. */
  play(): Play | null;
  /** Which hand holds the item in a headset (`presence.holdingHand`): its controller's index, or -1. */
  holdingHand(): number;
  /** The view: a press of the mouse on it, while the pointer is the view's, is the first press. */
  dom?: HTMLElement | null;
  /** They began, or stopped, aiming along the sight of what they hold (`presence.setSighting`). */
  sight?: (on: boolean) => void;
}

/** A press shorter than this is a tap; one held longer is the visitor walking, as it always was. */
export const TAP_MS = 320;

export interface ItemControls {
  /** Call when what is held, or what it does, may have changed. */
  refresh(): void;
  /** A trigger was pressed in a headset, on nothing of the console: true if that was the item's first press. */
  trigger(hand: number): boolean;
  /**
   * The view was pressed, at a desk or on a phone, on none of the visitor's panels: `ray` is where, and `heldMs`
   * for how long. True if that was the item's first press, sent the way they pressed: the world then does nothing
   * else with it.
   */
  tap(ray: { origin: THREE.Vector3; direction: THREE.Vector3 }, heldMs: number): boolean;
  dispose(): void;
}

export function addItemControls(controls: Controls, o: ItemControlsOptions): ItemControls {
  let shown = "";
  const does = () => o.play()?.does ?? null;
  const refresh = () => {
    const now = does();
    const key = now ? `${now.use}|${now.second}` : "";
    if (key === shown) return;
    shown = key;
    controls.remove("item-use");
    controls.remove("item-second");
    if (!now) return;
    if (now.use) controls.add({ id: "item-use", section: "bag", icon: "check", tone: "primary", hotbar: true, lead: true, label: now.use, short: now.use, act: () => o.play()?.use() });
    if (now.second) controls.add({ id: "item-second", section: "bag", icon: "turn", hotbar: true, lead: true, label: now.second, short: now.second, act: () => o.play()?.second() });
    // Said once each time something that does something is taken up: how it is pressed on the view itself.
    if (now.use) controls.say(`Tap or click where you want to ${now.use.toLowerCase()}. Hold a press to walk.`);
  };
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
    else if (e.button === 2) sight(true);
  };
  const onUp = (e: MouseEvent) => {
    if (e.button === 2) sight(false);
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
  if (typeof addEventListener === "function") addEventListener("mouseup", onUp);
  if (typeof document !== "undefined") document.addEventListener("pointerlockchange", onLock);
  if (typeof addEventListener === "function") addEventListener("keydown", onKey);
  refresh();
  return {
    refresh,
    tap(ray, heldMs) {
      if (heldMs >= TAP_MS || !does()?.use) return false;
      o.play()?.use(ray.origin.clone().addScaledVector(ray.direction, 18));
      return true;
    },
    trigger(hand) {
      if (hand < 0 || hand !== o.holdingHand() || !does()?.use) return false;
      o.play()?.use();
      return true;
    },
    dispose() {
      o.dom?.removeEventListener("mousedown", onDown);
      o.dom?.removeEventListener("contextmenu", onMenu);
      if (typeof removeEventListener === "function") removeEventListener("mouseup", onUp);
      if (typeof document !== "undefined") document.removeEventListener("pointerlockchange", onLock);
      sight(false);
      if (typeof removeEventListener === "function") removeEventListener("keydown", onKey);
      controls.remove("item-use");
      controls.remove("item-second");
    },
  };
}
