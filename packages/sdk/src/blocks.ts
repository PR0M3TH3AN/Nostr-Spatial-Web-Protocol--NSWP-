/**
 * The people a visitor has blocked in rooms (spec §9.4: "the member hasn't
 * blocked them").
 *
 * A block is the visitor's own decision and is carried out on their own
 * device: their browser closes its connection to that person and makes no
 * new one. Nobody is asked, nothing is published, and the others in the room
 * are not told.
 *
 * What a block can hold on to depends on who was blocked. Someone who came
 * by name showed a pass for a key of their own, and that key is the same
 * next visit: the block is kept, on this site, and holds whenever they come
 * back. A guest is a key made for one visit. Blocking them holds until they
 * come back as a new guest, and it would be dishonest to keep a list that
 * promised more. So only named people are kept.
 */
import { cleanName, shortNpub } from "@nswp/core";

export interface Blocked {
  /** Their identity key, as 64 hex characters. */
  key: string;
  /** What they were called when they were blocked. Their word, cleaned; a label for the visitor, nothing more. */
  name: string;
  /** When, in seconds. */
  at: number;
}

/** More than anyone needs, and a bound on what a page will read back. */
export const BLOCK_LIMIT = 500;
const KEY = "nswp:blocked";
const HEX = /^[0-9a-f]{64}$/;

/** Read a kept list, trusting nothing in it. */
export function cleanBlocked(input: unknown): Blocked[] {
  if (!Array.isArray(input)) return [];
  const out: Blocked[] = [];
  const seen = new Set<string>();
  for (const b of input) {
    if (!b || typeof b !== "object") continue;
    const { key, name, at } = b as Record<string, unknown>;
    if (typeof key !== "string" || !HEX.test(key) || seen.has(key)) continue;
    seen.add(key);
    const called = typeof name === "string" ? cleanName(name) : "";
    out.push({ key, name: called || shortNpub(key), at: typeof at === "number" && Number.isFinite(at) && at > 0 ? Math.floor(at) : 0 });
    if (out.length >= BLOCK_LIMIT) break;
  }
  return out;
}

/** The list with one more person on it, newest first. Blocking someone twice keeps the first. */
export function withBlocked(list: Blocked[], who: { key: string; name?: string }, now = Math.floor(Date.now() / 1000)): Blocked[] {
  if (!HEX.test(who.key) || list.some((b) => b.key === who.key)) return list;
  return cleanBlocked([{ key: who.key, name: who.name ?? "", at: now }, ...list]);
}

export function withoutBlocked(list: Blocked[], key: string): Blocked[] {
  return list.filter((b) => b.key !== key);
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const local = (): Store | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** The visitor's kept blocks on this site. */
export function loadBlocked(storage: Store | null = local()): Blocked[] {
  try {
    return cleanBlocked(JSON.parse(storage?.getItem(KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function storeBlocked(list: Blocked[], storage: Store | null = local()): void {
  try {
    if (list.length) storage?.setItem(KEY, JSON.stringify(cleanBlocked(list)));
    else storage?.removeItem(KEY);
  } catch {
    /* it holds for this visit only */
  }
}
