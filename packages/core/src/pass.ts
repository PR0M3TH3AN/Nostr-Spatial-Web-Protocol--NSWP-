/**
 * Passes (protocol/10-identity.md): how a visitor is known by name in a world
 * that never holds their key.
 *
 * The visitor's own client makes a throwaway session key for one trip and
 * signs a pass with their identity key: "at this site, until this time, this
 * session key speaks for me". The world is handed the pass and the session
 * key. Anyone who checks the pass knows which identity is behind the session
 * key, and the identity key itself never leaves the client.
 */
import { getTags, isHex64, nowSeconds, verifyEvent, type EventTemplate } from "./event.js";
import { Collector, type Result } from "./result.js";
import { ROOM_PASS_KIND } from "./room.js";

export const PASS_LIMITS = {
  defaultTtlSec: 4 * 3600,
  maxTtlSec: 12 * 3600,
  /** How far a reader's clock and a signer's may disagree. */
  skewSec: 120,
  nameChars: 48,
  /** A pass as JSON, as it travels between the members of a room. */
  chars: 4000,
} as const;

/**
 * A name as it may be shown: one line, no control or formatting characters,
 * no doubled spaces, at most 48 characters. Returns "" when nothing is left.
 */
export function cleanName(name: string): string {
  const cleaned = name
    .normalize("NFC")
    // Control characters, and the invisible ones that reorder or hide text.
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...cleaned].slice(0, PASS_LIMITS.nameChars).join("").trim();
}

/** A seed that is a public key is a claim to that key. Only a pass makes the claim good. */
export function claimsKey(seed: string): boolean {
  return /^[0-9a-f]{64}$/i.test(seed);
}

export interface RoomPassInput {
  /** The session public key the pass speaks for. */
  session: string;
  /** The world's address, or its origin. The pass is good at that origin and nowhere else. */
  origin: string;
  /** The name to be known by. Cleaned; left out when nothing is left. */
  name?: string;
  createdAt?: number;
  ttlSec?: number;
}

/** A pass, ready for the identity key to sign. */
export function buildRoomPass(input: RoomPassInput): EventTemplate {
  const created = input.createdAt ?? nowSeconds();
  const ttl = Math.max(60, Math.min(input.ttlSec ?? PASS_LIMITS.defaultTtlSec, PASS_LIMITS.maxTtlSec));
  const tags: string[][] = [
    ["nswp:session", input.session],
    ["nswp:origin", new URL(input.origin).origin],
    ["expiration", String(created + ttl)],
  ];
  const name = input.name ? cleanName(input.name) : "";
  if (name) tags.push(["name", name]);
  return { kind: ROOM_PASS_KIND, created_at: created, tags, content: "" };
}

export interface VerifyPassOptions {
  /** The origin of the world doing the checking. */
  origin: string;
  /** The session key the pass must speak for: the key the member is using. */
  session?: string;
  now?: number;
}

export interface VerifiedPass {
  /** The identity behind the session key. */
  pubkey: string;
  session: string;
  /** The name they chose to be known by, cleaned, or "" for none. */
  name: string;
  expiresAt: number;
  id: string;
}

/** Check a pass. Nothing about it is believed until this says so. */
export function verifyRoomPass(event: unknown, opts: VerifyPassOptions): Result<VerifiedPass> {
  const c = new Collector();
  if (!verifyEvent(event)) {
    c.error("bad_signature", "", "The pass is not a validly signed Nostr event.");
    return c.result(null as never);
  }
  const now = opts.now ?? nowSeconds();
  if (event.kind !== ROOM_PASS_KIND) c.error("wrong_kind", "kind", `Expected kind ${ROOM_PASS_KIND}.`);
  const one = (name: string) => {
    const t = getTags(event, name);
    if (t.length !== 1 || !t[0]![1]) {
      c.error(t.length > 1 ? "duplicate_tag" : "missing_tag", `tags.${name}`, `Exactly one "${name}" tag is required.`);
      return undefined;
    }
    return t[0]![1];
  };
  const session = one("nswp:session");
  const origin = one("nswp:origin");
  const exp = one("expiration");
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(opts.origin).origin;
  } catch {
    c.error("invalid_option", "origin", "opts.origin is not a URL.");
    return c.result(null as never);
  }
  if (session !== undefined) {
    if (!isHex64(session)) c.error("invalid_session", "tags.nswp:session", "The session key must be 64 lowercase hex characters.");
    else if (session === event.pubkey) c.error("invalid_session", "tags.nswp:session", "A pass can't name the identity key as its own session key.");
    else if (opts.session !== undefined && session !== opts.session) c.error("session_mismatch", "tags.nswp:session", "The pass speaks for a different session key.");
  }
  if (origin !== undefined && origin !== expectedOrigin) c.error("origin_mismatch", "tags.nswp:origin", "The pass was made for a different site.");
  const expiresAt = exp !== undefined ? Number(exp) : NaN;
  if (exp !== undefined) {
    if (!/^\d+$/.test(exp) || !Number.isSafeInteger(expiresAt)) c.error("invalid_expiration", "tags.expiration", "expiration must be an integer timestamp.");
    else {
      if (expiresAt <= now) c.error("pass_expired", "tags.expiration", "The pass has expired.");
      if (expiresAt - event.created_at > PASS_LIMITS.maxTtlSec) c.error("ttl_too_long", "tags.expiration", `A pass may live at most ${PASS_LIMITS.maxTtlSec / 3600} hours.`);
    }
  }
  if (event.created_at > now + PASS_LIMITS.skewSec) c.error("created_in_future", "created_at", "The pass is dated in the future.");
  const names = getTags(event, "name");
  if (names.length > 1) c.warn("duplicate_tag", "tags.name", "Only the first name is used.");
  const raw = names[0]?.[1] ?? "";
  const name = cleanName(raw);
  if (raw !== name) c.warn("name_cleaned", "tags.name", "The name was tidied before being shown.");
  return c.result({ pubkey: event.pubkey, session: session ?? "", name, expiresAt, id: event.id });
}
