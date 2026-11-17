/**
 * NIP-44 version 2 encryption (secp256k1 ECDH, HKDF-SHA256, ChaCha20,
 * HMAC-SHA256). Used for room handshake messages (spec §9.4).
 * Interoperability with nostr-tools is checked in test/room.test.ts.
 */
import { chacha20 } from "@noble/ciphers/chacha.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { expand, extract } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";
import { isHex64 } from "./event.js";
import { NswpError } from "./result.js";

const SALT = utf8ToBytes("nip44-v2");
const decoder = new TextDecoder("utf-8", { fatal: true });
const MIN_PLAINTEXT = 1;
const MAX_PLAINTEXT = 65535;

export function getConversationKey(secretKey: Uint8Array, pubkey: string): Uint8Array {
  if (!isHex64(pubkey)) throw new NswpError("invalid_pubkey", "pubkey must be 64 lowercase hex characters");
  const shared = secp256k1.getSharedSecret(secretKey, hexToBytes(`02${pubkey}`));
  return extract(sha256, shared.subarray(1, 33), SALT);
}

function paddedLength(len: number): number {
  if (len <= 32) return 32;
  const nextPower = 1 << (Math.floor(Math.log2(len - 1)) + 1);
  const chunk = nextPower <= 256 ? 32 : nextPower / 8;
  return chunk * (Math.floor((len - 1) / chunk) + 1);
}

function messageKeys(conversationKey: Uint8Array, nonce: Uint8Array) {
  const keys = expand(sha256, conversationKey, nonce, 76);
  return { chachaKey: keys.subarray(0, 32), chachaNonce: keys.subarray(32, 44), hmacKey: keys.subarray(44, 76) };
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** `nonce` is for test vectors only; leave it unset for anything real. */
export function nip44Encrypt(plaintext: string, conversationKey: Uint8Array, nonce: Uint8Array = randomBytes(32)): string {
  const data = utf8ToBytes(plaintext);
  if (data.length < MIN_PLAINTEXT || data.length > MAX_PLAINTEXT) throw new NswpError("nip44_bad_length", "plaintext must be 1 to 65535 bytes");
  const padded = new Uint8Array(2 + paddedLength(data.length));
  new DataView(padded.buffer).setUint16(0, data.length, false);
  padded.set(data, 2);
  const { chachaKey, chachaNonce, hmacKey } = messageKeys(conversationKey, nonce);
  const ciphertext = chacha20(chachaKey, chachaNonce, padded);
  const mac = hmac(sha256, hmacKey, concatBytes(nonce, ciphertext));
  return base64.encode(concatBytes(Uint8Array.of(2), nonce, ciphertext, mac));
}

export function nip44Decrypt(payload: string, conversationKey: Uint8Array): string {
  const fail = (m: string): never => {
    throw new NswpError("nip44_invalid", m);
  };
  if (payload.length < 132 || payload.length > 87472 || payload.startsWith("#")) fail("invalid payload length or version");
  let raw: Uint8Array;
  try {
    raw = base64.decode(payload);
  } catch {
    return fail("payload is not base64");
  }
  if (raw.length < 99 || raw.length > 65603) fail("invalid payload size");
  if (raw[0] !== 2) fail("unsupported NIP-44 version");
  const nonce = raw.subarray(1, 33);
  const ciphertext = raw.subarray(33, raw.length - 32);
  const mac = raw.subarray(raw.length - 32);
  const { chachaKey, chachaNonce, hmacKey } = messageKeys(conversationKey, nonce);
  if (!equalBytes(hmac(sha256, hmacKey, concatBytes(nonce, ciphertext)), mac)) fail("invalid MAC");
  const padded = chacha20(chachaKey, chachaNonce, ciphertext);
  const len = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint16(0, false);
  if (len < MIN_PLAINTEXT || padded.length !== 2 + paddedLength(len)) fail("invalid padding");
  try {
    return decoder.decode(padded.subarray(2, 2 + len));
  } catch {
    return fail("plaintext is not UTF-8");
  }
}
