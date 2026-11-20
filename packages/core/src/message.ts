/**
 * A private message between two people (protocol/14-people-and-messages.md): Nostr's own, NIP-17.
 *
 * A message is written as a note that is never signed or published (kind 14). It is sealed to the person it is
 * for, in a note the sender signs (kind 13), and that is wrapped in a note signed by a key made for the one
 * message and thrown away (kind 1059, NIP-59). What a relay holds says who a message is for, and nothing of who
 * sent it, what it says, or exactly when.
 *
 * This file is the pure part: what each layer looks like, and what a reader checks before it believes one. The
 * sender's key seals and the reader's key opens, and both live in their signer, not here: a client hands the
 * signer the text to seal (`sealTemplate`), and a whole signed note to open (`readSeal`, `readMessage`).
 * `openWrap` does it all with a key in hand, for a client that holds one and for the test vectors.
 *
 * A world never has any of this signed or opened for it (signing.ts: these kinds are "never"). It is for the
 * visitor's own client.
 */
import { randomBytes } from "@noble/hashes/utils.js";
import { finalizeEvent, getEventHash, getPublicKey, isHex64, verifyEvent, type EventTemplate, type NostrEvent, type UnsignedEvent } from "./event.js";
import { getConversationKey, nip44Decrypt, nip44Encrypt } from "./nip44.js";
import { cleanRelayUrl } from "./relay.js";

/** A message as it is written: never signed, never published as itself. */
export const MESSAGE_KIND = 14;
/** A message sealed to its reader, signed by its sender. Carries no tags. */
export const SEAL_KIND = 13;
/** A seal wrapped for one reader, signed by a key used once. */
export const WRAP_KIND = 1059;
/** Where someone's private messages reach them (NIP-17): a list of a few relays. */
export const MESSAGE_RELAYS_KIND = 10050;

export const MESSAGE_LIMITS = {
  /** The most characters in one message as this library writes and shows it. */
  chars: 2000,
  /** How far back a wrap's time may be moved, in seconds, so that a relay can't tell when it was sent. */
  backdateSec: 2 * 24 * 3600,
  /** No more than this many relays are taken from someone's list. */
  relays: 4,
} as const;

/** Code points never shown in a message: controls other than a new line, and the invisible ones that reorder or hide text. */
const UNSEEN: readonly (readonly [number, number])[] = [
  [0x00, 0x09],
  [0x0b, 0x1f],
  [0x7f, 0x9f],
  [0x200b, 0x200c],
  [0x200e, 0x200f],
  [0x2028, 0x202f],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
];

/**
 * A message's words, as they may be sent and shown: plain text, new lines kept (no more than two together),
 * nothing invisible that reorders or hides text, at most `MESSAGE_LIMITS.chars`. "" when nothing is left.
 */
export function cleanMessage(text: unknown): string {
  if (typeof text !== "string") return "";
  let out = "";
  for (const ch of text.slice(0, MESSAGE_LIMITS.chars * 8).normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    out += UNSEEN.some(([from, to]) => code >= from && code <= to) ? " " : ch;
  }
  out = out
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return [...out].slice(0, MESSAGE_LIMITS.chars).join("").trim();
}

/** A message, written and not signed: what is sealed. It has an id so that it can be told from another. */
export type WrittenMessage = UnsignedEvent & { id: string };

/**
 * Write a message from one person to another. Null if either key isn't one, they are the same, or there are no
 * words. `relay` is a hint for the reader's client: where the sender's messages reach them.
 */
export function buildMessage(o: { from: string; to: string; text: string; now: number; relay?: string }): WrittenMessage | null {
  const text = cleanMessage(o.text);
  if (!isHex64(o.from) || !isHex64(o.to) || o.from === o.to || !text) return null;
  const written: UnsignedEvent = { kind: MESSAGE_KIND, pubkey: o.from, created_at: Math.floor(o.now), tags: [["p", o.to, ...(o.relay ? [o.relay] : [])]], content: text };
  return { ...written, id: getEventHash(written) };
}

/**
 * The seal, ready for the sender's signer: `sealed` is the written message as JSON, encrypted (NIP-44) by the
 * sender's key to the reader's. A seal has no tags, so nothing on it says who it is for.
 *
 * Its time is now. NIP-59 lets it be moved back as a wrap's is; but only the reader ever sees a seal, and a
 * signer that sets or checks the time of what it signs would refuse another.
 */
export function sealTemplate(sealed: string, now: number): EventTemplate {
  return { kind: SEAL_KIND, created_at: Math.floor(now), tags: [], content: sealed };
}

/**
 * Wrap a signed seal for one reader, with a key made for this and thrown away. The wrap's time is moved back by
 * up to two days. Null for anything that isn't a real seal or a real key.
 *
 * `secretKey`, `nonce`, `random` and `auxRand` exist for reproducible test vectors: leave them unset for anything real.
 */
export function wrapSeal(seal: NostrEvent, to: string, o: { now: number; secretKey?: Uint8Array; nonce?: Uint8Array; random?: number; auxRand?: Uint8Array }): NostrEvent | null {
  if (!isHex64(to) || !seal || seal.kind !== SEAL_KIND || seal.tags.length !== 0 || !verifyEvent(seal)) return null;
  const once = o.secretKey ?? randomBytes(32);
  const back = Math.floor((o.random ?? Math.random()) * MESSAGE_LIMITS.backdateSec);
  try {
    const content = nip44Encrypt(JSON.stringify(seal), getConversationKey(once, to), o.nonce);
    return finalizeEvent({ kind: WRAP_KIND, created_at: Math.floor(o.now) - back, tags: [["p", to]], content }, once, o.auxRand);
  } catch {
    return null;
  }
}

/** Whether this could be a wrap for this reader, as far as can be told without opening it. The signature is checked. */
export function looksLikeWrap(event: NostrEvent | null | undefined, reader: string): event is NostrEvent {
  return !!event && event.kind === WRAP_KIND && typeof event.content === "string" && event.tags.some((t) => t[0] === "p" && t[1] === reader) && verifyEvent(event);
}

/**
 * What a wrap held, once the reader's signer has opened it: a seal. Null unless it is a seal with a real
 * signature and no tags. Who signed it is who the message is from, and the only word on that there is.
 */
export function readSeal(opened: string): NostrEvent | null {
  let seal: unknown;
  try {
    seal = JSON.parse(opened);
  } catch {
    return null;
  }
  if (!verifyEvent(seal) || seal.kind !== SEAL_KIND || seal.tags.length !== 0) return null;
  return seal;
}

export interface Message {
  /** What tells it from another: worked out here from what it says, never taken from it. */
  id: string;
  /** Who wrote it: the key that signed the seal. */
  from: string;
  /** Who it is to. More than one is a conversation among several. */
  to: string[];
  /** Their words, as plain text. Shown as text, never as markup. */
  text: string;
  /** When they say they wrote it, in seconds. */
  at: number;
}

/**
 * What a seal held, once the reader's signer has opened it: the message. Null unless it is a message, written by
 * the one who signed the seal, with words in it, and the reader is its writer or one of the people it is to.
 *
 * The first of those is the one that matters. A message that says it is from one person, sealed by another, is
 * somebody passing themselves off: it is dropped.
 */
export function readMessage(opened: string, seal: Pick<NostrEvent, "pubkey">, reader: string): Message | null {
  let m: { kind?: unknown; pubkey?: unknown; created_at?: unknown; tags?: unknown; content?: unknown };
  try {
    m = JSON.parse(opened) as typeof m;
  } catch {
    return null;
  }
  if (!m || typeof m !== "object" || m.kind !== MESSAGE_KIND || m.pubkey !== seal.pubkey || !isHex64(m.pubkey)) return null;
  if (typeof m.content !== "string" || typeof m.created_at !== "number" || !Number.isInteger(m.created_at) || !Array.isArray(m.tags)) return null;
  if (!m.tags.every((t): t is string[] => Array.isArray(t) && t.every((item) => typeof item === "string"))) return null;
  const to = [...new Set(m.tags.filter((t) => t[0] === "p" && isHex64(t[1])).map((t) => t[1]!))];
  const text = cleanMessage(m.content);
  if (to.length === 0 || !text || (m.pubkey !== reader && !to.includes(reader))) return null;
  const id = getEventHash({ kind: MESSAGE_KIND, pubkey: m.pubkey, created_at: m.created_at, tags: m.tags, content: m.content });
  return { id, from: m.pubkey, to, text, at: m.created_at };
}

/** The other person in a message between two, as the reader sees it; "" for a message among several. */
export function writtenWith(message: Pick<Message, "from" | "to">, reader: string): string {
  const others = [...new Set([message.from, ...message.to])].filter((k) => k !== reader);
  return others.length === 1 ? others[0]! : "";
}

/**
 * Open a wrap with the reader's key in hand: every check `readSeal` and `readMessage` make. For a client that
 * holds a key, and for the test vectors. A client whose key is in a signer asks the signer to open each layer.
 */
export function openWrap(wrap: NostrEvent | null | undefined, secretKey: Uint8Array): Message | null {
  const reader = getPublicKey(secretKey);
  if (!looksLikeWrap(wrap, reader)) return null;
  try {
    const seal = readSeal(nip44Decrypt(wrap.content, getConversationKey(secretKey, wrap.pubkey)));
    if (!seal) return null;
    return readMessage(nip44Decrypt(seal.content, getConversationKey(secretKey, seal.pubkey)), seal, reader);
  } catch {
    return null;
  }
}

/**
 * Where someone's private messages reach them: the relays in their newest kind 10050, cleaned, none twice, a few
 * at most. Empty when they have published none: they can't be sent a message this way until they have.
 */
export function readMessageRelays(events: readonly NostrEvent[], pubkey: string): string[] {
  const latest = events.filter((e) => e.kind === MESSAGE_RELAYS_KIND && e.pubkey === pubkey).sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1))[0];
  const out: string[] = [];
  for (const t of latest?.tags ?? []) {
    if (t[0] !== "relay") continue;
    const url = cleanRelayUrl(t[1]);
    if (url && !out.includes(url) && out.length < MESSAGE_LIMITS.relays) out.push(url);
  }
  return out;
}

/**
 * A world may be let send and read its visitor's private messages (protocol/14-people-and-messages.md, "Messages
 * from inside a world"). How often it may have one sealed: the pace of a person writing.
 */
export const MESSAGE_WORLD_LIMITS = { burst: 10, perMs: 60_000, hourly: 200 } as const;

/** A message written and sealed twice: once for its reader, and once for its writer to read back. */
export interface SealedMessage {
  message: WrittenMessage;
  /** For the reader, then for the writer. Each is wrapped for the one it is for, by whoever sends it. */
  seals: [NostrEvent, NostrEvent];
}

/**
 * What a signer does when it is asked to send a message, with the writer's key in hand: write it, and seal it to
 * its reader and to its writer. Whoever asked wraps each seal (`wrapSeal`) and sends it; they never see a key.
 * Null if the reader isn't a key, is the writer, or there are no words.
 *
 * `nonces` and `auxRand` exist for reproducible test vectors: leave them unset for anything real.
 */
export function sealMessage(o: { secretKey: Uint8Array; to: unknown; text: unknown; now: number; nonces?: [Uint8Array, Uint8Array]; auxRand?: Uint8Array }): SealedMessage | null {
  const from = getPublicKey(o.secretKey);
  if (typeof o.to !== "string" || typeof o.text !== "string") return null;
  const message = buildMessage({ from, to: o.to, text: o.text, now: o.now });
  if (!message) return null;
  const inside = JSON.stringify(message);
  const seal = (reader: string, nonce?: Uint8Array) => finalizeEvent(sealTemplate(nip44Encrypt(inside, getConversationKey(o.secretKey, reader), nonce), o.now), o.secretKey, o.auxRand);
  return { message, seals: [seal(o.to, o.nonces?.[0]), seal(from, o.nonces?.[1])] };
}

/**
 * Whether what a signer handed back is the message that was asked for, as far as whoever asked can tell: written
 * by the key the signer holds, to that reader, with those words, and sealed twice by that key. What is inside a
 * seal can't be read here, and doesn't need to be.
 */
export function isSealAsked(sealed: unknown, o: { pubkey: string | null; to: string; text: string }): sealed is SealedMessage {
  const s = sealed as Partial<SealedMessage> | null;
  if (!o.pubkey || !s || typeof s !== "object" || !Array.isArray(s.seals) || s.seals.length !== 2) return false;
  const m = s.message as Partial<WrittenMessage> | undefined;
  if (!m || typeof m !== "object" || m.kind !== MESSAGE_KIND || m.pubkey !== o.pubkey || m.content !== cleanMessage(o.text) || !m.content) return false;
  if (!Array.isArray(m.tags) || m.tags.length !== 1 || m.tags[0]?.[0] !== "p" || m.tags[0]?.[1] !== o.to || typeof m.created_at !== "number") return false;
  if (m.id !== getEventHash({ kind: MESSAGE_KIND, pubkey: o.pubkey, created_at: m.created_at, tags: m.tags, content: m.content })) return false;
  return s.seals.every((seal) => verifyEvent(seal) && seal.kind === SEAL_KIND && seal.pubkey === o.pubkey && seal.tags.length === 0);
}

/** Whether a signed list of where messages reach someone is the one that was asked for: theirs, and exactly those relays. */
export function isReachAsked(signed: unknown, o: { pubkey: string | null; relays: readonly string[] }): signed is NostrEvent {
  const want = buildMessageRelays(o.relays, 0);
  if (!o.pubkey || !want || !verifyEvent(signed) || signed.kind !== MESSAGE_RELAYS_KIND || signed.pubkey !== o.pubkey) return false;
  return JSON.stringify(signed.tags.filter((t) => t[0] === "relay")) === JSON.stringify(want.tags);
}

/** A message as it is handed about once read: every part checked again, the words tidied. Null for anything else. */
export function cleanRead(input: unknown): Message | null {
  const m = input as Partial<Message> | null;
  if (!m || typeof m !== "object" || !isHex64(m.id) || !isHex64(m.from) || !Array.isArray(m.to) || typeof m.at !== "number" || !Number.isFinite(m.at)) return null;
  const to = [...new Set(m.to.filter((k): k is string => isHex64(k)))];
  const text = cleanMessage(m.text);
  return to.length && text ? { id: m.id, from: m.from, to, text, at: m.at } : null;
}

/** A list of where someone's private messages reach them, ready to be signed by them. Null with no usable relay. */
export function buildMessageRelays(relays: readonly string[], now: number): EventTemplate | null {
  const clean = [...new Set(relays.map(cleanRelayUrl).filter(Boolean))].slice(0, MESSAGE_LIMITS.relays);
  if (clean.length === 0) return null;
  return { kind: MESSAGE_RELAYS_KIND, created_at: Math.floor(now), tags: clean.map((url) => ["relay", url]), content: "" };
}
