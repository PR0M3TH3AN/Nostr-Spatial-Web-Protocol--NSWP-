// How soon a world's own menu is there, by how the world is opened (docs/plans/the-clients-menu.md, section 6;
// docs/backlog/own-menu-late-when-framed.md). A framed world waits a moment for the page above to say it has the
// menu, before drawing its own (`MENU_WAIT_MS`, 100 ms; 300 until 2026-11-24). This says what that wait costs and
// what it buys, in the plan's three cases, as the middle of several loads:
//
//   - by itself: nobody above. The world draws its own menu at once.
//   - under a client that has the menu, and says so at once: the world draws none, and never fetches its menu.
//   - under a page that says nothing: the world waits, then draws its own. This is the case the wait makes late.
//
// and a fourth beside them, a page above that answers at once that it hasn't the menu: no wait at all.
//
// It is a measurement first. What it holds to is only what is the kit's own doing and not the machine's:
// a client's answer heard inside the wait means no menu of the world's own, ever, in that load; silence means the
// world's own menu, and no sooner than the wait. The times themselves are said, and compared only where the
// machine was quiet enough for them to mean something; where it wasn't, that is counted and printed as "not
// judged", never as a pass and never as a failure.
//
// What is real: this checkout's own build of the Grove (`npm run build` first), opened by its address in a real
// Chrome. What is a stand-in: the page above (it answers `here` and draws nothing), and the sites' names. Nothing
// leaves this machine: every request and every WebSocket is answered here.
//
//   npm run build && node trials/menu-soon.mjs            [--rounds=7] [--world=grove]
import { existsSync, readFileSync } from "node:fs";
import { availableParallelism, loadavg } from "node:os";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const ROUNDS = Number(flag("rounds") ?? 7);
const KEY = flag("world") ?? "grove";
const CLIENT = "https://client.test";
const WORLD = `https://${KEY}.test`;
const DIST = join(NSWP, "sites", KEY, "dist");
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
// The wait as the kit has it, read from the kit's own source: what this is a measurement of.
const WAIT = Number(/export const MENU_WAIT_MS = (\d+);/.exec(readFileSync(join(NSWP, "packages", "core", "src", "menu.ts"), "utf8"))?.[1]);
if (!(WAIT > 0)) throw new Error("MENU_WAIT_MS isn't where this script reads it, in packages/core/src/menu.ts");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
const ALLOW = "xr-spatial-tracking *; microphone *; autoplay *; gamepad *; clipboard-write *; fullscreen 'none'";

// The page above. `#silent` says no word of any kind. `#no` answers a `here` at once that it hasn't the menu. `#has`
// answers at once that it has (and draws none: this page is only here to answer).
const above = `<!doctype html><meta charset="utf-8"><title>a page above</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;display:block}</style>
<iframe id="view" src="${WORLD}/" allow="${ALLOW}"></iframe>
<script>
const mode = location.hash.slice(1);
const view = document.getElementById("view");
window.__hereAt = null;
addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || !e.data || typeof e.data !== "object" || e.data.nswp !== "here") return;
  window.__hereAt = Date.now();
  const say = (has) => view.contentWindow.postMessage({ nswp: "menu", has, v: 1, settings: {} }, ${JSON.stringify(WORLD)});
  if (mode === "no") say(false);
  if (mode === "has") say(true);
});
</script>`;

const results = {};
const fail = [];
const notJudged = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};
/** A thing that would be a check on a quiet machine, on a machine too busy for it to mean anything. */
const unjudged = (name, why, got) => {
  results[name] = { "not judged": why, saw: got ?? null };
  notJudged.push(name);
};

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
const load = () => Math.round(loadavg()[0] * 10) / 10;
const visits = [];
const asked = new Set();

async function visit(how, round) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  const fetched = [];
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
    asked.add(new URL(ws.url()).host);
    ws.onMessage((m) => {
      let msg;
      try { msg = JSON.parse(String(m)); } catch { return; }
      if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]]));
    });
  });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === CLIENT) return route.fulfill({ status: 200, contentType: TYPES[".html"], body: above });
    if (url.origin === WORLD) {
      const p = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
      const on = normalize(join(DIST, p));
      if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
      fetched.push(p);
      return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
    }
    return route.abort();
  });
  // In the world's page, by the page's own clock from its own start: when a menu was first in it, when it went,
  // when the answer from above was heard, when the world was ready. Nothing is timed from out here.
  await ctx.addInitScript((world) => {
    if (location.origin !== world) return;
    const t = (window.__soon = { menuAt: null, goneAt: null, hasAt: null, has: null, readyAt: null, wall: performance.timeOrigin });
    const there = () => !!document.querySelector("nswp-hud");
    new MutationObserver(() => {
      if (t.menuAt === null && there()) t.menuAt = performance.now();
      else if (t.menuAt !== null && t.goneAt === null && !there()) t.goneAt = performance.now();
    }).observe(document, { childList: true, subtree: true });
    const frame = () => {
      if (t.readyAt === null && window.__nswpTest?.state?.ready === true) t.readyAt = performance.now();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    addEventListener("message", (e) => {
      if (t.hasAt === null && e.data && typeof e.data === "object" && e.data.nswp === "menu" && typeof e.data.has === "boolean") {
        t.hasAt = performance.now();
        t.has = e.data.has;
      }
    });
  }, WORLD);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const loadBefore = load();
  await page.goto(how === "alone" ? `${WORLD}/` : `${CLIENT}/#${how}`, { timeout: 120000, waitUntil: "domcontentloaded" });
  const world = () => (how === "alone" ? page.mainFrame() : page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(WORLD)));
  const began = Date.now();
  let got = null;
  for (;;) {
    got = await world()?.evaluate(() => window.__soon).catch(() => null);
    if ((got?.readyAt != null && Date.now() - began > 2500) || Date.now() - began > 60000) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(300);
  got = (await world()?.evaluate(() => window.__soon).catch(() => null)) ?? got;
  const hereAt = how === "alone" ? null : await page.evaluate(() => window.__hereAt);
  const r = (n) => (n == null ? null : Math.round(n));
  const out = {
    how, round, load: loadBefore,
    menuAt: r(got?.menuAt), goneAt: r(got?.goneAt), readyAt: r(got?.readyAt),
    // From the page above hearing `here` to the world hearing its answer, by the machine's one clock.
    answerIn: hereAt != null && got?.hasAt != null ? r(got.wall + got.hasAt - hereAt) : null,
    fetchedMenu: fetched.some((p) => /\/chunks\/menu-/.test(p)),
    menusAtEnd: (await world()?.evaluate(() => document.querySelectorAll("nswp-hud").length).catch(() => null)) ?? null,
    errors,
  };
  await ctx.close();
  return out;
}

try {
  const cases = ["alone", "has", "silent", "no"];
  for (let round = 1; round <= ROUNDS; round++) {
    // Each round in another order, so a machine getting busier or quieter falls on every case alike.
    for (const how of round % 2 ? cases : [...cases].reverse()) {
      const v = await visit(how, round);
      visits.push(v);
      process.stderr.write(`${JSON.stringify(v)}\n`);
    }
  }
} finally {
  await browser.close();
}

const sorted = (xs) => xs.filter((x) => x != null).sort((a, b) => a - b);
const median = (xs) => { const s = sorted(xs); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const span = (xs) => { const s = sorted(xs); return s.length ? `${median(s)} (${s[0]} to ${s[s.length - 1]})` : "none"; };
const of = (how) => visits.filter((v) => v.how === how);
const named = { alone: "by itself", has: "under a client that has the menu", silent: "under a page that says nothing", no: "under a page that says it hasn't the menu" };

results["the wait, as the kit has it, in ms"] = WAIT;
results["loads of each case"] = ROUNDS;
for (const how of ["alone", "has", "silent", "no"]) {
  results[`${named[how]}: ms from the page's start`] = {
    "a menu of its own in the page, middle (least to most)": span(of(how).map((v) => v.menuAt)),
    "the world ready": span(of(how).map((v) => v.readyAt)),
    ...(how === "alone" ? {} : { "the answer heard, from the page above hearing here": span(of(how).map((v) => v.answerIn)) }),
    "loads that fetched the menu's file": of(how).filter((v) => v.fetchedMenu).length,
    "loads with a menu of the world's own at the end": of(how).filter((v) => v.menusAtEnd === 1).length,
  };
}
const busiest = Math.max(...visits.map((v) => v.load));
const cores = availableParallelism();
const busy = busiest > cores;
results["the machine: threads, and its load over the visits"] = { threads: cores, least: Math.min(...visits.map((v) => v.load)), most: busiest };

check("nothing went wrong on any page", visits.every((v) => v.errors.length === 0), visits.filter((v) => v.errors.length).map((v) => ({ how: v.how, errors: v.errors })));
check("by itself, the world draws its own menu in every load", of("alone").every((v) => v.menuAt != null && v.menusAtEnd === 1), of("alone"));

// Under a client that has the menu: wherever its answer was heard inside the wait, the world drew no menu of its
// own at any moment and never fetched one. That is the kit's doing. Whether the answer came inside the wait is the
// machine's: a load where it didn't is counted and said, and not held against the kit.
const inTime = of("has").filter((v) => v.answerIn != null && v.answerIn < WAIT);
const late = of("has").filter((v) => !(v.answerIn != null && v.answerIn < WAIT));
check(`under a client that has the menu: where its answer was heard inside the wait, no menu of the world's own was ever in the page (${inTime.length} of ${of("has").length} loads)`, inTime.length > 0 && inTime.every((v) => v.menuAt == null && v.menusAtEnd === 0 && !v.fetchedMenu), inTime.filter((v) => v.menuAt != null || v.fetchedMenu));
results["under a client that has the menu: loads where the answer came after the wait had run out"] = late.length ? { loads: late.length, "answer in, ms": late.map((v) => v.answerIn), "the world's own menu was in the page for a while": late.filter((v) => v.menuAt != null).length } : 0;
check("and once the answer is heard there is no menu of the world's own at the end, in any load", of("has").every((v) => v.menusAtEnd === 0), of("has").map((v) => v.menusAtEnd));

// Under silence: the world's own menu, in every load, and no sooner than the wait from the page's start.
check("under a page that says nothing, the world draws its own menu in every load", of("silent").every((v) => v.menuAt != null && v.menusAtEnd === 1), of("silent"));
check(`and no sooner than the wait: never before ${WAIT} ms from the page's start`, of("silent").every((v) => v.menuAt != null && v.menuAt >= WAIT), of("silent").map((v) => v.menuAt));
check("under a page that says it hasn't the menu, the world draws its own in every load", of("no").every((v) => v.menuAt != null && v.menusAtEnd === 1), of("no"));

// What the wait costs: how much later the menu is under silence than by itself. On a quiet machine it is about the
// wait and not much more. On a busy one the two middles are of loads that took whatever time they were given.
const cost = median(of("silent").map((v) => v.menuAt)) - median(of("alone").map((v) => v.menuAt));
const noWait = median(of("no").map((v) => v.menuAt)) - median(of("alone").map((v) => v.menuAt));
results["what the wait costs: the middle under silence, less the middle by itself, in ms"] = cost;
results["and with an answer of hasn't: the middle, less the middle by itself, in ms"] = noWait;
const costName = `the wait costs about what it is: under silence the menu is later than by itself by no more than the wait and 150 ms`;
if (busy) unjudged(costName, `the machine was busy: a load of ${busiest} on ${cores} threads`, { cost, wait: WAIT });
else check(costName, cost <= WAIT + 150, { cost, wait: WAIT });
results["relays asked for, and answered here with nothing"] = [...asked];

console.log(JSON.stringify(results, null, 2));
if (notJudged.length) console.error(`\nNOT JUDGED: ${notJudged.length}\n- ${notJudged.join("\n- ")}`);
if (fail.length) {
  console.error(`\nFAILED: ${fail.length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed${notJudged.length ? `, ${notJudged.length} not judged` : ""}`);
