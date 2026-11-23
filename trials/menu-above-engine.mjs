// A world made with another engine steps its menu aside for a client that has it (docs/plans/the-clients-menu.md,
// step 1; protocol/02-doors.md, "The client has the menu"). The engine script's end of what trials/menu-above.mjs
// tries for a Three.js world.
//
// What is real: this checkout's own engine script (engines/nswp-engine.js, so run `npm run build:engine` first), in
// a real Chrome, on a page in a frame of a page on another site. What is a stand-in: the engine (a bare page that
// loads only the script; this trial calls what an engine would, `NSWP.menu(...)`), the page above (it has no menu,
// only the words), and both sites' names, served by this script. Every other request is refused and listed, and
// every WebSocket is answered here with nothing.
//
// Three clients, each on a freshly loaded page: "has" answers `here` at once, "never" says nothing, "late" answers
// 900 ms after `here`. The engine script's menu is in its one file, so there is no fetch for an answer to land in.
//
// This is not a trial about presses, so the script reads the world's page directly.
//
//   npm run build:engine && node trials/menu-above-engine.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT as NSWP } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const CLIENT = "https://client.test";
const WORLD = "https://hall.test";
const ENGINE = join(NSWP, "engines", "nswp-engine.js");
if (!existsSync(ENGINE)) throw new Error("Build the engine script first: npm run build:engine");
const engineJs = readFileSync(ENGINE, "utf8");
const worldPage = `<!doctype html><html><head><meta charset="utf-8"><title>A bare page</title><meta name="nswp:title" content="The Bare Hall"><meta name="nswp:accent" content="#7bd88f"><script src="nswp-engine.js"></script></head><body style="margin:0;background:#111"></body></html>`;
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

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};
const browser = await pw.chromium.launch({ channel: "chrome", headless: true });

async function visit(mode) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  const refused = new Set();
  const sockets = new Set();
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
    if (url.origin === CLIENT) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: clientPage });
    if (url.origin === WORLD) return url.pathname === "/nswp-engine.js" ? route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body: engineJs }) : url.pathname === "/" ? route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: worldPage }) : route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    refused.add(url.origin);
    return route.abort();
  });
  const page = await ctx.newPage();
  const until = async (ask, ms = 15000) => {
    const end = Date.now() + ms;
    for (;;) {
      const got = await ask().catch(() => null);
      if (got || Date.now() > end) return got;
      await page.waitForTimeout(100);
    }
  };
  await page.goto(`${CLIENT}/#${mode}`, { timeout: 60000 });
  const world = () => page.frames().find((f) => f.url().startsWith(WORLD));
  await until(() => world()?.evaluate(() => typeof window.NSWP?.menu === "function"));
  // Long enough for a late answer to have come, and for the script to have acted on whatever it heard.
  await page.waitForTimeout(1600);
  return { ctx, page, world, until, refused, sockets };
}
const menus = (v) => v.world().evaluate(() => document.querySelectorAll("nswp-hud").length);
const heard = (v) => v.page.evaluate(() => window.heard);

try {
  // ---- A client that has the menu.
  {
    const v = await visit("has");
    const here = (await heard(v)).filter((h) => h.word.nswp === "here");
    check("has/the engine script says in its one here that it speaks the words", here.length === 1 && here[0].word.menu === 1 && here[0].from === WORLD, here);
    check("has/it draws no menu, from the first moment", (await menus(v)) === 0, await menus(v));
    // The world asks for its menu, as an engine does once it is up, with its own words for Help.
    await v.world().evaluate(() => window.NSWP.menu(JSON.stringify({ title: "The Bare Hall, at last", help: "A hall with nothing in it yet." })));
    // The latest of what it said, once it has said everything: the title comes first, and the tabs as each is added.
    const described = await v.until(async () => (await heard(v)).filter((h) => h.word.nswp === "menu" && h.word.world).map((h) => h.word.world).findLast((w) => w.title === "The Bare Hall, at last" && w.sections.some((s) => s.id === "help")));
    check("has/asked for its menu, it still draws none, and describes itself under its own name", !!described && (await menus(v)) === 0, described?.title);
    const tabs = described?.sections.map((s) => s.id) ?? [];
    const own = ["you", "figure", "bag", "wallet", "files", "moving", "look"];
    check("has/nothing of the visitor's own tabs is said upward", !tabs.some((t) => own.includes(t)), tabs);
    results["has/what it described"] = { title: described?.title, tabs: described?.sections.map((s) => `${s.id} (${s.rows.length})`) };
    const help = described?.sections.find((s) => s.id === "help");
    check("has/in Help it says the world's own words, not how to move", help?.note === "A hall with nothing in it yet.", help);
    const sound = described?.sections.find((s) => s.id === "sound")?.rows.map((r) => r.id) ?? [];
    check("has/in Sound it says nothing that is the visitor's", !sound.some((id) => /^sound-(all|effects|music|voices|hum)$|^juke-/.test(id)), sound);
    check("has/the way home is not the world's to describe", !(described?.sections.find((s) => s.id === "travel")?.rows ?? []).some((r) => r.id === "home"), tabs);
    // The menu coming up and going, said from above, is what the engine is told.
    await v.page.evaluate(() => window.say({ open: true }));
    check("has/the engine is told the menu is up", await v.until(() => v.world().evaluate(() => JSON.parse(window.NSWP.view()).open === true)));
    await v.page.evaluate(() => window.say({ open: false }));
    check("has/and that it went", await v.until(() => v.world().evaluate(() => JSON.parse(window.NSWP.view()).open === false)));
    // The summons, pressed with the world holding the keys, goes upward by name.
    await v.page.mouse.click(550, 350);
    await v.page.keyboard.press("Backquote");
    check("has/the summons goes upward by name", await v.until(async () => (await heard(v)).some((h) => h.word.nswp === "menu" && h.word.key === "summon")));
    // The client stops: the script's own menu comes up.
    await v.page.evaluate(() => window.say({ has: false }));
    check("has/when the client stops, the script's own menu comes up", await v.until(async () => (await menus(v)) === 1));
    results["has/refused, as everything but the two sites is"] = [...v.refused];
    results["has/relays asked for, and answered here with nothing"] = [...v.sockets];
    await v.ctx.close();
  }
  // ---- No client says anything.
  {
    const v = await visit("never");
    check("never/the script draws its own menu", (await menus(v)) === 1, await menus(v));
    await v.world().evaluate(() => window.NSWP.menu(JSON.stringify({ title: "The Bare Hall, at last" })));
    await v.page.waitForTimeout(500);
    check("never/and one only, once the world has asked for its menu", (await menus(v)) === 1, await menus(v));
    check("never/it describes itself to nobody", (await heard(v)).filter((h) => h.word.nswp === "menu").length === 0);
    await v.ctx.close();
  }
  // ---- A client that answers late.
  {
    const v = await visit("late");
    check("late/the script's own menu is put away: one menu, never two", (await menus(v)) === 0, await menus(v));
    await v.world().evaluate(() => window.NSWP.menu(JSON.stringify({ title: "The Bare Hall, at last" })));
    check("late/and it describes itself from then on", await v.until(async () => (await heard(v)).some((h) => h.word.nswp === "menu" && h.word.world?.title === "The Bare Hall, at last")));
    check("late/still with no menu of its own", (await menus(v)) === 0, await menus(v));
    await v.ctx.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
