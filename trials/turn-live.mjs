// Two visitors who can't reach each other directly meet through TURN, with the owner's live bitblocks-ice
// (services/ice/, deployed 2026-11-25) handing out the credentials. The owner asked for TURN to be set up, and this
// is the check that it works end to end.
//
// Two browsers, each a visitor in the Grove, served from this checkout's build at the Grove's own address (so
// that the Worker sees a bitblocks.network page, as it would live). Both are held to relayed paths only
// (`iceTransportPolicy: "relay"`, kept even when the room hands over new servers), so no direct path, local or
// through STUN, can be used. Both press Join the room. They meet only if TURN carries them.
//
// What is real: this checkout's Grove and kit, two real Chromes, the live Worker at ICE (asked once by each), and
// Cloudflare's TURN servers, which carry the two connections. What is made up: the Nostr relays (one in this script,
// which keeps what it is sent in memory and passes it between the two), and BitLogin (a stand-in signer: nobody is
// signed in, so each is a guest). Nothing goes to a real relay, and nothing is posted anywhere.
//
// What it costs: two requests to the Worker, and a few hundred kilobytes through TURN at most (the rooms' hellos and
// keep-alives over a minute or so), inside Cloudflare's free tier.
//
//   npm run build && npm run trial -- trials/turn-live.mjs
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const ICE = "https://bitblocks-ice.bitunlock.workers.dev";
const WORLD = "https://grove.bitblocks.network";
const SIGN_IN = "https://bitlogin.network";
const DIST = join(NSWP, "sites", "grove", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};

// ---- One relay for both, in memory: it keeps events and passes each to whoever asked for its kind.
const events = [];
const subs = new Set();
const matches = (f, e) =>
  (!f.ids || f.ids.includes(e.id)) &&
  (!f.kinds || f.kinds.includes(e.kind)) &&
  (!f.authors || f.authors.includes(e.pubkey)) &&
  (f.since === undefined || e.created_at >= f.since) &&
  (f.until === undefined || e.created_at <= f.until) &&
  Object.keys(f).filter((k) => k[0] === "#").every((k) => e.tags.some((t) => t[0] === k.slice(1) && f[k].includes(t[1])));
const relay = (ws) => {
  const mine = new Map();
  const me = { ws, mine };
  subs.add(me);
  ws.onMessage((m) => {
    let msg;
    try { msg = JSON.parse(String(m)); } catch { return; }
    if (msg[0] === "REQ") {
      const [, id, ...filters] = msg;
      mine.set(id, filters);
      for (const e of events) if (filters.some((f) => matches(f, e))) ws.send(JSON.stringify(["EVENT", id, e]));
      ws.send(JSON.stringify(["EOSE", id]));
    } else if (msg[0] === "CLOSE") mine.delete(msg[1]);
    else if (msg[0] === "EVENT") {
      const e = msg[1];
      ws.send(JSON.stringify(["OK", e.id, true, ""]));
      if (events.some((x) => x.id === e.id)) return;
      events.push(e);
      for (const s of subs) for (const [id, filters] of s.mine) if (filters.some((f) => matches(f, e))) { try { s.ws.send(JSON.stringify(["EVENT", id, e])); } catch { /* gone */ } }
    }
  });
};

const signerPage = `<!doctype html><meta charset="utf-8"><script>
const say = (m) => parent.postMessage({ nswp: "nswp-signer", v: 1, ...m }, ${JSON.stringify(WORLD)});
addEventListener("message", (e) => { const d = e.data; if (e.origin !== ${JSON.stringify(WORLD)} || !d || d.nswp !== "nswp-signer") return; if (d.t === "state") say({ t: "state", ...(d.id ? { id: d.id } : {}), unlocked: false }); });
say({ t: "ready" });
</script>`;

// Every connection the page makes is held to relayed paths, from the start and whenever its servers are changed.
const relayOnly = `(() => {
  const Real = window.RTCPeerConnection;
  window.__pcs = [];
  class Relayed extends Real {
    constructor(cfg, ...more) { super({ ...(cfg ?? {}), iceTransportPolicy: "relay" }, ...more); window.__pcs.push(this); }
    setConfiguration(cfg) { return super.setConfiguration({ ...(cfg ?? {}), iceTransportPolicy: "relay" }); }
  }
  window.RTCPeerConnection = Relayed;
})();`;

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const asked = [];
const elsewhere = new Set();
try {
  const visitor = async (name) => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 650 } });
    await ctx.addInitScript(relayOnly);
    await ctx.routeWebSocket(/^wss?:\/\//, relay);
    await ctx.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (url.origin === ICE) {
        asked.push(name);
        return route.continue();
      }
      if (url.origin === SIGN_IN && url.pathname === "/signer/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: signerPage });
      if (url.origin !== WORLD) {
        elsewhere.add(url.origin);
        return route.abort();
      }
      const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
      if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
      return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    const ice = [];
    page.on("response", async (r) => {
      if (!r.url().startsWith(ICE)) return;
      let body = null;
      try { body = await r.json(); } catch { /* not JSON */ }
      ice.push({ status: r.status(), turn: (body?.iceServers ?? []).filter((s) => (s.urls ?? []).some((u) => /^turns?:/.test(u)) && s.username && s.credential).length, ttl: body?.ttl ?? null });
    });
    await page.goto(`${WORLD}/`, { timeout: 60000 });
    return { ctx, page, errors, ice };
  };
  const until = async (page, ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(250); } };

  const a = await visitor("a");
  const b = await visitor("b");
  for (const v of [a, b]) await until(v.page, () => v.page.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
  for (const v of [a, b]) await v.page.evaluate(() => window.__nswpTest.controls.run("room-join"));
  const self = async (v) => (await until(v.page, () => v.page.evaluate(() => window.__nswpTest.state.room?.self ?? null), 20000));
  const [ka, kb] = [await self(a), await self(b)];
  check("both joined the room", !!ka && !!kb, { ka, kb });

  // The Worker answered each, with TURN.
  await until(a.page, () => a.ice.length && b.ice.length, 10000);
  check("each asked the live Worker once as it joined", asked.filter((n) => n === "a").length === 1 && asked.filter((n) => n === "b").length === 1, asked);
  check("and it answered each with TURN credentials", [a, b].every((v) => v.ice[0]?.status === 200 && v.ice[0].turn > 0 && v.ice[0].ttl === 3600), [a.ice, b.ice]);

  // They meet: each has the other as a member, over a connection that is open.
  const met = await until(a.page, async () => {
    const sa = await a.page.evaluate(() => window.__nswpTest.state.room?.members ?? []);
    const sb = await b.page.evaluate(() => window.__nswpTest.state.room?.members ?? []);
    return sa.includes(kb) && sb.includes(ka);
  }, 60000);
  check("they meet in the room", !!met, { a: await a.page.evaluate(() => window.__nswpTest.state.room), b: await b.page.evaluate(() => window.__nswpTest.state.room) });

  // How: the pair each connection chose, both ends relayed, and what went through it.
  const path = (v) => v.page.evaluate(async () => {
    const out = [];
    for (const pc of window.__pcs) {
      const stats = await pc.getStats();
      let pair = null;
      stats.forEach((s) => { if (s.type === "transport" && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId); });
      if (!pair) stats.forEach((s) => { if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded") pair = s; });
      const local = pair ? stats.get(pair.localCandidateId) : null;
      const remote = pair ? stats.get(pair.remoteCandidateId) : null;
      const gathered = [];
      stats.forEach((s) => { if (s.type === "local-candidate") gathered.push(s.candidateType); });
      out.push({ state: pc.connectionState, policy: pc.getConfiguration().iceTransportPolicy, local: local?.candidateType ?? null, localProtocol: local?.relayProtocol ?? local?.protocol ?? null, remote: remote?.candidateType ?? null, sent: pair?.bytesSent ?? 0, received: pair?.bytesReceived ?? 0, gathered: [...new Set(gathered)] });
    }
    return out;
  });
  const connected = await until(a.page, async () => {
    const [pa, pb] = [await path(a), await path(b)];
    return pa.some((p) => p.state === "connected") && pb.some((p) => p.state === "connected") ? [pa, pb] : null;
  }, 30000);
  const [pa, pb] = connected ?? [await path(a), await path(b)];
  const open = (ps) => ps.find((p) => p.state === "connected");
  check("each has a connection open to the other", !!open(pa) && !!open(pb), { a: pa, b: pb });
  check("held to relayed paths: nothing gathered but relay candidates", [...pa, ...pb].every((p) => p.policy === "relay" && p.gathered.every((t) => t === "relay")), { a: pa, b: pb });
  check("the open path is relayed at both ends, through TURN", [open(pa), open(pb)].every((p) => p && p.local === "relay" && p.remote === "relay"), { a: open(pa), b: open(pb) });
  // A few seconds more, so that keep-alives have gone each way through TURN.
  await a.page.waitForTimeout(8000);
  const [qa, qb] = [open(await path(a)), open(await path(b))];
  check("and things go both ways through it", !!qa && !!qb && qa.sent > 0 && qa.received > 0 && qb.sent > 0 && qb.received > 0, { a: qa, b: qb });
  results.through = { a: qa && { protocol: qa.localProtocol, sent: qa.sent, received: qa.received }, b: qb && { protocol: qb.localProtocol, sent: qb.sent, received: qb.received } };
  check("no page went wrong", a.errors.length + b.errors.length === 0, [...a.errors, ...b.errors]);
  results.abortedElsewhere = [...elsewhere];
  results.relayEvents = events.length;
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const total = Object.keys(results).filter((k) => results[k] === "ok" || results[k]?.failed !== undefined).length;
console.log(fail.length ? `\n${fail.length} of ${total} checks failed: ${fail.join("; ")}` : `\nall ${total} checks passed`);
process.exit(fail.length ? 1 : 0);
