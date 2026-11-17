import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * TEST-ONLY keys. They are derived from public strings, so anyone can sign
 * as them. Never list them in a real manifest.
 */
export const TEST_KEY_1 = sha256(utf8ToBytes("nswp test vector key 1"));
export const TEST_KEY_2 = sha256(utf8ToBytes("nswp test vector key 2"));
/** Fixed BIP-340 aux randomness so test signatures are reproducible. */
export const ZERO_AUX = new Uint8Array(32);
export const T0 = 1794430800;
