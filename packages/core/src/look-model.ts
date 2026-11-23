/**
 * A model of your own, as your look (protocol/05-looks.md, "A model of your own").
 *
 * A signed-in person may wear a 3D file of their own: a VRM, or a plain GLB. It is named by its hash in their look
 * note (kind 37301, its `model` tag), and fetched by that hash from the file hosts on each viewer's own list, as an
 * item's files are (protocol/17-items.md, "Where a file is fetched from"). It is read and counted by `readGlb`
 * against `LOOK_BUDGET`, lower than an item's since a room holds several people at once, before anything draws it.
 * Nothing in a look ever runs. Its wearer's mark is drawn above it by the kit, never by the file.
 */
import { AVATAR_KIND } from "./constants.js";
import type { NostrEvent } from "./event.js";
import type { ModelBudget } from "./glb.js";

/** The most a look's model may be, whatever draws it. A world may lower it in its manifest, never raise it. */
export const LOOK_BUDGET = {
  /** The most a look's file may weigh, in bytes. */
  bytes: 1_000_000,
  triangles: 12_000,
  meshes: 24,
  materials: 8,
  /** The longest side of any picture its surfaces use, in pixels. */
  texture: 1024,
  /** The most joints its skeleton may have. */
  joints: 128,
  /** The most morph targets (its faces' shapes) any one of its meshes may have. */
  morphs: 64,
  /**
   * VRM's own extensions, which a VRM may say it requires: read for its skeleton and expressions only, its
   * materials drawn as the kit's standard material in their base colour. Anything else it requires refuses it.
   * Spring bones (`VRMC_springBone`) are not among them: hair and cloth that swing are physics the kit would run
   * for a stranger's file, and are left out in this first round (decided by the owner, 2026-11-22).
   */
  extensions: ["VRMC_vrm", "VRMC_materials_mtoon", "KHR_materials_unlit"],
} as const satisfies ModelBudget;

/**
 * How tall a person's own model may be drawn, in metres: half to one and a half times standard (decided by the
 * owner, 2026-11-22). A world may narrow it. Height changes only the drawing: where the eyes are, reach, walking,
 * personal space and the places to arrive stay the kit's own.
 */
export const LOOK_HEIGHT = { least: 0.85, standard: 1.7, most: 2.55 } as const;

/** The most people's own models drawn at once, the nearest first: everyone beyond is drawn as their simple look. */
export const LOOK_MODELS_AT_ONCE = 8;

/** The most a signed look note may be, in bytes, as one member hands it to the others in a room (NSWP-06). */
export const LOOK_NOTE_LIMIT = 8000;

/** The formats a look's model may be. */
export const LOOK_FORMATS = ["vrm", "glb"] as const;
export type LookFormat = (typeof LOOK_FORMATS)[number];

/** A look's model, as its note says it: the file by its hash (the url only a hint), its format, and how tall. */
export interface LookModel {
  url: string;
  format: LookFormat;
  sha256: string;
  /** How tall it is drawn, in metres: what the note asks, held within `LOOK_HEIGHT`. */
  height: number;
  /** A picture of it, for panels and cards, checked by its hash like the file. */
  thumb?: { url: string; sha256: string };
}

const HEX64 = /^[0-9a-f]{64}$/;
const URL_MOST = 500;

/** An https address of no great length, with no name or password in it. Null for anything else. */
function cleanUrl(input: unknown): string | null {
  if (typeof input !== "string" || input.length > URL_MOST) return null;
  try {
    const u = new URL(input);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * How tall a person's model is drawn: what they asked, held within the kit's limits and, where the world gives
 * them (its manifest's `avatar.height`), within the world's too. A world's limits only narrow the kit's: where they
 * would leave nothing, the kit's own are used. Anything that isn't a height is the standard one.
 */
export function lookHeight(asked: unknown, world?: readonly [number, number]): number {
  let least: number = LOOK_HEIGHT.least;
  let most: number = LOOK_HEIGHT.most;
  if (world && Number.isFinite(world[0]) && Number.isFinite(world[1])) {
    const a = Math.max(least, world[0]);
    const b = Math.min(most, world[1]);
    if (a <= b) [least, most] = [a, b];
  }
  const n = typeof asked === "string" ? Number(asked) : asked;
  const h = typeof n === "number" && Number.isFinite(n) && n > 0 ? n : LOOK_HEIGHT.standard;
  return Math.round(Math.min(most, Math.max(least, h)) * 1000) / 1000;
}

/**
 * The model a look note names, or null where it names none that may be worn: a note of another kind, no `model`
 * tag, a format other than `vrm` or `glb`, an address that isn't https, or no real hash. A note with no model is a
 * simple look, drawn as today. Who signed it is checked by whoever took it: this reads only what it says.
 */
export function readLookModel(note: Pick<NostrEvent, "kind" | "tags">): LookModel | null {
  if (!note || note.kind !== AVATAR_KIND || !Array.isArray(note.tags)) return null;
  const tag = (name: string) => note.tags.find((t) => Array.isArray(t) && t[0] === name);
  const m = tag("model");
  const url = cleanUrl(m?.[1]);
  const format = m?.[2];
  const sha256 = m?.[3];
  if (!url || (format !== "vrm" && format !== "glb") || typeof sha256 !== "string" || !HEX64.test(sha256)) return null;
  const out: LookModel = { url, format, sha256, height: lookHeight(tag("height")?.[1]) };
  const t = tag("thumb");
  const thumbUrl = cleanUrl(t?.[1]);
  if (thumbUrl && typeof t?.[2] === "string" && HEX64.test(t[2])) out.thumb = { url: thumbUrl, sha256: t[2] };
  return out;
}

const u32 = (b: Uint8Array, at: number): number => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

/** The JSON part of a GLB, as it was written, or null for anything that isn't one. Only for a file `readGlb` passed. */
export function glbJson(bytes: Uint8Array): Record<string, unknown> | null {
  if (bytes.length < 20 || u32(bytes, 0) !== 0x46546c67 || u32(bytes, 16) !== 0x4e4f534a) return null;
  const n = u32(bytes, 12);
  if (20 + n > bytes.length) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + n))) as unknown;
    return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * A look's file as an engine's own reader is handed it, once `readGlb` has passed it against `LOOK_BUDGET`: the
 * same file with its `extensionsRequired` emptied. An engine's reader refuses a file that requires what it doesn't
 * know, and VRM's own extensions are ones the kit has already read for what it uses of them; the rest of each is
 * left for the engine to ignore. Anything else is unchanged, byte for byte. Null for a file that isn't a GLB.
 */
export function withoutRequired(bytes: Uint8Array): Uint8Array | null {
  const json = glbJson(bytes);
  if (!json) return null;
  if (!Array.isArray(json.extensionsRequired) || json.extensionsRequired.length === 0) return bytes;
  delete json.extensionsRequired;
  const text = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(text.length + ((4 - (text.length % 4)) % 4)).fill(0x20);
  padded.set(text);
  const rest = bytes.subarray(20 + u32(bytes, 12));
  const out = new Uint8Array(20 + padded.length + rest.length);
  out.set(bytes.subarray(0, 20));
  out.set(padded, 20);
  out.set(rest, 20 + padded.length);
  const v = new DataView(out.buffer);
  v.setUint32(8, out.length, true);
  v.setUint32(12, padded.length, true);
  return out;
}

/**
 * Which way a look's model faces as its file is written: `+z` for a glTF and a VRM 1.0 (glTF's own forward),
 * `-z` for a VRM 0.x (its own extension, `VRM`, faces the other way). The kit draws everyone facing -z.
 */
export function lookFacing(json: Record<string, unknown>): "+z" | "-z" {
  const ext = json.extensions as Record<string, unknown> | undefined;
  return ext && typeof ext === "object" && "VRM" in ext && !("VRMC_vrm" in ext) ? "-z" : "+z";
}
