// What it costs to bring a picture the page drew into a Godot world (docs/plans/godot-headset-controls.md, "The
// console in a headset"): the engine script is to draw the kit's own console to a canvas and hand Godot the pixels
// when they change, and before that is settled the crossing is measured.
//
// What is real: this checkout's export of the Godot example (`npm run build:godot`), Godot's own way of taking
// bytes from the page and making a texture of them, and a real Chrome drawing on this machine's graphics card.
// What is a stand-in: the picture. It is a page's 2D canvas of the console's size with words and boxes on it, drawn
// afresh each time, not the console itself. And the machine: a laptop, not a headset. The numbers say how the ways
// compare and how big the work is, not how long it takes on a Quest.
//
// Each way is done thirty times, and each step timed where it happens: the page's drawing and reading back by the
// page's clock, and the rest (getting it across, making an image, putting it on a texture) by Godot's.
//
// Nothing leaves this machine: the page is served from the build, every other request is refused, and no WebSocket
// reaches anything. Godot's two audio worklets come from the local sites service at the Foundry's own port, so that
// service has to be up.
//
//   npm run build:godot && node trials/godot-pixels.mjs
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, HOST } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const DIST = join(NSWP, "engines", "godot", "dist");
if (!existsSync(join(DIST, "nswp-engine.js"))) throw new Error("The Godot example isn't exported in this checkout. Run `npm run build:godot` first.");
const ORIGIN = `https://${HOST}:${process.env.FOUNDRY_PORT ?? 4309}`;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ogg": "audio/ogg", ".wasm": "application/wasm", ".pck": "application/octet-stream", ".webp": "image/webp", ".svg": "image/svg+xml" };
const SOFTWARE = process.argv.includes("--software");
const TIMES = 30;

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: SOFTWARE ? [] : ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
const results = { machine: "", drawn: "", ways: [] };
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  // The page's side of each way: a canvas of the asked size, drawn afresh each time as a console is (a ground, a
  // dozen boxes with words in them, one of them lit), then read back as its pixels, or packed as a PNG.
  await ctx.addInitScript(() => {
    const made = new Map();
    const canvasOf = (w, h, often) => {
      const key = `${w}x${h}${often}`;
      if (!made.has(key)) {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        made.set(key, { canvas, g: canvas.getContext("2d", often ? { willReadFrequently: true } : undefined) });
      }
      return made.get(key);
    };
    const draw = (g, w, h, i) => {
      const k = w / 1024;
      g.fillStyle = "#0b1420";
      g.fillRect(0, 0, w, h);
      g.font = `600 ${Math.round(30 * k)}px sans-serif`;
      for (let n = 0; n < 12; n++) {
        const x = (40 + (n % 2) * 480) * k;
        const y = (90 + Math.floor(n / 2) * 86) * k;
        g.fillStyle = n === i % 12 ? "rgba(90, 200, 255, 0.35)" : "rgba(255, 255, 255, 0.08)";
        g.fillRect(x, y, 460 * k, 72 * k);
        g.fillStyle = "#e8f2ff";
        g.fillText(`A row of the console, number ${n + 1}: ${i}`, x + 18 * k, y + 46 * k);
      }
    };
    window.__pageTimes = [];
    const size = { w: 1024, h: 640, often: false };
    window.nswpTrialSize = (w, h, often) => Object.assign(size, { w, h, often });
    window.nswpTrialPixels = (i) => {
      const { g } = canvasOf(size.w, size.h, size.often);
      const t0 = performance.now();
      draw(g, size.w, size.h, i);
      const t1 = performance.now();
      const pixels = g.getImageData(0, 0, size.w, size.h).data;
      window.__pageTimes.push([t1 - t0, performance.now() - t1]);
      return pixels;
    };
    window.nswpTrialPng = (i) => {
      const { canvas, g } = canvasOf(size.w, size.h, size.often);
      const t0 = performance.now();
      draw(g, size.w, size.h, i);
      const t1 = performance.now();
      const packed = canvas.toDataURL("image/png").split(",")[1];
      window.__pageTimes.push([t1 - t0, performance.now() - t1]);
      return packed;
    };
  });
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
  const page = await ctx.newPage();
  const until = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(100); } };
  await page.goto(`${ORIGIN}/`, { timeout: 180000, waitUntil: "domcontentloaded" });
  if (!(await until(() => page.evaluate(() => JSON.parse(window.nswpExample ?? "{}").ready === true), 180000))) throw new Error("The example never came up. Is the local sites service running? Godot's audio worklets come from it.");
  results.drawn = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : "no WebGL";
  });
  results.machine = `${(await import("node:os")).cpus()[0].model}, load ${(await import("node:os")).loadavg()[0].toFixed(1)}`;

  const middle = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  const most = (list) => Math.max(...list);
  const ms = (us) => Math.round(us / 10) / 100;
  let asked = 0;
  for (const [what, w, h, how, often] of [
    ["the console's own size, its pixels as they are", 1024, 640, "raw", false],
    ["the same, the canvas told it will be read back often", 1024, 640, "raw", true],
    ["three quarters the size each way", 768, 480, "raw", true],
    ["half the size each way", 512, 320, "raw", true],
    ["the console's own size, packed as a PNG", 1024, 640, "png", false],
  ]) {
    await page.evaluate(([w, h, often]) => { window.nswpTrialSize(w, h, often); window.__pageTimes = []; window.nswpPixelsCost = ""; }, [w, h, often]);
    await page.evaluate((ask) => { window.nswpMeasurePixels = ask; }, JSON.stringify({ w, h, how, times: TIMES, n: ++asked }));
    const cost = await until(() => page.evaluate(() => (window.nswpPixelsCost ? JSON.parse(window.nswpPixelsCost) : null)), 120000);
    if (!cost || cost.failed) { results.ways.push({ what, failed: cost?.failed ?? "no answer from the example" }); continue; }
    const pageTimes = await page.evaluate(() => window.__pageTimes);
    // The first of each is left out: it makes the canvas and the texture, which happens once.
    const rows = cost.rows.slice(1).map((r, i) => ({ drawn: pageTimes[i + 1][0], read: pageTimes[i + 1][1], across: ms(r[0]) - pageTimes[i + 1][0] - pageTimes[i + 1][1], image: ms(r[1]), texture: ms(r[2]), all: ms(r[0] + r[1] + r[2]) }));
    const of = (key) => ({ middle: Math.round(middle(rows.map((r) => r[key])) * 100) / 100, most: Math.round(most(rows.map((r) => r[key])) * 100) / 100 });
    results.ways.push({
      what,
      size: `${w} by ${h}`,
      "bytes across": cost.rows[1][3],
      "ms: the page draws it": of("drawn"),
      "ms: the page reads it back": of("read"),
      "ms: across to Godot": of("across"),
      "ms: Godot makes an image": of("image"),
      "ms: onto a texture": of("texture"),
      "ms: all of it but the drawing": { middle: Math.round(middle(rows.map((r) => r.all - r.drawn)) * 100) / 100, most: Math.round(most(rows.map((r) => r.all - r.drawn)) * 100) / 100 },
      "ms: all of it": of("all"),
    });
  }
  await ctx.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.ways.some((w) => w.failed)) process.exit(1);
