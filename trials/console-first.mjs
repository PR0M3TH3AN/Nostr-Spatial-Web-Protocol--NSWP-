// The visitor's console from the first moment, in a world made with another engine (NSWP-09; the orchestrator,
// 2026-11-22: "Mount it with Home, the address and the loading line as the script loads; menu() fills it in later and
// must not make a second one"). Walked in a scripted Chrome.
//
// Two pages, each with this checkout's own engine script (engines/godot/dist, `npm run build:godot`):
// - A bare page that loads only the script, standing in for any engine's page, so each path can be driven exactly:
//   the console while the room is up, a world that asks for its menu (filled in, never made twice), and a world that
//   opens its doors with no menu of the kit's (the early console goes, its own being the world's).
// - The Godot example itself: the console over the room while the engine is still arriving.
//
// What is a stand-in: somewhere to go home to (a return Airlock put in the tab's storage before the page loads, at an
// address that is never visited), and on the bare page, the world (the script calls what an engine would).
// Nothing leaves this machine: the pages are served from the build, every other request is refused and listed, and no
// WebSocket reaches anything. Godot's two audio worklets come from the local sites service at the Foundry's own port,
// where the page is served (a scripted browser lets them past its interception). Nothing on disk is changed.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { existsSync, mkdirSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

const DIST = join(NSWP, "engines", "godot", "dist");
if (!existsSync(join(DIST, "nswp-engine.js"))) throw new Error("The Godot example isn't exported in this checkout. Run `npm run build:godot` first.");
const ORIGIN = `https://${HOST}:${process.env.FOUNDRY_PORT ?? 4309}`;
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ogg": "audio/ogg", ".wasm": "application/wasm", ".pck": "application/octet-stream", ".webp": "image/webp" };
const BARE = `<!doctype html><html><head><meta charset="utf-8"><title>A bare page</title><meta name="nswp:title" content="The Bare Hall"><meta name="nswp:accent" content="#7bd88f"><script src="nswp-engine.js"></script></head><body style="margin:0;background:#111"></body></html>`;
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const refused = new Set();
const errors = [];
mkdirSync(SHOTS, { recursive: true });

async function open(name, path) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  // Somewhere to go home to: a client brought them, and said where its Airlock is.
  await ctx.addInitScript(() => { try { sessionStorage.setItem("nswp:return-airlock", "https://airlock.example/"); } catch {} });
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== ORIGIN) { refused.add(url.origin); return route.abort(); }
    if (url.pathname === "/bare.html") return route.fulfill({ status: 200, contentType: TYPES[".html"], body: BARE });
    const p = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    const on = normalize(join(DIST, p));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.close());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${String(e).slice(0, 200)}`));
  const until = async (fn, ms = 60000, every = 300) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(every); } return null; };
  await page.goto(`${ORIGIN}${path}`, { timeout: 180000, waitUntil: "domcontentloaded" });
  const look = () =>
    page.evaluate(() => {
      const huds = document.querySelectorAll("nswp-hud");
      const root = huds[0]?.shadowRoot;
      const line = root?.querySelector(".loading");
      const keys = root ? [...root.querySelectorAll(".hotbar button.key")].map((k) => k.querySelector(".name")?.textContent) : [];
      return {
        huds: huds.length,
        crossing: window.NSWP?.crossing?.() ?? null,
        title: root?.querySelector(".id b")?.textContent ?? null,
        keys,
        line: line && !line.hidden ? line.querySelector(".what").textContent : null,
        open: !!root?.querySelector(".sheet") && !root.querySelector(".sheet").hidden && getComputedStyle(root.querySelector(".sheet")).display !== "none",
      };
    });
  return { ctx, page, until, look, shot: (what) => page.screenshot({ path: join(SHOTS, `console-first-${name}-${what}.png`), timeout: 90000 }).catch(() => undefined) };
}

// ---- The bare page: asked for its menu.
{
  const b = await open("bare", "/bare.html");
  await b.until(async () => (await b.look()).huds === 1, 10000);
  const first = await b.look();
  want("bare: the console is up while the room is", [first.huds, first.crossing], [1, "arriving"]);
  want("bare: with the page's name, Home and the loading line", [first.title, first.keys, first.line], ["The Bare Hall", ["Home"], "This world is still loading"]);
  await b.shot("arriving");
  // The visitor's own way to their console works over the room: the key left of 1.
  await b.page.keyboard.press("Backquote");
  await b.page.waitForTimeout(400);
  const up = await b.look();
  want("bare: the key left of 1 brings it up over the room", up.open, true);
  want("bare: the loading line steps aside while the menu is up", up.line, null);
  await b.shot("open-over-the-room");
  await b.page.keyboard.press("Backquote");
  await b.page.waitForTimeout(300);
  want("bare: and is back when it is put away", (await b.look()).line, "This world is still loading");
  // The world asks for its menu, holding its doors: the same console, filled in.
  await b.page.evaluate(() => window.NSWP.menu(JSON.stringify({ title: "The Bare Hall, at last", hold: true })));
  await b.page.waitForTimeout(400);
  const filled = await b.look();
  want("bare: menu() fills the same console in, and makes no second", [filled.huds, filled.title], [1, "The Bare Hall, at last"]);
  want("bare: Home is still there, now the world's", filled.keys.includes("Home"), true);
  want("bare: the line stays while the doors are shut", filled.line, "This world is still loading");
  await b.page.evaluate(() => window.NSWP.ready());
  await b.until(async () => (await b.look()).crossing === "none", 10000);
  const opened = await b.look();
  want("bare: the doors open: the console stays, the line goes", [opened.huds, opened.line], [1, null]);
  await b.ctx.close();
}

// ---- The bare page: doors opened with no menu of the kit's (a world that draws its own).
{
  const b = await open("bare-own-menu", "/bare.html");
  await b.until(async () => (await b.look()).huds === 1, 10000);
  await b.page.evaluate(() => window.NSWP.ready());
  await b.until(async () => (await b.look()).crossing === "none", 10000);
  await b.page.waitForTimeout(300);
  want("bare, its own menu: the early console goes when the doors open", (await b.look()).huds, 0);
  await b.ctx.close();
}

// ---- The Godot example: the console over the room while the engine arrives.
{
  const g = await open("godot", "/");
  const early = await g.until(async () => { const l = await g.look(); return l.huds === 1 && l.crossing === "arriving" ? l : null; }, 30000, 100);
  r["godot early"] = early;
  want("godot: the console is up while the engine is arriving", !!early && early.keys.includes("Home") && early.line === "This world is still loading", true);
  await g.shot("arriving");
  const up = await g.until(async () => { const l = await g.look(); return l.crossing === "none" && l.title === "The Foundry" ? l : null; }, 480000, 1000);
  r["godot up"] = up;
  want("godot: the world filled it in, one console, the line gone", up && [up.huds, up.line, up.keys.includes("Home")], [1, null, true]);
  await g.shot("up");
  await g.ctx.close();
}

r.refused = [...refused];
r.errors = errors.filter((e) => !/worklet/.test(e));
if (r.errors.length) bad.push(`page errors: ${r.errors.join(" | ")}`);
console.log(JSON.stringify(r, null, 1));
await browser.close();
if (bad.length) {
  console.error(`\nFAILED:\n- ${bad.join("\n- ")}`);
  process.exit(1);
}
console.log("\nPASSED: the console is up from the first moment, with Home and the loading line; the world's menu fills it in and makes no second; a world with its own menu sees it go when its doors open.");
