// A framed world steps its menu aside for a client that has it (docs/plans/the-clients-menu.md, step 1; the words are
// protocol/02-doors.md, "The client has the menu"). This tries the world's end only, against a stand-in client that
// draws nothing: it answers the world's `here`, keeps what the world says, and says a few words back.
//
// What is real: this checkout's own build of the Gallery (sites/gallery/dist, so run `npm run build` first), in a
// real Chrome, in a frame of a page on another site, as a client's is. What is a stand-in: the page above (it has no
// menu, only the words); both sites' names, which are served by this script; and the Gallery's own rules about who
// may frame it, which are left off so that this page may. Nothing is fetched from anywhere else, and nothing is
// published or signed.
//
// Three clients are tried, each on a freshly loaded page:
//   "has":   answers `here` at once with `has: true`.
//   "never": says nothing. A client that doesn't know the words, or isn't one.
//   "late":  answers with `has: true` 900 ms after `here`, long after the world stopped waiting (300 ms).
//
// This is not a trial about presses: the words a client says down are words, not presses, so the script reads the
// world's page directly. A press on the page above reaching a world is trials/presses-from-above.mjs.
//
//   npm run build && node trials/menu-above.mjs
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const CLIENT = "https://client.test";
const WORLD = "https://gallery.test";
const DIST = join(NSWP, "sites", "gallery", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".txt": "text/plain" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");

// The page above: it frames the world, answers as its address says, and writes every word it hears to its console.
const clientPage = `<!doctype html><meta charset="utf-8"><title>stand-in client</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>
<iframe id="view" src="${WORLD}/" allow="xr-spatial-tracking *; microphone *; autoplay *; gamepad *; clipboard-write *; fullscreen 'none'"></iframe>
<script>
const mode = location.hash.slice(1);
const view = document.getElementById("view");
const say = (word) => view.contentWindow.postMessage({ nswp: "menu", ...word }, ${JSON.stringify(WORLD)});
window.say = say;
window.heard = [];
addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || !e.data || typeof e.data !== "object") return;
  window.heard.push({ from: e.origin, word: e.data });
  if (e.data.nswp !== "here") return;
  const answer = () => say({ has: true, v: 1, settings: { text: 1.3 } });
  if (mode === "has") answer();
  if (mode === "late") setTimeout(answer, 900);
});
</script>`;

// Wait for something to be so, up to a few seconds: a world drawing in a browser with no graphics card is slow to
// get to its keys and its words, so nothing here is read after a fixed pause.
const until = async (page, ask, ms = 10000) => {
  const end = Date.now() + ms;
  for (;;) {
    const got = await ask().catch(() => null);
    if (got || Date.now() > end) return got;
    await page.waitForTimeout(100);
  }
};

const browser = await pw.chromium.launch({ channel: "chrome", headless: true });
const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got };
  if (!ok) fail.push(name);
};

async function visit(mode) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  const fetched = [];
  const refused = new Set();
  const sockets = new Set();
  // No relay is reached: every WebSocket is answered here, with nothing, and its address kept to be listed.
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
    if (url.origin === CLIENT) return route.fulfill({ status: 200, contentType: TYPES[".html"], body: clientPage });
    if (url.origin === WORLD) {
      fetched.push(url.pathname);
      const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
      if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
      return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
    }
    refused.add(url.origin);
    return route.abort();
  });
  const page = await ctx.newPage();
  await page.goto(`${CLIENT}/#${mode}`, { timeout: 60000 });
  const world = () => page.frames().find((f) => f.url().startsWith(WORLD));
  // The world is up when its own test hook says so.
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const f = world();
    if (f && (await f.evaluate(() => window.__nswpTest?.state?.ready === true).catch(() => false))) break;
    await page.waitForTimeout(250);
  }
  // Long enough for a late answer (900 ms after `here`) to have come, and for the world to have acted on whatever it heard.
  await page.waitForTimeout(1500);
  await until(page, () => world().evaluate((want) => (window.__nswpTest?.menuAbove?.() === true ? document.querySelectorAll("nswp-hud").length === 0 : document.querySelectorAll("nswp-hud").length === 1), mode));
  const heard = await page.evaluate(() => window.heard);
  const inWorld = await world().evaluate(() => ({
    menus: document.querySelectorAll("nswp-hud").length,
    menuAbove: window.__nswpTest?.menuAbove?.() ?? null,
    scale: window.__nswpTest?.controls?.theme?.scale ?? null,
  }));
  return { ctx, page, world, heard, inWorld, fetchedMenu: fetched.some((p) => /\/chunks\/menu-.*\.js$/.test(p)), refused: [...refused], sockets: [...sockets] };
}

try {
  // ---- A client that has the menu.
  {
    const v = await visit("has");
    const here = v.heard.find((h) => h.word.nswp === "here");
    const worlds = v.heard.filter((h) => h.word.nswp === "menu" && h.word.world).map((h) => h.word.world);
    check("has/the world says in its here that it speaks the words", here?.word.menu === 1 && here.from === WORLD, here);
    check("has/the world says here once", v.heard.filter((h) => h.word.nswp === "here").length === 1, v.heard.filter((h) => h.word.nswp === "here").length);
    check("has/the world draws no menu", v.inWorld.menus === 0 && v.inWorld.menuAbove === true, v.inWorld);
    check("has/the world never fetches the menu", v.fetchedMenu === false, v.fetchedMenu);
    check("has/the world describes itself", worlds.length >= 1 && worlds.at(-1).title.length > 0 && worlds.at(-1).sections.length > 0, worlds.at(-1));
    const last = worlds.at(-1) ?? { sections: [] };
    const tabs = last.sections.map((s) => s.id);
    const own = ["you", "figure", "bag", "wallet", "files", "moving", "sound", "look", "help"];
    check("has/nothing of the visitor's own tabs is said upward", !tabs.some((t) => own.includes(t)), tabs);
    const travel = last.sections.find((s) => s.id === "travel");
    check("has/the way home is not the world's to describe", !travel || !travel.rows.some((r) => ["home", "go-home", "back", "doors", "list"].includes(r.id)), travel?.rows.map((r) => r.id));
    check("has/the visitor's settings came down with the answer", v.inWorld.scale === 1.3, v.inWorld.scale);
    results["has/what it described"] = { title: last.title, level: last.level, tabs: last.sections.map((s) => `${s.id} (${s.rows.length})`), bytes: JSON.stringify(last).length };

    // A setting changed in the client's menu, and the menu coming up and going.
    await v.page.evaluate(() => window.say({ settings: { text: 1 } }));
    check("has/a setting changed above is taken", await until(v.page, () => v.world().evaluate(() => window.__nswpTest.controls.theme.scale === 1)), null);
    await v.page.evaluate(() => window.say({ open: true }));
    check("has/the world knows the menu is up", await until(v.page, () => v.world().evaluate(() => window.__nswpTest.hud.open === true)), null);
    await v.page.evaluate(() => window.say({ open: false }));
    check("has/and that it went", await until(v.page, () => v.world().evaluate(() => window.__nswpTest.hud.open === false)), null);

    // The summons, pressed with the world holding the keys, goes upward by name.
    await v.page.mouse.click(550, 400);
    for (const key of ["Backquote", "KeyM", "Digit3", "KeyW", "Escape"]) await v.page.keyboard.press(key);
    const keysHeard = () => v.page.evaluate(() => window.heard.filter((h) => h.word.nswp === "menu" && h.word.key).map((h) => h.word.key));
    await until(v.page, async () => (await keysHeard()).length >= 4);
    await v.page.waitForTimeout(500);
    const keys = await keysHeard();
    check("has/the visitor's few keys go upward by name, and no other key does", JSON.stringify(keys) === JSON.stringify(["summon", "menu", "3", "escape"]), keys);

    // A press on something the world didn't describe does nothing; the client stopping brings the world's own menu back.
    await v.page.evaluate(() => window.say({ press: "home" }));
    await v.page.waitForTimeout(300);
    check("has/a press on what it didn't describe goes nowhere", v.world() && v.world().url().startsWith(WORLD), v.world()?.url());
    await v.page.evaluate(() => window.say({ has: false }));
    check("has/when the client stops, the world's own menu comes up", await until(v.page, () => v.world().evaluate(() => document.querySelectorAll("nswp-hud").length === 1)), null);
    // The Gallery reaches for its sign-in address, as it does anywhere. Refused here, like everything but the two sites.
    results["has/refused, as everything but the two sites is"] = v.refused;
    results["has/relays asked for, and answered here with nothing"] = v.sockets;
    await v.ctx.close();
  }

  // ---- No client says anything.
  {
    const v = await visit("never");
    check("never/the world draws its own menu", v.inWorld.menus === 1 && v.inWorld.menuAbove === false, v.inWorld);
    check("never/and fetched it", v.fetchedMenu === true, v.fetchedMenu);
    check("never/it describes itself to nobody", v.heard.filter((h) => h.word.nswp === "menu").length === 0, v.heard.filter((h) => h.word.nswp === "menu").length);
    await v.ctx.close();
  }

  // ---- A client that answers late.
  {
    const v = await visit("late");
    check("late/the world's own menu is put away: one menu, never two", v.inWorld.menus === 0 && v.inWorld.menuAbove === true, v.inWorld);
    check("late/and it describes itself from then on", v.heard.some((h) => h.word.nswp === "menu" && h.word.world), null);
    await v.ctx.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length} of ${Object.keys(results).length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
