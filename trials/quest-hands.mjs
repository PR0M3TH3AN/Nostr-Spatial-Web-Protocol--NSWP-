// The hands page (trials/pages/quest-hands/), in a made-up Quest (iwer), before the owner tries it in his own. It
// asks: do both sides' models load with their clips; going in with a real press, does each controller get its own
// hand and controller on its grip; does the page write down each input's profile ids; and does a pull of the trigger,
// a squeeze and a thumb on A move the right hand's clips (and nothing on the left)?
//
// What is real: this checkout's page and its bundle, the art's four models as scripts/quest-hands.mjs copied them, a
// real Chrome, a real mouse press on "Enter VR". What is made up: the headset (iwer's Quest 3). Nothing is fetched
// from anywhere else: the page is answered here, as the local service answers it under the Gallery.
//
//   node scripts/quest-hands.mjs && npm run trial -- trials/quest-hands.mjs
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { mkdirSync } from "node:fs";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const SITE = "https://gallery.test";
const PAGE = join(NSWP, "trials", "pages", "quest-hands");
const KIT_HANDS = join(NSWP, "packages", "sdk", "assets", "hands");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".glb": "application/octet-stream" };
if (!existsSync(join(PAGE, "hands.js"))) throw new Error("Make the page's script first: node scripts/quest-hands.mjs");

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got };
  if (!ok) fail.push(name);
};
const CLIPS = ["fingers-open", "fingers-squeezed", "hold", "index-pulled", "index-rest", "thumb-lower", "thumb-rest", "thumb-stick", "thumb-up", "thumb-upper"];

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 760 } });
  const elsewhere = new Set();
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    // The kit's hands, as every world serves them.
    if (url.origin === SITE && /^\/hands\/kit\/[a-z-]+\.glb$/.test(url.pathname)) {
      const file = join(KIT_HANDS, url.pathname.slice("/hands/kit/".length));
      return existsSync(file) ? route.fulfill({ status: 200, contentType: "application/octet-stream", body: readFileSync(file) }) : route.fulfill({ status: 404, body: "not here" });
    }
    if (url.origin !== SITE || !url.pathname.startsWith("/trial-pages/quest-hands/")) {
      elsewhere.add(url.origin);
      return route.abort();
    }
    const rest = url.pathname.slice("/trial-pages/quest-hands/".length) || "index.html";
    const file = normalize(join(PAGE, rest));
    if (!file.startsWith(PAGE) || !existsSync(file)) return route.fulfill({ status: 404, body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? "application/octet-stream", headers: { "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:" }, body: readFileSync(file) });
  });
  await ctx.routeWebSocket(/.*/, (ws) => ws.close());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${SITE}/trial-pages/quest-hands/?emulate`, { timeout: 60000 });
  await page.waitForFunction(() => window.__questHands?.said().some((l) => l.startsWith("models:")), null, { timeout: 30000 }).catch(() => {});
  const said = () => page.evaluate(() => window.__questHands.said());
  const first = await said();
  const loaded = first.find((l) => l.startsWith("models:")) ?? "";
  check("both sides' models load, with every clip the artist named", loaded.startsWith("models: both sides loaded") && CLIPS.every((c) => loaded.includes(c)), loaded);
  await page.waitForFunction(() => !document.getElementById("enter").disabled, null, { timeout: 10000 }).catch(() => {});

  // In, with a real press of the button.
  const box = await page.locator("#enter").boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__questHands.said().some((l) => l.startsWith("session:")), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const inside = await said();
  check("going in is written down, with the features the headset gave", inside.some((l) => l.startsWith("session:")), inside);
  const inputs = inside.filter((l) => l.startsWith("input:"));
  check("each controller's profile ids are written down, a line each", ["left", "right"].every((s) => inputs.some((l) => l.startsWith(`input: ${s} `) && /profiles=\[[a-z0-9-]+/.test(l))), inputs);
  const held = await page.evaluate(() => window.__questHands.held());
  check("each controller has its own hand and controller on its grip", held.left.attached && held.right.attached && held.left.visible && held.right.visible, held);

  // The right hand moved, as the kit would move it: a pull of the trigger, a squeeze, the thumb on A.
  await page.evaluate(() => {
    const r = window.__xr.controllers.right;
    r.updateButtonValue("trigger", 0.6);
    r.updateButtonValue("squeeze", 1);
    r.updateButtonTouch("a-button", true);
  });
  await page.waitForTimeout(500);
  // A picture of the hands as the made-up headset holds them, for a look (written to SHOTS, never committed).
  await page.evaluate(() => {
    const d = window.__xr;
    d.controllers.left.position.set(-0.16, 1.45, -0.4);
    d.controllers.right.position.set(0.16, 1.45, -0.4);
  });
  await page.waitForTimeout(300);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, "quest-hands.png") });
  const right = await page.evaluate(() => window.__questHands.weights("right"));
  const left = await page.evaluate(() => window.__questHands.weights("left"));
  check("a pull of the trigger moves the index finger that far", Math.abs(right["index-pulled"] - 0.6) < 0.02 && Math.abs(right["index-rest"] - 0.4) < 0.02, right);
  check("a squeeze closes the other fingers", right["fingers-squeezed"] === 1 && right["fingers-open"] === 0, right);
  check("the thumb on A is the thumb's lower pose, and only that", right["thumb-lower"] === 1 && ["thumb-upper", "thumb-stick", "thumb-rest", "thumb-up"].every((n) => right[n] === 0), right);
  check("the left hand stays as it was", left["index-pulled"] === 0 && left["fingers-squeezed"] === 0, left);
  // And let go: back to rest, the thumb up off everything.
  await page.evaluate(() => {
    const r = window.__xr.controllers.right;
    r.updateButtonValue("trigger", 0);
    r.updateButtonValue("squeeze", 0);
    r.updateButtonTouch("a-button", false);
  });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__questHands.weights("right"));
  check("let go, the hand goes back to rest", after["index-rest"] === 1 && after["fingers-open"] === 1, after);

  // Hands with the controllers: iwer tracks one or the other, so here only "not seen" can be said; the headset says.
  const end = await said();
  check("the page says nothing of hands with controllers until it sees both at once", !end.some((l) => l.startsWith("hands and controllers tracked together")), end);
  check("nothing went wrong on the page", errors.length === 0, errors);
  check("nothing was asked of anywhere else", elsewhere.size === 0, [...elsewhere]);
  results.said = end;
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const total = Object.keys(results).filter((k) => k !== "said").length;
console.log(fail.length ? `\n${fail.length} of ${total} checks failed: ${fail.join("; ")}` : `\nall ${total} checks passed`);
process.exit(fail.length ? 1 : 0);
