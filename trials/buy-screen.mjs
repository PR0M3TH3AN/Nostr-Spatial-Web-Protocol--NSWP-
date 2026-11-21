// BitLogin's own buy screen, tried on this machine only: its local copy (https://${HOST}:4311), shown as a
// panel by the local page that keeps the screen over the local Gallery, buying a test listing from BitUnlock's
// sandbox with pretend sats.
//
// The owner allowed one thing for this (2026-11-21, asked "May my test browser make a throwaway BitLogin account on
// the local copy to try the buy screen?": "yes you may"): a throwaway account, made here, on the local copy only.
// So that nothing of it leaves this machine: every request to anywhere but this machine's own address is refused,
// every relay is the stand-in relay on this machine, the passkey is a pretend one held by this browser, and no
// wallet is made. Never run this against bitlogin.network or its beta address.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { default: WebSocket } = await import(`${NSWP}/node_modules/ws/wrapper.mjs`);
export const SHELL = `https://${HOST}:4300`, WORLD = `https://${HOST}:4301`, SIGNIN = `https://${HOST}:4311`, SANDBOX = `https://${HOST}:4312`;
// The sandbox's own key, as it says it: never written here, since each sandbox makes its own.
export const SANDBOX_KEY = process.env.SANDBOX_KEY ?? (await fetch(`${SANDBOX}/health`).then((r) => r.json()).then((h) => (h.sandbox === true ? h.servicePubkey : null)).catch(() => null));
if (!/^[0-9a-f]{64}$/.test(SANDBOX_KEY ?? "")) throw new Error(`No sandbox answered at ${SANDBOX}. Start BitUnlock's sandbox there, and run this with NODE_EXTRA_CA_CERTS set (see trials/README.md).`);
export const LIVE_KEY = "66be61cf5b8d286391f7b1a72ffa7c799ec2dc49eff0830c40df1cc964e6787d";
const RELAY = "ws://127.0.0.1:4313";

export async function open({ viewport = { width: 1440, height: 900 }, believeSandbox = true } = {}) {
  const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport });
  // A page this rewrites as it is fetched counts, to the browser, as having come from the internet, and is then
  // refused a request to this machine's own network unless that is allowed (found by BitLogin's session).
  await ctx.grantPermissions(["local-network-access"]).catch(() => undefined);
  const refused = new Set();
  const errors = [];
  // Nothing leaves this machine. BitLogin's three pages are told of the test service as they are fetched (nothing on
  // disk changes); the world's copy of the kit is told to believe the sandbox's key, which the shipped kit refuses.
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    // A world's real address is answered by its copy on this machine, so even the question never leaves.
    const copy = { "gallery.bitblocks.network": 4301, "grove.bitblocks.network": 4302, "tour.bitblocks.network": 4303, "portal.bitblocks.network": 4300 }[url.hostname];
    if (copy) {
      try {
        const res = await route.fetch({ url: `https://${HOST}:${copy}${url.pathname}${url.search}` });
        return route.fulfill({ response: res, headers: { ...res.headers(), "access-control-allow-origin": "*" } });
      } catch { return route.abort(); }
    }
    if (url.hostname !== HOST) { refused.add(url.origin); return route.abort(); }
    if (url.port === "4311" && /^\/(connect\/|connect\/panel\/|signer\/)(index\.html)?$/.test(url.pathname)) {
      const res = await route.fetch();
      let html = await res.text();
      const attrs = ` data-unlock-service="${SANDBOX}|${SANDBOX_KEY}"${/^\/connect\//.test(url.pathname) ? ` data-listing-relays="wss://${HOST}:4314"` : ""}`;
      html = html.replace(/<html(\s|>)/i, `<html${attrs}$1`);
      return route.fulfill({ response: res, body: html });
    }
    if (believeSandbox && url.port !== "4311" && url.port !== "4312" && url.pathname === "/app.js") {
      const res = await route.fetch();
      const js = await res.text();
      if (!js.includes(LIVE_KEY)) return route.fulfill({ response: res, body: js });
      return route.fulfill({ response: res, body: js.replaceAll(LIVE_KEY, SANDBOX_KEY).replaceAll("https://api.bitunlock.network", SANDBOX) });
    }
    return route.continue();
  });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
    const up = new WebSocket(RELAY);
    const waiting = [];
    up.on("open", () => { for (const m of waiting.splice(0)) up.send(m); });
    up.on("message", (m) => { try { ws.send(String(m)); } catch { /* gone */ } });
    up.on("error", () => {});
    ws.onMessage((m) => (up.readyState === 1 ? up.send(m) : waiting.push(m)));
    ws.onClose(() => up.close());
  });
  const page = await ctx.newPage();
  const trail = [];
  page.on("framenavigated", (f) => trail.push(`${Date.now() % 100000} ${f === page.mainFrame() ? "TOP" : "frame"} ${f.url().slice(0, 100)}`));
  page.on("requestfailed", (q) => { if (!/bitblocks\.network|fonts\./.test(q.url())) trail.push(`${Date.now() % 100000} FAILED ${q.url().slice(0, 100)} ${q.failure()?.errorText}`); });
  const popups = [];
  page.on("popup", (p) => popups.push(p.url()));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|ERR_ABORTED|net::|WebSocket/.test(m.text())) errors.push(m.text().slice(0, 240)); });
  const until = async (fn, ms = 150000, every = 300) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(every); } return null; };
  const frame = () => page.frames().find((f) => f.parentFrame() === page.mainFrame() && !/:4311\//.test(f.url()));
  const panelFrame = () => page.frames().find((f) => /:4311\/connect\/panel/.test(f.url()));
  const panelBox = () => page.evaluate(() => { const box = document.querySelector(".shell-panel"); if (!box) return null; const b = box.getBoundingClientRect(); return { src: box.querySelector("iframe").src, waiting: "waiting" in box.dataset, width: Math.round(b.width), height: Math.round(b.height) }; });
  const says = async () => { const f = panelFrame(); if (!f) return null; return f.evaluate(() => ({ text: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 1500), buttons: [...document.querySelectorAll("button, [role=button], a[href], input, select, textarea")].filter((b) => b.offsetParent !== null).map((b) => `${b.tagName.toLowerCase()}${b.type ? `[${b.type}]` : ""}: ${(b.innerText || b.getAttribute("aria-label") || b.placeholder || b.name || "").trim().slice(0, 60)}`) })).catch((e) => ({ text: String(e).slice(0, 120), buttons: [] })); };
  // A pretend passkey, held by this browser, for whichever frame asks.
  const passkeys = new Set();
  const pretendPasskey = async (target) => {
    if (!target || passkeys.has(target)) return;
    passkeys.add(target);
    const cdp = await ctx.newCDPSession(target);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", ctap2Version: "ctap2_1", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true, hasLargeBlob: false } });
  };
  await page.goto(`${SHELL}/shell/`);
  await until(() => frame()?.evaluate(() => window.__bitportalTest?.state?.ready === true));
  const doors = await frame().evaluate(() => window.__bitportalTest.doors());
  await frame().evaluate((id) => window.__bitportalTest.visit(id), doors.find((d) => /Gallery/.test(d.title)).id);
  await until(async () => { const f = frame(); const u = new URL(f.url()); if (/\/go\//.test(u.pathname)) await f.click("#continue", { timeout: 400 }).catch(() => null); return u.port === "4301" && (await f.evaluate(() => !!window.__nswpTest?.controls && window.__nswpTest.crossing() === "none")); });
  await page.waitForTimeout(2500);
  const rows = () => frame().evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "you")?.items.map((i) => i.label) ?? []);
  const press = async (name) => { await frame().evaluate(() => window.__nswpTest.hud.setOpen(true, "you")); await page.waitForTimeout(500); await page.frameLocator("#view").locator("nswp-hud").getByRole("button", { name }).first().click(); };
  // What the world's own signer is asked, as the world would: `buy` or `have` for a listing. Not waited for here.
  const ask = (what, listing) => frame().evaluate(([w, l]) => { const s = window.__nswpTest.signer(); window.__asked = window.__asked ?? {}; window.__asked[w] = "waiting"; void s[w](l).then((got) => (window.__asked[w] = got ?? null), (e) => (window.__asked[w] = { threw: String(e) })); return { state: s.state, pubkey: s.pubkey ?? null }; }, [what, listing]);
  const answer = (what) => frame().evaluate((w) => window.__asked?.[w], what);
  return { ask, answer, trail, browser, ctx, page, until, frame, panelFrame, panelBox, says, rows, press, pretendPasskey, refused, errors, popups, shot: (name) => page.screenshot({ path: `${SHOTS}/${name}.png` }) };
}

