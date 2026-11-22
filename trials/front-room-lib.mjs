// What the front-room trials share (front-room.mjs for a world made with the kit's own Three.js parts,
// front-room-godot.mjs for one made in Godot): a seller and one listing at BitUnlock's sandbox, a stand-in for the
// visitor's sign-in address, and a scripted browser that is handed this checkout's own build of a world with its
// gate switched on in that browser only.
//
// Nothing leaves this machine: every request to anywhere but the sandbox is answered here or refused, and listed.
// Throwaway keys, pretend sats, no account, nothing published, nothing on disk changed.
import { ROOT as NSWP, HOST } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/pure.js`);
const nip44 = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/nip44.js`);
const { readListing, RECEIPT_ISSUERS } = await import(`${NSWP}/packages/core/dist/index.js`);
const { createHash, randomUUID } = await import("node:crypto");
const { existsSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

export const AT = process.env.SANDBOX ?? `https://${HOST}:4312`;
/** The address the worlds name for signing in. In the scripted browser it is answered by a page of this script's. */
export const SIGN_IN = "https://bitlogin.network";
export const LIVE = RECEIPT_ISSUERS[0];
export const TERM = 3600;
const key = (n) => `${n}_${randomUUID().replaceAll("-", "")}`.slice(0, 60);
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const b64url = (s) => Buffer.from(s, "utf8").toString("base64url");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".ogg": "audio/ogg", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".pck": "application/octet-stream" };

/**
 * Begin a trial of the world built in `dist`, served to the scripted browser at `world` (an address on this machine
 * where nothing listens). Signs a seller up at the sandbox and registers one pass for an hour at the least price,
 * for that world. `r` and `want` keep what was found; `bad` is what wasn't as wanted.
 */
export async function begin({ dist, world }) {
  if (!existsSync(join(dist, ".well-known", "nswp.json"))) throw new Error(`Nothing is built at ${dist}. Run \`npm run build\` (and \`npm run build:godot\` for the Godot world) first.`);
  const r = {};
  const bad = [];
  const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };

  // ---- The sandbox, as `sandbox-buy.mjs` uses it: every call signed as someone (NIP-98).
  async function signed(secret, method, path, body, headers = {}) {
    const url = new URL(`${AT}${path}`).toString();
    const raw = body === undefined ? undefined : JSON.stringify(body);
    const tags = [["u", url], ["method", method], ["bitunlock:nonce", randomUUID()]];
    if (raw !== undefined || method !== "GET") tags.push(["payload", createHash("sha256").update(raw ?? "").digest("hex")]);
    const auth = finalizeEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), content: "", tags }, secret);
    const res = await fetch(url, { method, headers: { authorization: `Nostr ${b64(JSON.stringify(auth))}`, origin: world, ...(raw === undefined ? {} : { "content-type": "application/json" }), ...headers }, body: raw });
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, json };
  }
  const plain = async (method, path, headers = {}, body) => { const res = await fetch(`${AT}${path}`, { method, headers: { origin: world, ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); let json = null; try { json = await res.json(); } catch { /* none */ } return { status: res.status, json }; };

  const health = (await plain("GET", "/health").catch(() => ({ json: null }))).json;
  if (health?.sandbox !== true || !/^[0-9a-f]{64}$/.test(health?.servicePubkey ?? "")) throw new Error(`No sandbox answered at ${AT}. Start BitUnlock's sandbox there, and run this with NODE_EXTRA_CA_CERTS set (see trials/README.md).`);
  const SERVICE = health.servicePubkey;
  const POLICY = `30078:${SERVICE}:bitunlock:service-policy:v1`;
  const ISSUERS = [{ name: "BitUnlock sandbox (this machine)", service: AT, pubkey: SERVICE }];
  want("0 it is the sandbox, and not the live service's key", [health.sandbox, SERVICE !== LIVE.pubkey], [true, true]);

  // ---- Who is who. All thrown away when this ends.
  const seller = generateSecretKey();
  const SELLER = getPublicKey(seller);
  const people = { A: generateSecretKey(), B: generateSecretKey() };
  const secretOf = new Map(Object.values(people).map((s) => [getPublicKey(s), s]));
  const A = getPublicKey(people.A);
  const B = getPublicKey(people.B);

  // ---- The world as its own site says it, with one thing changed in this browser only: it names a listing.
  const file = JSON.parse(readFileSync(join(dist, ".well-known", "nswp.json"), "utf8"));
  const D = Object.keys(file.worlds)[0];
  const NAME = `nswp-trial:front room ${randomUUID().slice(0, 8)}`;
  const LISTING = `30078:${SELLER}:${NAME}`;
  const paidManifest = JSON.stringify({ ...file, publishers: { ...file.publishers, [SELLER]: { worlds: [D] } }, worlds: { ...file.worlds, [D]: { ...file.worlds[D], access: [LISTING] } } });
  want("1 as built, this world names nothing it is entered by", file.worlds[D].access ?? null, null);

  // ---- The seller signs up and registers a pass for an hour, at the least price.
  const tenant = await signed(seller, "POST", "/v1/tenants", { acceptedPolicyCoordinate: POLICY, feeCap: { maximumFeeBps: 100, maximumMinimumSats: 10, maximumFeeSats: 5000 }, idempotencyKey: key("tenant") });
  want("2 the seller is ready", [tenant.status < 300, tenant.json?.status ?? tenant.json?.state ?? tenant.json], [true, "ready"]);
  const listing = finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), content: JSON.stringify({ title: "TEST: an hour past the gate", summary: "A test listing on one machine. Not for sale." }), tags: [["d", NAME], ["price", "500", "SAT"], ["status", "active"], ["br:delivery", "seller-unlock-service-v1"], ["br:delivery-mode", "static"], ["br:unlock-service", AT], ["br:unlock-service-pubkey", SERVICE], ["br:unlock-policy", POLICY], ["br:claim-epoch", "1"], ["nswp:for", `37300:${SELLER}:${D}`], ["nswp:term", String(TERM)]] }, seller);
  const product = await signed(seller, "POST", "/v1/products", { productCoordinate: LISTING, policyCoordinate: POLICY, claimEpoch: 1, payloadType: "claim-url", sellerCiphertext: nip44.encrypt("https://world.example/pass", nip44.getConversationKey(seller, SERVICE)), accessTermSeconds: TERM, idempotencyKey: key("product") }, { "x-bitunlock-sandbox-listing": b64url(JSON.stringify(listing)) });
  want("3 the listing is registered", product.status < 300, true);
  if (product.status >= 300) r.productSays = product.json;
  want("3b the kit reads it, told of the sandbox: its name, its price, how long it lasts", ((x) => (x.ok ? [x.listing.name, x.listing.sats, x.listing.term] : x.why))(readListing(listing, LISTING, { issuers: ISSUERS })), ["TEST: an hour past the gate", 500, TERM]);

  // ---- A buyer with pretend sats, and what the stand-in sign-in address keeps for each visitor.
  const session = (await plain("POST", "/sandbox/v1/sessions", {}, { ttlSeconds: 3600 })).json;
  const scoped = { "x-bitunlock-sandbox-session": session.sessionId };
  const settle = (hash) => plain("POST", `/sandbox/v1/payments/${hash}/settle`, { authorization: `Bearer ${session.token}`, ...scoped });
  const held = new Map();
  const asked = [];
  /** What BitLogin's page does at a purchase, done here with a throwaway key: quote, pay every part, unlock, keep the receipt. */
  async function buy(who, coordinate) {
    asked.push({ who, coordinate });
    const secret = secretOf.get(who);
    if (!secret || coordinate !== LISTING) return null;
    const quote = await signed(secret, "POST", "/v1/quotes", { productCoordinate: coordinate, buyerPubkey: who, idempotencyKey: key("quote") }, scoped);
    const plan = quote.json?.paymentPlan ?? quote.json;
    for (const leg of [...(plan?.legs ?? [])].sort((x, y) => x.amountSats - y.amountSats)) await settle(leg.paymentHash);
    const unlocked = await signed(secret, "POST", `/v1/orders/${plan?.orderId}/unlock`, { idempotencyKey: key("unlock") }, scoped);
    const receipt = unlocked.json?.fulfillmentEvent;
    r.lastPurchase = { quote: quote.status, parts: (plan?.legs ?? []).map((l) => `${l.role}:${l.amountSats}`).sort(), unlock: unlocked.status };
    if (unlocked.status !== 200 || !receipt || !verifyEvent(receipt)) return null;
    held.set(`${who}|${coordinate}`, receipt);
    return receipt;
  }

  // ---- The scripted browser. Each visit is a fresh one: who is signed in, and whether the kit is told of the sandbox.
  const rules = (JSON.parse(readFileSync(join(dist, "vercel.json"), "utf8")).headers ?? []).map((rule) => ({ fits: new RegExp(`^${rule.source}$`), headers: Object.fromEntries(rule.headers.filter((h) => !/strict-transport|cache-control/i.test(h.key)).map((h) => [h.key, h.value])) }));
  const headersFor = (path) => Object.assign({}, ...rules.filter((rule) => rule.fits.test(path)).map((rule) => rule.headers));
  /** The stand-in for the sign-in address's hidden signer: it says who is signed in, and passes `have` and `buy` to this script. */
  const signerPage = `<!doctype html><meta charset="utf-8"><title>stand-in signer</title><script>
const WORLD = ${JSON.stringify(world)};
let who = null;
const say = (m) => parent.postMessage({ nswp: "nswp-signer", v: 1, ...m }, WORLD);
const state = (id) => say({ t: "state", ...(id ? { id } : {}), unlocked: !!who, ...(who ? { pubkey: who, name: "Trial visitor", remembered: true } : {}) });
window.__signIn = (pubkey) => { who = pubkey; state(); };
addEventListener("message", async (e) => {
  const d = e.data;
  if (e.origin !== WORLD || !d || d.nswp !== "nswp-signer") return;
  if (d.t === "state") return state(d.id);
  if (d.t === "lock") { who = null; return state(); }
  if (d.t === "have") { const got = who ? await window.__trialHave(who, d.listing) : null; return say(got ? { t: "receipt", id: d.id, receipt: JSON.parse(got) } : { t: "none", id: d.id }); }
  if (d.t === "buy") { say({ t: "asking", id: d.id }); const got = who ? await window.__trialBuy(who, d.listing) : null; return say(got ? { t: "bought", id: d.id, receipt: JSON.parse(got) } : { t: "refused", id: d.id }); }
});
window.__trialWho().then((w) => { who = w; say({ t: "ready" }); });
</script>`;

  const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const refused = new Set();
  const errors = [];
  /**
   * Audio worklets that failed to load, and every path of the world the interception answered. Found on
   * 2026-11-21 (the Foundry served for real loads its worklets with no error, with or without an interception
   * that passes requests on): a worklet's own fetch goes past the scripted browser's interception, straight to
   * the network, and nothing listens at the trial's address. So a worklet failure is the page's fault unless the
   * interception never saw that request; then the check can't be run here, and is reported as not run.
   */
  const worklets = new Set();
  const answered = new Set();
  const statusAsked = [];
  /**
   * A visit. `who`: who the sign-in address says is signed in as the page loads. `believe`: whether this browser's
   * copy of the kit is told to believe the sandbox's key (the kit as shipped believes BitUnlock's own and no other).
   * `hands`: what a dishonest signer would hand over when asked what is held. `clock`: this page's time can be moved.
   * Returns the page and a few things every world's trial needs; how a world is read and walked is its own trial's.
   */
  async function visit({ who = null, believe = true, hands = null, clock = false, viewport = { width: 1280, height: 800 } } = {}) {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport });
    await ctx.grantPermissions(["local-network-access"]).catch(() => undefined);
    const signedIn = { who };
    await ctx.exposeFunction("__trialWho", () => signedIn.who);
    await ctx.exposeFunction("__trialHave", (asker, coordinate) => { const got = hands ?? held.get(`${asker}|${coordinate}`); return got ? JSON.stringify(got) : null; });
    await ctx.exposeFunction("__trialBuy", async (asker, coordinate) => { const got = await buy(asker, coordinate).catch(() => null); return got ? JSON.stringify(got) : null; });
    // The one switch: on a local address, a script may have a world that can have a gate use it. What the gate is
    // entered by still comes from the world's own manifest, as this browser is handed it below.
    await ctx.addInitScript(() => { window.__nswpTrial = { gate: true }; });
    await ctx.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (url.origin === new URL(AT).origin) {
        if (/\/entitlements\/.+\/status$/.test(url.pathname)) {
          const res = await route.fetch().catch(() => null);
          statusAsked.push({ status: res?.status() ?? 0, body: res ? await res.text().catch(() => "") : "" });
          return res ? route.fulfill({ response: res }) : route.abort();
        }
        return route.continue();
      }
      if (url.origin === SIGN_IN) {
        if (url.pathname === "/signer/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: signerPage });
        if (url.pathname === "/connect/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>stand-in sign-in window</title><p>A stand-in for the sign-in address's own page. Nothing is asked here." });
      }
      if (url.origin === world) {
        answered.add(url.pathname);
        const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
        const headers = { ...headersFor(url.pathname), "access-control-allow-origin": "*" };
        if (url.pathname === "/.well-known/nswp.json") return route.fulfill({ status: 200, contentType: TYPES[".json"], headers, body: paidManifest });
        const on = normalize(join(dist, path));
        if (!on.startsWith(dist) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
        let body = readFileSync(on);
        // Told of the sandbox, in this browser only: the shipped kit names BitUnlock's own key and address.
        if (believe && extname(on) === ".js" && body.includes(LIVE.pubkey)) body = Buffer.from(body.toString("utf8").replaceAll(LIVE.pubkey, SERVICE).replaceAll(LIVE.service, AT));
        return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", headers, body });
      }
      refused.add(url.origin);
      return route.abort();
    });
    // Every relay is this script: it holds the one listing, and answers as a relay would.
    await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
      ws.onMessage((m) => {
        let msg;
        try { msg = JSON.parse(String(m)); } catch { return; }
        if (msg?.[0] !== "REQ") return;
        const fits = msg.slice(2).some((f) => f && (f.kinds ?? [30078]).includes(30078) && (f.authors ?? [SELLER]).includes(SELLER) && (f["#d"] ?? [NAME]).includes(NAME));
        if (fits) ws.send(JSON.stringify(["EVENT", msg[1], listing]));
        ws.send(JSON.stringify(["EOSE", msg[1]]));
      });
    });
    const page = await ctx.newPage();
    if (clock) await page.clock.install();
    const popups = [];
    page.on("popup", (p) => void p.waitForLoadState().catch(() => undefined).then(() => popups.push(p.url())));
    page.on("pageerror", (e) => {
      const said = String(e);
      const worklet = /Failed to load worklet module script: (\S+)/.exec(said);
      if (worklet) worklets.add(new URL(worklet[1]).pathname);
      else errors.push(said.slice(0, 200));
    });
    const until = async (fn, ms = 60000, every = 250) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await new Promise((done) => setTimeout(done, every)); } return null; };
    /** The stand-in's windows are put away: a page behind another window draws nothing, and so walks nowhere. */
    const toFront = async () => {
      for (const other of ctx.pages()) if (other !== page) await other.close().catch(() => undefined);
      await page.bringToFront();
    };
    /** The stand-in sign-in address says this person has signed in. */
    const signIn = async (pubkey) => {
      signedIn.who = pubkey;
      await page.frames().find((f) => f.url().startsWith(SIGN_IN)).evaluate((k) => window.__signIn(k), pubkey);
    };
    /** Press the gate's control as a visitor does: the kit's menu opened on Travel, and the row clicked. A real press, so a window may open. */
    const pressRow = async (open, close) => {
      await open();
      await page.waitForTimeout(400);
      await page.locator("nswp-hud").getByRole("button", { name: /buy|hold/i }).first().click();
      await close();
    };
    return { ctx, page, popups, until, toFront, signIn, pressRow, close: () => ctx.close() };
  }

  /**
   * The check that the page's audio worklets load. Passes when none failed; fails when one failed that the
   * interception answered (the page's own fault); and where every failure is one the interception never saw, it
   * is reported as not run here, with why, and neither passes nor fails.
   */
  const workletCheck = (name) => {
    const failed = [...worklets];
    if (!failed.length) return want(name, "loaded", "loaded");
    const ours = failed.filter((p) => answered.has(p));
    if (ours.length) return want(name, { failed: ours }, "loaded");
    r[name] = { notRunHere: failed, why: "a worklet's own fetch goes past the scripted browser's interception, and nothing listens at the trial's address; served for real (the local sites service, port 4309), the Foundry loads them with no error" };
  };

  return { r, bad, want, A, B, LISTING, ISSUERS, held, asked, statusAsked, refused, errors, worklets, workletCheck, visit, browser, world };
}

/** Say what was found, and leave with 1 if anything wasn't as wanted. */
export function finish({ r, bad }) {
  console.log(JSON.stringify(r, null, 1));
  if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
  console.log("\nall as wanted");
}
