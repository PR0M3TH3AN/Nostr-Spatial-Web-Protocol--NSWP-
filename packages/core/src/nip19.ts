/** NIP-19 `naddr` encoding and decoding (TLV over bech32). */
import { bech32 } from "@scure/base";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { isHex64 } from "./event.js";
import { NswpError } from "./result.js";

export interface AddressPointer {
  kind: number;
  pubkey: string;
  identifier: string;
  relays?: string[];
}

const BECH32_LIMIT = 5000;
const decoder = new TextDecoder();

export function encodeNaddr(p: AddressPointer): string {
  if (!isHex64(p.pubkey)) throw new NswpError("invalid_pubkey", "pubkey must be 64 lowercase hex characters");
  if (!Number.isInteger(p.kind) || p.kind < 0 || p.kind > 0xffffffff) throw new NswpError("invalid_kind", "kind out of range");
  const parts: Uint8Array[] = [];
  const tlv = (type: number, value: Uint8Array) => {
    if (value.length > 255) throw new NswpError("tlv_too_long", `TLV value for type ${type} exceeds 255 bytes`);
    parts.push(Uint8Array.of(type, value.length), value);
  };
  tlv(0, utf8ToBytes(p.identifier));
  for (const r of p.relays ?? []) tlv(1, utf8ToBytes(r));
  tlv(2, hexToBytes(p.pubkey));
  const kind = new Uint8Array(4);
  new DataView(kind.buffer).setUint32(0, p.kind, false);
  tlv(3, kind);
  const bytes = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
  let off = 0;
  for (const a of parts) {
    bytes.set(a, off);
    off += a.length;
  }
  return bech32.encode("naddr", bech32.toWords(bytes), BECH32_LIMIT);
}

export function decodeNaddr(s: string): AddressPointer {
  let decoded: { prefix: string; words: number[] };
  try {
    decoded = bech32.decode(s as `${string}1${string}`, BECH32_LIMIT);
  } catch (cause) {
    throw new NswpError("naddr_invalid", "not a valid bech32 string", { cause });
  }
  if (decoded.prefix !== "naddr") throw new NswpError("naddr_invalid", `expected naddr, got ${decoded.prefix}`);
  const bytes = bech32.fromWords(decoded.words);
  let identifier: string | undefined;
  let pubkey: string | undefined;
  let kind: number | undefined;
  const relays: string[] = [];
  for (let i = 0; i < bytes.length; ) {
    const type = bytes[i]!;
    const len = bytes[i + 1];
    if (len === undefined || i + 2 + len > bytes.length) throw new NswpError("naddr_invalid", "truncated TLV");
    const value = bytes.slice(i + 2, i + 2 + len);
    if (type === 0) identifier = decoder.decode(value);
    else if (type === 1) relays.push(decoder.decode(value));
    else if (type === 2 && len === 32) pubkey = bytesToHex(value);
    else if (type === 3 && len === 4) kind = new DataView(value.buffer, value.byteOffset, 4).getUint32(0, false);
    i += 2 + len;
  }
  if (identifier === undefined || pubkey === undefined || kind === undefined) {
    throw new NswpError("naddr_invalid", "naddr is missing identifier, author or kind");
  }
  return relays.length ? { kind, pubkey, identifier, relays } : { kind, pubkey, identifier };
}

export function coordinate(p: { kind: number; pubkey: string; identifier: string }): string {
  return `${p.kind}:${p.pubkey}:${p.identifier}`;
}

const COORD = /^(\d+):([0-9a-f]{64}):(.*)$/s;

export function parseCoordinate(s: string): { kind: number; pubkey: string; identifier: string } | null {
  const m = COORD.exec(s);
  return m ? { kind: Number(m[1]), pubkey: m[2]!, identifier: m[3]! } : null;
}
