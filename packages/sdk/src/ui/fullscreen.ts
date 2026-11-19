/**
 * The control that fills the screen with the world, and gives it back. The
 * same in every world, whatever draws it.
 */
import { arrivedSettings, reportSettings } from "../settings.js";
import type { Controls, UiAction } from "./model.js";

let resumed = false;
/**
 * A visitor who had the world filling their screen has it filling their
 * screen again. A browser fills the screen only on a press, and gives it up
 * whenever the page changes. So this waits for their first key or click
 * here, which they were going to make anyway, and asks then. Leaving
 * fullscreen with the browser's own key is them saying otherwise, and holds.
 */
function resumeFullscreen(presenting: () => boolean): void {
  if (resumed || typeof document === "undefined") return;
  resumed = true;
  reportSettings("screen", () => ({ full: !!document.fullscreenElement || waiting }));
  let waiting = arrivedSettings().full === true && document.fullscreenEnabled && !document.fullscreenElement;
  if (!waiting) return;
  const stop = () => {
    waiting = false;
    removeEventListener("keydown", onPress, true);
    removeEventListener("pointerup", onPress, true);
  };
  const onPress = (e: Event) => {
    // Escape is how a visitor leaves fullscreen: never the press that enters it.
    if ((e as KeyboardEvent).code === "Escape" || presenting()) return;
    stop();
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => {});
  };
  addEventListener("keydown", onPress, true);
  addEventListener("pointerup", onPress, true);
}

export function fullscreenAction(controls: Controls, presenting: () => boolean): UiAction {
  resumeFullscreen(presenting);
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
