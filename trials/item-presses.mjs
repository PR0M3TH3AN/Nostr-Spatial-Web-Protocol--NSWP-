// An item's presses come up on the bar when it is taken in hand, walked in a scripted Chrome (protocol/17-items.md,
// "Pressing it"; item-controls.ts). Asked by the BitPortal session, 2026-11-21: its room calls
// `itemControls.refresh()` every frame, and nothing in the reference worlds calls it after an item is taken up. Do
// Fire and Reload come up in the Grove after taking up the dart blaster?
//
// What is real here: this checkout's own build of the Grove (sites/grove/dist, so run `npm run build` first), the
// kit's items, play and item controls inside it, the dart blaster's own signed description
// (sites/items/dart-blaster.event.json, its maker's signature checked by the kit) and its own model and logic, run in
// the kit's locked box.
//
// What is a stand-in: how the blaster is taken in hand. A guest has no bag to take it from, so the world's test hook
// (`hold`, which is what Hold in the bag calls) takes it, twice: once to be told the item runs its maker's code, once
// to let it, as a visitor presses Hold again. And every relay: the script answers the request for the blaster's
// description itself, with that signed description, and nothing else.
//
// Nothing leaves this machine. The Grove's address is served from its build; requests for the blaster's files at
// the Grove's real address are served from the same build; every other request is refused and listed, and no
// WebSocket reaches anything. Nothing on disk is changed.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { existsSync, mkdirSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

const WORLD = `https://${HOST}:4399`;
const REAL = "https://grove.bitblocks.network";
const DIST = join(NSWP, "sites", "grove", "dist");
if (!existsSync(join(DIST, "app.js"))) throw new Error("The Grove isn't built in this checkout. Run `npm run build` first.");
const BLASTER = JSON.parse(readFileSync(join(NSWP, "sites", "items", "dart-blaster.event.json"), "utf8"));
const COORD = `${BLASTER.kind}:${BLASTER.pubkey}:${BLASTER.tags.find((t) => t[0] === "d")[1]}`;
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".ogg": "audio/ogg", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".glb": "model/gltf-binary", ".svg": "image/svg+xml" };
const rules = (JSON.parse(readFileSync(join(DIST, "vercel.json"), "utf8")).headers ?? []).map((rule) => ({ fits: new RegExp(`^${rule.source}$`), headers: Object.fromEntries(rule.headers.filter((h) => !/strict-transport|cache-control/i.test(h.key)).map((h) => [h.key, h.value])) }));
const headersFor = (path) => Object.assign({}, ...rules.filter((rule) => rule.fits.test(path)).map((rule) => rule.headers));
const serve = (route, url) => {
  const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
  const on = normalize(join(DIST, path));
  if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
  return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", headers: { ...headersFor(url.pathname), "access-control-allow-origin": "*" }, body: readFileSync(on) });
};

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const refused = new Set();
const errors = [];
const asked = [];
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
await ctx.addInitScript(() => {
  window.__nswpTrial = { gate: true };
});
await ctx.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
  if (url.origin === WORLD || (url.origin === REAL && url.pathname.startsWith("/items/"))) return serve(route, url);
  refused.add(url.origin);
  return route.abort();
});
// Every relay: a request for the blaster's description is answered with it; every request is ended at once.
await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
  ws.onMessage((m) => {
    let msg;
    try { msg = JSON.parse(String(m)); } catch { return; }
    if (msg[0] !== "REQ") return;
    const [, sub, ...filters] = msg;
    const wantsBlaster = filters.some((f) => f.kinds?.includes(BLASTER.kind) && f.authors?.includes(BLASTER.pubkey));
    asked.push(wantsBlaster ? "blaster" : "other");
    if (wantsBlaster) ws.send(JSON.stringify(["EVENT", sub, BLASTER]));
    ws.send(JSON.stringify(["EOSE", sub]));
  });
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const until = async (fn, ms = 60000, every = 200) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(every); } return null; };
await page.goto(`${WORLD}/`, { timeout: 180000 });
await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true), 180000);
const bar = (name) => page.locator("nswp-hud").getByRole("button", { name, exact: true });

// ---- Nothing in hand: neither press is offered.
want("nothing offered with nothing in hand", [await page.evaluate(() => window.__nswpTest.controls.has("item-use")), await page.evaluate(() => window.__nswpTest.controls.has("item-second"))], [false, false]);

// ---- Hold: told it runs its maker's code. Hold again: it is let run.
const first = await page.evaluate((c) => window.__nswpTest.hold(c), COORD);
r.firstHold = first;
const second = first.ok ? first : await page.evaluate((c) => window.__nswpTest.hold(c), COORD);
r.secondHold = second;
want("taken in hand", second.ok, true);
const running = await until(() => page.evaluate(() => window.__nswpTest.play()?.script === "running" || window.__nswpTest.play()?.scriptState === "running" || JSON.stringify(window.__nswpTest.play() ?? {}).includes('"running"')), 20000);
r.play = await page.evaluate(() => window.__nswpTest.play());
want("its logic running", !!running, true);

// ---- With nothing else done: Fire and Reload are on the bar.
await until(() => bar("Fire").isVisible(), 5000);
want("Fire on the bar", await bar("Fire").isVisible(), true);
want("Reload on the bar", await bar("Reload").isVisible(), true);
mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: join(SHOTS, "item-presses-held.png") });

// ---- Put away: they go.
await page.evaluate(() => window.__nswpTest.hold(""));
await until(async () => !(await bar("Fire").isVisible()), 5000);
want("gone when put away", [await bar("Fire").isVisible(), await bar("Reload").isVisible()], [false, false]);

r.relayAsks = asked;
r.refused = [...refused];
r.errors = errors;
if (errors.length) bad.push(`page errors: ${errors.join(" | ")}`);
console.log(JSON.stringify(r, null, 1));
await browser.close();
if (bad.length) {
  console.error(`\nFAILED:\n- ${bad.join("\n- ")}`);
  process.exit(1);
}
console.log("\nPASSED: taking up the dart blaster in the Grove puts Fire and Reload on the bar, and putting it away takes them off.");
