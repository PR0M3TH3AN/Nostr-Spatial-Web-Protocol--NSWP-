/**
 * The menu drawn on a canvas, the same as the flat menu: for a headset, where a page's own elements can't be seen
 * (docs/plans/headset-menu.md). It lays out what the controls hold (`controls.view()`) by the flat menu's own rules,
 * with the flat menu's own measures (`SHEET_LOOK`, ui/sheet-look.ts), and draws it: the sheet (its tabs, its rows in
 * two columns, a card, notes, the strip for a said line, the foot) and the bar of things at hand.
 *
 * Laying out and drawing are apart. `laySheet` and `layBar` say where everything is, from the view and a way to
 * measure words, and nothing else: the gate's test holds them to known numbers without a browser
 * (test/menu-drawing.test.ts), and `trials/headset-menu-same.mjs` holds them to the flat menu as a browser lays it
 * out, tab by tab, within 2 px. `drawSheet` and `drawBar` paint a layout.
 *
 * Lengths are the flat menu's CSS pixels. A caller draws them at any scale (`scale`): a headset's sheet is 1.0 m
 * for the flat menu's 780.
 */
import { ICONS, type IconName } from "./ui/icons.js";
import type { Controls, UiCard, UiItemView, UiSectionView, UiView } from "./ui/model.js";
import { SHEET_LOOK as LOOK } from "./ui/sheet-look.js";
import { rgb } from "./ui/theme.js";

/** How wide words are, in CSS pixels, in a CSS font (`"500 13px …"`). A browser's canvas measures; a test counts. */
export type Measure = (text: string, font: string) => number;

/** A thing on the menu, where it is, in the flat menu's CSS pixels from the sheet's (or the bar's) own top left. */
export interface MenuBox {
  /** What pressing it does: "tab:<id>", "act:<item id>", "pin", "close", "tabs-left", "tabs-right"; or what it is. */
  id: string;
  /** What it is: "tab", "row", "line", "field", "slider", "file", "swatch", "tile", "card", "from", "note", "said", "pin", "close", "key", "more". */
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Its words, as drawn: wrapped into lines where it wraps. */
  lines?: string[];
  item?: UiItemView;
  card?: UiCard;
}

/** The sheet, laid out for one tab. */
export interface SheetLayout {
  width: number;
  /** One size on every tab: what the tallest of them needs, as the flat menu's is (`sizeSheet`, ui/hud.ts). */
  height: number;
  section: UiSectionView | null;
  tabs: MenuBox[];
  /** How far the strip of tabs is slid along, and whether there is more to either side. */
  tabsScroll: number;
  more: { left: boolean; right: boolean };
  /** Where the list of rows is, and how tall what is in it is (it scrolls inside its room where that is taller). */
  rowsAt: { y: number; h: number } | null;
  rowsContent: number;
  /** The rows, cards, tiles and the rest, where they are with the list scrolled to its top. */
  rows: MenuBox[];
  note: MenuBox | null;
  said: MenuBox | null;
  /** The strip a said line has, above the foot. */
  says: MenuBox;
  pin: MenuBox | null;
  close: MenuBox;
}

const S = LOOK.text.size;
const LH = LOOK.text.line;
const font = (scale: number, size = 1, weight = 500, mono = false): string => `${weight} ${size * S * scale}px ${mono ? LOOK.text.mono : LOOK.text.family}`;

/** Words wrapped into lines no wider than `width`, at spaces, as a browser does where nothing says otherwise. */
export function wrapWords(measure: Measure, text: string, f: string, width: number): string[] {
  const out: string[] = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (!line || measure(next, f) <= width + 0.01) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

const unreachable = (kind: never): never => {
  throw new Error(`the headset's menu doesn't draw a row of kind ${String(kind)}`);
};

/**
 * How each kind of row is laid out: across the whole width, or in a column (`half`), or one of a run laid side by
 * side. A kind added to ui/model.ts fails the type check here until it is drawn (and in ui/hud.ts, `kindLaid`).
 */
export function kindLaid(item: UiItemView): "half" | "full" | "run" {
  switch (item.kind) {
    case "button":
    case "copy":
    case "save":
      return item.tone === "primary" ? "full" : "half";
    case "swatch":
    case "tile":
      return "run";
    case "line":
    case "field":
    case "file":
    case "slider":
      return "full";
    default:
      return unreachable(item.kind);
  }
}

export interface LayOptions {
  measure: Measure;
  /** The sheet's width: `SHEET_LOOK.sheet.wide` (two columns, a desk's) or `.narrow` (one column, a phone's). */
  width?: number;
  /** The most the sheet may be tall, in CSS pixels. */
  most?: number;
  /** The world's name, for the line under a row that sends something to it. */
  title?: string;
  /** How far the strip of tabs was slid along before (from its start, 0, where left out). */
  tabsScroll?: number;
  /**
   * Bring the open tab into sight, as the flat menu does when a tab is chosen or the menu comes up: from where the
   * strip was, slid only as far as it takes, clear of the arrows. Left out, so; false keeps it where it was.
   */
  bring?: boolean;
  /**
   * Whether the bar is shown, and with it the foot's "Keep this tab on your bar": as at a desk, only where the
   * world's presence is "full" (a quiet world, a game, keeps the bar away). Left out, so.
   */
  bar?: boolean;
}

/** A row's words and what is beside them: its icon, its On or Off, its key. */
function rowParts(measure: Measure, scale: number, item: UiItemView, w: number) {
  const P = LOOK.row;
  const icon = item.icon ? LOOK.text.icon * S * scale : 0;
  const state = item.on === null ? 0 : measure(item.on ? "On" : "Off", font(scale, P.state));
  const key = item.key ? Math.max(1.6 * 0.82 * S * scale, measure(item.key, font(scale, 0.82, 400, true)) + 10) : 0;
  const room = w - 2 - 2 * P.pad[1] - (icon ? icon + P.gap : 0) - (state ? state + P.gap : 0) - (key ? key + P.gap : 0);
  const lines = wrapWords(measure, item.label, font(scale), room);
  const h = Math.max(P.height, 2 + 2 * P.pad[0] + Math.max(icon, lines.length * S * scale * LH));
  return { lines, h, icon, state, key };
}

/** One tab's rows, cards and the rest, by the flat menu's grid, from the list's top; and how tall they are. */
function layRows(o: LayOptions, s: UiSectionView, scale: number, inner: number): { boxes: MenuBox[]; height: number } {
  const m = o.measure;
  const two = (o.width ?? LOOK.sheet.wide) >= LOOK.sheet.wide;
  const gap = LOOK.rows.gap;
  const colW = two ? (inner - gap) / 2 : inner;
  const boxes: MenuBox[] = [];
  // The grid's rows: each is as tall as the tallest thing in it. A full-width thing starts a row of its own.
  let y = 0;
  let open: MenuBox[] = [];
  const close = () => {
    if (!open.length) return;
    // Things side by side are as tall as the taller, as a grid stretches them.
    const h = Math.max(...open.map((b) => b.h));
    for (const b of open) b.h = h;
    y += h + gap;
    open = [];
  };
  const full = (b: Omit<MenuBox, "x" | "y" | "w"> & { w?: number }) => {
    close();
    const box = { ...b, x: 0, y, w: inner } as MenuBox;
    boxes.push(box);
    open = [box];
    close();
    return box;
  };
  const half = (b: Omit<MenuBox, "x" | "y" | "w">) => {
    if (!two) return full(b);
    const box = { ...b, x: open.length ? colW + gap : 0, y, w: colW } as MenuBox;
    boxes.push(box);
    open.push(box);
    if (open.length === 2) close();
    return box;
  };
  if (s.card) full(layCard(m, scale, s.card, inner, two));
  let whose = "";
  let run: { kind: string; items: UiItemView[] } | null = null;
  const flushRun = () => {
    if (!run) return;
    const r = run;
    run = null;
    if (r.kind === "swatch") {
      const W = LOOK.swatch;
      const pad = LOOK.swatches.pad;
      const per = Math.max(1, Math.floor((inner - pad[1] * 2 + LOOK.swatches.gap[1]) / (W.width + LOOK.swatches.gap[1])));
      const each = W.arch[1] + W.gap + Math.max(0, W.sill[1] + W.sillAt) + W.gap + W.text * S * scale * LH;
      const rows = Math.ceil(r.items.length / per);
      const box = full({ id: `swatches:${r.items[0]!.id}`, kind: "swatches", h: pad[0] + rows * each + (rows - 1) * LOOK.swatches.gap[0] + pad[2] });
      r.items.forEach((item, i) => boxes.push({ id: `act:${item.id}`, kind: "swatch", item, x: box.x + pad[1] + (i % per) * (W.width + LOOK.swatches.gap[1]), y: box.y + pad[0] + Math.floor(i / per) * (each + LOOK.swatches.gap[0]), w: W.width, h: each, lines: [item.label] }));
    } else {
      const T = LOOK.tile;
      const min = two ? LOOK.tiles.min : LOOK.tiles.narrowMin;
      const per = Math.max(1, Math.floor((inner + LOOK.tiles.gap) / (min + LOOK.tiles.gap)));
      const tw = (inner - (per - 1) * LOOK.tiles.gap) / per;
      const words = (item: UiItemView) => wrapWords(m, item.label, font(scale, T.text), tw - 2 - 2 * T.pad[1]);
      const pic = tw - 2 - 2 * T.pad[1];
      const heights = r.items.map((item) => 2 + T.pad[0] + T.pad[2] + pic + T.gap + words(item).length * T.text * S * scale * T.line);
      const rows = Math.ceil(r.items.length / per);
      const rowH = Array.from({ length: rows }, (_, k) => Math.max(...heights.slice(k * per, k * per + per)));
      const box = full({ id: `tiles:${r.items[0]!.id}`, kind: "tiles", h: LOOK.tiles.pad[0] + rowH.reduce((a, b) => a + b, 0) + (rows - 1) * LOOK.tiles.gap + LOOK.tiles.pad[2] });
      let ty = box.y + LOOK.tiles.pad[0];
      for (let k = 0; k < rows; k++) {
        r.items.slice(k * per, k * per + per).forEach((item, i) => boxes.push({ id: `act:${item.id}`, kind: "tile", item, x: i * (tw + LOOK.tiles.gap), y: ty, w: tw, h: rowH[k]!, lines: words(item) }));
        ty += rowH[k]! + LOOK.tiles.gap;
      }
    }
  };
  for (const item of s.items) {
    if ((item.from ?? "") !== whose) {
      flushRun();
      whose = item.from ?? "";
      if (whose) full({ id: `from:${whose}`, kind: "from", h: LOOK.from.top + LOOK.from.text * S * scale * LH, lines: [whose.toUpperCase()] });
    }
    const laid = kindLaid(item);
    if (laid === "run") {
      if (run && run.kind !== item.kind) flushRun();
      run ??= { kind: item.kind, items: [] };
      run.items.push(item);
      continue;
    }
    flushRun();
    if (item.kind === "line") {
      const lines = wrapWords(m, item.label, font(scale), inner - 2 * LOOK.line.pad[1] - LOOK.text.icon * S * scale - LOOK.line.gap);
      full({ id: `line:${item.id}`, kind: "line", item, lines, h: 2 * LOOK.line.pad[0] + Math.max(lines.length * S * scale * LH, LOOK.line.iconAt + LOOK.text.icon * S * scale) });
    } else if (item.kind === "field") {
      const F = LOOK.field;
      const to = o.title ? [`What you type here goes to ${o.title}.`] : [];
      full({ id: `act:${item.id}`, kind: "field", item, lines: to, h: 2 + 2 * F.pad[0] + F.box + (to.length ? F.gap[0] + F.to * S * scale * LH : 0) });
    } else if (item.kind === "slider") {
      const D = LOOK.slide;
      full({ id: `act:${item.id}`, kind: "slider", item, h: 2 + 2 * D.pad[0] + Math.max(LOOK.text.icon * S * scale, S * scale * LH) + D.gap[0] + D.bar });
    } else if (item.kind === "file") {
      const parts = rowParts(m, scale, item, inner);
      const to = o.title ? [`The file you choose goes to ${o.title}.`] : [];
      full({ id: `act:${item.id}`, kind: "file", item, lines: parts.lines, h: parts.h + (to.length ? LOOK.takes.gap + LOOK.takes.to * S * scale * LH : 0) });
    } else {
      const parts = rowParts(m, scale, item, laid === "full" ? inner : colW);
      (laid === "full" ? full : half)({ id: `act:${item.id}`, kind: "row", item, lines: parts.lines, h: parts.h });
    }
  }
  flushRun();
  close();
  return { boxes, height: Math.max(0, y - gap) };
}

/**
 * A card at the head of a tab: a person's (a face, a name, how they are known, their words) or a thing's (its
 * picture large, its words beside it). By the flat menu's grid: a gap between each of its rows, its words in a quote.
 */
function layCard(m: Measure, scale: number, card: UiCard, inner: number, two: boolean): Omit<MenuBox, "x" | "y" | "w"> {
  const C = LOOK.card;
  const line = S * scale * LH;
  const head = C.title * S * scale * LH;
  const keyline = Math.max(C.keyline * S * scale * LH, card.copy ? 2 + 4 + C.keyline * S * scale * LH : 0);
  const content = inner - 2 - 2 * C.pad;
  if (card.draw) {
    // A thing: its picture in a column of its own (200 at a desk, 30% and at least 112 on a phone), its words beside.
    const face = two ? C.thing : Math.max(112, content * 0.3);
    const words = content - face - 14;
    const text = card.text ? wrapWords(m, card.text, font(scale), words - 12) : [];
    const about = head + 5 + keyline + (text.length ? 5 + 3 + 2 + text.length * line : 0) + (card.now.length ? 5 + 5 + 0.9 * S * scale * LH : 0);
    // Under it a row for what to do with the thing, empty here, with the grid's gap of 10 above it.
    const h = two ? Math.max(face, about + 10) : Math.max(face, about) + 10;
    return { id: "card", kind: "card", card, h: 2 + 2 * C.pad + h, lines: text };
  }
  const text = card.text ? wrapWords(m, card.text, font(scale), content - 12) : [];
  const top = Math.max(C.face, head + C.gap[0] + keyline);
  const quote = text.length ? C.gap[0] + C.quote + 2 + text.length * line : 0;
  const now = card.now.length ? C.gap[0] + 5 + 0.9 * S * scale * LH : 0;
  return { id: "card", kind: "card", card, h: 2 + 2 * C.pad + top + quote + now, lines: text };
}

/** The sheet laid out for the tab `section` (its id), with every tab measured for the sheet's one size. */
export function laySheet(view: UiView, sectionId: string, o: LayOptions): SheetLayout {
  const scale = view.theme.scale || 1;
  const m = o.measure;
  const width = o.width ?? LOOK.sheet.wide;
  const section = view.sections.find((x) => x.id === sectionId) ?? view.sections[0] ?? null;
  const inner = width - 2 - 2 * LOOK.rows.pad;
  // The strip of tabs.
  const T = LOOK.tabs.tab;
  const icon = LOOK.text.icon * S * scale;
  const tabH = T.pad[0] + Math.max(icon, S * scale * LH) + T.pad[2] + T.under;
  const tabs: MenuBox[] = [];
  let tx = 1 + LOOK.tabs.pad[1];
  for (const t of view.sections) {
    const w = T.pad[1] + (t.icon ? icon + T.gap : 0) + m(t.label, font(scale)) + T.pad[1];
    tabs.push({ id: `tab:${t.id}`, kind: "tab", x: tx, y: 1 + LOOK.tabs.pad[0], w, h: tabH, lines: [t.label] });
    tx += w + LOOK.tabs.gap;
  }
  const stripEnd = tx - LOOK.tabs.gap + LOOK.tabs.pad[1];
  const over = stripEnd > width - 2;
  const chosen = tabs.find((t) => t.id === `tab:${section?.id}`);
  let tabsScroll = 0;
  if (over) {
    const most = stripEnd - (width - 2);
    tabsScroll = o.tabsScroll ?? 0;
    if ((o.bring ?? true) && chosen) {
      // The flat menu's rule (ui/hud.ts): past the tab's left, back to it; short of its right, on to it; else still.
      const clear = LOOK.tabs.clear;
      const left = chosen.x - 1 - clear;
      const right = chosen.x - 1 + chosen.w + clear - (width - 2);
      if (tabsScroll > left) tabsScroll = Math.max(0, left);
      else if (tabsScroll < right) tabsScroll = right;
    }
    tabsScroll = Math.max(0, Math.min(most, tabsScroll));
  }
  const more = { left: over && tabsScroll > 0.5, right: over && tabsScroll < stripEnd - (width - 2) - 0.5 };
  // Each tab's rows, note and said line: the sheet is as tall as the tallest needs.
  const stripBottom = 1 + LOOK.tabs.pad[0] + tabH;
  // A note stands in from the left only, by its edge and room: its words are as wide as what is left.
  const noteW = width - 2 - LOOK.note.inset;
  const noteText = noteW - 2 - LOOK.note.pad[1] - LOOK.note.pad[3];
  const noteLines = (s: UiSectionView) => (s.note ? wrapWords(m, s.note, font(scale, LOOK.note.text), noteText) : []);
  const noteH = (lines: string[]) => (lines.length ? LOOK.note.pad[0] + lines.length * LOOK.note.text * S * scale * LH : 0);
  const saidLines = (s: UiSectionView) => (s.said ? wrapWords(m, `${s.said.from} ${s.said.note}`, font(scale, LOOK.note.text), noteText) : []);
  // The list is always there, an empty tab's too: the flat menu's `hidden` on it is outweighed by its own display.
  const needs = (s: UiSectionView) => {
    const r = layRows(o, s, scale, inner);
    return { r, h: 1 + 2 * LOOK.rows.pad + r.height + noteH(noteLines(s)) + noteH(saidLines(s)) };
  };
  const saysH = S * scale * LH + LOOK.says.pad;
  const footH = Math.max(LOOK.foot.close.height, 2 + 2 * LOOK.foot.pin.pad[0] + Math.max(LOOK.foot.pin.icon, LOOK.foot.pin.text * S * scale * LH)) + LOOK.foot.pad[2];
  const around = stripBottom + saysH + LOOK.says.after + footH + 1;
  const tallest = Math.max(0, ...view.sections.map((s) => needs(s).h));
  const height = Math.min(o.most ?? LOOK.sheet.tall.desk, Math.ceil(around + tallest));
  // This tab, in that height.
  const here = section ? needs(section) : { r: { boxes: [], height: 0 }, h: 0 };
  const nLines = section ? noteLines(section) : [];
  const sLines = section ? saidLines(section) : [];
  const footTop = height - 1 - footH;
  const saysTop = footTop - LOOK.says.after - saysH;
  const room = saysTop - stripBottom - noteH(nLines) - noteH(sLines);
  const rowsH = Math.max(0, Math.min(1 + 2 * LOOK.rows.pad + here.r.height, room));
  const rowsAt = { y: stripBottom, h: rowsH };
  const rows = here.r.boxes.map((b) => ({ ...b, x: b.x + 1 + LOOK.rows.pad, y: b.y + stripBottom + 1 + LOOK.rows.pad }));
  let y = stripBottom + rowsH;
  const noteX = 1 + LOOK.note.inset;
  const note = nLines.length ? { id: "note", kind: "note", x: noteX, y, w: noteW, h: noteH(nLines), lines: nLines } : null;
  if (note) y += note.h;
  const said = sLines.length ? { id: "said", kind: "said", x: noteX, y, w: noteW, h: noteH(sLines), lines: sLines } : null;
  // The foot.
  const F = LOOK.foot;
  const pinWords = section?.pinned ? "On your bar. Take it off" : view.pinsFull ? "Your bar is full" : "Keep this tab on your bar";
  const pinH = 2 + 2 * F.pin.pad[0] + Math.max(F.pin.icon, F.pin.text * S * scale * LH);
  const pinW = 2 + 2 * F.pin.pad[1] + F.pin.icon + F.pin.gap + m(pinWords, font(scale, F.pin.text));
  const closeW = 2 + 2 * F.close.padX + m("Close", font(scale));
  const footRow = footH - F.pad[2];
  const pin = section && (o.bar ?? view.presence === "full") ? { id: "pin", kind: "pin", x: 1 + F.pad[1], y: footTop + (footRow - pinH) / 2, w: pinW, h: pinH, lines: [pinWords] } : null;
  const close = { id: "close", kind: "close", x: width - 1 - F.pad[1] - closeW, y: footTop + (footRow - F.close.height) / 2, w: closeW, h: F.close.height, lines: ["Close"] };
  return {
    width,
    height,
    section,
    tabs,
    tabsScroll,
    more,
    rowsAt,
    rowsContent: 1 + 2 * LOOK.rows.pad + here.r.height,
    rows,
    note,
    said,
    says: { id: "says", kind: "says", x: 1 + LOOK.rows.pad, y: saysTop, w: width - 2 - 2 * LOOK.rows.pad, h: saysH },
    pin,
    close,
  };
}

/** The bar laid out: the place's own keys, then the tabs kept on it, as at a desk. */
export function layBar(view: UiView, o: { measure: Measure }): { width: number; height: number; keys: MenuBox[]; theirs: number | null } {
  const scale = view.theme.scale || 1;
  const B = LOOK.bar;
  const K = LOOK.key;
  const keys: MenuBox[] = [];
  let x = B.pad[1];
  const name = font(scale, K.name);
  const lines = (words: string) => wrapWords(o.measure, words, name, K.width);
  const all = [...view.hotbar.map((h) => ({ id: `act:${h.id}`, words: h.short || h.label, item: h as UiItemView | undefined })), ...view.pins.map((p) => ({ id: `tab:${p.id}`, words: p.label, item: undefined }))];
  let theirs: number | null = null;
  all.forEach((k, i) => {
    if (i === view.hotbar.length && view.hotbar.length && view.pins.length) {
      theirs = x + 2;
      x += 1 + 4 + B.gap;
    }
    const l = lines(k.words);
    keys.push({ id: k.id, kind: "key", x, y: B.pad[0], w: K.width, h: K.arch[1] + K.gap + Math.max(0, K.sill[1] + K.sillAt) + K.gap + l.length * K.name * S * scale * K.line, lines: l, ...(k.item ? { item: k.item } : {}) });
    x += K.width + B.gap;
  });
  const width = x - B.gap + B.pad[1];
  const height = B.pad[0] + Math.max(0, ...keys.map((k) => k.h)) + B.pad[2];
  return { width: Math.max(width, 2 * B.pad[1]), height, keys, theirs };
}

// ------------------------------------------------------------------------------------------------ drawing

/** How the menu is drawn: its scale, its glass, what is pointed at, and what has come forward off it. */
export interface DrawOptions {
  /** Canvas pixels to each of the flat menu's CSS pixels. */
  scale: number;
  /** The glass's fill: darker than a desk's, since nothing is blurred behind it in a headset. */
  glass?: number;
  /** What is pointed at: lit, as the flat menu lights what is under the mouse. */
  hot?: string | null;
  /** What has come forward off the sheet: its place is left an empty slot, so its words aren't seen twice. */
  hollow?: string | null;
  /** How far the list of rows is scrolled. */
  rowsScroll?: number;
  /** Pictures for tiles and a thing's card, by item id or "card". */
  picture?: (id: string) => CanvasImageSource | null;
}

type G = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function iconAt(g: G, name: IconName | null, x: number, y: number, size: number, color: string): void {
  if (!name || !ICONS[name]) return;
  g.save();
  g.translate(x, y);
  g.scale(size / 24, size / 24);
  g.lineWidth = LOOK.text.iconLine;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = color;
  g.stroke(new Path2D(ICONS[name]));
  g.restore();
}

const corners = (r: number | readonly number[]): number[] => (typeof r === "number" ? [r, r, r, r] : [...r]);

/** Paint a laid-out sheet onto `g`, at `o.scale`. The canvas is the layout's size times the scale. */
export function drawSheet(g: G, view: UiView, L: SheetLayout, o: DrawOptions): void {
  const k = o.scale;
  const scale = view.theme.scale || 1;
  const A = rgb(view.theme.accent);
  const I = rgb(view.theme.ink);
  const Gl = rgb(view.theme.glass);
  const Wn = rgb(view.theme.warn);
  const acc = (a: number) => `rgba(${A}, ${a})`;
  const ink = (a: number) => `rgba(${I}, ${a})`;
  const glass = (a: number) => `rgba(${Gl}, ${a})`;
  const box = (x: number, y: number, w: number, h: number, r: number | readonly number[]) => {
    g.beginPath();
    g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, corners(r));
  };
  g.setTransform(k, 0, 0, k, 0, 0);
  g.clearRect(0, 0, L.width, L.height);
  g.textAlign = "left";
  // The glass, its edge, and its lit top.
  box(0, 0, L.width, L.height, LOOK.sheet.corners);
  g.fillStyle = glass(o.glass ?? 0.95);
  g.fill();
  g.lineWidth = 1;
  g.strokeStyle = acc(LOOK.glass.edge);
  g.stroke();
  const top = g.createLinearGradient(0, 0, L.width, 0);
  top.addColorStop(0, acc(0));
  top.addColorStop(0.5, acc(1));
  top.addColorStop(1, acc(0));
  g.save();
  g.shadowColor = acc(1);
  g.shadowBlur = LOOK.sheet.top.glow * k;
  g.fillStyle = top;
  g.fillRect(LOOK.sheet.corners[0], 0, L.width - 2 * LOOK.sheet.corners[0], LOOK.sheet.top.line);
  g.restore();
  const textAt = (words: string, x: number, y: number, f: string, color: string, middle = true) => {
    g.font = f;
    g.fillStyle = color;
    g.textBaseline = middle ? "middle" : "top";
    g.fillText(words, x, y);
  };
  const icon = LOOK.text.icon * S * scale;
  // The strip of tabs, slid along, under its own edge.
  const stripBottom = L.tabs[0] ? L.tabs[0].y + L.tabs[0].h : 1 + LOOK.tabs.pad[0];
  g.save();
  g.beginPath();
  g.rect(1, 1, L.width - 2, stripBottom - 1);
  g.clip();
  for (const t of L.tabs) {
    if (o.hollow === t.id) continue;
    const x = t.x - L.tabsScroll;
    const on = t.id === `tab:${L.section?.id}`;
    const hot = o.hot === t.id;
    const T = LOOK.tabs.tab;
    if (on || hot) {
      box(x, t.y, t.w, t.h, [T.corners, T.corners, 0, 0]);
      g.fillStyle = acc(on ? T.on : T.on * 0.7);
      g.fill();
    }
    if (on) {
      g.fillStyle = acc(1);
      g.fillRect(x, t.y + t.h - T.under, t.w, T.under);
    }
    const color = on ? acc(1) : hot ? ink(1) : ink(T.ink);
    const sec = view.sections.find((s) => `tab:${s.id}` === t.id);
    const mid = t.y + T.pad[0] + (t.h - T.pad[0] - T.pad[2] - T.under) / 2;
    let left = x + T.pad[1];
    if (sec?.icon) {
      iconAt(g, sec.icon, left, mid - icon / 2, icon, color);
      left += icon + T.gap;
    }
    textAt(t.lines?.[0] ?? "", left, mid, font(scale), color);
  }
  for (const side of ["left", "right"] as const) {
    if (!L.more[side]) continue;
    const M = LOOK.tabs.more;
    const x = side === "left" ? 1 : L.width - 1 - M.width;
    const fade = g.createLinearGradient(x, 0, x + M.width, 0);
    const solid = glass(1);
    const clear = glass(0);
    if (side === "left") {
      fade.addColorStop(0, solid);
      fade.addColorStop(M.fade / 100, solid);
      fade.addColorStop(1, clear);
    } else {
      fade.addColorStop(0, clear);
      fade.addColorStop(1 - M.fade / 100, solid);
      fade.addColorStop(1, solid);
    }
    g.fillStyle = fade;
    g.fillRect(x, 1 + 2, M.width, stripBottom - 3);
    g.textAlign = side === "left" ? "left" : "right";
    textAt(side === "left" ? "‹" : "›", side === "left" ? x + M.inset : x + M.width - M.inset, (1 + 2 + stripBottom) / 2, font(scale, LOOK.text.icon), o.hot === `tabs-${side}` ? ink(1) : acc(1));
    g.textAlign = "left";
  }
  g.restore();
  // The list of rows, scrolled inside its room, under its line.
  if (L.rowsAt) {
    g.fillStyle = acc(LOOK.rows.line);
    g.fillRect(1, L.rowsAt.y, L.width - 2, 1);
    const scroll = Math.max(0, Math.min(o.rowsScroll ?? 0, L.rowsContent - L.rowsAt.h));
    g.save();
    g.beginPath();
    g.rect(1, L.rowsAt.y + 1, L.width - 2, L.rowsAt.h - 1);
    g.clip();
    g.translate(0, -scroll);
    for (const b of L.rows) drawBox(g, view, b, o, { acc, ink, glass, warn: (a: number) => `rgba(${Wn}, ${a})`, box, textAt, scale });
    g.restore();
    if (L.rowsContent > L.rowsAt.h + 0.5) {
      // A longer tab: a thin bar at the right says where in it they are, as the flat list's does.
      const room = L.rowsAt.h - 2;
      const bh = Math.max(24, (room * room) / L.rowsContent);
      const by = L.rowsAt.y + 1 + (scroll / (L.rowsContent - L.rowsAt.h)) * (room - bh);
      box(L.width - 7, by, 4, bh, 2);
      g.fillStyle = acc(0.5);
      g.fill();
    }
  }
  // The note, and what the world says.
  for (const n of [L.note, L.said]) {
    if (!n?.lines) continue;
    const said = n.kind === "said";
    g.fillStyle = said ? ink(0.3) : acc(LOOK.note.edge);
    g.fillRect(n.x, n.y, 2, n.h);
    n.lines.forEach((line, i) => textAt(line, n.x + 2 + LOOK.note.pad[3], n.y + LOOK.note.pad[0] + i * LOOK.note.text * S * scale * LH, font(scale, LOOK.note.text), ink(LOOK.note.ink), false));
  }
  // The foot: keep this tab on the bar, and Close.
  const P = LOOK.foot.pin;
  if (L.pin) {
    const on = !!L.section?.pinned;
    const hot = o.hot === "pin";
    box(L.pin.x, L.pin.y, L.pin.w, L.pin.h, P.corners);
    if (on || hot) {
      g.fillStyle = acc(on ? 0.12 : 0.08);
      g.fill();
    }
    g.lineWidth = 1;
    g.strokeStyle = on || hot ? acc(0.8) : ink(P.edge);
    g.stroke();
    const color = on || hot ? acc(1) : ink(P.ink);
    iconAt(g, "pin", L.pin.x + 1 + P.pad[1], L.pin.y + (L.pin.h - P.icon) / 2, P.icon, color);
    textAt(L.pin.lines?.[0] ?? "", L.pin.x + 1 + P.pad[1] + P.icon + P.gap, L.pin.y + L.pin.h / 2, font(scale, P.text), color);
  }
  const C = LOOK.foot.close;
  const hotClose = o.hot === "close";
  box(L.close.x, L.close.y, L.close.w, L.close.h, C.corners);
  if (hotClose) {
    g.fillStyle = ink(0.06);
    g.fill();
  }
  g.strokeStyle = hotClose ? ink(1) : ink(C.edge);
  g.stroke();
  textAt("Close", L.close.x + 1 + C.padX, L.close.y + L.close.h / 2, font(scale), ink(1));
}

interface Paint {
  acc(a: number): string;
  ink(a: number): string;
  glass(a: number): string;
  warn(a: number): string;
  box(x: number, y: number, w: number, h: number, r: number | readonly number[]): void;
  textAt(words: string, x: number, y: number, f: string, color: string, middle?: boolean): void;
  scale: number;
}

/** One thing in the list: a row, a line, a box to type in, a song's bar, a colour, a tile, a card, a world's name. */
function drawBox(g: G, view: UiView, b: MenuBox, o: DrawOptions, p: Paint): void {
  const { acc, ink, glass, box, textAt, scale } = p;
  const R = LOOK.row;
  const icon = LOOK.text.icon * S * scale;
  const hot = o.hot === b.id;
  const slot = (h: number, r: number | readonly number[]) => {
    box(b.x, b.y, b.w, h, r);
    g.fillStyle = glass(0.6);
    g.fill();
    g.setLineDash([4, 4]);
    g.strokeStyle = acc(0.35);
    g.lineWidth = 1;
    g.stroke();
    g.setLineDash([]);
  };
  /** A row's frame and words, `h` tall, from `b`'s top. */
  const row = (item: UiItemView, h: number) => {
    const primary = item.tone === "primary";
    box(b.x, b.y, b.w, h, R.corners);
    g.fillStyle = hot ? acc(R.hoverFill) : primary ? acc(R.primaryFill) : ink(R.fill);
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = hot ? acc(R.hoverEdge) : primary ? acc(R.primaryEdge) : item.on ? acc(R.onEdge) : ink(R.edge);
    g.stroke();
    const color = item.tone === "warn" ? p.warn(1) : ink(1);
    const parts = { lines: b.lines ?? [item.label] };
    const textH = parts.lines.length * S * scale * LH;
    const mid = b.y + h / 2;
    let left = b.x + 1 + R.pad[1];
    if (item.icon) {
      iconAt(g, item.icon, left, mid - icon / 2, icon, color);
      left += icon + R.gap;
    }
    let right = b.x + b.w - 1 - R.pad[1];
    if (item.key) {
      const f = font(scale, 0.82, 400, true);
      g.font = f;
      const kw = Math.max(1.6 * 0.82 * S * scale, g.measureText(item.key).width + 10);
      right -= kw;
      box(right, mid - 10, kw, 20, 5);
      g.strokeStyle = ink(0.3);
      g.stroke();
      g.textAlign = "center";
      textAt(item.key, right + kw / 2, mid + 0.5, f, ink(0.8));
      g.textAlign = "left";
      right -= R.gap;
    }
    if (item.on !== null) {
      const f = font(scale, R.state);
      g.font = f;
      const word = item.on ? "On" : "Off";
      const ww = g.measureText(word).width;
      textAt(word, right - ww, mid + 0.5, f, item.on ? acc(1) : ink(R.stateInk));
    }
    parts.lines.forEach((line, i) => textAt(line, left, mid - textH / 2 + (i + 0.5) * S * scale * LH, font(scale), color));
  };
  switch (b.kind) {
    case "row":
      if (o.hollow === b.id) return slot(b.h, R.corners);
      return row(b.item!, b.h);
    case "file": {
      const rowH = b.h - LOOK.takes.gap - LOOK.takes.to * S * scale * LH;
      if (o.hollow === b.id) slot(rowH, R.corners);
      else row(b.item!, rowH);
      textAt(`The file you choose goes to ${view.title}.`, b.x + R.pad[1], b.y + rowH + LOOK.takes.gap, font(scale, LOOK.takes.to), ink(LOOK.takes.toInk), false);
      return;
    }
    case "line": {
      const item = b.item!;
      const on = item.on === true;
      const L = LOOK.line;
      iconAt(g, item.icon, b.x + L.pad[1], b.y + L.pad[0] + L.iconAt, icon, on ? acc(1) : ink(L.iconDim * L.dim));
      (b.lines ?? []).forEach((line, i) => textAt(line, b.x + L.pad[1] + icon + L.gap, b.y + L.pad[0] + i * S * scale * LH, font(scale), on ? ink(1) : ink(L.dim), false));
      return;
    }
    case "field": {
      const F = LOOK.field;
      box(b.x, b.y, b.w, b.h, R.corners);
      g.fillStyle = ink(R.fill);
      g.fill();
      g.strokeStyle = ink(R.edge);
      g.stroke();
      const f = font(scale);
      g.font = f;
      const bw = 2 + 2 * F.buttonPad[1] + g.measureText(b.item!.label).width;
      const inside = b.y + 1 + F.pad[0];
      box(b.x + 1 + F.pad[1], inside, b.w - 2 - 2 * F.pad[1] - bw - F.gap[1], F.box, F.boxCorners);
      g.fillStyle = glass(F.boxGlass);
      g.fill();
      g.strokeStyle = ink(F.boxEdge);
      g.stroke();
      textAt("Press to type", b.x + 1 + F.pad[1] + 1 + F.boxPad[1], inside + F.box / 2, f, ink(0.4));
      const bx = b.x + b.w - 1 - F.pad[1] - bw;
      box(bx, inside, bw, F.box, F.boxCorners);
      g.fillStyle = hot ? acc(0.3) : acc(R.hoverFill);
      g.fill();
      g.strokeStyle = acc(R.hoverEdge);
      g.stroke();
      textAt(b.item!.label, bx + 1 + F.buttonPad[1], inside + F.box / 2, f, ink(1));
      if (b.lines?.[0]) textAt(b.lines[0], b.x + 1 + F.pad[1], inside + F.box + F.gap[0], font(scale, F.to), ink(F.toInk), false);
      return;
    }
    case "slider": {
      const D = LOOK.slide;
      const item = b.item!;
      box(b.x, b.y, b.w, b.h, R.corners);
      g.fillStyle = ink(R.fill);
      g.fill();
      g.strokeStyle = item.on ? acc(D.onEdge) : ink(R.edge);
      g.stroke();
      const top = b.y + 1 + D.pad[0];
      const rowH = Math.max(icon, S * scale * LH);
      iconAt(g, item.icon, b.x + 1 + D.pad[1], top + (rowH - icon) / 2, icon, item.on ? acc(1) : ink(1));
      textAt(item.label, b.x + 1 + D.pad[1] + icon + D.gap[1], top + rowH / 2, font(scale), ink(1));
      const at = item.slider ? Math.max(0, Math.min(1, item.slider.value() / Math.max(1, item.slider.max()))) : 0;
      const words = item.slider?.text?.() ?? "";
      const tf = font(scale, D.time, 400, true);
      g.font = tf;
      const tw = g.measureText(words).width;
      const left = b.x + 1 + D.pad[1];
      const wide = b.w - 2 - 2 * D.pad[1] - tw - D.gap[1];
      const ty = top + rowH + D.gap[0] + D.bar / 2;
      box(left, ty - 2, wide, 4, 2);
      g.fillStyle = ink(0.2);
      g.fill();
      box(left, ty - 2, Math.max(4, wide * at), 4, 2);
      g.fillStyle = acc(1);
      g.fill();
      g.beginPath();
      g.arc(left + wide * at, ty, hot ? 9 : 7, 0, Math.PI * 2);
      g.fill();
      textAt(words, left + wide + D.gap[1], ty, tf, ink(D.timeInk));
      return;
    }
    case "swatch": {
      const W = LOOK.swatch;
      const item = b.item!;
      if (o.hollow === b.id) return;
      const color = item.color || "#888888";
      const ax = b.x + (W.width - W.arch[0]) / 2;
      const ay = b.y - (hot ? 2 : 0);
      const fill = g.createLinearGradient(0, ay, 0, ay + W.arch[1]);
      fill.addColorStop(0, color);
      fill.addColorStop(1, `${color}4d`);
      box(ax, ay, W.arch[0], W.arch[1], [W.corners[0], W.corners[0], W.corners[1], W.corners[1]]);
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = color;
      g.lineWidth = 1;
      if (item.on) {
        g.save();
        g.shadowColor = color;
        g.shadowBlur = 16 * o.scale;
        g.stroke();
        g.restore();
      } else g.stroke();
      g.fillStyle = item.on ? color : ink(W.sillInk);
      g.fillRect(b.x + (W.width - W.sill[0]) / 2, b.y + W.arch[1] + W.gap + W.sillAt, W.sill[0], W.sill[1]);
      g.textAlign = "center";
      textAt(item.label, b.x + W.width / 2, b.y + W.arch[1] + W.gap + Math.max(0, W.sill[1] + W.sillAt) + W.gap, font(scale, W.text), item.on ? ink(1) : ink(W.ink), false);
      g.textAlign = "left";
      return;
    }
    case "tile": {
      const T = LOOK.tile;
      const item = b.item!;
      if (o.hollow === b.id) return slot(b.h, [T.corners[0], T.corners[0], T.corners[1], T.corners[1]]);
      box(b.x, b.y, b.w, b.h, [T.corners[0], T.corners[0], T.corners[1], T.corners[1]]);
      if (item.faint) g.fillStyle = ink(R.fill);
      else {
        const glow = g.createRadialGradient(b.x + b.w / 2, b.y + b.h, 0, b.x + b.w / 2, b.y + b.h, b.w * 1.2);
        glow.addColorStop(0, acc(T.glow));
        glow.addColorStop(0.7, ink(R.fill));
        g.fillStyle = glow;
      }
      g.fill();
      g.setLineDash(item.faint ? [5, 4] : []);
      g.lineWidth = item.on ? 2 : 1;
      g.strokeStyle = item.on ? acc(1) : hot ? acc(R.hoverEdge) : ink(R.edge);
      g.stroke();
      g.setLineDash([]);
      g.lineWidth = 1;
      const pic = b.w - 2 - 2 * T.pad[1];
      const px = b.x + 1 + T.pad[1];
      const py = b.y + 1 + T.pad[0];
      const shown = o.picture?.(item.id) ?? item.picture?.() ?? null;
      if (shown) {
        g.save();
        if (item.faint) {
          g.globalAlpha = 0.5;
          g.filter = "grayscale(1)";
        }
        g.drawImage(shown, px, py, pic, pic);
        g.restore();
      } else {
        g.textAlign = "center";
        textAt([...item.short][0]?.toUpperCase() ?? "", px + pic / 2, py + pic / 2, font(scale, T.letter, 700), ink(0.35));
        g.textAlign = "left";
      }
      // A tile stretched to its row (a neighbour's longer name) shares the room between its picture's row and its
      // name's, as the flat menu's grid does: its name sits that much lower.
      const natural = 2 + T.pad[0] + T.pad[2] + pic + T.gap + (b.lines?.length ?? 0) * T.text * S * scale * T.line;
      const extra = Math.max(0, b.h - natural) / 2;
      g.textAlign = "center";
      (b.lines ?? []).forEach((line, i) => textAt(line, b.x + b.w / 2, py + pic + extra + T.gap + i * T.text * S * scale * T.line, font(scale, T.text), item.faint ? ink(0.55) : ink(T.ink), false));
      g.textAlign = "left";
      if (item.mark) {
        const M = T.mark;
        const mx = b.x + b.w - 1 - M.inset - M.size;
        const my = b.y + 1 + M.inset;
        box(mx, my, M.size, M.size, M.corners);
        g.fillStyle = glass(M.glass);
        g.fill();
        g.strokeStyle = acc(M.edge);
        g.stroke();
        iconAt(g, item.mark, mx + (M.size - M.icon) / 2, my + (M.size - M.icon) / 2, M.icon, acc(1));
      }
      return;
    }
    case "from":
      textAt(b.lines?.[0] ?? "", b.x + LOOK.from.padX, b.y + LOOK.from.top, font(scale, LOOK.from.text, 650), ink(LOOK.from.ink), false);
      return;
    case "card":
      return drawCard(g, view, b, o, p);
    case "swatches":
    case "tiles":
      return;
    default:
      return;
  }
}

function drawCard(g: G, view: UiView, b: MenuBox, o: DrawOptions, p: Paint): void {
  const { acc, ink, glass, box, textAt, scale } = p;
  const C = LOOK.card;
  const card = b.card;
  if (!card) return;
  box(b.x, b.y, b.w, b.h, [C.corners[0], C.corners[0], C.corners[1], C.corners[1]]);
  g.fillStyle = acc(C.fill);
  g.fill();
  g.strokeStyle = acc(C.edge);
  g.stroke();
  const left = b.x + 1 + C.pad;
  const top = b.y + 1 + C.pad;
  let words = left + C.face + C.gap[1];
  if (card.draw) {
    const face = b.h - 2 - 2 * C.pad;
    const size = Math.min(face, C.thing);
    box(left, top, size, size, 14);
    const glow = g.createRadialGradient(left + size / 2, top + size * 0.92, 0, left + size / 2, top + size * 0.92, size * 0.7);
    glow.addColorStop(0, acc(0.3));
    glow.addColorStop(1, ink(0.05));
    g.fillStyle = glow;
    g.fill();
    const shown = o.picture?.("card") ?? card.draw();
    if (shown) g.drawImage(shown, left + 8, top + 8, size - 16, size - 16);
    words = left + size + 14;
  } else {
    g.beginPath();
    g.arc(left + C.face / 2, top + C.face / 2, C.face / 2, 0, Math.PI * 2);
    g.fillStyle = card.color || ink(0.2);
    g.fill();
    const face = o.picture?.("card") ?? (card.face as CanvasImageSource | undefined) ?? null;
    if (face) {
      g.save();
      g.clip();
      g.drawImage(face, left, top, C.face, C.face);
      g.restore();
    } else {
      g.textAlign = "center";
      textAt([...card.title][0]?.toUpperCase() ?? "", left + C.face / 2, top + C.face / 2, font(scale, 1.5, 700), glass(1));
      g.textAlign = "left";
    }
  }
  const head = C.title * S * scale * LH;
  const keylineH = Math.max(C.keyline * S * scale * LH, card.copy ? 2 + 4 + C.keyline * S * scale * LH : 0);
  // A person's face is taller than their name and key line: the grid shares what is over between those two rows,
  // and each is centred in its own.
  const over = card.draw ? 0 : Math.max(0, C.face - (head + C.gap[0] + keylineH)) / 2;
  const tf = font(scale, C.title, 650);
  g.font = tf;
  const tw = g.measureText(card.title).width;
  const nameMid = top + (head + over) / 2;
  textAt(card.title, words, nameMid, tf, ink(1));
  if (card.tag) {
    const f = font(scale, C.tag);
    g.font = f;
    const w = g.measureText(card.tag).width + 16;
    const h = C.tag * S * scale * LH + 2;
    box(words + tw + 8, nameMid - h / 2, w, h, h / 2);
    g.strokeStyle = card.proven ? acc(0.8) : ink(0.3);
    g.stroke();
    textAt(card.tag, words + tw + 16, nameMid, f, card.proven ? acc(1) : ink(0.75));
  }
  const subMid = card.draw ? top + head + 5 + keylineH / 2 : top + head + over + C.gap[0] + (keylineH + over) / 2;
  textAt(card.sub, words, subMid, font(scale, C.keyline, card.copy ? 400 : 500, !!card.copy), ink(0.7));
  const lines = b.lines ?? [];
  if (lines.length) {
    const keyline = Math.max(C.keyline * S * scale * LH, card.copy ? 2 + 4 + C.keyline * S * scale * LH : 0);
    const qy = card.draw ? top + head + 5 + keyline + 5 + 3 : top + Math.max(C.face, head + C.gap[0] + keyline) + C.gap[0] + C.quote;
    const qx = card.draw ? words : left;
    g.fillStyle = acc(0.6);
    g.fillRect(qx, qy, 2, lines.length * S * scale * LH + 2);
    lines.forEach((line, i) => textAt(line, qx + 12, qy + 1 + i * S * scale * LH, font(scale), ink(0.95), false));
  }
}

/** Paint a laid-out bar onto `g`, at `o.scale`. */
export function drawBar(g: G, view: UiView, L: ReturnType<typeof layBar>, o: DrawOptions & { open?: string | null }): void {
  const k = o.scale;
  const scale = view.theme.scale || 1;
  const A = rgb(view.theme.accent);
  const I = rgb(view.theme.ink);
  const Gl = rgb(view.theme.glass);
  const Wn = rgb(view.theme.warn);
  const acc = (a: number) => `rgba(${A}, ${a})`;
  const ink = (a: number) => `rgba(${I}, ${a})`;
  const box = (x: number, y: number, w: number, h: number, r: readonly number[]) => {
    g.beginPath();
    g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, [...r]);
  };
  const B = LOOK.bar;
  const K = LOOK.key;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.clearRect(0, 0, L.width, L.height);
  box(0, 0, L.width, L.height, [B.corners[0], B.corners[0], B.corners[1], B.corners[1]]);
  g.fillStyle = `rgba(${Gl}, ${o.glass ?? 0.95})`;
  g.fill();
  g.lineWidth = 1;
  g.strokeStyle = acc(LOOK.glass.edge);
  g.stroke();
  if (L.theirs !== null) {
    g.fillStyle = ink(B.theirs);
    g.fillRect(L.theirs, B.pad[0] + 2, 1, L.height - B.pad[0] - B.pad[2] - 10);
  }
  const icon = LOOK.text.icon * S * scale;
  for (const key of L.keys) {
    if (o.hollow === key.id) continue;
    const pin = key.id.startsWith("tab:");
    const item = key.item;
    const on = pin ? o.open === key.id.slice(4) : item?.on === true;
    const hot = o.hot === key.id;
    const primary = item?.tone === "primary";
    const warn = item?.tone === "warn";
    const ax = key.x + (K.width - K.arch[0]) / 2;
    const ay = key.y - (hot ? 2 : 0);
    box(ax, ay, K.arch[0], K.arch[1], [K.corners[0], K.corners[0], K.corners[1], K.corners[1]]);
    g.fillStyle = primary ? acc(1) : on ? acc(K.onFill) : hot ? acc(K.hoverFill) : warn ? `rgba(${Wn}, 0.08)` : acc(K.fill);
    g.fill();
    g.setLineDash(pin ? [4, 3] : []);
    g.strokeStyle = primary || on || hot ? acc(1) : warn ? `rgba(${Wn}, 0.7)` : acc(K.edge);
    g.stroke();
    g.setLineDash([]);
    const name = pin ? (view.pins.find((p) => `tab:${p.id}` === key.id)?.icon ?? "menu") : (item?.icon ?? null);
    iconAt(g, name, ax + (K.arch[0] - icon) / 2, ay + (K.arch[1] - icon) / 2, icon, primary ? `rgba(${Gl}, 1)` : on ? acc(1) : warn ? `rgba(${Wn}, 1)` : ink(1));
    g.fillStyle = on || hot ? acc(1) : ink(K.sillInk);
    g.fillRect(key.x + (K.width - K.sill[0]) / 2, key.y + K.arch[1] + K.gap + K.sillAt, K.sill[0], K.sill[1]);
    g.textAlign = "center";
    g.textBaseline = "top";
    g.font = font(scale, K.name);
    g.fillStyle = ink(K.ink);
    (key.lines ?? []).forEach((line, i) => g.fillText(line, key.x + K.width / 2, key.y + K.arch[1] + K.gap + Math.max(0, K.sill[1] + K.sillAt) + K.gap + i * K.name * S * scale * K.line));
    g.textAlign = "left";
    const num = item?.key ?? view.pins.find((p) => `tab:${p.id}` === key.id)?.key ?? "";
    if (num) {
      const f = font(scale, 0.82, 400, true);
      g.font = f;
      const nw = Math.max(1.6 * 0.82 * S * scale, g.measureText(num).width + 10);
      box(key.x + K.width + 2 - nw, key.y - 6, nw, 18, [5, 5, 5, 5]);
      g.fillStyle = `rgba(${Gl}, 1)`;
      g.fill();
      g.strokeStyle = ink(0.3);
      g.stroke();
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = ink(0.85);
      g.fillText(num, key.x + K.width + 2 - nw / 2, key.y + 3 + 0.5);
      g.textAlign = "left";
    }
  }
}

// --------------------------------------------------------------------------------------------- the drawing

export interface MenuDrawingOptions {
  /** The sheet's width: two columns (`SHEET_LOOK.sheet.wide`) or one (`.narrow`, on the wrist). */
  width?: number;
  /** Canvas pixels to each of the flat menu's CSS pixels. */
  scale?: number;
  /** The glass's fill. */
  glass?: number;
  /** The most the sheet may be tall. */
  most?: number;
  /** Whether it can be seen just now: nothing is drawn that nobody sees. */
  shown?: () => boolean;
  /** Told each time a picture has been drawn anew. */
  painted?: (what: "sheet" | "bar") => void;
}

/** The menu's two pictures, the sheet and the bar, kept drawn as the controls change. */
export interface MenuDrawing {
  readonly sheet: HTMLCanvasElement;
  readonly bar: HTMLCanvasElement;
  /** The tab that is up. */
  section: string;
  /** What is pointed at, by a box's id, or null. */
  aimed: string | null;
  /** What has come forward off the sheet, left an empty slot where it was. */
  hollow: string | null;
  /** How far the list of rows, and the strip of tabs, are slid along. The strip is slid to the open tab as it opens. */
  rowsScroll: number;
  tabsScroll: number;
  /** The layouts last drawn: where every pressable thing is, in the flat menu's CSS pixels. */
  readonly sheetLayout: SheetLayout | null;
  readonly barLayout: ReturnType<typeof layBar> | null;
  /** Draw both, where what they show has changed. True where either was drawn anew. */
  paint(): boolean;
  /** Whatever they show, the next `paint` draws them anew. */
  again(): void;
  /** What is at a point of the sheet (in CSS pixels from its top left): a pressable box's id, or null. */
  sheetAt(x: number, y: number): string | null;
  barAt(x: number, y: number): string | null;
}

/**
 * The menu on two canvases, from `controls.view()`: the sheet and the bar, drawn as the flat menu is. Where each
 * thing is comes with them (`sheetLayout`, `sheetAt`), for a ray to find. Pressing is the caller's.
 */
export function createMenuDrawing(controls: Controls, opts: MenuDrawingOptions = {}): MenuDrawing {
  const sheet = document.createElement("canvas");
  const bar = document.createElement("canvas");
  const gs = sheet.getContext("2d")!;
  const gb = bar.getContext("2d")!;
  const measureG = document.createElement("canvas").getContext("2d")!;
  const measure: Measure = (text, f) => {
    measureG.font = f;
    return measureG.measureText(text).width;
  };
  const k = opts.scale ?? 2;
  let sheetDrawn = "";
  let barDrawn = "";
  let sheetLayout: SheetLayout | null = null;
  /** The tab last drawn: a tab newly up has the strip slid to it, as the flat menu's is. */
  let shownTab = "";
  let barLayout: ReturnType<typeof layBar> | null = null;
  const d: MenuDrawing = {
    sheet,
    bar,
    section: "",
    aimed: null,
    hollow: null,
    rowsScroll: 0,
    tabsScroll: 0,
    get sheetLayout() {
      return sheetLayout;
    },
    get barLayout() {
      return barLayout;
    },
    paint() {
      if (opts.shown && !opts.shown()) return false;
      const view = controls.view();
      if (!view.sections.some((s) => s.id === d.section)) d.section = view.sections[0]?.id ?? "";
      const look = { aimed: d.aimed, hollow: d.hollow, rows: d.rowsScroll, tabs: d.tabsScroll, section: d.section };
      const slid = (s: UiSectionView) => ({ ...s, items: s.items.map((i) => (i.slider ? { ...i, at: [i.slider.value(), i.slider.max(), i.slider.text?.() ?? ""] } : i)) });
      const sig = JSON.stringify([view.title, view.theme, view.pins, view.pinsFull, view.sections.map(slid), look]);
      let drew = false;
      if (sig !== sheetDrawn) {
        sheetDrawn = sig;
        sheetLayout = laySheet(view, d.section, { measure, width: opts.width ?? LOOK.sheet.wide, most: opts.most ?? LOOK.sheet.tall.desk, title: view.title, tabsScroll: d.tabsScroll, bring: d.section !== shownTab });
        shownTab = d.section;
        d.tabsScroll = sheetLayout.tabsScroll;
        sheet.width = Math.round(sheetLayout.width * k);
        sheet.height = Math.round(sheetLayout.height * k);
        drawSheet(gs, view, sheetLayout, { scale: k, glass: opts.glass ?? 0.95, hot: d.aimed, hollow: d.hollow, rowsScroll: d.rowsScroll });
        opts.painted?.("sheet");
        drew = true;
      }
      const barSig = JSON.stringify([view.theme, view.hotbar, view.pins, d.section, d.aimed, d.hollow]);
      if (barSig !== barDrawn) {
        barDrawn = barSig;
        barLayout = layBar(view, { measure });
        bar.width = Math.max(1, Math.round(barLayout.width * k));
        bar.height = Math.max(1, Math.round(barLayout.height * k));
        drawBar(gb, view, barLayout, { scale: k, glass: opts.glass ?? 0.95, hot: d.aimed, hollow: d.hollow, open: d.section });
        opts.painted?.("bar");
        drew = true;
      }
      return drew;
    },
    again() {
      sheetDrawn = "";
      barDrawn = "";
    },
    sheetAt(x, y) {
      const L = sheetLayout;
      if (!L) return null;
      const within = (b: MenuBox, dx = 0, dy = 0) => x >= b.x - dx && x < b.x - dx + b.w && y >= b.y - dy && y < b.y - dy + b.h;
      for (const side of ["left", "right"] as const) {
        const M = LOOK.tabs.more;
        if (L.more[side] && y < (L.tabs[0]?.y ?? 0) + (L.tabs[0]?.h ?? 0) && (side === "left" ? x < 1 + M.width : x >= L.width - 1 - M.width)) return `tabs-${side}`;
      }
      for (const t of L.tabs) if (within(t, L.tabsScroll)) return t.id;
      if (L.rowsAt && y >= L.rowsAt.y + 1 && y < L.rowsAt.y + L.rowsAt.h) {
        const scroll = Math.max(0, Math.min(d.rowsScroll, L.rowsContent - L.rowsAt.h));
        for (const b of L.rows) if (b.item && b.kind !== "line" && within(b, 0, scroll)) return b.id;
        return null;
      }
      for (const b of [L.pin, L.close]) if (b && within(b)) return b.id;
      return null;
    },
    barAt(x, y) {
      for (const key of barLayout?.keys ?? []) if (x >= key.x && x < key.x + key.w && y >= key.y - 6 && y < key.y + key.h) return key.id;
      return null;
    },
  };
  return d;
}
