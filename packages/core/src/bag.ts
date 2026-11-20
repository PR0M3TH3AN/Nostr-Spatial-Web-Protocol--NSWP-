/**
 * What a person has: their bag (protocol/17-items.md, "A visitor's bag").
 *
 * A bag is a list of items, by their coordinates, kept by the person whose it is: ones they made, ones they took
 * up from someone else's site, ones a world gave them. It is one note, signed by their key, and public: what
 * someone carries is on show anyway.
 *
 * Like a follow list (people.ts), it is replaced whole each time. So it is changed the same careful way: from the
 * newest that can be found, one line at a time, keeping everything else, and never written from nothing unless
 * the person has said they have none.
 *
 * Nothing here signs anything or talks to a relay.
 */
import { isHex64, type EventTemplate, type NostrEvent } from "./event.js";
import { ITEM_KIND } from "./layout.js";
import { SITE_MARKS } from "./rating.js";

/** A person's bag: addressable, one for each person. Experimental; not allocated by the NIPs process. */
export const BAG_KIND = 37308;
/** The one name a bag is kept under. */
export const BAG_D = "bag";

export const BAG_LIMITS = {
  /** No more than this many items are read from a bag. */
  items: 200,
} as const;

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** An item's coordinate as it may be used: `37303:<maker>:<name>`. "" for anything else. */
export function itemCoordinate(input: unknown): string {
  if (typeof input !== "string" || input.length > 200) return "";
  const [kind, maker, ...rest] = input.split(":");
  const d = rest.join(":");
  return kind === String(ITEM_KIND) && isHex64(maker) && NAME.test(d) ? `${ITEM_KIND}:${maker}:${d}` : "";
}

/** The items a bag names, in its order, each once. Empty for anything that isn't one. */
export function bagIn(event: Pick<NostrEvent, "tags"> | null | undefined): string[] {
  if (!event || !Array.isArray(event.tags)) return [];
  const seen = new Set<string>();
  for (const t of event.tags) {
    if (!Array.isArray(t) || t[0] !== "a") continue;
    const item = itemCoordinate(t[1]);
    if (item && seen.size < BAG_LIMITS.items) seen.add(item);
  }
  return [...seen];
}

/** The newest bag by this person among what relays returned, or null. Whose it is, is checked here. */
export function newestBag(events: readonly NostrEvent[], pubkey: string): NostrEvent | null {
  return (
    events
      .filter((e) => e.kind === BAG_KIND && e.pubkey === pubkey && Array.isArray(e.tags) && e.tags.some((t) => t[0] === "d" && t[1] === BAG_D))
      .sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1))[0] ?? null
  );
}

/**
 * A bag with one item put in or taken out, ready to be signed by its owner. Null when there is nothing to sign:
 * no change asked for, something that isn't an item, one already there, one that isn't, or no bag to change
 * unless `fromNothing` says the person truly has none. Everything else in it is kept as it was.
 */
export function changeBag(newest: Pick<NostrEvent, "kind" | "created_at" | "tags"> | null, change: { add?: string; remove?: string; relay?: string; now: number; fromNothing?: boolean }): EventTemplate | null {
  if (newest && (newest.kind !== BAG_KIND || !Array.isArray(newest.tags))) return null;
  if (!newest && !change.fromNothing) return null;
  const add = itemCoordinate(change.add);
  const remove = itemCoordinate(change.remove);
  if ((add === "") === (remove === "")) return null;
  const which = add || remove;
  // A mark a signer put on the last one is that signer's to write again: it isn't carried along.
  const had = newest ? newest.tags.filter((t) => Array.isArray(t) && t.every((x) => typeof x === "string") && !SITE_MARKS.includes(t[0] ?? "") && t[0] !== "d" && t[0] !== "alt") : [];
  const names = (t: string[]) => t[0] === "a" && itemCoordinate(t[1]) === which;
  const has = had.some(names);
  if (add ? has : !has) return null;
  if (add && bagIn({ tags: had }).length >= BAG_LIMITS.items) return null;
  const kept = add ? [...had.map((t) => [...t]), ["a", add, ...(change.relay ? [change.relay] : [])]] : had.filter((t) => !names(t)).map((t) => [...t]);
  return {
    kind: BAG_KIND,
    created_at: Math.max(Math.floor(change.now), newest ? newest.created_at + 1 : 0),
    tags: [["d", BAG_D], ...kept, ["alt", "A bag: the items this person has"]],
    content: "",
  };
}
