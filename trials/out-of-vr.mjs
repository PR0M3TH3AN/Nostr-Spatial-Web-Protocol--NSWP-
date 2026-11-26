// Out of VR for a moment, and back in one press (packages/sdk/src/ui/vr-aside.ts), in a made-up Quest 3 (iwer). In
// the Grove, signed out, in a headset session started by a real mouse press:
//   - You's row reads "Sign In using Phone";
//   - pressed, BitLogin's /headset/ page opens as a window of its own, the session ends, and "Back into VR" is up,
//     dimmed while that page is open;
//   - the page closed, the signer is asked how it stands, once, and "Back into VR" takes a real press, which goes
//     back into VR where they were (the rig hasn't moved);
//   - where the browser refuses the window, the session still ends, and the flat page offers "Open BitLogin": a real
//     press there opens it, and then "Back into VR".
//
// What it can't say: whether a real controller press inside a real headset counts as a press for a window. A
// scripted call here counts as one (as Playwright's calls do), so the refused case is made by refusing the window;
// the owner's Quest is where the first case is seen (docs/owner-quest-checks.md).
//
// What is real: this checkout's build of the Grove, its kit, a real Chrome, real mouse presses on the page. Made up:
// the headset (iwer), and BitLogin (a stand-in signer that says nobody is signed in, and a stand-in /headset/ page).
// Nothing is fetched from anywhere else.
//
//   npm run build && npm run trial -- trials/out-of-vr.mjs
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const WORLD = "https://grove.test";
const SIGN_IN = "https://bitlogin.network";
const DIST = join(NSWP, "sites", "grove", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
const IWER = readFileSync(join(NSWP, "node_modules", "iwer", "build", "iwer.min.js"), "utf8");

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};

/** BitLogin's hidden signer, stood in: nobody is signed in, and every question it is asked is noted. */
const signerPage = `<!doctype html><meta charset="utf-8"><script>
const WORLD = ${JSON.stringify(WORLD)};
const say = (m) => parent.postMessage({ nswp: "nswp-signer", v: 1, ...m }, WORLD);
addEventListener("message", (e) => {
  const d = e.data;
  if (e.origin !== WORLD || !d || d.nswp !== "nswp-signer") return;
  window.__asked?.(d.t);
  if (d.t === "state") say({ t: "state", ...(d.id ? { id: d.id } : {}), unlocked: false });
});
say({ t: "ready" });
</script>`;

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript(`${IWER}; window.__xr = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false }); window.__xr.installRuntime({ forceInstall: true });`);
  const asked = [];
  await ctx.exposeFunction("__asked", (t) => void asked.push(t));
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }));
  const elsewhere = new Set();
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === SIGN_IN) {
      if (url.pathname === "/signer/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: signerPage });
      if (url.pathname === "/headset/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>stand-in phone page</title><p>A stand-in for BitLogin's page for signing in from a phone." });
      if (url.pathname === "/connect/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>stand-in sign-in window</title>" });
    }
    if (url.origin !== WORLD) {
      elsewhere.add(url.origin);
      return route.abort();
    }
    const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const popups = [];
  page.on("popup", (p) => popups.push(p));
  const said = [];
  await page.exposeFunction("__said", (t) => void said.push(t));
  const until = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(150); } };
  await page.goto(`${WORLD}/`, { timeout: 60000 });
  await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
  await page.evaluate(() => window.__nswpTest.controls.onSay((t) => window.__said(t)));
  await until(() => page.evaluate(() => window.__nswpTest.signer?.()?.state === "locked"), 20000);

  const presenting = () => page.evaluate(() => window.__nswpTest.state.xr === "presenting");
  const enterByPress = async () => {
    await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "look"));
    const enter = page.locator("nswp-hud").getByRole("button", { name: /Enter VR/ }).first();
    await until(() => enter.isVisible(), 10000);
    const box = await enter.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return until(presenting, 30000);
  };
  const rigAt = () => page.evaluate(() => { let top = window.__nswpTest.console.group; while (top.parent) top = top.parent; let cam = null; top.traverse((o) => { if (!cam && o.isPerspectiveCamera && o.parent && o.parent !== top) cam = o; }); return cam.parent.position.toArray().map((x) => Math.round(x * 1000) / 1000); });
  /** The offer over the page: its press's words, whether it can be pressed, and what it says under. */
  const offer = () => page.evaluate(() => { const go = document.getElementById("nswp-enter-vr"); return go ? { go: go.textContent, disabled: go.disabled, hint: document.getElementById("nswp-enter-hint")?.textContent ?? "" } : null; });
  const pressOffer = async () => { const box = await page.locator("#nswp-enter-vr").boundingBox(); if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); };

  check("a real press starts a session in the made-up headset", await enterByPress(), await page.evaluate(() => window.__nswpTest.state.xr));
  // Moved a little, so "where they were" is somewhere of their own.
  await page.evaluate(() => { let top = window.__nswpTest.console.group; while (top.parent) top = top.parent; let cam = null; top.traverse((o) => { if (!cam && o.isPerspectiveCamera && o.parent && o.parent !== top) cam = o; }); cam.parent.position.x += 1.5; cam.parent.position.z -= 2; });
  const before = await rigAt();
  const youRow = await page.evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "you")?.items.find((i) => i.id === "signer")?.label ?? null);
  check("in a headset, You's sign-in reads Sign In using Phone", youRow === "Sign In using Phone", youRow);

  // ---- 1. The window opens: BitLogin's phone page, the session ends, Back into VR dimmed until it has gone.
  asked.length = 0;
  await page.evaluate(() => window.__nswpTest.controls.run("signer"));
  await until(async () => !(await presenting()), 8000);
  await page.waitForTimeout(500);
  const phone = popups.at(-1);
  check("the press opens BitLogin's /headset/ page as a window of its own", popups.length === 1 && phone?.url() === `${SIGN_IN}/headset/`, popups.map((p) => p.url()));
  check("the session is ended for it", !(await presenting()), await page.evaluate(() => window.__nswpTest.state.xr));
  check("the first time, one line says what this is", said.includes("This opens BitLogin outside VR for a moment. Press Back into VR when you're done."), said);
  const dimmed = await offer();
  check("Back into VR is up, and can't be pressed while BitLogin's page is open", dimmed?.go === "Back into VR" && dimmed.disabled === true, dimmed);
  await phone?.close();
  await page.bringToFront();
  const ready = await until(async () => { const o = await offer(); return o && !o.disabled ? o : null; }, 8000);
  check("closed, Back into VR can be pressed", !!ready && ready.go === "Back into VR", ready ?? (await offer()));
  check("and the signer is asked how it stands, once the page has closed", asked.filter((t) => t === "state").length >= 1, asked);
  await pressOffer();
  check("one real press on it goes back into VR", await until(presenting, 15000), await page.evaluate(() => window.__nswpTest.state.xr));
  check("where they were: the rig hasn't moved", JSON.stringify(await rigAt()) === JSON.stringify(before), { before, after: await rigAt() });

  // ---- 2. The browser refuses the window from inside VR: the flat page offers Open BitLogin, by a real press.
  said.length = 0;
  await page.evaluate(() => { const real = window.open; window.open = (...a) => { window.open = real; return null; }; window.__nswpTest.controls.run("signer"); });
  await until(async () => !(await presenting()), 8000);
  await page.waitForTimeout(500);
  const fallback = await offer();
  check("refused, the session still ends, and the page offers Open BitLogin", !(await presenting()) && fallback?.go === "Open BitLogin" && !fallback.disabled, fallback);
  check("the line before isn't said a second time", !said.includes("This opens BitLogin outside VR for a moment. Press Back into VR when you're done."), said);
  const opened = popups.length;
  await pressOffer();
  await page.waitForTimeout(800);
  check("a real press there opens BitLogin's /headset/ page", popups.length === opened + 1 && popups.at(-1)?.url() === `${SIGN_IN}/headset/`, popups.map((p) => p.url()));
  const after = await offer();
  check("and then Back into VR is up, waiting for it", after?.go === "Back into VR" && after.disabled === true, after);
  await popups.at(-1)?.close();
  await page.bringToFront();
  await until(async () => { const o = await offer(); return o && !o.disabled ? o : null; }, 8000);
  await pressOffer();
  check("and one press goes back into VR", await until(presenting, 15000), await page.evaluate(() => window.__nswpTest.state.xr));
  check("nothing went wrong on the page", errors.length === 0, errors);
  check("nothing was asked of anywhere else", elsewhere.size === 0, [...elsewhere]);
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const total = Object.keys(results).length;
console.log(fail.length ? `\n${fail.length} of ${total} checks failed: ${fail.join("; ")}` : `\nall ${total} checks passed`);
process.exit(fail.length ? 1 : 0);
