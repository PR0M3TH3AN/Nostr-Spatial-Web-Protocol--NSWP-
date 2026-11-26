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
//   - A row to type in asks the kit's keyboard; keys pressed with the trigger send what was typed.
//   - A song's bar pressed three quarters along is moved to there.
//   - In a room, the bar's Chat key brings the chat panel up beside the sheet; its box to write in asks the keyboard,
//     and what is typed is said in the room.
//   - A row that takes a file goes out of VR for a moment (`outOfVr`, "file"): the browser's chooser, a file
//     chosen, handed to the row; then Back into VR, by a real press.
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
    // The kit's TURN service (room.ts, ICE_FROM) is answered here, as it answers a page not of bitblocks.network: no
    // TURN, and the room goes on with STUN. Nothing goes to it.
    if (url.origin === "https://bitblocks-ice.bitunlock.workers.dev") return route.fulfill({ status: 403, contentType: "text/plain", body: "" });
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
  // A long tab, so that there is something to scroll: thirty stand-in rows. And a tab of rows a headset draws its
  // own way: one to type in, a song's bar, one that takes a file. What each is given is kept, to be read back.
  await page.evaluate(() => {
    const c = window.__nswpTest.controls;
    c.addSection({ id: "long", label: "Long" });
    for (let i = 0; i < 30; i++) c.add({ id: `stand-in-${i}`, section: "long", label: `Stand-in row ${i + 1}`, icon: "list", act() {} });
    c.addSection({ id: "kinds", label: "Kinds" });
    c.add(
      { id: "stand-in-field", section: "kinds", kind: "field", label: "Name a star", icon: "note", act(typed) { window.__typed = typed ?? null; } },
      { id: "stand-in-song", section: "kinds", kind: "slider", label: "Night Market", icon: "music", slider: { value: () => 40, max: () => 200, text: () => "0:40 of 3:20" }, act(at) { window.__slid = Number(at); } },
      { id: "stand-in-file", section: "kinds", kind: "file", label: "Hang a picture", icon: "panel", accept: ["image"], act(_typed, file) { window.__file = file ? { name: file.name, size: file.size } : null; } },
    );
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

  // ---- A row to type in: the kit's keyboard asks, and keys pressed with the trigger send what was typed.
  const kinds = await tabAt("Kinds");
  if (kinds) await aimAt("right", kinds);
  await page.waitForTimeout(250);
  await trigger("right");
  const fieldAt = await where("Name a star");
  if (fieldAt) await aimAt("right", fieldAt);
  await page.waitForTimeout(300);
  await trigger("right");
  const kb = await page.evaluate(() => window.__nswpTest.panels.keyboard.info());
  check("a row to type in, pressed, brings up the kit's keyboard, saying what it is for", kb.open && kb.title.includes("Name a star"), { open: kb.open, title: kb.title });
  for (const key of ["kb:h", "kb:i", "kb:enter"]) {
    const at = await page.evaluate((key) => window.__nswpTest.panels.keyboard.pointOf(key)?.toArray() ?? null, key);
    if (at) await aimAt("right", at);
    await page.waitForTimeout(200);
    await trigger("right");
  }
  // The kit's keyboard begins a sentence with a capital, as a phone's does: "h", "i" is "Hi".
  check("and what is typed on it, pressed key by key with the trigger, is what the row is given", (await page.evaluate(() => window.__typed)) === "Hi", await page.evaluate(() => window.__typed ?? null));

  // ---- A song's bar, pressed three quarters along.
  const songAt = await where("Night Market@0.75");
  if (songAt) await aimAt("right", songAt);
  await page.waitForTimeout(300);
  await trigger("right");
  const slid = await page.evaluate(() => window.__slid ?? null);
  check("a song's bar pressed three quarters along is moved to there (150 of 200)", typeof slid === "number" && Math.abs(slid - 150) <= 8, { slid, songAt, section: (await said()).section, pointed: await pointed(), keyboard: (await page.evaluate(() => window.__nswpTest.panels.keyboard.info())).open });
  await page.screenshot({ path: join(SHOTS, "menu-in-headset-kinds.png") });

  // ---- In a room: the bar's Chat key brings the chat panel up beside the sheet, and its box asks the keyboard.
  await page.evaluate(() => window.__nswpTest.controls.run("room-join"));
  await until(() => page.evaluate(() => window.__nswpTest.controls.view().chat.ready), 15000);
  await page.waitForTimeout(600);
  const chatKey = await where("bar:Chat");
  if (chatKey) await aimAt("right", chatKey);
  await page.waitForTimeout(300);
  await trigger("right");
  const sc = await state();
  const panelAt = await page.evaluate(() => { const g = window.__nswpTest.console.group; const c = g.getObjectByName("chat"); const s = g.getObjectByName("sheet"); return c && s ? { shown: c.visible, right: c.position.x > s.position.x + s.scale.x / 2, wide: Math.round(c.scale.x * 1000) / 1000 } : null; });
  check("in a room, the bar's Chat key brings the chat panel up, beside the sheet on its right", !!chatKey && sc?.chat === "room" && !!panelAt?.shown && panelAt.right, { chatKey, state: sc, panelAt, ready: await page.evaluate(() => window.__nswpTest.controls.view().chat.ready), room: await page.evaluate(() => window.__nswpTest.state.room ?? null), hotbar: await page.evaluate(() => window.__nswpTest.controls.view().hotbar.map((h) => h.short || h.label)) });
  const writeAt = await where("chat:write");
  if (writeAt) await aimAt("right", writeAt);
  await page.waitForTimeout(300);
  await trigger("right");
  const kb2 = await page.evaluate(() => window.__nswpTest.panels.keyboard.info());
  for (const key of ["kb:y", "kb:o", "kb:enter"]) {
    const at = await page.evaluate((key) => window.__nswpTest.panels.keyboard.pointOf(key)?.toArray() ?? null, key);
    if (at) await aimAt("right", at);
    await page.waitForTimeout(200);
    await trigger("right");
  }
  await page.waitForTimeout(400);
  const lines = await page.evaluate(() => window.__nswpTest.controls.view().chat.lines.map((l) => ({ text: l.text, mine: l.mine })));
  check("its box to write in asks the keyboard, and what is typed is said in the room", kb2.open && kb2.title.startsWith("Write to the room") && lines.some((l) => l.mine && l.text === "Yo"), { title: kb2.title, lines });
  await page.screenshot({ path: join(SHOTS, "menu-in-headset-chat.png") });

  // ---- Close, pressed, puts it away.
  const close = await where("Close");
  if (close) await aimAt("right", close);
  await page.waitForTimeout(400);
  await trigger("right");
  check("Close, pressed, puts it away", (await said()).open === false, await said());
  // ---- A row that takes a file: out of VR for a moment, the browser's chooser, and back.
  await page.evaluate(() => window.__nswpTest.console.setOpen(true));
  await until(async () => (await said()).open, 8000);
  await page.waitForTimeout(500);
  const kinds2 = await tabAt("Kinds");
  if (kinds2) await aimAt("right", kinds2);
  await page.waitForTimeout(250);
  await trigger("right");
  const fileAt = await where("Hang a picture");
  if (fileAt) await aimAt("right", fileAt);
  await page.waitForTimeout(300);
  const chooser = page.waitForEvent("filechooser", { timeout: 8000 }).catch(() => null);
  await trigger("right");
  const fc = await chooser;
  await until(async () => !(await page.evaluate(() => window.__nswpTest.state.xr === "presenting")), 8000);
  check("a row that takes a file goes out of VR for a moment, with the browser's chooser up", !!fc && !(await page.evaluate(() => window.__nswpTest.state.xr === "presenting")), { chooser: !!fc, xr: await page.evaluate(() => window.__nswpTest.state.xr) });
  // A small picture of four pixels, made here: the chooser hands it to the row.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGNk+M/AwMDAxMDAwMAAAA4OAQcR3yTnAAAAAElFTkSuQmCC", "base64");
  if (fc) await fc.setFiles({ name: "star.png", mimeType: "image/png", buffer: png });
  await page.waitForTimeout(500);
  check("the file chosen is handed to the row", (await page.evaluate(() => window.__file?.name ?? null)) === "star.png", await page.evaluate(() => window.__file ?? null));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const backReady = await until(() => page.evaluate(() => { const b = document.getElementById("nswp-enter-vr"); return b && !b.disabled && b.textContent === "Back into VR" ? true : null; }), 8000);
  const back = await page.locator("#nswp-enter-vr").boundingBox().catch(() => null);
  if (backReady && back) await page.mouse.click(back.x + back.width / 2, back.y + back.height / 2);
  check("then Back into VR, by a real press, goes back in", !!backReady && !!(await until(() => page.evaluate(() => window.__nswpTest.state.xr === "presenting"), 15000)), { backReady });
  check("nothing went wrong on the page", errors.length === 0, errors);
  check("nothing was asked of anywhere else", elsewhere.size === 0, [...elsewhere]);
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const total = Object.keys(results).length;
console.log(fail.length ? `\n${fail.length} of ${total} checks failed: ${fail.join("; ")}` : `\nall ${total} checks passed`);
process.exit(fail.length ? 1 : 0);
