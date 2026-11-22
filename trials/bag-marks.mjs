// Pictures of the console's Bag section: items in the visitor's bag and an item offered here, drawn by the kit's own
// code with a stand-in bag (trials/bag-marks-entry.ts), at a desk's width and a phone's, in the kit's own look and in
// "Paper". Then the offered item taken, and one put away, to see the tiles follow without the menu reopening.
// `SHOTS_ONLY=1` takes the pictures and checks nothing (for a "before" from a build without the marks).
// Nothing is fetched from anywhere: the page and its script are served by this script.
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { execFileSync } = await import("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const { join } = await import("node:path");

const SHOTS_ONLY = process.env.SHOTS_ONLY === "1";
const TAG = process.env.TAG ?? "after";
const work = mkdtempSync(join(tmpdir(), "bag-marks-"));
execFileSync(join(NSWP, "node_modules", ".bin", "esbuild"), [join(NSWP, "trials", "bag-marks-entry.ts"), "--bundle", "--format=esm", "--log-level=warning", `--outfile=${join(work, "bag.js")}`], { stdio: "inherit" });
const script = readFileSync(join(work, "bag.js"), "utf8");
const ORIGIN = "https://bag.test";
const page = `<!doctype html><meta charset="utf-8"><title>Bag</title><body style="margin:0;background:#1d2733;height:100vh"><script type="module" src="/bag.js"></script>`;

const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (!SHOTS_ONLY && JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
const browser = await pw.chromium.launch({ channel: "chrome", headless: true });
mkdirSync(SHOTS, { recursive: true });
// The console has no light theme: its looks are accents on dark glass. "Paper", the near-white one, is the hardest
// for a mark drawn in the accent, so it is the second look pictured.
for (const [label, viewport, accent] of [["desk", { width: 1100, height: 700 }, null], ["phone", { width: 390, height: 760 }, null], ["desk-paper", { width: 1100, height: 700 }, "#f2f3f6"]]) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/bag.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: script });
    return route.fulfill({ status: 200, contentType: "text/html", body: page });
  });
  const p = await ctx.newPage();
  await p.goto(`${ORIGIN}/`);
  await p.waitForFunction(() => !!window.__bag);
  if (accent) await p.evaluate((a) => window.__bag.accent(a), accent);
  await p.evaluate(() => window.__bag.open());
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(SHOTS, `bag-marks-${TAG}-${label}.png`) });
  if (label === "desk") {
    r.tiles = await p.evaluate(() => window.__bag.tiles());
    if (!SHOTS_ONLY) {
      want("1 two in the bag carry the bag mark; the offered one is faint, with none", r.tiles.map((t) => [t.label.split(",")[0], t.mark ?? null, t.faint ?? false]), [["Brass lantern", "bag", false], ["Tin mug", "bag", false], ["Paper pinwheel", null, true]]);
      want("2 the offered one says so to a screen reader", r.tiles.find((t) => t.label.startsWith("Paper"))?.label, "Paper pinwheel, offered here, not in your bag");
      const drawn = () => p.evaluate(() => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll("button.tile")].map((b) => ({ name: b.getAttribute("aria-label"), mark: !!b.querySelector(".corner-mark"), faint: b.classList.contains("faint"), disabled: b.disabled })));
      r.drawn = await drawn();
      want("3 drawn so: marks on two, the third faint and still pressable", r.drawn.map((d) => [d.mark, d.faint, d.disabled]), [[true, false, false], [true, false, false], [false, true, false]]);
      await p.evaluate(() => window.__bag.take());
      await p.waitForTimeout(400);
      r.afterTaking = await drawn();
      want("4 taken: it loses the grey and gains the mark, the menu still open", r.afterTaking.map((d) => [d.name.split(",")[0], d.mark, d.faint]), [["Brass lantern", true, false], ["Tin mug", true, false], ["Paper pinwheel", true, false]]);
      await p.screenshot({ path: join(SHOTS, `bag-marks-${TAG}-taken.png`) });
      await p.evaluate(() => window.__bag.putAway());
      await p.waitForTimeout(400);
      r.afterPuttingAway = await drawn();
      want("5 the lantern taken out of the bag: no longer shown as the bag's (it isn't offered here)", r.afterPuttingAway.map((d) => d.name.split(",")[0]), ["Tin mug", "Paper pinwheel"]);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(r, null, 1));
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log(SHOTS_ONLY ? "\nPictures taken." : "\nall as wanted");
