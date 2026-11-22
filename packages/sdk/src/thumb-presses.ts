/**
 * A held item's presses under the thumb, on a touch screen (the owner, 2026-11-22: option B, "as recommended").
 *
 * While something that does something is in hand on a phone: a sight in the middle of the view, which is where its
 * first press sends what it sends out, and that press as a large round button by the right thumb, with the second
 * press as a smaller one beside it. The visitor can put them by the left thumb instead (`THUMBS_KEY`). A tap on the
 * view is then a walk, as it is with nothing in hand, so a walk never fires and a press to fire never walks.
 *
 * Nothing of this shows with nothing in hand, at a desk, in a headset, or while the visitor's menu is open. It is
 * drawn over the controls' messages, so a message never covers Fire, and it hides whenever their menu opens; it
 * keeps clear of the menu button and the bar, the visitor's own ways to their controls.
 */
import { rgb, type UiTheme } from "./ui/theme.js";

/** Where the visitor keeps which thumb the buttons are by: "left", or nothing for the right. */
export const THUMBS_KEY = "nswp:thumbs";
/** The first press's button, across, in CSS pixels: big enough to find without looking. */
export const THUMB_FIRST = 78;
/** The second press's button: smaller, so the two are never mistaken for each other. */
export const THUMB_SECOND = 54;

export type ThumbSide = "left" | "right";

export function thumbSide(): ThumbSide {
  try {
    return globalThis.localStorage?.getItem(THUMBS_KEY) === "left" ? "left" : "right";
  } catch {
    return "right";
  }
}

export function setThumbSide(side: ThumbSide): void {
  try {
    if (side === "left") globalThis.localStorage?.setItem(THUMBS_KEY, "left");
    else globalThis.localStorage?.removeItem(THUMBS_KEY);
  } catch {
    /* kept for this visit only */
  }
}

export interface ThumbPresses {
  /** Show them for these presses ("Fire", "Reload"; "" for none), on this side, in these colours; or hide them with null. */
  show(does: { use: string; second: string } | null, side: ThumbSide, theme: UiTheme): void;
  /** What is showing, for tests: the two buttons' words and boxes, and whether the sight is up. */
  info(): { sight: boolean; side: ThumbSide | ""; buttons: { label: string; x: number; y: number; w: number; h: number }[] };
  dispose(): void;
}

export function createThumbPresses(o: { use(): void; second(): void }): ThumbPresses {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return { show() {}, info: () => ({ sight: false, side: "", buttons: [] }), dispose() {} };
  const host = document.createElement("div");
  host.setAttribute("data-nswp", "thumb-presses");
  // Just over the controls' own layer, so a message they say is never over Fire. It is hidden while their menu is
  // open, and keeps clear of the menu button (top) and the bar (bottom middle).
  host.style.cssText = "position:fixed;inset:0;z-index:2147483001;pointer-events:none;display:none";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    .sight { position: absolute; left: 50%; top: 50%; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%;
      border: 2px solid var(--ink); box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(0, 0, 0, 0.35); }
    .sight::after { content: ""; position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px; border-radius: 50%; background: var(--ink); }
    .pad { position: absolute; bottom: calc(max(10px, env(safe-area-inset-bottom)) + 118px); width: ${THUMB_FIRST + THUMB_SECOND}px; height: ${THUMB_FIRST + THUMB_SECOND - 10}px; }
    .pad.right { right: max(14px, env(safe-area-inset-right)); }
    .pad.left { left: max(14px, env(safe-area-inset-left)); }
    button { position: absolute; pointer-events: auto; border-radius: 50%; border: 2px solid var(--accent); color: var(--ink);
      background: rgba(var(--glass-rgb), 0.55); font: 650 15px system-ui, "Segoe UI", Roboto, sans-serif; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
      display: flex; align-items: center; justify-content: center; padding: 0; touch-action: none; -webkit-tap-highlight-color: transparent;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); user-select: none; -webkit-user-select: none; }
    button:active, button.down { background: rgba(var(--accent-rgb), 0.45); }
    button:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
    .first { width: ${THUMB_FIRST}px; height: ${THUMB_FIRST}px; bottom: 0; background: rgba(var(--accent-rgb), 0.28); }
    .second { width: ${THUMB_SECOND}px; height: ${THUMB_SECOND}px; top: 0; font-size: 12px; }
    .right .first { right: 0; } .right .second { left: 0; }
    .left .first { left: 0; } .left .second { right: 0; }
    [hidden] { display: none !important; }
  </style><div class="sight" part="sight"></div><div class="pad right"><button class="second" type="button"></button><button class="first" type="button"></button></div>`;
  const sightEl = root.querySelector(".sight") as HTMLElement;
  const pad = root.querySelector(".pad") as HTMLElement;
  const first = root.querySelector(".first") as HTMLButtonElement;
  const second = root.querySelector(".second") as HTMLButtonElement;
  // Pressed as the finger goes down, so a press is felt at once; and the press is the button's alone: the view
  // behind it neither walks nor turns.
  const press = (button: HTMLButtonElement, act: () => void) => {
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      button.classList.add("down");
      act();
    });
    for (const end of ["pointerup", "pointercancel", "pointerleave"]) button.addEventListener(end, () => button.classList.remove("down"));
    // A keyboard or a switch presses it with a click, which a finger's press has already done.
    button.addEventListener("click", (e) => {
      if (e.detail === 0) act();
    });
    button.addEventListener("contextmenu", (e) => e.preventDefault());
  };
  press(first, () => o.use());
  press(second, () => o.second());
  let showing: { side: ThumbSide | "" } = { side: "" };
  let attached = false;
  return {
    show(does, side, theme) {
      if (!does || (!does.use && !does.second)) {
        host.style.display = "none";
        showing = { side: "" };
        return;
      }
      if (!attached) {
        document.body.appendChild(host);
        attached = true;
      }
      host.style.setProperty("--ink", theme.ink);
      host.style.setProperty("--accent", theme.accent);
      host.style.setProperty("--accent-rgb", rgb(theme.accent));
      host.style.setProperty("--glass-rgb", rgb(theme.glass));
      pad.className = `pad ${side}`;
      first.textContent = does.use;
      first.hidden = !does.use;
      first.setAttribute("aria-label", does.use);
      second.textContent = does.second;
      second.hidden = !does.second;
      second.setAttribute("aria-label", does.second);
      // The sight shows where the first press goes; with no first press there is nothing to aim.
      sightEl.hidden = !does.use;
      host.style.display = "block";
      showing = { side };
    },
    info() {
      if (host.style.display === "none") return { sight: false, side: "", buttons: [] };
      const box = (b: HTMLButtonElement) => {
        const r = b.getBoundingClientRect();
        return { label: b.textContent ?? "", x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      return { sight: !sightEl.hidden, side: showing.side, buttons: [first, second].filter((b) => !b.hidden).map(box) };
    },
    dispose() {
      host.remove();
      attached = false;
    },
  };
}
