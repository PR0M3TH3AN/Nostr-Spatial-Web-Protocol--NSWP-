// The Full screen button and Escape in fullscreen, walked in a scripted Chrome (the owner, 2026-11-21: "a little
// fullscreen button ... at the top center", and in fullscreen "Escape once should not exit full screen. It should
// pull up the menu. Escape again from the menu should exit full screen.").
//
// What is real here: this checkout's own build of the Gallery (sites/gallery/dist, so run `npm run build` first),
// the kit's menu, button and Escape rule inside it, and Chrome's own fullscreen and Keyboard Lock.
//
// What is a stand-in: that the page has a mouse (a headless browser reports none, and the intense way is offered
// only with one); and the Escape presses, which come from the script and not a keyboard. Chrome leaves fullscreen on
// a real Escape the page doesn't hold, which a scripted press never makes it do: so what is shown is what the
// page does with Escape, not what the browser does around it. Where the browser leaves by itself (Firefox,
// Safari, or a long hold in Chrome), the trial stands that in by leaving through the page's own exit call, and
// checks only that the page didn't ask for it.
//
// Nothing leaves this machine: every request to anywhere but the world's copy is refused and listed, and no relay
// is reached (every WebSocket is closed at once). Nothing on disk is changed.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { existsSync, mkdirSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

const WORLD = `https://${HOST}:4398`;
const DIST = join(NSWP, "sites", "gallery", "dist");
if (!existsSync(join(DIST, "app.js"))) throw new Error("The Gallery isn't built in this checkout. Run `npm run build` first.");
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".ogg": "audio/ogg", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const rules = (JSON.parse(readFileSync(join(DIST, "vercel.json"), "utf8")).headers ?? []).map((rule) => ({ fits: new RegExp(`^${rule.source}$`), headers: Object.fromEntries(rule.headers.filter((h) => !/strict-transport|cache-control/i.test(h.key)).map((h) => [h.key, h.value])) }));
const headersFor = (path) => Object.assign({}, ...rules.filter((rule) => rule.fits.test(path)).map((rule) => rule.headers));

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const refused = new Set();
const errors = [];
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
await ctx.addInitScript(() => {
  window.__nswpTrial = { gate: true };
  // A headless browser has no mouse to report. The page is told it has one, as a desk does: a stand-in.
  const media = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/pointer:\s*fine/.test(q) ? media("all") : media(q));
  // What the page asks of Keyboard Lock and of fullscreen, kept for the trial to read.
  window.__asked = [];
  const kb = navigator.keyboard;
  if (kb?.lock) {
    const lock = kb.lock.bind(kb);
    const unlock = kb.unlock.bind(kb);
    kb.lock = (keys) => { window.__asked.push(`lock ${keys}`); return lock(keys).then(() => window.__asked.push("locked"), (e) => { window.__asked.push(`refused ${e?.name}`); throw e; }); };
    kb.unlock = () => { window.__asked.push("unlock"); return unlock(); };
  }
  const exit = Document.prototype.exitFullscreen;
  window.__exit = () => exit.call(document);
  Document.prototype.exitFullscreen = function () { window.__asked.push("exit"); return exit.call(this); };
  document.addEventListener("fullscreenchange", () => window.__asked.push(document.fullscreenElement ? "filled" : "unfilled"), true);
});
await ctx.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
  if (url.origin === WORLD) {
    const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    const on = normalize(join(DIST, path));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", headers: headersFor(url.pathname), body: readFileSync(on) });
  }
  refused.add(url.origin);
  return route.abort();
});
await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.close());
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const until = async (fn, ms = 60000, every = 200) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(every); } return null; };
await page.goto(`${WORLD}/`, { timeout: 180000 });
await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true), 180000);
await page.evaluate(() => { window.__menu = []; window.__nswpTest.controls.onSignal((n) => (n === "menuOpen" || n === "menuClose") && window.__menu.push(n)); });
const state = () => page.evaluate(() => ({ filled: !!document.fullscreenElement, menu: window.__menu.slice(), asked: window.__asked.slice() }));
const button = page.locator("nswp-hud").getByRole("button", { name: "Full screen" });
const shot = async (name) => { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: join(SHOTS, `fullscreen-escape-${name}.png`) }); };

// ---- On a desk, not filled: the button is at the top, in the middle.
await until(() => button.isVisible(), 20000);
await shot("0-arrived");
r.arrivedAs = await page.evaluate(() => ({ any: matchMedia("(any-pointer: fine)").matches, main: matchMedia("(pointer: fine)").matches }));
want("button shown before fullscreen", await button.isVisible(), true);
const box = (await button.isVisible()) ? await button.boundingBox() : null;
r.box = box;
want("button at the top centre", !!box && Math.abs(box.x + box.width / 2 - 550) < 4 && box.y < 40, true);
await shot("1-button");

// ---- Pressed: the screen fills, the button goes, and Escape is held for the page.
await button.click();
await until(() => page.evaluate(() => !!document.fullscreenElement && window.__asked.includes("locked")), 10000);
let s = await state();
r.afterPress = s;
want("filled after the press", s.filled, true);
want("Escape held for the page", s.asked.includes("locked"), true);
await until(async () => !(await button.isVisible()), 5000);
want("button hidden while filled", await button.isVisible(), false);

// ---- The first Escape: the menu, and still filled.
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
s = await state();
r.firstEscape = s;
want("first Escape opens the menu", s.menu, ["menuOpen"]);
want("first Escape leaves the screen filled", s.filled, true);
want("first Escape asks nothing of fullscreen", s.asked.includes("exit"), false);
await shot("2-menu-in-fullscreen");

// ---- The second Escape, from the menu: out of fullscreen. The button comes back.
await page.keyboard.press("Escape");
// A browser says the screen changed a frame or so later: the page lets the key go when it hears.
await until(() => page.evaluate(() => !document.fullscreenElement && window.__asked.at(-1) === "unlock"), 5000);
s = await state();
r.secondEscape = s;
want("second Escape leaves fullscreen", s.filled, false);
want("the page asked to leave", s.asked.includes("exit"), true);
want("Escape let go once out", s.asked.slice(s.asked.indexOf("exit")), ["exit", "unfilled", "unlock"]);
await until(() => button.isVisible(), 5000);
want("button back once out", await button.isVisible(), true);
await shot("3-out");

// ---- Out of fullscreen, Escape closes the menu, as always.
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
s = await state();
want("Escape out of fullscreen closes the menu", s.menu.at(-1), "menuClose");
want("and fills nothing", s.filled, false);

// ---- The browser takes the screen back by itself (a long hold here, or any Escape in Firefox and Safari): the
// menu comes up then. Stood in by leaving without the page's word, the page's own exit call put aside.
await button.click();
await until(() => page.evaluate(() => !!document.fullscreenElement && window.__asked.filter((a) => a === "locked").length === 2), 10000);
const before = (await state()).menu.length;
r.secondFill = await state();
await page.evaluate(() => { window.__asked.push("browser leaves"); return window.__exit(); });
r.heardLeaving = !!(await until(() => page.evaluate(() => window.__asked.at(-1) === "unlock"), 10000));
await page.waitForTimeout(300);
s = await state();
r.browserLeft = s;
want("menu up when the browser left by itself", s.menu.slice(before), ["menuOpen"]);

// ---- Moving the intense way, the pointer held by the view: the same two presses, and the pointer comes back on the
// first. (Holding the pointer is the intense way's; holding Escape is the kit's, for everyone: the two mustn't both
// answer one press, so the first can't open the menu and leave fullscreen together.)
if ((await state()).menu.at(-1) === "menuOpen") await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const intense = await page.evaluate(() => {
  // The way a visitor's choice in Moving turns it on: the world's own controller of it.
  const fps = window.__nswpTest.fps;
  if (!fps) return "no intense way in this world";
  fps.setEnabled(true);
  return fps.enabled ? "on" : "refused";
});
r.intense = intense;
want("intense way offered on a desk", intense, "on");
await page.waitForTimeout(300);
if ((await state()).menu.at(-1) === "menuOpen") await page.keyboard.press("Escape");
await button.click();
await until(() => page.evaluate(() => !!document.fullscreenElement && window.__asked.filter((a) => a === "locked").length === 3), 10000);
await page.mouse.click(550, 450);
const looking = await until(() => page.evaluate(() => !!document.pointerLockElement), 5000);
r.intensePointerHeld = !!looking;
const m0 = (await state()).menu.length;
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
s = await state();
r.intenseFirst = { ...s, pointer: await page.evaluate(() => !!document.pointerLockElement) };
want("intense: the first Escape opens the menu once", s.menu.slice(m0), ["menuOpen"]);
want("intense: still filled after the first", s.filled, true);
want("intense: the pointer given back", r.intenseFirst.pointer, false);
await page.keyboard.press("Escape");
await until(() => page.evaluate(() => !document.fullscreenElement && window.__asked.at(-1) === "unlock"), 5000);
s = await state();
want("intense: the second Escape leaves fullscreen", s.filled, false);
want("intense: the menu stays up", s.menu.slice(m0), ["menuOpen"]);
await shot("4-intense-out");

r.refused = [...refused];
r.errors = errors;
if (errors.length) bad.push(`page errors: ${errors.join(" | ")}`);
console.log(JSON.stringify(r, null, 1));
await browser.close();
if (bad.length) {
  console.error(`\nFAILED:\n- ${bad.join("\n- ")}`);
  process.exit(1);
}
console.log("\nPASSED: the button at the top centre; in fullscreen, the first Escape is the menu and the next leaves; the browser leaving by itself brings the menu up.");
