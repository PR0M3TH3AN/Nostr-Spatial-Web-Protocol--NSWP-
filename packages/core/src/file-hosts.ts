/**
 * Where someone else's files may be fetched from (protocol/17-items.md, "Where a file is fetched from").
 *
 * An item's files are named by their hash, and the address beside each hash is only a hint. Fetching a file tells
 * the place that keeps it the viewer's address, and the place was chosen by whoever made the item, not by the
 * viewer. So a file is asked for only from file hosts on the viewer's own list: the hosts their own sign-in address
 * keeps their files on (their file host list, kind 10063), then the kit's short default list (`FILE_HOSTS`, hosts
 * BitBlocks runs). Anywhere else only with the viewer's word.
 *
 * A file host here is an address prefix that serves a file by its hash: the file is at `<prefix><sha256><ext>`,
 * the extension taken from the hint. A Blossom server is one (its root, `https://host/`); so is any folder of
 * files named by their hashes.
 */
import { verifyEvent } from "./event.js";
import type { NostrEvent } from "./event.js";

/** The kind of a person's list of the file hosts they keep their files on (Blossom's user server list, NIP-B7). */
export const FILE_HOST_LIST_KIND = 10063;

/** The kit's own default file hosts: hosts BitBlocks runs, each serving files named by their hashes. */
export const FILE_HOSTS: readonly string[] = ["https://grove.bitblocks.network/items/"];

/** The most file hosts taken from one person's list, and the longest a host's address may be. */
export const FILE_HOST_LIMITS = { list: 6, url: 200 } as const;

/**
 * A file host's address as it may be used: `https`, no name or password in it, nothing after a `?` or `#`, and
 * ending in `/`, so that a hash put after it names a file inside it. Null for anything else.
 */
export function cleanFileHost(input: unknown): string | null {
  if (typeof input !== "string" || input.length > FILE_HOST_LIMITS.url) return null;
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "https:" || u.username || u.password) return null;
    u.search = "";
    u.hash = "";
    const href = u.href;
    return href.endsWith("/") ? href : `${href}/`;
  } catch {
    return null;
  }
}

/** A file's extension, from its hint: `.glb`, `.ogg`, `.js`. "" where the hint has none worth using. */
export function fileExtension(hint: string): string {
  try {
    const last = new URL(hint).pathname.split("/").pop() ?? "";
    const ext = /\.[a-z0-9]{1,8}$/i.exec(last)?.[0];
    return ext ? ext.toLowerCase() : "";
  } catch {
    return "";
  }
}

/** Where a file is on a file host: `<host><sha256><ext>`. */
export function fileAt(host: string, sha256: string, hint = ""): string {
  return `${host}${sha256}${fileExtension(hint)}`;
}

/** Whether an address is inside one of these file hosts. */
export function onFileHost(url: string, hosts: readonly string[]): boolean {
  let href: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    href = u.href;
  } catch {
    return false;
  }
  return hosts.some((host) => href.startsWith(host));
}

/**
 * The file hosts a person's list names, in their order: from the newest of their lists that really is theirs.
 * Each is cleaned, the same one isn't named twice, and only the first `FILE_HOST_LIMITS.list` are taken.
 */
export function parseFileHostList(events: readonly NostrEvent[], pubkey: string): string[] {
  const newest = events.filter((e) => e.kind === FILE_HOST_LIST_KIND && e.pubkey === pubkey && verifyEvent(e)).sort((a, b) => b.created_at - a.created_at)[0];
  if (!newest) return [];
  const hosts: string[] = [];
  for (const tag of newest.tags) {
    if (tag[0] !== "server") continue;
    const host = cleanFileHost(tag[1]);
    if (host && !hosts.includes(host)) hosts.push(host);
    if (hosts.length >= FILE_HOST_LIMITS.list) break;
  }
  return hosts;
}
