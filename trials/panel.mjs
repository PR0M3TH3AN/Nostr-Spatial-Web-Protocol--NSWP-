// BitLogin's REAL panel (its local copy), shown by the local page that keeps the screen over the local Gallery,
// at a desk's size and a phone's. Nobody signs in and no account is made; websockets are refused.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const r = {}; const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
const WHERE = process.env.WHERE ?? "world";
for (const [name, opts] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["mobile", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36" }]]) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, ...opts });
  await ctx.routeWebSocket(/^wss:\/\//, (ws) => ws.close());
  const page = await ctx.newPage();
  const popups = []; const errors = [];
  page.on("popup", (p) => popups.push(p.url()));
  page.on("console", (m) => { if (m.type() === "error" && !/WebSocket|websocket|ERR_/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await page.goto(`https://${HOST}:4300/shell/`);
  const frame = () => page.frames().find((f) => f.parentFrame() === page.mainFrame() && !/4311/.test(f.url()));
  const until = async (fn, ms = 150000) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch {} await page.waitForTimeout(300); } return null; };
  await until(() => frame()?.evaluate(() => window.__bitportalTest?.state?.ready === true));
  let T = "__bitportalTest";
  if (WHERE === "world") {
    const doors = await frame().evaluate(() => window.__bitportalTest.doors());
    await frame().evaluate((id) => window.__bitportalTest.visit(id), doors.find((d) => /Gallery/.test(d.title)).id);
    await until(async () => { const f = frame(); const u = new URL(f.url()); if (/\/go\//.test(u.pathname)) await f.click("#continue", { timeout: 400 }).catch(() => null); return u.port === "4301" && (await f.evaluate(() => !!window.__nswpTest?.controls && window.__nswpTest.crossing() === "none")); });
    T = "__nswpTest";
  }
  await page.waitForTimeout(2500);
  const rows = () => frame().evaluate((t) => window[t].controls.view().sections.find((s) => s.id === "you")?.items.map((i) => i.label) ?? null, T);
  await until(async () => (await rows())?.some((l) => /^Sign in, at/.test(l)), 40000);
  const sheet = () => frame().evaluate(() => { const sh = document.querySelector("nswp-hud").shadowRoot; const s = sh.querySelector(".sheet"); if (s.hidden) return null; const b = s.getBoundingClientRect(); return { tab: sh.querySelector('.tabs [aria-selected="true"]')?.textContent.trim(), left: Math.round(b.left), width: Math.round(b.width), bottom: Math.round(innerHeight - b.bottom) }; });
  const panel = () => page.evaluate(() => { const box = document.querySelector(".shell-panel"); if (!box) return null; const b = box.getBoundingClientRect(); return { src: box.querySelector("iframe").src, waiting: "waiting" in box.dataset, left: Math.round(b.left), width: Math.round(b.width), bottom: Math.round(innerHeight - b.bottom), height: Math.round(b.height) }; });
  await frame().evaluate((t) => window[t].hud.setOpen(true, "you"), T);
  await page.waitForTimeout(600);
  const menuWas = await sheet();
  await page.frameLocator("#view").locator("nswp-hud").getByRole("button", { name: /^Sign in, at/ }).first().click();
  const up = await until(async () => { const p = await panel(); return p && !p.waiting ? p : null; }, 9000);
  await page.waitForTimeout(2500);
  const p = await panel();
  want(`${name} 1 BitLogin's own panel came up, and no window`, [!!up, p?.src, popups.length], [true, `https://${HOST}:4311/connect/panel/`, 0]);
  want(`${name} 2 at the menu's place, with the menu stepped aside`, [[p?.left, p?.width], [menuWas?.left, menuWas?.width], await sheet()], [[menuWas.left, menuWas.width], [menuWas.left, menuWas.width], null]);
  const pf = page.frames().find((f) => /4311\/connect\/panel/.test(f.url()));
  r[`${name} size`] = p && [p.left, p.width, p.bottom, p.height];
  r[`${name} says`] = pf ? (await pf.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 700)).catch((e) => String(e).slice(0, 100))) : null;
  r[`${name} fits`] = pf ? await pf.evaluate(() => ({ w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight })).catch(() => null) : null;
  await page.screenshot({ path: `${SHOTS}/panel-real-${WHERE}-${name}.png` });
  // Its own way out.
  if (pf) {
    const close = pf.getByRole("button", { name: /close/i }).first();
    if (await close.count()) { await close.click({ timeout: 4000 }).catch(() => null); }
    else await page.mouse.click(6, 6);
  }
  if (!(await until(async () => (await panel()) === null, 4000))) { await page.mouse.click(6, 6); await until(async () => (await panel()) === null, 4000); }
  await page.waitForTimeout(700);
  want(`${name} 3 closed, and the menu is back`, [await panel(), (await sheet())?.tab], [null, "You"]);
  r[`${name} errors`] = errors.slice(0, 5);
  await ctx.close();
}
console.log(JSON.stringify(r, null, 1));
await browser.close();
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
