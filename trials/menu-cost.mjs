// What the client's menu costs, and what it saves (docs/plans/the-clients-menu.md, step 1: "frame times and bytes";
// the result is written up in docs/plans/the-clients-menu-cost.md). Three worlds, each in a frame of a page on
// another site, each visited two ways:
//
// - "own": the page above says nothing, so the world waits its 300 ms and draws its own menu, as it does today.
// - "client": the page above is the stand-in client (trials/stand-in-client/main.ts), which draws the menu, so the
//   world draws none and describes itself in words.
//
// In each visit, with the menu down and then with it up (the Travel tab), over a few seconds: how often the world
// drew a frame, how long its page's main thread and the page above's were busy, how many words crossed between the
// two and how big they were. Once per visit: how soon the menu was there and the world ready, how much each page
// held in memory, and every file the world asked for with its size.
//
// What is real: this checkout's builds of the Gallery and the Grove (`npm run build`) and of the Godot example
// (`npm run build:godot`), the menu and both ends of its port, a real Chrome, and a real mouse on the bar's Menu
// key. What is a stand-in: the client, every site's name, each world's own rules about who may frame it (left off
// so this page may), and the screen (a scripted Chrome has none: it draws with this machine's own graphics card, by
// `--use-angle=gl`, and shows nobody; `--software` has it draw without the card, as a scripted Chrome does when left
// alone). Nothing leaves this machine: every request is answered from the builds or refused and listed, and every
// WebSocket is answered here with nothing. Godot's two audio worklets come from the local sites service at the
// Foundry's own port, where its page is served (a scripted browser lets them past its interception), so that
// service has to be up. It measures and judges nothing: it fails only if a visit never came up.
//
// This is not a trial about presses, so the script reads both pages directly.
//
//   npm run build && npm run build:godot && node trials/menu-cost.mjs
//   node trials/menu-cost.mjs --only=gallery       one world
//   node trials/menu-cost.mjs --once               each way once (own, client), not twice (own, client, client, own)
//   node trials/menu-cost.mjs --seconds=8          how long each measure is (default 6)
//   node trials/menu-cost.mjs --software           draw without the graphics card
//   node trials/menu-cost.mjs --uncapped           draw as many frames as the machine can, not a screen's 60 a second
//   node trials/menu-cost.mjs --out=file.json      keep the result in a file too
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { extname, join, normalize } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { build } = await import(`${NSWP}/node_modules/esbuild/lib/main.js`);

const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}`))?.split("=")[1] ?? (process.argv.includes(`--${name}`) ? "1" : undefined);
const SECONDS = Number(flag("seconds") ?? 6);
const CLIENT = "https://client.test";
const WORLDS = [
  { key: "gallery", name: "The Gallery", origin: "https://gallery.test", dist: join(NSWP, "sites", "gallery", "dist"), needs: "npm run build" },
  { key: "grove", name: "The Grove", origin: "https://grove.test", dist: join(NSWP, "sites", "grove", "dist"), needs: "npm run build" },
  { key: "godot", name: "The Godot example", origin: `https://${HOST}:${process.env.FOUNDRY_PORT ?? 4309}`, dist: join(NSWP, "engines", "godot", "dist"), needs: "npm run build:godot" },
].filter((w) => !flag("only") || flag("only").split(",").includes(w.key));
for (const w of WORLDS) if (!existsSync(join(w.dist, "index.html"))) throw new Error(`${w.name} isn't built in this checkout. Run \`${w.needs}\` first.`);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".txt": "text/plain", ".wasm": "application/wasm", ".pck": "application/octet-stream" };
const ALLOW = "xr-spatial-tracking *; microphone *; autoplay *; gamepad *; clipboard-write *; fullscreen 'none'";
const STYLE = "<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;display:block}</style>";
mkdirSync(SHOTS, { recursive: true });

// The stand-in client's own code, built from this checkout's kit as a client would build its copy.
const bundle = await build({ entryPoints: [join(NSWP, "trials", "stand-in-client", "main.ts")], bundle: true, minify: true, format: "esm", target: "es2022", write: false, logLevel: "warning", absWorkingDir: NSWP });
const clientJs = bundle.outputFiles[0].text;
const framing = (world, client) => `<!doctype html><meta charset="utf-8"><title>${client ? "stand-in client" : "a page that says nothing"}</title>${STYLE}
<iframe id="view" src="${world.origin}/" allow="${ALLOW}"></iframe>${client ? '\n<script type="module" src="/app.js"></script>' : ""}`;
const home = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#123;color:#fff">home<script>parent.postMessage({ nswp: "here", at: "/" }, "*")</script>`;

const sizes = (body) => ({ bytes: body.length, gzip: gzipSync(body).length, brotli: brotliCompressSync(body).length });
const stats = (stamps) => {
  const gaps = stamps.slice(1).map((t, i) => t - stamps[i]).sort((a, b) => a - b);
  if (!gaps.length) return { frames: 0 };
  const at = (q) => gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))];
  const span = stamps[stamps.length - 1] - stamps[0];
  const r = (n) => Math.round(n * 10) / 10;
  return { frames: gaps.length, perSecond: r((gaps.length * 1000) / span), median: r(at(0.5)), p95: r(at(0.95)), worst: r(gaps[gaps.length - 1]) };
};
const load = () => Math.round(loadavg()[0] * 10) / 10;

const DRAWN = [
  ...(flag("software") ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"]),
  // As many frames as the machine can draw, not as many as a screen shows: what is left over shows as frames.
  ...(flag("uncapped") ? ["--disable-frame-rate-limit", "--disable-gpu-vsync"] : []),
];
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: DRAWN });
const refused = new Set();
const sockets = new Set();
const errors = [];
const visits = [];

async function visit(world, mode, turn) {
  const tag = `${world.key} ${mode} ${turn}`;
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  const fetched = new Map();
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
    if (url.origin === CLIENT) {
      if (url.pathname === "/app.js") return route.fulfill({ status: 200, contentType: TYPES[".js"], body: clientJs });
      if (url.pathname === "/home.html") return route.fulfill({ status: 200, contentType: TYPES[".html"], body: home });
      return route.fulfill({ status: 200, contentType: TYPES[".html"], body: framing(world, mode === "client") });
    }
    if (url.origin === world.origin) {
      const p = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
      const on = normalize(join(world.dist, p));
      if (!on.startsWith(world.dist) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
      const body = readFileSync(on);
      fetched.set(p, body.length);
      return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body });
    }
    refused.add(url.origin);
    return route.abort();
  });
  // The words between the two pages, counted where they land, from each page's first moment: `all` for the whole
  // visit, `now` for the measure under way.
  await ctx.addInitScript(() => {
    // When a menu was first in this page, by the page's own clock: asking from outside waits on a busy page.
    const seen = () => { if (!window.__menuAt && document.querySelector("nswp-hud")) window.__menuAt = Date.now(); };
    new MutationObserver(seen).observe(document, { childList: true, subtree: true });
    const heard = (window.__heard = { all: { words: 0, bytes: 0, biggest: 0, kinds: {} }, now: { words: 0, bytes: 0, kinds: {} } });
    addEventListener("message", (e) => {
      if (!e.data || typeof e.data !== "object" || typeof e.data.nswp !== "string") return;
      const size = JSON.stringify(e.data).length;
      heard.all.words++;
      heard.all.bytes += size;
      heard.all.biggest = Math.max(heard.all.biggest, size);
      heard.now.words++;
      heard.now.bytes += size;
      // Which word it was: `menu` words by what they carry (`world`, `picture`, `open`…), any other by its own name.
      const kind = e.data.nswp === "menu" ? (Object.keys(e.data).find((k) => k !== "nswp") ?? "menu") : e.data.nswp;
      for (const part of [heard.all, heard.now]) part.kinds[kind] = (part.kinds[kind] ?? 0) + 1;
    });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${tag}: ${String(e).slice(0, 200)}`));
  const until = async (ask, ms = 240000, every = 50) => {
    const end = Date.now() + ms;
    for (;;) {
      const got = await Promise.resolve().then(ask).catch(() => null);
      if (got || Date.now() > end) return got;
      await page.waitForTimeout(every);
    }
  };
  const frame = () => page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(world.origin));
  // Whichever page draws the menu: the page above for a client that has it, the world's own otherwise.
  const drawer = () => (mode === "client" ? page.mainFrame() : frame());
  const bar = () =>
    drawer()?.evaluate(() => {
      const root = document.querySelector("nswp-hud")?.shadowRoot;
      if (!root) return null;
      const sheet = root.querySelector("section.sheet");
      const tab = root.querySelector('.tabbar [role="tab"][aria-selected="true"]');
      return { keys: root.querySelectorAll(".hotbar button.key").length, loading: !!root.querySelector(".loading:not([hidden])"), open: !!sheet && !sheet.hidden, tab: tab?.textContent ?? null };
    });

  const began = Date.now();
  const loadBefore = load();
  await page.goto(`${CLIENT}/?home=${encodeURIComponent(`${CLIENT}/home.html`)}`, { timeout: 240000, waitUntil: "domcontentloaded" });
  const drawn = await until(async () => ((await bar())?.keys ?? 0) > 0);
  const menuThere = drawn ? ((await drawer().evaluate(() => window.__menuAt ?? null)) ?? Date.now()) - began : null;
  // Ready: the menu's loading line is gone, the world has drawn into a canvas, and (a client) it has described itself.
  const ready = await until(async () => {
    const b = await bar();
    if (!b || b.loading) return false;
    if (!(await frame()?.evaluate(() => (window.__nswpTest ? window.__nswpTest.state?.ready === true : !!document.querySelector("canvas"))))) return false;
    return mode !== "client" || (await page.evaluate(() => { const w = window.__client.below.world; return !!w && w.sections.length > 0 && !w.loading; }));
  });
  const worldReady = ready ? Date.now() - began : null;
  const out = { world: world.key, mode, turn, loadBefore, menuThere, worldReady };
  if (!ready) {
    out.failed = "the world never came up";
    out.bar = await Promise.resolve().then(bar).catch(() => null);
    await page.screenshot({ path: join(SHOTS, `menu-cost-${world.key}-${mode}-${turn}-failed.png`) }).catch(() => {});
    await ctx.close();
    return out;
  }
  out.menus = { above: await page.evaluate(() => document.querySelectorAll("nswp-hud").length), world: await frame().evaluate(() => document.querySelectorAll("nswp-hud").length) };

  // Each page's own main thread, asked of the browser. Two sites, so two processes; the world's is its own.
  const sessions = { above: await ctx.newCDPSession(page), world: await ctx.newCDPSession(frame()).catch(() => null) };
  for (const s of Object.values(sessions)) await s?.send("Performance.enable");
  const busy = async (s) => {
    if (!s) return null;
    const { metrics } = await s.send("Performance.getMetrics");
    const of = (name) => metrics.find((m) => m.name === name)?.value ?? 0;
    return { task: of("TaskDuration"), script: of("ScriptDuration"), layout: of("LayoutDuration") + of("RecalcStyleDuration") };
  };
  const frames = (ms) => new Promise((done) => { const t = []; const end = performance.now() + ms; const tick = (now) => { t.push(now); if (now < end) requestAnimationFrame(tick); else done(t); }; requestAnimationFrame(tick); });
  const rate = (s) => ({ words: Math.round((window.__heard.now.words / s) * 10) / 10, bytes: Math.round(window.__heard.now.bytes / s), kinds: window.__heard.now.kinds });
  const measure = async () => {
    const ms = SECONDS * 1000;
    const zero = () => { window.__heard.now = { words: 0, bytes: 0, kinds: {} }; };
    await page.evaluate(zero);
    await frame().evaluate(zero);
    const before = { above: await busy(sessions.above), world: await busy(sessions.world) };
    const [worldStamps, aboveStamps] = await Promise.all([frame().evaluate(frames, ms), page.evaluate(frames, ms)]);
    const after = { above: await busy(sessions.above), world: await busy(sessions.world) };
    const span = (worldStamps[worldStamps.length - 1] - worldStamps[0]) / 1000 || SECONDS;
    const each = (who) => (before[who] && after[who] ? Object.fromEntries(Object.keys(before[who]).map((k) => [k, Math.round(((after[who][k] - before[who][k]) * 1000) / span)])) : null);
    return {
      world: stats(worldStamps),
      above: stats(aboveStamps),
      // Milliseconds of main-thread work in each second.
      busy: { world: each("world"), above: each("above") },
      // Per second: the words that reached the page above, and the words that reached the world.
      up: await page.evaluate(rate, span),
      down: await frame().evaluate(rate, span),
      load: load(),
    };
  };

  await page.waitForTimeout(3000);
  out.down = await measure();

  // The bar's Menu key, with a real mouse, then the Travel tab: the one tab that is in both menus with the same rows.
  const place = (selector, text) =>
    drawer().evaluate(({ selector, text }) => {
      const root = document.querySelector("nswp-hud")?.shadowRoot;
      const it = [...(root?.querySelectorAll(selector) ?? [])].find((b) => !text || b.textContent.trim() === text);
      const r = it?.getBoundingClientRect();
      return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    }, { selector, text });
  const at = await place("button.menu");
  if (at) await page.mouse.click(at.x, at.y);
  await until(async () => (await bar())?.open, 10000);
  const tab = await place('.tabbar [role="tab"]', "Travel");
  if (tab) await page.mouse.click(tab.x, tab.y);
  await until(async () => (await bar())?.tab === "Travel", 5000);
  await page.mouse.move(550, 690);
  await page.waitForTimeout(1500);
  const up = await bar();
  out.shown = { open: !!up?.open, tab: up?.tab ?? null };
  out.up = await measure();
  await page.screenshot({ path: join(SHOTS, `menu-cost-${world.key}-${mode}-${turn}.png`) });

  // What each page holds, after a collection, with the menu still up.
  const held = async (s) => {
    if (!s) return null;
    await s.send("HeapProfiler.collectGarbage");
    return Math.round((await s.send("Runtime.getHeapUsage")).usedSize / 1024);
  };
  // Every word of the visit so far: the ones that reached the page above, and the ones that reached the world.
  out.words = { up: await page.evaluate(() => window.__heard.all), down: await frame().evaluate(() => window.__heard.all) };
  out.heldKb = { world: await held(sessions.world), above: await held(sessions.above) };
  out.renderer = await frame().evaluate(() => { const gl = document.createElement("canvas").getContext("webgl2"); const ext = gl?.getExtension("WEBGL_debug_renderer_info"); return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null; });
  out.fetched = Object.fromEntries([...fetched].sort());
  out.fetchedBytes = [...fetched.values()].reduce((a, b) => a + b, 0);
  out.took = Math.round((Date.now() - began) / 1000);
  await ctx.close();
  return out;
}

try {
  for (const world of WORLDS) {
    const order = flag("once") ? ["own", "client"] : ["own", "client", "client", "own"];
    const turns = {};
    for (const mode of order) {
      turns[mode] = (turns[mode] ?? 0) + 1;
      const v = await visit(world, mode, turns[mode]);
      visits.push(v);
      const line = (m) => (m ? `${m.world.perSecond}/s median ${m.world.median} p95 ${m.world.p95}; busy world ${m.busy.world?.task} above ${m.busy.above?.task} ms/s; up ${m.up.words} words ${m.up.bytes} B/s; load ${m.load}` : "-");
      console.error(`${world.key} ${mode} ${turns[mode]}: ${v.failed ?? `menu ${v.menuThere} ms, ready ${v.worldReady} ms`}\n  down: ${line(v.down)}\n  up:   ${line(v.up)}`);
    }
  }
} finally {
  await browser.close();
}

// The files a world asked for one way and not the other, with what they weigh on disk and as a host would send them.
const files = {};
for (const world of WORLDS) {
  const of = (mode) => visits.filter((v) => v.world === world.key && v.mode === mode && v.fetched);
  const names = (mode) => new Set(of(mode).flatMap((v) => Object.keys(v.fetched)));
  const [own, client] = [names("own"), names("client")];
  const weigh = (list) => Object.fromEntries(list.sort().map((p) => [p, sizes(readFileSync(join(world.dist, p)))]));
  files[world.key] = {
    ownBytes: of("own")[0]?.fetchedBytes ?? null,
    clientBytes: of("client")[0]?.fetchedBytes ?? null,
    onlyOwn: weigh([...own].filter((p) => !client.has(p))),
    onlyClient: weigh([...client].filter((p) => !own.has(p))),
  };
}
const result = {
  when: new Date().toISOString(),
  seconds: SECONDS,
  drawn: DRAWN,
  visits: visits.map(({ fetched, ...v }) => v),
  files,
  standInClient: sizes(Buffer.from(clientJs)),
  refused: [...refused].sort(),
  sockets: [...sockets].sort(),
  errors,
};
const outFile = flag("out");
if (outFile) writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
const failed = visits.filter((v) => v.failed || !v.shown?.open);
if (failed.length) {
  console.error(`\n${failed.length} visit(s) didn't measure: ${failed.map((v) => `${v.world} ${v.mode} ${v.turn}`).join(", ")}`);
  process.exit(1);
}
