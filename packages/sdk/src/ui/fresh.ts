/**
 * The control that tells a visitor the world they are in has been updated,
 * and loads the latest (fresh.ts; protocol/09-what-a-world-owes.md, "Always
 * the latest"). It is in every world's console, and shows only when there is
 * something newer to load.
 */
import { watchFresh, type Fresh } from "../fresh.js";
import type { Controls, UiAction } from "./model.js";

/** Whether they are writing something a reload would lose. */
const writing = (): boolean => {
  const at = typeof document !== "undefined" ? document.activeElement : null;
  return !!at && (at.tagName === "INPUT" || at.tagName === "TEXTAREA" || (at as HTMLElement).isContentEditable === true);
};

/**
 * Watch for the site being updated, and return the control for it: "This place has been updated. Reload for the
 * latest", on the bar and under Help while it is so, and absent otherwise. `busy` says when a reload would break
 * what they are doing, beyond being in a room or writing, which are known here: in a headset, say.
 */
export function freshAction(controls: Controls, opts: { busy?: () => boolean; fresh?: Fresh } = {}): UiAction {
  const fresh =
    opts.fresh ??
    watchFresh({
      busy: () => controls.view().chat.ready || writing() || opts.busy?.() === true,
      onStale: () => {
        controls.say("This place has been updated since you opened it. Reload for the latest: it is on your bar, and under Help.");
        controls.signal("fresh");
      },
    });
  return {
    id: "fresh",
    section: "help",
    icon: "turn",
    hotbar: true,
    tone: "primary",
    label: "This place has been updated. Reload for the latest",
    short: "Reload",
    hidden: () => !fresh.stale,
    act: () => fresh.reload(),
  };
}
