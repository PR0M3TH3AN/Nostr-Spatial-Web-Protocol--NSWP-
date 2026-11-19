/** Portal objects and Airlock fragments (spec §6.1–§6.3). */
import { SCHEMAS, WORLD_KIND, LIMITS } from "./constants.js";
import { checkDestination } from "./destination.js";
import type { Capability } from "./constants.js";
import { decodeNaddr, type AddressPointer } from "./nip19.js";
import { Collector, isPlainObject, type Result } from "./result.js";
import { decodeSettings, encodeSettings, hasSettings, type TravelSettings } from "./settings.js";

export interface PortalDestination {
  naddr?: string;
  url?: string;
  entryPoint?: string;
}

export interface Portal {
  schema: string;
  label: string;
  destination: PortalDestination;
  transition?: { preferredStyle?: string };
}

const ENTRY_POINT = /^[A-Za-z0-9._-]{1,128}$/;

export function parsePortal(input: unknown): Result<Portal> {
  const c = new Collector();
  if (!isPlainObject(input)) {
    c.error("not_an_object", "", "A portal must be a JSON object.");
    return c.result(null as never);
  }
  if (typeof input.schema !== "string" || !input.schema.startsWith("nswp/portal/")) c.error("schema_mismatch", "schema", `schema must be "${SCHEMAS.portal}".`);
  if (typeof input.label !== "string" || input.label.trim() === "") c.error("missing_field", "label", "A portal needs a label.");
  const dest: PortalDestination = {};
  const d = input.destination;
  if (!isPlainObject(d)) c.error("missing_field", "destination", "A portal needs a destination.");
  else {
    if (d.naddr !== undefined) {
      try {
        const p = decodeNaddr(String(d.naddr));
        if (p.kind !== WORLD_KIND) c.warn("unexpected_kind", "destination.naddr", `naddr points at kind ${p.kind}, not a world (${WORLD_KIND}).`);
        dest.naddr = String(d.naddr);
      } catch {
        c.error("naddr_invalid", "destination.naddr", "destination.naddr is not a valid naddr.");
      }
    }
    if (d.url !== undefined) {
      const chk = checkDestination(String(d.url));
      if (chk.ok) dest.url = chk.value.url;
      else c.error(chk.error.code, "destination.url", chk.error.message);
    }
    if (dest.naddr === undefined && dest.url === undefined && c.errors.length === 0) {
      c.error("missing_field", "destination", "destination needs an naddr or a url.");
    }
    if (d.entry_point !== undefined) {
      if (typeof d.entry_point === "string" && ENTRY_POINT.test(d.entry_point)) dest.entryPoint = d.entry_point;
      else c.warn("invalid_entry_point", "destination.entry_point", "Ignoring an invalid entry point.");
    }
  }
  const portal: Portal = { schema: String(input.schema ?? SCHEMAS.portal), label: String(input.label ?? ""), destination: dest };
  if (isPlainObject(input.transition) && typeof input.transition.preferred_style === "string") {
    portal.transition = { preferredStyle: input.transition.preferred_style };
  }
  return c.result(portal);
}

export interface AirlockUrlOptions {
  /**
   * The visitor is in a headset session as they leave. The Airlock passes it
   * on, so the destination can offer the way back into one at once
   * (protocol/02-doors.md, "How many actions a crossing takes").
   */
  immersive?: boolean;
  /**
   * The visitor is in this world's open room as they leave, and would stay
   * among people where they are going (`joined=1`). It is this world's word,
   * and a link anyone can write: the visitor's own client decides what to do
   * with it (protocol/02-doors.md, "Staying joined").
   */
  joined?: boolean;
  /** Their microphone is on as they leave (`mic=1`). Said only with `joined`. */
  mic?: boolean;
  /**
   * People the visitor blocked in this world during this visit, by the
   * identity key behind each name (`blocked=<key>,<key>`). It is this
   * world's word and a link anyone can write, so the visitor's own client
   * shows it and asks before a block goes anywhere else
   * (protocol/02-doors.md, "Blocks that travel").
   */
  blocked?: string[];
  /**
   * The visitor is moving the intense way and would go on doing so
   * (`moving=intense`): at a desk, the mouse looks and keys walk; in a
   * headset, they walk and turn smoothly. Left out, they move the casual
   * way. A preference and nothing more (protocol/02-doors.md, "How a visitor
   * moves").
   */
  moving?: "intense";
  /**
   * What the visitor is using a flat screen with as they leave (`form=touch`
   * or `form=desk`): their fingers, or a mouse and keys. The place they
   * arrive starts them the same way, where their device can do both. A
   * headset session is `immersive`, and this says what they fall back to out
   * of it. A preference and nothing more (protocol/11-the-visitors-console.md,
   * "The same form on the other side"). Not sent on the way home: a
   * visitor's own client knows their device.
   */
  form?: Form;
  /**
   * The visitor's settings as they leave (`set=<settings>`): their volumes,
   * the size of their text, whether things move, their hands in a headset,
   * whether their screen was filled. The place they arrive starts from them,
   * so nothing has to be set again. Preferences and nothing more
   * (protocol/11-the-visitors-console.md, "Settings that travel"). Sent on
   * the way home too: what they changed in a world comes home with them.
   */
  settings?: TravelSettings;
  /**
   * The visitor asked, from inside a world, to say who they are (`who=1`):
   * to sign in, switch to another profile, or go on as a guest. Or to change
   * how they look (`who=look`). Their own client shows them its own way of
   * doing that before it takes them on. A request and nothing more: a link
   * anyone can write never signs anyone in, never sends anyone by name, and
   * never changes a look (protocol/10-identity.md, "Signing in from inside a
   * world"; protocol/05-looks.md). Only with a destination, never on the way
   * home.
   */
  who?: boolean | "look";
}

/** How a visitor is using a flat screen: with their fingers, or with a mouse and keys. */
export type Form = "touch" | "desk";
export const isForm = (v: unknown): v is Form => v === "touch" || v === "desk";

/** Keys from a list that are keys, once each, up to a limit. */
export function cleanKeys(input: unknown, limit: number): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const k of input) {
    if (typeof k !== "string" || !/^[0-9a-f]{64}$/.test(k) || out.includes(k)) continue;
    out.push(k);
    if (out.length >= limit) break;
  }
  return out;
}

const blockedFlag = (opts: AirlockUrlOptions): string[] => {
  const keys = cleanKeys(opts.blocked, LIMITS.maxBlockedOnLink);
  return keys.length ? [`blocked=${keys.join(",")}`] : [];
};
const blockedFrom = (value: string | undefined): string[] => cleanKeys((value ?? "").split(","), LIMITS.maxBlockedOnLink);

/** The visitor's settings as a flag, when there are any. */
const settingsFlag = (opts: AirlockUrlOptions): string[] => {
  const text = encodeSettings(opts.settings);
  return text ? [`set=${text}`] : [];
};

/** The flags a visitor's state travels in: from a headset, in a room, with the microphone on. */
function stateFlags(opts: AirlockUrlOptions): string[] {
  return [...(opts.immersive ? ["xr=1"] : []), ...(opts.moving === "intense" ? ["moving=intense"] : []), ...(opts.joined ? ["joined=1"] : []), ...(opts.joined && opts.mic ? ["mic=1"] : [])];
}

/** `<airlock>#to=<naddr or url>&entry=<id>` (spec §6.2: destinations travel in the fragment). */
export function buildAirlockUrl(airlock: string, dest: PortalDestination, opts: AirlockUrlOptions = {}): string {
  const u = new URL(airlock);
  const to = dest.naddr ?? dest.url;
  if (!to) throw new Error("buildAirlockUrl: destination needs an naddr or a url");
  const parts = [`to=${encodeURIComponent(to)}`];
  if (dest.naddr && dest.url) parts.push(`url=${encodeURIComponent(dest.url)}`);
  if (dest.entryPoint) parts.push(`entry=${encodeURIComponent(dest.entryPoint)}`);
  parts.push(...(opts.who === "look" ? ["who=look"] : opts.who ? ["who=1"] : []), ...stateFlags(opts), ...(isForm(opts.form) ? [`form=${opts.form}`] : []), ...settingsFlag(opts), ...blockedFlag(opts));
  u.hash = parts.join("&");
  return u.href;
}

export interface AirlockRequest {
  /** The raw `to` value. */
  to: string;
  naddr?: AddressPointer & { raw: string };
  url?: string;
  entryPoint?: string;
  /** The visitor left a headset session to come here (`xr=1`). */
  immersive?: boolean;
  /** The link says they were in the open room where they came from (`joined=1`). A claim, not a fact. */
  joined?: boolean;
  /** The link says their microphone was on (`mic=1`). Kept only with `joined`. */
  mic?: boolean;
  /** The link says they blocked these people where they came from. A claim: shown and asked about, never applied unseen. */
  blocked?: string[];
  /** The link says they were moving the intense way (`moving=intense`). */
  moving?: "intense";
  /** The link says what they were using a flat screen with (`form=touch` or `form=desk`). */
  form?: Form;
  /** The link says what their settings were (`set=`). Preferences, with everything unknown already left out. */
  settings?: TravelSettings;
  /**
   * The link says the visitor asked for something of their own first: to say who they are (`who=1`), or to change
   * how they look (`who=look`). A request: it shows them their own client's place for it, and decides nothing.
   */
  who?: "identity" | "look";
}

/** Whether a fragment says the visitor came from a headset session, with or without a destination: a way home carries it too. */
export function fragmentSaysImmersive(hash: string): boolean {
  return hash.replace(/^#/, "").split("&").includes("xr=1");
}

/**
 * Whether an Airlock was opened as a way with no destination: home, or to
 * the visitor's doors. It is one when the fragment holds nothing but the two
 * flags such a way may carry. Null for anything else, which is a crossing or
 * a mistake.
 */
export function wayWithoutDestination(hash: string): { immersive: boolean; doors: boolean; joined?: true; mic?: true; blocked?: string[]; moving?: "intense"; settings?: TravelSettings } | null {
  const parts = hash.replace(/^#/, "").split("&").filter(Boolean);
  const reported = parts.find((p) => /^blocked=[0-9a-f,]+$/.test(p));
  const set = parts.find((p) => /^set=[A-Za-z0-9_-]{1,400}$/.test(p));
  if (parts.some((p) => p !== "xr=1" && p !== "doors=1" && p !== "joined=1" && p !== "mic=1" && p !== "moving=intense" && p !== reported && p !== set)) return null;
  const settings = set ? decodeSettings(set.slice(4)) : {};
  const joined = parts.includes("joined=1");
  const blocked = blockedFrom(reported?.slice(8));
  return {
    immersive: parts.includes("xr=1"),
    doors: parts.includes("doors=1"),
    ...(joined ? { joined: true as const } : {}),
    ...(joined && parts.includes("mic=1") ? { mic: true as const } : {}),
    ...(blocked.length ? { blocked } : {}),
    ...(parts.includes("moving=intense") ? { moving: "intense" as const } : {}),
    ...(hasSettings(settings) ? { settings } : {}),
  };
}

/** `<airlock>` opened as the way home, or with `doors` as the way to the visitor's doors (protocol/02-doors.md). */
export function buildWayUrl(airlock: string, opts: AirlockUrlOptions & { doors?: boolean } = {}): string {
  const u = new URL(airlock);
  u.hash = [...(opts.doors ? ["doors=1"] : []), ...stateFlags(opts), ...settingsFlag(opts), ...blockedFlag(opts)].join("&");
  return u.href;
}

/** A capability a world's manifest may name: it can be the place its owner starts (protocol/07-homes.md). */
export const HOME_CAPABILITY = "home" satisfies Capability;

/** Parse an Airlock fragment. Returns null when there is no destination. */
export function parseAirlockFragment(hash: string): AirlockRequest | null {
  const params = new Map<string, string>();
  for (const part of hash.replace(/^#/, "").split("&")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    try {
      params.set(part.slice(0, i), decodeURIComponent(part.slice(i + 1)));
    } catch {
      /* skip malformed */
    }
  }
  const to = params.get("to");
  if (!to) return null;
  const req: AirlockRequest = { to };
  if (to.startsWith("naddr1")) {
    try {
      req.naddr = { ...decodeNaddr(to), raw: to };
    } catch {
      /* left undefined: caller reports it */
    }
    const url = params.get("url");
    if (url) req.url = url;
  } else req.url = to;
  const entry = params.get("entry");
  if (entry && ENTRY_POINT.test(entry)) req.entryPoint = entry;
  if (params.get("xr") === "1") req.immersive = true;
  if (params.get("who") === "1") req.who = "identity";
  else if (params.get("who") === "look") req.who = "look";
  if (params.get("joined") === "1") {
    req.joined = true;
    if (params.get("mic") === "1") req.mic = true;
  }
  const blocked = blockedFrom(params.get("blocked"));
  if (blocked.length) req.blocked = blocked;
  if (params.get("moving") === "intense") req.moving = "intense";
  const form = params.get("form");
  if (isForm(form)) req.form = form;
  const settings = decodeSettings(params.get("set"));
  if (hasSettings(settings)) req.settings = settings;
  return req;
}
