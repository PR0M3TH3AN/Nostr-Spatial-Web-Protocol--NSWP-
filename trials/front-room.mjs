// The front room of a paid world, walked on this machine: a copy of the Gallery with its gate switched on in the
// scripted browser only, a visitor who holds nothing, a purchase from BitUnlock's sandbox with pretend sats, the gate
// opening on the receipt, and the pass running out with the visitor inside.
//
// What is real here: this checkout's own build of the Gallery (sites/gallery/dist, so run `npm run build` first),
// the kit's gate inside it, and BitUnlock's sandbox, which signs a real receipt for a pretend payment.
//
// What is a stand-in: the visitor's sign-in address. The world names bitlogin.network, and in this browser that
// address is answered by a page of this script's, which says who is signed in and, asked to buy, has this script
// buy from the sandbox with a throwaway key. BitLogin's own screen is NOT tried here: `buy-screen-run.mjs` tries
// that. Relays are stood in for too: the one listing is handed to the page by this script.
//
// Nothing leaves this machine: every request to anywhere but the sandbox is answered here or refused, and listed.
// Throwaway keys, pretend sats, no account, nothing published. Nothing on disk is changed: the Gallery is not
// made paid, here or anywhere. Needs: the sandbox at https://<this machine>:4312, and NODE_EXTRA_CA_CERTS set
// (`npm run trial -- trials/front-room.mjs`).
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/pure.js`);
const nip44 = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/nip44.js`);
const { readReceipt, readListing, RECEIPT_ISSUERS } = await import(`${NSWP}/packages/core/dist/index.js`);
const { createHash, randomUUID } = await import("node:crypto");
const { existsSync, mkdirSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

const AT = process.env.SANDBOX ?? `https://${HOST}:4312`;
// Nothing listens here: the scripted browser is handed this checkout's own build at this address.
const WORLD = `https://${HOST}:4399`;
const SIGN_IN = "https://bitlogin.network";
const DIST = join(NSWP, "sites", "gallery", "dist");
if (!existsSync(join(DIST, "app.js"))) throw new Error("The Gallery isn't built in this checkout. Run `npm run build` first.");
const LIVE = RECEIPT_ISSUERS[0];
const TERM = 3600;
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
const key = (n) => `${n}_${randomUUID().replaceAll("-", "")}`.slice(0, 60);
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const b64url = (s) => Buffer.from(s, "utf8").toString("base64url");

// ---- The sandbox, as `sandbox-buy.mjs` uses it: every call signed as someone (NIP-98).
async function signed(secret, method, path, body, headers = {}) {
  const url = new URL(`${AT}${path}`).toString();
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const tags = [["u", url], ["method", method], ["bitunlock:nonce", randomUUID()]];
  if (raw !== undefined || method !== "GET") tags.push(["payload", createHash("sha256").update(raw ?? "").digest("hex")]);
  const auth = finalizeEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), content: "", tags }, secret);
  const res = await fetch(url, { method, headers: { authorization: `Nostr ${b64(JSON.stringify(auth))}`, origin: WORLD, ...(raw === undefined ? {} : { "content-type": "application/json" }), ...headers }, body: raw });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}
const plain = async (method, path, headers = {}, body) => { const res = await fetch(`${AT}${path}`, { method, headers: { origin: WORLD, ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); let json = null; try { json = await res.json(); } catch { /* none */ } return { status: res.status, json }; };

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
const file = JSON.parse(readFileSync(join(DIST, ".well-known", "nswp.json"), "utf8"));
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
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".ogg": "audio/ogg", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
const rules = (JSON.parse(readFileSync(join(DIST, "vercel.json"), "utf8")).headers ?? []).map((rule) => ({ fits: new RegExp(`^${rule.source}$`), headers: Object.fromEntries(rule.headers.filter((h) => !/strict-transport|cache-control/i.test(h.key)).map((h) => [h.key, h.value])) }));
const headersFor = (path) => Object.assign({}, ...rules.filter((rule) => rule.fits.test(path)).map((rule) => rule.headers));
/** The stand-in for the sign-in address's hidden signer: it says who is signed in, and passes `have` and `buy` to this script. */
const signerPage = `<!doctype html><meta charset="utf-8"><title>stand-in signer</title><script>
const WORLD = ${JSON.stringify(WORLD)};
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
const statusAsked = [];
/**
 * A visit. `who`: who the sign-in address says is signed in as the page loads. `believe`: whether this browser's
 * copy of the kit is told to believe the sandbox's key (the kit as shipped believes BitUnlock's own and no other).
 * `hands`: what a dishonest signer would hand over when asked what is held. `clock`: this page's time can be moved.
 */
async function visit({ who = null, believe = true, hands = null, clock = false } = {}) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
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
    if (url.origin === WORLD) {
      const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
      const headers = { ...headersFor(url.pathname), "access-control-allow-origin": "*" };
      if (url.pathname === "/.well-known/nswp.json") return route.fulfill({ status: 200, contentType: TYPES[".json"], headers, body: paidManifest });
      const on = normalize(join(DIST, path));
      if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
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
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (fn, ms = 60000, every = 250) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await new Promise((done) => setTimeout(done, every)); } return null; };
  /** Open the world; or, `again`, refresh it as a visitor would (a refresh puts them back where they stood). */
  const load = async (again = false) => {
    if (again) {
      // Long enough for the world to have noted where they stand, which it does every second.
      await page.waitForTimeout(1500);
      await page.reload();
    } else await page.goto(`${WORLD}/`);
    await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true && !!window.__nswpTest.gate?.() && window.__nswpTest.gate().state !== "checking"));
    // What the world says from here on is kept.
    await page.evaluate(() => { window.__said = []; window.__nswpTest.controls.onSay((t) => window.__said.push(t)); });
  };
  await load();
  const gate = () => page.evaluate(() => { const g = window.__nswpTest.gate(); return g && { state: g.state, open: g.open, reason: g.reason, why: g.why, offers: g.offers, unread: g.unread, until: g.until, signedIn: g.signedIn }; });
  const rows = () => page.evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "travel")?.items.filter((i) => i.id.startsWith("gate-")).map((i) => i.label) ?? []);
  const said = () => page.evaluate(() => window.__said ?? []);
  /** Press the gate's control as a visitor does: the menu opened, and the row clicked. A real press, so a window may open. */
  const press = async () => {
    await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "travel"));
    await page.waitForTimeout(400);
    await page.locator("nswp-hud").getByRole("button", { name: /buy|hold/i }).first().click();
    await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
  };
  /** Stand just before the gate and walk at it, as a press on the floor past it would. Where they end up, along the hall. */
  const walkAtIt = async () => {
    // The stand-in's windows are put away first: a page behind another window draws nothing, and so walks nowhere.
    for (const other of ctx.pages()) if (other !== page) await other.close().catch(() => undefined);
    await page.bringToFront();
    await page.evaluate(() => { const t = window.__nswpTest; t.teleport(0, 1.5); t.face(0); t.step(0, -3.5); });
    // A walk, at whatever pace this machine draws it: watched until they are past, or have stood still a while.
    let last = 99;
    let still = 0;
    for (let i = 0; i < 60 && still < 4; i++) {
      await page.waitForTimeout(500);
      const z = await page.evaluate(() => window.__nswpTest.where()[1]);
      if (z < -1) return z;
      still = Math.abs(z - last) < 0.01 ? still + 1 : 0;
      last = z;
    }
    return last;
  };
  const signIn = async (pubkey) => {
    signedIn.who = pubkey;
    await page.frames().find((f) => f.url().startsWith(SIGN_IN)).evaluate((k) => window.__signIn(k), pubkey);
  };
  return { ctx, page, popups, until, load, gate, rows, said, press, walkAtIt, signIn, close: () => ctx.close() };
}

try {
  mkdirSync(SHOTS, { recursive: true });
  // ---- 1. A visitor who isn't signed in, and holds nothing.
  const v = await visit();
  const first = await v.gate();
  want("4 shut for someone not signed in, with what is for sale read from the seller's listing", [first.state, first.open, first.reason, first.offers], ["shut", false, "signed-out", [{ listing: LISTING, name: "TEST: an hour past the gate", sats: 500, term: TERM, words: "500 sats, for 1 hour" }]]);
  want("4b it says why in plain words", first.why, "Past here is for people who have bought it: TEST: an hour past the gate, 500 sats, for 1 hour. Sign in to buy, or to show what you already hold.");
  want("4c one control, which offers sign-in first", await v.rows(), ["Sign in to buy TEST: an hour past the gate: 500 sats, for 1 hour"]);
  want("5 nobody walks past it: everything before it is free, and it stops them there", (await v.walkAtIt()) >= 0, true);
  r.stoppedAt = await v.page.evaluate(() => window.__nswpTest.where());
  await v.page.screenshot({ path: `${SHOTS}/front-room-1-shut.png` });
  await v.page.setViewportSize({ width: 390, height: 780 });
  await v.page.evaluate(() => window.__nswpTest.hud.setOpen(true, "travel"));
  await v.page.waitForTimeout(500);
  await v.page.screenshot({ path: `${SHOTS}/front-room-1b-shut-phone-menu.png` });
  await v.page.evaluate(() => window.__nswpTest.hud.setOpen(false));
  await v.page.setViewportSize({ width: 1280, height: 800 });
  await v.press();
  await v.until(() => v.popups.length > 0, 8000);
  want("6 pressed while signed out: the sign-in address's own window, and nothing asked to be bought", [v.popups.map((u) => new URL(u).origin + new URL(u).pathname), asked.length], [[`${SIGN_IN}/connect/`], 0]);
  // ---- 2. They sign in (the stand-in says so), still holding nothing.
  await v.signIn(A);
  await v.until(async () => (await v.gate()).reason === "nothing-held", 15000);
  want("7 signed in and holding nothing: still shut, and the same control now buys", [(await v.gate()).state, await v.rows()], ["shut", ["Buy TEST: an hour past the gate: 500 sats, for 1 hour"]]);
  // ---- 3. They press Buy. The stand-in buys from the sandbox; the kit checks what comes back.
  await v.press();
  await v.until(async () => (await v.gate()).state === "open", 60000);
  const bought = held.get(`${A}|${LISTING}`);
  const check = bought ? readReceipt(bought, { listing: LISTING, buyer: A, issuers: ISSUERS }) : null;
  const open = await v.gate();
  want("8 bought: the sandbox signed a receipt, and the gate opened on it", [asked.length, r.lastPurchase, check?.ok ?? false, open.state, open.until === (check?.ok ? check.receipt.expiresAt : -1)], [1, { quote: 201, parts: ["bitunlock:10", "seller:490"], unlock: 200 }, true, "open", true]);
  want("8b the kit as shipped would not believe that receipt", bought ? readReceipt(bought, { listing: LISTING, buyer: A }) : null, { ok: false, why: "unknown-issuer" });
  want("8c it says so, and the control is gone", [(await v.said()).some((t) => /^Bought: TEST: an hour past the gate\. The way is open until /.test(t)), await v.rows()], [true, []]);
  want("9 and now they walk past it", (await v.walkAtIt()) < -1, true);
  await v.page.screenshot({ path: `${SHOTS}/front-room-2-open.png` });
  // ---- 4. The page refreshed: the sign-in address still holds the receipt, so it opens with nothing pressed.
  await v.load(true);
  const back = await v.gate();
  want("10 the page refreshed, signed in: open at once, nothing to press, and they are where they stood, past the gate", [back.state, await v.rows(), (await v.page.evaluate(() => window.__nswpTest.where()[1])) < -1], ["open", [], true]);
  r.takenBackAsked = statusAsked.slice(0, 3);
  want("11 the sandbox was asked whether the receipt was taken back, and answered", statusAsked.length > 0 && statusAsked.every((s) => s.status === 200), true);
  await v.close();

  // ---- 5. The kit as shipped: the same receipt, in a browser that was not told of the sandbox.
  const shipped = await visit({ who: A, believe: false });
  const strict = await shipped.gate();
  want("12 the kit as shipped opens nothing on a sandbox's receipt, and offers nothing sold through a sandbox", [strict.state, strict.offers, strict.unread[LISTING]], ["shut", [], "unknown-service"]);
  await shipped.close();

  // ---- 6. Somebody else, whose sign-in address hands over the first visitor's receipt.
  const other = await visit({ who: B, hands: bought });
  const theirs = await other.gate();
  want("13 another visitor is not let in on the first one's receipt", [theirs.state, theirs.reason], ["shut", "nothing-held"]);
  want("13b and can't walk past", (await other.walkAtIt()) >= 0, true);
  await other.close();

  // ---- 7. The pass runs out with the visitor inside. This page's clock is moved on; nothing is loaded again.
  const late = await visit({ who: A, clock: true });
  want("14 inside, with an hour's pass", [(await late.gate()).state, (await late.walkAtIt()) < -1], ["open", true]);
  await late.page.evaluate(() => { window.__sameVisit = true; });
  await late.page.clock.fastForward((TERM + 5) * 1000);
  await late.until(async () => (await late.gate()).state === "ending", 20000);
  const ending = await late.gate();
  want("15 at its end: a notice, and a couple of minutes", [ending.state, ending.open, (await late.said()).includes("Your time here has run out. This part closes in two minutes. Buy again to stay.")], ["ending", true, true]);
  want("15b the control to buy again is back", await late.rows(), ["Buy TEST: an hour past the gate: 500 sats, for 1 hour"]);
  await late.page.clock.fastForward(121 * 1000);
  await late.until(async () => (await late.gate()).state === "shut", 20000);
  const closed = await late.gate();
  const where = await late.page.evaluate(() => window.__nswpTest.where());
  want("16 then shut, and they are stood before the gate again, in the same visit", [closed.state, closed.reason, where[1] > 0, await late.page.evaluate(() => window.__sameVisit === true)], ["shut", "run-out", true, true]);
  await late.close();

  r.refused = [...refused];
  r.errors = errors.slice(0, 6);
  want("17 nothing but this machine was reached, and no page threw", [r.refused, r.errors], [[], []]);
} catch (e) {
  // Whatever stopped the walk is said with what it had found, not instead of it.
  bad.push(`the walk stopped: ${String(e).slice(0, 300)}`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(r, null, 1));
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
