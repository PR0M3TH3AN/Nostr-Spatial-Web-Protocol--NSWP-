/**
 * Fetching someone else's file by its hash, only from file hosts on the viewer's own list
 * (protocol/17-items.md, "Where a file is fetched from").
 *
 * The viewer's list is the file hosts their own sign-in address keeps their files on (their kind 10063 list, read
 * from relays by their key), then the kit's default (`FILE_HOSTS`). Each is asked for the hash itself, at
 * `<host><sha256><ext>`. The address an item gives for a file is only a hint: it is used when it is inside one of
 * those hosts, or when the viewer turned on "Load people's files from anywhere" (`files-anywhere`). Whatever
 * comes is still taken only if its bytes have the hash.
 *
 * A guest has no list of their own: only `FILE_HOSTS`.
 */
import { DEFAULT_RELAYS, FILE_HOST_LIST_KIND, FILE_HOSTS, fileAt, onFileHost, parseFileHostList, queryRelays } from "@nswp/core";
import { sha256 as hash } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { askWell } from "./relay-book.js";
import { arrivedSettings, reportSettings } from "./settings.js";

const ANYWHERE_KEY = "nswp:files-anywhere";
const watchers = new Set<() => void>();
let anywhere: boolean | null = null;

const keep = (on: boolean): void => {
  try {
    if (on) globalThis.localStorage?.setItem(ANYWHERE_KEY, "on");
    else globalThis.localStorage?.removeItem(ANYWHERE_KEY);
  } catch {
    /* a private window: for this page only */
  }
};

/**
 * Whether this visitor loads other people's files from anywhere they say they are kept. Off unless they turned it
 * on here, with their own press. Turning it off goes with them, as their other settings do; turning it on never
 * does, since any world can write the link a visitor arrives by, and so could turn it on for them unasked.
 */
export function filesAnywhere(): boolean {
  if (anywhere !== null) return anywhere;
  const came = arrivedSettings().filesAnywhere;
  let kept: string | null = null;
  try {
    kept = globalThis.localStorage?.getItem(ANYWHERE_KEY) ?? null;
  } catch {
    /* nothing kept */
  }
  // Only an arriving off is taken (the settings drop anything else as they are read): it is always safe.
  anywhere = came === false ? false : kept === "on";
  if (came === false) keep(false);
  reportSettings("files-anywhere", () => (filesAnywhere() ? {} : { filesAnywhere: false }));
  return anywhere;
}

/** Turn loading files from anywhere on, or off again, for this visitor. */
export function setFilesAnywhere(on: boolean): void {
  filesAnywhere();
  anywhere = on;
  keep(on);
  for (const fn of watchers) fn();
}

/** Be told when the switch changes, or the viewer's own list arrives. Returns how to stop. */
export function onFileHostsChange(fn: () => void): () => void {
  watchers.add(fn);
  return () => void watchers.delete(fn);
}

/** For tests: forget the switch and the viewer's list, so both are read afresh. */
export function forgetFileHosts(): void {
  anywhere = null;
  own = null;
}

export interface FileHostsOptions {
  relays?: string[];
  query?: typeof queryRelays;
  now?: () => number;
}

/** The viewer's own list: whose it is, what it holds once read, and the asking for it. */
let own: { pubkey: string; hosts: string[]; asked: Promise<string[]> } | null = null;

/**
 * Read the file hosts this viewer keeps their files on, from their kind 10063 list: once for each key, and kept
 * for the visit. Null (a guest) leaves only the kit's own. What is read is what `fileHosts()` gives from then on.
 */
export function learnFileHosts(pubkey: string | null, opts: FileHostsOptions = {}): Promise<string[]> {
  if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
    own = null;
    return Promise.resolve([]);
  }
  if (own?.pubkey === pubkey) return own.asked;
  const mine: NonNullable<typeof own> = {
    pubkey,
    hosts: [],
    asked: askWell({ kinds: [FILE_HOST_LIST_KIND], authors: [pubkey], limit: 4 }, { own: [], usual: opts.relays ?? DEFAULT_RELAYS, ...(opts.query ? { query: opts.query } : {}), timeoutMs: 4000, ...(opts.now ? { now: opts.now } : {}) })
      .then((got) => parseFileHostList(got.events, pubkey))
      .catch(() => [] as string[])
      .then((hosts) => {
        mine.hosts = hosts;
        if (own === mine) for (const fn of watchers) fn();
        return hosts;
      }),
  };
  own = mine;
  return mine.asked;
}

/** The viewer's list, as it is known now: the hosts their own sign-in address keeps their files on, then `FILE_HOSTS`. */
export function fileHosts(): string[] {
  return [...new Set([...(own?.hosts ?? []), ...FILE_HOSTS])];
}

/**
 * Whether the place a file says it is kept is somewhere this viewer doesn't load files from: off their list, with
 * `files-anywhere` off. Such a file is still asked for by its hash from the hosts on their list.
 */
export function keptElsewhere(hint: string): boolean {
  return !filesAnywhere() && !onFileHost(hint, fileHosts());
}

export interface FetchByHashOptions {
  /** The most bytes taken. */
  most?: number;
  /** Fetch an address's bytes: the browser's own, with nothing sent with it, unless given. */
  fetchBytes?: (url: string) => Promise<Uint8Array | null>;
  /** Whose own list is used, read first if it hasn't been: the signed-in viewer's key, or null for a guest. */
  viewer?: string | null;
  hosts?: FileHostsOptions;
}

/** How long a file is waited for, at one address. */
const FETCH_MS = 30_000;

async function fetchWithin(url: string, most: number): Promise<Uint8Array | null> {
  try {
    // Nothing of the viewer's goes with it, it may not be sent on somewhere else, and it isn't waited for for ever.
    const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: AbortSignal.timeout(FETCH_MS) });
    if (!res.ok) return null;
    const stated = Number(res.headers.get("content-length") ?? 0);
    if (stated > most) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length <= most ? bytes : null;
  } catch {
    return null;
  }
}

/** The addresses a file is asked for at, in order: the hint first where it is on the list (or anything goes), then each listed host. */
export function addressesFor(sha256: string, hint: string, hosts: readonly string[] = fileHosts(), anywhereOn: boolean = filesAnywhere()): string[] {
  const at = hosts.map((host) => fileAt(host, sha256, hint));
  const useHint = !!hint && (anywhereOn || onFileHost(hint, hosts));
  return [...new Set(useHint ? [hint, ...at] : at)];
}

/** What asking for a file came to: its bytes, or null; and whether something came that wasn't it. */
export interface Fetched {
  bytes: Uint8Array | null;
  /** Something came that was too big, or didn't have the hash: asking the same places again would get the same. */
  wrong: boolean;
}

/** `fetchByHash`, saying whether something wrong came. */
export async function fetchByHashSaying(sha256: string, hint: string, opts: FetchByHashOptions = {}): Promise<Fetched> {
  if (!/^[0-9a-f]{64}$/.test(sha256)) return { bytes: null, wrong: false };
  const most = opts.most ?? Infinity;
  if (opts.viewer !== undefined) await learnFileHosts(opts.viewer, opts.hosts);
  const get = opts.fetchBytes ?? ((url: string) => fetchWithin(url, most));
  let wrong = false;
  for (const url of addressesFor(sha256, hint)) {
    const bytes = await get(url).catch(() => null);
    if (bytes && bytes.length <= most && bytesToHex(hash(bytes)) === sha256) return { bytes, wrong: false };
    if (bytes) wrong = true;
  }
  return { bytes: null, wrong };
}

/**
 * A file's bytes, by its hash: asked for only where the viewer's own list allows (`addressesFor`), one address at a
 * time, and taken only if they have that hash and are no more than `most`. Null where none had it.
 */
export async function fetchByHash(sha256: string, hint: string, opts: FetchByHashOptions = {}): Promise<Uint8Array | null> {
  return (await fetchByHashSaying(sha256, hint, opts)).bytes;
}
