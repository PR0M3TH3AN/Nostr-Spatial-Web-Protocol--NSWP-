/**
 * Shared rooms: the pure parts of the peer-to-peer handshake (spec §9.4).
 *
 * This is the Phase 4b SPIKE format: guests only, rooms named by a string
 * instead of a room event, no room passes. It will change when room events
 * and passes are implemented.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey, getTagValue, isHex64, nowSeconds, verifyEvent, type NostrEvent } from "./event.js";
import { getConversationKey, nip44Decrypt, nip44Encrypt } from "./nip44.js";

/** Experimental, ephemeral-range kinds; not allocated by the NIPs process. */
export const ROOM_PASS_KIND = 27300;
export const ROOM_SIGNAL_KIND = 27301;

export const ROOM_LIMITS = {
  defaultMaxMembers: 8,
  /** Handshake messages older or newer than this are ignored. */
  signalMaxAgeSec: 60,
  maxSdpChars: 20000,
  maxNameChars: 48,
} as const;

/**
 * Where a room's handshake happens on relays. It is a hash, so knowing a
 * world's address is not enough to find a room with an unguessable name.
 */
export function roomTopic(worldUrl: string, roomName: string): string {
  const u = new URL(worldUrl);
  return bytesToHex(sha256(utf8ToBytes(`nswp/room/spike-1\n${u.origin}${u.pathname}\n${roomName}`)));
}

/** Of two members, the one with the lower session pubkey makes the offer. */
export function shouldInitiate(self: string, other: string): boolean {
  return self < other;
}

export function guestName(pubkey: string): string {
  return `Guest ${pubkey.slice(0, 4)}`;
}

/** A stable colour per session key, as a 24-bit RGB number. */
export function guestColor(pubkey: string): number {
  const hue = parseInt(pubkey.slice(4, 8), 16) / 0xffff;
  const f = (n: number) => {
    const k = (n + hue * 12) % 12;
    return Math.round(255 * (0.6 - 0.4 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

/** Spreads arrivals around a spawn point so people don't appear inside each other. */
export function spawnOffset(pubkey: string, radius = 1.3): { x: number; z: number } {
  const angle = (parseInt(pubkey.slice(8, 12), 16) / 0xffff) * Math.PI * 2;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

export type SignalMessage =
  | { t: "hello"; v: 1 }
  | { t: "welcome" }
  | { t: "offer"; sdp: string }
  | { t: "answer"; sdp: string }
  | { t: "bye" };

function validMessage(m: unknown): m is SignalMessage {
  if (typeof m !== "object" || m === null) return false;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case "hello":
      return o.v === 1;
    case "welcome":
    case "bye":
      return true;
    case "offer":
    case "answer":
      return typeof o.sdp === "string" && o.sdp.length > 0 && o.sdp.length <= ROOM_LIMITS.maxSdpChars;
    default:
      return false;
  }
}

/** A public "I'm here" on the room's topic. Carries nothing but the session key. */
export function buildHello(topic: string, sessionKey: Uint8Array, createdAt = nowSeconds()): NostrEvent {
  return finalizeEvent({ kind: ROOM_SIGNAL_KIND, created_at: createdAt, tags: [["x", topic]], content: JSON.stringify({ t: "hello", v: 1 }) }, sessionKey);
}

/** A message for one member, encrypted to their session key (NIP-44). */
export function buildSignal(topic: string, sessionKey: Uint8Array, to: string, message: Exclude<SignalMessage, { t: "hello" }>, createdAt = nowSeconds()): NostrEvent {
  const content = nip44Encrypt(JSON.stringify(message), getConversationKey(sessionKey, to));
  return finalizeEvent({ kind: ROOM_SIGNAL_KIND, created_at: createdAt, tags: [["x", topic], ["p", to]], content }, sessionKey);
}

export interface OpenedSignal {
  from: string;
  message: SignalMessage;
  id: string;
}

/**
 * Check and decrypt a handshake event. Returns null for anything that isn't a
 * valid, fresh message for this member in this room: wrong topic, bad
 * signature, stale, addressed to someone else, or our own.
 */
export function openSignal(event: unknown, sessionKey: Uint8Array, topic: string, now = nowSeconds()): OpenedSignal | null {
  if (!verifyEvent(event) || event.kind !== ROOM_SIGNAL_KIND) return null;
  if (getTagValue(event, "x") !== topic) return null;
  if (Math.abs(now - event.created_at) > ROOM_LIMITS.signalMaxAgeSec) return null;
  const self = getPublicKey(sessionKey);
  if (event.pubkey === self) return null;
  const to = getTagValue(event, "p");
  let text: string;
  if (to === undefined) text = event.content;
  else {
    if (to !== self || !isHex64(to)) return null;
    try {
      text = nip44Decrypt(event.content, getConversationKey(sessionKey, event.pubkey));
    } catch {
      return null;
    }
  }
  let message: unknown;
  try {
    message = JSON.parse(text);
  } catch {
    return null;
  }
  if (!validMessage(message)) return null;
  // A hello must be public and everything else must be addressed.
  if ((message.t === "hello") !== (to === undefined)) return null;
  return { from: event.pubkey, message, id: event.id };
}

// ----------------------------------------------------------------- poses

export interface Transform {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

export interface Pose {
  head: Transform;
  left?: Transform;
  right?: Transform;
}

const POSE_FLOATS = 22;
export const POSE_BYTES = POSE_FLOATS * 4;
const IDENTITY: Transform = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] };

export function packPose(pose: Pose): ArrayBuffer {
  const f = new Float32Array(POSE_FLOATS);
  const put = (t: Transform, at: number) => {
    f.set(t.position, at);
    f.set(t.quaternion, at + 3);
  };
  put(pose.head, 0);
  put(pose.left ?? IDENTITY, 7);
  put(pose.right ?? IDENTITY, 14);
  f[21] = (pose.left ? 1 : 0) | (pose.right ? 2 : 0);
  return f.buffer;
}

/** Returns null for anything malformed: wrong size, non-finite or absurd values. */
export function unpackPose(data: ArrayBuffer): Pose | null {
  if (data.byteLength !== POSE_BYTES) return null;
  const f = new Float32Array(data);
  for (let i = 0; i < 21; i++) if (!Number.isFinite(f[i]!) || Math.abs(f[i]!) > 10000) return null;
  const get = (at: number): Transform => ({
    position: [f[at]!, f[at + 1]!, f[at + 2]!],
    quaternion: [f[at + 3]!, f[at + 4]!, f[at + 5]!, f[at + 6]!],
  });
  const flags = f[21]!;
  const pose: Pose = { head: get(0) };
  if (flags === 1 || flags === 3) pose.left = get(7);
  if (flags === 2 || flags === 3) pose.right = get(14);
  return pose;
}
