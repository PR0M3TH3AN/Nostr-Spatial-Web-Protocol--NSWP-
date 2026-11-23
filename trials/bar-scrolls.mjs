// The bar along the bottom, when it is wider than the screen, walked in a scripted Chrome (the owner, 2026-11-21:
// "if the menu bar across the bottom grows beyond whatever screen its being seen on it should have similer side
// scrolling and arrows as the tabs in the menu at the edge of the screen to allow users to move them left or right
// so they can be clicked"; docs/backlog/bar-scrolls-when-too-wide.md).
//
// The Grove at 320 and 390 wide (a phone, touch) and 1280 (a desk), each with four tabs pinned to the bar and the
// dart blaster in hand, so Fire and Reload lead it. Not tried: a swipe along the bar. This browser's synthetic touch
// gestures move neither it nor the menu's tab row, which has always slid by touch. Pictures of each in SHOTS/bar-scrolls-<width>-*.png.
// `SHOTS_ONLY=1` takes the pictures and checks nothing (for a "before" from a build without the arrows). `DSF` is the
// phones' pixel density (2 by default, for sharp pictures). This browser draws the 3D scene in software and, at 390
// and 2, now and then falls behind: a picture may show the bar as an empty box while the page has every key in place.
// `DSF=1` doesn't.
//
// What is real here: this checkout's own build of the Grove (sites/grove/dist, so run `npm run build` first), the
// kit's bar, pins and item controls inside it, and the dart blaster's own signed description, model and logic.
//
// What is a stand-in: how the blaster is taken in hand (the world's test hook `hold`, what Hold in the bag calls,
// pressed twice as a visitor does to let its logic run), and every relay (the script answers the request for the
// blaster's description with it, and nothing else). The pins are pinned with the kit's own `setPinned`, as the
// menu's "Keep this tab on your bar" does.
//
// Nothing leaves this machine: the Grove and the blaster's files are served from the build, every other request is
// refused and listed, and no WebSocket reaches anything. Nothing on disk is changed but the pictures.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { existsSync, mkdirSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

const WORLD = `https://${HOST}:4396`;
const REAL = "https://grove.bitblocks.network";
const DIST = join(NSWP, "sites", "grove", "dist");
const SHOTS_ONLY = process.env.SHOTS_ONLY === "1";
if (!existsSync(join(DIST, "app.js"))) throw new Error("The Grove isn't built in this checkout. Run `npm run build` first.");
const BLASTER = JSON.parse(readFileSync(join(NSWP, "sites", "items", "dart-blaster.event.json"), "utf8"));
const COORD = `${BLASTER.kind}:${BLASTER.pubkey}:${BLASTER.tags.find((t) => t[0] === "d")[1]}`;
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (!SHOTS_ONLY && JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };

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
mkdirSync(SHOTS, { recursive: true });

/** One screen: its width, and whether it is a phone. */
async function screen(width, phone) {
  const name = `${width}`;
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: phone ? 700 : 760 }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: Number(process.env.DSF ?? 2) } : {}) });
  await ctx.addInitScript(() => { window.__nswpTrial = { gate: true }; });
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === WORLD || (url.origin === REAL && url.pathname.startsWith("/items/"))) return serve(route, url);
    refused.add(url.origin);
    return route.abort();
  });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
    ws.onMessage((m) => {
      let msg;
      try { msg = JSON.parse(String(m)); } catch { return; }
      if (msg[0] !== "REQ") return;
      const [, sub, ...filters] = msg;
      if (filters.some((f) => f.kinds?.includes(BLASTER.kind) && f.authors?.includes(BLASTER.pubkey))) ws.send(JSON.stringify(["EVENT", sub, BLASTER]));
      ws.send(JSON.stringify(["EOSE", sub]));
    });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${String(e).slice(0, 200)}`));
  const until = async (fn, ms = 60000, every = 200) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(every); } return null; };
  await page.goto(`${WORLD}/`, { timeout: 180000 });
  await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true), 180000);
  // Anything asked on arriving (how they move, at a desk) is put away first: it isn't what is looked at here.
  await page.evaluate(() => { const c = window.__nswpTest.controls; c.run("desk-casual"); });
  await page.waitForTimeout(300);
  // Four tabs on the bar, the most it keeps, and the blaster in hand.
  const pinned = await page.evaluate(() => {
    const c = window.__nswpTest.controls;
    const tabs = c.view().sections.map((s) => s.id).filter((id) => id !== "bag");
    for (const id of tabs.slice(0, 4)) c.setPinned(id, true);
    return c.view().pins.map((p) => p.label);
  });
  r[`${name} pinned`] = pinned;
  if (!(await page.evaluate((c) => window.__nswpTest.hold(c), COORD)).ok) await page.evaluate((c) => window.__nswpTest.hold(c), COORD);
  // Taken in hand: Fire is on the bar at a desk, and under the thumb on a touch screen.
  await until(() => page.evaluate(() => !!window.__nswpTest.play()?.script && window.__nswpTest.play().script === "running"), 20000);
  await page.waitForTimeout(600);
  const look = () =>
    page.evaluate(() => {
      const root = document.querySelector("nswp-hud").shadowRoot;
      const bar = root.querySelector(".hotbar");
      const box = (e) => { const b = e.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom), width: Math.round(b.width) }; };
      const shown = (e) => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none";
      const back = root.querySelector(".bar .more.left");
      const on = root.querySelector(".bar .more.right");
      const keys = [...bar.querySelectorAll("button.key")];
      const seen = box(bar);
      return {
        over: bar.scrollWidth > bar.clientWidth + 1,
        scroll: Math.round(bar.scrollLeft),
        bar: seen,
        screen: innerWidth,
        arrows: { back: shown(back), on: shown(on), backBox: back && shown(back) ? box(back) : null, onBox: on && shown(on) ? box(on) : null },
        keys: keys.map((k) => ({ name: k.querySelector(".name").textContent, ...box(k) })),
        // Whatever is at the middle of each arrow, as a tap there would find it: the arrow itself, or a key under it.
        tapBack: back && shown(back) ? (() => { const b = back.getBoundingClientRect(); const at = root.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return at?.closest(".more") ? "arrow" : at?.closest(".key") ? "key" : at?.className ?? "nothing"; })() : null,
        tapOn: on && shown(on) ? (() => { const b = on.getBoundingClientRect(); const at = root.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return at?.closest(".more") ? "arrow" : at?.closest(".key") ? "key" : at?.className ?? "nothing"; })() : null,
      };
    });
  // A phone is pressed with a finger: a mouse's click there would make the kit take it for a desk.
  const press = (sel) => (phone ? page.locator("nswp-hud").locator(sel).tap({ timeout: 15000 }) : page.locator("nswp-hud").locator(sel).click({ timeout: 15000 }));
  const scrollNow = () => page.evaluate(() => Math.round(document.querySelector("nswp-hud").shadowRoot.querySelector(".hotbar").scrollLeft));
  /**
   * Press something that slides the bar, and wait until the bar has begun to move from where it was, and then come
   * to rest. Waiting only for it to be still takes "not begun yet" for "done": on a busy machine a smooth slide may
   * not begin for a second or more after the press. (This trial failed that way, with nothing wrong in the bar, on
   * 2026-11-23, on a machine with a load of 25.) Where the bar never moves, this gives up after 20 seconds and the
   * check that follows says so.
   */
  const slide = async (doIt) => {
    const from = await scrollNow();
    await doIt();
    await until(async () => (await scrollNow()) !== from, 20000, 100);
    await settle();
  };
  /** Until the bar has come to rest: a slide is smooth, and a busy headless browser draws few frames a second. */
  const settle = async () => {
    let last = -1;
    let still = 0;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250);
      const now = await page.evaluate(() => Math.round(document.querySelector("nswp-hud").shadowRoot.querySelector(".hotbar").scrollLeft));
      still = now === last ? still + 1 : 0;
      if (still >= 3) return;
      last = now;
    }
  };
  const shot = (what) => page.screenshot({ path: join(SHOTS, `bar-scrolls-${name}-${what}.png`) });
  await settle();
  const first = await look();
  r[`${name} start`] = first;
  await shot("start");
  if (!SHOTS_ONLY) {
    const fits = !first.over;
    // The bar is on the screen, whatever its width.
    want(`${name}: the bar within the screen`, first.bar.left >= 0 && first.bar.right <= first.screen, true);
    // Fire and Reload lead it, at its start, at a desk. On a touch screen they are under the thumb and not on the
    // bar at all (kit 0.79.0, thumb-presses.ts), so the bar there begins with the place's own keys.
    if (phone) want(`${name}: on a touch screen, Fire and Reload are not on the bar`, first.keys.some((k) => k.name === "Fire" || k.name === "Reload"), false);
    else want(`${name}: Fire and Reload lead the bar`, first.keys.slice(0, 2).map((k) => k.name), ["Fire", "Reload"]);
    if (fits) {
      want(`${name}: no arrows when it fits`, [first.arrows.back, first.arrows.on], [false, false]);
    } else {
      want(`${name}: at the start, an arrow only on the right`, [first.arrows.back, first.arrows.on], [false, true]);
      want(`${name}: the right arrow takes its own tap`, first.tapOn, "arrow");
      // No key's visible part is under the arrow: every key's box ends before the arrow begins, or is cut off by the
      // bar there (the bar ends where the arrow starts).
      want(`${name}: the arrow is beside the bar, not over it`, !!first.arrows.onBox && first.arrows.onBox.left >= first.bar.right - 1, true);
      // The arrow moves it along.
      await slide(() => press(".bar .more.right"));
      const moved = await look();
      r[`${name} after the right arrow`] = moved;
      want(`${name}: the right arrow moves it along`, moved.scroll > first.scroll, true);
      want(`${name}: once moved along, an arrow on the left too`, moved.arrows.back, true);
      want(`${name}: the left arrow takes its own tap`, moved.tapBack, "arrow");
      want(`${name}: the left arrow is beside the bar, not over it`, !!moved.arrows.backBox && moved.arrows.backBox.right <= moved.bar.left + 1, true);
      want(`${name}: the keys didn't jump as the arrows changed (the bar the same width)`, moved.bar.width, first.bar.width);
      await shot("moved");
      // To the end: the right arrow goes.
      const steps = [];
      for (let i = 0; i < 6; i++) {
        const at = await look();
        steps.push({ scroll: at.scroll, on: at.arrows.on });
        if (!at.arrows.on) break;
        await slide(() => press(".bar .more.right").catch((e) => steps.push(`press: ${String(e).split("\n")[0]}`)));
      }
      r[`${name} to the end`] = steps;
      const end = await look();
      r[`${name} end`] = end;
      want(`${name}: at the end, no arrow on the right`, end.arrows.on, false);
      want(`${name}: the last key wholly in sight at the end`, end.keys.at(-1).right <= end.bar.right + 1, true);
      await shot("end");
      // A swipe isn't tried here: this browser's synthetic touch gestures move neither the bar nor the menu's tab
      // row (which has always slid by touch), so they can't say anything. The bar slides by touch as it always did:
      // the browser's own scrolling, which the kit leaves alone.
      // (Taking an item up brings the bar back to its start, so Fire and Reload are in sight: that is a desk's, where
      // they are on the bar, and no desk here has a bar too wide to slide. Not tried by this trial.)
      const again = await look();
      if (width === 390) {
        // A mouse's wheel over a bar too wide moves it along, as over the menu's tabs (here on the phone-wide screen,
        // the one place it is too wide; a mouse on a narrow window is the same).
        await page.mouse.move(Math.round((again.bar.left + again.bar.right) / 2), Math.round((again.bar.top + again.bar.bottom) / 2));
        await page.mouse.wheel(0, 400);
        await settle();
        r[`${name} wheel`] = (await look()).scroll;
        want(`${name}: a mouse wheel moves it along`, r[`${name} wheel`] > 0, true);
      }
    }
  }
  await ctx.close();
}

try {
  await screen(320, true);
  await screen(390, true);
  await screen(1280, false);
} catch (e) {
  bad.push(`threw: ${String(e).slice(0, 1200)}`);
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
console.log(SHOTS_ONLY ? "\nPictures taken." : "\nPASSED: at 320 and 390 the bar slides, with an arrow at each side there is more, beside the keys and never over one; on a desk it fits and has none.");
