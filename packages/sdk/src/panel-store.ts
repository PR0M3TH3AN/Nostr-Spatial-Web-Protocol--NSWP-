/**
 * What a panel is, as data: what it shows and where it hangs. No three.js
 * here, so the rules about what may be kept are tested like arithmetic.
 *
 * A panel shows one of a few things the kit knows how to draw: a note, a
 * picture, a video. It is never a web page. A page can't be drawn into a 3D
 * scene by another page, and this kit doesn't pretend otherwise
 * (browser/spec.md).
 */

export type V3 = [number, number, number];

/** Where a panel hangs, in the world's own metres, and how large it is. */
export interface PanelPlace {
  position: V3;
  /** Which way it faces, in degrees round the vertical: 0 faces +Z. */
  yaw: number;
  /** How far it leans back or forward, in degrees. */
  pitch: number;
  /** Its width in metres. Its height follows from what it shows. */
  width: number;
}

/**
 * What a panel shows, in the form that can be kept. `src` is an address the
 * page is allowed to load, or `kept:<name>` for a file the visitor chose from
 * their own device, which the kit holds in this browser.
 */
export type PanelSource = { kind: "note"; title: string; text: string } | { kind: "picture"; title: string; src: string } | { kind: "video"; title: string; src: string };

export interface PanelRecord {
  id: string;
  source: PanelSource;
  place: PanelPlace;
}

export const PANEL_LIMITS = {
  count: 24,
  titleChars: 80,
  noteChars: 4000,
  srcChars: 2048,
  minWidth: 0.3,
  maxWidth: 3,
  /** A panel is never kept further from the middle of a world than this, in metres. */
  reach: 500,
  /** The largest file of the visitor's own that is kept, in bytes. */
  fileBytes: 64 * 1024 * 1024,
} as const;

const ID = /^[a-z0-9-]{4,40}$/;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** One line, with nothing that hides or reorders text. */
function tidy(text: unknown, max: number, lines = false): string {
  if (typeof text !== "string") return "";
  const cleaned = text.replace(lines ? /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g : /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g, " ");
  return [...(lines ? cleaned : cleaned.replace(/\s+/g, " ").trim())].slice(0, max).join("");
}

export function cleanPlace(input: unknown): PanelPlace | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Partial<PanelPlace>;
  const at = p.position;
  if (!Array.isArray(at) || at.length !== 3 || !at.every(finite) || at.some((n) => Math.abs(n) > PANEL_LIMITS.reach)) return null;
  if (!finite(p.width)) return null;
  return {
    position: [at[0]!, at[1]!, at[2]!],
    yaw: finite(p.yaw) ? ((p.yaw % 360) + 360) % 360 : 0,
    pitch: finite(p.pitch) ? clamp(p.pitch, -60, 60) : 0,
    width: clamp(p.width, PANEL_LIMITS.minWidth, PANEL_LIMITS.maxWidth),
  };
}

export function cleanSource(input: unknown): PanelSource | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Record<string, unknown>;
  const title = tidy(s.title, PANEL_LIMITS.titleChars);
  if (s.kind === "note") {
    const text = tidy(s.text, PANEL_LIMITS.noteChars, true);
    return text.trim() || title ? { kind: "note", title, text } : null;
  }
  if (s.kind === "picture" || s.kind === "video") {
    if (typeof s.src !== "string" || s.src.length === 0 || s.src.length > PANEL_LIMITS.srcChars) return null;
    // An address to load, or a file kept here. Never a script, and never a page.
    if (!/^(kept:[a-z0-9-]{4,40}|https:\/\/|\/|\.\/|blob:)/.test(s.src)) return null;
    return { kind: s.kind, title, src: s.src };
  }
  return null;
}

/** Read what was kept, dropping anything that isn't what it claims to be. This comes back from storage. */
export function cleanRecords(input: unknown): PanelRecord[] {
  if (!Array.isArray(input)) return [];
  const out: PanelRecord[] = [];
  for (const item of input as Partial<PanelRecord>[]) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !ID.test(item.id) || out.some((r) => r.id === item.id)) continue;
    const source = cleanSource(item.source);
    const place = cleanPlace(item.place);
    // A page's own temporary address means nothing next visit.
    if (!source || !place || ("src" in source && source.src.startsWith("blob:"))) continue;
    out.push({ id: item.id, source, place });
    if (out.length === PANEL_LIMITS.count) break;
  }
  return out;
}

/** The way a panel at `at` should turn to face a head at `head`: its yaw and pitch, in degrees. */
export function facing(at: V3, head: V3): { yaw: number; pitch: number } {
  const [dx, dy, dz] = [head[0] - at[0], head[1] - at[1], head[2] - at[2]];
  const flat = Math.hypot(dx, dz);
  if (flat < 1e-6) return { yaw: 0, pitch: 0 };
  const deg = 180 / Math.PI;
  // Lean towards the eyes, but not far: a panel overhead that lies flat is hard to read.
  return { yaw: ((Math.atan2(dx, dz) * deg) % 360 + 360) % 360, pitch: clamp(-Math.atan2(dy, flat) * deg, -35, 35) };
}

/**
 * Where a new panel goes: a comfortable reach in front of the head, at eye
 * height. Each one after the first hangs further round the visitor, to one
 * side and then the other, so none opens on top of another.
 */
export function inFront(head: V3, yawDegrees: number, already = 0, distance = 1.3): V3 {
  // Straight ahead, then 48 degrees to the right, to the left, 96 to the right, and so on round.
  const step = Math.ceil((already % 7) / 2) * 48 * (already % 2 ? -1 : 1);
  const a = ((yawDegrees + step) * Math.PI) / 180;
  // The visitor looks along -Z when their yaw is 0.
  return [head[0] - Math.sin(a) * distance, clamp(head[1] - 0.05, 0.6, 3), head[2] - Math.cos(a) * distance];
}

/** A short random name for a panel or a kept file. */
export function newId(random: () => number = Math.random): string {
  return `p-${Array.from({ length: 10 }, () => Math.floor(random() * 36).toString(36)).join("")}`;
}

/** Break a note into lines no wider than `width` units, where `measure` says how wide some text is. */
export function wrapText(text: string, width: number, measure: (s: string) => number, maxLines = 40): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= width || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
      // A word wider than the panel is cut, not let run off the edge.
      while (measure(line) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
    // One line past the limit is enough to know there was more.
    if (out.length > maxLines) break;
  }
  if (out.length > maxLines) {
    out.length = maxLines;
    out[maxLines - 1] = `${out[maxLines - 1]!.replace(/.$/u, "")}…`;
  }
  return out;
}

// ------------------------------------------------------------------- library

/** One file of the visitor's own, kept in this browser: a picture or a video they hung or took. */
export interface LibraryItem {
  id: string;
  kind: "picture" | "video";
  title: string;
  bytes: number;
  /** Seconds since 1970. */
  addedAt: number;
  /** A small picture of it, as a data address, or "" when none could be made. */
  thumb: string;
}

export const LIBRARY_LIMITS = { count: 60, thumbChars: 60_000 } as const;

/** Read the list of kept files back from storage, dropping anything that isn't what it claims to be. Newest first. */
export function cleanLibrary(input: unknown): LibraryItem[] {
  if (!Array.isArray(input)) return [];
  const out: LibraryItem[] = [];
  for (const item of input as Partial<LibraryItem>[]) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !ID.test(item.id) || out.some((x) => x.id === item.id)) continue;
    if (item.kind !== "picture" && item.kind !== "video") continue;
    // A thumbnail is a small picture and nothing else: never an address to fetch.
    const thumb = typeof item.thumb === "string" && item.thumb.length <= LIBRARY_LIMITS.thumbChars && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(item.thumb) ? item.thumb : "";
    out.push({ id: item.id, kind: item.kind, title: tidy(item.title, PANEL_LIMITS.titleChars), bytes: finite(item.bytes) && item.bytes >= 0 ? item.bytes : 0, addedAt: finite(item.addedAt) ? item.addedAt : 0, thumb });
  }
  return out.sort((a, b) => b.addedAt - a.addedAt).slice(0, LIBRARY_LIMITS.count);
}

/** Which items are on a page of the board, and how many pages there are. */
export function libraryPage<T>(items: T[], page: number, perPage: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const at = Math.min(pages - 1, Math.max(0, Math.floor(page)));
  return { items: items.slice(at * perPage, (at + 1) * perPage), page: at, pages };
}
