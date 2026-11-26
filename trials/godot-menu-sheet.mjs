// The flat menu's own drawing in a Godot world (`?menu=sheet`; docs/plans/headset-menu.md, step 4): the engine script
// draws the same menu as the kit's own worlds (menu-drawing.ts), the sheet with the bar under it, as one picture, and
// hands Godot the pixels and where each pressable thing is, as it does today's console. The add-on shows it unchanged,
// lights what a hand points at as the flat menu lights what is under the mouse, tells the kit of a press and where it
// landed, and, where the kit says the menu scrolls, gives a stick pushed while pointing at it to the menu, so that it
// doesn't walk or turn the visitor.
//
// What is real: this checkout's export of the Godot example (`npm run build:godot`), its add-on and its engine
// script. What is a stand-in, as in trials/godot-console.mjs: the headset and the hands (`window.nswpPretendHands`),
// since no scripted browser can be in a headset in a Godot world. What it can't show: scrolling itself (the example
// has no tab long enough to scroll), how it looks in a headset, and how it feels. Godot's audio worklets come from
// the local sites service at the Foundry's own port, so that service has to be up.
//
//   npm run build:godot && npm run trial -- trials/godot-menu-sheet.mjs
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const DIST = join(NSWP, "engines", "godot", "dist");
if (!existsSync(join(DIST, "nswp-engine.js"))) throw new Error("The Godot example isn't exported in this checkout. Run `npm run build:godot` first.");
const ORIGIN = `https://${HOST}:${process.env.FOUNDRY_PORT ?? 4309}`;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ogg": "audio/ogg", ".wasm": "application/wasm", ".pck": "application/octet-stream", ".webp": "image/webp", ".svg": "image/svg+xml" };
mkdirSync(SHOTS, { recursive: true });

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};
// Drawn with this machine's own graphics card, so that Godot keeps its pace.
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== ORIGIN) return route.abort();
    const p = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    const on = normalize(join(DIST, p));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.close());
  // How often the console's picture is read back to be handed to Godot: counted in the page, where it is read. A
  // reading of the console's own size is the console's.
  await ctx.addInitScript(() => {
    window.__taken = 0;
    const read = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h, ...rest) { window.__taken++; return read.call(this, x, y, w, h, ...rest); };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(100); } };
  const said = () => page.evaluate(() => JSON.parse(window.nswpExample ?? "{}"));
  const con = async () => (await said()).hands?.console ?? null;
  await page.goto(`${ORIGIN}/?menu=sheet`, { timeout: 180000, waitUntil: "domcontentloaded" });
  const up = await until(async () => { const s = await said(); return s.ready === true && s.hands ? s : null; }, 180000);
  check("the Godot example comes up, with a console to report on", !!up?.hands?.console, up?.hands);
  const taken = () => page.evaluate(() => window.__taken);
  const counted = true;

  // Made-up hands: both at the visitor's side, the right one pointing where this script says.
  const rest = { stick: [0, 0], trigger: 0, squeeze: 0, primary: false, secondary: false, press: false };
  const eye = async () => { const s = await said(); return [s.at[0], s.height + 1.3, s.at[1]]; };
  let aimAt = null;
  const hands = async (right = {}) => {
    const from = await eye();
    const s = await said();
    const level = { from, towards: [-Math.sin(s.yaw), 0, -Math.cos(s.yaw)] };
    let towards = level.towards;
    if (aimAt) { const d = aimAt.map((v, i) => v - from[i]); const n = Math.hypot(...d); towards = d.map((v) => v / n); }
    // The left hand points at the sky, at nothing.
    await page.evaluate((pads) => { window.nswpPretendHands = JSON.stringify(pads); }, [{ index: 0, hand: "left", ...rest, from, towards: [0, 1, 0] }, { index: 1, hand: "right", ...rest, from, towards, ...right }]);
  };
  const settle = (ms = 400) => page.waitForTimeout(ms);
  /**
   * The menu button on the right hand: held down until the world is seen to have taken it, then let go. The visitor
   * reads its hands as the world is stepped, so a button held for a fixed time is seen only if a step falls within
   * it, and on a page drawing a few frames a second it may never be. What shows it was taken is the console coming
   * up or going away, which the example says for itself.
   */
  const menuButton = async () => {
    const was = (await con()).open;
    await hands({ secondary: true });
    const taken = await until(async () => (await con()).open !== was, 20000);
    await hands();
    if (!taken) throw new Error("the menu button was held for 20 s and the console never came or went: the world never saw it");
    await settle(200);
  };
  /** The rows the kit lists, asked of the kit in the page: the one list. */
  const rows = () => page.evaluate(() => JSON.parse(window.NSWP.console("{}")).rows ?? []);
  /** Where a place on the console is in the world, from where the panel is and how it lies. */
  let units = { w: 1024, h: 640 };
  const placeOf = (c, x, y) => c.at.map((v, i) => v + c.right[i] * ((x / units.w - 0.5) * c.size[0]) + c.up[i] * ((0.5 - y / units.h) * c.size[1]));
  const middle = (c, row) => placeOf(c, row.x + row.w / 2, row.y + row.h / 2);
  const point = async (place, right = {}) => { aimAt = place; await hands(right); };
  // A trigger on a place on the console: pointed at until the world is seen pointing there, pulled until the world
  // is seen to have taken it, then let go. What shows a press was taken is the console's picture changing, or the
  // console going away: every press here does one or the other. Never for a fixed time.
  const pressAt = async (place) => {
    await point(place);
    const pointed = await until(async () => (await con()).aimed !== "", 10000);
    if (!pointed) throw new Error("the hand was pointed at a row for 10 s and the world never said it was pointed there");
    const was = await con();
    await point(place, { trigger: 1 });
    const taken = await until(async () => { const now = await con(); return now.open !== was.open || now.stamp !== was.stamp; }, 20000);
    await point(place);
    if (!taken) throw new Error("the trigger was held for 20 s on a row and the console never changed: the world never saw it");
    await settle(200);
  };


  await hands();
  await settle();
  // ---- The menu button brings it up: the flat menu's drawing, 1.0 m wide, as one picture with the bar under it.
  await menuButton();
  const open = await until(async () => { const c = await con(); return c?.open && c.shown && c.stamp > 0 ? c : null; }, 8000);
  check("the menu button on a hand brings the menu up, with its picture on it", !!open, await con());
  const kit = await page.evaluate(() => JSON.parse(window.NSWP.console("{}")));
  units = { w: kit.w, h: kit.h };
  check("it is the flat menu's drawing: 1.0 m wide, its height as its picture's, and the kit says it scrolls", !!open && Math.abs(open.size[0] - 1.0) < 0.002 && Math.abs(open.size[1] - kit.h / kit.w) < 0.004 && kit.scrolls === true, { size: open?.size, w: kit.w, h: kit.h, scrolls: kit.scrolls });
  const listed = await rows();
  check("its rows are the flat menu's: the tabs, Close, and the keys on the bar under it", listed.some((r) => r.id === "close") && listed.some((r) => r.id.startsWith("tab:")) && listed.some((r) => r.id.startsWith("bar:")) && open?.rows === listed.length, { listed: listed.map((r) => r.id), held: open?.rows });
  results["the rows, as the kit lists them"] = listed.map((r) => r.id);
  const flatTabs = await page.evaluate(() => JSON.parse(window.NSWP.console("{}")).rows.filter((r) => r.id.startsWith("tab:")).length);
  check("every tab it shows has a light, as the flat menu's hover", listed.filter((r) => r.id.startsWith("tab:")).every((r) => r.lit && r.lit.fillAlpha > 0) && flatTabs > 2, listed.filter((r) => r.id.startsWith("tab:")).map((r) => [r.id, !!r.lit]));

  // ---- Pointed at, a tab is lit over its own place; pressed, it is up.
  const c = await con();
  const tab = listed.find((r) => r.id.startsWith("tab:") && r.id !== "tab:travel") ?? listed.find((r) => r.id.startsWith("tab:"));
  await point(middle(c, tab));
  const lit = await until(async () => { const now = await con(); return now.aimed === tab.id && now.lit.length ? now : null; }, 8000);
  check("a hand pointed at a tab lights it, over its own place, its own size", !!lit && Math.abs(lit.lit[3] - (tab.w / units.w) * c.size[0]) < 0.003 && Math.abs(lit.lit[4] - (tab.h / units.h) * c.size[1]) < 0.003, { lit: lit?.lit, tab });
  const stampBefore = (await con()).stamp;
  await pressAt(middle(c, tab));
  const kit2 = await page.evaluate(() => JSON.parse(window.NSWP.console("{}")));
  check("a trigger on it brings that tab up: the picture changes", (await con()).stamp !== stampBefore, { before: stampBefore, after: (await con()).stamp });
  void kit2;

  // ---- A stick pushed while pointing at the menu is the menu's: the visitor doesn't walk or turn.
  const s1 = await said();
  await point(middle(c, listed.find((r) => r.id === "close")), { stick: [0, 0.9] });
  await settle(1500);
  const s2 = await said();
  await point(middle(c, listed.find((r) => r.id === "close")));
  check("a stick pushed while a hand points at the menu doesn't walk or turn them", Math.hypot(s2.at[0] - s1.at[0], s2.at[1] - s1.at[1]) < 0.01 && Math.abs(s2.yaw - s1.yaw) < 0.01, { before: [s1.at, s1.yaw], after: [s2.at, s2.yaw] });

  // ---- Close, pressed, puts it away.
  const close = (await rows()).find((r) => r.id === "close");
  await point(middle(await con(), close));
  const was = await con();
  await point(middle(was, close), { trigger: 1 });
  check("a trigger on Close puts it away", !!(await until(async () => { const now = await con(); return now.open === false && now.shown === false; }, 20000)), await con());
  await point(middle(was, close));
  check("nothing went wrong on the page", errors.length === 0, errors);
  await ctx.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
