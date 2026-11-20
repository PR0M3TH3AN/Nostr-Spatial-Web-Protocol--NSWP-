/**
 * A thing that can be carried or placed: an item, as its maker describes it (protocol/17-items.md).
 *
 * An item is a signed description and the files it names: a model, a picture of it, and, where it does
 * something of its own, a script. The description says what the thing is. Where it is belongs to whoever holds
 * it, and what it does to anyone is decided by the world it is in.
 *
 * This file is the description: writing one, and reading one. It draws nothing, fetches nothing and runs
 * nothing. Every file an item names is named with its hash, so what is drawn or run is what its maker signed.
 */
import { cleanLine } from "./chat.js";
import { getTags, isHex64, type EventTemplate, type NostrEvent } from "./event.js";
import { ITEM_KIND } from "./layout.js";

export const ITEM_LIMITS = {
  title: 60,
  summary: 280,
  /** No side of an item is longer than this, in metres. A file that is larger is scaled down to fit. */
  metres: 4,
  /** How many shapes its hit box may be made of, and how many moments may have an animation. */
  colliders: 8,
  clips: 8,
  /** The longest an address may be. */
  url: 300,
  /** How many sounds of its own it may name, and how many things it may send out. */
  sounds: 12,
  sends: 4,
  /** The most letters on one of its buttons. */
  label: 16,
  /** How many of its colours a holder may choose. */
  tints: 4,
  /** The longest a trail behind a thing sent out may be, in seconds of its flight. */
  trail: 0.6,
} as const;

/** A colour, as it is written: "#rrggbb". */
export const HEX = /^#[0-9a-f]{6}$/;

/**
 * A colour of the item that whoever holds it may choose: its name (which is also the name its model's material
 * goes by, as `tint:<slot>`), what a visitor is shown it as, and the colour it is until they choose.
 */
export interface ItemTint {
  slot: string;
  label: string;
  color: string;
}

/** A sound, or a thing an item sends out, is named by a short plain word. */
const PLAIN = /^[a-z][a-z0-9-]{0,23}$/;

/**
 * A thing an item may send out: a dart, a ball. It is a shape of its own, and it says, by name, which of the
 * item's sounds go with what happens to it. What it does to a person it reaches is said apart, in `effects`.
 */
export interface ItemSend {
  name: string;
  model: ItemFile;
  /** Its box in metres. */
  size: [number, number, number];
  /** Which of the item's sounds is heard when it lands and sticks, when it drops off, and when it reaches a person. */
  lands?: string;
  drops?: string;
  strikes?: string;
  /** Which is heard by whoever sent it, when it reaches a person: the tick that goes with a hit mark. */
  tells?: string;
  /**
   * A streak of light behind it as it flies, this many seconds of its flight long. It follows the arc the thing
   * flew, in the colour of the tint that has the thing's own name, where there is one.
   */
  trail?: number;
}

/**
 * What one of an item's things asks of a person it reaches. It is words, never code: "take 1 from their health".
 * The person's own device does it, by the rules of the world they are in, and may do nothing.
 */
export interface ItemEffect {
  /** Which of the things it sends out. */
  of: string;
  state: "health";
  /** How much is taken. A whole number from 1 to 5. */
  take: number;
}

/**
 * How an item is aimed, where it has a sight to aim by: the point of the sight, in the item's own space as it is
 * drawn (metres from the middle of its base, with its front toward -z), and how much narrower the holder sees
 * while they aim (1 is no narrower; 0.45 is the narrowest a renderer goes). It asks; the renderer decides.
 */
export interface ItemAim {
  at: [number, number, number];
  zoom: number;
}

/** What its two presses are called, for the buttons a visitor is shown: "Fire", "Reload". */
export interface ItemDoes {
  use?: string;
  second?: string;
}

/**
 * What an item can be, as its description says. A closed list: a world knows what each means, and ignores one it
 * doesn't. What happens when someone holds, sits on or touches it is the world's rule.
 */
export const ITEM_BEHAVIORS = ["holdable", "sittable", "touchable", "readable", "wearable"] as const;
export type ItemBehavior = (typeof ITEM_BEHAVIORS)[number];

/** Where an item may go: placed in a room, or on one of a person's attachment points. */
export const ITEM_FITS = ["place", "head", "back", "hand-left", "hand-right", "side"] as const;
export type ItemFit = (typeof ITEM_FITS)[number];

/** The moments an item may have an animation for. */
export const ITEM_MOMENTS = ["idle", "touch", "held", "move", "use"] as const;
export type ItemMoment = (typeof ITEM_MOMENTS)[number];

export type ItemCollider =
  | { shape: "box"; centre: [number, number, number]; size: [number, number, number] }
  | { shape: "sphere"; centre: [number, number, number]; radius: number }
  | { shape: "capsule"; centre: [number, number, number]; radius: number; height: number };

/** A file an item names: where it is, and the SHA-256 its bytes must have. */
export interface ItemFile {
  url: string;
  sha256: string;
}

export interface ItemInput {
  /** Its name among its maker's items: lower-case letters, digits and hyphens. */
  d: string;
  title: string;
  summary?: string;
  /** The model: a GLB file, which every engine here reads. */
  model: ItemFile;
  thumb?: ItemFile;
  /** Its box in metres: width, height, depth. */
  size: [number, number, number];
  colliders?: ItemCollider[];
  /** Which animation in the file goes with which moment. */
  clips?: Partial<Record<ItemMoment, string>>;
  behaviors?: ItemBehavior[];
  fits?: ItemFit[];
  /** Who may use it: anyone, or only someone its maker has granted it to. */
  use?: "anyone" | "granted";
  /**
   * What it does of its own: a script, run only on the device of whoever carries it, shut away from everything
   * but its own item (protocol/17-items.md, "An item's own logic"). Named here, and run by nothing yet.
   */
  script?: ItemFile;
  /** Its own sounds, by name. Each is a small file, fetched and checked like its model. */
  sounds?: Record<string, ItemFile>;
  sends?: ItemSend[];
  effects?: ItemEffect[];
  does?: ItemDoes;
  tints?: ItemTint[];
  aim?: ItemAim;
  license?: string;
}

export interface Item extends Required<Pick<ItemInput, "d" | "title" | "model" | "size">> {
  /** Who made it. */
  maker: string;
  /** Its coordinate: `37303:<maker>:<d>`. */
  id: string;
  summary: string;
  thumb: ItemFile | null;
  colliders: ItemCollider[];
  clips: Partial<Record<ItemMoment, string>>;
  behaviors: ItemBehavior[];
  fits: ItemFit[];
  use: "anyone" | "granted";
  script: ItemFile | null;
  sounds: Record<string, ItemFile>;
  sends: ItemSend[];
  effects: ItemEffect[];
  does: ItemDoes;
  tints: ItemTint[];
  aim: ItemAim | null;
  license: string;
  /** When its maker last described it, in seconds. */
  at: number;
}

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CLIP = /^[\w .-]{1,64}$/;

/** A file's address as it may be used: `https`, of no great length, with a real hash. Null for anything else. */
function cleanFile(url: unknown, sha256: unknown): ItemFile | null {
  if (typeof url !== "string" || url.length > ITEM_LIMITS.url || !isHex64(sha256)) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return { url: u.href, sha256 };
  } catch {
    return null;
  }
}

const numbers = (text: unknown, n: number): number[] | null => {
  if (typeof text !== "string") return null;
  const parts = text.trim().split(/\s+/).map(Number);
  return parts.length === n && parts.every((x) => Number.isFinite(x) && Math.abs(x) <= 100) ? parts : null;
};
const within = (n: number) => n > 0 && n <= ITEM_LIMITS.metres;
const said = (xs: number[]) => xs.map((x) => String(Math.round(x * 1000) / 1000)).join(" ");

function colliderTag(c: ItemCollider): string[] | null {
  if (!c.centre.every((x) => Number.isFinite(x) && Math.abs(x) <= ITEM_LIMITS.metres)) return null;
  if (c.shape === "box") return c.size.every(within) ? ["collider", "box", said(c.centre), said(c.size)] : null;
  if (c.shape === "sphere") return within(c.radius) ? ["collider", "sphere", said(c.centre), said([c.radius])] : null;
  return within(c.radius) && within(c.height) ? ["collider", "capsule", said(c.centre), said([c.radius]), said([c.height])] : null;
}

function readCollider(t: string[]): ItemCollider | null {
  const centre = numbers(t[2], 3) as [number, number, number] | null;
  if (!centre || !centre.every((x) => Math.abs(x) <= ITEM_LIMITS.metres)) return null;
  if (t[1] === "box") {
    const size = numbers(t[3], 3) as [number, number, number] | null;
    return size && size.every(within) ? { shape: "box", centre, size } : null;
  }
  const radius = numbers(t[3], 1)?.[0];
  if (radius === undefined || !within(radius)) return null;
  if (t[1] === "sphere") return { shape: "sphere", centre, radius };
  const height = numbers(t[4], 1)?.[0];
  return t[1] === "capsule" && height !== undefined && within(height) ? { shape: "capsule", centre, radius, height } : null;
}

function readAim(t: string[] | undefined): ItemAim | null {
  const at = numbers(t?.[1], 3) as [number, number, number] | null;
  const zoom = Number(t?.[2]);
  return at && at.every((x) => Math.abs(x) <= ITEM_LIMITS.metres) && zoom > 0 && zoom <= 1 ? { at, zoom } : null;
}

const SEND_MOMENTS = ["lands", "drops", "strikes", "tells"] as const;

function readSend(t: string[]): ItemSend | null {
  const model = t[3] === "glb" ? cleanFile(t[2], t[4]) : null;
  const size = numbers(t[5], 3) as [number, number, number] | null;
  if (typeof t[1] !== "string" || !PLAIN.test(t[1]) || !model || !size || !size.every(within)) return null;
  const send: ItemSend = { name: t[1], model, size };
  for (const word of t.slice(6)) {
    const [moment, sound] = word.split("=");
    if ((SEND_MOMENTS as readonly string[]).includes(moment ?? "") && sound && PLAIN.test(sound)) send[moment as (typeof SEND_MOMENTS)[number]] = sound;
    if (moment === "trail") {
      const seconds = Number(sound);
      if (seconds > 0 && seconds <= ITEM_LIMITS.trail) send.trail = seconds;
    }
  }
  return send;
}

/**
 * An item's description, ready to be signed by its maker. Null if anything in it couldn't be used: a name that
 * isn't one, no title, a file that isn't an `https` address with a hash, or a size out of bounds.
 */
export function buildItem(o: ItemInput & { now: number }): EventTemplate | null {
  const title = cleanLine(o.title, ITEM_LIMITS.title);
  const model = cleanFile(o.model?.url, o.model?.sha256);
  if (typeof o.d !== "string" || !NAME.test(o.d) || !title || !model || !Array.isArray(o.size) || o.size.length !== 3 || !o.size.every(within)) return null;
  const tags: string[][] = [
    ["d", o.d],
    ["title", title],
  ];
  const summary = cleanLine(o.summary ?? "", ITEM_LIMITS.summary);
  if (summary) tags.push(["summary", summary]);
  tags.push(["model", model.url, "glb", model.sha256]);
  if (o.thumb) {
    const thumb = cleanFile(o.thumb.url, o.thumb.sha256);
    if (!thumb) return null;
    tags.push(["thumb", thumb.url, thumb.sha256]);
  }
  tags.push(["size", said(o.size)]);
  for (const c of (o.colliders ?? []).slice(0, ITEM_LIMITS.colliders)) {
    const tag = colliderTag(c);
    if (!tag) return null;
    tags.push(tag);
  }
  for (const moment of ITEM_MOMENTS) {
    const clip = o.clips?.[moment];
    if (clip === undefined) continue;
    if (!CLIP.test(clip)) return null;
    tags.push(["clip", moment, clip]);
  }
  for (const b of ITEM_BEHAVIORS) if (o.behaviors?.includes(b)) tags.push(["behavior", b]);
  const fits = ITEM_FITS.filter((f) => o.fits?.includes(f));
  if (fits.length) tags.push(["fits", ...fits]);
  if (o.use === "granted") tags.push(["use", "granted"]);
  if (o.script) {
    const script = cleanFile(o.script.url, o.script.sha256);
    if (!script) return null;
    tags.push(["script", script.url, script.sha256]);
  }
  for (const [name, file] of Object.entries(o.sounds ?? {}).slice(0, ITEM_LIMITS.sounds)) {
    const sound = cleanFile(file?.url, file?.sha256);
    if (!PLAIN.test(name) || !sound) return null;
    tags.push(["sound", name, sound.url, sound.sha256]);
  }
  for (const s of (o.sends ?? []).slice(0, ITEM_LIMITS.sends)) {
    const model = cleanFile(s?.model?.url, s?.model?.sha256);
    if (!s || !PLAIN.test(s.name) || !model || !Array.isArray(s.size) || s.size.length !== 3 || !s.size.every(within)) return null;
    const when = SEND_MOMENTS.filter((m) => s[m] !== undefined);
    if (when.some((m) => !PLAIN.test(s[m]!))) return null;
    if (s.trail !== undefined && !(typeof s.trail === "number" && s.trail > 0 && s.trail <= ITEM_LIMITS.trail)) return null;
    tags.push(["sends", s.name, model.url, "glb", model.sha256, said(s.size), ...when.map((m) => `${m}=${s[m]}`), ...(s.trail === undefined ? [] : [`trail=${said([s.trail])}`])]);
  }
  for (const e of (o.effects ?? []).slice(0, ITEM_LIMITS.sends)) {
    if (!e || !PLAIN.test(e.of) || e.state !== "health" || !Number.isInteger(e.take) || e.take < 1 || e.take > 5) return null;
    tags.push(["effect", e.of, e.state, String(-e.take)]);
  }
  for (const press of ["use", "second"] as const) {
    const label = cleanLine(o.does?.[press] ?? "", ITEM_LIMITS.label);
    if (label) tags.push(["does", press, label]);
  }
  if (o.aim) {
    const ok = Array.isArray(o.aim.at) && o.aim.at.length === 3 && o.aim.at.every((x) => Number.isFinite(x) && Math.abs(x) <= ITEM_LIMITS.metres) && typeof o.aim.zoom === "number" && o.aim.zoom > 0 && o.aim.zoom <= 1;
    if (!ok) return null;
    tags.push(["aim", said(o.aim.at), said([o.aim.zoom])]);
  }
  for (const t of (o.tints ?? []).slice(0, ITEM_LIMITS.tints)) {
    const label = cleanLine(t?.label ?? "", ITEM_LIMITS.label);
    if (!t || !PLAIN.test(t.slot) || !label || !HEX.test(t.color)) return null;
    tags.push(["tint", t.slot, label, t.color]);
  }
  const license = cleanLine(o.license ?? "", 40);
  if (license) tags.push(["license", license]);
  tags.push(["alt", `Item: ${title}`]);
  return { kind: ITEM_KIND, created_at: Math.floor(o.now), tags, content: "" };
}

/**
 * Read an item's description. Null for anything that isn't one, or names no usable model. What it doesn't
 * understand, it leaves out: an unknown behaviour, a shape that isn't one, a place it can't go. The signature is
 * the caller's to check (`verifyEvent`), and every file is checked against its hash by whoever fetches it.
 */
export function parseItem(event: NostrEvent | null | undefined): Item | null {
  if (!event || event.kind !== ITEM_KIND || !isHex64(event.pubkey) || !Array.isArray(event.tags)) return null;
  const tag = (name: string) => getTags(event, name)[0];
  const d = tag("d")?.[1];
  const title = cleanLine(tag("title")?.[1], ITEM_LIMITS.title);
  const m = tag("model");
  const model = m && m[2] === "glb" ? cleanFile(m[1], m[3]) : null;
  const size = numbers(tag("size")?.[1], 3) as [number, number, number] | null;
  if (typeof d !== "string" || !NAME.test(d) || !title || !model || !size || !size.every(within)) return null;
  const th = tag("thumb");
  const sc = tag("script");
  const clips: Partial<Record<ItemMoment, string>> = {};
  for (const t of getTags(event, "clip").slice(0, ITEM_LIMITS.clips)) {
    if ((ITEM_MOMENTS as readonly string[]).includes(t[1] ?? "") && CLIP.test(t[2] ?? "")) clips[t[1] as ItemMoment] = t[2]!;
  }
  const behaviors = ITEM_BEHAVIORS.filter((b) => getTags(event, "behavior").some((t) => t[1] === b));
  const fitsTag = tag("fits")?.slice(1) ?? [];
  return {
    maker: event.pubkey,
    id: `${ITEM_KIND}:${event.pubkey}:${d}`,
    d,
    title,
    summary: cleanLine(tag("summary")?.[1], ITEM_LIMITS.summary),
    model,
    thumb: th ? cleanFile(th[1], th[2]) : null,
    size,
    colliders: getTags(event, "collider")
      .slice(0, ITEM_LIMITS.colliders)
      .map(readCollider)
      .filter((c): c is ItemCollider => c !== null),
    clips,
    behaviors,
    fits: ITEM_FITS.filter((f) => fitsTag.includes(f)),
    use: tag("use")?.[1] === "granted" ? "granted" : "anyone",
    // Named, and run by nothing yet: where it runs, and what it may ask for, is protocol/17-items.md.
    script: sc ? cleanFile(sc[1], sc[2]) : null,
    sounds: Object.fromEntries(
      getTags(event, "sound")
        .slice(0, ITEM_LIMITS.sounds)
        .map((t) => [t[1], cleanFile(t[2], t[3])] as const)
        .filter((s): s is [string, ItemFile] => typeof s[0] === "string" && PLAIN.test(s[0]) && s[1] !== null),
    ),
    sends: getTags(event, "sends").slice(0, ITEM_LIMITS.sends).map(readSend).filter((s): s is ItemSend => s !== null),
    effects: getTags(event, "effect")
      .slice(0, ITEM_LIMITS.sends)
      .map((t): ItemEffect | null => {
        const take = -Number(t[3]);
        return typeof t[1] === "string" && PLAIN.test(t[1]) && t[2] === "health" && Number.isInteger(take) && take >= 1 && take <= 5 ? { of: t[1], state: "health", take } : null;
      })
      .filter((e): e is ItemEffect => e !== null),
    does: Object.fromEntries(
      getTags(event, "does")
        .filter((t) => t[1] === "use" || t[1] === "second")
        .map((t) => [t[1], cleanLine(t[2], ITEM_LIMITS.label)] as const)
        .filter((d) => d[1]),
    ),
    aim: readAim(tag("aim")),
    tints: getTags(event, "tint")
      .slice(0, ITEM_LIMITS.tints)
      .map((t) => ({ slot: t[1] ?? "", label: cleanLine(t[2], ITEM_LIMITS.label), color: t[3] ?? "" }))
      .filter((t, i, all) => PLAIN.test(t.slot) && t.label !== "" && HEX.test(t.color) && all.findIndex((x) => x.slot === t.slot) === i),
    license: cleanLine(tag("license")?.[1], 40),
    at: Number.isInteger(event.created_at) ? event.created_at : 0,
  };
}
