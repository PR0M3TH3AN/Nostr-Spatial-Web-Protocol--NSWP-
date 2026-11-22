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
