/**
 * How a visitor likes a flat screen to behave: how fast the view turns, and
 * how wide they see.
 *
 * Both are theirs, and the same in every world: set once, kept here, and
 * sent on through every door with their other settings
 * (protocol/11-the-visitors-console.md, "Settings that travel"). A world
 * begins from what they arrived with, in place of what this site remembered.
 *
 * - **Look speed** scales every way the view is turned by hand on a flat
 *   screen: the mouse when moving the intense way, and a drag when moving
 *   the casual way. 1 is the kit's own speed.
 * - **Field of view** is how wide they see, top to bottom, at a desk. Left
 *   alone, it is each world's own. It is not applied to a touch screen,
 *   where a world fits its view to a tall, narrow window, or in a headset,
 *   which has its own.
 */
import { FOV_RANGE, LOOK_RANGE } from "@nswp/core";
import { currentForm } from "./form.js";
import { arrivedSettings, reportSettings } from "./settings.js";
import type { Controls } from "./ui/model.js";

/** Where they are kept, for this site. */
export const DESK_PREFS_KEY = "nswp:desk";
/** The speeds the control steps through, and what each is called. */
export const LOOK_STEPS: readonly { value: number; word: string }[] = [
  { value: 0.5, word: "slow" },
  { value: 0.75, word: "gentle" },
  { value: 1, word: "normal" },
  { value: 1.5, word: "quick" },
  { value: 2, word: "fast" },
  { value: 3, word: "fastest" },
];
/** The widths the control steps through. Null is the world's own. */
export const FOV_STEPS: readonly (number | null)[] = [null, 60, 70, 80, 90, 100, 110];

interface DeskPrefs {
  look: number;
  fov: number | null;
}

const clampLook = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(LOOK_RANGE[1], Math.max(LOOK_RANGE[0], v)) * 100) / 100 : 1);
const clampFov = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(FOV_RANGE[1], Math.max(FOV_RANGE[0], v))) : null);

let prefs: DeskPrefs | null = null;
const watchers = new Set<() => void>();

const keep = (p: DeskPrefs): void => {
  try {
    localStorage.setItem(DESK_PREFS_KEY, JSON.stringify(p));
  } catch {
    /* they last for this visit */
  }
};

function load(): DeskPrefs {
  if (prefs) return prefs;
  let kept: Partial<DeskPrefs> = {};
  try {
    kept = (JSON.parse(localStorage.getItem(DESK_PREFS_KEY) ?? "{}") ?? {}) as Partial<DeskPrefs>;
  } catch {
    /* nothing kept */
  }
  // What they arrived with comes first: it is what they have now, wherever they set it.
  const came = arrivedSettings();
  prefs = { look: clampLook(came.look ?? kept.look), fov: came.fov !== undefined ? clampFov(came.fov) : clampFov(kept.fov) };
  if (came.look !== undefined || came.fov !== undefined) keep(prefs);
  reportSettings("desk", () => ({ look: load().look, ...(load().fov === null ? {} : { fov: load().fov as number }) }));
  return prefs;
}

const change = (next: DeskPrefs): void => {
  prefs = next;
  keep(next);
  for (const w of watchers) w();
};

/** How much faster or slower than the kit's own speed the view turns under their hand. */
export const lookScale = (): number => load().look;
export const setLookScale = (v: number): void => change({ ...load(), look: clampLook(v) });
/** How wide they have asked to see, in degrees top to bottom, or null for each world's own. Only ever at a desk. */
export const visitorFov = (): number | null => (currentForm() === "desk" ? load().fov : null);
export const setVisitorFov = (v: number | null): void => change({ ...load(), fov: v === null ? null : clampFov(v) });
/** Hear of either changing. Returns how to stop. */
export function onDeskChange(cb: () => void): () => void {
  watchers.add(cb);
  return () => void watchers.delete(cb);
}

/** The next step on a list after the one nearest to where they are. */
const after = <T>(steps: readonly T[], at: number): T => steps[(at + 1) % steps.length]!;

/** The two controls: look speed under Moving, field of view under View. The same in every world. */
export function addDeskControls(controls: Controls, o: { presenting(): boolean }): void {
  const lookAt = () => {
    const now = lookScale();
    let best = 0;
    LOOK_STEPS.forEach((s, i) => {
      if (Math.abs(s.value - now) < Math.abs(LOOK_STEPS[best]!.value - now)) best = i;
    });
    return best;
  };
  controls.add(
    {
      id: "look-speed",
      section: "moving",
      icon: "turn",
      hidden: o.presenting,
      label: () => `Look speed: ${LOOK_STEPS[lookAt()]!.word}`,
      short: "Look speed",
      act: () => {
        setLookScale(after(LOOK_STEPS, lookAt()).value);
        controls.say(`Look speed: ${LOOK_STEPS[lookAt()]!.word}. It is the same in every world.`);
      },
    },
    {
      id: "fov",
      section: "view",
      icon: "size",
      // A touch screen's view is fitted to its window by the world, and a headset has its own.
      hidden: () => o.presenting() || currentForm() !== "desk",
      label: () => (load().fov === null ? "Field of view: this world's own" : `Field of view: ${load().fov}°`),
      short: "View width",
      act: () => {
        const at = FOV_STEPS.indexOf(load().fov);
        setVisitorFov(after(FOV_STEPS, at === -1 ? 0 : at));
        controls.say(load().fov === null ? "Field of view: each world's own." : `Field of view: ${load().fov}°, in every world.`);
      },
    },
  );
  onDeskChange(() => controls.setTarget(""));
}

/**
 * Keep a camera as wide as the visitor asked. `own` is how wide the world
 * would have it (a world that fits its view to the window says so here; left
 * out, it is what the camera had). Returns a function to call when the
 * window or the form changes.
 */
export function watchFov(camera: { fov: number; updateProjectionMatrix(): void }, o: { own?: () => number; presenting?: () => boolean } = {}): () => void {
  const first = camera.fov;
  const apply = () => {
    if (o.presenting?.()) return; // a headset sets its own view
    const fov = visitorFov() ?? o.own?.() ?? first;
    if (camera.fov === fov) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  };
  onDeskChange(apply);
  apply();
  return apply;
}

/** For tests: forget what was loaded. */
export function resetDesk(): void {
  prefs = null;
  watchers.clear();
}
