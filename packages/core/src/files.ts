/**
 * A file passed between a world and its visitor's own files (protocol/10-identity.md, "Asking the person").
 *
 * A visitor's files are kept by their sign-in address, on servers they chose. A world can't see them, list them or
 * reach them. It can do two things, each at the visitor's press on the sign-in address's own page: offer a file to
 * be saved, and ask to be handed one. What is here is the tidying both sides do to what crosses between them: a
 * name that is only a name, a type that is only a type, bytes that are bytes and not too many, and an address
 * that is believed only when it really names those bytes.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export const FILE_LIMITS = {
  /** The most a file passed this way may hold: 25 MB. */
  bytes: 25 * 1024 * 1024,
  /** The most characters in its name. */
  name: 120,
} as const;

/** A character nobody sees, or that moves the words around it: never part of a name. */
const hidden = (c: number): boolean => c < 32 || (c >= 127 && c <= 159) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x2069) || c === 0xfeff;

/**
 * A file's name, as only a name: no path, nothing unseen, one line, not too long, and not "." or "..". "" for
 * anything that leaves nothing.
 */
export function cleanFileName(input: unknown): string {
  if (typeof input !== "string") return "";
  const tidy = Array.from(input.slice(0, 2000), (ch) => (hidden(ch.codePointAt(0) ?? 0) || ch === "/" || ch === "\\" ? " " : ch))
    .join("")
    .split(" ")
    .filter(Boolean)
    .join(" ");
  const cut = [...tidy].slice(0, FILE_LIMITS.name).join("").trim();
  return cut === "." || cut === ".." ? "" : cut;
}

/** A file's type, as a media type and nothing else ("image/png"). What isn't one is "application/octet-stream": just bytes. */
export function cleanFileType(input: unknown): string {
  const type = typeof input === "string" ? input.trim().toLowerCase() : "";
  return type.length <= 100 && /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(type) ? type : "application/octet-stream";
}

/** A file's bytes, as bytes: some, and no more than may be passed. Null for anything else. */
export function cleanFileBytes(input: unknown): Uint8Array | null {
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : null;
  return bytes && bytes.length > 0 && bytes.length <= FILE_LIMITS.bytes ? bytes : null;
}

/**
 * Where a public file is kept, as a server says it: a secure address that ends in the SHA-256 of the file (with
 * or without an ending like ".png"), and nothing after it. "" for anything else.
 */
export function cleanFileUrl(input: unknown): string {
  if (typeof input !== "string" || input.length > 500) return "";
  try {
    const u = new URL(input);
    return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash && /\/[0-9a-f]{64}(\.[a-z0-9]{1,10})?$/.test(u.pathname) ? u.href : "";
  } catch {
    return "";
  }
}

/** Whether that address names exactly these bytes: the hash in it is theirs. An address that doesn't is not believed. */
export function fileUrlNames(url: unknown, bytes: Uint8Array): boolean {
  const clean = cleanFileUrl(url);
  const named = /\/([0-9a-f]{64})(\.[a-z0-9]{1,10})?$/.exec(clean ? new URL(clean).pathname : "")?.[1];
  return !!named && named === bytesToHex(sha256(bytes));
}
