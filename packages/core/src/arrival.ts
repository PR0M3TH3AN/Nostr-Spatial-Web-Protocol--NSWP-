/** Arrival context and entry assertions (spec §4.4). */
import { cleanSettings, hasSettings, type TravelSettings } from "./settings.js";
import { base64urlnopad } from "@scure/base";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { ENTRY_ASSERTION_KIND, LIMITS, SCHEMAS } from "./constants.js";
import { isHttpsUrl } from "./destination.js";
import { getPublicKey, getTags, getTagValue, hasEventShape, isHex64, nowSeconds, verifyEvent, type EventTemplate, type NostrEvent } from "./event.js";
import { decodeLook } from "./avatar.js";
import { decodeNaddr } from "./nip19.js";
import { Collector, isPlainObject, type Result } from "./result.js";

export interface Arrival {
  v: string;
  entry?: string;
  /** Return address for outbound portals (spec §6.3). */
  airlock?: string;
  /**
   * Where the visitor's signer is (protocol/10-identity.md, "Signing from a
   * world"): the https address its `signer/` and `connect/` pages are
   * under. Said by their own client, which may keep its signer somewhere
   * other than beside its Airlock. Left out, it is beside the Airlock.
   */
  signer?: string;
  assertion?: NostrEvent;
  avatar?: string;
  /** The visitor's look, inline (spec §4.2): for someone who hasn't published an avatar. */
  look?: string;
  receipts?: NostrEvent[];
  /**
   * A pass (protocol/10-identity.md): the visitor's identity key saying that
   * `sessionKey` speaks for them at the destination. Present only with
   * `sessionKey`, and only when the visitor chose to go by name.
   */
  pass?: NostrEvent;
  /** The secret half of the session key the pass names, as 64 hex characters. A throwaway, made for this trip. */
  sessionKey?: string;
  /**
   * The visitor left a headset session to make this trip. A world offers the
   * way back into one before anything else (protocol/02-doors.md). It says
   * what they were doing, not who they are.
   */
  immersive?: true;
  /**
   * This world is where the visitor starts: the home they chose
   * (protocol/07-homes.md). Said only by their own client, bringing them
   * home. From here "home" leads nowhere new, so the world offers the way to
   * their doors instead.
   */
  home?: true;
  /**
   * The visitor was among people where they came from, and stays among them
   * here: the world joins its open room without asking again. Said only by
   * their own client (protocol/03-arrival.md, "Staying joined").
   */
  joined?: true;
  /**
   * Their microphone was on, and they have told their client it may stay on
   * as they travel. Read only with `joined`. The browser still decides
   * whether this world may use a microphone at all.
   */
  mic?: true;
  /**
   * People the visitor has blocked, by the identity key behind each name:
   * their own client's list, which goes where they go. A world doesn't
   * connect them to anyone on it for this visit, and doesn't keep it
   * (protocol/03-arrival.md, "Blocks that travel").
   */
  blocked?: string[];
  /**
   * How the visitor was moving where they came from, when it was the
   * intense way: at a desk, the mouse looks and keys walk; in a headset,
   * they walk and turn smoothly. A world that offers the two ways starts
   * them in this one. A preference, and theirs to change the moment they
   * arrive. Left out, the casual way.
   */
  moving?: "intense";
  /**
   * What the visitor was using a flat screen with where they came from:
   * their fingers ("touch") or a mouse and keys ("desk"). A world that lays
   * itself out differently for the two starts them the same way, where
   * their device can do both. A preference, and theirs to change by simply
   * using the other. Left out, the world works it out from the device.
   * A headset session is `immersive`.
   */
  form?: "touch" | "desk";
  /**
   * The visitor's settings where they came from: their volumes, the size of
   * their text, whether things move, their hands in a headset, whether their
   * screen was filled. A world starts from them, so nothing has to be set
   * again, and they are the visitor's to change the moment they arrive.
   * Anything unknown or out of range has been left out. Preferences and
   * nothing more (protocol/11-the-visitors-console.md).
   */
  settings?: TravelSettings;
}

const ENTRY_POINT = /^[A-Za-z0-9._-]{1,128}$/;
const decoder = new TextDecoder();

export function encodeArrival(a: Omit<Arrival, "v"> & { v?: string }): string {
  const body: Arrival = { v: a.v ?? SCHEMAS.arrival, ...a };
  return base64urlnopad.encode(utf8ToBytes(JSON.stringify(body)));
}

/** Decode and validate the value of `#nswp=`. Never trusts its contents: verify assertions and receipts separately. */
export function decodeArrival(value: string): Result<Arrival> {
  const c = new Collector();
  if (value.length > LIMITS.arrivalChars) {
    c.error("arrival_too_large", "", "The arrival context is too large.");
    return c.result(null as never);
  }
  let json: unknown;
  try {
    json = JSON.parse(decoder.decode(base64urlnopad.decode(value)));
  } catch {
    c.error("arrival_malformed", "", "The arrival context is not valid base64url JSON.");
    return c.result(null as never);
  }
  if (!isPlainObject(json)) {
    c.error("arrival_malformed", "", "The arrival context must be an object.");
    return c.result(null as never);
  }
  const out: Arrival = { v: SCHEMAS.arrival };
  if (typeof json.v !== "string" || !json.v.startsWith("nswp/arrival/")) c.error("schema_mismatch", "v", `v must be "${SCHEMAS.arrival}".`);
  else out.v = json.v;
  if (json.entry !== undefined) {
    if (typeof json.entry === "string" && ENTRY_POINT.test(json.entry)) out.entry = json.entry;
    else c.warn("invalid_entry_point", "entry", "Ignoring an invalid entry point.");
  }
  if (json.airlock !== undefined) {
    if (isHttpsUrl(json.airlock)) out.airlock = json.airlock;
    else c.warn("url_not_https", "airlock", "Ignoring a non-https return Airlock.");
  }
  if (json.signer !== undefined) {
    if (isHttpsUrl(json.signer) && json.signer.length <= 300) out.signer = json.signer;
    else c.warn("url_not_https", "signer", "Ignoring a signer address that isn't a usable https address.");
  }
  if (json.assertion !== undefined) {
    if (hasEventShape(json.assertion)) out.assertion = json.assertion;
    else c.warn("invalid_assertion", "assertion", "Ignoring a malformed entry assertion.");
  }
  if (json.avatar !== undefined) {
    try {
      if (typeof json.avatar !== "string") throw new Error();
      decodeNaddr(json.avatar);
      out.avatar = json.avatar;
    } catch {
      c.warn("invalid_avatar", "avatar", "Ignoring an avatar reference that is not an naddr.");
    }
  }
  if (json.look !== undefined) {
    if (typeof json.look === "string" && decodeLook(json.look).ok) out.look = json.look;
    else c.warn("invalid_look", "look", "Ignoring a look that can't be read.");
  }
  if (json.pass !== undefined || json.sessionKey !== undefined) {
    // The two are one thing: a pass is no use without the key it names, and the key says nothing without the pass.
    let fits = false;
    if (hasEventShape(json.pass) && isHex64(json.sessionKey)) {
      try {
        fits = getTagValue(json.pass, "nswp:session") === getPublicKey(hexToBytes(json.sessionKey));
      } catch {
        /* not a usable key */
      }
    }
    if (fits) {
      out.pass = json.pass as NostrEvent;
      out.sessionKey = json.sessionKey as string;
    } else c.warn("invalid_pass", "pass", "Ignoring a pass that doesn't come with the session key it names.");
  }
  if (json.immersive !== undefined && json.immersive !== false) {
    if (json.immersive === true) out.immersive = true;
    else c.warn("invalid_immersive", "immersive", "Ignoring an immersive hint that isn't true or false.");
  }
  if (json.home !== undefined && json.home !== false) {
    if (json.home === true) out.home = true;
    else c.warn("invalid_home", "home", "Ignoring a home hint that isn't true or false.");
  }
  if (json.joined !== undefined && json.joined !== false) {
    if (json.joined === true) out.joined = true;
    else c.warn("invalid_joined", "joined", "Ignoring a joined hint that isn't true or false.");
  }
  if (json.mic !== undefined && json.mic !== false) {
    // A microphone with nobody to hear it means nothing, and is never a reason to join.
    if (json.mic === true && out.joined) out.mic = true;
    else c.warn("invalid_mic", "mic", "Ignoring a microphone hint that isn't true, or that comes without joined.");
  }
  if (json.moving !== undefined && json.moving !== "casual") {
    if (json.moving === "intense") out.moving = "intense";
    else c.warn("invalid_moving", "moving", "Ignoring a way of moving that isn't \"casual\" or \"intense\".");
  }
  if (json.settings !== undefined) {
    const settings = cleanSettings(json.settings);
    if (hasSettings(settings)) out.settings = settings;
    else c.warn("invalid_settings", "settings", "Ignoring settings with nothing readable in them.");
  }
  if (json.form !== undefined) {
    if (json.form === "touch" || json.form === "desk") out.form = json.form;
    else c.warn("invalid_form", "form", "Ignoring a form that isn't \"touch\" or \"desk\".");
  }
  if (json.blocked !== undefined) {
    const ok = Array.isArray(json.blocked) && json.blocked.length <= LIMITS.maxBlocked && json.blocked.every((k) => typeof k === "string" && isHex64(k));
    if (ok) {
      const keys = [...new Set(json.blocked as string[])];
      if (keys.length) out.blocked = keys;
    } else c.warn("invalid_blocked", "blocked", `Ignoring a block list (must be at most ${LIMITS.maxBlocked} keys).`);
  }
  if (json.receipts !== undefined) {
    if (Array.isArray(json.receipts) && json.receipts.length <= LIMITS.maxReceipts && json.receipts.every(hasEventShape)) {
      out.receipts = json.receipts as NostrEvent[];
    } else c.warn("invalid_receipts", "receipts", `Ignoring receipts (must be at most ${LIMITS.maxReceipts} events).`);
  }
  return c.result(out);
}

/** Append `nswp=<arrival>` to a destination's fragment, keeping any existing fragment. */
export function buildArrivalUrl(destination: string, arrival: Omit<Arrival, "v">): string {
  const u = new URL(destination);
  const existing = u.hash.replace(/^#/, "");
  const param = `nswp=${encodeArrival(arrival)}`;
  u.hash = existing ? `${existing}&${param}` : param;
  return u.href;
}

/** Find `nswp=` in a fragment. Returns the raw value, or null. */
export function arrivalParam(hash: string): string | null {
  for (const part of hash.replace(/^#/, "").split("&")) {
    if (part.startsWith("nswp=")) return part.slice(5);
  }
  return null;
}

/** The fragment with `nswp=` removed (for `history.replaceState` scrubbing). */
export function stripArrivalParam(hash: string): string {
  const rest = hash
    .replace(/^#/, "")
    .split("&")
    .filter((p) => p !== "" && !p.startsWith("nswp="));
  return rest.length ? `#${rest.join("&")}` : "";
}

export function randomNonce(): string {
  return base64urlnopad.encode(randomBytes(16));
}

export interface EntryAssertionInput {
  /** The destination URL the user is entering. */
  url: string;
  nonce?: string;
  createdAt?: number;
  ttlSec?: number;
  /** Ask the world to apply the user's public NIP-51 mute list. */
  shareMutes?: boolean;
}

export function buildEntryAssertion(input: EntryAssertionInput): EventTemplate {
  const created = input.createdAt ?? nowSeconds();
  const ttl = Math.min(input.ttlSec ?? LIMITS.assertionTtlSec, LIMITS.assertionTtlSec);
  const tags: string[][] = [
    ["u", input.url],
    ["method", "GET"],
    ["nswp:origin", new URL(input.url).origin],
    ["nswp:nonce", input.nonce ?? randomNonce()],
    ["expiration", String(created + ttl)],
  ];
  if (input.shareMutes) tags.push(["nswp:mutes", "shared"]);
  return { kind: ENTRY_ASSERTION_KIND, created_at: created, tags, content: "" };
}

export interface VerifyAssertionOptions {
  /** The verifying world's own origin, e.g. `https://museum.example`. */
  origin: string;
  now?: number;
  /** Event IDs already accepted; a hit means replay. Servers must persist these until expiry. */
  seen?: { has(id: string): boolean };
}

export interface VerifiedAssertion {
  pubkey: string;
  id: string;
  expiresAt: number;
  shareMutes: boolean;
}

export function verifyEntryAssertion(event: unknown, opts: VerifyAssertionOptions): Result<VerifiedAssertion> {
  const c = new Collector();
  if (!verifyEvent(event)) {
    c.error("bad_signature", "", "The assertion is not a validly signed Nostr event.");
    return c.result(null as never);
  }
  const now = opts.now ?? nowSeconds();
  if (event.kind !== ENTRY_ASSERTION_KIND) c.error("wrong_kind", "kind", `Expected kind ${ENTRY_ASSERTION_KIND}.`);
  const one = (name: string) => {
    const t = getTags(event, name);
    if (t.length !== 1 || !t[0]![1]) {
      c.error(t.length > 1 ? "duplicate_tag" : "missing_tag", `tags.${name}`, `Exactly one "${name}" tag is required.`);
      return undefined;
    }
    return t[0]![1];
  };
  const u = one("u");
  const method = one("method");
  const origin = one("nswp:origin");
  const nonce = one("nswp:nonce");
  const exp = one("expiration");
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(opts.origin).origin;
  } catch {
    c.error("invalid_option", "origin", "opts.origin is not a URL.");
    return c.result(null as never);
  }
  if (method && method !== "GET") c.error("wrong_method", "tags.method", 'method must be "GET".');
  if (u) {
    let uOrigin: string | null = null;
    try {
      uOrigin = new URL(u).origin;
    } catch {
      /* below */
    }
    if (uOrigin !== expectedOrigin) c.error("origin_mismatch", "tags.u", "The assertion was made for a different site.");
  }
  if (origin && origin !== expectedOrigin) c.error("origin_mismatch", "tags.nswp:origin", "The assertion was made for a different site.");
  if (nonce && nonce.length < LIMITS.minNonceLength) c.error("nonce_too_short", "tags.nswp:nonce", "The nonce is too short.");
  const expiresAt = exp !== undefined ? Number(exp) : NaN;
  if (exp !== undefined) {
    if (!Number.isInteger(expiresAt)) c.error("invalid_expiration", "tags.expiration", "expiration must be an integer timestamp.");
    else {
      if (expiresAt <= now) c.error("assertion_expired", "tags.expiration", "The assertion has expired.");
      if (expiresAt - event.created_at > LIMITS.assertionTtlSec) {
        c.error("ttl_too_long", "tags.expiration", `Assertions may live at most ${LIMITS.assertionTtlSec} seconds.`);
      }
    }
  }
  if (event.created_at > now + LIMITS.assertionFutureSkewSec) c.error("created_in_future", "created_at", "The assertion is dated in the future.");
  if (event.created_at < now - LIMITS.assertionTtlSec) c.error("assertion_expired", "created_at", "The assertion is too old.");
  if (opts.seen?.has(event.id)) c.error("assertion_replayed", "id", "This assertion has already been used.");
  return c.result({
    pubkey: event.pubkey,
    id: event.id,
    expiresAt,
    shareMutes: getTagValue(event, "nswp:mutes") === "shared",
  });
}

/** Hex helper re-exported for callers that store nonces as hex. */
export const toHex = bytesToHex;
