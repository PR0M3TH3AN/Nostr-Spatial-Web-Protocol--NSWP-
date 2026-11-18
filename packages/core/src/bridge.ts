/**
 * The Bridge (browser/bridge.md): the pure parts of opening a terminal on a
 * person's own computer from their home.
 *
 * A grant is the owner's word that one throwaway session key may open a
 * terminal on one Bridge, for a few minutes. It has its own kind, and names a
 * Bridge and never a site, so it can't be mistaken for a pass
 * (protocol/10-identity.md) and a pass can't be mistaken for it.
 *
 * None of this is part of the protocol a world implements.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey, getTagValue, getTags, isHex64, nowSeconds, verifyEvent, type EventTemplate, type NostrEvent } from "./event.js";
import { getConversationKey, nip44Decrypt, nip44Encrypt } from "./nip44.js";
import { Collector, type Result } from "./result.js";
import { ROOM_SIGNAL_KIND } from "./room.js";

/** Experimental, ephemeral-range kind; not allocated by the NIPs process. */
export const BRIDGE_GRANT_KIND = 27302;

export const BRIDGE_LIMITS = {
  /** How long a grant is good for connecting. The connection it opens may last longer. */
  grantTtlSec: 300,
  /** How far the Bridge's clock and the signer's may disagree. */
  skewSec: 120,
  /** Notes older or newer than this are ignored. */
  signalMaxAgeSec: 60,
  maxSdpChars: 20000,
  minCols: 20,
  maxCols: 300,
  minRows: 5,
  maxRows: 120,
  /** The largest frame either side sends or accepts, in bytes. */
  frameBytes: 65536,
  nameChars: 80,
  whyChars: 200,
} as const;

/** Where a Bridge listens on relays. */
export function bridgeTopic(bridge: string): string {
  return bytesToHex(sha256(utf8ToBytes(`nswp/bridge/1\n${bridge}`)));
}

/**
 * Four digits both ends work out from the grant, each on its own. The Bridge
 * shows them when it asks; the panel shows them while it waits. If they
 * differ, the question on the computer is about somebody else's request.
 */
export function grantCode(grantId: string): string {
  const n = parseInt(bytesToHex(sha256(utf8ToBytes(`nswp/bridge/code\n${grantId}`))).slice(0, 8), 16) % 10000;
  return String(n).padStart(4, "0");
}

export interface BridgeGrantInput {
  /** The throwaway session public key the grant is for. */
  session: string;
  /** The Bridge's public key. */
  bridge: string;
  createdAt?: number;
  ttlSec?: number;
}

/** A grant, ready for the owner's key to sign. */
export function buildBridgeGrant(input: BridgeGrantInput): EventTemplate {
  const created = input.createdAt ?? nowSeconds();
  const ttl = Math.max(30, Math.min(input.ttlSec ?? BRIDGE_LIMITS.grantTtlSec, BRIDGE_LIMITS.grantTtlSec));
  return {
    kind: BRIDGE_GRANT_KIND,
    created_at: created,
    tags: [
      ["nswp:session", input.session],
      ["nswp:bridge", input.bridge],
      ["expiration", String(created + ttl)],
    ],
    content: "",
  };
}

export interface VerifyGrantOptions {
  /** The one key this Bridge answers. */
  owner: string;
  /** This Bridge's own public key. */
  bridge: string;
  /** The key that sent the grant: it must be the session key the grant names. */
  session: string;
  now?: number;
  /** The ids of grants already used. */
  seen?: { has(id: string): boolean };
}

export interface VerifiedGrant {
  id: string;
  session: string;
  expiresAt: number;
}

/** Check a grant. Nothing opens until this says so. */
export function verifyBridgeGrant(event: unknown, opts: VerifyGrantOptions): Result<VerifiedGrant> {
  const c = new Collector();
  if (!verifyEvent(event)) {
    c.error("bad_signature", "", "The grant is not a validly signed Nostr event.");
    return c.result(null as never);
  }
  const now = opts.now ?? nowSeconds();
  if (event.kind !== BRIDGE_GRANT_KIND) c.error("wrong_kind", "kind", `Expected kind ${BRIDGE_GRANT_KIND}.`);
  if (event.pubkey !== opts.owner) c.error("not_owner", "pubkey", "The grant was not signed by this Bridge's owner.");
  const one = (name: string) => {
    const t = getTags(event, name);
    if (t.length !== 1 || !t[0]![1]) {
      c.error(t.length > 1 ? "duplicate_tag" : "missing_tag", `tags.${name}`, `Exactly one "${name}" tag is required.`);
      return undefined;
    }
    return t[0]![1];
  };
  const session = one("nswp:session");
  const bridge = one("nswp:bridge");
  const exp = one("expiration");
  // Something that names a site is a pass, or was made to look like one.
  if (getTags(event, "nswp:origin").length) c.error("names_a_site", "tags.nswp:origin", "A grant names a Bridge and never a site.");
  if (bridge !== undefined && bridge !== opts.bridge) c.error("bridge_mismatch", "tags.nswp:bridge", "The grant was made for a different Bridge.");
  if (session !== undefined) {
    if (!isHex64(session)) c.error("invalid_session", "tags.nswp:session", "The session key must be 64 lowercase hex characters.");
    else if (session === event.pubkey || session === opts.bridge) c.error("invalid_session", "tags.nswp:session", "The session key must be a throwaway: not the owner's key, and not the Bridge's.");
    else if (session !== opts.session) c.error("session_mismatch", "tags.nswp:session", "The grant is for a different session key.");
  }
  const expiresAt = exp !== undefined ? Number(exp) : NaN;
  if (exp !== undefined) {
    if (!/^\d+$/.test(exp) || !Number.isSafeInteger(expiresAt)) c.error("invalid_expiration", "tags.expiration", "expiration must be an integer timestamp.");
    else {
      if (expiresAt <= now) c.error("grant_expired", "tags.expiration", "The grant has expired.");
      if (expiresAt - event.created_at > BRIDGE_LIMITS.grantTtlSec) c.error("ttl_too_long", "tags.expiration", `A grant may live at most ${BRIDGE_LIMITS.grantTtlSec} seconds.`);
    }
  }
  if (event.created_at > now + BRIDGE_LIMITS.skewSec) c.error("created_in_future", "created_at", "The grant is dated in the future.");
  if (opts.seen?.has(event.id)) c.error("grant_reused", "id", "The grant has been used before.");
  return c.result({ id: event.id, session: session ?? "", expiresAt });
}

// ------------------------------------------------------------------- notes

export type BridgeMessage =
  | { t: "open"; grant: NostrEvent; sdp: string }
  /** The Bridge is asking at the computer. */
  | { t: "wait" }
  | { t: "answer"; sdp: string }
  | { t: "refused"; why: string };

function validMessage(m: unknown): m is BridgeMessage {
  if (typeof m !== "object" || m === null) return false;
  const o = m as Record<string, unknown>;
  const sdp = () => typeof o.sdp === "string" && o.sdp.length > 0 && o.sdp.length <= BRIDGE_LIMITS.maxSdpChars;
  switch (o.t) {
    case "open":
      return sdp() && typeof o.grant === "object" && o.grant !== null;
    case "wait":
      return true;
    case "answer":
      return sdp();
    case "refused":
      return typeof o.why === "string" && o.why.length <= BRIDGE_LIMITS.whyChars;
    default:
      return false;
  }
}

/**
 * A note for the other end, encrypted to its key (NIP-44). `bridge` is the
 * Bridge's public key, whichever end is writing. A reply names the note it
 * answers in `re`, so an old reply is never taken for a new one.
 */
export function buildBridgeSignal(bridge: string, key: Uint8Array, to: string, message: BridgeMessage, o: { re?: string; createdAt?: number } = {}): NostrEvent {
  const content = nip44Encrypt(JSON.stringify(message), getConversationKey(key, to));
  const tags = [["x", bridgeTopic(bridge)], ["p", to], ...(o.re ? [["e", o.re]] : [])];
  return finalizeEvent({ kind: ROOM_SIGNAL_KIND, created_at: o.createdAt ?? nowSeconds(), tags, content }, key);
}

export interface OpenedBridgeSignal {
  from: string;
  message: BridgeMessage;
  id: string;
  /** The id of the note this one answers, when it is a reply. */
  re?: string;
}

/**
 * Check and decrypt a note. Returns null for anything that isn't a valid,
 * fresh note addressed to this key on this Bridge's topic. Who it is from,
 * and what it answers, are for the caller to judge: the Bridge by the grant
 * inside, the page by the Bridge's key and its own request's id.
 */
export function openBridgeSignal(event: unknown, key: Uint8Array, bridge: string, now = nowSeconds()): OpenedBridgeSignal | null {
  if (!verifyEvent(event) || event.kind !== ROOM_SIGNAL_KIND) return null;
  if (getTagValue(event, "x") !== bridgeTopic(bridge)) return null;
  if (Math.abs(now - event.created_at) > BRIDGE_LIMITS.signalMaxAgeSec) return null;
  const self = getPublicKey(key);
  if (event.pubkey === self || getTagValue(event, "p") !== self) return null;
  let message: unknown;
  try {
    message = JSON.parse(nip44Decrypt(event.content, getConversationKey(key, event.pubkey)));
  } catch {
    return null;
  }
  if (!validMessage(message)) return null;
  // An `open` begins a conversation; everything else answers one.
  const re = getTagValue(event, "e");
  if ((message.t === "open") !== (re === undefined)) return null;
  if (re !== undefined && !isHex64(re)) return null;
  return { from: event.pubkey, message, id: event.id, ...(re !== undefined ? { re } : {}) };
}

// ----------------------------------------------------------------- channel

export type BridgeControl = { t: "size"; cols: number; rows: number } | { t: "ready"; name: string } | { t: "exit"; code: number };

const whole = (n: unknown, lo: number, hi: number): number | null => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : null);

/** A terminal's size, held to what a Bridge will make. */
export function cleanSize(cols: unknown, rows: unknown): { cols: number; rows: number } | null {
  const c = whole(cols, BRIDGE_LIMITS.minCols, BRIDGE_LIMITS.maxCols);
  const r = whole(rows, BRIDGE_LIMITS.minRows, BRIDGE_LIMITS.maxRows);
  return c === null || r === null ? null : { cols: c, rows: r };
}

/** Read a text frame from the channel. Returns null for anything that isn't one of the few things either side says. */
export function parseBridgeControl(text: string): BridgeControl | null {
  if (text.length > 1000) return null;
  let o: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;
    o = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (o.t === "size") {
    const size = cleanSize(o.cols, o.rows);
    return size ? { t: "size", ...size } : null;
  }
  if (o.t === "ready") {
    if (typeof o.name !== "string") return null;
    // One line that can be shown as it is.
    const name = [...o.name.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g, " ").replace(/\s+/g, " ").trim()].slice(0, BRIDGE_LIMITS.nameChars).join("");
    return { t: "ready", name };
  }
  if (o.t === "exit") {
    const code = whole(o.code, -1, 255);
    return code === null ? null : { t: "exit", code };
  }
  return null;
}
