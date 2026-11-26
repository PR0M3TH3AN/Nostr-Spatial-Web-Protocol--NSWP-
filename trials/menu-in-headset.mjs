// The flat menu's own drawing in a headset (`?menu=sheet`, packages/sdk/src/console-sheet.ts; docs/plans/headset-menu.md,
// step 3), in the Gallery, in a made-up Quest 3 (iwer). Everything is pointed at with a controller and pressed with its
// trigger, as a visitor does, through the world's own select: no call into the menu presses anything.
//
//   - Open, it is the flat menu's sheet: every tab the flat menu has, in its order, and the bar under it.
//   - A tab pointed at comes forward 3.5 cm, eased; pressed, it is the tab that is up.
//   - A row pressed does what it does; a key on the bar pointed at comes forward off the bar.
//   - Pointing at a long tab and pushing a stick scrolls it, and doesn't walk or turn the visitor.
//   - With movement turned down, nothing comes forward.
//   - Close, pressed, puts it away; hands are drawn after every part of it.
//
// What is real: this checkout's build of the Gallery, its kit, a real Chrome, the world's own rays and select. Made up:
// the headset and its controllers (iwer), a long tab of stand-in rows, and BitLogin (a stand-in signer: nobody is
// signed in). Nothing is fetched from anywhere else.
//
//   npm run build && npm run trial -- trials/menu-in-headset.mjs
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const WORLD = "https://gallery.test";
const SIGN_IN = "https://bitlogin.network";
const DIST = join(NSWP, "sites", "gallery", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
mkdirSync(SHOTS, { recursive: true });
const IWER = readFileSync(join(NSWP, "node_modules", "iwer", "build", "iwer.min.js"), "utf8");

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};
const signerPage = `<!doctype html><meta charset="utf-8"><script>
const say = (m) => parent.postMessage({ nswp: "nswp-signer", v: 1, ...m }, ${JSON.stringify(WORLD)});
addEventListener("message", (e) => { const d = e.data; if (!d || d.nswp !== "nswp-signer") return; if (d.t === "state") say({ t: "state", ...(d.id ? { id: d.id } : {}), unlocked: false }); });
say({ t: "ready" });
</script>`;

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript(`${IWER}; window.__xr = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false }); window.__xr.installRuntime({ forceInstall: true });`);
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }));
  const elsewhere = new Set();
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === SIGN_IN && url.pathname === "/signer/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: signerPage });
    if (url.origin !== WORLD) {
      elsewhere.add(url.origin);
      return route.abort();
    }
    const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(100); } };
  await page.goto(`${WORLD}/?menu=sheet`, { timeout: 60000 });
  await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
  // A long tab, so that there is something to scroll: thirty stand-in rows.
  await page.evaluate(() => {
    const c = window.__nswpTest.controls;
    c.addSection({ id: "long", label: "Long" });
    for (let i = 0; i < 30; i++) c.add({ id: `stand-in-${i}`, section: "long", label: `Stand-in row ${i + 1}`, icon: "list", act() {} });
  });

  // Into the made-up headset by a real press on the page.
  await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "look"));
  const enter = page.locator("nswp-hud").getByRole("button", { name: /Enter VR/ }).first();
  await until(() => enter.isVisible(), 10000);
  const box = await enter.boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  check("a real press starts a session in the made-up headset", await until(() => page.evaluate(() => window.__nswpTest.state.xr === "presenting"), 30000), null);
  await page.waitForTimeout(800);

  /** Point a controller at a place in the room, from just below and beside the eyes, as a hand held out does. */
  const aimAt = (side, target) => page.evaluate(([side, target]) => {
    const c = window.__nswpTest.console;
    let top = c.group;
    while (top.parent) top = top.parent;
    let cam = null;
    top.traverse((o) => { if (!cam && o.isPerspectiveCamera && o.parent && o.parent !== top) cam = o; });
    const rig = cam.parent;
    rig.updateMatrixWorld(true);
    const eyes = cam.getWorldPosition(cam.position.clone());
    const from = eyes.clone().set(eyes.x + (side === "right" ? 0.15 : -0.15), eyes.y - 0.25, eyes.z);
    const to = eyes.clone().set(...target);
    const a = rig.worldToLocal(from.clone());
    const b = rig.worldToLocal(to.clone());
    const d = b.clone().sub(a).normalize();
    // The turn that takes "ahead", (0, 0, -1), to d: about their cross product, (d.y, -d.x, 0), by 1 + their dot, 1 - d.z.
    const v = { x: d.y, y: -d.x, z: 0 };
    const w = 1 - d.z;
    const n = Math.hypot(v.x, v.y, v.z, w) || 1;
    const ctl = window.__xr.controllers[side];
    ctl.position.x = a.x; ctl.position.y = a.y; ctl.position.z = a.z;
    ctl.quaternion.x = v.x / n; ctl.quaternion.y = v.y / n; ctl.quaternion.z = v.z / n; ctl.quaternion.w = w / n;
  }, [side, target]);
  const pointed = () => page.evaluate(() => [0, 1].map((s) => window.__nswpTest.pointedAt?.(s) ?? null));
  const trigger = async (side) => {
    await page.evaluate((side) => window.__xr.controllers[side].updateButtonValue("trigger", 1), side);
    await page.waitForTimeout(150);
    await page.evaluate((side) => window.__xr.controllers[side].updateButtonValue("trigger", 0), side);
    await page.waitForTimeout(350);
  };
  const where = (label) => page.evaluate((label) => window.__nswpTest.console.sheet?.whereIs(label) ?? null, label);
  const state = () => page.evaluate(() => window.__nswpTest.console.sheet?.state ?? null);
  const said = () => page.evaluate(() => window.__nswpTest.console.describe());
  /** Where a tab is, pressing the strip's right arrow (as a visitor would) until it is in sight. */
  const tabAt = async (label) => {
    for (let i = 0; i < 8; i++) {
      const at = await where(label);
      if (at) return at;
      const arrow = await where("tabs-right");
      if (!arrow) return null;
      await aimAt("right", arrow);
      await page.waitForTimeout(250);
      await trigger("right");
    }
    return null;
  };
  // Hands held low and out of the way, to begin.
  await page.evaluate(() => { for (const side of ["left", "right"]) { const c = window.__xr.controllers[side]; c.position.y = 0.6; } });

  // ---- Open: the flat menu's sheet, every tab the flat menu has, and the bar under it.
  await page.evaluate(() => window.__nswpTest.console.setOpen(true));
  await until(async () => (await said()).open, 8000);
  await page.waitForTimeout(700);
  const flatTabs = await page.evaluate(() => window.__nswpTest.controls.view().sections.map((s) => s.label));
  const d0 = await said();
  check("open, it is the flat menu's sheet: every tab the flat menu has, in its order", JSON.stringify(d0.sections) === JSON.stringify(flatTabs) && !!(await state()), { headset: d0.sections, flat: flatTabs });
  const parts = await page.evaluate(() => { const g = window.__nswpTest.console.group; const o = (n) => g.getObjectByName(n); return { sheet: !!o("sheet")?.visible, bar: !!o("bar")?.visible, wide: Math.round((o("sheet")?.scale.x ?? 0) * 100) / 100, orders: ["sheet", "bar", "forward"].map((n) => o(n)?.renderOrder) }; });
  check("1.0 m wide, with the bar under it", parts.sheet && parts.bar && parts.wide === 1, parts);
  check("every part of it is drawn before the hands (under 40, input.ts's HANDS_ORDER)", parts.orders.every((x) => typeof x === "number" && x < 40), parts.orders);

  // ---- A tab pointed at comes forward; pressed, it is up.
  const sound = await tabAt("Sound");
  if (sound) await aimAt("right", sound);
  await page.waitForTimeout(400);
  const p1 = await pointed();
  const s1 = await state();
  check("a tab pointed at with a controller is what its ray finds", p1.includes("console:sheet:tab:sound"), p1);
  check("and it has come forward 3.5 cm off the sheet", s1?.forward === "sheet:tab:sound" && Math.abs(s1.lifted - 0.035) < 0.004, s1);
  await page.screenshot({ path: join(SHOTS, "menu-in-headset-sound-pointed.png") });
  await trigger("right");
  check("pressed with the trigger, it is the tab that is up", (await said()).section === "sound", (await said()).section);

  // ---- A row pressed does what it does.
  const before = await page.evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "sound").items.map((i) => i.label));
  const row = before.find((l) => l.startsWith("Effects"));
  const rowAt = row ? await where(row) : null;
  if (rowAt) await aimAt("right", rowAt);
  await page.waitForTimeout(350);
  const p2 = await pointed();
  await trigger("right");
  const after = await page.evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "sound").items.map((i) => i.label));
  check("a row pressed does what it does (Effects changes)", !!row && p2.some((x) => x?.startsWith("console:sheet:act:")) && !after.includes(row), { row, pointed: p2, after: after.filter((l) => l.startsWith("Effects")) });
  await page.screenshot({ path: join(SHOTS, "menu-in-headset-sound-row.png") });

  // ---- A key on the bar pointed at comes forward off the bar.
  const keyWords = await page.evaluate(() => { const v = window.__nswpTest.controls.view(); return v.hotbar[0]?.short || v.hotbar[0]?.label || null; });
  const keyAt = keyWords ? await where(`bar:${keyWords}`) : null;
  if (keyAt) await aimAt("right", keyAt);
  await page.waitForTimeout(400);
  const s3 = await state();
  check("a key on the bar pointed at comes forward off the bar", !!keyAt && (s3?.forward ?? "").startsWith("bar:"), { keyWords, keyAt, state: s3 });

  // ---- A long tab: pointing at it and pushing a stick scrolls it, and doesn't walk or turn the visitor.
  const longAt = await tabAt("Long");
  if (longAt) await aimAt("right", longAt);
  await page.waitForTimeout(300);
  await trigger("right");
  const rowsAt = await where("Stand-in row 4");
  if (rowsAt) await aimAt("right", rowsAt);
  await page.waitForTimeout(300);
  const rigAt = () => page.evaluate(() => { let top = window.__nswpTest.console.group; while (top.parent) top = top.parent; let cam = null; top.traverse((o) => { if (!cam && o.isPerspectiveCamera && o.parent && o.parent !== top) cam = o; }); return [...cam.parent.position.toArray().map((x) => Math.round(x * 1000) / 1000), Math.round(cam.parent.rotation.y * 1000) / 1000]; });
  const rigBefore = await rigAt();
  await page.evaluate(() => window.__xr.controllers.right.updateAxes("thumbstick", 0, 0.9));
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__xr.controllers.right.updateAxes("thumbstick", 0, 0));
  await page.waitForTimeout(200);
  const s4 = await state();
  const rigAfter = await rigAt();
  check("on a long tab, a stick pushed while pointing at it scrolls it", (await said()).section === "long" && (s4?.rowsScroll ?? 0) > 50, { section: (await said()).section, state: s4 });
  check("and doesn't walk or turn the visitor", JSON.stringify(rigBefore) === JSON.stringify(rigAfter), { before: rigBefore, after: rigAfter });
  await page.screenshot({ path: join(SHOTS, "menu-in-headset-long-scrolled.png") });

  // ---- Movement turned down: nothing comes forward; it is lit where it is.
  await page.evaluate(() => window.__nswpTest.controls.setTheme({ motion: false }));
  const look = await tabAt("Display");
  if (look) await aimAt("right", look);
  await page.waitForTimeout(400);
  const s5 = await state();
  check("with movement turned down, nothing comes forward", s5?.forward === "" && (await pointed()).includes("console:sheet:tab:look"), { state: s5, pointed: await pointed() });
  await page.evaluate(() => window.__nswpTest.controls.setTheme({ motion: true }));

  // ---- Close, pressed, puts it away.
  const close = await where("Close");
  if (close) await aimAt("right", close);
  await page.waitForTimeout(400);
  await trigger("right");
  check("Close, pressed, puts it away", (await said()).open === false, await said());
  check("nothing went wrong on the page", errors.length === 0, errors);
  check("nothing was asked of anywhere else", elsewhere.size === 0, [...elsewhere]);
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const total = Object.keys(results).length;
console.log(fail.length ? `\n${fail.length} of ${total} checks failed: ${fail.join("; ")}` : `\nall ${total} checks passed`);
process.exit(fail.length ? 1 : 0);
