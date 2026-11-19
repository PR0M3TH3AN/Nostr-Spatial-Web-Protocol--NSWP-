/**
 * The control that fills the screen with the world, and gives it back. The
 * same in every world, whatever draws it.
 */
import { arrivedSettings, reportSettings } from "../settings.js";
import type { Controls, UiAction } from "./model.js";

let resumed = false;
let waiting = false;
/**
 * A visitor who had the world filling their screen has it filling their
 * screen again, as early as a browser allows.
 *
 * A browser gives up fullscreen whenever the page changes, and fills the
 * screen again only on a press: nothing a page does can change either. So
 * this is the first thing looked at when a world reads how its visitor
 * arrived, before the place is built or anything is drawn, and it takes the
 * very first press of any kind: a key, a click, a touch, and a key that was
 * already held down as they walked through the door. It keeps trying until
 * the screen is filled. Leaving fullscreen with the browser's own key is
 * them saying otherwise, and holds from then on.
 *
 * `arrival.read()` calls it. A client's own page calls it itself, after
 * saying what the visitor arrived with (`arriveWith`).
 */
export function resumeFullscreen(presenting: () => boolean = () => false): void {
  if (resumed || typeof document === "undefined") return;
  resumed = true;
  reportSettings("screen", () => ({ full: !!document.fullscreenElement || waiting }));
  waiting = arrivedSettings().full === true && document.fullscreenEnabled && !document.fullscreenElement;
  if (!waiting) return;
  const presses = ["keydown", "pointerdown", "pointerup", "touchend"] as const;
  const stop = () => {
    waiting = false;
    for (const type of presses) removeEventListener(type, onPress, true);
    document.removeEventListener("fullscreenchange", onChange);
  };
  const onChange = () => {
    // Filled: done. And once it has been filled, leaving it is theirs to do and is never undone here.
    if (document.fullscreenElement) stop();
  };
  const onPress = (e: Event) => {
    // Escape is how a visitor leaves fullscreen: never the press that enters it.
    if ((e as KeyboardEvent).code === "Escape" || presenting() || document.fullscreenElement) return;
    // Some presses a browser won't take (it decides which). The next one is tried, until one is.
    void document.documentElement.requestFullscreen().then(stop, () => {});
  };
  for (const type of presses) addEventListener(type, onPress, true);
  document.addEventListener("fullscreenchange", onChange);
}

/** Whether the screen is still waiting for a press to fill it again. */
export const fullscreenWaiting = (): boolean => waiting;

export function fullscreenAction(controls: Controls, presenting: () => boolean): UiAction {
  resumeFullscreen(presenting);
  // Still waiting once there is somewhere to say so: tell them the one thing that will do it.
  setTimeout(() => {
    if (waiting && !presenting()) controls.say("Press any key, or click, to fill the screen again.");
  }, 600);
  return {
    id: "fullscreen",
    section: "view",
    icon: "size",
    on: () => !!document.fullscreenElement,
    // Not every browser lets a page fill the screen (a phone's often won't), and a headset already does.
    hidden: () => !document.fullscreenEnabled || presenting(),
    label: () => (document.fullscreenElement ? "Fullscreen: on" : "Fullscreen: off"),
    act: async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        controls.say("This browser wouldn't go fullscreen.");
      }
    },
  };
}
