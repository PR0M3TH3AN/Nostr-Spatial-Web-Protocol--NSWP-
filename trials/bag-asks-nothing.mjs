// A thing's model is fetched on looking in a bag, and not before (protocol/17-items.md). The menu's sheet is one size
// on every tab, found by laying every tab out in a box nobody sees, and since kit 0.88.0 that is done ahead, with the
// menu down. A tab laid out only to be measured must ask for nothing: no picture, no model, no file from anyone. In
// 0.88.0 it did: the Bag's tiles asked for their pictures whenever the Bag tab was laid out, shown or not, so a
// signed-in visitor's things were fetched from their makers' hosts a moment after arriving, the menu never opened
// (found by BitPortal reading the kit, 2026-11-24). That is a cost on every arrival, and it tells a maker's host of
// a visit nobody made to its thing.
//
// What this holds: no request for any thing's file, and no call of any tile's picture, until the Bag tab is the tab
// that is up. Counted three times: on arriving with the menu down, and waiting; with the menu brought up on another
// tab by a real key and real presses, and waiting; and on the Bag tab, where the thing's files are at last asked for.
//
// What is real: this checkout's own build of the Gallery (`npm run build` first), its own menu and Bag, the kit's
// own item store and picture maker, a real keyboard and mouse. What is a stand-in: the visitor (someone made up,
// whose bag holds one real item, the dart blaster, by its own signed description: `__nswpTrial.has`, which a world
// takes only on this machine, so the world is served here under a name that is this machine's); the relay, which is
// this script and answers the request for the blaster's description with it; and the file host, which serves the
// blaster's files from the Grove's own build and counts every request. Nothing leaves this machine.
//
//   npm run build && node trials/bag-asks-nothing.mjs
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const WORLD = "https://gallery.localhost";
const ITEMS = "https://grove.bitblocks.network";
const DIST = join(NSWP, "sites", "gallery", "dist");
const GROVE = join(NSWP, "sites", "grove", "dist");
if (!existsSync(join(DIST, "index.html")) || !existsSync(join(GROVE, "index.html"))) throw new Error("Build the sites first: npm run build");
const BLASTER = JSON.parse(readFileSync(join(NSWP, "sites", "items", "dart-blaster.event.json"), "utf8"));
const COORD = `${BLASTER.kind}:${BLASTER.pubkey}:${BLASTER.tags.find((t) => t[0] === "d")[1]}`;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg" };

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript(`if (location.origin === ${JSON.stringify(WORLD)}) window.__nswpTrial = { has: [${JSON.stringify(COORD)}] };`);
  /** Every request made of the file host, by its path, in the order made. */
  const files = [];
  const refused = new Set();
  const serveFrom = (route, root, pathname) => {
    const on = normalize(join(root, pathname.endsWith("/") ? `${pathname}index.html` : pathname));
    if (!on.startsWith(root) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", headers: { "access-control-allow-origin": "*" }, body: readFileSync(on) });
  };
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === WORLD) return serveFrom(route, DIST, url.pathname);
    if (url.origin === ITEMS) {
      files.push(url.pathname);
      return url.pathname.startsWith("/items/") ? serveFrom(route, GROVE, url.pathname) : route.abort();
    }
    refused.add(url.origin);
    return route.abort();
  });
  /** How many times a relay was asked for the thing's description. Asking what a thing is, is not fetching it. */
  let described = 0;
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
    ws.onMessage((m) => {
      let msg;
      try { msg = JSON.parse(String(m)); } catch { return; }
      if (msg[0] !== "REQ") return;
      const [, sub, ...filters] = msg;
      if (filters.some((f) => f.kinds?.includes(BLASTER.kind) && f.authors?.includes(BLASTER.pubkey))) {
        described++;
        ws.send(JSON.stringify(["EVENT", sub, BLASTER]));
      }
      ws.send(JSON.stringify(["EOSE", sub]));
    });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (ask, ms = 20000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(150); } };
  await page.goto(`${WORLD}/`, { timeout: 60000 });
  await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true && !!document.querySelector("nswp-hud")), 60000);
  const hud = page.locator("nswp-hud");
  const view = () => page.evaluate(() => { const v = window.__nswpTest.controls.view(); const bag = v.sections.find((s) => s.id === "bag"); return { tabs: v.sections.map((s) => s.id), bagItems: bag ? bag.items.map((i) => [i.kind, i.id.slice(0, 24)]) : null, open: window.__nswpTest.hud.open }; });
  const tabUp = () => page.evaluate(() => document.querySelector("nswp-hud").shadowRoot.querySelector('section.sheet [role="tab"][aria-selected="true"]')?.textContent.trim() ?? null);
  const now = () => ({ files: files.length, paths: [...new Set(files)], described });

  // The made-up visitor has a Bag, with the thing in it, before the menu is ever opened: so there is something
  // that could be asked for.
  const has = await until(async () => { const v = await view(); return v.bagItems?.some(([kind]) => kind === "tile") ? v : null; }, 20000);
  check("the visitor has a Bag tab with a thing in it as a tile, the menu never opened", !!has && has.open === false, await view());

  // Beside the Bag, a tab of the world's own that counts every asking: a tile whose picture says when it is asked
  // for, and a card whose drawing and whose picture's address do. A picture is not only a thing's model: a tile for
  // a person asks for their picture, fetched from wherever they keep it. The address the card names is this
  // machine's own file host, so a fetch of it is counted with the rest.
  await page.evaluate((host) => {
    window.__asked = { tile: 0, card: 0 };
    const c = window.__nswpTest.controls;
    c.addSection({ id: "trial-things", label: "Counted", icon: "save", card: () => ({ title: "A thing that counts", tag: "", proven: false, sub: "its drawing is counted", copy: "", text: "", picture: `${host}/trial-card-picture.png`, color: "#58c8f0", now: [], draw: () => { window.__asked.card++; return null; }, acts: [] }) });
    c.add({ id: "trial-tile", section: "trial-things", kind: "tile", label: "A tile that counts", short: "T", picture: () => { window.__asked.tile++; return null; }, act: () => {} });
    c.add({ id: "trial-typed", section: "trial-things", kind: "field", label: "A row typed into", act: () => {} });
  }, ITEMS);
  const askedNow = () => page.evaluate(() => ({ ...window.__asked }));
  check("the counting tab is in the menu, with its tile and its card", (await view()).tabs.includes("trial-things"), await view());

  // 1. Arrived, the menu down, and ten seconds waited: long enough for every tab to be measured ahead.
  await page.waitForTimeout(10000);
  const arrived = now();
  check("1. on arriving, with the menu down for ten seconds, nothing of any thing is asked of its host", arrived.files === 0, arrived);
  const asked1 = await askedNow();
  check("and no picture is asked for, of a tile or of a card, and no card is drawn", asked1.tile === 0 && asked1.card === 0, asked1);
  results["on arriving, the menu down: requests of the thing's host, and askings of a relay for what it is"] = { files: arrived.files, described: arrived.described, paths: arrived.paths };

  // 2. The menu brought up by its key, on another tab, and gone round the tabs that are not the Bag with the mouse.
  await page.mouse.click(200, 300);
  await page.keyboard.press("m");
  check("the menu comes up at its key", !!(await until(async () => (await view()).open, 5000)), await view());
  await page.waitForTimeout(600);
  const first = await tabUp();
  for (const name of ["Room", "Sound", "Help"]) {
    const tab = hud.getByRole("tab", { name, exact: true }).first();
    const at = await tab.boundingBox().catch(() => null);
    if (!at) continue;
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(4000);
  const other = now();
  check(`2. with the menu up on other tabs (${first}, then Room, Sound, Help), nothing of any thing is asked of its host`, other.files === 0 && (await tabUp()) !== "Bag", { ...other, tab: await tabUp() });
  const asked2 = await askedNow();
  check("and still no picture is asked for, of a tile or of a card, and no card is drawn", asked2.tile === 0 && asked2.card === 0, asked2);
  results["the menu up on other tabs: requests of the thing's host"] = { files: other.files, paths: other.paths };

  // 3. The Bag tab, pressed with the mouse: now the thing is looked at, and its files are asked for.
  {
    const tab = hud.getByRole("tab", { name: "Bag", exact: true }).first();
    await tab.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const at = await tab.boundingBox();
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
  }
  const looked = await until(() => (files.length > 0 ? now() : null), 15000);
  check("3. on the Bag tab, the thing's files are asked for: this is looking in a bag", !!looked && (await tabUp()) === "Bag", { ...now(), tab: await tabUp() });
  await page.waitForTimeout(2500);
  results["on the Bag tab: requests of the thing's host"] = { files: files.length, paths: [...new Set(files)] };
  const picture = await until(() => page.evaluate(() => !!document.querySelector("nswp-hud").shadowRoot.querySelector("section.sheet .tile canvas")), 15000);
  check("and the thing is drawn as itself on its tile", !!picture, null);

  // And the counting is alive: on its own tab, the tile's picture and the card's are asked for, and the card is drawn.
  {
    const tab = hud.getByRole("tab", { name: "Counted", exact: true }).first();
    await tab.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const at = await tab.boundingBox();
    const before = [...files];
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    const up = await until(async () => { const a = await askedNow(); return a.tile > 0 && a.card > 0 ? a : null; }, 8000);
    check("4. on its own tab, the tile's picture is asked for and the card is drawn: the counting can count", !!up, await askedNow());
    const fetched = await until(() => (files.slice(before.length).some((p) => p === "/trial-card-picture.png") ? true : null), 8000);
    check("and the card's own picture is fetched there, and was never asked for before", !!fetched && !before.includes("/trial-card-picture.png"), { before, after: files.slice(before.length) });
  }

  check("nothing went wrong on the page", errors.length === 0, errors);
  results["other sites asked for, and refused"] = [...refused];
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
