// A headset session in a Godot world, and the button every world's console comes up on (B on the right hand, Y on
// the left). It was written for the stopgap, when that button left the session to reach the page's menu
// (docs/plans/godot-headset-controls.md). The console is drawn in a headset there now, so the button brings the
// console up and the visitor stays in the session: the way out is a row of the console, as in every world. The
// console itself is tried on a flat page with made-up hands (trials/godot-console.mjs).
//
// What is real: this checkout's export of the Godot example (engines/godot/dist, `npm run build:godot`), with this
// checkout's add-on and engine script, in a real Chrome. What is a stand-in: the headset. It is a made-up one
// (`iwer`, a script put in the page before anything else), with two made-up controllers whose buttons this script
// presses.
//
// **What it can show, as of 2026-11-23, is less than it was written for.** Godot starts a session only where the
// browser has WebXR Layers, and this made-up headset (iwer 2.8.0) has none: its session starts, and Godot then
// refuses it by name. So here the trial shows that the example still comes up with its two hands added, that it
// is offered the way in, and that it asks the headset for a session; and it says plainly that the button itself
// was NOT shown. Where a session does start (a made-up headset that gains Layers), the rest runs as written: other
// buttons leave the visitor where they are, and B and Y bring the console up and put it away. Until then the
// button is the owner's to press on a real headset (the list is in docs/plans/godot-headset-controls.md).
//
// Nothing leaves this machine: the page is served from the build, every other request is refused and listed, and
// no WebSocket reaches anything. Godot's two audio worklets come from the local sites service at the Foundry's own
// port, where the page is served (a scripted browser lets them past its interception), so that service has to be up.
//
// This is not a trial about presses on a page, so the script reads the page directly.
//
//   npm run build:godot && node trials/godot-leave-vr.mjs
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const DIST = join(NSWP, "engines", "godot", "dist");
if (!existsSync(join(DIST, "nswp-engine.js"))) throw new Error("The Godot example isn't exported in this checkout. Run `npm run build:godot` first.");
const ORIGIN = `https://${HOST}:${process.env.FOUNDRY_PORT ?? 4309}`;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ogg": "audio/ogg", ".wasm": "application/wasm", ".pck": "application/octet-stream", ".webp": "image/webp" };
const iwer = readFileSync(join(NSWP, "node_modules", "iwer", "build", "iwer.min.js"), "utf8");
mkdirSync(SHOTS, { recursive: true });

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};
const refused = new Set();
const errors = [];
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  // The made-up headset, before anything of the page's runs: a Quest 3, with its two controllers. Put in place of
  // the browser's own WebXR, which is there in Chrome and has no headset behind it.
  await ctx.addInitScript({ content: `${iwer};(() => { const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime({ forceInstall: true }); window.__headset = d; window.__asked = []; const ask = navigator.xr.requestSession.bind(navigator.xr); navigator.xr.requestSession = (mode, init) => { window.__asked.push([mode, init]); return ask(mode, init); }; })();` });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("nswp:return-airlock", "https://airlock.example/"); } catch {} });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== ORIGIN) { refused.add(url.origin); return route.abort(); }
    const p = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    const on = normalize(join(DIST, p));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.close());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (ask, ms = 30000, every = 200) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(every); } };
  const said = () => page.evaluate(() => JSON.parse(window.nswpExample ?? "{}"));
  const menu = () => page.evaluate(() => { const hud = document.querySelector("nswp-hud"); const root = hud?.shadowRoot; const sheet = root?.querySelector("section.sheet"); return { hidden: !!hud?.hidden || hud?.style.display === "none", open: !!sheet && !sheet.hidden, home: [...(root?.querySelectorAll(".hotbar button.key .name") ?? [])].some((n) => n.textContent === "Home"), words: [...(root?.querySelectorAll(".says *") ?? [])].map((n) => n.textContent).join(" | ") }; });
  const button = (hand, name, value) => page.evaluate(([hand, name, value]) => window.__headset.controllers[hand].updateButtonValue(name, value), [hand, name, value]);
  const tap = async (hand, name) => { await button(hand, name, 1); await page.waitForTimeout(250); await button(hand, name, 0); };

  await page.goto(`${ORIGIN}/`, { timeout: 180000, waitUntil: "domcontentloaded" });
  check("the Godot example comes up, on the page", await until(async () => (await said()).ready === true, 180000), await said().catch(() => null));
  const row = await until(() => page.evaluate(() => JSON.parse(window.NSWP.view()).sections.flatMap((s) => s.items).find((i) => i.id === "vr")?.label ?? null), 30000);
  check("it hears that a headset session can start here, and offers the way in", row === "Enter VR", row);

  // In.
  await page.evaluate(() => window.NSWP.run("vr"));
  const asked = await until(() => page.evaluate(() => (window.__asked.length ? window.__asked : null)), 15000);
  check("pressed, it asks the headset for a session on the floor", JSON.stringify(asked) === JSON.stringify([["immersive-vr", { requiredFeatures: ["local-floor"], optionalFeatures: ["hand-tracking"] }]]), asked);
  const started = await until(async () => { const now = await said(); return now.in_headset === true ? "in" : /couldn't start/.test(now.said ?? "") ? now.said : null; }, 30000);
  if (started !== "in") {
    // Said, not passed over: the rest of this trial did not run.
    results["NOT SHOWN: the button in a session"] = `No session started in the made-up headset, so the button was never pressed in one. Godot said: ${String(started).slice(0, 260)}`;
    check("where no session starts, it is because the made-up headset has no WebXR Layers, which Godot says by name", /WebXR Layers/.test(String(started)), started);
    check("and the visitor is told, on the page, with the menu still theirs", (await menu()).hidden === false && (await menu()).home === true, await menu());
  } else {
    check("the page's menu is put away for the session", await until(async () => (await menu()).hidden, 5000), await menu());
    await page.screenshot({ path: join(SHOTS, "godot-leave-vr-1-in.png") });

    // Other buttons are not the way out: the trigger, the grip, and the lower button under the thumb.
    for (const [hand, name] of [["right", "trigger"], ["left", "squeeze"], ["right", "a-button"], ["left", "x-button"]]) await tap(hand, name);
    await page.waitForTimeout(1500);
    check("the trigger, the grip and the lower button under the thumb leave them where they are", (await said()).in_headset === true, (await said()).in_headset);

    // The button the console comes up on in every world: B on the right hand. They stay in the session.
    const consoleNow = async () => (await said()).hands?.console ?? {};
    await tap("right", "b-button");
    check("B on the right hand brings the console up, and they are still in the session", (await until(async () => (await consoleNow()).open === true, 15000)) && (await said()).in_headset === true, [await consoleNow(), (await said()).in_headset]);
    await page.screenshot({ path: join(SHOTS, "godot-leave-vr-2-console.png") });
    await tap("right", "b-button");
    check("and pressed again, puts it away", await until(async () => (await consoleNow()).open === false, 15000), await consoleNow());
    // And from the other hand: Y on the left.
    await tap("left", "y-button");
    check("Y on the left hand brings it up too", await until(async () => (await consoleNow()).open === true, 15000), await consoleNow());
  }
  results["refused, as everything but this site is"] = [...refused].sort();
  results["page errors"] = errors;
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
