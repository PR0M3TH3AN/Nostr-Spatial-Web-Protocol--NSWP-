/**
 * The headset console's picture: a world's controls drawn on a canvas, as one panel of light. Sections down the
 * side, their buttons beside them, a card and lines where a section has them.
 *
 * Nothing here knows what shows the picture. A Three.js world puts it on a panel in its scene (console.ts). A
 * world made with another engine is handed the pixels by the engine script, and shows them its own way
 * (engine-console.ts). Both draw with this, so the console is drawn once.
 *
 * Where each pressable thing is, is kept beside the picture (`regions`): the same rectangles say what a ray points
 * at and what a press lands on.
 */
import { ICONS, type IconName } from "./ui/icons.js";
import { loadPicture } from "./picture.js";
import type { Controls, UiItemView, UiView } from "./ui/model.js";
import { rgb } from "./ui/theme.js";

/** The picture's size, in its own units. */
export const CONSOLE_W = 1024;
export const CONSOLE_H = 640;
const W = CONSOLE_W;
const H = CONSOLE_H;

/** The least height a section's tab is given in one column; fewer, and the sections go into two columns instead. */
export const TAB_MIN = 52;
/** A button's height while there are lines under it: room is kept for the lines, never by shrinking their words. */
export const BUTTON_WITH_LINES = 72;

/**
 * Where the sections go down the left: one column while each tab can have `TAB_MIN`, else two, filled down the first
 * and then the second, so every section is one select away and no icon touches its neighbour. `left` is where the
 * open section's buttons begin.
 */
export function tabLayout(count: number): { cols: 1 | 2; rows: number; tabH: number; colW: number; left: number } {
  const n = Math.max(1, count);
  const room = H - 150;
  if (room / n >= TAB_MIN) return { cols: 1, rows: n, tabH: Math.min(88, room / n), colW: 236, left: 284 };
  const rows = Math.ceil(n / 2);
  return { cols: 2, rows, tabH: Math.min(88, room / rows), colW: 168, left: 384 };
}

/**
 * The lines of a section, a page at a time: as many whole lines as fit the room, in order, and the rest on the next
 * page. Their words are always the console's usual size: a page more, never a smaller sentence. Every page has at
 * least one line, even one taller than the room.
 */
export function pageLines(heights: readonly number[], room: number): number[][] {
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  heights.forEach((h, i) => {
    if (page.length && used + h > room) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(i);
    used += h;
  });
  if (page.length) pages.push(page);
  return pages;
}

/**
 * How a thing is lit when pointed at, for whatever shows the picture drawn plain and lights the row itself (an
 * engine that isn't JavaScript's): a box over the thing's own place, filled and edged in these colours, with these
 * corners (top left, top right, bottom right, bottom left), all in the console's own units. The look is the kit's:
 * whatever draws the box chooses nothing.
 */
export interface Lit {
  fill: string;
  fillAlpha: number;
  stroke: string;
  strokeAlpha: number;
  line: number;
  corners: [number, number, number, number];
}

/** A thing on the console that can be pressed: where it is, in the console's own units, and its words. */
export interface Region {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** How it is lit when pointed at. Null: nothing lights it. Left out where the picture itself carries the light. */
  lit?: Lit | null;
}

export function strokeIcon(g: CanvasRenderingContext2D, name: IconName | null, x: number, y: number, size: number): void {
  if (!name) return;
  g.save();
  g.translate(x, y);
  g.scale(size / 24, size / 24);
  g.lineWidth = 1.7;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.stroke(new Path2D(ICONS[name]));
  g.restore();
}

function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width <= max || !line) line = next;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = fit(g, `${out[lines - 1]} …`, max);
  }
  // A single word longer than the room (an address, a name with no spaces) is cut, rather than run past the edge.
  return out.map((line) => fit(g, line, max));
}

export const SANS = 'system-ui, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export interface ConsoleDrawingOptions {
  /** The canvas to draw on, `CONSOLE_W` by `CONSOLE_H`. */
  canvas: HTMLCanvasElement;
  /** Its 2D context, where whoever made the canvas made it a particular way. */
  context?: CanvasRenderingContext2D;
  /** Whether the console can be seen just now: a picture that arrives late is drawn in only if so. */
  shown?: () => boolean;
  /** Told each time the picture has been drawn anew, with the theme it was drawn in. */
  painted?: (theme: UiView["theme"]) => void;
  /**
   * Never draw a row lit. For whatever lights the row pointed at itself, from each region's `lit`, so that the
   * picture is drawn again only when what it shows changes and never for pointing.
   */
  plain?: boolean;
}

/** The console's picture and what is on it. What it shows is kept here; where it is shown is the caller's. */
export interface ConsoleDrawing {
  /** The section that is up. */
  section: string;
  /** What is pointed at: a region's id, or anything else the caller points at ("open"), or null. */
  aimed: string | null;
  /** The pressable things, as last drawn. */
  readonly regions: readonly Region[];
  /** Which page of the open section's lines is shown, counted from nought, and of how many. */
  readonly linePage: number;
  readonly linePages: number;
  /** Show the next page of lines, round to the first. */
  turnPage(): void;
  /** Draw it, if anything it shows has changed. True where it was drawn anew. */
  paint(): boolean;
  /** Whatever it shows, the next `paint` draws it anew. */
  again(): void;
}

export function createConsoleDrawing(controls: Controls, opts: ConsoleDrawingOptions): ConsoleDrawing {
  const g = opts.context ?? opts.canvas.getContext("2d")!;
  const shown = opts.shown ?? (() => true);
  let section = "";
  let aimed: string | null = null;
  let regions: Region[] = [];
  let painted = "";
  let noteNow = "";
  /** Which page of the open section's lines is shown, of how many, and for what (a page is kept until that changes). */
  let linePage = 0;
  let linePages = 1;
  let linesFor = "";

  /** Pictures for the card at the head of a section, by where each is: fetched once, the kit's way, and only drawn. */
  const faces = new Map<string, HTMLCanvasElement | null>();
  const faceOf = (address: string): HTMLCanvasElement | null => {
    if (!faces.has(address)) {
      faces.set(address, null);
      void loadPicture(address).then((drawn) => {
        if (!drawn) return;
        faces.set(address, drawn);
        painted = ""; // drawn again, with the picture in it
        if (shown()) paint();
      });
    }
    return faces.get(address) ?? null;
  };

  /** Draw the whole console: header, sections down the left, the open section's buttons, its note. */
  const paint = (): boolean => {
    const view: UiView = controls.view();
    const t = view.theme;
    if (!view.sections.some((s) => s.id === section)) section = view.sections[0]?.id ?? "";
    // How far along is drawn to the whole percent: finer than that, and the panel would be drawn again for nothing.
    const loads = view.loading ? { words: view.loading.words, much: view.loading.fraction === null ? null : Math.floor(view.loading.fraction * 100) } : null;
    // Plain, the picture never carries a lit row: whatever shows it lights the row pointed at itself (below).
    const lit = opts.plain ? null : aimed;
    const signature = JSON.stringify([view.title, view.address, loads, view.sections, section, lit, t, linePage]);
    if (signature === painted) return false;
    painted = signature;
    const A = rgb(t.accent);
    const I = rgb(t.ink);
    const k = Math.min(1.2, t.scale); // text can't grow past what the panel holds
    regions = [];
    g.clearRect(0, 0, W, H);

    // The pane: glass with a lit top edge, its top corners rounded like an arch's shoulders.
    g.beginPath();
    g.roundRect(4, 4, W - 8, H - 8, [56, 56, 18, 18]);
    g.fillStyle = `rgba(${rgb(t.glass)}, 0.86)`;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = `rgba(${A}, 0.55)`;
    g.stroke();
    const top = g.createLinearGradient(80, 0, W - 80, 0);
    top.addColorStop(0, `rgba(${A}, 0)`);
    top.addColorStop(0.5, `rgba(${A}, 1)`);
    top.addColorStop(1, `rgba(${A}, 0)`);
    g.fillStyle = top;
    g.fillRect(80, 4, W - 160, 4);

    // Header: the lit doorway, the world's name, its address.
    const mark = g.createLinearGradient(0, 30, 0, 96);
    mark.addColorStop(0, `rgba(${A}, 0.95)`);
    mark.addColorStop(1, `rgba(${A}, 0.25)`);
    g.fillStyle = mark;
    g.beginPath();
    g.roundRect(40, 30, 44, 60, [22, 22, 4, 4]);
    g.fill();
    g.fillStyle = t.ink;
    g.fillRect(32, 94, 60, 4);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.font = `650 ${Math.round(38 * k)}px ${SANS}`;
    g.fillText(fit(g, view.title, W - 300), 112, 62);
    g.font = `400 ${Math.round(24 * k)}px ${MONO}`;
    g.fillStyle = `rgba(${I}, 0.66)`;
    // Still loading: the address keeps the left half of its line, and the world's words take the right, up to Close.
    g.fillText(fit(g, view.address, loads ? (W - 300) / 2 - 16 : W - 300), 112, 96);
    if (loads) {
      g.font = `500 ${Math.round(24 * k)}px ${SANS}`;
      g.fillStyle = `rgb(${A})`;
      g.textAlign = "right";
      const said = `${loads.words || "Still loading"}${loads.much === null ? "" : `  ${loads.much}%`}`;
      g.fillText(fit(g, said, (W - 300) / 2 - 16), W - 172, 96);
      g.textAlign = "left";
    }

    const button = (r: Region, draw: (hot: boolean) => void) => {
      regions.push(r);
      draw(lit === r.id);
    };

    // Close, top right.
    button({ id: "close", x: W - 150, y: 26, w: 116, h: 72, label: "Close", lit: { fill: t.ink, fillAlpha: 0.13, stroke: t.ink, strokeAlpha: 0.9, line: 2, corners: [16, 16, 16, 16] } }, (hot) => {
      g.beginPath();
      g.roundRect(W - 150, 26, 116, 72, 16);
      g.fillStyle = hot ? `rgba(${I}, 0.18)` : `rgba(${I}, 0.05)`;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = `rgba(${I}, ${hot ? 0.9 : 0.3})`;
      g.stroke();
      g.strokeStyle = t.ink;
      strokeIcon(g, "exit", W - 150 + 38, 26 + 16, 40);
    });

    g.fillStyle = `rgba(${A}, 0.22)`;
    g.fillRect(28, 122, W - 56, 2);
    // How far along, as the line under the header filling: all of it lit faintly where that can't be said.
    if (loads) {
      g.fillStyle = `rgba(${A}, ${loads.much === null ? 0.45 : 1})`;
      g.fillRect(28, 121, (W - 56) * (loads.much === null ? 1 : loads.much / 100), 4);
    }

    // Sections, down the left: in two columns when there are too many for one to give each room.
    const tabs = tabLayout(view.sections.length);
    const tabIcon = Math.min(36, tabs.tabH - 18);
    view.sections.forEach((s, i) => {
      const c = tabs.cols === 2 ? Math.floor(i / tabs.rows) : 0;
      const x = 24 + c * (tabs.colW + 8);
      const y = 134 + (tabs.cols === 2 ? i % tabs.rows : i) * tabs.tabH;
      const h = tabs.tabH - 8;
      const on = s.id === section;
      // The tab that is up looks the same pointed at or not, so nothing lights it.
      button({ id: `tab:${s.id}`, x, y, w: tabs.colW, h, label: s.label, lit: on ? null : { fill: t.accent, fillAlpha: 0.08, stroke: t.accent, strokeAlpha: 0, line: 0, corners: [6, 18, 18, 6] } }, (hot) => {
        if (on || hot) {
          g.beginPath();
          g.roundRect(x, y, tabs.colW, h, [6, 18, 18, 6]);
          g.fillStyle = `rgba(${A}, ${on ? 0.16 : 0.08})`;
          g.fill();
        }
        if (on) {
          g.fillStyle = t.accent;
          g.fillRect(x, y, 5, h);
        }
        g.strokeStyle = g.fillStyle = on ? t.accent : hot ? t.ink : `rgba(${I}, 0.72)`;
        strokeIcon(g, s.icon, x + 16, y + h / 2 - tabIcon / 2, tabIcon);
        g.font = `${on ? 650 : 500} ${Math.round((tabs.cols === 2 ? 22 : 30) * k)}px ${SANS}`;
        g.textBaseline = "middle";
        g.fillText(fit(g, s.label, tabs.colW - tabIcon - 34), x + tabIcon + 26, y + h / 2 + 2);
        g.textBaseline = "alphabetic";
      });
    });

    // The open section's buttons, in two columns, or three when there are many.
    const current = view.sections.find((s) => s.id === section);
    // Lines are read, not pressed: they are laid out under the buttons, and are no region a ray can choose.
    // A bar that is moved along is not drawn here: whatever has one gives the same thing as buttons beside it.
    const items: UiItemView[] = (current?.items ?? []).filter((item) => item.kind !== "line" && item.kind !== "slider");
    const lines: UiItemView[] = (current?.items ?? []).filter((item) => item.kind === "line");
    noteNow = current?.note ?? "";
    g.font = `400 ${Math.round(24 * k)}px ${SANS}`;
    const left = tabs.left;
    const areaW = W - left - 30;
    const noteLines = noteNow ? wrap(g, noteNow, areaW - 16, 4) : [];
    const noteH = noteLines.length ? noteLines.length * 32 + 20 : 0;

    // Who the section is about, at its head: a face, a name, how they are known, and what they say of themselves.
    const card = current?.card ?? null;
    const cardH = card ? (card.text ? 162 : 104) : 0;
    if (card) {
      const y = 138;
      g.beginPath();
      g.roundRect(left, y, areaW, cardH - 12, [22, 22, 8, 8]);
      g.fillStyle = `rgba(${A}, 0.08)`;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = `rgba(${A}, 0.5)`;
      g.stroke();
      const face = card.picture ? faceOf(card.picture) : null;
      const cx = left + 58;
      const cy = y + 50;
      g.save();
      g.beginPath();
      g.arc(cx, cy, 36, 0, Math.PI * 2);
      g.closePath();
      g.fillStyle = card.color || `rgba(${I}, 0.25)`;
      g.fill();
      if (face) {
        g.clip();
        g.drawImage(face, cx - 36, cy - 36, 72, 72);
      } else {
        g.fillStyle = t.glass;
        g.font = `700 ${Math.round(40 * k)}px ${SANS}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText([...card.title][0]?.toUpperCase() ?? "", cx, cy + 2);
        g.textAlign = "left";
        g.textBaseline = "alphabetic";
      }
      g.restore();
      const tx = left + 116;
      g.font = `650 ${Math.round(32 * k)}px ${SANS}`;
      g.fillStyle = t.ink;
      const name = fit(g, card.title, areaW - 300);
      g.fillText(name, tx, y + 43);
      if (card.tag) {
        const nameW = g.measureText(name).width;
        g.font = `500 ${Math.round(21 * k)}px ${SANS}`;
        const tagW = g.measureText(card.tag).width + 26;
        g.beginPath();
        g.roundRect(tx + nameW + 16, y + 17, tagW, 34, 17);
        g.lineWidth = 2;
        g.strokeStyle = card.proven ? `rgba(${A}, 0.9)` : `rgba(${I}, 0.35)`;
        g.stroke();
        g.fillStyle = card.proven ? t.accent : `rgba(${I}, 0.8)`;
        g.fillText(card.tag, tx + nameW + 29, y + 41);
      }
      g.font = `400 ${Math.round(22 * k)}px ${card.copy ? MONO : SANS}`;
      g.fillStyle = `rgba(${I}, 0.7)`;
      g.fillText(fit(g, [card.sub, ...card.now].join("   "), areaW - 140), tx, y + 78);
      if (card.text) {
        g.fillStyle = `rgba(${A}, 0.7)`;
        g.fillRect(left + 20, y + 96, 3, 48);
        g.font = `400 ${Math.round(22 * k)}px ${SANS}`;
        g.fillStyle = `rgba(${I}, 0.9)`;
        wrap(g, card.text, areaW - 60, 2).forEach((line, i) => g.fillText(line, left + 34, y + 114 + i * 26));
      }
    }

    // The lines, at the console's usual size, one to a row across the whole width: each its whole sentence, wrapped
    // and never cut. What doesn't fit goes on another page, and a button under the others shows the next.
    const lineSize = Math.round(22 * k);
    const lineTextW = areaW - 44;
    g.font = `400 ${lineSize}px ${SANS}`;
    const laid = lines.map((item) => wrap(g, item.label, lineTextW, 99));
    const lineHs = laid.map((l) => l.length * (lineSize + 4) + 4);
    const contentTop = 138 + cardH;
    // Kept clear of the note under it.
    const contentRoom = H - 14 - noteH - (noteH ? 10 : 0) - contentTop;
    // Two buttons of long words (a question's two answers) are one column, so neither is cut short.
    const columns = (n: number) => (n <= 2 && items.some((item) => item.label.length > 24) ? 1 : n > 8 ? 3 : 2);
    const grid = (n: number, withLines: boolean) => {
      let cols = columns(n);
      // The page button sits beside the others where there is a cell for it, rather than taking a row of its own.
      if (withLines && n <= 3 && n > items.length && cols < n) cols = n;
      const rows = n ? Math.ceil(n / cols) : 0;
      const free = contentRoom - (rows - 1) * 12;
      const cellH = !rows ? 0 : withLines && lines.length ? Math.min(BUTTON_WITH_LINES, free / rows) : Math.min(96, free / rows);
      return { cols, rows, cellH: Math.max(0, cellH), height: rows ? rows * (cellH + 12) : 0 };
    };
    const forLines = lines.length > 0;
    let cells = items.length;
    let layout = grid(cells, forLines);
    let pages = [lines.map((_, i) => i)];
    if (forLines) {
      const room = contentRoom - layout.height - 4;
      if (lineHs.reduce((a, h) => a + h, 0) > room) {
        cells = items.length + 1;
        layout = grid(cells, true);
        pages = pageLines(lineHs, contentRoom - layout.height - 4);
      }
    }
    const key = `${section}|${card?.title ?? ""}|${lines.map((l) => l.label).join("|")}`;
    if (key !== linesFor) {
      linesFor = key;
      linePage = 0;
    }
    linePages = pages.length;
    if (linePage >= linePages) linePage = 0;
    const { cols, cellH } = layout;
    const evenW = (areaW - (cols - 1) * 14) / cols;
    // Where the page button shares a single row with the others, it needs only its few words, and they get the rest.
    const PAGER_W = 150;
    const shared = !!(linePages > 1 && layout.rows === 1 && items.length);
    const itemW = shared ? (areaW - PAGER_W - items.length * 14) / items.length : evenW;
    const cellAt = (i: number): { x: number; y: number; w: number } =>
      shared ? { x: left + i * (itemW + 14), y: contentTop, w: i < items.length ? itemW : PAGER_W } : { x: left + (i % cols) * (evenW + 14), y: contentTop + Math.floor(i / cols) * (cellH + 12), w: evenW };
    const pager: UiItemView | null =
      linePages > 1 ? { id: "", label: `Page ${linePage + 1} of ${linePages}`, icon: "turn", on: null, tone: "normal", key: "", short: "", kind: "button", color: "", mark: null, faint: false } : null;
    [...items, ...(pager ? [pager] : [])].forEach((item, i) => {
      const { x, y, w: cellW } = cellAt(i);
      const tone = item.tone === "warn" ? rgb(t.warn) : A;
      const toneHex = item.tone === "warn" ? t.warn : t.accent;
      // Over a button that is already filled (on, or the one to press first) less is added, to end at the same strength.
      const litLook: Lit = { fill: toneHex, fillAlpha: item.tone === "primary" || item.on ? 0.17 : 0.26, stroke: toneHex, strokeAlpha: 1, line: 4, corners: [18, 18, 6, 6] };
      button({ id: item === pager ? "lines-more" : `act:${item.id}`, x, y, w: cellW, h: cellH, label: item.label, lit: litLook }, (hot) => {
        g.beginPath();
        g.roundRect(x, y, cellW, cellH, [18, 18, 6, 6]);
        g.fillStyle = hot ? `rgba(${tone}, 0.3)` : item.tone === "primary" || item.on ? `rgba(${tone}, 0.16)` : `rgba(${I}, 0.05)`;
        g.fill();
        g.lineWidth = hot ? 4 : 2;
        g.strokeStyle = hot || item.on ? `rgba(${tone}, 1)` : `rgba(${tone}, 0.4)`;
        g.stroke();
        // The sill: lit when the thing is on.
        g.fillStyle = item.on ? `rgb(${tone})` : `rgba(${I}, 0.22)`;
        g.fillRect(x + 14, y + cellH - 7, cellW - 28, 3);
        g.strokeStyle = g.fillStyle = item.tone === "warn" ? t.warn : item.on ? t.accent : t.ink;
        const iconSize = Math.max(0, Math.min(40, cellH - 30));
        if (item.kind === "swatch") {
          // A choice of colour: a small doorway lit in it.
          const ink = g.fillStyle;
          g.fillStyle = item.color;
          g.beginPath();
          g.roundRect(x + 20, y + (cellH - iconSize) / 2 - 4, iconSize * 0.78, iconSize, [iconSize * 0.39, iconSize * 0.39, 4, 4]);
          g.fill();
          g.fillStyle = ink;
        } else if (item.kind === "tile") {
          // A thing with a picture of itself: its picture where another button has an icon. Faint (not theirs yet):
          // drawn at half strength. A mark: a small icon at the picture's corner, in the accent.
          const picture = item.picture?.();
          const side = Math.min(cellH - 12, iconSize * 1.5);
          const was = g.globalAlpha;
          if (item.faint) g.globalAlpha = was * 0.45;
          if (picture) g.drawImage(picture, x + 10, y + (cellH - side) / 2 - 2, side, side);
          else strokeIcon(g, item.icon, x + 18, y + (cellH - iconSize) / 2 - 2, iconSize);
          g.globalAlpha = was;
          if (item.mark) {
            const ink = g.strokeStyle;
            g.strokeStyle = t.accent;
            strokeIcon(g, item.mark, x + 10 + side - 22, y + (cellH - side) / 2, 22);
            g.strokeStyle = ink;
          }
        } else strokeIcon(g, item.icon, x + 18, y + (cellH - iconSize) / 2 - 2, iconSize);
        const size = Math.round((cols === 3 || cellW < 240 ? 23 : 28) * k);
        g.font = `600 ${size}px ${SANS}`;
        g.textBaseline = "middle";
        // Two lines before any word is cut short: a button's words are how it is found.
        const words = wrap(g, item.label, cellW - iconSize - 44, cellH >= size * 2 + 12 ? 2 : 1);
        words.forEach((line, n) => g.fillText(line, x + iconSize + 30, y + cellH / 2 - 2 + (n - (words.length - 1) / 2) * (size + 3)));
        g.textBaseline = "alphabetic";
      });
    });

    if (lines.length) {
      let y = contentTop + layout.height + 4;
      for (const i of pages[linePage] ?? []) {
        const item = lines[i]!;
        g.strokeStyle = g.fillStyle = item.on ? t.accent : `rgba(${I}, 0.4)`;
        strokeIcon(g, item.icon, left + 4, y + 2, Math.min(28, lineSize + 6));
        g.fillStyle = item.on ? t.ink : `rgba(${I}, 0.6)`;
        g.font = `${item.on ? 500 : 400} ${lineSize}px ${SANS}`;
        laid[i]!.forEach((line, n) => g.fillText(line, left + 40, y + lineSize + n * (lineSize + 4)));
        y += lineHs[i]!;
      }
    }

    // What a visitor should know before using this section.
    if (noteLines.length) {
      const y = H - noteH - 14;
      g.fillStyle = `rgba(${A}, 0.7)`;
      g.fillRect(left, y, 3, noteH - 8);
      g.font = `400 ${Math.round(24 * k)}px ${SANS}`;
      g.fillStyle = `rgba(${I}, 0.82)`;
      noteLines.forEach((line, i) => g.fillText(line, left + 16, y + 24 + i * 32));
    }

    opts.painted?.(t);
    return true;
  };

  return {
    get section() {
      return section;
    },
    set section(next) {
      section = next;
    },
    get aimed() {
      return aimed;
    },
    set aimed(next) {
      aimed = next;
    },
    get regions() {
      return regions;
    },
    get linePage() {
      return linePage;
    },
    get linePages() {
      return linePages;
    },
    turnPage() {
      linePage = (linePage + 1) % Math.max(1, linePages);
    },
    paint,
    again() {
      painted = "";
    },
  };
}
