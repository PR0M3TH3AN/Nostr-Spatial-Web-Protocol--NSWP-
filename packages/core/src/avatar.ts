/**
 * Avatars (spec §4.2): how a person looks, as data any world can draw.
 *
 * A look is a handful of choices from short closed lists, plus three colours.
 * It is never a file: nothing is fetched to draw it, it can't carry an image,
 * and it can't overload a device. Every key has a look before its owner has
 * chosen anything (`generatedLook`), so people are different from each other
 * from the start, and the same person is the same in every world.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { AVATAR_KIND } from "./constants.js";
import { getTags, getTagValue, nowSeconds, type EventTemplate, type NostrEvent } from "./event.js";
import { Collector, isPlainObject, type Result } from "./result.js";

/** The closed lists a look is chosen from. The first of each is what an unknown value falls back to. */
export const LOOK_PARTS = {
  build: ["medium", "slight", "broad"],
  head: ["round", "square", "tall", "wedge", "flat", "faceted"],
  face: ["band", "split", "dots", "tee", "slit", "wide"],
  accessory: ["none", "antenna", "halo", "hat", "crest", "fins"],
  body: ["cloak", "coat", "plate", "robe"],
  shoulders: ["none", "pads", "mantle", "collar"],
  pattern: ["plain", "halves", "stripe", "bands", "yoke"],
  finish: ["matte", "gloss", "sheen"],
} as const;

export type LookPart = keyof typeof LOOK_PARTS;
export const LOOK_COLORS = ["color", "accent", "light"] as const;
export type LookColor = (typeof LOOK_COLORS)[number];

export interface Look {
  /** The main colour, as `#rrggbb`. */
  color: string;
  /** The second colour: trim, and the other half of a pattern. */
  accent: string;
  /** The colour of everything that glows: the face, the seams, the hands. */
  light: string;
  build: (typeof LOOK_PARTS.build)[number];
  head: (typeof LOOK_PARTS.head)[number];
  face: (typeof LOOK_PARTS.face)[number];
  accessory: (typeof LOOK_PARTS.accessory)[number];
  body: (typeof LOOK_PARTS.body)[number];
  shoulders: (typeof LOOK_PARTS.shoulders)[number];
  pattern: (typeof LOOK_PARTS.pattern)[number];
  finish: (typeof LOOK_PARTS.finish)[number];
  /**
   * What the mark on the chest is drawn from: fifteen bits, as four hex
   * digits. It is not a choice. It comes from the key (or, for a guest, from
   * the seed their lobby keeps), so it stays the same whatever else changes.
   */
  mark: string;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/;
const MARK = /^[0-7][0-9a-f]{3}$/;

function hsl(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * The look a key has before its owner chooses one. `seed` is a public key in
 * hex, or any string a lobby keeps for a guest. The same seed always gives
 * the same look, in every implementation: the bytes of SHA-256(seed) pick
 * each part in the order below.
 */
export function generatedLook(seed: string): Look {
  const b = sha256(utf8ToBytes(seed.toLowerCase()));
  const pick = <T>(list: readonly T[], i: number): T => list[b[i]! % list.length]!;
  const hue = (b[0]! * 256 + b[1]!) / 65536;
  // The accent sits beside the main colour or across from it; the light is bright and a little apart from both.
  const accentHue = (hue + [0.08, 0.5, 0.92, 0.33][b[2]! % 4]!) % 1;
  const lightHue = (hue + [0, 0.12, 0.5, 0.88][b[3]! % 4]!) % 1;
  return {
    color: hsl(hue, 0.42 + (b[4]! % 4) * 0.08, 0.26 + (b[5]! % 4) * 0.04),
    accent: hsl(accentHue, 0.3 + (b[6]! % 4) * 0.1, 0.42 + (b[7]! % 4) * 0.06),
    light: hsl(lightHue, 0.9, 0.62),
    build: pick(LOOK_PARTS.build, 8),
    head: pick(LOOK_PARTS.head, 9),
    face: pick(LOOK_PARTS.face, 10),
    accessory: pick(LOOK_PARTS.accessory, 11),
    body: pick(LOOK_PARTS.body, 12),
    shoulders: pick(LOOK_PARTS.shoulders, 13),
    pattern: pick(LOOK_PARTS.pattern, 14),
    finish: pick(LOOK_PARTS.finish, 15),
    mark: markFor(seed),
  };
}

/** The mark for a key or seed: fifteen bits of SHA-256(seed), as four hex digits. */
export function markFor(seed: string): string {
  const b = sha256(utf8ToBytes(seed.toLowerCase()));
  return bytesToHex(new Uint8Array([b[30]! & 0x7f, b[31]!]));
}

/**
 * The mark as a picture: five rows of five cells, mirrored left to right.
 * `true` is a lit cell. Every renderer draws the same grid from the same mark.
 */
export function markGrid(mark: string): boolean[][] {
  const bits = parseInt(MARK.test(mark) ? mark : "0000", 16);
  return Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => {
      const c = col < 3 ? col : 4 - col;
      return ((bits >> (row * 3 + c)) & 1) === 1;
    }),
  );
}

/** Apply someone's choices on top of the look their key gives them. Anything unknown or missing keeps the generated value. */
export function applyChoices(base: Look, choices: Record<string, unknown>): { look: Look; warnings: string[] } {
  const look: Look = { ...base };
  const warnings: string[] = [];
  for (const [key, value] of Object.entries(choices)) {
    if (key === "mark") continue; // never a choice
    if ((LOOK_COLORS as readonly string[]).includes(key)) {
      if (typeof value === "string" && HEX_COLOR.test(value.toLowerCase())) look[key as LookColor] = value.toLowerCase();
      else warnings.push(key);
    } else if (key in LOOK_PARTS) {
      const list = LOOK_PARTS[key as LookPart] as readonly string[];
      if (typeof value === "string" && list.includes(value)) (look as unknown as Record<string, string>)[key] = value;
      else warnings.push(key);
    }
  }
  return { look, warnings };
}

/** A look as `["simple", name, value]` tags, for an avatar event. The mark is left out: a reader works it out from the key. */
export function lookToTags(look: Look): string[][] {
  return [...LOOK_COLORS, ...(Object.keys(LOOK_PARTS) as LookPart[])].map((key) => ["simple", key, look[key]]);
}

/** Read a look from an avatar event's tags, on top of what `seed` (the author's key) generates. */
export function lookFromTags(tags: string[][], seed: string): { look: Look; warnings: string[] } {
  const choices: Record<string, unknown> = {};
  for (const t of tags) if (t[0] === "simple" && typeof t[1] === "string") choices[t[1]] = t[2];
  return applyChoices(generatedLook(seed), choices);
}

/**
 * A look small enough to travel in an arrival context or a room's hello: a
 * short JSON object. It carries a seed, so a guest's mark and unchosen parts
 * come out the same in every world without anything being published.
 */
export function encodeLook(look: Look, seed: string): string {
  const base = generatedLook(seed);
  // Only what differs from what the seed gives is written.
  const out: Record<string, string> = { s: seed };
  for (const key of [...LOOK_COLORS, ...(Object.keys(LOOK_PARTS) as LookPart[])]) if (look[key] !== base[key]) out[key] = look[key];
  return JSON.stringify(out);
}

export const LOOK_LIMITS = { chars: 600, seedChars: 64 } as const;

export function decodeLook(text: string): Result<{ look: Look; seed: string }> {
  const c = new Collector();
  if (text.length > LOOK_LIMITS.chars) {
    c.error("look_too_large", "", "A look is at most 600 characters.");
    return c.result({ look: generatedLook(""), seed: "" });
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    c.error("invalid_json", "", "A look must be a JSON object.");
    return c.result({ look: generatedLook(""), seed: "" });
  }
  if (!isPlainObject(json) || typeof json.s !== "string" || !/^[0-9a-zA-Z_-]{8,64}$/.test(json.s)) {
    c.error("missing_field", "s", "A look needs a seed: 8 to 64 letters or digits.");
    return c.result({ look: generatedLook(""), seed: "" });
  }
  const { s: seed, ...choices } = json;
  const { look, warnings } = applyChoices(generatedLook(seed), choices);
  for (const w of warnings) c.warn("unknown_value", w, `Ignoring an unknown value for "${w}".`);
  return c.result({ look, seed });
}

export interface AvatarInput {
  /** The avatar's slot. Most people have one: `default`. */
  d?: string;
  title?: string;
  look: Look;
  createdAt?: number;
}

/** An avatar event (kind 37301) carrying the simple tier. */
export function buildAvatarEvent(a: AvatarInput): EventTemplate {
  const tags: string[][] = [["d", a.d ?? "default"]];
  if (a.title) tags.push(["title", a.title]);
  tags.push(...lookToTags(a.look), ["alt", `Avatar preference${a.title ? ` for ${a.title}` : ""}`]);
  return { kind: AVATAR_KIND, created_at: a.createdAt ?? nowSeconds(), tags, content: "" };
}

/** Read the simple tier of an avatar event. The author's key decides the mark and anything they didn't choose. */
export function parseAvatarEvent(event: Pick<NostrEvent, "kind" | "tags" | "pubkey">): Result<{ d: string; title?: string; look: Look }> {
  const c = new Collector();
  if (event.kind !== AVATAR_KIND) c.error("wrong_kind", "kind", `An avatar event has kind ${AVATAR_KIND}.`);
  const d = getTagValue(event, "d");
  if (!d) c.error("missing_tag", "tags.d", "An avatar event needs a d tag.");
  const { look, warnings } = lookFromTags(getTags(event, "simple"), event.pubkey);
  for (const w of warnings) c.warn("unknown_value", `tags.simple.${w}`, `Ignoring an unknown value for "${w}".`);
  const title = getTagValue(event, "title");
  return c.result({ d: d ?? "default", ...(title ? { title } : {}), look });
}
