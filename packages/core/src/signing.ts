/**
 * Signing from inside a world (protocol/10-identity.md, "Signing from a
 * world"): the pure parts.
 *
 * A world never holds its visitor's key. It asks a hidden signer served by
 * the visitor's own client, embedded in the world's page, and that signer
 * answers with a signed note or a refusal. This file is what both sides
 * agree on: where a client's signer and its sign-in window are, what the
 * messages between a world and the signer look like, which kinds of note a
 * world may have signed, and how a note is tidied and marked before it is
 * signed.
 *
 * Nothing here signs anything, and nothing here is a secret.
 */
import type { EventTemplate, NostrEvent } from "./event.js";
import { cleanLine } from "./chat.js";
import { isHex64 } from "./event.js";
import { cleanAbout, cleanPicture } from "./pass.js";

export const SIGNER_PROTOCOL = "nswp-signer";
export const SIGNER_VERSION = 1;

export const SIGN_LIMITS = {
  /** The longest a note's content may be, in characters. */
  contentChars: 8000,
  tags: 60,
  tagItems: 8,
  tagChars: 400,
  /** How long an unlocked signer stays unlocked for a world, at most. Closing the world's page ends it sooner. */
  grantSec: 4 * 3600,
  /** No more than this many notes for one world in `perMs`: the pace of a person, not of a script. */
  burst: 3,
  perMs: 60_000,
  /** And no more than this many in an hour. */
  hourly: 20,
  /**
   * A pass is counted apart from notes, so signing in doesn't use up a post: no more than this many passes for
   * one world in `perMs`, and in an hour. A reader asks once per sign-in and once when a pass runs out.
   */
  passBurst: 2,
  passHourly: 10,
} as const;

/**
 * How a kind of note is treated when a world asks for it.
 *
 * - "ordinary": allowed once the visitor has unlocked the signer for that world.
 * - "careful": only with the visitor's say each time, on a surface their client draws. Not built yet: refused.
 * - "never": refused, whatever anyone says.
 */
export type SignClass = "ordinary" | "careful" | "never";

/** What a world may have signed once the visitor has said yes to it: a note, and a reaction to one. */
export const ORDINARY_KINDS: readonly number[] = [1, 7];

/**
 * What is never signed for a world: private messages and their wrappings,
 * passes and room signals (a world would be signing itself in), anything
 * that proves who someone is to a server or a relay, wallet and remote-signer
 * traffic, and application data, which is where a client keeps its own.
 */
export const NEVER_KINDS: readonly number[] = [4, 13, 14, 15, 1059, 1060, 13194, 22242, 23194, 23195, 24133, 27235, 27300, 27301, 30078];

export function signClass(kind: unknown): SignClass {
  if (typeof kind !== "number" || !Number.isInteger(kind) || kind < 0 || kind > 65535) return "never";
  if (NEVER_KINDS.includes(kind)) return "never";
  // Anything a relay keeps only the newest of (a profile, a follow list, a relay list) rewrites what the visitor
  // already has, and deleting undoes it: those are never "ordinary".
  if (ORDINARY_KINDS.includes(kind)) return "ordinary";
  return "careful";
}

/** The tag a signer puts on every note it signs for a world: which world asked. A world can't leave it off. */
export const WORLD_TAG = "nswp:world";

/** A place as it may be named in a tag or shown to someone: an http(s) origin, or "". */
export function cleanOrigin(input: unknown): string {
  if (typeof input !== "string" || input.length > 300) return "";
  try {
    const u = new URL(input);
    return (u.protocol === "https:" || u.protocol === "http:") && u.origin !== "null" ? u.origin : "";
  } catch {
    return "";
  }
}

/**
 * What a world asked to have signed, as it may be signed for that world: an
 * ordinary kind, its words within the limit, its tags tidied, and marked with
 * the world that asked. The time is the signer's own, never the world's.
 * Null for anything else.
 */
export function prepareForWorld(input: unknown, world: string, now: number): EventTemplate | null {
  const origin = cleanOrigin(world);
  if (!origin || !input || typeof input !== "object") return null;
  const e = input as { kind?: unknown; content?: unknown; tags?: unknown };
  if (signClass(e.kind) !== "ordinary") return null;
  if (typeof e.content !== "string" || [...e.content].length > SIGN_LIMITS.contentChars) return null;
  if (!Array.isArray(e.tags) || e.tags.length > SIGN_LIMITS.tags) return null;
  const tags: string[][] = [];
  for (const tag of e.tags) {
    if (!Array.isArray(tag) || tag.length === 0 || tag.length > SIGN_LIMITS.tagItems) return null;
    if (!tag.every((item) => typeof item === "string" && item.length <= SIGN_LIMITS.tagChars)) return null;
    // The mark is the signer's to write. A world's own is dropped, whatever it says.
    if (tag[0] === WORLD_TAG) continue;
    tags.push([...(tag as string[])]);
  }
  tags.push([WORLD_TAG, origin]);
  return { kind: e.kind as number, created_at: Math.floor(now), tags, content: e.content };
}

/** Whether a signed note is the one that was asked for: the same kind, words and tags, plus the signer's mark. */
export function isWhatWasAsked(asked: { kind: number; content: string; tags: string[][] }, signed: NostrEvent): boolean {
  if (signed.kind !== asked.kind || signed.content !== asked.content) return false;
  const mine = asked.tags.filter((t) => t[0] !== WORLD_TAG);
  const theirs = signed.tags.filter((t) => t[0] !== WORLD_TAG);
  return JSON.stringify(mine) === JSON.stringify(theirs);
}

export interface SignGate {
  /** Whether another note may be signed for this world now. Counts it if so. `now` is in milliseconds. */
  take(now: number): boolean;
}

/** One world's notes, counted: a world the visitor said yes to still can't pour notes out under their name. */
export function createSignGate(limits: { burst: number; perMs: number; hourly: number } = SIGN_LIMITS): SignGate {
  let times: number[] = [];
  return {
    take(now) {
      times = times.filter((t) => now - t < 3_600_000);
      if (times.length >= limits.hourly) return false;
      if (times.filter((t) => now - t < limits.perMs).length >= limits.burst) return false;
      times.push(now);
      return true;
    },
  };
}

/**
 * Where a client's signer and its sign-in window are: beside its Airlock.
 * A client whose Airlock is at `https://client.example/go/` serves them at
 * `/signer/` and `/connect/`. Null for an Airlock that isn't an https address.
 */
export function signerAddresses(airlock: string | null | undefined): { origin: string; signer: string; window: string } | null {
  if (!airlock) return null;
  try {
    const base = new URL(airlock);
    if (base.protocol !== "https:") return null;
    return { origin: base.origin, signer: new URL("../signer/", base).href, window: new URL("../connect/", base).href };
  } catch {
    return null;
  }
}

/**
 * Where a signer and its sign-in window are, for a client that keeps them
 * somewhere of their own and says where in the arrival (`signer`): at
 * `signer/` and `connect/` under that address. Null for anything that isn't
 * an https address.
 */
export function signerAt(base: string | null | undefined): { origin: string; signer: string; window: string } | null {
  if (!base || base.length > 300) return null;
  try {
    const at = new URL(base);
    if (at.protocol !== "https:" || at.username || at.password) return null;
    // A base names a place, not a page: "https://sign.example" and "https://sign.example/" are the same place.
    if (!at.pathname.endsWith("/")) at.pathname += "/";
    at.search = "";
    at.hash = "";
    return { origin: at.origin, signer: new URL("signer/", at).href, window: new URL("connect/", at).href };
  } catch {
    return null;
  }
}

// ---- What a world and the signer say to each other. Every message is `{ nswp: "nswp-signer", v: 1, t, ... }`.

/** From a world: "what state are you in?", "sign this", or "lock": the visitor's own way to end it from the world's menu. */
export type SignerRequest =
  | { t: "state"; id: string }
  | { t: "lock"; id: string }
  | { t: "sign"; id: string; event: { kind: number; content: string; tags: string[][] } }
  /**
   * A room pass for this world, for the session key named (protocol/10-identity.md, "A pass from the signer").
   * The world gives the session's public key and nothing else: the signer writes the rest.
   */
  | { t: "pass"; id: string; session: string };

/**
 * From the signer. `ready` is said once, unasked, when it has loaded. `state`
 * answers a request and is said again whenever it changes. A refusal never
 * says why.
 */
export type SignerReply =
  | { t: "ready" }
  | { t: "state"; id?: string; unlocked: boolean; pubkey?: string; name?: string; picture?: string; about?: string; until?: number; remembered?: boolean }
  | { t: "signed"; id: string; event: NostrEvent }
  | { t: "refused"; id: string };

const ID = /^[0-9a-z-]{1,40}$/i;
const wrapped = (data: unknown): Record<string, unknown> | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return d.nswp === SIGNER_PROTOCOL && d.v === SIGNER_VERSION && typeof d.t === "string" ? d : null;
};

export const signerMessage = <T extends SignerRequest | SignerReply>(message: T): T & { nswp: string; v: number } => ({ nswp: SIGNER_PROTOCOL, v: SIGNER_VERSION, ...message });

/** Read what a world sent the signer. Null for anything else. The event is checked later, by `prepareForWorld`. */
export function readSignerRequest(data: unknown): SignerRequest | null {
  const d = wrapped(data);
  if (!d || typeof d.id !== "string" || !ID.test(d.id)) return null;
  if (d.t === "state") return { t: "state", id: d.id };
  if (d.t === "lock") return { t: "lock", id: d.id };
  if (d.t === "sign" && d.event && typeof d.event === "object") return { t: "sign", id: d.id, event: d.event as { kind: number; content: string; tags: string[][] } };
  if (d.t === "pass" && isHex64(d.session)) return { t: "pass", id: d.id, session: d.session };
  return null;
}

/** Read what the signer sent a world. Null for anything else. A signed note is checked by the caller. */
export function readSignerReply(data: unknown): SignerReply | null {
  const d = wrapped(data);
  if (!d) return null;
  if (d.t === "ready") return { t: "ready" };
  if (d.t === "state" && typeof d.unlocked === "boolean") {
    const pubkey = typeof d.pubkey === "string" && /^[0-9a-f]{64}$/.test(d.pubkey) ? d.pubkey : undefined;
    return {
      t: "state",
      ...(typeof d.id === "string" && ID.test(d.id) ? { id: d.id } : {}),
      unlocked: d.unlocked && !!pubkey,
      ...(pubkey ? { pubkey } : {}),
      ...(typeof d.name === "string" && cleanLine(d.name, 48) ? { name: cleanLine(d.name, 48) } : {}),
      // Their own picture and words, as their sign-in address read them from their profile: cleaned as a pass's are.
      ...(pubkey && cleanPicture(d.picture) ? { picture: cleanPicture(d.picture) } : {}),
      ...(pubkey && cleanAbout(d.about) ? { about: cleanAbout(d.about) } : {}),
      ...(typeof d.until === "number" && Number.isFinite(d.until) ? { until: d.until } : {}),
      // Whether the signer will still be unlocked for this world on their next visit, where it says.
      ...(pubkey && d.unlocked && typeof d.remembered === "boolean" ? { remembered: d.remembered } : {}),
    };
  }
  if (typeof d.id !== "string" || !ID.test(d.id)) return null;
  if (d.t === "refused") return { t: "refused", id: d.id };
  if (d.t === "signed" && d.event && typeof d.event === "object") return { t: "signed", id: d.id, event: d.event as NostrEvent };
  return null;
}

// ---- What the client's window and its own signer say to each other, across the world's page. These are only ever
// delivered between two pages of the client's own origin: the browser sees to that, and each side checks it.

export const HANDOFF_PROTOCOL = "nswp-handoff";

export type HandoffMessage =
  /** Window to every frame of the page that opened it: "is one of you mine?" */
  | { t: "hello"; nonce: string }
  /** Signer to window: which world embeds it (as the browser says), and a throwaway key to seal the hand-off to. */
  | { t: "frame"; nonce: string; world: string; recipient: string }
  /** Window to signer, after the visitor pressed Allow: the sealed hand-off, for that world. */
  | { t: "grant"; nonce: string; world: string; sealed: { senderPublicKey: string; payload: string }; name?: string }
  /** Signer to window: it is unlocked, or it could not be. */
  | { t: "done"; nonce: string; ok: boolean };

export const handoffMessage = <T extends HandoffMessage>(message: T): T & { nswp: string; v: number } => ({ nswp: HANDOFF_PROTOCOL, v: SIGNER_VERSION, ...message });

export function readHandoffMessage(data: unknown): HandoffMessage | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.nswp !== HANDOFF_PROTOCOL || d.v !== SIGNER_VERSION || typeof d.nonce !== "string" || !ID.test(d.nonce)) return null;
  const hex = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
  if (d.t === "hello") return { t: "hello", nonce: d.nonce };
  if (d.t === "frame" && cleanOrigin(d.world) && hex(d.recipient)) return { t: "frame", nonce: d.nonce, world: cleanOrigin(d.world), recipient: d.recipient };
  if (d.t === "grant" && cleanOrigin(d.world) && d.sealed && typeof d.sealed === "object") {
    const s = d.sealed as Record<string, unknown>;
    if (!hex(s.senderPublicKey) || typeof s.payload !== "string" || s.payload.length > 4000) return null;
    return { t: "grant", nonce: d.nonce, world: cleanOrigin(d.world), sealed: { senderPublicKey: s.senderPublicKey, payload: s.payload }, ...(typeof d.name === "string" && cleanLine(d.name, 48) ? { name: cleanLine(d.name, 48) } : {}) };
  }
  if (d.t === "done" && typeof d.ok === "boolean") return { t: "done", nonce: d.nonce, ok: d.ok };
  return null;
}
