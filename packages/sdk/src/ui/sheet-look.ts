/**
 * The menu's look in numbers: its sheet, its rows and its bar, read by both of the menu's drawings. The flat menu's
 * styles are written from these (ui/hud.ts), and the headset draws the same menu on a canvas from them
 * (menu-drawing.ts). A measure changed here is changed in both, so the two can't drift apart as the headset's console
 * once did from the flat menu (docs/plans/headset-menu.md, "How the two are kept the same").
 *
 * Lengths are CSS pixels at the visitor's own text size of 1. Sizes of words are in the menu's ems (`text.size`).
 * Alphas are of the theme's colours: accent, ink, glass, warn. `trials/headset-menu-same.mjs` holds the two drawings
 * to each other, tab by tab, within 2 px.
 */
export const SHEET_LOOK = {
  /** The menu's words: 13 px, 1.35 lines apart. An icon is 1.55 times the words, drawn with lines 1.6 wide (of 24). */
  text: { size: 13, line: 1.35, icon: 1.55, iconLine: 1.6, family: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif', mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace' },
  /** Glass: its fill and its edge. */
  glass: { fill: 0.7, edge: 0.34 },
  /**
   * The sheet. At a desk (`desk`, at least that wide and high) it is `wide` across, in two columns; else `narrow`,
   * in one. It is at most `tall` high, or that share of the screen. Its top edge is lit by a line, glowing.
   */
  sheet: { wide: 780, narrow: 480, desk: { width: 900, height: 560 }, side: 20, deskSide: 40, tall: { desk: 780, deskShare: 74, narrow: 640, narrowShare: 70 }, corners: [22, 22, 12, 12], top: { line: 2, glow: 16 } },
  /** The strip of tabs: its room, and each tab. A tab brought into sight is kept `clear` of the arrows at the ends. */
  tabs: { pad: [12, 12, 0], gap: 4, clear: 46, more: { width: 40, inset: 9, fade: 45 }, tab: { pad: [9, 13, 8], gap: 7, corners: 14, under: 2, ink: 0.72, on: 0.1 } },
  /** The list of rows under the strip: its gap, its room, and the line over it. */
  rows: { gap: 6, pad: 12, line: 0.22 },
  /** A row to press. */
  row: { height: 46, pad: [8, 12], corners: 10, gap: 12, edge: 0.12, fill: 0.03, hoverFill: 0.13, hoverEdge: 0.7, onEdge: 0.8, primaryFill: 0.16, primaryEdge: 0.75, state: 0.86, stateInk: 0.6 },
  /** A line to read. */
  line: { pad: [4, 12], gap: 12, dim: 0.55, iconDim: 0.55, iconAt: 1 },
  /** A row typed into: a box and its button, and a line under them. */
  field: { pad: [8, 12], gap: [6, 8], box: 40, boxPad: [6, 10], boxCorners: 8, boxEdge: 0.25, boxGlass: 0.6, buttonPad: [6, 14], to: 0.86, toInk: 0.6 },
  /** A song's bar: its words, the bar, and where it is. */
  slide: { pad: [8, 12], gap: [4, 12], bar: 28, time: 0.86, timeInk: 0.7, onEdge: 0.5 },
  /** A row that takes a file, and the line under it. */
  takes: { gap: 4, to: 0.86, toInk: 0.6 },
  /** Choices of colour: small doorways in a row. */
  swatches: { gap: [6, 4], pad: [4, 2, 8] },
  swatch: { width: 66, gap: 6, text: 0.86, ink: 0.8, arch: [38, 44], corners: [19, 5], sill: [46, 2], sillAt: -3, sillInk: 0.25 },
  /** Things with pictures, side by side: each at least `min` wide at a desk, `narrowMin` on a phone. */
  tiles: { min: 112, narrowMin: 104, gap: 8, pad: [2, 0, 4] },
  tile: { pad: [8, 6, 9], gap: 4, corners: [14, 8], text: 0.9, line: 1.2, ink: 0.85, glow: 0.13, letter: 1.9, mark: { size: 24, inset: 6, corners: 8, icon: 15, glass: 0.85, edge: 0.55 } },
  /** A card at the head of a tab: who, or what, it is about. */
  card: { pad: 12, corners: [16, 8], face: 56, gap: [3, 12], edge: 0.45, fill: 0.07, title: 1.15, tag: 0.76, keyline: 0.9, quote: 7, thing: 200 },
  /** A world's own part of a tab, under its name. */
  from: { top: 6, padX: 12, text: 0.82, ink: 0.55 },
  /** A tab's note. */
  note: { pad: [4, 12, 0, 12], inset: 12, text: 0.95, edge: 0.6, ink: 0.78 },
  /** The strip a said line has in the sheet, above its foot: one line high and `pad` more, then `after`. */
  says: { pad: 18, after: 8 },
  /** The foot: keep this tab on the bar, and Close. */
  foot: { pad: [0, 12, 12], gap: 10, pin: { pad: [7, 12], corners: 10, text: 0.93, icon: 16, gap: 7, edge: 0.22, ink: 0.82 }, close: { height: 38, padX: 14, corners: 10, edge: 0.22 } },
  /** The bar of things at hand: its keys, each a small doorway on a sill. */
  bar: { corners: [20, 10], pad: [12, 14, 8], gap: 10, more: 30, theirs: 0.2 },
  key: { width: 62, gap: 7, arch: [52, 54], corners: [26, 7], sill: [60, 2], sillAt: -4, name: 0.84, line: 1.2, ink: 0.82, fill: 0.08, edge: 0.42, sillInk: 0.28, hoverFill: 0.2, onFill: 0.26 },
} as const;

/** An alpha as the styles write it: ".7", not "0.7". */
export const alpha = (a: number): string => String(a).replace(/^0\./, ".");

/** Lengths as the styles write them, nought as "0": `[4, 12, 0]` is "4px 12px 0". */
export const lengths = (p: readonly number[]): string => p.map((n) => (n ? `${n}px` : "0")).join(" ");
