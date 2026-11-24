/**
 * The console in a headset, for an engine that isn't JavaScript's.
 *
 * In a headset the page and its menu can't be seen, so a world shows its controls on a panel in the world. In a
 * Three.js world the kit puts its own picture of them on a panel in the scene (console.ts). An engine has no such
 * scene of the kit's, so the kit draws the same picture here, with the same code (console-drawing.ts), and hands
 * the engine the pixels to show its own way.
 *
 *   const now = JSON.parse(NSWP.console('{"open":true}'));   // what the console is, and where its rows are
 *   if (now.stamp !== have) pixels = NSWP.consolePixels();   // the picture, only when it has changed
 *   // a ray at the panel gives a place on it: the row whose rectangle holds that place is lit, as `lit` says
 *   NSWP.console(JSON.stringify({ press: row.id }));         // at a press on it
 *
 * **Pointing never changes the picture.** It is drawn plain. The engine lights the row pointed at itself, with a
 * box over the row's own rectangle whose colours and corners the kit says (`lit`), so that the look stays the
 * kit's and the pixels cross only when what the console shows changes: a press, a tab, a page.
 *
 * **One list says where the rows are.** `rows` is what a ray points at and what a press lands on: an engine keeps
 * no list of its own.
 */
import { CONSOLE_H, CONSOLE_W, createConsoleDrawing, type ConsoleDrawing } from "./console-drawing.js";
import { askHowTheyMove } from "./engine-hands.js";
import { engineParts, onSession, tellEngine } from "./engine-menu.js";
import type { Controls } from "./ui/model.js";

/**
 * Where the console floats and how big, in metres, as the kit's own does in a Three.js world (console.ts): so wide,
 * so far in front of the visitor when it opens, so far below their eyes and never lower than `least`, and put away
 * once they have walked `away` from it.
 */
export const CONSOLE_PLACE = { wide: 0.84, reach: 1.05, drop: 0.18, least: 0.4, away: 2.6 } as const;

let made: { controls: Controls; drawing: ConsoleDrawing; g: CanvasRenderingContext2D; stop: () => void } | null = null;
let open = false;
/** Goes up each time the picture is drawn anew: an engine takes the pixels again only when it differs. */
let stamp = 0;
let asked = false;

const drawingFor = (controls: Controls): NonNullable<typeof made> => {
  if (made?.controls === controls) return made;
  made?.stop();
  const canvas = document.createElement("canvas");
  canvas.width = CONSOLE_W;
  canvas.height = CONSOLE_H;
  // Read back whenever it changes, to be handed over: said so, which makes the reading a third quicker (measured,
  // docs/plans/godot-headset-controls.md).
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  const drawing = createConsoleDrawing(controls, { canvas, context: g, plain: true, shown: () => open });
  // Whatever of the controls changed, the next look draws it.
  const stopView = controls.subscribe(() => drawing.again());
  // Something asks for the controls on one of their sections ("show:<section>": the kit's first-time question,
  // someone's picture pressed): in a headset the console opens there, and the engine is told to show it.
  const stopSignals = controls.onSignal((name) => {
    if (!name.startsWith("show:") || !engineParts()?.presenting) return;
    drawing.section = name.slice(5);
    setOpen(true);
    tellEngine({ type: "console", open: true });
  });
  made = {
    controls,
    drawing,
    g,
    stop: () => {
      stopView();
      stopSignals();
    },
  };
  return made;
};

const setOpen = (next: boolean): void => {
  if (next === open) return;
  open = next;
  const parts = engineParts();
  if (!parts) return;
  parts.controls.signal(open ? "menuOpen" : "menuClose");
  if (open) drawingFor(parts.controls).drawing.again();
};

// As a headset session ends the console is put away, and the next session may ask afresh.
onSession((presenting) => {
  if (presenting) return;
  asked = false;
  setOpen(false);
});

/**
 * What the console is now, after doing what was asked. `input` is JSON, every part optional:
 *
 * - `open`: `true` to bring it up, `false` to put it away (the menu button on a controller does one, then the other).
 * - `press`: the `id` of the row a press landed on. Only an id from `rows`, as last given.
 * - `have`: the `stamp` of the picture the engine already holds. `rows` is left out while it is still that one.
 *
 * It answers with JSON:
 *
 * - `open`.
 * - `stamp`: goes up when the picture changed. Then, and only then, take `NSWP.consolePixels()` again.
 * - `w`, `h`: the picture's size, in its own units, which `rows` is in too.
 * - `wide`, `reach`, `drop`, `least`, `away`: where it floats, in metres, as in every world (`CONSOLE_PLACE`).
 * - `rows`: each thing that can be pressed, `{ id, x, y, w, h, lit }`. `lit` is how it is lit when pointed at
 *   (`{ fill, fillAlpha, stroke, strokeAlpha, line, corners }`, the corners clockwise from the top left), or null
 *   where nothing lights it. A place on the panel that is in no row is the pane: it lights nothing, presses
 *   nothing, and a ray at it reaches nothing behind.
 *
 * An engine that calls this draws the console, so it is here that a visitor is asked, the first time they are in
 * a headset, which way they would like to move: the question is one of the console's sections.
 */
export function engineConsole(input?: string): string {
  const parts = engineParts();
  if (!parts) return JSON.stringify({ open: false, stamp, w: CONSOLE_W, h: CONSOLE_H, ...CONSOLE_PLACE, rows: [] });
  const { drawing } = drawingFor(parts.controls);
  let ask: { open?: unknown; press?: unknown; have?: unknown } = {};
  try {
    const read: unknown = input ? JSON.parse(input) : {};
    if (read && typeof read === "object") ask = read as typeof ask;
  } catch {
    /* nothing asked, then */
  }
  if (typeof ask.open === "boolean") setOpen(ask.open);
  // Only for something on the console as it was last drawn: a press is by id, and nothing else can be pressed.
  if (open && typeof ask.press === "string" && drawing.regions.some((r) => r.id === ask.press)) {
    const hit = ask.press;
    if (hit === "close") setOpen(false);
    else if (hit.startsWith("tab:")) drawing.section = hit.slice(4);
    else if (hit === "lines-more") drawing.turnPage();
    else if (hit.startsWith("act:")) parts.controls.run(hit.slice(4));
  }
  // The first time they are in a headset here: asked once, in the console, which this engine has just shown it draws.
  if (parts.presenting && !asked) {
    asked = true;
    askHowTheyMove();
  }
  if (open && drawing.paint()) stamp++;
  const fresh = open && ask.have !== stamp;
  return JSON.stringify({
    open,
    stamp,
    w: CONSOLE_W,
    h: CONSOLE_H,
    ...CONSOLE_PLACE,
    ...(fresh ? { rows: drawing.regions.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, lit: r.lit ?? null })) } : {}),
  });
}

/**
 * The console's picture as it now is: `w` by `h` pixels, four bytes each (red, green, blue, how solid), from the
 * top row down. Null while the console is put away. Take it only when `stamp` has changed: it is 2.6 MB.
 */
export function consolePixels(): Uint8ClampedArray | null {
  const parts = engineParts();
  if (!parts || !open) return null;
  const { drawing, g } = drawingFor(parts.controls);
  if (drawing.paint()) stamp++;
  return g.getImageData(0, 0, CONSOLE_W, CONSOLE_H).data;
}

/** For tests: forget the console that was made. */
export function resetConsole(): void {
  made?.stop();
  made = null;
  open = false;
  stamp = 0;
  asked = false;
}
