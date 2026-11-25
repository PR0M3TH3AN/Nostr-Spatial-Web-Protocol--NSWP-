import { beforeEach, describe, expect, it } from "vitest";
import { allowedOrigin, forgetForTests, handle, PER_ADDRESS, STOP_GB, TTL_S, USAGE_EVERY_MS, type Env } from "../../../services/ice/src/index.js";

/**
 * bitblocks-ice (services/ice/): TURN credentials for bitblocks.network's rooms, stopped before the free tier ends.
 * Cloudflare is stood in for: its TURN key's answer and its analytics answer, made up here. Nothing is asked of it.
 */
const ENV: Env = { TURN_KEY_ID: "key-id", TURN_KEY_API_TOKEN: "turn-token", CF_ANALYTICS_TOKEN: "analytics-token", CF_ACCOUNT_ID: "account" };
const NOW = new Date("2026-11-25T12:00:00Z");
const PAGE = "https://grove.bitblocks.network";
const TURN_ANSWER = {
  iceServers: [
    { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
    { urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turn:turn.cloudflare.com:53?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"], username: "made-up-user", credential: "made-up-credential" },
  ],
};

/** Cloudflare, stood in: `usedGB` this month (null: the analytics refuse), and what was asked of it. */
const cloudflare = (o: { usedGB?: number | null; turnFails?: boolean } = {}) => {
  const asked: { url: string; body: unknown; auth: string | null }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    asked.push({ url, body, auth: new Headers(init?.headers).get("authorization") });
    if (url === "https://api.cloudflare.com/client/v4/graphql") {
      if (o.usedGB === null) return new Response(JSON.stringify({ data: null, errors: [{ message: "not allowed" }] }), { status: 200 });
      const half = ((o.usedGB ?? 10) * 1e9) / 2;
      return new Response(JSON.stringify({ data: { viewer: { accounts: [{ callsTurnUsageAdaptiveGroups: [{ sum: { egressBytes: half, ingressBytes: half } }] }] } }, errors: null }));
    }
    if (url === "https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers") return o.turnFails ? new Response("no", { status: 500 }) : new Response(JSON.stringify(TURN_ANSWER), { status: 201 });
    return new Response("not stood in", { status: 404 });
  }) as typeof fetch;
  return { fetcher, asked };
};
const ask = (o: { origin?: string | null; address?: string; method?: string; path?: string } = {}) =>
  new Request(`https://bitblocks-ice.example.workers.dev${o.path ?? "/"}`, { method: o.method ?? "GET", headers: { ...(o.origin === null ? {} : { origin: o.origin ?? PAGE }), "cf-connecting-ip": o.address ?? "203.0.113.7" } });
const body = async (r: Response) => (await r.json()) as { iceServers: { urls: string[]; username?: string; credential?: string }[]; ttl: number; error?: string };

beforeEach(() => forgetForTests());

describe("bitblocks-ice", () => {
  it("hands a bitblocks.network page TURN for an hour, with nothing on port 53", async () => {
    const cf = cloudflare({ usedGB: 10 });
    const res = await handle(ask(), ENV, { fetcher: cf.fetcher, now: NOW });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(PAGE);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const got = await body(res);
    expect(got.ttl).toBe(TTL_S);
    expect(TTL_S).toBe(3600);
    expect(got.iceServers).toEqual([
      { urls: ["stun:stun.cloudflare.com:3478"] },
      { urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"], username: "made-up-user", credential: "made-up-credential" },
    ]);
    // Asked for an hour's credentials with the TURN key's own token, and the month's traffic with the analytics one.
    const turn = cf.asked.find((a) => a.url.includes("generate-ice-servers"))!;
    expect([turn.body, turn.auth]).toEqual([{ ttl: 3600 }, "Bearer turn-token"]);
    const usage = cf.asked.find((a) => a.url.includes("graphql"))!;
    expect(usage.auth).toBe("Bearer analytics-token");
    expect((usage.body as { variables: unknown }).variables).toEqual({ account: "account", from: "2026-11-01", to: "2026-11-25" });
  });

  it("hands out STUN only past the month's stop, and asks Cloudflare for no credentials", async () => {
    const cf = cloudflare({ usedGB: STOP_GB + 1 });
    const got = await body(await handle(ask(), ENV, { fetcher: cf.fetcher, now: NOW }));
    expect(got).toEqual({ iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }], ttl: 3600 });
    expect(cf.asked.some((a) => a.url.includes("generate-ice-servers"))).toBe(false);
  });

  it("hands out no TURN where this month's traffic can't be read", async () => {
    for (const env of [ENV, { ...ENV, CF_ANALYTICS_TOKEN: undefined }, { ...ENV, CF_ACCOUNT_ID: undefined }]) {
      forgetForTests();
      const cf = cloudflare({ usedGB: null });
      const got = await body(await handle(ask(), env, { fetcher: cf.fetcher, now: NOW }));
      expect(got.iceServers.some((s) => s.username)).toBe(false);
      expect(cf.asked.some((a) => a.url.includes("generate-ice-servers"))).toBe(false);
    }
  });

  it("reads the month's traffic at most every 10 minutes", async () => {
    const cf = cloudflare({ usedGB: 10 });
    for (const minutes of [0, 1, 9]) await handle(ask({ address: `198.51.100.${minutes}` }), ENV, { fetcher: cf.fetcher, now: new Date(NOW.getTime() + minutes * 60_000) });
    expect(cf.asked.filter((a) => a.url.includes("graphql"))).toHaveLength(1);
    await handle(ask({ address: "198.51.100.99" }), ENV, { fetcher: cf.fetcher, now: new Date(NOW.getTime() + USAGE_EVERY_MS + 1) });
    expect(cf.asked.filter((a) => a.url.includes("graphql"))).toHaveLength(2);
  });

  it("answers STUN alone where Cloudflare gives no credentials", async () => {
    const got = await body(await handle(ask(), ENV, { fetcher: cloudflare({ turnFails: true }).fetcher, now: NOW }));
    expect(got).toEqual({ iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }], ttl: 3600 });
  });

  it("is only for pages of bitblocks.network", async () => {
    for (const origin of ["https://bitblocks.network", "https://portal.bitblocks.network", "https://a.b.bitblocks.network"]) expect(allowedOrigin(origin), origin).toBe(true);
    for (const origin of [null, "http://bitblocks.network", "https://bitblocks.network.example", "https://evilbitblocks.network", "https://bitblocks.network:8443", "null"]) expect(allowedOrigin(origin), String(origin)).toBe(false);
    const cf = cloudflare();
    const refused = await handle(ask({ origin: "https://elsewhere.example" }), ENV, { fetcher: cf.fetcher, now: NOW });
    expect(refused.status).toBe(403);
    expect(refused.headers.get("access-control-allow-origin")).toBeNull();
    expect((await handle(ask({ origin: null }), ENV, { fetcher: cf.fetcher, now: NOW })).status).toBe(403);
    expect(cf.asked).toEqual([]);
  });

  it("lets one address ask so many times a minute, and no more", async () => {
    const cf = cloudflare({ usedGB: 10 });
    const statuses: number[] = [];
    for (let i = 0; i <= PER_ADDRESS; i++) statuses.push((await handle(ask(), ENV, { fetcher: cf.fetcher, now: NOW })).status);
    expect(statuses.slice(0, PER_ADDRESS).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // Another address, and the next minute, are asked afresh.
    expect((await handle(ask({ address: "203.0.113.8" }), ENV, { fetcher: cf.fetcher, now: NOW })).status).toBe(200);
    expect((await handle(ask(), ENV, { fetcher: cf.fetcher, now: new Date(NOW.getTime() + 60_000) })).status).toBe(200);
  });

  it("uses Cloudflare's rate limiting where it is bound", async () => {
    const env: Env = { ...ENV, PER_ADDRESS_LIMIT: { limit: async () => ({ success: false }) } };
    expect((await handle(ask(), env, { fetcher: cloudflare().fetcher, now: NOW })).status).toBe(429);
  });

  it("answers a page's preflight, and nothing but GET /", async () => {
    const pre = await handle(ask({ method: "OPTIONS" }), ENV, { fetcher: cloudflare().fetcher, now: NOW });
    expect([pre.status, pre.headers.get("access-control-allow-origin")]).toEqual([204, PAGE]);
    expect((await handle(ask({ method: "POST" }), ENV, { fetcher: cloudflare().fetcher, now: NOW })).status).toBe(404);
    expect((await handle(ask({ path: "/other" }), ENV, { fetcher: cloudflare().fetcher, now: NOW })).status).toBe(404);
  });
});
