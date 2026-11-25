// The client's panel over a world that holds the pointer (the owner, 2026-11-24, of kit 0.87.0: "the bitlogin
// panels force me to hit escape again to use. The game just playes behind them when im trying to use the menus. But
// when i hit escape the game exits full screen."). Found on demand by BitPortal in its real shell with BitLogin's
// real panel; this is the same five steps with a stand-in client, so that the kit can be held to it.
//
// A world whose visitor moves the intense way holds the pointer. Its menu comes up (the pointer is let go), a row
// asks for the sign-in address's panel, the client draws the panel over the world and says so. The world's menu
// steps aside for it. What must be so then, with no Escape pressed: the world does not hold the pointer; a press at
// the panel's place reaches the panel and not the world; the visitor does not walk or turn. With the panel away,
// one press on the view and the pointer is the world's again. And the same where the panel comes up with the menu
// down and the pointer held.
//
// What is real: this checkout's own build of the Gallery (`npm run build` first), its own menu, its own mouse-look,
// a real mouse and real keys, and the words between a world and its client (`sign-in`, client-frame.ts). What is a
// stand-in: the client (a page that frames the world and draws a box for the panel), the sites' names, and the
// asking itself: the trial's own row says the world's word for "show the panel", since the sign-in address is
// refused here and the kit's own rows for it never come up. Everything after that word is the kit's.
//
// What it can't show: full screen (a scripted browser here has none to leave), and BitLogin's real panel.
// Nothing leaves this machine: every request and every WebSocket is answered here.
//
//   npm run build && node trials/panel-pointer.mjs
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const CLIENT = "https://client.test";
const WORLD = "https://gallery.test";
const DIST = join(NSWP, "sites", "gallery", "dist");
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
const ALLOW = "xr-spatial-tracking *; microphone *; autoplay *; gamepad *; clipboard-write *; fullscreen *";

// The client: the world in a frame, and a panel it draws over the world when the world asks, or when told to by
// this script (a panel the client brings up by itself). It says the panel's coming and going down, as a client does.
const above = `<!doctype html><meta charset="utf-8"><title>a client with a panel</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;display:block}
#panel{position:fixed;left:50%;top:50%;width:420px;height:440px;margin:-220px 0 0 -210px;background:#f4f1ea;color:#111;border-radius:14px;font:16px system-ui;display:grid;place-items:center}
#panel[hidden]{display:none}#panel button{font:inherit;padding:10px 18px}</style>
<iframe id="view" src="${WORLD}/" allow="${ALLOW}"></iframe>
<div id="panel" hidden><p>The sign-in address's panel (a stand-in)</p><button id="shut" type="button">Close the panel</button></div>
<script>
const view = document.getElementById("view");
const panel = document.getElementById("panel");
window.__panel = { up: false, asked: [], presses: 0, keys: 0 };
const say = (word) => view.contentWindow.postMessage(word, ${JSON.stringify(WORLD)});
// Opened with #has, this client has the menu (it draws none: it is only here to say the words a client says).
window.__menu = (open) => say({ nswp: "menu", open });
window.__show = () => { panel.hidden = false; window.__panel.up = true; say({ nswp: "sign-in", open: true }); };
window.__shut = () => { panel.hidden = true; window.__panel.up = false; say({ nswp: "sign-in", open: false }); view.focus(); };
addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || !e.data || typeof e.data !== "object") return;
  if (e.data.nswp === "here" && location.hash === "#has") say({ nswp: "menu", has: true, v: 1, settings: {} });
  if (e.data.nswp === "sign-in" && typeof e.data.mode === "string") { window.__panel.asked.push(e.data.mode); window.__show(); }
});
panel.addEventListener("pointerdown", () => window.__panel.presses++);
addEventListener("keydown", () => window.__panel.keys++);
document.getElementById("shut").addEventListener("click", () => window.__shut());
</script>`;

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
const asked = new Set();
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => { asked.add(new URL(ws.url()).host); ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }); });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === CLIENT) return route.fulfill({ status: 200, contentType: TYPES[".html"], body: above });
    if (url.origin !== WORLD) return route.abort();
    const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(100); } };
  await page.goto(`${CLIENT}/`, { timeout: 60000 });
  const world = () => page.frames().find((f) => f.url().startsWith(WORLD));
  await until(() => world()?.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
  // The world's own menu: this client says nothing of having one.
  check("the world draws its own menu under this client", !!(await until(() => world().evaluate(() => document.querySelectorAll("nswp-hud").length === 1), 10000)));

  // Whatever is seen is said, though a step throws: a world that walks out of its own page under the panel (through
  // a door, with W held) takes the page this script is asking away, and that is a result and not a crash.
  try {
  // ---- What the world's page is asked, each in one go.
  /** Where the visitor is and which way they face, and who holds the pointer and whether the menu is up. */
  const now = () => world().evaluate(() => {
    const t = window.__nswpTest;
    let top = t.console.group;
    while (top.parent) top = top.parent;
    let camera = null;
    top.traverse((o) => { if (!camera && o.isPerspectiveCamera && o.parent && o.parent !== top) camera = o; });
    const rig = camera.parent;
    const r = (n) => Math.round(n * 1000) / 1000;
    return { at: [r(rig.position.x), r(rig.position.z)], facing: [r(rig.rotation.y), r(camera.rotation.x)], holdsPointer: document.pointerLockElement !== null, menuUp: t.hud.open === true, intense: t.fps.enabled === true, presses: window.__presses ?? 0 };
  });
  const client = () => page.evaluate(() => ({ ...window.__panel }));
  // Presses the world's view hears, counted in the world's own page.
  await world().evaluate(() => { window.__presses = 0; document.querySelector("canvas").addEventListener("mousedown", () => window.__presses++, true); });
  // The row that asks for the panel: the world's word for it, said from the visitor's press on a row of the world's.
  await world().evaluate(() => { window.__nswpTest.controls.add({ id: "trial-panel", section: "room", label: "Sign in (asks its client for the panel)", act: () => parent.postMessage({ nswp: "sign-in", mode: "ask" }, "*") }); });
  const hud = page.frameLocator("#view").locator("nswp-hud");
  const pressOnView = async () => { await page.mouse.click(180, 330); };
  const same = (a, b) => JSON.stringify([a.at, a.facing]) === JSON.stringify([b.at, b.facing]);
  /** W held and the mouse moved across the view, for most of a second. */
  const walkAndLook = async () => {
    await page.keyboard.down("w");
    for (let i = 0; i < 6; i++) { await page.mouse.move(150 + i * 25, 320 + (i % 2) * 12); await page.waitForTimeout(110); }
    await page.keyboard.up("w");
    await page.waitForTimeout(150);
  };

  // 1. Desk controls set to intense; a press on the view, and the world holds the pointer.
  await world().evaluate(() => window.__nswpTest.fps.setEnabled(true));
  await page.waitForTimeout(400);
  await pressOnView();
  check("1. moving the intense way, a press on the view gives the world the pointer", !!(await until(async () => (await now()).holdsPointer, 5000)), await now());
  const began = await now();
  await walkAndLook();
  const walked = await now();
  check("and with it the visitor walks and looks round: the trial's keys and mouse do move them", !same(began, walked), { began, walked });

  // 2. M: the world's menu opens, and the pointer is let go.
  await page.keyboard.press("m");
  check("2. M brings the world's menu up, and the pointer is let go", !!(await until(async () => { const n = await now(); return n.menuUp && !n.holdsPointer ? n : null; }, 5000)), await now());
  await world().evaluate(() => window.__nswpTest.hud.setOpen(true, "room"));
  const row = hud.getByRole("button", { name: /asks its client for the panel/ }).first();
  await until(() => row.isVisible(), 8000);
  await row.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(700);
  // The row pressed with the mouse, where it is.
  {
    const at = await row.boundingBox();
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
  }

  // 3. A moment later: the panel is up, the world's menu has stepped aside, and the world does NOT hold the pointer.
  check("3. the client was asked for the panel at that press, and drew it", !!(await until(async () => (await client()).up, 5000)), await client());
  await page.waitForTimeout(1500);
  const under = await now();
  check("the world's menu stepped aside for the panel", under.menuUp === false, under);
  check("with the panel up and no Escape pressed, the world does not hold the pointer", under.holdsPointer === false, under);
  await page.screenshot({ path: join(SHOTS, "panel-pointer-1-the-panel-up.png") });

  // 5 (before 4, while the keys are still wherever they were left): W held and the mouse moved over the view.
  await walkAndLook();
  const after = await now();
  check("5. with the panel up, W held and the mouse moved over the view: the visitor has not walked or turned", same(under, after), { before: { at: under.at, facing: under.facing }, after: { at: after.at, facing: after.facing } });

  // 4. A press at the panel's middle: heard by the panel, and not by the world.
  const beforePress = { panel: (await client()).presses, world: (await now()).presses };
  await page.mouse.click(550, 300);
  await page.waitForTimeout(300);
  const afterPress = { panel: (await client()).presses, world: (await now()).presses, holdsPointer: (await now()).holdsPointer };
  check("4. a press at the panel's middle is heard by the panel", afterPress.panel === beforePress.panel + 1, { beforePress, afterPress });
  check("and not by the world, which still does not hold the pointer", afterPress.world === beforePress.world && afterPress.holdsPointer === false, { beforePress, afterPress });
  // And a press on what shows of the view beside the panel is not a press in the world, and takes no pointer.
  await pressOnView();
  await page.waitForTimeout(400);
  const beside = await now();
  check("a press on the view beside the panel takes no pointer either, while the panel is up", beside.holdsPointer === false && (await client()).up, beside);
  await walkAndLook();
  check("and still nobody walks or turns", same(under, await now()), { before: under, after: await now() });

  // The panel away, by its own Close, pressed with the mouse.
  {
    const shut = page.locator("#shut");
    const at = await shut.boundingBox();
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
  }
  check("the panel goes at its own Close, and the menu that stepped aside comes back", !!(await until(async () => { const n = await now(); return !(await client()).up && n.menuUp ? n : null; }, 5000)), { client: await client(), world: await now() });
  // The menu put away by the visitor (a press on the view outside its sheet), then one press on the view.
  await world().evaluate(() => window.__nswpTest.hud.setOpen(false));
  await page.waitForTimeout(500);
  if (!(await now()).holdsPointer) await pressOnView();
  check("with the panel away and the menu down, one press on the view and the pointer is the world's again", !!(await until(async () => (await now()).holdsPointer, 5000)), await now());
  const back = await now();
  await walkAndLook();
  check("and the visitor walks and looks round again", !same(back, await now()), { back, now: await now() });

  // ---- The panel comes up with the menu down and the pointer held: a thing of the world's own asked for it, or
  // the client brought it up by itself.
  check("(the world holds the pointer, its menu down)", (await now()).holdsPointer && !(await now()).menuUp, await now());
  await page.keyboard.down("w");
  await page.waitForTimeout(200);
  await world().evaluate(() => parent.postMessage({ nswp: "sign-in", mode: "ask" }, "*"));
  check("asked for with the menu down and the pointer held, the panel comes up and the world lets the pointer go", !!(await until(async () => { const n = await now(); return (await client()).up && !n.holdsPointer ? n : null; }, 5000)), { client: await client(), world: await now() });
  await page.waitForTimeout(300);
  const stopped = await now();
  for (let i = 0; i < 5; i++) { await page.mouse.move(200 + i * 30, 330); await page.waitForTimeout(110); }
  await page.waitForTimeout(300);
  check("and the key that was held is let go with it: W still down, the visitor stands still and does not turn", same(stopped, await now()), { stopped, now: await now() });
  await page.keyboard.up("w");
  check("the world's menu did not come up for the pointer being let go: the panel is what the visitor has", (await now()).menuUp === false, await now());
  await page.evaluate(() => window.__shut());
  await page.waitForTimeout(400);
  await pressOnView();
  check("the panel away again, one press on the view and the pointer is the world's", !!(await until(async () => (await now()).holdsPointer, 5000)), await now());

  // A browser that tells twice that the pointer was let go, with nothing between (seen on a quiet machine): the
  // second is no Escape of the visitor's, and brings no menu up. Said here by the page itself, with the pointer
  // already let go and the menu down. For this the pointer is never given back (asking for it does nothing), so
  // that putting the menu away leaves it free; the real asking is put back after.
  {
    await world().evaluate(() => { window.__realLock = Element.prototype.requestPointerLock; Element.prototype.requestPointerLock = function () { return Promise.resolve(); }; });
    await page.keyboard.press("m");
    await until(async () => { const n = await now(); return n.menuUp && !n.holdsPointer; }, 5000);
    await page.keyboard.press("m");
    await until(async () => !(await now()).menuUp, 3000);
    await page.waitForTimeout(300);
    const before = await now();
    await world().evaluate(() => document.dispatchEvent(new Event("pointerlockchange")));
    await page.waitForTimeout(300);
    const after = await now();
    check("a browser telling again that the pointer was let go, with nothing changed, brings no menu up", before.menuUp === false && before.holdsPointer === false && after.menuUp === false, { before, after });
    await world().evaluate(() => { Element.prototype.requestPointerLock = window.__realLock; });
    // The pointer back with the world, as the round after expects it.
    await pressOnView();
    await until(async () => (await now()).holdsPointer, 5000);
  }

  // The same slowness with the world's own menu, and no panel at all: the menu is put away, which asks for the
  // pointer, and brought up again before the browser has given it. A pointer given with the menu up is let go at
  // once. Every asking is held back 150 ms from here on; this is the last thing this page is asked.
  await world().evaluate((ms) => {
    const real = Element.prototype.requestPointerLock;
    window.__lockGiven = 0;
    window.addEventListener("pointerlockchange", () => { if (document.pointerLockElement) window.__lockGiven++; }, true);
    Element.prototype.requestPointerLock = function (...a) { return new Promise((r) => setTimeout(r, ms)).then(() => real.apply(this, a)); };
  }, 150);
  await page.keyboard.press("m");
  await until(async () => { const n = await now(); return n.menuUp && !n.holdsPointer; }, 5000);
  await page.keyboard.press("m");
  await page.waitForTimeout(40);
  await page.keyboard.press("m");
  await page.waitForTimeout(900);
  const slowMenu = { ...(await now()), given: await world().evaluate(() => window.__lockGiven) };
  check("the world's own menu put away and brought up again before a slow browser gave the pointer: the pointer was given with the menu up, so this tries it", slowMenu.menuUp === true && slowMenu.given >= 1, slowMenu);
  check("and the world does not hold the pointer under its own menu", slowMenu.holdsPointer === false, slowMenu);

  } catch (e) {
    check("the trial ran to its end", false, { why: String(e).slice(0, 240), worldStillThere: !!world(), frames: page.frames().map((f) => f.url().slice(0, 60)) });
  }
  // ---- A client that has the menu (BitPortal's shell with its own menu on; found by its second look, 2026-11-24).
  // The client's own row brings the panel up: its sheet goes away and the panel comes, so the world is told both
  // that the menu has gone and that the panel is up, and the two may reach it in either order. If "the menu has
  // gone" comes first, the world has taken the pointer back by the time it hears of the panel, and must let go then.
  try {
    const second = await ctx.newPage();
    await second.goto(`${CLIENT}/#has`, { timeout: 60000 });
    const w2 = () => second.frames().find((f) => f.url().startsWith(WORLD));
    const wait2 = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await second.waitForTimeout(100); } };
    await wait2(() => w2()?.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
    const here = () => w2().evaluate(() => {
      const t = window.__nswpTest;
      let top = t.console.group;
      while (top.parent) top = top.parent;
      let camera = null;
      top.traverse((o) => { if (!camera && o.isPerspectiveCamera && o.parent && o.parent !== top) camera = o; });
      const rig = camera.parent;
      const r = (n) => Math.round(n * 1000) / 1000;
      return { at: [r(rig.position.x), r(rig.position.z)], facing: [r(rig.rotation.y), r(camera.rotation.x)], holdsPointer: document.pointerLockElement !== null, ownMenus: document.querySelectorAll("nswp-hud").length };
    });
    const sameHere = (a, b) => JSON.stringify([a.at, a.facing]) === JSON.stringify([b.at, b.facing]);
    const move = async () => {
      await second.keyboard.down("w");
      for (let i = 0; i < 6; i++) { await second.mouse.move(150 + i * 25, 320 + (i % 2) * 12); await second.waitForTimeout(110); }
      await second.keyboard.up("w");
      await second.waitForTimeout(150);
    };
    check("under a client that has the menu, the world draws none of its own", (await here()).ownMenus === 0, await here());
    await w2().evaluate(() => window.__nswpTest.fps.setEnabled(true));
    await second.waitForTimeout(400);
    // The third time round the browser is made slow to give the pointer, on purpose (found 2026-11-24 on a loaded
    // machine, one run in five). The menu's going makes the world ask for the pointer; the panel is said up before
    // the browser has given it, when there is nothing yet to let go; the browser then gives it. A pointer given
    // with the panel up must be let go at once. Here every asking for the pointer is held back 150 ms, and the
    // panel is said 30 ms after the menu's going, so the pointer is always given with the panel already up.
    for (const [order, first, then, slow] of [["the menu's going said first, then the panel", "menu", "panel", 0], ["the panel said first, then the menu's going", "panel", "menu", 0], ["the menu's going said first, then the panel, and the browser slow to give the pointer", "menu", "panel", 150]]) {
      if (slow) {
        await w2().evaluate((ms) => {
          const real = Element.prototype.requestPointerLock;
          window.__lockAsked = 0;
          window.__lockGiven = 0;
          // Counted on the way down to the document, before the kit's own listener: the mended kit lets the pointer go in that listener.
          window.addEventListener("pointerlockchange", () => { if (document.pointerLockElement) window.__lockGiven++; }, true);
          Element.prototype.requestPointerLock = function (...a) { window.__lockAsked++; return new Promise((r) => setTimeout(r, ms)).then(() => real.apply(this, a)); };
        }, slow);
      }
      // The world holds the pointer; the client's menu comes up, and the world lets go.
      await second.mouse.click(180, 330);
      const held = await wait2(async () => (await here()).holdsPointer, 5000);
      await second.evaluate(() => window.__menu(true));
      const let1 = await wait2(async () => !(await here()).holdsPointer, 5000);
      check(`a client's menu, ${order}: the world held the pointer, and let it go as the client's menu came up`, !!held && !!let1, await here());
      // The client's own row is pressed: its sheet goes and its panel comes, said in this order, a moment apart.
      await second.evaluate(([first, then]) => new Promise((done) => { const say = (what) => (what === "menu" ? window.__menu(false) : window.__show()); say(first); setTimeout(() => { say(then); done(); }, 30); }), [first, then]);
      await second.waitForTimeout(1200);
      const under2 = await here();
      // The slow round shows nothing unless the pointer was in truth asked for at the menu's going and given after
      // the panel came up: twice asked (the press, the menu's going) and twice given.
      if (slow) { const n = await w2().evaluate(() => [window.__lockAsked, window.__lockGiven]); check(`a client's menu, ${order}: the pointer was asked for as the menu went and given after the panel was up, so this round tries it`, n[0] >= 2 && n[1] >= 2, n); }
      check(`a client's menu, ${order}: with the panel up the world does not hold the pointer`, under2.holdsPointer === false, under2);
      await move();
      check(`a client's menu, ${order}: and the visitor does not walk or turn`, sameHere(under2, await here()), { before: under2, after: await here() });
      await second.evaluate(() => window.__shut());
      await second.waitForTimeout(500);
    }
    await second.close();
  } catch (e) {
    check("the second part, under a client that has the menu, ran to its end", false, String(e).slice(0, 240));
  }
  // Full screen: said, not tried.
  results["full screen"] = "not tried: a scripted browser here has no full screen to leave. Nothing in this trial pressed Escape, which is what ended it.";
  check("nothing went wrong on the page", errors.length === 0, errors);
  results["relays asked for, and answered here with nothing"] = [...asked];
  await ctx.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length} of ${Object.values(results).filter((r) => r === "ok" || r?.failed !== undefined).length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
