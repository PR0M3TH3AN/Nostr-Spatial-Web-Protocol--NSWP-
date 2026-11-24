// The console in a headset in a Godot world (docs/plans/godot-headset-controls.md, "The console in a headset"): the
// engine script draws the kit's own console and hands Godot the pixels when they change; the add-on's visitor shows
// them on a panel, lights the row a hand points at with a box whose place and look the kit says, and tells the kit
// of a press.
//
// What is real: this checkout's export of the Godot example (`npm run build:godot`), its add-on and its engine
// script, the kit drawing the console and saying where its rows are, and Godot showing it. What is a stand-in:
// **the headset and the hands.** No scripted browser can be in a headset in a Godot world (Godot needs WebXR
// Layers, which the made-up headset lacks: trials/godot-leave-vr.mjs). So this runs on the flat page, and the
// example is handed hands this script makes up (`window.nswpPretendHands`): where each is, the way it points, its
// trigger and its menu button. Everything after the reading of a real controller is the same code as in a headset.
// What it can't show: a real controller's name for its menu button, how the panel looks in a headset, the one-time
// question on moving (asked only in a session), and how any of it feels. Those are the owner's, on a Quest.
//
// Nothing leaves this machine: the page is served from the build, every other request is refused, and no WebSocket
// reaches anything. Godot's two audio worklets come from the local sites service at the Foundry's own port, so that
// service has to be up.
//
//   npm run build:godot && node trials/godot-console.mjs
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
    CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h, ...rest) { if (w === 1024 && h === 640) window.__taken++; return read.call(this, x, y, w, h, ...rest); };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(100); } };
  const said = () => page.evaluate(() => JSON.parse(window.nswpExample ?? "{}"));
  const con = async () => (await said()).hands?.console ?? null;
  await page.goto(`${ORIGIN}/`, { timeout: 180000, waitUntil: "domcontentloaded" });
  const up = await until(async () => { const s = await said(); return s.ready === true && s.hands ? s : null; }, 180000);
  check("the Godot example comes up, with a console to report on", !!up?.hands?.console, up?.hands);
  check("the engine script is at the version that hands a console over: 19", (await page.evaluate(() => window.NSWP?.VERSION)) === 19, await page.evaluate(() => window.NSWP?.VERSION));
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
  const placeOf = (c, x, y) => c.at.map((v, i) => v + c.right[i] * ((x / 1024 - 0.5) * c.size[0]) + c.up[i] * ((0.5 - y / 640) * c.size[1]));
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
  check("with nothing pressed there is no console", (await con())?.open === false && (await con())?.shown === false, await con());

  // ---- The menu button brings it up, in front of them.
  await menuButton();
  const open = await until(async () => { const c = await con(); return c?.open && c.shown && c.stamp > 0 ? c : null; }, 8000);
  check("the menu button on a hand brings the console up, with its picture on it", !!open, await con());
  const s0 = await said();
  const ahead = [-Math.sin(s0.yaw), -Math.cos(s0.yaw)];
  const before = open ? [open.at[0] - s0.at[0], open.at[2] - s0.at[1]] : [0, 0];
  check("it floats where every world's does: about a metre in front of them, 0.84 m wide", !!open && Math.abs(before[0] * ahead[0] + before[1] * ahead[1] - 1.05) < 0.08 && Math.abs(open.size[0] - 0.84) < 0.002 && Math.abs(open.size[1] - 0.525) < 0.002, open && { ahead: before[0] * ahead[0] + before[1] * ahead[1], size: open.size });
  const listed = await rows();
  check("the kit lists its rows, and Godot holds as many: one list", listed.length > 3 && open?.rows === listed.length && listed.some((r) => r.id === "close") && listed.some((r) => r.id.startsWith("tab:")), { listed: listed.map((r) => r.id), held: open?.rows });
  results["the rows, as the kit lists them"] = listed.map((r) => r.id);
  await settle(600);
  await page.screenshot({ path: join(SHOTS, "godot-console-1-open.png") });
  const takenAtOpen = await taken();
  check("the picture crossed once to bring it up", !counted || takenAtOpen === 1, takenAtOpen);

  // ---- Pointing: the row is lit by a box where the kit says, and the picture never changes for it.
  const tabsListed = listed.filter((r) => r.id.startsWith("tab:"));
  const other = tabsListed.find((r) => r.lit);
  const current = tabsListed.find((r) => r.lit === null);
  let c = await con();
  const stampOpen = c.stamp;
  await point(middle(c, other));
  const lit = await until(async () => { const now = await con(); return now.aimed === other.id && now.lit.length ? now : null; }, 5000);
  const want = middle(c, other);
  check("a hand pointed at a row lights it: the box is over the row's own place, the row's own size", !!lit && Math.hypot(lit.lit[0] - want[0], lit.lit[1] - want[1], lit.lit[2] - want[2]) < 0.006 && Math.abs(lit.lit[3] - (other.w / 1024) * c.size[0]) < 0.002 && Math.abs(lit.lit[4] - (other.h / 640) * c.size[1]) < 0.002, { lit: lit?.lit, want, row: other });
  await page.screenshot({ path: join(SHOTS, "godot-console-2-a-row-lit.png") });
  // Swept over every row there is, and back.
  for (const row of [...listed, ...[...listed].reverse()]) { await point(middle(c, row)); await settle(120); }
  c = await con();
  check("pointing never changes the picture: swept over every row and back, it is the same one and nothing crossed", c.stamp === stampOpen && (!counted || (await taken()) === takenAtOpen), { stamp: [stampOpen, c.stamp], taken: [takenAtOpen, await taken()] });
  await point(middle(c, current));
  await settle(500);
  c = await con();
  check("a row the kit gives no light for is pointed at and not lit: the tab that is up", c.aimed === current.id && c.lit.length === 0, c);
  await point(placeOf(c, 512, 110));
  await settle(500);
  c = await con();
  check("a place on the console that is no row lights nothing", c.aimed === "" && c.lit.length === 0, c);
  aimAt = null;
  await hands();
  await settle(500);
  check("and nothing is lit once the hand points away", (await con()).aimed === "" && (await con()).lit.length === 0, await con());

  // ---- A press: the kit is told, the picture changes, and it crosses once.
  c = await con();
  await pressAt(middle(c, other));
  const turned = await until(async () => { const now = await con(); return now.stamp > stampOpen ? now : null; }, 8000);
  check("a trigger on another tab brings that tab up: the picture changes", !!turned, await con());
  const after = await rows();
  check("and the kit's list is the new tab's: that tab is now the one that isn't lit", after.find((r) => r.id === other.id)?.lit === null && after.find((r) => r.id === current.id)?.lit !== null, after.filter((r) => r.id.startsWith("tab:")).map((r) => [r.id, r.lit === null]));
  check("the picture crossed once for it", !counted || (await taken()) === takenAtOpen + 1, [takenAtOpen, await taken()]);
  await settle(500);
  await page.screenshot({ path: join(SHOTS, "godot-console-3-another-tab.png") });

  // ---- A row of the world's controls, pressed: the same thing the page's menu would do.
  const moving = after.find((r) => r.id === "tab:moving");
  if (moving) {
    c = await con();
    await pressAt(middle(c, moving));
    await settle(600);
    const inMoving = await rows();
    const labelOf = (id) => page.evaluate((id) => JSON.parse(window.NSWP.view()).sections.flatMap((s) => s.items).find((i) => `act:${i.id}` === id)?.label ?? null, id);
    // The row that says which way they move at a desk: pressed, it says the other.
    const way = inMoving.find((r) => r.id === "act:fps");
    if (!way) throw new Error(`no row in Moving says how they move at a desk: ${JSON.stringify(inMoving.map((r) => r.id))}`);
    const was = await labelOf(way.id);
    c = await con();
    await pressAt(middle(c, way));
    const now = await until(async () => { const l = await labelOf(way.id); return l && l !== was ? l : null; }, 6000);
    check("a trigger on a row presses it, as the page's menu would: its words change", !!now, { row: way.id, was, now: await labelOf(way.id) });
    results["the row pressed, before and after"] = [was, now];
    // Put back as it was.
    c = await con();
    await pressAt(middle(c, (await rows()).find((r) => r.id === way.id)));
    await until(async () => (await labelOf(way.id)) === was, 6000);
  } else check("the console has a Moving tab to press a row in", false, after.map((r) => r.id));

  // ---- Close, and the menu button again.
  c = await con();
  await pressAt(middle(c, (await rows()).find((r) => r.id === "close")));
  check("a trigger on Close puts it away", await until(async () => { const now = await con(); return now.open === false && now.shown === false; }, 6000), await con());
  aimAt = null;
  await menuButton();
  check("the menu button brings it up again", await until(async () => (await con()).open === true, 6000), await con());
  await menuButton();
  check("and puts it away", await until(async () => (await con()).open === false, 6000), await con());
  // ---- The owner's way to the real number, on the device itself: the example opened with a mark in its address
  // measures the console's own picture, twenty times, and says it; and again whenever the menu is opened.
  {
    const marked = await ctx.newPage();
    await marked.goto(`${ORIGIN}/#pixels`, { timeout: 180000, waitUntil: "domcontentloaded" });
    const saidThere = () => marked.evaluate(() => JSON.parse(window.nswpExample ?? "{}").said ?? "");
    const FIGURE = /^The console's picture: [\d.]+ ms to bring across, [\d.]+ at most, 20 times\. Open the menu to read this again\.$/;
    const end = Date.now() + 120000;
    let figure = "";
    while (Date.now() < end && !FIGURE.test(figure)) { figure = await saidThere().catch(() => ""); await marked.waitForTimeout(300); }
    check("opened with the mark in its address, the example measures the console's picture and says the figure", FIGURE.test(figure), figure);
    results["the figure it said, on this machine"] = figure;
    await marked.screenshot({ path: join(SHOTS, "godot-console-4-the-figure.png") });
    check("and no console is left up after it", (await marked.evaluate(() => JSON.parse(window.NSWP.console("{}")).open)) === false);
    await marked.close();
    // Without the mark nothing is measured or said of it.
    check("an ordinary visit measures nothing", !/console's picture/.test((await said()).said ?? ""), (await said()).said);
  }
  results["errors on the page"] = errors;
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
