/**
 * Lists of worlds (protocol/08-lists.md): a NIP-51 curation set, kind 30004,
 * whose `a` tags name world announcements in the order their curator wants
 * them shown.
 *
 * A curation set can hold other things too. A reader here keeps the worlds
 * and passes over the rest without complaint.
 */
import { CURATION_SET_KIND, LIMITS, WORLD_KIND } from "./constants.js";
import { getTags, getTagValue, hasEventShape, isHex64, nowSeconds, type EventTemplate } from "./event.js";
import { coordinate, parseCoordinate } from "./nip19.js";
import { Collector, type Result } from "./result.js";

/** Ceilings a reader enforces whatever a list claims. */
export const LIST_LIMITS = { worlds: 200, titleChars: 200, descriptionChars: 1000 } as const;

export interface ListInput {
  /** The list's name under its curator's key. */
  d: string;
  title: string;
  description?: string;
  /** World coordinates, `37300:<pubkey>:<d>`, in the order to show them. */
  worlds: string[];
  createdAt?: number;
}

export interface WorldList {
  d: string;
  /** The curator's title, or the list's `d` when it has none. */
  title: string;
  description: string;
  /** World coordinates, in the curator's order, each once. */
  worlds: string[];
  createdAt: number;
  /** The curator's key, when the event carries one. */
  pubkey?: string;
  /** `30004:<pubkey>:<d>`: what a client follows. */
  coordinate?: string;
}

/** A list event, ready to sign. */
export function buildListEvent(l: ListInput): EventTemplate {
  const tags: string[][] = [["d", l.d], ["title", l.title]];
  if (l.description) tags.push(["description", l.description]);
  for (const w of l.worlds) tags.push(["a", w]);
  tags.push(["alt", `A list of spatial worlds: ${l.title}`]);
  return { kind: CURATION_SET_KIND, created_at: l.createdAt ?? nowSeconds(), tags, content: "" };
}

export interface ParseListOptions {
  /** Require `id`, `pubkey` and `sig` fields (the signature itself is checked by `verifyEvent`). */
  requireSigned?: boolean;
}

/** Read a list. Anything on it that isn't a world is passed over; too many worlds are cut off with a warning. */
export function parseListEvent(input: unknown, opts: ParseListOptions = {}): Result<WorldList> {
  const c = new Collector();
  if (typeof input !== "object" || input === null) {
    c.error("not_an_event", "", "Expected a Nostr event object.");
    return c.result(null as never);
  }
  const e = input as Partial<EventTemplate> & { pubkey?: unknown };
  if (e.kind !== CURATION_SET_KIND) c.error("wrong_kind", "kind", `Expected kind ${CURATION_SET_KIND}, got ${String(e.kind)}.`);
  if (!Array.isArray(e.tags) || !e.tags.every((t) => Array.isArray(t) && t.every((x) => typeof x === "string"))) {
    c.error("invalid_tags", "tags", "tags must be an array of string arrays.");
    return c.result(null as never);
  }
  if (!Number.isInteger(e.created_at)) c.error("invalid_created_at", "created_at", "created_at must be an integer.");
  if (opts.requireSigned && !hasEventShape(input)) c.error("not_signed", "", "Expected a signed event with id, pubkey and sig.");
  const pubkey = isHex64(e.pubkey) ? e.pubkey : undefined;
  if (e.pubkey !== undefined && !pubkey) c.error("invalid_pubkey", "pubkey", "pubkey must be 64 lowercase hex characters.");
  const tags = e.tags;

  const d = getTagValue({ tags }, "d");
  if (d === undefined) c.error("missing_tag", "tags.d", "A list needs a d tag.");
  else if (d.length > LIMITS.maxIdLength) c.error("value_too_long", "tags.d", `d must be at most ${LIMITS.maxIdLength} characters.`);

  let title = getTagValue({ tags }, "title") ?? "";
  if (title.length > LIST_LIMITS.titleChars) {
    c.warn("value_too_long", "tags.title", "The title is cut short.");
    title = title.slice(0, LIST_LIMITS.titleChars);
  }
  let description = getTagValue({ tags }, "description") ?? "";
  if (description.length > LIST_LIMITS.descriptionChars) {
    c.warn("value_too_long", "tags.description", "The description is cut short.");
    description = description.slice(0, LIST_LIMITS.descriptionChars);
  }

  const worlds: string[] = [];
  let over = false;
  for (const t of getTags({ tags }, "a")) {
    const parsed = t[1] ? parseCoordinate(t[1]) : null;
    if (!parsed || parsed.kind !== WORLD_KIND || parsed.identifier === "") continue; // not a world: not ours to judge
    const id = coordinate(parsed);
    if (worlds.includes(id)) continue;
    if (worlds.length === LIST_LIMITS.worlds) {
      over = true;
      break;
    }
    worlds.push(id);
  }
  if (over) c.warn("too_many_worlds", "tags.a", `Only the first ${LIST_LIMITS.worlds} worlds on a list are read.`);

  const list: WorldList = { d: d ?? "", title: title || (d ?? ""), description, worlds, createdAt: Number.isInteger(e.created_at) ? (e.created_at as number) : 0 };
  if (pubkey) {
    list.pubkey = pubkey;
    if (d !== undefined) list.coordinate = coordinate({ kind: CURATION_SET_KIND, pubkey, identifier: d });
  }
  return c.result(list);
}
