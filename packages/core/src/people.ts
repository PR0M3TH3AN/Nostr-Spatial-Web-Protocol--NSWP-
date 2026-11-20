/**
 * Who a visitor follows (protocol/14-people-and-messages.md): Nostr's own follow list, NIP-02, kind 3.
 *
 * Following someone is nothing NSWP invented, and a visitor's follows are the same here as in every other Nostr
 * client. What this file adds is how the list is changed without losing any of it.
 *
 * A follow list is one note that is replaced whole. A client that writes a new one from an old copy, or from
 * nothing, wipes out everyone the person followed: it is the best-known way to lose a follow list. So a change
 * here is always made to the newest list that could be found, keeps everything in it that this file doesn't
 * understand, and is refused when there is no list to change unless the caller says the person truly has none.
 *
 * Nothing here signs anything or talks to a relay. A world never has a follow list signed (signing.ts: it is
 * "careful"): this is for the visitor's own client.
 */
import { isHex64, type EventTemplate, type NostrEvent } from "./event.js";

/** Who someone follows: NIP-02. A relay keeps the newest. */
export const FOLLOWS_KIND = 3;

/** The people a follow list names, in its order, each once. Empty for anything that isn't one. */
export function followsIn(event: Pick<NostrEvent, "tags"> | null | undefined): string[] {
  if (!event || !Array.isArray(event.tags)) return [];
  const seen = new Set<string>();
  for (const t of event.tags) {
    if (!Array.isArray(t) || t[0] !== "p" || typeof t[1] !== "string") continue;
    const key = t[1].toLowerCase();
    if (isHex64(key)) seen.add(key);
  }
  return [...seen];
}

/**
 * The newest follow list by this person among what relays returned, or null when there is none. The events are
 * taken as already checked (`queryRelays` checks every signature); whose they are is checked here.
 */
export function newestFollows(events: readonly NostrEvent[], pubkey: string): NostrEvent | null {
  return events.filter((e) => e.kind === FOLLOWS_KIND && e.pubkey === pubkey && Array.isArray(e.tags)).sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1))[0] ?? null;
}

export interface FollowChange {
  /** Someone to begin following. */
  add?: string;
  /** Someone to stop following. */
  remove?: string;
  /** Where the person being followed can be found, as a hint for other clients. */
  relay?: string;
  /** Now, in seconds. */
  now: number;
  /**
   * Write a list where none was found. Only when the person has said they follow nobody yet: a list written from
   * nothing replaces one that merely couldn't be reached.
   */
  fromNothing?: boolean;
}

/**
 * A follow list with one person added or taken out, ready to be signed by its owner. Null when there is nothing
 * to sign: no change asked for, a key that isn't one, following oneself, someone already followed, someone not
 * followed, or no list to change (see `fromNothing`).
 *
 * Everything else in the list is kept as it was and in its order: other people, the relay and the name each was
 * written with, tags of other kinds, and the content, where older clients keep their relays.
 */
export function changeFollows(newest: Pick<NostrEvent, "kind" | "pubkey" | "created_at" | "tags" | "content"> | null, change: FollowChange): EventTemplate | null {
  if (newest && (newest.kind !== FOLLOWS_KIND || !Array.isArray(newest.tags))) return null;
  if (!newest && !change.fromNothing) return null;
  const add = typeof change.add === "string" ? change.add.toLowerCase() : "";
  const remove = typeof change.remove === "string" ? change.remove.toLowerCase() : "";
  // One thing at a time: a press is one person.
  if ((add === "") === (remove === "")) return null;
  const who = add || remove;
  if (!isHex64(who) || (add && newest?.pubkey === add)) return null;

  const had = newest ? newest.tags.filter((t) => Array.isArray(t) && t.every((item) => typeof item === "string")) : [];
  const names = (t: string[]): boolean => t[0] === "p" && typeof t[1] === "string" && t[1].toLowerCase() === who;
  const follows = had.some(names);
  if (add ? follows : !follows) return null;
  const tags = add ? [...had.map((t) => [...t]), ["p", add, ...(change.relay ? [change.relay] : [])]] : had.filter((t) => !names(t)).map((t) => [...t]);
  // Never older than the one it replaces: a relay would keep the old one.
  const created_at = Math.max(Math.floor(change.now), newest ? newest.created_at + 1 : 0);
  return { kind: FOLLOWS_KIND, created_at, tags, content: typeof newest?.content === "string" ? newest.content : "" };
}
