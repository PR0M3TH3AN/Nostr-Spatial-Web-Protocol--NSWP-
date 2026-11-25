// The Arcade's bar on a phone (the owner, 2026-11-24, of kit 0.89.0 on his phone: "On mobile I can't see the menu
// bar in the arcade"). The Arcade asks for the kit's quiet form, which at a desk is one mark in a corner and
// nothing else, because the keyboard is for playing. On a touch screen there is no keyboard to keep for play, and
// a visitor has nothing to press for what the bar carries. So where the device's main pointer is touch, quiet keeps
// the bar: its keys seen and pressable, the sheet standing above it as it does in full, what the menu covers
// counting it, and "Keep this tab on your bar" offered. The corner mark, the world's card and the top row are as
// quiet has them. At a desk, nothing changes.
//
// What is real: this checkout's own build of the Arcade (sites/arcade/dist, so run `npm run build` first), opened by
// its address in a real Chrome, once as a phone (a touch screen, its main pointer a finger, real taps) and once at
// a desk (a mouse). Nothing is fetched from anywhere else, and no relay is reached: every WebSocket is answered here.
//
//   npm run build && node trials/arcade-bar.mjs
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { mkdirSync } from "node:fs";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const WORLD = "https://arcade.test";
const DIST = join(NSWP, "sites", "arcade", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".webp": "image/webp", ".woff2": "font/woff2" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got };
  if (!ok) fail.push(name);
};

const SOFTWARE = process.argv.includes("--software");
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: SOFTWARE ? [] : ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
const sockets = new Set();
const open = async (o) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, ...o });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
    sockets.add(new URL(ws.url()).host);
    ws.onMessage((m) => {
      let msg;
      try { msg = JSON.parse(String(m)); } catch { return; }
      if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]]));
    });
  });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== WORLD) return route.abort();
    const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  const page = await ctx.newPage();
  await page.goto(`${WORLD}/`, { timeout: 60000 });
  await page.waitForFunction(() => window.__nswpTest?.state?.ready === true && document.querySelector("nswp-hud"), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  return { ctx, page };
};

/** Everything this trial reads of the menu, in one go. */
const read = (page) =>
  page.evaluate(() => {
    const root = document.querySelector("nswp-hud").shadowRoot;
    const host = document.querySelector("nswp-hud");
    const seen = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none";
    const box = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const bar = root.querySelector(".bar");
    const keys = bar ? [...bar.querySelectorAll("button")].filter(seen) : [];
    // A key can be pressed where it is what is on top at its middle.
    const pressable = keys.filter((k) => { const b = k.getBoundingClientRect(); const top = root.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return top === k || k.contains(top); });
    const sheet = root.querySelector("section.sheet");
    const pin = root.querySelector(".pin-it");
    return {
      presence: host.dataset.presence,
      touch: matchMedia("(pointer: coarse)").matches,
      bar: seen(bar) ? box(bar) : null,
      keys: keys.length,
      pressable: pressable.length,
      firstKey: pressable[0] ? { box: box(pressable[0]), label: (pressable[0].getAttribute("aria-label") || pressable[0].textContent || "").trim().slice(0, 30) } : null,
      mark: seen(root.querySelector(".quiet")) ? box(root.querySelector(".quiet")) : null,
      card: seen(root.querySelector(".id")),
      menuButton: seen(root.querySelector(".menu")),
      sheetUp: !!sheet && !sheet.hidden,
      sheet: sheet && !sheet.hidden ? box(sheet) : null,
      pin: seen(pin),
      cover: window.__nswpTest.hud.cover?.() ?? null,
      height: innerHeight,
    };
  });

try {
  // ---- A phone: a touch screen, its main pointer a finger.
  {
    const { ctx, page } = await open({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const down = await read(page);
    results["on a phone, with the menu down"] = down;
    check("on a phone, the Arcade asks for quiet, and the device's main pointer is a finger", down.presence === "quiet" && down.touch === true, { presence: down.presence, touch: down.touch });
    check("on a phone, the Arcade has its bar, with its keys seen", !!down.bar && down.keys > 0, { bar: down.bar, keys: down.keys });
    check("on a phone, every key of the bar is what is on top at its middle: nothing lies over it", down.keys > 0 && down.pressable === down.keys, { keys: down.keys, pressable: down.pressable });
    check("on a phone, the corner mark is still there, and the world's card and the Menu button are as quiet has them: away", !!down.mark && !down.card && !down.menuButton, { mark: down.mark, card: down.card, menuButton: down.menuButton });
    check("on a phone, what the menu says it covers counts the bar, from its top to the foot of the screen", !!down.cover && !!down.bar && down.cover.bottom === down.height - down.bar[1], { cover: down.cover, bar: down.bar, height: down.height });
    // A real tap on a key of the bar is a press of it.
    if (down.firstKey) {
      await page.evaluate(() => {
        window.__tapped = 0;
        const root = document.querySelector("nswp-hud").shadowRoot;
        for (const k of root.querySelectorAll(".bar button")) k.addEventListener("click", () => window.__tapped++, true);
      });
      const [l, t, r, b] = down.firstKey.box;
      await page.touchscreen.tap((l + r) / 2, (t + b) / 2);
      await page.waitForTimeout(400);
      check(`on a phone, a tap on the bar's first key ("${down.firstKey.label}") is a press of it`, (await page.evaluate(() => window.__tapped)) === 1, await page.evaluate(() => window.__tapped));
      // Whatever that key did (a sheet, a chat), put away again for what follows.
      await page.evaluate(() => { window.__nswpTest.hud.setOpen(false); window.__nswpTest.hud.setChatOpen?.(false); });
      await page.waitForTimeout(300);
    }
    // The menu brought up by a tap on the corner mark: the sheet stands above the bar, as it does in full.
    const mark = (await read(page)).mark;
    if (mark) {
      await page.touchscreen.tap((mark[0] + mark[2]) / 2, (mark[1] + mark[3]) / 2);
      await page.waitForFunction(() => window.__nswpTest.hud.open === true, null, { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(500);
    }
    const up = await read(page);
    results["on a phone, with the menu up"] = up;
    check("on a phone, a tap on the corner mark brings the menu up", up.sheetUp, up.sheetUp);
    check("on a phone, the sheet's foot stands above the bar: the bar is not under the sheet", !!up.sheet && !!up.bar && up.sheet[3] <= up.bar[1], { sheet: up.sheet, bar: up.bar });
    check('on a phone, "Keep this tab on your bar" is offered: there is a bar to keep it on', up.pin === true, up.pin);
    // The menu's button is the mark with no words, and on a touch screen no hint shows, even after a tap on it.
    const markHint = await page.evaluate(() => { const b = document.querySelector("nswp-hud").shadowRoot.querySelector("button.quiet"); const h = b.querySelector(".hint"); return { words: b.innerText.trim(), hint: h && getComputedStyle(h).display !== "none" }; });
    check("on a phone, the menu's button has no words, and no hint shows after a tap on it", markHint.words === "" && markHint.hint === false, markHint);
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, "arcade-bar-phone.png") }).catch(() => undefined);
    await ctx.close();
  }

  // ---- A desk: a mouse. Quiet as it was: one mark in a corner, no bar.
  {
    const { ctx, page } = await open({ viewport: { width: 1100, height: 700 } });
    const down = await read(page);
    results["at a desk, with the menu down"] = down;
    check("at a desk, the Arcade asks for quiet, with a mouse", down.presence === "quiet" && down.touch === false, { presence: down.presence, touch: down.touch });
    check("at a desk, quiet is as it was: no bar, the corner mark, no card, no Menu button", !down.bar && !!down.mark && !down.card && !down.menuButton, { bar: down.bar, mark: down.mark, card: down.card, menuButton: down.menuButton });
    check("at a desk, the menu covers nothing at the foot of the screen", !!down.cover && down.cover.bottom === 0, down.cover);
    await page.evaluate(() => window.__nswpTest.hud.setOpen(true));
    await page.waitForTimeout(500);
    const up = await read(page);
    check('at a desk, "Keep this tab on your bar" is not offered: there is no bar', up.sheetUp && up.pin === false, { sheetUp: up.sheetUp, pin: up.pin });
    await ctx.close();
  }
} finally {
  await browser.close();
}
results["relays asked for, and answered here with nothing"] = [...sockets];
console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length} of ${Object.values(results).filter((r) => r === "ok" || r?.failed !== undefined).length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
