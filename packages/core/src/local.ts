/**
 * Local copies: for someone trying their sites on their own machine before
 * they are deployed.
 *
 * A world is built for its real address, and every door, announcement and
 * pass names that address. On a developer's machine the same build is served
 * from somewhere else (`http://localhost:4301/`), and a door followed there
 * would otherwise lead out to the deployed site. So a development server may
 * publish a map, real address to local copy, and a page reads it and follows
 * it at the last moment: when it sends the visitor's browser somewhere.
 *
 * Nothing else changes. What a door says, what an Airlock checks and shows,
 * and what an announcement is signed over are all still the real address.
 * And a deployed site never asks for a map at all: only a page that is itself
 * on a local address, over plain http, does. So the same build that was tried
 * locally goes live with every link leading to the real place.
 */

/** Where a development server publishes its map. */
export const LOCAL_MAP_PATH = "/.well-known/nswp-local.json";
/** The most entries a map may have. */
export const LOCAL_MAP_LIMIT = 64;

export type LocalMap = ReadonlyMap<string, string>;

/**
 * Whether a host is one only this machine or this network can reach:
 * localhost, a loopback address, or a private or link-local IPv4 address.
 */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "::1") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return false;
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

/** An address's origin, or null if it isn't an address. */
function originOf(text: unknown): URL | null {
  if (typeof text !== "string" || text.length > 300) return null;
  try {
    const u = new URL(text);
    return u.username || u.password ? null : u;
  } catch {
    return null;
  }
}

/**
 * A map as a server gave it, with everything doubtful left out: each real
 * address must be an https origin, and each local copy an http origin on a
 * host that is local. So a map can only ever lead to this machine or this
 * network, never out to some third place.
 */
export function cleanLocalMap(input: unknown): LocalMap {
  const out = new Map<string, string>();
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [real, local] of Object.entries(input as Record<string, unknown>)) {
    if (out.size >= LOCAL_MAP_LIMIT) break;
    const from = originOf(real);
    const to = originOf(local);
    if (!from || !to) continue;
    if (from.protocol !== "https:" || isLocalHost(from.hostname)) continue;
    if (to.protocol !== "http:" || !isLocalHost(to.hostname)) continue;
    out.set(from.origin, to.origin);
  }
  return out;
}

/** The same address at its local copy, if the map has one for its origin. Anything else comes back as it was. */
export function mapToLocal(url: string, map: LocalMap): string {
  if (!map.size) return url;
  const u = originOf(url);
  const to = u && map.get(u.origin);
  return to ? `${to}${url.slice(u.origin.length)}` : url;
}

/** The other way: a local copy's address as the real one. */
export function mapFromLocal(url: string, map: LocalMap): string {
  if (!map.size) return url;
  const u = originOf(url);
  if (!u) return url;
  for (const [real, local] of map) if (local === u.origin) return `${real}${url.slice(u.origin.length)}`;
  return url;
}

const NONE: LocalMap = new Map();
let loading: Promise<LocalMap> | undefined;

/** Whether this page is one that may follow a map: on a local host, over plain http. */
export function onLocalHost(): boolean {
  try {
    return typeof location !== "undefined" && location.protocol === "http:" && isLocalHost(location.hostname);
  } catch {
    return false;
  }
}

/**
 * This page's map: empty anywhere but on a local host, and empty there too
 * unless its server publishes one. Asked for once, and never for long: a
 * server that doesn't answer in a moment has none.
 */
export function localMap(): Promise<LocalMap> {
  if (loading) return loading;
  if (!onLocalHost() || typeof fetch !== "function") return (loading = Promise.resolve(NONE));
  loading = (async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    try {
      const res = await fetch(LOCAL_MAP_PATH, { cache: "no-store", credentials: "omit", signal: ctl.signal });
      return res.ok ? cleanLocalMap(await res.json()) : NONE;
    } catch {
      return NONE;
    } finally {
      clearTimeout(timer);
    }
  })();
  return loading;
}

/** Where to really send the browser for `url`: its local copy on a development server, itself everywhere else. */
export async function toLocal(url: string): Promise<string> {
  return mapToLocal(url, await localMap());
}

/** What a local copy's address stands for: the real one. Everywhere else, the address itself. */
export async function fromLocal(url: string): Promise<string> {
  return mapFromLocal(url, await localMap());
}

/** For tests: forget what was loaded, or say what the map is. */
export function setLocalMap(map: LocalMap | undefined): void {
  loading = map ? Promise.resolve(map) : undefined;
}
