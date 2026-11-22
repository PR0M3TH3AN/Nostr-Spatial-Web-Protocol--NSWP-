// "You're in, still loading", walked in a scripted Chrome (docs/backlog/game-worlds-kit-gaps.md, gap e): a world says
// it is still loading once the visitor is in it, and the visitor's menu says so, with the menu and the way home
// working throughout.
//
// Two worlds, each from this checkout's own build: the Grove (sites/grove/dist, `npm run build`), told through the
// kit's controls (`setLoading`), and the Godot example (engines/godot/dist, `npm run build:godot`, which needs Godot),
// told through the engine script, as a Godot world's `Nswp.loading` reaches it (`NSWP.loading`, `NSWP.loaded`).
// Pictures in SHOTS/loading-line-*.png.
//
// What is a stand-in: the world's words and how far along, said by the script and not by a world loading anything.
// Nothing leaves this machine: each world is served from its build, every other request is refused and listed, and
// no WebSocket reaches anything. Godot's two audio worklets come from the local sites service (see below). Nothing on disk is changed but the pictures.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { existsSync, mkdirSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".ogg": "audio/ogg", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".pck": "application/octet-stream" };
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const refused = new Set();
const errors = [];
mkdirSync(SHOTS, { recursive: true });

/** A page of one world's build, served at `origin`. */
async function open(name, dist, origin, viewport) {
  if (!existsSync(join(dist, "index.html"))) throw new Error(`${dist} isn't built.`);
  const rules = existsSync(join(dist, "vercel.json")) ? (JSON.parse(readFileSync(join(dist, "vercel.json"), "utf8")).headers ?? []).map((rule) => ({ fits: new RegExp(`^${rule.source}$`), headers: Object.fromEntries(rule.headers.filter((h) => !/strict-transport|cache-control/i.test(h.key)).map((h) => [h.key, h.value])) })) : [];
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport });
  await ctx.addInitScript(() => { window.__nswpTrial = { gate: true }; });
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== origin) {
      refused.add(url.origin);
      return route.abort();
    }
    const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    const on = normalize(join(dist, path));
    if (!on.startsWith(dist) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    const headers = Object.assign({}, ...rules.filter((rule) => rule.fits.test(url.pathname)).map((rule) => rule.headers));
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", headers, body: readFileSync(on) });
  });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.close());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${String(e).slice(0, 200)}`));
  if (process.env.DIAG === "1") {
    r[`${name} diag`] = [];
    page.on("console", (m) => r[`${name} diag`].length < 40 && r[`${name} diag`].push(`console ${m.type()}: ${m.text().slice(0, 160)}`));
    page.on("requestfinished", (q) => /index\.(wasm|pck|js)$/.test(q.url()) && r[`${name} diag`].push(`got ${q.url().split("/").pop()} at ${Math.round(performance.now() / 1000)}s`));
    page.on("requestfailed", (q) => r[`${name} diag`].push(`failed ${q.url().split("/").pop()}: ${q.failure()?.errorText}`));
  }
  const until = async (fn, ms = 60000, every = 300) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(every); } return null; };
  await page.goto(`${origin}/`, { timeout: 180000 });
  const line = () =>
    page.evaluate(() => {
      const l = document.querySelector("nswp-hud")?.shadowRoot?.querySelector(".loading");
      if (!l || l.hidden) return null;
      const b = l.getBoundingClientRect();
      return { what: l.querySelector(".what").textContent, much: l.querySelector(".much").textContent, unknown: l.classList.contains("unknown"), shown: b.width > 0 && b.height > 0, bottom: Math.round(innerHeight - b.bottom) };
    });
  // A busy machine draws slowly: a picture is given a minute and a half, and one that can't be taken is said, not fatal.
  const shot = (what) => page.screenshot({ path: join(SHOTS, `loading-line-${name}-${what}.png`), timeout: 90000 }).catch((e) => void (r[`${name} ${what} picture`] = `not taken: ${String(e).split("\n")[0]}`));
  return { ctx, page, until, line, shot };
}

// ---- The Grove: the kit's own controls.
for (const [label, viewport] of process.env.ONLY === "godot" ? [] : [["desk", { width: 1280, height: 760 }], ["phone", { width: 390, height: 760 }]]) {
  const g = await open(`grove-${label}`, join(NSWP, "sites", "grove", "dist"), `https://${HOST}:4395`, viewport);
  await g.until(() => g.page.evaluate(() => window.__nswpTest?.state?.ready === true), 180000);
  await g.page.evaluate(() => window.__nswpTest.controls.run("desk-casual"));
  want(`grove ${label}: no line until the world says`, await g.line(), null);
  await g.page.evaluate(() => window.__nswpTest.controls.setLoading({ fraction: 0.4, words: "Loading the arena" }));
  await g.page.waitForTimeout(400);
  const l = await g.line();
  want(`grove ${label}: the world's words and how far`, l && [l.what, l.much, l.unknown, l.shown], ["Loading the arena", "40%", false, true]);
  await g.shot("40");
  // Nothing is held up: the menu comes up over it, and Home is there.
  await g.page.evaluate(() => window.__nswpTest.hud.setOpen(true));
  await g.page.waitForTimeout(500);
  want(`grove ${label}: the menu still comes up`, await g.page.evaluate(() => window.__nswpTest.hud.open), true);
  await g.page.evaluate(() => window.__nswpTest.hud.setOpen(false));
  await g.page.evaluate(() => window.__nswpTest.controls.setLoading({ words: "Joining the match" }));
  await g.page.waitForTimeout(400);
  const u = await g.line();
  want(`grove ${label}: how far unknown`, u && [u.what, u.much, u.unknown], ["Joining the match", "", true]);
  await g.shot("unknown");
  await g.page.evaluate(() => window.__nswpTest.controls.setLoading(null));
  await g.page.waitForTimeout(300);
  want(`grove ${label}: gone when it ends`, await g.line(), null);
  await g.ctx.close();
}

// ---- The Godot example: the engine script, once the doors are open.
{
  // At the Foundry's own local address (the local sites service's port for it, FOUNDRY_PORT to say another). This
  // checkout's build is served there through the browser's interception, but a scripted browser lets two requests by
  // it: Godot's audio worklets, which go to the real service there. They are Godot's own, the same in every build.
  const g = await open("godot", join(NSWP, "engines", "godot", "dist"), `https://${HOST}:${process.env.FOUNDRY_PORT ?? 4309}`, { width: 1100, height: 700 });
  const opened = await g.until(() => g.page.evaluate(() => typeof window.NSWP?.crossing === "function" && window.NSWP.crossing() === "none" && JSON.parse(window.NSWP.view()).sections.length > 0), 480000, 1000);
  r["godot: where it got to"] = await g.page.evaluate(() => ({ script: typeof window.NSWP, crossing: window.NSWP?.crossing?.(), sections: window.NSWP ? JSON.parse(window.NSWP.view()).sections.length : null })).catch((e) => String(e));
  want("godot: the world came up and its doors opened", !!opened, true);
  if (opened) {
    await g.page.evaluate(() => window.NSWP.loading(0.65, "Loading the foundry floor"));
    await g.page.waitForTimeout(500);
    const l = await g.line();
    want("godot: the line in the menu", l && [l.what, l.much, l.shown], ["Loading the foundry floor", "65%", true]);
    want("godot: the engine's view says it too", await g.page.evaluate(() => JSON.parse(window.NSWP.view()).loading), { fraction: 0.65, words: "Loading the foundry floor" });
    await g.shot("65");
    await g.page.evaluate(() => window.NSWP.loaded());
    await g.page.waitForTimeout(300);
    want("godot: loaded() ends it", await g.line(), null);
    want("godot: and the view", await g.page.evaluate(() => JSON.parse(window.NSWP.view()).loading), null);
  }
  await g.ctx.close();
}

r.refused = [...refused];
r.errors = errors;
if (errors.length) bad.push(`page errors: ${errors.join(" | ")}`);
console.log(JSON.stringify(r, null, 1));
await browser.close();
if (bad.length) {
  console.error(`\nFAILED:\n- ${bad.join("\n- ")}`);
  process.exit(1);
}
console.log("\nPASSED: a world still loading, once the visitor is in, is a line in their menu, in the Grove and in the Godot example; the menu works throughout; it goes when the world says it is done.");
