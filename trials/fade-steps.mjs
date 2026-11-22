// The fade for jumps the kit makes, in the made-up headset (docs/plans/seated-mode.md, 3.4): a casual visitor's step
// is made only while the view is wholly dark, and comes back; an intense visitor's is an instant cut, never dark.
//
// What is real here: this checkout's own build of the Gallery (sites/gallery/dist, so run `npm run build` first),
// the kit's headset input, its steps and its fade, in a headset session the made-up headset gives (`?xr=emulate`, a
// Meta Quest 3 as iwer makes one). What is a stand-in: the headset itself, and the step, pressed through the world's
// test hook (`step`, what pointing at the floor and pressing does). Whether anyone feels well is the Quest's to say.
//
// Nothing leaves this machine: the world is served from its build, every other request is refused and listed, and no
// WebSocket reaches anything. Nothing on disk is changed but the pictures.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { existsSync, mkdirSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

const WORLD = `https://${HOST}:4392`;
const DIST = join(NSWP, "sites", "gallery", "dist");
if (!existsSync(join(DIST, "app.js"))) throw new Error("The Gallery isn't built in this checkout. Run `npm run build` first.");
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".ogg": "audio/ogg", ".png": "image/png" };
const rules = (JSON.parse(readFileSync(join(DIST, "vercel.json"), "utf8")).headers ?? []).map((rule) => ({ fits: new RegExp(`^${rule.source}$`), headers: Object.fromEntries(rule.headers.filter((h) => !/strict-transport|cache-control/i.test(h.key)).map((h) => [h.key, h.value])) }));
const headersFor = (path) => Object.assign({}, ...rules.filter((rule) => rule.fits.test(path)).map((rule) => rule.headers));

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const refused = new Set();
const errors = [];
mkdirSync(SHOTS, { recursive: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1000, height: 700 } });
// Casual, already chosen here: the one-time question isn't what is tried.
await ctx.addInitScript(() => { try { localStorage.setItem("nswp:comfort", JSON.stringify({ move: "steps", turn: "steps", turnStep: 30, narrow: true, fade: true, moveHand: "left" })); } catch {} });
await ctx.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
  if (url.origin !== WORLD) { refused.add(url.origin); return route.abort(); }
  const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
  const on = normalize(join(DIST, path));
  if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
  return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", headers: headersFor(url.pathname), body: readFileSync(on) });
});
await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.close());
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const until = async (fn, ms = 60000, every = 300) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(every); } return null; };

try {
  await page.goto(`${WORLD}/?xr=emulate`, { timeout: 180000 });
  await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true), 180000);
  await page.evaluate(() => window.__nswpTest.controls.run("vr"));
  const inVr = await until(() => page.evaluate(() => window.__nswpTest.state.xr === "presenting"), 30000);
  want("1 the made-up headset's session is running", !!inVr, true);

  /** A step forward, as pointing at the floor and pressing does; then where they stand, and how dark the view was as the jump was made. */
  const stepAndWatch = async (metres) => {
    const before = await page.evaluate((m) => {
      const t = window.__nswpTest;
      const [x, z] = t.where();
      const yaw = (t.heading() * Math.PI) / 180;
      const made = t.input().jumped.length;
      t.step(x - Math.sin(yaw) * m, z - Math.cos(yaw) * m);
      return { x, z, made };
    }, metres);
    // The darkest it got while the step was being made, looked at as often as this busy browser lets.
    let darkest = 0;
    const end = Date.now() + 2500;
    while (Date.now() < end) {
      darkest = Math.max(darkest, await page.evaluate(() => window.__nswpTest.input().dark));
      await page.waitForTimeout(15);
    }
    // And back: the world limits each frame's step in time, and this made-up headset draws few frames a second, so
    // coming back takes longer here than the ~120 ms it is at a Quest's 72 frames a second. Waited for, up to 20 s.
    await until(() => page.evaluate(() => window.__nswpTest.input().dark === 0), 20000, 100);
    return page.evaluate((b) => {
      const t = window.__nswpTest;
      const [x, z] = t.where();
      const made = t.input().jumped.slice(b.made);
      return { moved: Math.hypot(x - b.x, z - b.z) > 0.05, darkAsMade: made, darkAtEnd: t.input().dark };
    }, before).then((x) => ({ ...x, darkest }));
  };

  // ---- Casual: faded.
  await page.waitForTimeout(800);
  const casual = await stepAndWatch(1.5);
  r.casual = casual;
  want("2 casual: the step was made", casual.moved, true);
  want("3 casual: made only once the view was wholly dark", casual.darkAsMade, [1]);
  want("4 casual: and the view came back", casual.darkAtEnd, 0);
  await page.screenshot({ path: join(SHOTS, "fade-steps-casual.png") });

  // ---- Intense: the instant cut.
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__nswpTest.controls.run("move-style"));
  await page.waitForTimeout(300);
  want("5 intense now, and its fade off", await page.evaluate(() => [window.__nswpTest.input().comfort.move, window.__nswpTest.input().comfort.fade]), ["smooth", false]);
  const intense = await stepAndWatch(1.5);
  r.intense = intense;
  want("6 intense: the step was made", intense.moved, true);
  want("7 intense: an instant cut, never dark", [intense.darkAsMade, intense.darkest], [[0], 0]);

  // ---- Casual again, with the fade turned off in Moving: the cut.
  await page.evaluate(() => window.__nswpTest.controls.run("move-style"));
  await page.evaluate(() => window.__nswpTest.controls.run("move-fade"));
  await page.waitForTimeout(300);
  want("8 casual, the fade turned off in Moving", await page.evaluate(() => [window.__nswpTest.input().comfort.move, window.__nswpTest.input().comfort.fade]), ["steps", false]);
  await page.waitForTimeout(1200);
  const off = await stepAndWatch(1.5);
  r.off = off;
  want("9 the fade off: the step was made, a cut, never dark", [off.moved, off.darkAsMade, off.darkest], [true, [0], 0]);

  r.refused = [...refused];
  r.errors = errors;
  // The world looks for a sign-in address (bitlogin.network), refused here as everything else is: listed, not a fault.
  want("10 nothing was reached but this machine, and no page threw", [r.refused.filter((o) => o !== "https://bitlogin.network"), r.errors], [[], []]);
} catch (e) {
  bad.push(`the walk stopped: ${String(e).slice(0, 400)}`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(r, null, 1));
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
