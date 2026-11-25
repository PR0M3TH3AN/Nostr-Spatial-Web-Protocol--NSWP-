// The live sites after a deploy, read-only: each is on the kit this repository is at (or WANT=<a version>),
// the page that keeps the screen is the way in, and BitLogin's real panel opens and closes. Read-only: nobody signs in, no account is made, and websockets are
// refused, so nothing reaches a relay. BitLogin's real panel is opened, looked at, and closed.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const WANT = process.env.WANT ?? (await import(`${NSWP}/packages/core/dist/index.js`)).KIT_VERSION;
const PORTAL = "https://portal.bitblocks.network", SIGNIN = "https://bitlogin.network";
const r = {}; const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
r.marks = {};
for (const name of ["gallery", "grove", "tour", "arcade", "observatory", "workshop", "library", "starter", "foundry", "portal"]) {
  try {
    const res = await fetch(name === "portal" ? `${PORTAL}/walk/` : `https://${name}.bitblocks.network/`);
    const mark = /<meta name="nswp-built" content="([^"]*)">/.exec(await res.text())?.[1] ?? null;
    r.marks[name] = mark?.split(" ")[0] ?? `none (${res.status})`;
    if (!mark?.startsWith(WANT)) bad.push(`${name}: page mark ${mark}`);
  } catch (e) { r.marks[name] = String(e).slice(0, 80); bad.push(`${name}: ${r.marks[name]}`); }
}
const shellHeaders = await fetch(`${PORTAL}/shell/`).then((x) => x.headers.get("permissions-policy") ?? "");
want("0 the page that keeps the screen hands passkeys to the sign-in address", /publickey-credentials-get=\(self "https:\/\/bitlogin\.network"\)/.test(shellHeaders), true);
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [name, opts, start] of [["desktop", { viewport: { width: 1440, height: 900 } }, "/walk/"], ["mobile", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36" }, "/shell/"]]) {
  const ctx = await browser.newContext(opts);
  await ctx.routeWebSocket(/^wss:\/\//, (ws) => ws.close());
  const page = await ctx.newPage();
  const popups = []; const errors = [];
  // How often the panel's own Close didn't close it, and a press outside had to. That press also puts the menu
  // away, so a check after it that wants the menu back says more about the trial than about the site.
  let closedOutside = 0;
  page.on("popup", (p) => popups.push(p.url()));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`${PORTAL}${start}`, { timeout: 90000 });
  const frame = () => page.frames().find((f) => f.parentFrame() === page.mainFrame() && new URL(f.url()).origin !== SIGNIN);
  const until = async (fn, ms = 180000) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch {} await page.waitForTimeout(400); } return null; };
  await until(() => frame()?.evaluate(() => window.__bitportalTest?.state?.ready === true));
  want(`${name} 1 the room is inside the page that keeps the screen`, [new URL(page.url()).pathname, frame() ? new URL(frame().url()).pathname : null], ["/shell/", "/walk/"]);
  const rowsOf = (t) => frame().evaluate((t) => window[t].controls.view().sections.find((s) => s.id === "you")?.items.map((i) => i.label) ?? null, t);
  const sheet = () => frame().evaluate(() => { const sh = document.querySelector("nswp-hud").shadowRoot; const s = sh.querySelector(".sheet"); return s.hidden ? null : (sh.querySelector('.tabs [aria-selected="true"]')?.textContent.trim() ?? "?"); });
  // The shell keeps BitLogin's panel between openings, so that the next one is up at once: closed, its box stays,
  // marked `data-kept`. A kept box is a closed panel, and is read as one here. (It used to be read as open: the
  // trial then never saw the panel close, pressed outside to close it, and that press put the menu away.)
  const panel = () => page.evaluate(() => { const box = document.querySelector(".shell-panel"); if (!box || "kept" in box.dataset) return null; const b = box.getBoundingClientRect(); return { src: box.querySelector("iframe").src, waiting: "waiting" in box.dataset, size: [Math.round(b.left), Math.round(b.width), Math.round(innerHeight - b.bottom), Math.round(b.height)] }; });
  // What is left of a closed panel: nothing at all, or a kept box that can't be seen and takes no press. Asked of
  // the page as it is drawn: what the browser says of the box, and what is on top at the box's own middle.
  const closedPanel = () => page.evaluate(() => {
    const box = document.querySelector(".shell-panel");
    if (!box) return "gone";
    if (!("kept" in box.dataset)) return "still open";
    const style = getComputedStyle(box);
    const at = box.getBoundingClientRect();
    const top = at.width && at.height ? document.elementFromPoint(at.left + at.width / 2, at.top + at.height / 2) : null;
    const seen = style.visibility !== "hidden" && style.display !== "none";
    const pressed = style.pointerEvents !== "none" || (!!top && box.contains(top));
    return seen || pressed ? `kept, but ${[seen ? "it can be seen" : "", pressed ? "it takes presses" : ""].filter(Boolean).join(" and ")}` : "kept, unseen, taking no press";
  });
  const CLOSED = ["gone", "kept, unseen, taking no press"];
  const panelFrame = () => page.frames().find((f) => f.url().startsWith(`${SIGNIN}/connect/panel/`));
  const openRow = async (t, label) => { await frame().evaluate((t) => window[t].hud.setOpen(true, "you"), t); await page.waitForTimeout(700); await page.frameLocator("#view").locator("nswp-hud").getByRole("button", { name: label }).first().click(); const up = await until(async () => { const p = await panel(); return p && !p.waiting ? p : null; }, 12000); await page.waitForTimeout(3000); return up; };
  const closePanel = async () => { const pf = panelFrame(); const x = pf?.getByRole("button", { name: /close|×/i }).first(); if (x && (await x.count())) await pf.evaluate(() => void setTimeout(() => [...document.querySelectorAll("button")].find((b) => /close|×/i.test(b.getAttribute("aria-label") ?? b.textContent))?.click(), 0)).catch(() => null); if (!(await until(async () => (await panel()) === null, 4000))) { closedOutside++; await page.mouse.click(5, 5); await until(async () => (await panel()) === null, 4000); } await page.waitForTimeout(600); };
  const says = async () => (await panelFrame()?.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 260)).catch(() => null)) ?? null;
  // ---- the room's Sign in: BitLogin's real panel, no window. The room inside the shell draws no menu of its own
  // (BitPortal 251): the visitor's menu is the shell's, in the top page (`.shell-menu`), and its You has the Sign in.
  const shellMenu = page.locator(".shell-menu");
  const shellRows = () => shellMenu.getByRole("button").allTextContents().catch(() => []);
  await until(async () => (await shellMenu.count()) > 0, 40000);
  if (name === "desktop") {
    await shellMenu.getByRole("button", { name: /^Menu, M$/ }).first().click();
    await page.waitForTimeout(700);
    await shellMenu.getByRole("tab", { name: /^You$/ }).first().click();
    await page.waitForTimeout(700);
    r[`${name} shell rows`] = (await shellRows()).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
    await shellMenu.getByRole("button", { name: /^Sign in, at bitlogin\.network$/ }).first().click();
    const up = await until(async () => { const p = await panel(); return p && !p.waiting ? p : null; }, 12000);
    await page.waitForTimeout(3000);
    want("desktop 2 the room's Sign in, in the shell's own menu, shows BitLogin's panel in the top page, and opens no window", [!!up, up?.src, popups.length], [true, `${SIGNIN}/connect/panel/`, 0]);
    r["desktop room panel says"] = await says();
    await page.screenshot({ path: `${SHOTS}/live-068-room-panel.png` });
    await closePanel();
    want("desktop 2b closed", await panel(), null);
    r["desktop room panel, once closed"] = await closedPanel();
    want("desktop 2c and what is left of the panel can't be seen or pressed", CLOSED.includes(r["desktop room panel, once closed"]), true);
    await page.keyboard.press("Escape");
  }
  // ---- through a door, into a world: the same there.
  const doors = await frame().evaluate(() => window.__bitportalTest.doors());
  await frame().evaluate((id) => window.__bitportalTest.visit(id), doors.find((d) => /Gallery/.test(d.title)).id);
  await until(async () => { const f = frame(); const u = new URL(f.url()); if (/\/go\//.test(u.pathname)) await f.click("#continue", { timeout: 400 }).catch(() => null); return u.host === "gallery.bitblocks.network" && (await f.evaluate(() => !!window.__nswpTest?.controls && window.__nswpTest.crossing() === "none")); });
  await page.waitForTimeout(2500);
  await until(async () => (await rowsOf("__nswpTest"))?.some((l) => /^Your files, at bitlogin\.network$/.test(l)), 40000);
  const rows = await rowsOf("__nswpTest");
  want(`${name} 3 in the Gallery, still inside it, with the three rows`, [new URL(page.url()).pathname, ["Sign in, at bitlogin.network", "Your account, at bitlogin.network", "Your files, at bitlogin.network"].map((l) => rows?.includes(l))], ["/shell/", [true, true, true]]);
  const up = await openRow("__nswpTest", /^Sign in, at /);
  want(`${name} 4 Sign in there shows BitLogin's panel over the world, and opens no window`, [!!up, up?.src, popups.length, await sheet()], [true, `${SIGNIN}/connect/panel/`, 0, null]);
  r[`${name} world panel`] = { size: up?.size, says: await says(), fits: await panelFrame()?.evaluate(() => [innerHeight, document.documentElement.scrollHeight]).catch(() => null) };
  await page.screenshot({ path: `${SHOTS}/live-068-world-panel-${name}.png` });
  await closePanel();
  want(`${name} 5 closed, and the world's menu is back`, [await panel(), await sheet()], [null, "You"]);
  r[`${name} world panel, once closed`] = await closedPanel();
  want(`${name} 5b and what is left of the panel can't be seen or pressed`, CLOSED.includes(r[`${name} world panel, once closed`]), true);
  if (name === "desktop") {
    const files = await openRow("__nswpTest", /^Your files, at /);
    want("desktop 6 Your files shows the panel too", [!!files, popups.length], [true, 0]);
    r["desktop files panel says"] = await says();
    await page.screenshot({ path: `${SHOTS}/live-068-files-panel.png` });
    await closePanel();
    r["desktop files panel, once closed"] = await closedPanel();
    want("desktop 6b closed, and what is left of it can't be seen or pressed", [await panel(), CLOSED.includes(r["desktop files panel, once closed"])], [null, true]);
  }
  r[`${name} closed by a press outside, the panel's own Close having done nothing`] = closedOutside;
  r[`${name} errors`] = errors.slice(0, 5);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(r, null, 1));
if (bad.length) { console.error("\nNOT AS WANTED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
