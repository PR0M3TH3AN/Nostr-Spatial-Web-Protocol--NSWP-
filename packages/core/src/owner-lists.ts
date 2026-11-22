/**
 * A world owner's own lists: who is let into a world, and who is kept out of it (protocol/10-identity.md, "A
 * world's own lists"; docs/plans/a-world-by-invitation.md).
 *
 * The shape is BitGate's, not the kit's: one shape for an allow list and a block list everywhere
 * (PR0M3TH3AN/bitgate, `docs/governance-lists.md`). This file reads it the way that document says, and is held to
 * BitGate's own examples (`vectors/governance-lists.json`, copied with the commit they came from). Nothing here
 * needs a service: a list is a signed note, and every copy of the kit checks the signature itself.
 *
 * - A list is kind 30078, addressed by `d` = `<namespace>:governance:<scope>:v1:<subject>`, with the subject the
 *   world's own coordinate (`37300:<key>:<its d>`). An allow list and a block list are two notes.
 * - It counts only when signed by the root the reader was given: by default the subject's own key, and for a world
 *   whose manifest names `keepers`, those. A given root replaces the default.
 * - The newest copy is the list. One dated more than ten minutes ahead is left out before choosing, and said.
 *   If the newest is refused, the list is unreadable: an older copy is never used in its place.
 * - A list is public. Anyone can read who is let in and who is kept out, and the owner is told so.
 *
 * The decisions on how a world acts on them (blocked beats invited, a block list that can't be read is no block,
 * an allow list that can't be read lets nobody in) are the gate's (SDK `front-room.ts`), not this file's.
 */
import { isHex64, verifyEvent, type NostrEvent } from "./event.js";
import { SITE_MARKS } from "./rating.js";

/** The kind a list is: application data, addressed by its own name. The same kind as a listing and a receipt. */
export const LIST_KIND = 30078;
/** The namespace every client's lists for worlds are written under. */
export const LIST_NAMESPACE = "nswp";
/**
 * The limits. `read`: the most entries a list may have and still be read at all (one with more is refused, not
 * cut short). `write`: the most the kit's own writers put in one (a longer note is refused by many relays). `ahead`:
 * how far ahead of the reader's clock a list may be dated, in seconds. `root`: the most keys a root may be.
 */
export const OWNER_LIST_LIMITS = { read: 2000, write: 500, ahead: 600, root: 4 } as const;

export type ListScope = "user-allow" | "user-deny";
export type ListRefusal =
  | "not_an_event"
  | "wrong_kind"
  | "bad_d"
  | "unsupported_version"
  | "unsupported_scope"
  | "bad_subject"
  | "tag_mismatch"
  | "wrong_signer"
  | "content_not_empty"
  | "too_many_entries"
  | "from_the_future"
  | "bad_signature";

/** What one list says, once it has been read and checked. */
export interface OwnerList {
  readonly ok: true;
  readonly scope: ListScope;
  /** What it is for: the world's coordinate. */
  readonly subject: string;
  /** Who signed it: a key of the root. */
  readonly signer: string;
  /** The people on it, each once, in order of their keys (as BitGate gives them). */
  readonly entries: readonly string[];
  /** How many `p` tags weren't a key in lowercase hex, and were left out. */
  readonly skipped: number;
}
export type ListRead = OwnerList | { readonly ok: false; readonly reason: ListRefusal };
/** The list as chosen from what relays gave: the newest copy, or why there is none. `futureDated` lists the copies left out for being dated ahead. */
export type ListResolved = (OwnerList | { readonly ok: false; readonly reason: ListRefusal | "not_found" }) & { readonly futureDated: readonly string[] };

const NAMESPACE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const D = /^([^:]*):governance:([^:]*):v([^:]*):([\s\S]*)$/;
const HEX = (n: number) => new RegExp(`^[0-9a-f]{${n}}$`);
const HEX128 = HEX(128);
const no = (reason: ListRefusal): ListRead => ({ ok: false, reason });

/** A subject, as the grammar has it: a kind, a key, and the rest is the name. True if it is one. */
export function isListSubject(subject: unknown): subject is string {
  if (typeof subject !== "string") return false;
  const m = /^(0|[1-9][0-9]{0,4}):([0-9a-f]{64}):([\s\S]*)$/.exec(subject);
  if (!m || Number(m[1]) > 65535) return false;
  const name = m[3]!;
  // 1 to 512 bytes of UTF-8, with no control character in it. Compared exactly: nothing is trimmed or normalised.
  if (!name || new TextEncoder().encode(name).length > 512) return false;
  return !/[\u0000-\u001f\u007f]/.test(name);
}

/** A world's coordinate as a list's subject: `37300:<the key that announced it>:<its d>`. */
export function worldSubject(publisher: string, d: string): string {
  return `37300:${publisher}:${d}`;
}

/** The `d` a list is filed under. */
export function listD(scope: ListScope, subject: string, namespace: string = LIST_NAMESPACE): string {
  return `${namespace}:governance:${scope}:v1:${subject}`;
}

/** A root as it may be given: one key or a list of one to four, each 64 lowercase hex. Null for anything else. */
export function cleanRoot(root: unknown): string[] | null {
  const keys = Array.isArray(root) ? root : [root];
  if (keys.length < 1 || keys.length > OWNER_LIST_LIMITS.root || !keys.every(isHex64)) return null;
  return [...new Set(keys as string[])];
}

const shaped = (e: unknown): e is NostrEvent => {
  const v = e as NostrEvent | null;
  return (
    !!v &&
    typeof v === "object" &&
    isHex64(v.id) &&
    isHex64(v.pubkey) &&
    typeof v.sig === "string" &&
    HEX128.test(v.sig) &&
    Number.isInteger(v.kind) &&
    Number.isInteger(v.created_at) &&
    typeof v.content === "string" &&
    Array.isArray(v.tags) &&
    v.tags.every((t) => Array.isArray(t) && t.every((x) => typeof x === "string"))
  );
};

/**
 * Read one list, the way BitGate's document says, refusing with the first check that fails. `root` is the keys
 * that may sign it (left out: the subject's own key). `now` is the reader's clock, in seconds.
 */
export function readOwnerList(event: unknown, o: { root?: string | readonly string[]; now?: number } = {}): ListRead {
  const now = o.now ?? Math.floor(Date.now() / 1000);
  if (!shaped(event)) return no("not_an_event");
  const e = event;
  if (e.kind !== LIST_KIND) return no("wrong_kind");
  const ds = e.tags.filter((t) => t[0] === "d");
  const m = ds.length === 1 ? D.exec(ds[0]![1] ?? "") : null;
  if (!m || !NAMESPACE.test(m[1]!) || !/^[0-9]+$/.test(m[3]!)) return no("bad_d");
  const [, , scope, version, subject] = m as unknown as [string, string, string, string, string];
  if (version !== "1") return no("unsupported_version");
  if (scope !== "user-allow" && scope !== "user-deny") return no("unsupported_scope");
  if (!isListSubject(subject)) return no("bad_subject");
  const one = (name: string, value: string) => {
    const found = e.tags.filter((t) => t[0] === name);
    return found.length === 1 && found[0]![1] === value;
  };
  if (!one("v", version) || !one("scope", scope) || !one("subject", subject)) return no("tag_mismatch");
  const root = o.root === undefined ? [subject.slice(subject.indexOf(":") + 1, subject.indexOf(":") + 65)] : cleanRoot(o.root);
  if (!root || !root.includes(e.pubkey)) return no("wrong_signer");
  if (e.content !== "") return no("content_not_empty");
  const people = e.tags.filter((t) => t[0] === "p");
  if (people.length > OWNER_LIST_LIMITS.read) return no("too_many_entries");
  if (e.created_at > now + OWNER_LIST_LIMITS.ahead) return no("from_the_future");
  let signed = false;
  try {
    // A copy is checked: checking must never change what the caller holds.
    signed = verifyEvent({ ...e, tags: e.tags.map((t) => [...t]) });
  } catch {
    signed = false;
  }
  if (!signed) return no("bad_signature");
  const entries: string[] = [];
  let skipped = 0;
  for (const t of people) {
    const key = t[1];
    if (!isHex64(key)) skipped++;
    else if (!entries.includes(key)) entries.push(key);
  }
  entries.sort();
  return { ok: true, scope, subject, signer: e.pubkey, entries, skipped };
}

/**
 * Choose the list from whatever relays gave: the copies signed by a root key, under exactly the expected `d`, with
 * a good signature. Those dated more than ten minutes ahead are left out first, and named in `futureDated`. The
 * newest of the rest (a tie to the smallest id) is read in full; if it is refused, the list is unreadable.
 */
export function resolveOwnerList(events: readonly unknown[], q: { scope: ListScope; subject: string; namespace?: string; root?: string | readonly string[]; now?: number }): ListResolved {
  const now = q.now ?? Math.floor(Date.now() / 1000);
  const d = listD(q.scope, q.subject, q.namespace ?? LIST_NAMESPACE);
  const root = q.root === undefined ? (isListSubject(q.subject) ? [q.subject.split(":")[1]!] : null) : cleanRoot(q.root);
  if (!root) return { ok: false, reason: "wrong_signer", futureDated: [] };
  const candidates: NostrEvent[] = [];
  const futureDated: string[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (!shaped(e) || e.kind !== LIST_KIND || !root.includes(e.pubkey) || seen.has(e.id)) continue;
    const ds = e.tags.filter((t) => t[0] === "d");
    if (ds.length !== 1 || ds[0]![1] !== d) continue;
    let signed = false;
    try {
      signed = verifyEvent({ ...e, tags: e.tags.map((t) => [...t]) });
    } catch {
      signed = false;
    }
    if (!signed) continue;
    seen.add(e.id);
    if (e.created_at > now + OWNER_LIST_LIMITS.ahead) futureDated.push(e.id);
    else candidates.push(e);
  }
  if (!candidates.length) return { ok: false, reason: "not_found", futureDated };
  candidates.sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1));
  return { ...readOwnerList(candidates[0], { root, now }), futureDated };
}

/**
 * A list to sign, for the kit's own writers (the `nswp` command, and later the owner's screen): the tags BitGate's
 * shape needs, in that order, and one `p` for each person, each once and in order of their keys (as a reader gives
 * them back), at most `OWNER_LIST_LIMITS.write`. Null where it can't be written: a subject that isn't one, a key that
 * isn't one, or too many people. `vectors/owner-list-writing.json` is what another writer is held to.
 */
export function ownerListTemplate(o: { scope: ListScope; subject: string; people: readonly string[]; createdAt: number; namespace?: string }): { kind: number; created_at: number; content: string; tags: string[][] } | null {
  const people = [...new Set(o.people)].sort();
  if (!isListSubject(o.subject) || people.length > OWNER_LIST_LIMITS.write || !people.every(isHex64)) return null;
  return {
    kind: LIST_KIND,
    created_at: o.createdAt,
    content: "",
    tags: [["d", listD(o.scope, o.subject, o.namespace)], ["v", "1"], ["scope", o.scope], ["subject", o.subject], ...people.map((p) => ["p", p])],
  };
}

/** One change to a world owner's lists: who is let in, taken off, kept out, or no longer kept out. */
export type OwnerListChange = "allow" | "unallow" | "block" | "unblock";
/** Which list a change is made to: letting in and taking off are the guest list's, blocking and unblocking the block list's. */
export const scopeOfChange = (change: OwnerListChange): ListScope => (change === "allow" || change === "unallow" ? "user-allow" : "user-deny");

/**
 * The list one change makes (protocol/10-identity.md, "Writing one, from one change"; `vectors/owner-list-writing.json`
 * is held to it): everyone on `list` stays, `key` is put on or taken off, and it is dated `now`, or a second after
 * `list` where that is later, so it replaces it. `list` is the newest found for that world and that change's list, or
 * null for none. Null where it can't be written: a list that is another world's or another list, a key that isn't one,
 * a subject that isn't one, or more than `OWNER_LIST_LIMITS.write` people.
 */
export function changeOwnerList(list: NostrEvent | null, o: { subject: string; change: OwnerListChange; key: string; now: number; namespace?: string }): ReturnType<typeof ownerListTemplate> {
  if (!isHex64(o.key) || !["allow", "unallow", "block", "unblock"].includes(o.change)) return null;
  const scope = scopeOfChange(o.change);
  const d = listD(scope, o.subject, o.namespace);
  if (list && (list.kind !== LIST_KIND || list.tags.filter((t) => t[0] === "d").map((t) => t[1]).join("\n") !== d)) return null;
  const was = list ? [...new Set(list.tags.filter((t) => t[0] === "p" && isHex64(t[1])).map((t) => t[1]!))] : [];
  const people = o.change === "allow" || o.change === "block" ? [...was, o.key] : was.filter((k) => k !== o.key);
  const createdAt = list ? Math.max(o.now, list.created_at + 1) : o.now;
  return ownerListTemplate({ scope, subject: o.subject, people, createdAt, ...(o.namespace ? { namespace: o.namespace } : {}) });
}

/** Tags a writer may add that change nothing a reader reads: which client wrote it, and the marks of the site it was signed at. */
const NOT_READ = ["client", ...SITE_MARKS];

/**
 * Whether `signed`, come back from a sign-in address, is exactly `list` with that one change: signed by `pubkey` (the
 * keeper who asked), really signed, dated after `list`, and with the same tags and people as `changeOwnerList` gives,
 * leaving out a `client` tag and a site's marks, which a writer may add. Nothing else gets in, and nothing between can
 * slip anyone onto the list.
 */
export function isOwnerListAsked(signed: unknown, o: { list: NostrEvent | null; subject: string; change: OwnerListChange; key: string; pubkey: string | null; namespace?: string }): signed is NostrEvent {
  if (!o.pubkey || !shaped(signed) || signed.kind !== LIST_KIND || signed.pubkey !== o.pubkey || signed.content !== "") return false;
  if (o.list && signed.created_at <= o.list.created_at) return false;
  let good = false;
  try {
    good = verifyEvent({ ...signed, tags: signed.tags.map((t) => [...t]) });
  } catch {
    good = false;
  }
  if (!good) return false;
  const want = changeOwnerList(o.list, { subject: o.subject, change: o.change, key: o.key, now: signed.created_at, ...(o.namespace ? { namespace: o.namespace } : {}) });
  if (!want || want.created_at !== signed.created_at) return false;
  return JSON.stringify(signed.tags.filter((t) => !NOT_READ.includes(t[0] ?? ""))) === JSON.stringify(want.tags);
}
