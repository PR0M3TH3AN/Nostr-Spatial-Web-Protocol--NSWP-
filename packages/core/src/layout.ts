/**
 * Home layouts (spec §4.5): a signed list of placements that any renderer can
 * draw. A layout places things from a built-in catalogue, or published items
 * by reference (§10.4). It is a list of placements, not a scene format.
 *
 * As everywhere in this library, a bad part is dropped with a warning and the
 * rest still loads: one broken placement shouldn't cost someone their home.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { checkDestination } from "./destination.js";
import { isHex64, type EventTemplate } from "./event.js";
import { getTagValue } from "./event.js";
import { parseCoordinate } from "./nip19.js";
import { Collector, isPlainObject, type Result } from "./result.js";
import { WORLD_KIND } from "./constants.js";

/** Experimental kinds. Not allocated by the NIPs process (spec §4.5, §10.4). */
export const HOME_LAYOUT_KIND = 37302;
export const ITEM_KIND = 37303;

/** Room templates and built-in items every renderer ships (spec §4.5). Who defines this list is Q23. */
export const ROOM_TEMPLATES = ["hall", "open"] as const;
export const BUILTIN_ITEMS = ["frame", "portal", "note", "plant", "lamp", "bench", "table", "plinth"] as const;
export const LAYOUT_ACCESS = ["open", "invite", "list", "follows", "ticket"] as const;

export const LAYOUT_LIMITS = {
  placements: 64,
  publishedItems: 16,
  /** Furthest a placement may be from the home's origin, in metres. */
  reach: 50,
  noteChars: 280,
  /** A picture in a frame (spec §10.1). */
  pictureBytes: 1024 * 1024,
} as const;

export type RoomTemplate = (typeof ROOM_TEMPLATES)[number];
export type BuiltinItem = (typeof BUILTIN_ITEMS)[number];

export interface Placement {
  /** `builtin`: `type` is a catalogue name. `published`: `type` is an item's coordinate. */
  source: "builtin" | "published";
  type: string;
  /** Metres from the home's origin: x to the right, y up, z towards the visitor. */
  position: [number, number, number];
  /** Degrees about the vertical. */
  rotation: number;
  /** What this type needs: a frame's picture and hash, a portal's destination, a note's text. */
  args: string[];
}

export interface LayoutRoom {
  template: RoomTemplate;
  /** Two hex colours: the room, and its accent. */
  color: string;
  accent: string;
}

export interface LayoutInput {
  d: string;
  title?: string;
  room?: Partial<LayoutRoom>;
  items?: { type: string; position: [number, number, number]; rotation?: number; args?: string[] }[];
  access?: string;
  contentWarning?: string;
  createdAt?: number;
}

export interface Layout {
  d: string;
  title?: string;
  room: LayoutRoom;
  items: Placement[];
  access?: string;
  contentWarning?: string;
  createdAt: number;
  pubkey?: string;
}

const DEFAULT_ROOM: LayoutRoom = { template: "hall", color: "#101217", accent: "#3fc584" };
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const num = (n: number) => String(Math.round(n * 1000) / 1000);

/** Build an unsigned layout event (spec §4.5). */
export function buildLayoutEvent(l: LayoutInput): EventTemplate {
  const room = { ...DEFAULT_ROOM, ...l.room };
  const tags: string[][] = [["d", l.d]];
  if (l.title) tags.push(["title", l.title]);
  tags.push(["room", room.template, room.color, room.accent]);
  for (const item of l.items ?? []) {
    tags.push(["item", item.type, item.position.map(num).join(" "), num(item.rotation ?? 0), ...(item.args ?? [])]);
  }
  if (l.access) tags.push(["access", l.access]);
  if (l.contentWarning !== undefined) tags.push(["content-warning", l.contentWarning]);
  tags.push(["alt", `Home layout${l.title ? `: ${l.title}` : ""}`]);
  return { kind: HOME_LAYOUT_KIND, created_at: l.createdAt ?? Math.floor(Date.now() / 1000), tags, content: "" };
}

function parsePosition(text: string | undefined): [number, number, number] | null {
  const parts = (text ?? "").trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || Math.abs(n) > LAYOUT_LIMITS.reach)) return null;
  return parts as [number, number, number];
}

/** What a portal placement points at: a world's coordinate, or an https address. */
export function portalTarget(arg: string | undefined): { coordinate: string; pubkey: string; d: string } | { url: string } | null {
  if (!arg) return null;
  const c = parseCoordinate(arg);
  if (c) return c.kind === WORLD_KIND ? { coordinate: arg, pubkey: c.pubkey, d: c.identifier } : null;
  const chk = checkDestination(arg);
  return chk.ok ? { url: chk.value.url } : null;
}

/** Validate a layout event and return its structured form. */
export function parseLayoutEvent(input: unknown): Result<Layout> {
  const c = new Collector();
  if (!isPlainObject(input) || !Array.isArray(input.tags)) {
    c.error("invalid_event", "", "A layout must be an event object with tags.");
    return c.result(undefined as never);
  }
  if (input.kind !== HOME_LAYOUT_KIND) c.error("wrong_kind", "kind", `A layout is kind ${HOME_LAYOUT_KIND}.`);
  const tags = (input.tags as unknown[]).filter((t): t is string[] => Array.isArray(t) && t.every((v) => typeof v === "string"));
  const event = { tags };
  const d = getTagValue(event, "d");
  if (!d) c.error("missing_tag", "tags.d", "A layout needs a `d` tag naming the place.");
  if (c.errors.length > 0) return c.result(undefined as never);

  const room: LayoutRoom = { ...DEFAULT_ROOM };
  const roomTag = tags.find((t) => t[0] === "room");
  if (roomTag) {
    if ((ROOM_TEMPLATES as readonly string[]).includes(roomTag[1] ?? "")) room.template = roomTag[1] as RoomTemplate;
    else c.warn("unknown_value", "tags.room", `Unknown room template "${roomTag[1] ?? ""}"; using "${room.template}".`);
    if (roomTag[2] && HEX_COLOR.test(roomTag[2])) room.color = roomTag[2];
    if (roomTag[3] && HEX_COLOR.test(roomTag[3])) room.accent = roomTag[3];
  }

  const items: Placement[] = [];
  const published = new Set<string>();
  tags
    .filter((t) => t[0] === "item")
    .forEach((t, i) => {
      const path = `tags.item[${i}]`;
      if (items.length >= LAYOUT_LIMITS.placements) {
        if (items.length === LAYOUT_LIMITS.placements && i === LAYOUT_LIMITS.placements) c.warn("too_many_items", path, `A layout holds at most ${LAYOUT_LIMITS.placements} placements; the rest were dropped.`);
        return;
      }
      const type = t[1] ?? "";
      const position = parsePosition(t[2]);
      const rotation = Number(t[3] ?? "0");
      if (!position || !Number.isFinite(rotation)) {
        c.warn("item_position_invalid", path, "A placement needs a position in metres (`x y z`) and a rotation in degrees; it was dropped.");
        return;
      }
      const args = t.slice(4);
      const coordinate = parseCoordinate(type);
      if (coordinate) {
        if (coordinate.kind !== ITEM_KIND) {
          c.warn("item_unknown", path, "A placement can name only an item definition; it was dropped.");
          return;
        }
        if (!published.has(type) && published.size >= LAYOUT_LIMITS.publishedItems) {
          c.warn("too_many_items", path, `A layout uses at most ${LAYOUT_LIMITS.publishedItems} different published items; this one was dropped.`);
          return;
        }
        published.add(type);
        items.push({ source: "published", type, position, rotation, args });
        return;
      }
      if (!(BUILTIN_ITEMS as readonly string[]).includes(type)) {
        c.warn("item_unknown", path, `"${type}" isn't in the built-in catalogue; it was dropped.`);
        return;
      }
      if (type === "frame" && !(checkDestination(args[0] ?? "").ok && isHex64(args[1]))) {
        c.warn("item_args_invalid", path, "A frame needs an https picture address and its SHA-256; it was dropped.");
        return;
      }
      if (type === "portal" && !portalTarget(args[0])) {
        c.warn("item_args_invalid", path, "A portal needs a world's coordinate or an https address; it was dropped.");
        return;
      }
      if (type === "note") {
        if (!args[0]) {
          c.warn("item_args_invalid", path, "A note needs some text; it was dropped.");
          return;
        }
        if (args[0].length > LAYOUT_LIMITS.noteChars) args[0] = `${args[0].slice(0, LAYOUT_LIMITS.noteChars - 1)}…`;
      }
      items.push({ source: "builtin", type, position, rotation, args });
    });

  const access = getTagValue(event, "access");
  if (access !== undefined && !(LAYOUT_ACCESS as readonly string[]).includes(access)) c.warn("unknown_value", "tags.access", `Unknown access rule "${access}".`);
  const warning = tags.find((t) => t[0] === "content-warning");
  const layout: Layout = {
    d: d!,
    room,
    items,
    createdAt: typeof input.created_at === "number" ? input.created_at : 0,
  };
  const title = getTagValue(event, "title");
  if (title) layout.title = title;
  if (access !== undefined && (LAYOUT_ACCESS as readonly string[]).includes(access)) layout.access = access;
  if (warning) layout.contentWarning = warning[1] ?? "";
  if (isHex64(input.pubkey)) layout.pubkey = input.pubkey;
  return c.result(layout);
}

/** Check a fetched picture before showing it in a frame: size ceiling and hash (spec §10.1). */
export function checkPictureBytes(expectedSha256: string, bytes: Uint8Array): boolean {
  return bytes.length <= LAYOUT_LIMITS.pictureBytes && bytesToHex(sha256(bytes)) === expectedSha256;
}
