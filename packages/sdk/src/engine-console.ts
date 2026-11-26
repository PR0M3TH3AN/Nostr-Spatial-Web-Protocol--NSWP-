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
import { boxAt, createMenuDrawing, type MenuBox, type MenuDrawing } from "./menu-drawing.js";
import { pressMenu } from "./menu-press.js";
import { sheetAsked } from "./ui/sheet-asked.js";
import { SHEET_LOOK as LOOK } from "./ui/sheet-look.js";

/**
 * The flat menu's own drawing, for an engine, where it is asked for (`?menu=sheet`; docs/plans/headset-menu.md,
 * step 4): one picture, the sheet with the bar 5 cm under it, 1.0 m wide, handed over as today's console is. `rows`
 * are its pressable things, each lit as the flat menu lights what is under the mouse. An engine that shows today's
 * console shows this unchanged: the picture's size, where it floats and its rows all come from here. Two things more,
 * both optional: `scroll`, how far to move the list (in the flat menu's pixels, down positive), for a stick pushed
 * while a hand points at the menu; and `at`, where on the picture a press landed, for a song's bar.
 */
export const SHEET_IN_ENGINES = { scale: 1.6, wide: 1.0, barGap: 39, top: 0.12, most: 520 } as const;

/**
 * Where the console floats and how big, in metres, as the kit's own does in a Three.js world (console.ts): so wide,
 * so far in front of the visitor when it opens, so far below their eyes and never lower than `least`, and put away
 * once they have walked `away` from it.
 */
export const CONSOLE_PLACE = { wide: 0.84, reach: 1.05, drop: 0.18, least: 0.4, away: 2.6 } as const;

let made: { controls: Controls; drawing: ConsoleDrawing; g: CanvasRenderingContext2D; stop: () => void } | null = null;
/** The flat menu's drawing for an engine, and the one picture it is put together into. */
let sheetMade: { controls: Controls; d: MenuDrawing; canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; measure: (text: string, f: string) => number; rows: { id: string; x: number; y: number; w: number; h: number; lit: unknown }[]; stop: () => void } | null = null;
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
    if (sheetMade) sheetMade.d.section = name.slice(5);
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
  if (sheetAsked()) return sheetConsole(parts.controls, parts.presenting, input);
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
  if (sheetAsked()) {
    const m = sheetFor(parts.controls);
    if (composeSheet(m)) stamp++;
    return m.g.getImageData(0, 0, m.canvas.width, m.canvas.height).data;
  }
  const { drawing, g } = drawingFor(parts.controls);
  if (drawing.paint()) stamp++;
  return g.getImageData(0, 0, CONSOLE_W, CONSOLE_H).data;
}

/** The flat menu's drawing for these controls, made once. */
function sheetFor(controls: Controls): NonNullable<typeof sheetMade> {
  if (sheetMade?.controls === controls) return sheetMade;
  sheetMade?.stop();
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  const measureG = document.createElement("canvas").getContext("2d")!;
  const measure = (text: string, f: string) => {
    measureG.font = f;
    return measureG.measureText(text).width;
  };
  const d = createMenuDrawing(controls, { width: LOOK.sheet.wide, scale: SHEET_IN_ENGINES.scale, glass: 0.95, most: SHEET_IN_ENGINES.most, shown: () => open });
  const stopView = controls.subscribe(() => d.again());
  sheetMade = { controls, d, canvas, g, measure, rows: [], stop: stopView };
  return sheetMade;
}

/**
 * Put the sheet and the bar together into the one picture, where either was drawn anew, and say where every pressable
 * thing is on it, with how it is lit. True where the picture changed.
 */
function composeSheet(m: NonNullable<typeof sheetMade>): boolean {
  const { d, canvas, g } = m;
  if (!d.paint() && canvas.width > 1) return false;
  const L = d.sheetLayout;
  const B = d.barLayout;
  if (!L) return false;
  const k = SHEET_IN_ENGINES.scale;
  const view = m.controls.view();
  const withBar = view.presence === "full" && !!B && B.keys.length > 0;
  const gap = SHEET_IN_ENGINES.barGap;
  const W = Math.round(L.width * k);
  const H = Math.round((L.height + (withBar && B ? gap + B.height : 0)) * k);
  canvas.width = W;
  canvas.height = H;
  g.clearRect(0, 0, W, H);
  g.drawImage(d.sheet, 0, 0);
  const barX = withBar && B ? (L.width - B.width) / 2 : 0;
  const barY = L.height + gap;
  if (withBar) g.drawImage(d.bar, Math.round(barX * k), Math.round(barY * k));
  // How a thing is lit when pointed at: as the flat menu lights what is under the mouse, in the accent.
  const lit = (corners: readonly number[]) => ({ fill: view.theme.accent, fillAlpha: LOOK.row.hoverFill, stroke: view.theme.accent, strokeAlpha: LOOK.row.hoverEdge, line: 1.5 * k, corners: corners.map((c) => c * k) });
  const at = (b: Pick<MenuBox, "x" | "y" | "w" | "h">, dx = 0, dy = 0) => ({ x: (b.x + dx) * k, y: (b.y + dy) * k, w: b.w * k, h: b.h * k });
  const rows: typeof m.rows = [];
  for (const t of L.tabs) {
    const b = boxAt(L, t.id, d.rowsScroll);
    if (b) rows.push({ id: t.id, ...at(b), lit: lit([LOOK.tabs.tab.corners, LOOK.tabs.tab.corners, 0, 0]) });
  }
  for (const side of ["tabs-left", "tabs-right"]) {
    const b = boxAt(L, side, d.rowsScroll);
    if (b) rows.push({ id: side, ...at(b), lit: null });
  }
  const T = LOOK.tile.corners;
  for (const r of L.rows) {
    if (!r.item || r.kind === "line") continue;
    const b = boxAt(L, r.id, d.rowsScroll);
    if (!b) continue;
    const corners = r.kind === "tile" ? [T[0], T[0], T[1], T[1]] : r.kind === "swatch" ? [LOOK.swatch.corners[0], LOOK.swatch.corners[0], LOOK.swatch.corners[1], LOOK.swatch.corners[1]] : [LOOK.row.corners, LOOK.row.corners, LOOK.row.corners, LOOK.row.corners];
    rows.push({ id: r.id, ...at(r.kind === "file" ? { ...b, h: LOOK.row.height } : b), lit: lit(corners) });
  }
  if (L.pin) rows.push({ id: "pin", ...at(L.pin), lit: lit([LOOK.foot.pin.corners, LOOK.foot.pin.corners, LOOK.foot.pin.corners, LOOK.foot.pin.corners]) });
  rows.push({ id: "close", ...at(L.close), lit: lit([LOOK.foot.close.corners, LOOK.foot.close.corners, LOOK.foot.close.corners, LOOK.foot.close.corners]) });
  if (withBar && B) {
    const K = LOOK.key;
    // A key is lit by its arch, as on a flat screen.
    for (const key of B.keys) rows.push({ id: `bar:${key.id}`, ...at({ x: key.x + (K.width - K.arch[0]) / 2, y: key.y, w: K.arch[0], h: K.arch[1] }, barX, barY), lit: lit([K.corners[0], K.corners[0], K.corners[1], K.corners[1]]) });
  }
  m.rows = rows;
  return true;
}

/** `engineConsole`, with the flat menu's own drawing (`?menu=sheet`). */
function sheetConsole(controls: Controls, presenting: boolean, input?: string): string {
  const m = sheetFor(controls);
  const { d } = m;
  let ask: { open?: unknown; press?: unknown; have?: unknown; scroll?: unknown; at?: unknown } = {};
  try {
    const read: unknown = input ? JSON.parse(input) : {};
    if (read && typeof read === "object") ask = read as typeof ask;
  } catch {
    /* nothing asked, then */
  }
  const k = SHEET_IN_ENGINES.scale;
  if (typeof ask.open === "boolean") setOpen(ask.open);
  if (open && typeof ask.scroll === "number" && Number.isFinite(ask.scroll) && d.sheetLayout?.rowsAt) {
    const L = d.sheetLayout;
    d.rowsScroll = Math.max(0, Math.min(L.rowsContent - (L.rowsAt?.h ?? 0), d.rowsScroll + Math.max(-400, Math.min(400, ask.scroll))));
  }
  // Only for something on the menu as it was last handed over: a press is by id, and nothing else can be pressed.
  if (open && typeof ask.press === "string" && m.rows.some((r) => r.id === ask.press)) {
    const where = Array.isArray(ask.at) && ask.at.length === 2 && ask.at.every((n) => typeof n === "number") ? { x: (ask.at[0] as number) / k, y: (ask.at[1] as number) / k } : undefined;
    const said = pressMenu(controls, d, ask.press, { ...(where ? { at: where } : {}), measure: m.measure, section: () => d.section, setSection: (id) => { d.section = id; d.rowsScroll = 0; } });
    if (said === "close") setOpen(false);
  }
  if (presenting && !asked) {
    asked = true;
    askHowTheyMove();
  }
  if (open && composeSheet(m)) stamp++;
  const fresh = open && ask.have !== stamp;
  const tall = m.canvas.height / k;
  // Where it floats: 1.0 m wide, its top a little above the eyes, as the kit's own (console-sheet.ts) is.
  const wide = SHEET_IN_ENGINES.wide;
  const place = { ...CONSOLE_PLACE, wide, drop: (tall * wide) / LOOK.sheet.wide / 2 - SHEET_IN_ENGINES.top };
  // `scrolls`: a stick pushed while a hand points at it scrolls it (`scroll`, above), and doesn't walk or turn them.
  return JSON.stringify({ open, stamp, w: m.canvas.width, h: m.canvas.height, ...place, scrolls: true, ...(fresh ? { rows: m.rows } : {}) });
}

/** For tests: forget the console that was made. */
export function resetConsole(): void {
  sheetMade?.stop();
  sheetMade = null;
  made?.stop();
  made = null;
  open = false;
  stamp = 0;
  asked = false;
}
