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

const browser = await pw.chromium.launch({ channel: "chrome", headless: true });
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
      const settle = () => Promise.race([Promise.all([...(newest?.getAnimations() ?? []), ...sheet.getAnimations()].map((a) => a.finished.catch(() => null))).then(() => true), new Promise((no) => setTimeout(() => no(false), 8000))]);
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
