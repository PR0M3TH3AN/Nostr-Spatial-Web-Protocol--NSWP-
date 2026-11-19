/**
 * The look of the controls kit: a handful of values every part of it draws
 * from, on a flat screen and in a headset alike.
 *
 * Three sources, weakest first: the kit's defaults, what a world asks for
 * (its own accent, say), and what the visitor chose. The visitor wins, because
 * the controls are theirs to read. Their choice is kept in this browser, for
 * this site. The size of their text, whether things move and which wrist
 * also go with them to the next world (settings.ts); the colours don't,
 * since those belong to each place.
 */
export interface UiTheme {
  /** The light the controls are drawn in. */
  accent: string;
  /** Text. */
  ink: string;
  /** What panels are made of. Drawn part see-through. */
  glass: string;
  /** For things that end or leave. */
  warn: string;
  /** Whether things move when they open and close. */
  motion: boolean;
  /** Size of text and controls, 1 being normal. */
  scale: number;
  /** Which wrist carries the console in a headset, where a hand is tracked. */
  wrist: "left" | "right" | "off";
}

export const DEFAULT_THEME: UiTheme = { accent: "#ffb65c", ink: "#eef5fb", glass: "#0a1018", warn: "#ff7566", motion: true, scale: 1, wrist: "left" };

/** Ready-made accents a visitor can pick from. The first is the default. */
export const UI_PRESETS: { id: string; label: string; accent: string }[] = [
  { id: "lantern", label: "Lantern", accent: "#ffb65c" },
  { id: "ion", label: "Ion", accent: "#62d9ff" },
  { id: "verdant", label: "Verdant", accent: "#4fd08b" },
  { id: "rose", label: "Rose", accent: "#ff8fb1" },
  { id: "paper", label: "Paper", accent: "#f2f3f6" },
];

const KEY = "nswp:ui";
const HEX = /^#[0-9a-f]{6}$/i;

/** Keep only values that are what they claim to be: this is read back from storage, and from a world's own settings. */
export function cleanTheme(input: unknown): Partial<UiTheme> {
  const out: Partial<UiTheme> = {};
  if (!input || typeof input !== "object") return out;
  const t = input as Record<string, unknown>;
  for (const k of ["accent", "ink", "glass", "warn"] as const) if (typeof t[k] === "string" && HEX.test(t[k])) out[k] = t[k].toLowerCase();
  if (typeof t.motion === "boolean") out.motion = t.motion;
  if (typeof t.scale === "number" && Number.isFinite(t.scale)) out.scale = Math.min(1.5, Math.max(0.85, t.scale));
  if (t.wrist === "left" || t.wrist === "right" || t.wrist === "off") out.wrist = t.wrist;
  return out;
}

export function loadVisitorTheme(): Partial<UiTheme> {
  try {
    return cleanTheme(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "{}"));
  } catch {
    return {};
  }
}

export function saveVisitorTheme(theme: Partial<UiTheme>): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(cleanTheme(theme)));
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
}

/** Someone who has asked their device for less motion gets less, unless they say otherwise here. */
function prefersStill(): boolean {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

export function resolveTheme(world: Partial<UiTheme> = {}, visitor: Partial<UiTheme> = loadVisitorTheme()): UiTheme {
  return { ...DEFAULT_THEME, ...(prefersStill() ? { motion: false } : {}), ...cleanTheme(world), ...cleanTheme(visitor) };
}

/** "#rrggbb" as "r, g, b", for building see-through colours. */
export function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
