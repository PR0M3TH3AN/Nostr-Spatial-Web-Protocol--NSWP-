/**
 * bitblocks-ice: hands a room's visitors short-lived TURN credentials from Cloudflare Realtime TURN, so two people
 * whose computers can't reach each other directly still connect (docs/backlog/rooms-that-fill-and-always-connect.md,
 * "TURN, the setup plan"). The owner, 2026-11-25: two of his computers found each other in the Grove's room and never
 * connected; and the free tier is never to be left.
 *
 *   GET /  ->  { iceServers, ttl }
 *
 * - Only to pages of bitblocks.network (its `Origin`); anyone else is refused.
 * - Credentials last an hour (`TTL_S`); the kit asks again before they run out.
 * - URLs on port 53 are left out: browsers block it, and a page would wait on it.
 * - Each address may ask `PER_ADDRESS` times a minute.
 * - This month's TURN traffic is read from Cloudflare's analytics, at most every 10 minutes. Past `STOP_GB` it hands
 *   out STUN only until the month turns; where the analytics can't be read, it hands out no TURN at all.
 *
 * Its secrets, set by the owner with `wrangler secret put` and never written anywhere else: TURN_KEY_ID,
 * TURN_KEY_API_TOKEN (the TURN key and its token), CF_ANALYTICS_TOKEN (read-only analytics) and CF_ACCOUNT_ID.
 */

export interface Env {
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
  CF_ANALYTICS_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  /** Cloudflare's rate limiting binding (`[[ratelimits]]` in wrangler.toml), where there is one. */
  PER_ADDRESS_LIMIT?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

/** What a page is answered: the servers to use, and how many seconds they are good for. */
export interface IceAnswer {
  iceServers: { urls: string[]; username?: string; credential?: string }[];
  ttl: number;
}

/** How long credentials last, in seconds. */
export const TTL_S = 3600;
/** This month's TURN traffic past which only STUN is handed out, in gigabytes (the free tier is 1,000). */
export const STOP_GB = 800;
/** How often this month's traffic is read from the analytics, at most, in milliseconds. */
export const USAGE_EVERY_MS = 10 * 60_000;
/** How many times a minute one address may ask. */
export const PER_ADDRESS = 10;

/** STUN, which costs nothing and is always handed out. */
const STUN: IceAnswer["iceServers"] = [{ urls: ["stun:stun.cloudflare.com:3478"] }];
const TURN_API = "https://rtc.live.cloudflare.com/v1/turn/keys";
const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";

/** A page of bitblocks.network, on https: the site itself or any of its own. */
export const allowedOrigin = (origin: string | null): boolean => !!origin && /^https:\/\/([a-z0-9-]+\.)*bitblocks\.network$/.test(origin);

/** The URLs a browser can use: none on port 53. */
const withoutPort53 = (urls: string[]): string[] => urls.filter((u) => !/:53(\?|$)/.test(u));

/** This month's TURN traffic, in bytes (in and out, the safe side of what is billed), or null where it couldn't be read. */
export async function usedThisMonth(env: Env, now: Date, fetcher: typeof fetch = fetch): Promise<number | null> {
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) return null;
  const from = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const to = now.toISOString().slice(0, 10);
  const query = `query ($account: string!, $from: Date!, $to: Date!) { viewer { accounts(filter: { accountTag: $account }) { callsTurnUsageAdaptiveGroups(limit: 10000, filter: { date_geq: $from, date_leq: $to }) { sum { egressBytes ingressBytes } } } } }`;
  try {
    const res = await fetcher(GRAPHQL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { account: env.CF_ACCOUNT_ID, from, to } }),
    });
    if (!res.ok) return null;
    const got = (await res.json()) as { data?: { viewer?: { accounts?: { callsTurnUsageAdaptiveGroups?: { sum?: { egressBytes?: unknown; ingressBytes?: unknown } }[] }[] } }; errors?: unknown[] | null };
    if (got.errors && got.errors.length) return null;
    const groups = got.data?.viewer?.accounts?.[0]?.callsTurnUsageAdaptiveGroups;
    if (!Array.isArray(groups)) return null;
    let bytes = 0;
    for (const g of groups) {
      const out = Number(g.sum?.egressBytes ?? 0);
      const inn = Number(g.sum?.ingressBytes ?? 0);
      if (!Number.isFinite(out) || !Number.isFinite(inn) || out < 0 || inn < 0) return null;
      bytes += out + inn;
    }
    return bytes;
  } catch {
    return null;
  }
}

/** The month's traffic as last read in this isolate, and when: read again only after `USAGE_EVERY_MS`. */
let lastUsage: { month: string; at: number; bytes: number | null } | null = null;
/** Each address's asks in this isolate's current minute: the fallback where there is no rate limiting binding. */
const asks = new Map<string, { minute: number; n: number }>();

/** For tests: forget what this isolate has read and counted. */
export function forgetForTests(): void {
  lastUsage = null;
  asks.clear();
}

async function usage(env: Env, now: Date, fetcher: typeof fetch): Promise<number | null> {
  const month = now.toISOString().slice(0, 7);
  if (lastUsage && lastUsage.month === month && now.getTime() - lastUsage.at < USAGE_EVERY_MS) return lastUsage.bytes;
  const bytes = await usedThisMonth(env, now, fetcher);
  lastUsage = { month, at: now.getTime(), bytes };
  return bytes;
}

async function allowedNow(env: Env, address: string, now: Date): Promise<boolean> {
  if (env.PER_ADDRESS_LIMIT) {
    try {
      return (await env.PER_ADDRESS_LIMIT.limit({ key: address })).success;
    } catch {
      /* the binding failed: counted here instead */
    }
  }
  const minute = Math.floor(now.getTime() / 60_000);
  const was = asks.get(address);
  const n = was && was.minute === minute ? was.n + 1 : 1;
  if (asks.size > 10_000) asks.clear();
  asks.set(address, { minute, n });
  return n <= PER_ADDRESS;
}

/** TURN credentials from Cloudflare, without port 53; null where none could be had. */
async function turn(env: Env, fetcher: typeof fetch): Promise<IceAnswer["iceServers"] | null> {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return null;
  try {
    const res = await fetcher(`${TURN_API}/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ ttl: TTL_S }),
    });
    if (!res.ok) return null;
    const got = (await res.json()) as { iceServers?: unknown };
    if (!Array.isArray(got.iceServers)) return null;
    const servers: IceAnswer["iceServers"] = [];
    for (const s of got.iceServers as { urls?: unknown; username?: unknown; credential?: unknown }[]) {
      const urls = withoutPort53((Array.isArray(s.urls) ? s.urls : typeof s.urls === "string" ? [s.urls] : []).filter((u): u is string => typeof u === "string" && /^(turns?|stun):/.test(u)));
      if (!urls.length) continue;
      const isTurn = urls.some((u) => u.startsWith("turn"));
      if (isTurn && (typeof s.username !== "string" || typeof s.credential !== "string")) continue;
      servers.push(isTurn ? { urls, username: s.username as string, credential: s.credential as string } : { urls });
    }
    return servers.some((s) => s.username) ? servers : null;
  } catch {
    return null;
  }
}

const answer = (body: unknown, status: number, origin: string | null): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...(origin && allowedOrigin(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
    },
  });

/** The Worker. `fetcher` and `now` are for tests. */
export async function handle(request: Request, env: Env, o: { fetcher?: typeof fetch; now?: Date } = {}): Promise<Response> {
  const fetcher = o.fetcher ?? fetch;
  const now = o.now ?? new Date();
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  if (request.method === "OPTIONS" && allowedOrigin(origin))
    return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin!, "access-control-allow-methods": "GET", "access-control-max-age": "86400", vary: "Origin" } });
  if (request.method !== "GET" || url.pathname !== "/") return answer({ error: "not here" }, 404, origin);
  if (!allowedOrigin(origin)) return answer({ error: "only for bitblocks.network" }, 403, origin);
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await allowedNow(env, address, now))) return answer({ error: "too many, wait a minute" }, 429, origin);
  const stunOnly: IceAnswer = { iceServers: STUN, ttl: TTL_S };
  // Past the stop, or not known: no TURN, so the month can never go past the free tier because of this.
  const bytes = await usage(env, now, fetcher);
  if (bytes === null || bytes >= STOP_GB * 1e9) return answer(stunOnly, 200, origin);
  const servers = await turn(env, fetcher);
  return answer(servers ? { iceServers: servers, ttl: TTL_S } : stunOnly, 200, origin);
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
