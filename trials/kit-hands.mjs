// The kit's held hands in a world (packages/sdk/src/held-hands.ts), in a made-up Quest 3 (iwer), before the owner
// sees them on the live site. It asks: going in with a real press, does each controller get the artist's hand and
// controller on its grip, from the world's own hands/kit/ and nowhere else; and do a pull of the trigger and a squeeze
// move the controller's own parts and the hand's fingers, on that side only?
//
// What is real: this checkout's build of the Grove (sites/grove/dist), its kit, the four models it serves, a real
// Chrome and a real mouse press on Enter VR. What is made up: the headset (iwer's Quest 3). Nothing is fetched from
// anywhere else and no relay is reached.
//
//   npm run build && npm run trial -- trials/kit-hands.mjs
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const WORLD = "https://grove.test";
const DIST = join(NSWP, "sites", "grove", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
if (!existsSync(join(DIST, "hands", "kit", "hand-right.glb"))) throw new Error("Build the sites first: npm run build");
const IWER = readFileSync(join(NSWP, "node_modules", "iwer", "build", "iwer.min.js"), "utf8");

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript(`${IWER}; window.__xr = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false }); window.__xr.installRuntime({ forceInstall: true });`);
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }));
  const asked = [];
  const elsewhere = new Set();
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== WORLD) {
      elsewhere.add(url.href);
      return route.abort();
    }
    asked.push(url.pathname);
    const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(150); } };
  await page.goto(`${WORLD}/`, { timeout: 60000 });
  await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
  check("nothing of the hands is fetched before a headset session", !asked.some((p) => p.startsWith("/hands/")), asked.filter((p) => p.startsWith("/hands/")));

  // In, with a real press of Enter VR.
  await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "look"));
  const enter = page.locator("nswp-hud").getByRole("button", { name: /Enter VR/ }).first();
  await until(() => enter.isVisible(), 10000);
  const box = await enter.boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  check("the Grove starts a session in the made-up headset", await until(() => page.evaluate(() => window.__nswpTest.state.xr === "presenting"), 30000), await page.evaluate(() => window.__nswpTest.state.xr));

  /** The held hands drawn now: on what, seen or not, and their moving parts. */
  const held = () =>
    page.evaluate(() => {
      let top = window.__nswpTest.console.group;
      while (top.parent) top = top.parent;
      const found = [];
      top.traverse((o) => {
        if (o.name !== "nswp-held-hand") return;
        const part = (n) => {
          const v = o.getObjectByName(`${n}_pressed_value`);
          const min = o.getObjectByName(`${n}_pressed_min`);
          const max = o.getObjectByName(`${n}_pressed_max`);
          if (!v || !min || !max) return null;
          // A part slides or turns between its two ends: measured by whichever it does.
          const span = min.position.distanceTo(max.position);
          if (span > 1e-6) return Math.round((v.position.distanceTo(min.position) / span) * 100) / 100;
          const turn = min.quaternion.angleTo(max.quaternion);
          return turn > 1e-6 ? Math.round((v.quaternion.angleTo(min.quaternion) / turn) * 100) / 100 : null;
        };
        let bone = null;
        o.traverse((b) => { if (!bone && b.isBone && /index/i.test(b.name) && /(2|3|distal|intermediate|tip)/i.test(b.name)) bone = b; });
        const at = bone ? bone.getWorldPosition(bone.position.clone()) : null;
        const grip = o.parent;
        found.push({ visible: o.visible && !!grip?.visible, onGrip: !!grip && grip.type === "Group" && grip !== top, side: o.getObjectByName("a_button") ? "right" : o.getObjectByName("x_button") ? "left" : "?", trigger: part("xr_standard_trigger"), squeeze: part("xr_standard_squeeze"), index: at ? at.toArray().map((x) => Math.round(x * 10000) / 10000) : null, gripAt: grip ? grip.getWorldPosition(grip.position.clone()).toArray() : null });
      });
      return found;
    });
  const both = await until(async () => { const h = await held(); return h.length === 2 && h.every((x) => x.visible) ? h : null; }, 20000);
  const now = both ?? (await held());
  check("each controller has the artist's hand and controller on its grip, both seen", !!both && now.map((x) => x.side).sort().join() === "left,right" && now.every((x) => x.onGrip), now);
  const fetched = asked.filter((p) => p.startsWith("/hands/")).sort();
  check("the four models are fetched from the world's own hands/kit/, once each", JSON.stringify(fetched) === JSON.stringify(["/hands/kit/controller-left.glb", "/hands/kit/controller-right.glb", "/hands/kit/hand-left.glb", "/hands/kit/hand-right.glb"]), fetched);

  // The right hand: a pull of the trigger to 0.6 and a full squeeze.
  const before = (await held()).find((x) => x.side === "right");
  await page.evaluate(() => {
    const r = window.__xr.controllers.right;
    r.updateButtonValue("trigger", 0.6);
    r.updateButtonValue("squeeze", 1);
  });
  await page.waitForTimeout(600);
  const after = await held();
  const right = after.find((x) => x.side === "right");
  const left = after.find((x) => x.side === "left");
  check("a pull of the trigger moves the controller's trigger that far", right?.trigger === 0.6, right);
  check("a squeeze moves its grip all the way", right?.squeeze === 1, right);
  check("and the index finger moves with the trigger", !!before?.index && !!right?.index && JSON.stringify(before.index) !== JSON.stringify(right.index), { before: before?.index, after: right?.index });
  check("the left stays as it was", left?.trigger === 0 && left?.squeeze === 0, left);
  await page.evaluate(() => {
    const d = window.__xr;
    d.controllers.left.position.set(-0.16, 1.45, -0.4);
    d.controllers.right.position.set(0.16, 1.45, -0.4);
  });
  await page.waitForTimeout(400);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, "kit-hands.png") });
  check("nothing went wrong on the page", errors.length === 0, errors);
  // The world's own sign-in frame (bitlogin.network) is asked for, as in every world, and is no part of this.
  check("no model, or anything of the hands, is asked of anywhere else", ![...elsewhere].some((u) => /\.glb|hands/i.test(u)), [...elsewhere]);
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const total = Object.keys(results).length;
console.log(fail.length ? `\n${fail.length} of ${total} checks failed: ${fail.join("; ")}` : `\nall ${total} checks passed`);
process.exit(fail.length ? 1 : 0);
