/**
 * The control that fills the screen with the world, and gives it back. The
 * same in every world, whatever draws it.
 */
import type { Controls, UiAction } from "./model.js";

export function fullscreenAction(controls: Controls, presenting: () => boolean): UiAction {
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
