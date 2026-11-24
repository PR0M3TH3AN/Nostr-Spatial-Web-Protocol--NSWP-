// The two kinds of row the menu does itself (docs/plans/the-clients-menu.md, section 4; protocol/02-doors.md, "Two
// kinds of row the client does itself"): a row typed into (`field`) and a row that copies (`copy`), as the kit's own
// menu draws them.
//
// What is real: this checkout's own build of the Gallery (sites/gallery/dist, so run `npm run build` first), opened
// by its address in a real Chrome, its own menu, and a real keyboard and mouse. What is a stand-in: the two rows,
// which this script adds to the Gallery's Room tab through its test hook (nothing in the Gallery is of either kind
// for a guest), and the site's name, served by this script. Nothing is fetched from anywhere else.
//
//   npm run build && node trials/menu-rows.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { mkdirSync } = await import("node:fs");

const WORLD = "https://gallery.test";
const DIST = join(NSWP, "sites", "gallery", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".txt": "text/plain" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
mkdirSync(SHOTS, { recursive: true });

// The longest line the kit can say for a moment, found from its code as this runs: every place it says something
// with words written there. A name put into the words as they are said (a host's) is stood in for by a real one.
const LONGEST = (() => {
  const found = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".ts")) for (const m of readFileSync(p, "utf8").matchAll(/(?:\.say|tell|_say)\((`[^`]*`|"[^"]*")/g)) found.push({ from: p.slice(NSWP.length + 1), words: m[1].slice(1, -1) }); } };
  walk(join(NSWP, "packages", "sdk", "src"));
  walk(join(NSWP, "sites", "shared"));
  const said = found.map((f) => ({ from: f.from, words: f.words.replace(/\$\{[^}]*\}/g, "bitlogin.network") })).sort((a, b) => b.words.length - a.words.length);
  return { ...said[0], of: said.length };
})();

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got };
  if (!ok) fail.push(name);
};

// Chrome draws with this machine's graphics card, as a visitor's does and as the client's-menu trial does. Drawn
// without one (`--software`) the page manages a frame or two a second, and everything on it waits behind a frame.
const SOFTWARE = process.argv.includes("--software");
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: SOFTWARE ? [] : ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: WORLD });
  const sockets = new Set();
  // No relay is reached: every WebSocket is answered here, with nothing, and its address kept to be listed.
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
    sockets.add(new URL(ws.url()).host);
    ws.onMessage((m) => {
      let msg;
      try { msg = JSON.parse(String(m)); } catch { return; }
      if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]]));
    });
  });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== WORLD) return route.abort();
    const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  const page = await ctx.newPage();
  // What in fact drew the page, asked of the browser: a machine with no card to use draws without one whatever is asked.
  {
    const probe = await ctx.newPage();
    results["what drew the page"] = await probe.evaluate(() => { const gl = document.createElement("canvas").getContext("webgl2"); const info = gl?.getExtension("WEBGL_debug_renderer_info"); return gl ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : "no WebGL at all"; }).catch((e) => `not known: ${String(e).slice(0, 80)}`);
    await probe.close();
    const without = /swiftshader|llvmpipe|software|softpipe/i.test(results["what drew the page"]);
    results["drawn without the graphics card"] = SOFTWARE ? "yes, as asked (--software)" : without ? "YES, THOUGH THE CARD WAS ASKED FOR: this machine gave Chrome none" : "no";
    process.stderr.write(`drawn by: ${results["what drew the page"]}${SOFTWARE ? " (--software)" : without ? " — NOT THE GRAPHICS CARD, though it was asked for" : ""}\n`);
  }
  await page.goto(`${WORLD}/`, { timeout: 60000 });
  await page.waitForFunction(() => window.__nswpTest?.state?.ready === true && document.querySelector("nswp-hud"), null, { timeout: 60000 });

  // Two rows of the world's, in its Room tab, and the menu up on it.
  await page.evaluate(() => {
    window.__got = [];
    const c = window.__nswpTest.controls;
    c.add({ id: "trial-field", section: "room", kind: "field", label: "Add someone by key", act: (typed) => void window.__got.push(["field", typed]) });
    c.add({ id: "trial-copy", section: "room", kind: "copy", copy: "npub1trialkey", label: "Copy the room's key", act: () => void window.__got.push(["copy"]) });
    window.__nswpTest.hud.setOpen(true, "room");
  });
  const hud = page.locator("nswp-hud");
  const box = hud.getByRole("textbox", { name: "Add someone by key" });
  await box.waitFor({ timeout: 10000 });
  check("the row typed into is a box and a button with the row's words", (await hud.getByRole("button", { name: "Add someone by key" }).count()) === 1, null);
  check("it says where what is typed goes", ((await hud.locator(".field .to").textContent()) ?? "") === "What you type here goes to The Gallery.", await hud.locator(".field .to").textContent());
  const attrs = await box.evaluate((el) => ({ autocomplete: el.getAttribute("autocomplete"), maxlength: el.getAttribute("maxlength"), value: el.value, name: el.getAttribute("name") }));
  check("the box is never filled in for them, and has a limit", attrs.autocomplete === "off" && attrs.maxlength === "500" && attrs.value === "" && attrs.name === null, attrs);

  // Typed with a real keyboard, while the world keeps changing what the menu shows (so the menu is drawn again and
  // again under the typing).
  await box.click();
  await page.evaluate(() => {
    let n = 0;
    window.__churn = setInterval(() => window.__nswpTest.controls.setTarget(`A painting ${n++}`), 60);
  });
  await page.keyboard.type("npub1 typed slowly", { delay: 45 });
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type("XY", { delay: 45 });
  await page.evaluate(() => clearInterval(window.__churn));
  check("what is half typed stays, and the place in it, while the menu is drawn again", (await box.inputValue()) === "npub1 typed slowXYly", await box.inputValue());
  check("nothing is given to the row before the press", (await page.evaluate(() => window.__got.length)) === 0, await page.evaluate(() => window.__got));
  check("a letter typed into the box is not the menu's key: the menu is still up", (await page.evaluate(() => window.__nswpTest.hud.open)) === true, null);
  await page.screenshot({ path: join(SHOTS, "menu-rows-field.png") });

  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__got.length === 1, null, { timeout: 5000 }).catch(() => {});
  check("at the press the row is given what was typed", JSON.stringify(await page.evaluate(() => window.__got)) === JSON.stringify([["field", "npub1 typed slowXYly"]]), await page.evaluate(() => window.__got));
  check("and nothing of it is kept in the box", (await box.inputValue()) === "", await box.inputValue());

  // Pressed with nothing typed: nothing happens.
  await hud.getByRole("button", { name: "Add someone by key" }).click();
  await page.waitForTimeout(300);
  check("a press with nothing typed gives the row nothing", (await page.evaluate(() => window.__got.length)) === 1, null);

  // Half typed, and the menu put away: it is gone when the menu comes back.
  await box.click();
  await page.keyboard.type("left behind");
  await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
  await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "room"));
  check("what was half typed is gone once the menu was put away", (await hud.getByRole("textbox", { name: "Add someone by key" }).inputValue()) === "", null);

  // The row that copies.
  await hud.getByRole("button", { name: "Copy the room's key" }).click();
  await page.waitForFunction(() => window.__got.some((g) => g[0] === "copy"), null, { timeout: 5000 }).catch(() => {});
  check("the row that copies writes its text, and the world is told of the press", (await page.evaluate(() => navigator.clipboard.readText())) === "npub1trialkey" && (await page.evaluate(() => window.__got.some((g) => g[0] === "copy"))), await page.evaluate(() => navigator.clipboard.readText().catch((e) => String(e))));

  // ---- Words said for a moment, with the menu up (as "Copied." was, just now). The sheet lies over where they stand
  // with the menu down, on all but the widest screens, so they are in the sheet: in a strip of its own, between
  // its rows and its foot. **A said line never lies over anything that can be pressed**, and nothing in the sheet
  // moves as a line comes or goes: the strip is always there, one line high, blank when nothing is said. One line
  // shows at a time, the newest.
  //
  // This is checked by where things are, not by pressing: every box is read in the page, in one go. Nothing waits a
  // fixed time before a place is read: a line's own coming in, and the sheet's unfolding, are waited for to their
  // end (`settle`), with a limit that fails by name.
  const noLines = () => page.waitForFunction(() => !document.querySelector("nswp-hud").shadowRoot.querySelector(".say"), null, { timeout: 12000 }).catch(() => {});
  /** Put away whatever is said, as a press on it does: where waiting out each line's own time would only be slow. */
  const putAway = () => page.evaluate(() => { for (const line of [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".say")]) line.click(); });
  /** Say these, wait for what is running to end, and read where everything in the sheet is. */
  const sayAndRead = (words, then) =>
    page.evaluate(async ([words, then]) => {
      const t = window.__nswpTest;
      const root = document.querySelector("nswp-hud").shadowRoot;
      const sheet = root.querySelector("section.sheet");
      for (const w of words) t.controls.say(w);
      const newest = [...root.querySelectorAll(".say")].at(-1) ?? null;
      // To the end of what is running on the newest line and on the sheet, and then two frames on: the menu puts the
      // chosen tab in sight a frame after it comes up, and a place read before that is not where the thing ends up.
      const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))));
      const settle = () => Promise.race([Promise.all([...(newest?.getAnimations() ?? []), ...sheet.getAnimations()].map((a) => a.finished.catch(() => null))).then(frames), new Promise((no) => setTimeout(() => no(false), 8000))]);
      let settled = await settle();
      let runningOnceMoved = null;
      if (then) {
        t.hud.setOpen(then === "open", "room");
        runningOnceMoved = newest ? newest.getAnimations().map((a) => a.animationName ?? a.transitionProperty ?? "something") : null;
        settled = (await settle()) && settled;
      }
      const box = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
      const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      const meet = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
      const lines = [...root.querySelectorAll(".say")];
      const shown = lines.filter(seen);
      // Everything in the sheet that can be pressed or typed in: rows, tabs, the foot's buttons, a box.
      const pressable = [...sheet.querySelectorAll('button, [role="tab"], input, textarea, a[href]')].filter((e) => seen(e) && !e.closest(".say"));
      // What of a thing can be seen and pressed: a row scrolled out of the rows' own area is not there to press.
      const area = box(sheet.querySelector(".rows"));
      const part = (e) => { const b = box(e); if (!e.closest(".rows")) return b; const c = [Math.max(b[0], area[0]), Math.max(b[1], area[1]), Math.min(b[2], area[2]), Math.min(b[3], area[3])]; return c[2] > c[0] && c[3] > c[1] ? c : null; };
      // And asked of the browser, at places all over each line: what is on top there, if it is not the line.
      const under = [];
      for (const l of shown) {
        const b = l.getBoundingClientRect();
        for (let ix = 1; ix < 8; ix++) for (let iy = 1; iy < 6; iy++) {
          const top = root.elementFromPoint(b.left + (b.width * ix) / 8, b.top + (b.height * iy) / 6);
          if (top && top !== l && !l.contains(top)) under.push(`${top.tagName} ${(top.textContent || "").trim().slice(0, 24)}`);
        }
      }
      const strip = sheet.querySelector(":scope > .says");
      return {
        settled,
        runningOnceMoved,
        open: t.hud.open,
        said: lines.length,
        shown: shown.map((l) => ({ words: l.textContent, title: l.title, box: box(l), whole: l.scrollHeight <= l.clientHeight + 1 && l.scrollWidth <= l.clientWidth + 1, lines: Math.round((l.clientHeight - parseFloat(getComputedStyle(l).paddingTop) - parseFloat(getComputedStyle(l).paddingBottom)) / parseFloat(getComputedStyle(l).lineHeight)) })),
        under: [...new Set(under)],
        rowsArea: area,
        inStrip: shown.every((l) => !!l.closest("section.sheet > .says")),
        over: shown.flatMap((l) => pressable.filter((p) => { const seenPart = part(p); return !!seenPart && meet(box(l), seenPart); }).map((p) => (p.textContent || p.getAttribute("aria-label") || p.tagName).trim().slice(0, 30))),
        sheet: sheet.hidden ? null : box(sheet),
        strip: strip ? box(strip) : null,
        rows: [...sheet.querySelectorAll(".rows button")].filter(seen).map(box),
        tabs: [...sheet.querySelectorAll('[role="tab"]')].filter(seen).map(box),
        foot: [...sheet.querySelectorAll(".foot button")].filter(seen).map(box),
      };
    }, [words, then ?? ""]);
  const placesOf = (r) => JSON.stringify([r.sheet, r.rows, r.tabs, r.foot]);
  const widthOf = async (width, height) => {
    await page.setViewportSize({ width, height });
    await page.evaluate((w) => new Promise((done) => { const look = () => (innerWidth === w ? requestAnimationFrame(() => done()) : setTimeout(look, 50)); look(); }), width);
  };
  // The Room tab gains a row a few seconds after the world comes up (its sign-in address is refused here, and it
  // says so once it has given up waiting). Waited for, so that what is compared is the same rows throughout.
  await page.waitForFunction(() => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows *")].some((e) => /didn't answer/.test(e.textContent ?? "")), null, { timeout: 30000, polling: 200 }).catch(() => {});
  for (const [at, width, height] of [["a desk's width", 1100, 700], ["a phone's width", 390, 760]]) {
    await widthOf(width, height);
    await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "room"));
    await noLines();
    const blank = await sayAndRead([]);
    check(`at ${at}, the strip is there with nothing said: one line high, between the rows and the foot, and blank`, !!blank.strip && blank.shown.length === 0 && blank.strip[3] - blank.strip[1] >= 24 && blank.strip[3] - blank.strip[1] <= 60 && blank.rows.every((r) => r[3] <= blank.strip[1] + 1) && blank.foot.every((f) => f[1] >= blank.strip[3] - 1), { strip: blank.strip, rows: blank.rows.length, foot: blank.foot });
    await page.screenshot({ path: join(SHOTS, `menu-rows-strip-blank-${width}.png`) });
    for (const n of [1, 2, 3]) {
      await noLines();
      const said = Array.from({ length: n }, (_, i) => `Line ${i + 1} of ${n}, said with the menu up.`);
      const now = await sayAndRead(said);
      check(`at ${at}, with ${n} said: the line's coming in had ended before any place was read`, now.settled === true, { settled: now.settled });
      check(`at ${at}, with ${n} said: one line shows, the newest, in the sheet's strip`, now.said === n && now.shown.length === 1 && now.shown[0].words === said.at(-1) && now.inStrip, { said: now.said, shown: now.shown });
      check(`at ${at}, with ${n} said: the line lies over nothing that can be pressed: no row, no tab, no button`, now.over.length === 0 && now.rows.length > 0 && now.tabs.length > 0 && now.foot.length > 0, now.over);
      check(`at ${at}, with ${n} said: every row, tab and button is where it was, and the sheet is the size it was`, placesOf(now) === placesOf(blank), { blank: [blank.sheet, blank.rows[0]], now: [now.sheet, now.rows[0]] });
      if (n === 1) await page.screenshot({ path: join(SHOTS, `menu-rows-strip-a-line-${width}.png`) });
    }
    await noLines();
    const gone = await sayAndRead([]);
    check(`at ${at}, once the lines have gone, everything is still where it was`, placesOf(gone) === placesOf(blank), null);

    // Long words are shown whole, on up to four lines. What a visitor most needs to read is often long: that others
    // can see they are recording, that their whole screen may show, that pressing Buy again charges nothing. The
    // strip grows for them and the sheet is kept its size, so the room comes from the bottom of the rows' own
    // scrolling area: no row moves, nothing that can be pressed is under the words, and the last rows are out of
    // sight while they show. What is said here is what the kit says, word for word; the last is the longest line
    // the kit can say at all, found from its code as this runs.
    const LONG = [
      ["the recording notice", "Recording, picture only, for up to 30 seconds. Others in the room can see that you are."],
      ["the notice that the way is still shut", "That didn't finish, and the way is still shut. If you did pay, press Buy again: it finds what you paid for and charges nothing more."],
      ["the notice that a screen is shared", "Your screen is offered to this room. It is sent only to people who choose to watch. Share one window if anything else on your screen is private."],
      [`the longest line the kit can say (${LONGEST.from})`, LONGEST.words],
    ];
    const measured = [];
    for (const [name, words] of LONG) {
      await putAway();
      const now = await sayAndRead([words]);
      const line = now.shown[0];
      measured.push(`${words.length} letters, ${name}: ${line?.whole ? `whole, on ${line.lines} line${line.lines === 1 ? "" : "s"}` : "NOT whole"}`);
      check(`at ${at}, ${name} is shown whole: every word of it, with no ellipsis`, now.shown.length === 1 && line.words === words && line.whole === true && line.lines <= 4, line);
      check(`at ${at}, ${name}: nothing that can be pressed is under it, anywhere in its box`, now.under.length === 0 && now.over.length === 0, { under: now.under, over: now.over });
      check(`at ${at}, ${name}: no row, tab or button has moved, and the sheet is the size it was`, placesOf(now) === placesOf(blank), { blank: [blank.sheet, blank.rows.at(-1)], now: [now.sheet, now.rows.at(-1)] });
      if (width < 500 && name !== LONG[3][0]) await page.screenshot({ path: join(SHOTS, `menu-rows-long-${LONG.findIndex((l) => l[0] === name) + 1}-${width}.png`) });
    }
    results[`at ${at}: the long lines, as shown`] = measured;
    // A short line again, and nothing: the strip is back to one line high.
    await putAway();
    const short = await sayAndRead(["Copied."]);
    check(`at ${at}, the strip is one line high again for a line that fits, and with nothing said`, short.strip[3] - short.strip[1] === blank.strip[3] - blank.strip[1] && short.shown[0]?.lines === 1, { short: short.strip, blank: blank.strip });
    await putAway();

    // A press where a row was a moment ago. With long words up, the last rows are out of sight: a press at a place
    // that was a row's, and is now below the rows' own area, is not a press on that row.
    {
      const before = await sayAndRead([]);
      const tall = await sayAndRead([LONG[2][1]]);
      const lineBox = tall.shown[0].box;
      const lost = before.rows.map((r, i) => ({ i, x: (r[0] + r[2]) / 2, y: r[3] - 4 })).filter((p) => p.y > tall.rowsArea[3] + 2).at(-1) ?? null;
      results[`at ${at}: a place that was a row's and is now out of sight`] = lost ? { row: lost.i, at: [Math.round(lost.x), Math.round(lost.y)], rowsNowEndAt: tall.rowsArea[3], line: lineBox } : "none: the rows had room to spare, and none went out of sight";
      if (lost) {
        await page.evaluate((i) => { const row = [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll("section.sheet .rows button")].filter((e) => e.getClientRects().length)[i]; window.__lostRow = 0; row.addEventListener("click", () => window.__lostRow++, true); }, lost.i);
        await page.mouse.click(lost.x, lost.y);
        const after = await sayAndRead([]);
        check(`at ${at}, a press where a row was a moment ago is not a press on that row, and the menu stays up`, (await page.evaluate(() => window.__lostRow)) === 0 && after.open === true, { presses: await page.evaluate(() => window.__lostRow), said: after.said });
      }
      // A press on the words themselves puts them away, and everything is as it was with nothing said.
      const up = await sayAndRead([]);
      if (up.shown.length) {
        const b = up.shown[0].box;
        await page.mouse.click((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
      }
      const cleared = await sayAndRead([]);
      check(`at ${at}, a press on long words puts them away, and the sheet is as it was with nothing said`, cleared.said === 0 && cleared.open === true && placesOf(cleared) === placesOf(blank) && cleared.strip[3] - cleared.strip[1] === blank.strip[3] - blank.strip[1], { said: cleared.said, strip: cleared.strip });
    }
  }
  await widthOf(1100, 700);
  await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "room"));
  await noLines();

  // A press on a line puts it away. There is nothing under it now, so it is a kindness and not a guard.
  {
    const up = await sayAndRead(["Pressed to put it away."]);
    const b = up.shown[0].box;
    await page.mouse.click((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
    const after = await sayAndRead([]);
    check("a press on a line puts it away, and is nothing else: the menu stays up and nothing moves", after.said === 0 && after.open === true && placesOf(after) === placesOf(up), { said: after.said, open: after.open });
  }

  // With the menu down they are where they were: at the lower left, over the view, taking no press. A line still
  // up as the menu goes moves there with it, and is simply there: it doesn't slide and fade in a second time.
  const down = await sayAndRead(["Said as the menu goes."], "close");
  check("moved as the menu went: the line had ended its coming in before its place was read", down.settled === true, { settled: down.settled });
  check("a line already up doesn't come in again when the menu goes: nothing is running on it once moved", JSON.stringify(down.runningOnceMoved) === "[]", down.runningOnceMoved);
  const plain = await sayAndRead(["Said with the menu down."]);
  check("with the menu down, lines are at the lower left as before, stacked, and a line still up went there with them", down.shown.length === 1 && !down.inStrip && down.shown[0].box[0] < 40 && down.shown[0].box[1] > 350 && plain.shown.length === 2 && plain.shown[1].box[0] === down.shown[0].box[0], { down: down.shown, plain: plain.shown });
  // And the other way: a line said with the menu down, still up as the menu comes, is in the strip.
  const raised = await sayAndRead(["Said as the menu comes."], "open");
  check("nor when the menu comes: nothing is running on it once moved, and it is in the strip, over nothing that can be pressed", JSON.stringify(raised.runningOnceMoved) === "[]" && raised.inStrip && raised.shown.length === 1 && raised.over.length === 0, raised);
  await page.screenshot({ path: join(SHOTS, "menu-rows-said-as-the-menu-comes.png") });
  await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
  // A line lasts its moment and goes, wherever it stands.
  await noLines();
  check("and it goes after its moment", (await sayAndRead([])).said === 0, null);

  // ---- One size on every tab (the owner, 2026-11-24: "The menus size should be the same across all tabs. So the
  // tabs always stay at eye level"; docs/backlog/menu-one-size-and-motion.md). The sheet is the size it has on its
  // largest tab, on every tab: going from tab to tab, neither the sheet nor its strip of tabs moves by a pixel.
  // Every tab the menu has is gone to in turn, at a desk's width and at a phone's, and where each thing is is read.
  {
    const where = () => page.evaluate(async () => {
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      const root = document.querySelector("nswp-hud").shadowRoot;
      const sheet = root.querySelector("section.sheet");
      await Promise.all(sheet.getAnimations().map((x) => x.finished.catch(() => null)));
      const box = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((n) => Math.round(n * 10) / 10); };
      const rows = sheet.querySelector(".rows");
      return { sheet: box(sheet), strip: box(sheet.querySelector(".tabs")), foot: box(sheet.querySelector(".foot")), rowsScroll: rows.hidden ? false : rows.scrollHeight > rows.clientHeight + 1, most: parseFloat(getComputedStyle(sheet).maxHeight), tab: sheet.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim() };
    });
    const goTo = (id) => page.evaluate((id) => window.__nswpTest.hud.setOpen(true, id), id);
    const tabsNow = () => page.evaluate(() => window.__nswpTest.controls.view().sections.map((x) => x.id));
    const same = (a, b) => a.every((n, i) => Math.abs(n - b[i]) < 0.6);
    for (const [at, width, height] of [["a desk's width", 1100, 700], ["a phone's width", 390, 760]]) {
      await widthOf(width, height);
      await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
      await page.waitForTimeout(300);
      const tabs = await tabsNow();
      const seen = [];
      for (const id of tabs) {
        await goTo(id);
        await page.waitForTimeout(120);
        seen.push({ id, ...(await where()) });
      }
      const first = seen[0];
      const moved = seen.filter((x) => !same(x.sheet, first.sheet) || !same(x.strip, first.strip) || !same(x.foot, first.foot));
      check(`one size, at ${at}: on every one of its ${tabs.length} tabs the sheet, its strip of tabs and its foot are in the same place, to the pixel`, tabs.length >= 6 && moved.length === 0, { first: { sheet: first.sheet, strip: first.strip }, moved: moved.map((x) => ({ id: x.id, sheet: x.sheet, strip: x.strip })) });
      results[`one size, at ${at}: the sheet, and how many tabs scroll inside it`] = { sheet: first.sheet, tabs: tabs.length, scrolling: seen.filter((x) => x.rowsScroll).map((x) => x.id) };
      check(`one size, at ${at}: the sheet is never taller than it is let be`, first.sheet[3] <= first.most + 0.6, { tall: first.sheet[3], most: first.most });
      // A world adds a tab of its own while the menu is up, longer than the screen: the sheet grows to all it is let
      // be, once, and that tab scrolls inside it. Every tab is then that size.
      await page.evaluate(() => {
        const c = window.__nswpTest.controls;
        if (!c.view().sections.some((x) => x.id === "trial-long")) {
          c.addSection({ id: "trial-long", label: "Long", icon: "save" });
          for (let i = 0; i < 40; i++) c.add({ id: `trial-long-${i}`, section: "trial-long", label: `A row of a long tab, ${i + 1} of 40`, act: () => {} });
        }
      });
      await page.waitForTimeout(300);
      const grown = await where();
      await goTo("trial-long");
      await page.waitForTimeout(150);
      const long = await where();
      check(`one size, at ${at}: a tab longer than the screen makes the sheet all it is let be, and scrolls inside it`, Math.abs(long.sheet[3] - long.most) < 0.6 && long.rowsScroll, { tall: long.sheet[3], most: long.most, scrolls: long.rowsScroll });
      check(`one size, at ${at}: the sheet had grown to that as the tab was added, before it was gone to`, same(grown.sheet, long.sheet) && same(grown.strip, long.strip), { asAdded: grown.sheet, onIt: long.sheet });
      const after = [];
      for (const id of await tabsNow()) {
        await goTo(id);
        await page.waitForTimeout(120);
        after.push({ id, ...(await where()) });
      }
      const movedAfter = after.filter((x) => !same(x.sheet, long.sheet) || !same(x.strip, long.strip) || !same(x.foot, long.foot));
      check(`one size, at ${at}: and every tab is then that size, the strip where it is on the long one`, movedAfter.length === 0, movedAfter.map((x) => ({ id: x.id, sheet: x.sheet, strip: x.strip })));
      // A short tab is not stretched: its rows are their own height, and the room left is above the foot.
      await goTo("help");
      await page.waitForTimeout(150);
      const short = await page.evaluate(() => { const sheet = document.querySelector("nswp-hud").shadowRoot.querySelector("section.sheet"); const rows = sheet.querySelector(".rows"); const room = sheet.querySelector(".room"); return { rows: rows.hidden ? 0 : Math.round(rows.getBoundingClientRect().height), content: rows.hidden ? 0 : rows.scrollHeight, room: Math.round(room.getBoundingClientRect().height) }; });
      results[`one size, at ${at}: on a short tab (Help), its rows and the room left over, in pixels`] = short;
      check(`one size, at ${at}: a short tab's rows are not stretched to fill the sheet`, short.rows <= short.content + 2, short);
      // Taken away again, for what comes after: the long tab goes, and the menu is put away.
      await page.evaluate(() => { const c = window.__nswpTest.controls; for (let i = 0; i < 40; i++) c.remove?.(`trial-long-${i}`); c.removeSection?.("trial-long"); window.__nswpTest.hud.setOpen(false); });
      await page.waitForTimeout(300);
    }
    await widthOf(1100, 700);
    results["one size: the long tab was taken away again"] = !(await tabsNow()).includes("trial-long");
  }

  // ---- A press, with the menu drawn again while it is being made. A press is the mouse going down on a thing and
  // coming up on the same thing; drawing the menu again makes every row anew; so a drawing between the two took the
  // row from under the mouse, and the press was never delivered. It happened whenever anything the menu shows
  // changed during a press: a counter, a picture arriving, a world saying what it is. Now the menu waits for the
  // press to be over, and no longer than a press is.
  await page.evaluate(() => {
    window.__held = { presses: 0, other: 0, own: 0 };
    window.__slide = { at: 20, runs: 0 };
    const c = window.__nswpTest.controls;
    c.add({ id: "trial-held", section: "room", label: () => `Pressed while it changes ${window.__held.own}`, act: () => void window.__held.presses++ });
    c.add({ id: "trial-beside", section: "room", label: () => `A row beside it ${window.__held.other}`, act: () => {} });
    c.add({ id: "trial-slide", section: "room", kind: "slider", icon: "music", label: "A bar to move along", slider: { value: () => window.__slide.at, max: () => 100, text: (v) => String(Math.round(v)) }, act: (to) => { window.__slide.at = Number(to); window.__slide.runs++; } });
    window.__nswpTest.hud.setOpen(true, "room");
    // Each time the list of rows is made anew, counted: what a drawing of the menu comes to.
    window.__drawn = 0;
    new MutationObserver((records) => { window.__drawn += records.some((r) => r.type === "childList") ? 1 : 0; }).observe(document.querySelector("nswp-hud").shadowRoot.querySelector(".rows"), { childList: true });
  });
  const heldRow = hud.getByRole("button", { name: /Pressed while it changes/ }).first();
  await heldRow.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(700);
  /** Tell the menu something it shows has changed, as a counter ticking or a picture arriving does. */
  const somethingChanges = (what) => page.evaluate((what) => { if (what) window.__held[what]++; const c = window.__nswpTest.controls; c.setTheme({ scale: c.theme.scale }, true); }, what);
  const rowWords = () => page.evaluate(() => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].map((b) => b.textContent.trim().slice(0, 40)));
  const mouseDownOn = async (thing) => { const at = await thing.boundingBox(); await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2); await page.mouse.down(); return at; };

  for (const [what, change] of [
    ["another row's words change", "other"],
    ["the pressed row's own words change", "own"],
  ]) {
    const before = await page.evaluate(() => window.__held.presses);
    await mouseDownOn(heldRow);
    await somethingChanges(change);
    await page.waitForTimeout(80);
    await page.mouse.up();
    const heard = await page.waitForFunction((n) => window.__held.presses === n + 1, before, { timeout: 3000 }).then(() => true, () => false);
    check(`a press is still a press when ${what} while it is made`, heard, await page.evaluate(() => window.__held));
  }

  // 1. A change that came during a press is not dropped: it is drawn as soon as the press is over, and once.
  {
    await page.waitForTimeout(600);
    await mouseDownOn(heldRow);
    await somethingChanges("other");
    await page.waitForTimeout(80);
    const during = await page.evaluate(() => { window.__drawn = 0; return [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => /A row beside it 2/.test(b.textContent)); });
    await page.mouse.up();
    const shown = await page.waitForFunction(() => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => /A row beside it 2/.test(b.textContent)), null, { timeout: 2000 }).then(() => true, () => false);
    await page.waitForTimeout(900);
    const drawn = await page.evaluate(() => window.__drawn);
    check("what changed during a press is not drawn while the press is being made", during === false, during);
    check("it is drawn as soon as the press is over", shown, await rowWords());
    // The press itself changes nothing these rows show, so one drawing is the whole of what was owed.
    check("and drawn once: one drawing of the rows, not one for each thing that asked meanwhile", drawn === 1, drawn);
  }

  // 2. The menu is never held still for long. A press that never ends is not waited for: the mouse goes down and
  // stays down, and what changed is drawn without the button ever coming up, a little after a press's own length.
  {
    await page.waitForTimeout(600);
    await mouseDownOn(heldRow);
    const waited = await page.evaluate(async () => {
      const shows = (n) => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`));
      const next = ++window.__held.other;
      const c = window.__nswpTest.controls;
      c.setTheme({ scale: c.theme.scale }, true);
      const began = performance.now();
      while (!shows(next) && performance.now() - began < 6000) await new Promise((done) => setTimeout(done, 20));
      return { shown: shows(next), after: Math.round(performance.now() - began) };
    });
    await page.mouse.up();
    check("a press that never ends is not waited for: held down, the menu is drawn again after a press's length and within three seconds", waited.shown && waited.after > 700 && waited.after < 3000, waited);
    results["how long the menu waited on a press that never ended, in ms"] = waited.after;
  }
  // The pointer taken off the page with its button still down: not waited for either, however the browser tells it.
  {
    await page.waitForTimeout(600);
    await mouseDownOn(heldRow);
    await page.mouse.move(-20, -20);
    const next = (await page.evaluate(() => window.__held.other)) + 1;
    await somethingChanges("other");
    const drawnAnyway = await page.waitForFunction((n) => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`)), next, { timeout: 3000, polling: 50 }).then(() => true, () => false);
    await page.mouse.up();
    check("nor a pointer taken off the page with its button down", drawnAnyway, await rowWords());
  }
  // And it is let go at once when the press is cancelled, or the page loses the keys: said to the page as the
  // browser says them (a finger that began to scroll; another window brought to the front).
  for (const [what, event] of [["the press is cancelled", "pointercancel"], ["the page loses the keys", "blur"]]) {
    await page.waitForTimeout(600);
    await mouseDownOn(heldRow);
    // Told of the change, held, let go and drawn, all timed inside the page by its own clock: how soon after the
    // word from the browser the change is on the page. Well inside the time a press is waited for at all.
    const went = await page.evaluate(async (event) => {
      const shows = (n) => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`));
      const next = ++window.__held.other;
      const c = window.__nswpTest.controls;
      c.setTheme({ scale: c.theme.scale }, true);
      await new Promise((done) => setTimeout(done, 60));
      const held = !shows(next);
      const began = performance.now();
      window.dispatchEvent(event === "blur" ? new Event("blur") : new PointerEvent(event, { bubbles: true }));
      while (!shows(next) && performance.now() - began < 1000) await new Promise((done) => setTimeout(done, 10));
      return { held, shown: shows(next), after: Math.round(performance.now() - began) };
    }, event);
    await page.mouse.up();
    // "At once" is well inside a press's own length (1.2 s): a page that draws slowly is a little late with everything.
    // Drawn without a graphics card, the page is late with everything by up to a frame of its own, which is as long
    // as a press is waited for: there the time is said, and not held to.
    check(`the menu is let go at once when ${what}, with the button still down`, went.held && went.shown && (SOFTWARE || went.after < 400), went);
  }

  // 3. A bar being moved along is not held up, and is not let go of. Drawn again under the pointer, a bar was let go
  // of by the browser and stayed where it had got to. So the menu waits for a bar as it waits for a press, for
  // longer: the mouse takes hold of the bar, the menu is told something changed, the bar is moved along and let go.
  {
    await page.waitForTimeout(600);
    const bar = hud.locator(".slide input").first();
    // Brought into sight by the page itself (the list of rows scrolls), and found only once it is what the mouse
    // would land on a fifth of the way along it.
    let at = null;
    for (const end = Date.now() + 10000; Date.now() < end && !at; ) {
      at = await bar.evaluate((el) => { el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); const top = el.getRootNode().elementFromPoint(r.left + r.width * 0.2, r.top + r.height / 2); return top === el ? { x: r.left, y: r.top, width: r.width, height: r.height } : null; }).catch(() => null);
      if (!at) await page.waitForTimeout(150);
    }
    check("the bar is in sight, where the mouse can take hold of it", !!at, at);
    if (!at) throw new Error("the bar could not be brought into sight");
    const next = (await page.evaluate(() => window.__held.other)) + 1;
    await page.mouse.move(at.x + at.width * 0.2, at.y + at.height / 2);
    await page.mouse.down();
    // Told of the change and looked at a moment later, inside the page by its own clock: with the bar held, what
    // changed has waited.
    const heldBack = await page.evaluate(async (n) => {
      window.__held.other++;
      const c = window.__nswpTest.controls;
      c.setTheme({ scale: c.theme.scale }, true);
      await new Promise((done) => setTimeout(done, 300));
      return ![...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`));
    }, next);
    await page.mouse.move(at.x + at.width * 0.5, at.y + at.height / 2, { steps: 4 });
    await page.mouse.move(at.x + at.width * 0.8, at.y + at.height / 2, { steps: 4 });
    const alongAt = await bar.evaluate((el) => Number(el.value));
    await page.mouse.up();
    const moved = await page.waitForFunction(() => window.__slide.runs > 0 && window.__slide.at > 60, null, { timeout: 3000, polling: 50 }).then(() => true, () => false);
    check("a bar moved along while the menu is told something changed goes where it is put: it is not let go of", moved && alongAt > 60, { slide: await page.evaluate(() => window.__slide), alongAt });
    check("its own movement is not held up: the bar is along with the mouse while the mouse is still down", alongAt > 60, alongAt);
    check("and what changed meanwhile waited for the bar, and is drawn once it is let go", heldBack && (await page.waitForFunction((n) => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`)), next, { timeout: 2000, polling: 50 }).then(() => true, () => false)), { heldBack, rows: await rowWords() });
  }
  // 4. The same with the space bar. A row that has the keys is pressed by the bar going down and coming up on it.
  // Drawn again between the two, the row that had the keys is gone, and the bar comes up on nothing. A real keyboard:
  // the row is given the keys, and the bar is put down and let up by the browser's own keyboard.
  const hasTheKeys = () => page.evaluate(() => { let at = document.activeElement; while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement; return (at?.textContent ?? "").trim().slice(0, 40) || at?.tagName || null; });
  const spaceDownOn = async (thing) => { await thing.focus(); const on = await hasTheKeys(); await page.keyboard.down(" "); return on; };
  for (const [what, change] of [
    ["another row's words change", "other"],
    ["the pressed row's own words change", "own"],
  ]) {
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => window.__held.presses);
    const on = await spaceDownOn(heldRow);
    await somethingChanges(change);
    await page.waitForTimeout(80);
    await page.keyboard.up(" ");
    const heard = await page.waitForFunction((n) => window.__held.presses >= n + 1, before, { timeout: 3000 }).then(() => true, () => false);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.__held.presses);
    check(`the space bar: the row has the keys before the bar goes down (${what})`, /Pressed while it changes/.test(String(on)), on);
    check(`the space bar: a press is still a press when ${what} while it is made, and is one press`, heard && after === before + 1, { before, after, on });
  }
  // What changed while the bar was down is not dropped: drawn as soon as the bar is up, and once.
  {
    await page.waitForTimeout(600);
    const next = (await page.evaluate(() => window.__held.other)) + 1;
    await spaceDownOn(heldRow);
    await somethingChanges("other");
    await page.waitForTimeout(80);
    const during = await page.evaluate((n) => { window.__drawn = 0; return [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`)); }, next);
    await page.keyboard.up(" ");
    const shown = await page.waitForFunction((n) => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`)), next, { timeout: 2000 }).then(() => true, () => false);
    await page.waitForTimeout(900);
    const drawn = await page.evaluate(() => window.__drawn);
    check("the space bar: what changed while the bar was down is not drawn while it is down", during === false, during);
    check("the space bar: it is drawn as soon as the bar is up", shown, await rowWords());
    check("the space bar: and drawn once", drawn === 1, drawn);
  }
  // A bar that never comes up is not waited for. Tried twice: put down once and left, as this script's keyboard
  // does it; and held as a person's keyboard holds a key, which says "down" again and again for as long as it is
  // held. Timed by the page's own clock from the moment the page hears the bar go down: a page drawn slowly hears
  // a key late, and what is asked is how long the menu waits once it has.
  await page.evaluate(() => {
    window.__space = { downs: 0, repeats: 0, at: 0 };
    addEventListener("keydown", (e) => { if (e.key !== " ") return; if (e.repeat) window.__space.repeats++; else { window.__space.downs++; window.__space.at = performance.now(); } }, true);
  });
  for (const [what, again] of [["put down once and never let up", false], ["held down, the keyboard saying so again and again", true]]) {
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => { window.__space.repeats = 0; return window.__space.downs; });
    await spaceDownOn(heldRow);
    const heardDown = await page.waitForFunction((n) => window.__space.downs === n + 1, before, { timeout: 10000, polling: 20 }).then(() => true, () => false);
    // The menu is told something changed, and the page itself notes when that is first on it.
    await page.evaluate(() => {
      const shows = (n) => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`));
      const next = ++window.__held.other;
      window.__shownAt = 0;
      const c = window.__nswpTest.controls;
      c.setTheme({ scale: c.theme.scale }, true);
      const began = performance.now();
      const look = setInterval(() => { if (shows(next)) window.__shownAt = performance.now(); if (window.__shownAt || performance.now() - began > 8000) clearInterval(look); }, 20);
    });
    // Held: a key already down, put down again, is told to the page as a held key's repeat. One at a time, and the
    // page asked between each whether the change has been drawn yet.
    let shownAt = 0;
    for (const end = Date.now() + 9000; Date.now() < end && !shownAt; ) {
      if (again) await page.keyboard.down(" ");
      await page.waitForTimeout(40);
      shownAt = await page.evaluate(() => window.__shownAt);
    }
    const heard = await page.evaluate(() => ({ ...window.__space }));
    await page.keyboard.up(" ");
    const waited = shownAt ? Math.round(shownAt - heard.at) : null;
    // Never sooner than a press's own length (1.2 s) after the bar went down, and not long after it. Drawn without a
    // graphics card the page is late with everything by a frame of its own: there the time is said, and not held to.
    check(`the space bar ${what}, is not waited for: the menu is drawn again a press's length after the bar went down, and within three seconds`, heardDown && waited !== null && waited > 1100 && (SOFTWARE || waited < 3000) && (!again || heard.repeats > 0), { waited, heardDown, repeatsHeard: heard.repeats });
    results[`how long the menu waited on a space bar ${what}, in ms`] = waited;
    if (again) results["how many times the page was told the held bar was down again, before the menu was drawn"] = heard.repeats;
  }

  await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
  await page.waitForTimeout(400);

  // A press outside the sheet closes the menu, and is nothing else: in the world's own page, as in a client's. The
  // world's view is under where the press lands, and hears none of it.
  await page.evaluate(() => {
    window.__nswpTest.hud.setOpen(true, "room");
    window.__view = [];
    for (const type of ["pointerdown", "pointerup", "click"]) document.querySelector("canvas").addEventListener(type, () => window.__view.push(type));
  });
  await page.waitForTimeout(600);
  const sheetAt = await hud.locator("section.sheet").boundingBox();
  check("the press is outside the sheet: to its left, on the view", !!sheetAt && sheetAt.x > 80, sheetAt);
  await page.mouse.click(40, 300);
  await page.waitForTimeout(300);
  check("a press outside the sheet closes the menu", (await page.evaluate(() => window.__nswpTest.hud.open)) === false);
  check("and is nothing else: the world's view heard no part of it", JSON.stringify(await page.evaluate(() => window.__view)) === "[]", await page.evaluate(() => window.__view));
  await page.mouse.click(40, 300);
  await page.waitForTimeout(300);
  check("with the menu down, the same press is the world's again", (await page.evaluate(() => window.__view)).includes("pointerdown") && (await page.evaluate(() => window.__nswpTest.hud.open)) === false, await page.evaluate(() => window.__view));
  // The bar and the menu's own mark are pressed as before with the sheet up: a press on the mark puts it away.
  await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "room"));
  await page.waitForTimeout(500);
  await hud.locator("button.menu").click();
  check("a press on the menu's own mark still puts it away, and not by way of what is outside", (await page.evaluate(() => window.__nswpTest.hud.open)) === false);
  results["relays asked for, and answered here with nothing"] = [...sockets];
  await ctx.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length} of ${Object.keys(results).length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
