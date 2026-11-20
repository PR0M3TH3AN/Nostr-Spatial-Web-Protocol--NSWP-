/**
 * What a world keeps for its visitor: a save (protocol/12-saves.md).
 *
 * A world that has something to remember (how far someone got, what they chose, what they built) can keep it
 * with the visitor's own account, so it is there on their next device. It is a note of its own kind, signed by
 * the visitor's key and encrypted so that only that key can read it.
 *
 * A world never names where a save is kept. The visitor's signer does, from the address of the world that asked:
 * so a world can write and read its own saves and nobody else's, and what is on a relay doesn't say which
 * worlds someone has been to. This file is the pure part both sides share. Nothing here holds a key for longer
 * than a call, and nothing here talks to a relay.
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { cleanOrigin } from "./destination.js";
import { getTags, isHex64, type EventTemplate, type NostrEvent } from "./event.js";
import { nip44Decrypt, nip44Encrypt } from "./nip44.js";

/** A save: addressable, so a relay keeps the newest for each slot. Experimental; not allocated by the NIPs process. */
export const SAVE_KIND = 37304;

export const SAVE_LIMITS = {
  /** The most a save may hold, in bytes of UTF-8. It has to fit in one note that any relay will take. */
  dataBytes: 32_768,
  /** A world may write no more than this many saves in `perMs`, and in an hour: often enough to keep up with a game, not to flood. */
  burst: 6,
  perMs: 60_000,
  hourly: 60,
} as const;

/** The slot a world uses when it names none. */
export const SAVE_SLOT = "main";
const SLOT = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** A slot's name as it may be used: lower-case letters, digits and hyphens, 32 at most. "" for anything else. */
export function cleanSlot(input: unknown): string {
  return typeof input === "string" && SLOT.test(input) ? input : "";
}

/** Whether these words may be a save: text, within the limit. */
export function fitsInSave(data: unknown): data is string {
  return typeof data === "string" && utf8ToBytes(data).length <= SAVE_LIMITS.dataBytes;
}

/**
 * Where one world's save in one slot is kept, for the visitor whose key this is: the save's `d`. It is made from
 * the visitor's own secret (`conversationKey`: their key with itself, as NIP-44 makes it), so only they can work
 * it out, and it says nothing of the world to anyone else. "" if the world or the slot can't be used.
 */
export function saveAddress(conversationKey: Uint8Array, world: string, slot: string): string {
  const origin = cleanOrigin(world);
  const name = cleanSlot(slot);
  if (!origin || !name) return "";
  return bytesToHex(hmac(sha256, conversationKey, utf8ToBytes(`nswp-save\n${origin}\n${name}`)));
}

/**
 * A save, ready to be signed by the visitor's key: for a signer to write when a world asks. The world and the
 * slot are written inside what is encrypted, so that opening it can check them again. Null if anything is wrong
 * with what was asked.
 */
export function sealSave(o: { conversationKey: Uint8Array; world: string; slot: string; data: unknown; now: number; nonce?: Uint8Array }): EventTemplate | null {
  const origin = cleanOrigin(o.world);
  const slot = cleanSlot(o.slot);
  const d = saveAddress(o.conversationKey, origin, slot);
  if (!d || !fitsInSave(o.data)) return null;
  const inside = JSON.stringify({ v: 1, world: origin, slot, data: o.data });
  return {
    kind: SAVE_KIND,
    created_at: Math.floor(o.now),
    tags: [
      ["d", d],
      ["alt", "Something a world keeps for its visitor. Only they can read it."],
    ],
    content: nip44Encrypt(inside, o.conversationKey, o.nonce),
  };
}

export interface OpenedSave {
  slot: string;
  data: string;
  /** When it was saved, in seconds, as its signer wrote it. */
  at: number;
}

/**
 * Open a save for the world that asks: for a signer. It is opened only if it is the visitor's own, of this kind,
 * and what is inside says it is that world's, in the slot its address is for. Null for anything else: another
 * world's save is never opened for this one, whatever it was handed.
 *
 * The caller checks the signature first (`verifyEvent`): this checks whose it is and what it says.
 */
export function openSave(event: NostrEvent | null | undefined, o: { conversationKey: Uint8Array; pubkey: string; world: string }): OpenedSave | null {
  const origin = cleanOrigin(o.world);
  if (!origin || !event || event.kind !== SAVE_KIND || !isHex64(o.pubkey) || event.pubkey !== o.pubkey || typeof event.content !== "string") return null;
  let inside: { v?: unknown; world?: unknown; slot?: unknown; data?: unknown };
  try {
    inside = JSON.parse(nip44Decrypt(event.content, o.conversationKey)) as typeof inside;
  } catch {
    return null;
  }
  if (!inside || typeof inside !== "object" || inside.v !== 1 || inside.world !== origin) return null;
  const slot = cleanSlot(inside.slot);
  if (!slot || !fitsInSave(inside.data)) return null;
  // The address it was kept at must be the one this world's slot has: a save moved to another address is refused.
  if (getTags(event, "d")[0]?.[1] !== saveAddress(o.conversationKey, origin, slot)) return null;
  return { slot, data: inside.data, at: Number.isInteger(event.created_at) ? event.created_at : 0 };
}

/**
 * Whether what a signer handed back could be the save that was asked for, as far as a world can tell: a save, by
 * the key the signer holds, kept at an address. The world can't read it, and doesn't need to. The caller checks
 * the signature (`verifyEvent`).
 */
export function looksLikeSave(event: NostrEvent | null | undefined, pubkey: string | null): event is NostrEvent {
  return !!event && event.kind === SAVE_KIND && !!pubkey && event.pubkey === pubkey && typeof event.content === "string" && isHex64(getTags(event, "d")[0]?.[1]);
}
