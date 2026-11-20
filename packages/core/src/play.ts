/**
 * Items in play: what an item's own logic may ask for, the things it sends out, and what happens to a person one
 * of them reaches (protocol/17-items.md, "What an item does" and "People as part of the game").
 *
 * This file is the pure part, the same for every engine: what is said between the people in a room, the arc a
 * thing flies on, the ceilings on all of it, and what a person's state is. It draws nothing and runs nothing.
 *
 * Who decides what:
 * - **The item's script** (on its carrier's device only) decides when it sends something out.
 * - **Everyone's kit** flies the same arc from the same few numbers, so everyone sees the same flight.
 * - **The person it reaches** decides that it reached them, by their own device, and says so.
 * - **The world** decides what that means. Where it says nothing, these are the rules.
 */
import { isHex64 } from "./event.js";

/** How fast things fall, in metres a second, each second. The same everywhere, so an arc is the same for all. */
export const GRAVITY = 9.8;

export const PLAY_LIMITS = {
  /** The fastest anything may be sent out, in metres a second. */
  speed: 40,
  /** The longest a thing may stay stuck where it landed, in seconds. */
  stick: 10,
  /** The longest a thing may fly before it is gone, in seconds. */
  life: 5,
  /** How far from the middle of a world anything may be said to start, in metres. */
  far: 10000,
  /** How many things one person may send out: a burst, and then so many a second. */
  burst: 8,
  perSecond: 6,
  /** How many of anyone's things are flown or left lying at once. The oldest go first. */
  flown: 48,
  /** How long a hit may wait for the person hit to say so, in seconds, before the thing drops off them. */
  agree: 0.6,
  /** The most an item's own words may be: its counter. */
  words: 24,
} as const;

const NAME = /^[a-z][a-z0-9-]{0,23}$/;
const num = (x: number) => String(Math.round(x * 1000) / 1000);
const finite = (xs: number[], most: number) => xs.every((x) => Number.isFinite(x) && Math.abs(x) <= most);

/** One thing sent out: which of its item's things it is, where it started, and how it was going. */
export interface Shot {
  /** Its number among the things its sender has sent out on this visit. */
  id: number;
  /** Which of the item's described things it is. */
  name: string;
  from: [number, number, number];
  /** Metres a second. */
  velocity: [number, number, number];
  /** How long it stays where it lands, in seconds. */
  stick: number;
}

/**
 * A thing sent out, as it is said to a room. Null if it couldn't be: no name, a place or a speed that isn't a
 * number. Speed and stick are brought within their ceilings here, and again by whoever reads it.
 */
export function buildShot(o: Shot): string | null {
  const shot = cleanShot(o);
  return shot ? `shot:${shot.id},${shot.name},${[...shot.from, ...shot.velocity, shot.stick].map(num).join(",")}` : null;
}

function cleanShot(o: Shot): Shot | null {
  if (!o || !Number.isInteger(o.id) || o.id < 0 || o.id > 0xffffffff || typeof o.name !== "string" || !NAME.test(o.name)) return null;
  if (!Array.isArray(o.from) || o.from.length !== 3 || !finite(o.from, PLAY_LIMITS.far)) return null;
  if (!Array.isArray(o.velocity) || o.velocity.length !== 3 || !finite(o.velocity, 1e6)) return null;
  const speed = Math.hypot(...o.velocity);
  if (speed < 0.01) return null;
  const k = Math.min(1, PLAY_LIMITS.speed / speed);
  const stick = Number.isFinite(o.stick) ? Math.min(PLAY_LIMITS.stick, Math.max(0, o.stick)) : 0;
  return { id: o.id, name: o.name, from: [...o.from] as Shot["from"], velocity: o.velocity.map((v) => v * k) as Shot["velocity"], stick };
}

/** Read what a member said they sent out. Null for anything that isn't one. */
export function parseShot(text: unknown): Shot | null {
  if (typeof text !== "string" || !text.startsWith("shot:") || text.length > 200) return null;
  const parts = text.slice(5).split(",");
  if (parts.length !== 9) return null;
  const n = parts.slice(2).map(Number);
  return cleanShot({ id: Number(parts[0]), name: parts[1]!, from: [n[0]!, n[1]!, n[2]!], velocity: [n[3]!, n[4]!, n[5]!], stick: n[6]! });
}

/** Where a thing is, `t` seconds after it was sent out: straight on, and falling. */
export function shotAt(shot: Pick<Shot, "from" | "velocity">, t: number): [number, number, number] {
  return [shot.from[0] + shot.velocity[0] * t, shot.from[1] + shot.velocity[1] * t - 0.5 * GRAVITY * t * t, shot.from[2] + shot.velocity[2] * t];
}

/** Someone saying a thing reached them: whose it was, which, and where on them (from their feet, in metres). */
export interface Hit {
  /** Who sent it out. */
  by: string;
  id: number;
  /** Where it struck, from the middle of where they stand, at floor height. */
  at: [number, number, number];
}

export function buildHit(o: Hit): string | null {
  if (!o || !isHex64(o.by) || !Number.isInteger(o.id) || o.id < 0 || !Array.isArray(o.at) || o.at.length !== 3 || !finite(o.at, 4)) return null;
  return `hit:${o.by},${o.id},${o.at.map(num).join(",")}`;
}

export function parseHit(text: unknown): Hit | null {
  if (typeof text !== "string" || !text.startsWith("hit:") || text.length > 160) return null;
  const parts = text.slice(4).split(",");
  if (parts.length !== 5) return null;
  const at = parts.slice(2).map(Number) as Hit["at"];
  const hit = { by: parts[0]!, id: Number(parts[1]), at };
  return buildHit(hit) ? hit : null;
}

/** Something an item did that the others see or hear: one of its own sounds, or one of its own animations. */
export interface Did {
  kind: "sound" | "clip";
  name: string;
}
const CLIP = /^[\w .-]{1,64}$/;

export function buildDid(o: Did): string | null {
  if (!o || (o.kind !== "sound" && o.kind !== "clip") || typeof o.name !== "string") return null;
  if (o.kind === "sound" ? !NAME.test(o.name) : !CLIP.test(o.name)) return null;
  return `did:${o.kind},${o.name}`;
}

export function parseDid(text: unknown): Did | null {
  if (typeof text !== "string" || !text.startsWith("did:") || text.length > 90) return null;
  const at = text.indexOf(",");
  const did = { kind: text.slice(4, at) as Did["kind"], name: text.slice(at + 1) };
  return at > 0 && buildDid(did) ? did : null;
}

// ---------------------------------------------------------------- a person's state

/**
 * The state a world keeps of a person, where it keeps none of its own: health. It is theirs to say, as a hit is.
 * A world with a game of its own defines what it likes; this is what a place that only allows items has.
 */
export const HEALTH = {
  /** How much someone has when nothing has reached them. */
  full: 5,
  /** The most one thing may take at once. */
  most: 5,
  /** After this long with nothing reaching them, they are back to full, in seconds. */
  restSeconds: 6,
  /** How long they stay at nothing before they are back to full, in seconds. */
  downSeconds: 3,
} as const;

/** How much of something a person has, as they say it to the room: "st:health,3,5". */
export interface PersonState {
  name: "health";
  value: number;
  full: number;
}

export function buildState(o: PersonState): string | null {
  if (!o || o.name !== "health" || !Number.isInteger(o.value) || !Number.isInteger(o.full) || o.full < 1 || o.full > 1000 || o.value < 0 || o.value > o.full) return null;
  return `st:${o.name},${o.value},${o.full}`;
}

export function parseState(text: unknown): PersonState | null {
  if (typeof text !== "string" || !text.startsWith("st:") || text.length > 40) return null;
  const [name, value, full] = text.slice(3).split(",");
  const state = { name: name as "health", value: Number(value), full: Number(full) };
  return buildState(state) ? state : null;
}

/**
 * What a person has after something reached them, by the rules of a place with none of its own: `by` is taken
 * (never more than `HEALTH.most` at once, never below nothing).
 */
export function struck(value: number, by: number): number {
  const take = Math.min(HEALTH.most, Math.max(0, Math.round(Math.abs(by))));
  return Math.max(0, Math.round(value) - take);
}

// ---------------------------------------------------------------- reaching a person

/**
 * Where along the way from `a` to `b` a thing first meets a person: a standing capsule of `radius`, from their feet
 * at `feet` up to `height`. Returns how far along (0 at `a`, 1 at `b`), or null if it passes them by. A person is
 * a simple shape that things can hit, and never the drawn figure.
 */
export function meetsPerson(a: readonly number[], b: readonly number[], feet: readonly number[], height: number, radius: number): number | null {
  // The capsule's spine runs from one radius above the floor to one radius below the top.
  const lo = feet[1]! + radius;
  const hi = Math.max(lo, feet[1]! + height - radius);
  const d = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
  let best: number | null = null;
  // Walked in small steps: a dart's step in one frame is short, and this needs no more than that.
  const steps = Math.max(1, Math.ceil(Math.hypot(d[0]!, d[1]!, d[2]!) / (radius / 2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = [a[0]! + d[0]! * t, a[1]! + d[1]! * t, a[2]! + d[2]! * t];
    const y = Math.min(hi, Math.max(lo, p[1]!));
    if (Math.hypot(p[0]! - feet[0]!, p[1]! - y, p[2]! - feet[2]!) <= radius) {
      best = t;
      break;
    }
  }
  return best;
}

/** A person's shape for things to hit: how tall, and how wide, in metres. */
export const PERSON_SHAPE = { radius: 0.28 } as const;

// ---------------------------------------------------------------- what an item's logic may ask for

/**
 * Everything an item's script may ask of the kit, and how often (protocol/17-items.md, "An item's own logic").
 * A closed list: a script that asks for anything else is asking for nothing. Each is `burst` at once, and then
 * `perSecond`.
 */
export const ITEM_ASKS = {
  /** Play one of its own sounds, by name. */
  play: { burst: 6, perSecond: 6 },
  /** Play one of its own animations, by name. */
  clip: { burst: 4, perSecond: 4 },
  /** Send out one of the things it has described. */
  send: { burst: PLAY_LIMITS.burst, perSecond: PLAY_LIMITS.perSecond },
  /** Show its own words: a counter. */
  show: { burst: 8, perSecond: 8 },
} as const;
export type ItemAsk = keyof typeof ITEM_ASKS;

/** What an item's script is told of: its own item, and the passing of time. Nothing of the visitor or the world. */
export const ITEM_EVENTS = ["held", "away", "use", "second", "tick"] as const;
export type ItemEvent = (typeof ITEM_EVENTS)[number];

/** The longest an item's script may be, in bytes, and how long it may go without answering before it is stopped. */
export const SCRIPT_LIMITS = { bytes: 64_000, silentMs: 1500 } as const;

/** A gate that lets `burst` through at once and then `perSecond`: for what one person, or one script, may ask. */
export function createRate(burst: number, perSecond: number): { take(nowMs: number): boolean } {
  let have = burst;
  let last: number | null = null;
  return {
    take(nowMs) {
      if (last !== null) have = Math.min(burst, have + ((nowMs - last) / 1000) * perSecond);
      last = nowMs;
      if (have < 1) return false;
      have -= 1;
      return true;
    },
  };
}

/** An ask as the kit takes it from a script: its name on the list, and what goes with it, tidied. Null otherwise. */
export function cleanAsk(name: unknown, args: unknown): { ask: "play" | "clip"; name: string } | { ask: "send"; name: string; speed: number; stick: number; lift: number } | { ask: "show"; text: string } | null {
  const a = Array.isArray(args) ? args : [];
  if (name === "play") return typeof a[0] === "string" && NAME.test(a[0]) ? { ask: "play", name: a[0] } : null;
  if (name === "clip") return typeof a[0] === "string" && CLIP.test(a[0]) ? { ask: "clip", name: a[0] } : null;
  if (name === "show") {
    if (typeof a[0] !== "string") return null;
    // Its own few words: plain letters, digits and a little punctuation, so nothing can pass for the kit's own.
    return { ask: "show", text: [...a[0].replace(/[^\p{L}\p{N} /:.,+\-·]/gu, "")].slice(0, PLAY_LIMITS.words).join("") };
  }
  if (name === "send") {
    const o = (a[1] && typeof a[1] === "object" ? a[1] : {}) as Record<string, unknown>;
    const within = (x: unknown, least: number, most: number, otherwise: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(most, Math.max(least, x)) : otherwise);
    return typeof a[0] === "string" && NAME.test(a[0]) ? { ask: "send", name: a[0], speed: within(o.speed, 1, PLAY_LIMITS.speed, 12), stick: within(o.stick, 0, PLAY_LIMITS.stick, 3), lift: within(o.lift, -0.5, 0.5, 0) } : null;
  }
  return null;
}
