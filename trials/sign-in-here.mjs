// A "Sign in" row wherever a tab says to sign in (the owner, 2026-11-25: "can we have a "sign in" button anywhere in
// the menus that we say something like "sign into bitlogin to use this feature""). Signed out, every tab that says
// to sign in has the row at its top; one real press of it opens the sign-in, as You's row does; signed in, there is
// no such row anywhere.
//
// What is real: this checkout's own build of the Arcade (sites/arcade/dist), which has Achievements and Scores, in a
// real Chrome, pressed with the mouse. What is stood in: the sign-in address (its hidden signer, which says nobody is
// signed in until told, and its window), and what this device has kept (a lantern caught and a best time, so both
// tabs have something that waits on signing in). Nothing is fetched from anywhere else, and no relay is reached:
// every WebSocket is answered here.
//
//   npm run build && npm run trial -- trials/sign-in-here.mjs
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const WORLD = "https://arcade.test";
const SIGN_IN = "https://bitlogin.network";
const DIST = join(NSWP, "sites", "arcade", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".webp": "image/webp", ".woff2": "font/woff2" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
const ME = "b".repeat(64);

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got };
  if (!ok) fail.push(name);
};

/** The sign-in address's hidden signer: nobody signed in until the trial says so. */
const signerPage = `<!doctype html><meta charset="utf-8"><title>stand-in signer</title><script>
const WORLD = ${JSON.stringify(WORLD)};
let who = null;
const say = (m) => parent.postMessage({ nswp: "nswp-signer", v: 1, ...m }, WORLD);
const state = (id) => say({ t: "state", ...(id ? { id } : {}), unlocked: !!who, ...(who ? { pubkey: who, name: "Trial visitor", remembered: true } : {}) });
window.__signIn = (pubkey) => { who = pubkey; state(); };
addEventListener("message", (e) => {
  const d = e.data;
  if (e.origin !== WORLD || !d || d.nswp !== "nswp-signer") return;
  if (d.t === "state") return state(d.id);
  if (d.t === "lock") { who = null; return state(); }
});
say({ t: "ready" });
</script>`;

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
  // What this device kept as a guest: a lantern caught, and a best time on the board. Read by the kit as it starts.
  await ctx.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (/^nswp:achievements:.*:guest$/.test(key)) return JSON.stringify({ earned: ["first-lantern"], shown: [] });
      if (/^nswp:scores:.*:guest$/.test(key)) return JSON.stringify({ "lantern-run": { best: 42000 } });
      return get.call(this, key);
    };
  });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
    ws.onMessage((m) => {
      let msg;
      try { msg = JSON.parse(String(m)); } catch { return; }
      if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]]));
    });
  });
  const windows = [];
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === SIGN_IN) {
      if (url.pathname === "/signer/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: signerPage });
      if (url.pathname === "/connect/") {
        windows.push(url.pathname);
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>stand-in sign-in window</title><p>Nothing is asked here." });
      }
      return route.abort();
    }
    if (url.origin !== WORLD) return route.abort();
    const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  const page = await ctx.newPage();
  const popups = [];
  page.on("popup", (p) => popups.push(p));
  await page.goto(`${WORLD}/`, { timeout: 60000 });
  await page.waitForFunction(() => window.__nswpTest?.state?.ready === true && document.querySelector("nswp-hud"), null, { timeout: 60000 });
  await page.waitForFunction(() => window.__nswpTest.signer?.()?.state === "locked", null, { timeout: 20000 }).catch(() => {});
  const first = await page.evaluate(() => window.__nswpTest.signer?.()?.state ?? null);
  check("the world's signer is there, and nobody is signed in", first === "locked", first);

  /** Every tab shown, what it says, and its rows in order. */
  const tabs = () =>
    page.evaluate(() =>
      window.__nswpTest.controls.view().sections.map((s) => ({ id: s.id, note: s.note, items: s.items.map((i) => ({ id: i.id, label: i.label })) })),
    );
  /**
   * A tab shown that tells the visitor to sign in, in its words or a row's: not You, whose own row is the sign-in. A
   * tab with no rows isn't shown (Bag, Following and Messages for a guest), so its words are never read.
   */
  const says = (t) => t.id !== "you" && t.items.length > 0 && (/\bSign in\b/.test(t.note) || t.items.some((i) => !i.id.startsWith("sign-in-") && /\bSign in\b/.test(i.label)));

  const out = await tabs();
  const asking = out.filter(says);
  check("signed out: Achievements and Scores both say to sign in", ["achievements", "scores"].every((id) => asking.some((t) => t.id === id)), asking.map((t) => t.id));
  check(
    "signed out: every tab that says to sign in has the Sign in row, at its top",
    asking.length > 0 && asking.every((t) => t.items[0]?.id === `sign-in-${t.id}`),
    asking.map((t) => ({ id: t.id, first: t.items[0]?.id })),
  );
  check("signed out: the row says whose sign-in it is, as You's does", asking.every((t) => t.items[0]?.label === "Sign in, at bitlogin.network"), asking.map((t) => t.items[0]?.label));
  check("no tab that doesn't say to sign in has the row", out.filter((t) => !says(t)).every((t) => !t.items.some((i) => i.id.startsWith("sign-in-"))), out.filter((t) => !says(t) && t.items.some((i) => i.id.startsWith("sign-in-"))).map((t) => t.id));

  // One real press, in the Achievements tab: the sign-in window opens, as from You's row.
  await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "achievements"));
  await page.waitForTimeout(600);
  const at = await page.evaluate(() => {
    const row = [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].find((b) => /Sign in, at bitlogin\.network/.test(b.textContent));
    if (!row) return null;
    const r = row.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  check("the row is drawn in the open tab", !!at, at);
  const said = [];
  await page.exposeFunction("__said", (t) => said.push(t));
  await page.evaluate(() => window.__nswpTest.controls.onSay((t) => window.__said(t)));
  if (at) {
    await page.mouse.click(at[0], at[1]);
    await page.waitForTimeout(1500);
  }
  check("one press opens the sign-in window", popups.length === 1 && windows.length === 1, { popups: popups.length, windows });
  check("and says so, as You's row does", said.includes("A window from bitlogin.network has opened. Say yes there, and you are signed in here."), said);

  // Signed in, at the sign-in address: no such row anywhere.
  for (const p of popups) await p.close().catch(() => {});
  await page.bringToFront();
  await page.frames().find((f) => f.url().startsWith(SIGN_IN))?.evaluate((k) => window.__signIn(k), ME);
  await page.waitForFunction(() => window.__nswpTest.signer?.()?.state === "unlocked", null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  const after = await tabs();
  check("signed in: no Sign in row in any tab", after.every((t) => !t.items.some((i) => i.id.startsWith("sign-in-"))), after.filter((t) => t.items.some((i) => i.id.startsWith("sign-in-"))).map((t) => t.id));
  check("signed in: You's row says so", after.find((t) => t.id === "you")?.items.some((i) => /^Signed in as /.test(i.label)), after.find((t) => t.id === "you")?.items.map((i) => i.label));
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const total = Object.keys(results).length;
console.log(fail.length ? `\n${fail.length} of ${total} checks failed: ${fail.join("; ")}` : `\nall ${total} checks passed`);
process.exit(fail.length ? 1 : 0);
