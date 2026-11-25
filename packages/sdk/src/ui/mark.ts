import { DEFAULT_THEME, rgb } from "./theme.js";

/**
 * The mark: a lit doorway, an arch filled with the world's accent fading downward, glowing, standing on a short
 * light line, in a rounded glass tile. The menu's button everywhere the kit draws one (the owner, 2026-11-24: "can
 * we use this menu icon everywhere? With no text?"). Its shape is here and nowhere else: the flat menu's styles,
 * the headset's button and any picture of it are made from these numbers, so none can drift from the others.
 *
 * In CSS pixels, within the tile. Not part of the package's entries.
 */
export const MARK = {
  /** The tile: its size, the round of its top corners and of its bottom ones, and its edge. */
  tile: { w: 44, h: 48, top: 22, bottom: 8, edge: 1 },
  /** The arch: its size, where it stands in the tile, the round of its top (a half circle) and of its foot. */
  arch: { w: 18, h: 24, x: 13, y: 11, top: 9, bottom: 2 },
  /** The line it stands on: how far it reaches past the arch on each side, how thick, and how far below its foot. */
  sill: { over: 3, h: 2, below: 3 },
  /** How far the arch's glow reaches. */
  glow: 14,
  /** The arch's fill: the accent at the top, and at the foot. */
  fill: { top: 0.95, foot: 0.25 },
  /** The glow's strength, the tile's glass, and its edge when it isn't lit. */
  glowAlpha: 0.55,
  glass: 0.7,
  edgeAlpha: 0.34,
} as const;

/** Where the line under the arch is, within the tile: x, y, width, height. */
export const sillBox = (): [number, number, number, number] => {
  const { arch, sill } = MARK;
  return [arch.x - sill.over, arch.y + arch.h + sill.below - sill.h, arch.w + sill.over * 2, sill.h];
};

/** A rectangle with one round for its top corners and another for its bottom ones, as a path. */
const roundedPath = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: number, bottom: number) => {
  c.beginPath();
  c.moveTo(x + top, y);
  c.lineTo(x + w - top, y);
  c.arcTo(x + w, y, x + w, y + top, top);
  c.lineTo(x + w, y + h - bottom);
  c.arcTo(x + w, y + h, x + w - bottom, y + h, bottom);
  c.lineTo(x + bottom, y + h);
  c.arcTo(x, y + h, x, y + h - bottom, bottom);
  c.lineTo(x, y + top);
  c.arcTo(x, y, x + top, y, top);
  c.closePath();
};


/**
 * Paint the mark onto a canvas, its tile's top left at (x, y), `scale` canvas pixels to a CSS pixel. `lit` is the
 * tile as it is hovered or while the menu is up: its edge in the accent. `glass` is how much the tile's glass
 * covers (the flat menu's is 0.7 over a blur; where nothing blurs behind it, more).
 */
export function paintMark(c: CanvasRenderingContext2D, o: { x: number; y: number; scale: number; accent: string; ink: string; glass: string; lit?: boolean; glassAlpha?: number; tile?: boolean }): void {
  const s = o.scale;
  const { tile, arch } = MARK;
  const accent = rgb(o.accent);
  if (o.tile !== false) {
    roundedPath(c, o.x, o.y, tile.w * s, tile.h * s, tile.top * s, tile.bottom * s);
    c.fillStyle = `rgba(${rgb(o.glass)}, ${o.glassAlpha ?? MARK.glass})`;
    c.fill();
    c.lineWidth = Math.max(1, tile.edge * s);
    c.strokeStyle = o.lit ? `rgb(${accent})` : `rgba(${accent}, ${MARK.edgeAlpha})`;
    c.stroke();
  }
  const ax = o.x + arch.x * s;
  const ay = o.y + arch.y * s;
  const fill = c.createLinearGradient(0, ay, 0, ay + arch.h * s);
  fill.addColorStop(0, `rgba(${accent}, ${MARK.fill.top})`);
  fill.addColorStop(1, `rgba(${accent}, ${MARK.fill.foot})`);
  c.save();
  c.shadowColor = `rgba(${accent}, ${MARK.glowAlpha})`;
  c.shadowBlur = MARK.glow * s;
  roundedPath(c, ax, ay, arch.w * s, arch.h * s, arch.top * s, arch.bottom * s);
  c.fillStyle = fill;
  c.fill();
  c.restore();
  const [lx, ly, lw, lh] = sillBox();
  roundedPath(c, o.x + lx * s, o.y + ly * s, lw * s, lh * s, (lh / 2) * s, (lh / 2) * s);
  c.fillStyle = o.ink;
  c.fill();
}

/** "#rrggbb", or the default where it isn't one: nothing else is put into the picture. */
const colourOr = (value: string | undefined, fallback: string): string => (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback);

/**
 * The mark as a picture: an SVG, from the same numbers the menu's button and the headset's are drawn from. For a
 * page's icon, an app's icon, or anything else that shows the mark; nobody draws their own copy.
 *
 *   markSvg()                          // the tile and the mark, in the kit's own colours
 *   markSvg({ accent: "#4fd08b" })     // in a place's own colour
 *   markSvg({ tile: false })           // the doorway on its line alone
 *
 * Colours are "#rrggbb"; anything else is the kit's own. The tile's glass here is solid where nothing blurs behind it.
 */
export function markSvg(o: { accent?: string; ink?: string; glass?: string; tile?: boolean } = {}): string {
  const accent = colourOr(o.accent, DEFAULT_THEME.accent);
  const ink = colourOr(o.ink, DEFAULT_THEME.ink);
  const glass = colourOr(o.glass, DEFAULT_THEME.glass);
  const { tile, arch, sill } = MARK;
  const tiled = o.tile !== false;
  // Room around it for the glow, and the picture's box: the tile's, or the doorway's with its line.
  const pad = MARK.glow;
  const box = tiled ? { x: 0, y: 0, w: tile.w, h: tile.h } : { x: arch.x - sill.over, y: arch.y, w: arch.w + sill.over * 2, h: arch.h + sill.below };
  const vx = box.x - (tiled ? 0 : pad);
  const vy = box.y - (tiled ? 0 : pad);
  const vw = box.w + (tiled ? 0 : pad * 2);
  const vh = box.h + (tiled ? 0 : pad * 2);
  const rounded = (x: number, y: number, w: number, h: number, top: number, bottom: number) =>
    `M${x + top} ${y}H${x + w - top}A${top} ${top} 0 0 1 ${x + w} ${y + top}V${y + h - bottom}A${bottom} ${bottom} 0 0 1 ${x + w - bottom} ${y + h}H${x + bottom}A${bottom} ${bottom} 0 0 1 ${x} ${y + h - bottom}V${y + top}A${top} ${top} 0 0 1 ${x + top} ${y}Z`;
  const [lx, ly, lw, lh] = sillBox();
  const half = tile.edge / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`,
    `<defs><linearGradient id="nswp-mark-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="${MARK.fill.top}"/><stop offset="1" stop-color="${accent}" stop-opacity="${MARK.fill.foot}"/></linearGradient>`,
    `<filter id="nswp-mark-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${MARK.glow / 2}"/></filter></defs>`,
    tiled ? `<path d="${rounded(half, half, tile.w - tile.edge, tile.h - tile.edge, tile.top - half, tile.bottom - half)}" fill="${glass}" stroke="${accent}" stroke-opacity="${MARK.edgeAlpha}" stroke-width="${tile.edge}"/>` : "",
    `<path d="${rounded(arch.x, arch.y, arch.w, arch.h, arch.top, arch.bottom)}" fill="${accent}" opacity="${MARK.glowAlpha}" filter="url(#nswp-mark-glow)"/>`,
    `<path d="${rounded(arch.x, arch.y, arch.w, arch.h, arch.top, arch.bottom)}" fill="url(#nswp-mark-fill)"/>`,
    `<path d="${rounded(lx, ly, lw, lh, lh / 2, lh / 2)}" fill="${ink}"/>`,
    `</svg>`,
  ].join("");
}
