// Tries a world the way a visitor would, in each of the three forms a visitor can be in, and says what it found.
//
//   node scripts/probe-world.mjs https://gallery.example/ [more addresses]
//   node scripts/probe-world.mjs --json https://gallery.example/
//
// A world's announcement says what it is for. That is its maker's word. This is a look for yourself, for whoever
// lists worlds and wants to tell visitors what they found (BitPortal keeps the answers in src/starter/checked.json).
//
// What it does, with the Chrome on this machine:
//   phone    a phone-sized touch screen: does the page load, and is something drawn on a canvas that fills it?
//   desk     a desktop window with a mouse: the same.
//   headset  a made-up headset on the page (IWER): is there a way into VR, and does a session start when it is pressed?
//
// What an answer means:
//   "works"  it loaded and drew (or, for a headset, a session started).
//   "fails"  the page didn't load at all, or threw before drawing anything.
//   left out it couldn't be confirmed either way. A software renderer and a made-up headset are not the real things,
//            so a world is never called broken for something only they might get wrong.
//
// It visits each address, as any browser would, and nothing more: nothing is signed in, pressed beyond a tap and a
// way into VR, or sent anywhere.
import { chromium } from "playwright-core";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const addresses = args.filter((a) => !a.startsWith("--"));
if (!addresses.length) {
  console.error("usage: node scripts/probe-world.mjs [--json] <address> [more addresses]");
  process.exit(2);
}

const FLAGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"];
const FORMS = {
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36" },
  desk: { viewport: { width: 1280, height: 800 } },
  headset: { viewport: { width: 1280, height: 800 } },
};

/** What is on the page that draws: the largest canvas, how much of the window it fills, and whether its picture is more than one flat colour. */
const lookAtCanvas = async (page) => {
  const found = await page.evaluate(() => {
    const all = [...document.querySelectorAll("canvas")].map((c) => ({ c, r: c.getBoundingClientRect() })).filter((x) => x.r.width > 50 && x.r.height > 50);
    all.sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
    const top = all[0];
    if (!top) return null;
    // Which kit the page says is running (the kit writes it as it reads the arrival), or null for a world built without it.
    return { x: Math.max(0, top.r.x), y: Math.max(0, top.r.y), width: Math.min(innerWidth, top.r.width), height: Math.min(innerHeight, top.r.height), fills: (Math.min(innerWidth, top.r.width) * Math.min(innerHeight, top.r.height)) / (innerWidth * innerHeight), overflow: document.documentElement.scrollWidth - innerWidth, kit: document.documentElement.dataset.nswpKit ?? null };
  });
  if (!found) return { canvas: false, drawn: false, fills: 0, overflow: 0 };
  // Two pictures a moment apart, and how many different colours are in the first: a canvas left blank is one colour.
  const shot = await page.screenshot({ clip: { x: found.x, y: found.y, width: Math.max(1, found.width), height: Math.max(1, found.height) }, type: "png" }).catch(() => null);
  const drawn = shot ? await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, 64, 64);
    const d = g.getImageData(0, 0, 64, 64).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
    return seen.size;
  }, shot.toString("base64")).catch(() => 0) : 0;
  return { canvas: true, drawn: drawn > 6, colours: drawn, fills: Math.round(found.fills * 100) / 100, overflow: found.overflow, kit: found.kit };
};

async function tryForm(browser, address, form) {
  const context = await browser.newContext({ ...FORMS[form], bypassCSP: form === "headset" });
  const errors = [];
  const out = { form, loaded: false };
  try {
    if (form === "headset") {
      await context.addInitScript({ path: join(root, "node_modules", "iwer", "build", "iwer.min.js") });
      await context.addInitScript(() => {
        try {
          new IWER.XRDevice(IWER.metaQuest3).installRuntime({ forceInstall: true });
          const real = navigator.xr.requestSession.bind(navigator.xr);
          window.__probe = { asked: 0, started: 0, refused: "" };
          navigator.xr.requestSession = (...a) => {
            window.__probe.asked++;
            return real(...a).then(
              (s) => (window.__probe.started++, s),
              (e) => {
                window.__probe.refused = String(e?.message ?? e).slice(0, 120);
                throw e;
              },
            );
          };
        } catch (e) {
          window.__probe = { asked: 0, started: 0, refused: `no headset could be made up: ${e}` };
        }
      });
    }
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    const response = await page.goto(address, { waitUntil: "load", timeout: 45000 }).catch((e) => ({ failed: String(e).slice(0, 120) }));
    if (!response || "failed" in response) return { ...out, why: response?.failed ?? "no answer" };
    out.status = response.status();
    if (out.status >= 400) return { ...out, why: `the site answered ${out.status}` };
    out.loaded = true;
    // A place takes a while to build itself.
    await page.waitForTimeout(7000);
    Object.assign(out, await lookAtCanvas(page));
    if (form === "headset") {
      // The way in: whatever the page calls it. Three.js, A-Frame and the NSWP kit each have their own.
      const ways = ["#VRButton", ".a-enter-vr-button", "button:has-text('Enter VR')", "button:has-text('VR')", "a:has-text('Enter VR')", "[aria-label*='VR' i]", "button:has-text('Start')", "button:has-text('Enter')"];
      for (const way of ways) {
        const at = page.locator(way).first();
        if (!(await at.isVisible().catch(() => false))) continue;
        out.wayIn = way;
        await at.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(2500);
        if ((await page.evaluate(() => window.__probe?.asked ?? 0).catch(() => 0)) > 0) break;
      }
      Object.assign(out, await page.evaluate(() => window.__probe ?? {}).catch(() => ({})));
    } else if (form === "phone") {
      await page.touchscreen.tap(195, 420).catch(() => {});
      await page.waitForTimeout(600);
    }
    out.errors = errors.slice(0, 3);
    return out;
  } finally {
    await context.close();
  }
}

/** One word for what was found, or nothing where it can't be said either way. */
function verdict(found) {
  if (!found.loaded) return "fails";
  if (found.form === "headset") return found.started > 0 ? "works" : undefined;
  if (found.canvas && found.drawn) return "works";
  // It loaded and threw before anything was drawn: that is broken wherever it is run.
  if (!found.canvas && found.errors?.length) return "fails";
  return undefined;
}

const browser = await chromium.launch({ channel: "chrome", headless: true, args: FLAGS });
const report = [];
for (const address of addresses) {
  const entry = { address, at: new Date().toISOString().slice(0, 10), found: {} };
  for (const form of Object.keys(FORMS)) {
    const found = await tryForm(browser, address, form).catch((e) => ({ form, loaded: false, why: String(e).slice(0, 120) }));
    const word = verdict(found);
    if (word) entry[form] = word;
    entry.found[form] = found;
    if (!asJson) console.log(`${address}  ${form.padEnd(8)} ${(word ?? "not confirmed").padEnd(14)} ${JSON.stringify({ ...found, form: undefined })}`);
  }
  report.push(entry);
}
await browser.close();
if (asJson) console.log(JSON.stringify(report, null, 1));
process.exit(0);
