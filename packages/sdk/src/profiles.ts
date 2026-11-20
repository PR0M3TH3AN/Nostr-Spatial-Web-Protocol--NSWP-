/**
 * The name, picture and few words people gave themselves (Nostr kind 0), for showing the people a visitor
 * follows by name and not by a string of letters.
 *
 *   const profiles = createProfiles();
 *   await profiles.fetch(keys);          // asks relays for the ones not known lately
 *   profiles.get(key)?.name;
 *
 * Kept on the device once fetched, so a list shows names at once. Asking a relay about a key tells that relay
 * which keys this browser looked at, the same as reading Nostr anywhere: so nothing here is asked until the
 * visitor opens the thing that shows it. A name is its owner's own choice and proves nothing; the key is what
 * tells two people apart.
 */
import { cleanAbout, cleanName, cleanPicture, DEFAULT_RELAYS, isHex64, queryRelays, verifyEvent, type NostrEvent } from "@nswp/core";
import { askWell } from "./relay-book.js";

export interface Profile {
  name: string;
  /** Where their picture is, or "". */
  picture: string;
  /** What they wrote about themselves, as plain text, or "". Their own words, not a fact. */
  about: string;
  /** When they wrote it, in seconds. A newer one replaces an older one, never the other way. */
  at: number;
  /** When this device last asked, in milliseconds. */
  asked: number;
}

export interface ProfilesOptions {
  relays?: string[];
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  now?: () => number;
  query?: typeof queryRelays;
}

export interface Profiles {
  get(pubkey: string): Profile | null;
  /** Ask relays for these people's profiles, where they aren't known or were last asked for long ago. */
  fetch(pubkeys: readonly string[]): Promise<void>;
  onChange(fn: () => void): () => void;
}

const KEY = "nswp:profiles";
const MOST = 400;
const FRESH_MS = 24 * 3600 * 1000;
/** No more than this many are asked for at once: a list is filled in a page at a time. */
const AT_ONCE = 60;

/** What a profile note says of its writer, tidied: any of it may be "". */
export function readProfile(event: Pick<NostrEvent, "content" | "created_at">): Pick<Profile, "name" | "picture" | "about" | "at"> {
  let meta: { display_name?: unknown; displayName?: unknown; name?: unknown; picture?: unknown; about?: unknown } = {};
  try {
    const parsed = JSON.parse(event.content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed as typeof meta;
  } catch {
    /* not a profile anyone can read */
  }
  let name = "";
  for (const v of [meta.display_name, meta.displayName, meta.name]) {
    if (!name && typeof v === "string") name = cleanName(v);
  }
  return { name, picture: cleanPicture(meta.picture), about: cleanAbout(meta.about), at: event.created_at };
}

export function createProfiles(opts: ProfilesOptions = {}): Profiles {
  const now = opts.now ?? (() => Date.now());
  const query = opts.query ?? queryRelays;
  const store = (() => {
    if (opts.storage !== undefined) return opts.storage;
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  })();
  const watchers = new Set<() => void>();
  let kept: Record<string, Profile> | null = null;
  const all = (): Record<string, Profile> => {
    if (kept) return kept;
    kept = {};
    try {
      const read = JSON.parse(store?.getItem(KEY) ?? "{}") as unknown;
      if (read && typeof read === "object" && !Array.isArray(read)) {
        for (const [k, v] of Object.entries(read as Record<string, Partial<Profile>>)) {
          if (!isHex64(k) || !v || typeof v !== "object") continue;
          kept[k] = { name: cleanName(typeof v.name === "string" ? v.name : ""), picture: cleanPicture(v.picture), about: cleanAbout(v.about), at: typeof v.at === "number" ? v.at : 0, asked: typeof v.asked === "number" ? v.asked : 0 };
        }
      }
    } catch {
      /* nothing kept */
    }
    return kept;
  };
  const save = () => {
    const entries = Object.entries(all());
    if (entries.length > MOST) kept = Object.fromEntries(entries.sort((a, b) => b[1].asked - a[1].asked).slice(0, MOST));
    try {
      store?.setItem(KEY, JSON.stringify(kept));
    } catch {
      /* a private window: known for this page only */
    }
  };

  return {
    get: (pubkey) => all()[pubkey] ?? null,
    async fetch(pubkeys) {
      const book = all();
      const wanted = [...new Set(pubkeys)].filter((k) => isHex64(k) && now() - (book[k]?.asked ?? 0) > FRESH_MS).slice(0, AT_ONCE);
      if (wanted.length === 0) return;
      const got = await askWell({ kinds: [0], authors: wanted, limit: wanted.length * 2 }, { own: [], usual: opts.relays ?? DEFAULT_RELAYS, query, timeoutMs: 4000, now }).catch(() => null);
      const answered = !!got && Object.values(got.relays).some((said) => said === "eose");
      for (const e of got?.events ?? []) {
        if (e.kind !== 0 || !wanted.includes(e.pubkey) || !verifyEvent(e)) continue;
        const had = book[e.pubkey];
        if (had && had.at >= e.created_at) continue;
        book[e.pubkey] = { ...readProfile(e), asked: now() };
      }
      // Asked for and not found is remembered too, where a relay answered: they aren't asked about again today.
      if (answered) for (const k of wanted) book[k] = { ...(book[k] ?? { name: "", picture: "", about: "", at: 0 }), asked: now() };
      save();
      for (const fn of watchers) fn();
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
  };
}
