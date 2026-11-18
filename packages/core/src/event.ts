/** Minimal NIP-01 event handling: hashing, signing, verification, shape checks. */
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export interface EventTemplate {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export interface UnsignedEvent extends EventTemplate {
  pubkey: string;
}

export interface NostrEvent extends UnsignedEvent {
  id: string;
  sig: string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

export function isHex64(v: unknown): v is string {
  return typeof v === "string" && HEX64.test(v);
}

/**
 * Whether 64 hex characters are a public key at all. About half of all such
 * strings are not: no point on the curve has that x. A key written down by a
 * person, or handed over in a link, is checked with this before it is kept.
 */
export function isPublicKey(v: unknown): v is string {
  if (!isHex64(v)) return false;
  try {
    schnorr.utils.lift_x(BigInt(`0x${v}`));
    return true;
  } catch {
    return false;
  }
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function serializeEvent(e: UnsignedEvent): string {
  return JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]);
}

export function getEventHash(e: UnsignedEvent): string {
  return bytesToHex(sha256(utf8ToBytes(serializeEvent(e))));
}

export function getPublicKey(secretKey: Uint8Array): string {
  return bytesToHex(schnorr.getPublicKey(secretKey));
}

/**
 * Sign a template. `auxRand` exists only for reproducible test vectors;
 * leave it unset for anything real.
 */
export function finalizeEvent(template: EventTemplate, secretKey: Uint8Array, auxRand?: Uint8Array): NostrEvent {
  const pubkey = getPublicKey(secretKey);
  const unsigned: UnsignedEvent = {
    kind: template.kind,
    created_at: template.created_at,
    tags: template.tags,
    content: template.content,
    pubkey,
  };
  const id = getEventHash(unsigned);
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), secretKey, auxRand));
  return { ...unsigned, id, sig };
}

/** True if `v` has the field types of a NIP-01 event (signature not checked). */
export function hasEventShape(v: unknown): v is NostrEvent {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    Number.isInteger(e.kind) &&
    (e.kind as number) >= 0 &&
    Number.isInteger(e.created_at) &&
    typeof e.content === "string" &&
    Array.isArray(e.tags) &&
    e.tags.every((t) => Array.isArray(t) && t.every((x) => typeof x === "string")) &&
    isHex64(e.pubkey) &&
    isHex64(e.id) &&
    typeof e.sig === "string" &&
    HEX128.test(e.sig)
  );
}

/** Checks shape, that `id` is the event hash, and the BIP-340 signature. */
export function verifyEvent(v: unknown): v is NostrEvent {
  if (!hasEventShape(v)) return false;
  if (getEventHash(v) !== v.id) return false;
  try {
    return schnorr.verify(hexToBytes(v.sig), hexToBytes(v.id), hexToBytes(v.pubkey));
  } catch {
    return false;
  }
}

export function getTags(e: { tags: string[][] }, name: string): string[][] {
  return e.tags.filter((t) => t[0] === name);
}

export function getTagValue(e: { tags: string[][] }, name: string): string | undefined {
  return e.tags.find((t) => t[0] === name)?.[1];
}
