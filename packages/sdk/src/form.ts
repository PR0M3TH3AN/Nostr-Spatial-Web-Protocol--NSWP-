/**
 * The form a visitor is in on a flat screen: using it with their fingers, or
 * with a mouse and keys.
 *
 * A visitor who was tapping their way round one world should not arrive in
 * the next laid out for a mouse, and the other way about. Most devices can
 * only be one or the other, and a world works that out for itself. Some can
 * be both: a laptop with a touch screen, a tablet with a keyboard. So what
 * the visitor was actually using travels with them through a door, as a
 * preference, and the place they arrive starts them the same way where the
 * device can do it (protocol/11-the-visitors-console.md).
 *
 * A headset session is a third form, and travels as `immersive`. This is
 * what they are out of one.
 */
import type { Form } from "@nswp/core";

export type { Form } from "@nswp/core";

const matches = (query: string): boolean => {
  try {
    return typeof matchMedia === "function" && matchMedia(query).matches;
  } catch {
    return false;
  }
};

/** What the device can do, as far as a page can tell. */
export interface DeviceForms {
  touch: boolean;
  mouse: boolean;
  /** What it would be taken for with nothing else known: whichever its main pointer is. */
  main: Form;
}

export function deviceForms(): DeviceForms {
  const touch = (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) || matches("(any-pointer: coarse)");
  const mouse = matches("(any-pointer: fine)");
  return { touch, mouse, main: matches("(pointer: fine)") ? "desk" : "touch" };
}

/**
 * The form to start a visitor in: the one they were said to be in, if this
 * device can do it, and otherwise the device's own. What a link says is a
 * preference, and a device that can't do it isn't asked to.
 */
export function formFor(said: Form | undefined, device: DeviceForms): Form {
  if (said === "touch" && device.touch) return "touch";
  if (said === "desk" && device.mouse) return "desk";
  return device.main;
}

let arrived: Form | undefined;
let used: Form | undefined;
let watching = false;

/** Say how the visitor arrived (`arrival.read()` does). */
export function arriveAs(form: Form | undefined): void {
  arrived = form;
  watch();
}

/** The form they start this visit in. It doesn't change during the visit, so a layout chosen by it stays put. */
export function startingForm(): Form {
  return formFor(arrived, deviceForms());
}

/** The form they are in now: what they last used here, or how they started. This is what goes on with them. */
export function currentForm(): Form {
  watch();
  return used ?? startingForm();
}

/** What they last pressed with here, if anything yet: stronger than anything a link says. */
export function usedForm(): Form | undefined {
  watch();
  return used;
}

function watch(): void {
  if (watching || typeof addEventListener !== "function") return;
  watching = true;
  // Whichever they last pressed with. A pen is neither, and changes nothing.
  addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch") used = "touch";
      else if (e.pointerType === "mouse") used = "desk";
    },
    { capture: true, passive: true },
  );
}

/** For tests: forget everything. */
export function resetForm(): void {
  arrived = undefined;
  used = undefined;
}
