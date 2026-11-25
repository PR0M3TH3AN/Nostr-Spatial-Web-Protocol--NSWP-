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
// A step that could not be judged: what it asks about could not be done to the page at all (a row being made anew
// has no place to press, and on a busy machine drawn without a graphics card that can last). Counted and printed
// as that: never a pass, never a failure, and never a thrown error that ends the trial with nothing said.
const unjudged = [];
const notJudged = (name, why) => {
  results[name] = { "not judged": why };
  if (!unjudged.includes(name)) unjudged.push(name);
};
class NoPlace extends Error {}

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

  // ---- The menu's button is the mark, with no words (the owner, 2026-11-24: "can we use this menu icon everywhere?
  // With no text?"). Its name is still read aloud and its key still opens it; a hint says both on hover with a mouse.
  {
    const button = hud.locator("button.menu");
    const look = () => page.evaluate(() => {
      const b = document.querySelector("nswp-hud").shadowRoot.querySelector("button.menu");
      const hint = b.querySelector(".hint");
      return { words: b.innerText.trim(), mark: !!b.querySelector(".mark") && getComputedStyle(b.querySelector(".mark")).display !== "none", hint: hint && getComputedStyle(hint).display !== "none" ? hint.textContent : null };
    });
    await page.mouse.move(5, 690);
    const plain = await look();
    check("the menu's button shows the mark and no words", plain.words === "" && plain.mark === true && plain.hint === null, plain);
    check('it is found by its name, "Menu"', (await hud.getByRole("button", { name: "Menu", exact: true }).count()) >= 1 && (await button.getAttribute("aria-label")) === "Menu", await button.getAttribute("aria-label"));
    const at = await button.boundingBox();
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    const hovered = await page.waitForFunction(() => { const h = document.querySelector("nswp-hud").shadowRoot.querySelector("button.menu .hint"); return h && getComputedStyle(h).display !== "none" ? h.textContent : null; }, null, { timeout: 3000, polling: 50 }).then((h) => h.jsonValue(), () => null);
    check('on hover with the mouse, a hint says "Menu, M"', hovered === "Menu, M", hovered);
    await page.mouse.move(5, 690);
    check("and it goes when the mouse goes", (await look()).hint === null, await look());
    // The key still opens and closes it.
    const wasOpen = await page.evaluate(() => window.__nswpTest.hud.open);
    await page.keyboard.press("m");
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.__nswpTest.hud.open);
    check("M still opens and closes the menu", after === !wasOpen, { wasOpen, after });
    if (after !== wasOpen) { await page.keyboard.press("m"); await page.waitForTimeout(300); }
  }

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
      const saidAt = performance.now();
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
        // How long after the saying the places were read: a line said is up for its own time, and no longer.
        readAfter: Math.round(performance.now() - saidAt),
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
  // A short line is up for SAY_STAYS.least, and starts going 600 ms before that (ui/model.ts, ui/hud.ts).
  const SAY_UP_MS = 4200 - 600;
  const widthOf = async (width, height) => {
    await page.setViewportSize({ width, height });
    await page.evaluate((w) => new Promise((done) => { const look = () => (innerWidth === w ? requestAnimationFrame(() => done()) : setTimeout(look, 50)); look(); }), width);
  };
  // The Room tab gains a row a few seconds after the world comes up (its sign-in address is refused here, and it
  // says so once it has given up waiting). Waited for, so that what is compared is the same rows throughout.
  await page.waitForFunction(() => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows *")].some((e) => /didn't answer/.test(e.textContent ?? "")), null, { timeout: 30000, polling: 200 }).catch(() => {});
  for (const [at, width, height] of [["a desk's width", 1100, 700], ["a phone's width", 390, 760]]) {
    // The window changes width with the menu up: the sheet is held one size again once it has stopped changing.
    const wasUp = await page.evaluate(() => window.__nswpTest.hud.open);
    await widthOf(width, height);
    if (wasUp) {
      const held = await page.waitForFunction(() => document.querySelector("nswp-hud").shadowRoot.querySelector("section.sheet").style.height !== "", null, { timeout: 3000, polling: 50 }).then(() => true, () => false);
      const heldAt = await page.evaluate(() => document.querySelector("nswp-hud").shadowRoot.querySelector("section.sheet").style.height);
      check(`at ${at}, after the window changed width with the menu up, the sheet is held one size again`, held, heldAt);
      // And the other way in: put away and brought up again at the new width, it is held, at the same size.
      await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "room"));
      const again = await page.waitForFunction(() => document.querySelector("nswp-hud").shadowRoot.querySelector("section.sheet").style.height || null, null, { timeout: 3000, polling: 50 }).then((h) => h.jsonValue(), () => "");
      check(`at ${at}, put away and brought up again after the change of width, the sheet is held at the same size`, !!again && again === heldAt, { heldAt, again });
    }
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
      // What follows is about lines that are up. A line starts going `SAY_UP_MS` after it is said: read later than
      // that (a page drawn without a graphics card, on a busy machine), the lines may rightly be gone, and nothing
      // here can be judged. Said, with how long the reading took.
      const upTogether = now.readAfter < SAY_UP_MS;
      const judge = (name, ok, saw) => (upTogether ? check(name, ok, saw) : notJudged(name, `the places were read ${now.readAfter} ms after the lines were said, past the ${SAY_UP_MS} ms they are surely up for`));
      judge(`at ${at}, with ${n} said: one line shows, the newest, in the sheet's strip`, now.said === n && now.shown.length === 1 && now.shown[0].words === said.at(-1) && now.inStrip, { said: now.said, shown: now.shown, readAfter: now.readAfter });
      judge(`at ${at}, with ${n} said: the line lies over nothing that can be pressed: no row, no tab, no button`, now.over.length === 0 && now.rows.length > 0 && now.tabs.length > 0 && now.foot.length > 0, now.over);
      judge(`at ${at}, with ${n} said: every row, tab and button is where it was, and the sheet is the size it was`, placesOf(now) === placesOf(blank), { blank: [blank.sheet, blank.rows[0]], now: [now.sheet, now.rows[0]] });
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

    // The tabs are measured ahead, not at the press: with the menu down, in the page's idle moments, so that the
    // menu comes up no later for being one size. Counted where they are laid out to be measured: a box of the
    // menu's own that nobody sees, each time something is put in it.
    await page.evaluate(() => {
      window.__ahead = 0;
      const box = document.querySelector("nswp-hud").shadowRoot.querySelector(".measure");
      new MutationObserver((rs) => { if (rs.some((x) => x.addedNodes.length)) window.__ahead++; }).observe(box, { childList: true });
    });
    const measuredSoFar = () => page.evaluate(() => window.__ahead);
    // The page's own idle moments with room in them (the kit measures only in such a moment, with 5 ms to spare):
    // counted, so that a check finding nothing measured can tell "not done" from "no moment came to do it in".
    await page.evaluate(() => {
      window.__idle = 0;
      const loop = (d) => { if (d.timeRemaining() >= 5) window.__idle++; requestIdleCallback(loop); };
      requestIdleCallback(loop);
    });
    const idleSoFar = () => page.evaluate(() => window.__idle);
    /** A check of measuring ahead: judged where an idle moment came while it waited, and otherwise NOT JUDGED. */
    const aheadCheck = (name, ok, saw, idle) => (idle > 0 ? check(name, ok, saw) : notJudged(name, `no idle moment with room came while it waited (${JSON.stringify(saw)}): the kit measures only in one, so nothing could be judged`));
    const settles = async (ms = 6000) => { let last = -1; for (const end = Date.now() + ms; Date.now() < end; ) { const n = await measuredSoFar(); if (n === last) return n; last = n; await page.waitForTimeout(700); } return last; };
    // What the tabs hold changes with the menu down (a world adds a tab): measured again, ahead.
    await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
    await page.waitForTimeout(400);
    const before = await settles();
    const idle0 = await idleSoFar();
    await page.evaluate(() => { const c = window.__nswpTest.controls; c.addSection({ id: "trial-ahead", label: "Ahead", icon: "save" }); for (let i = 0; i < 6; i++) c.add({ id: `trial-ahead-${i}`, section: "trial-ahead", label: `A row of a tab added with the menu down, ${i + 1}`, act: () => {} }); });
    const afterAdding = await settles();
    aheadCheck("one size: a tab added with the menu down is measured ahead, in an idle moment, with nothing pressed", afterAdding > before, { before, afterAdding }, (await idleSoFar()) - idle0);
    // And the menu then comes up with nothing left to measure at the press.
    const atPress = await page.evaluate(() => { const n = window.__ahead; window.__nswpTest.hud.setOpen(true, "travel"); return window.__ahead - n; });
    check("one size: the menu then comes up with no tab left to measure at the press", atPress === 0, atPress);
    await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
    await page.waitForTimeout(400);
    // The window changes width with the menu down, by enough that the sheet is another width (780 at a desk's, 480
    // below it): the sizes kept are for the width it was, and are found again ahead.
    const beforeWidth = await settles();
    const idle1 = await idleSoFar();
    await widthOf(700, 700);
    const afterWidth = await settles();
    aheadCheck("one size: a change of the window's width with the menu down has the tabs measured again, ahead", afterWidth - beforeWidth >= 10, { beforeWidth, afterWidth }, (await idleSoFar()) - idle1);
    const atPressAgain = await page.evaluate(() => { const n = window.__ahead; window.__nswpTest.hud.setOpen(true, "travel"); return window.__ahead - n; });
    check("one size: and at the new width too the menu comes up with nothing left to measure", atPressAgain === 0, atPressAgain);
    await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
    await page.waitForTimeout(400);
    // Never while the visitor is doing something: a key held down, the width changed meanwhile. Nothing is
    // measured until the key is up and half a second has passed.
    const beforeKey = await settles();
    await page.keyboard.down("w");
    await widthOf(1100, 700);
    await page.waitForTimeout(1500);
    // (Back at a desk's width its sizes were kept from before; a tab is added too, so that something is stale.)
    await page.evaluate(() => { const c = window.__nswpTest.controls; for (let i = 6; i < 12; i++) c.add({ id: `trial-ahead-${i}`, section: "trial-ahead", label: `Another row added while a key is held, ${i + 1}`, act: () => {} }); });
    await page.waitForTimeout(1200);
    const whileHeld = await measuredSoFar();
    await page.keyboard.up("w");
    // Half a second of nothing done, then an idle moment: looked at after two and a half seconds. Only idle moments
    // after that half second count for whether one came.
    await page.waitForTimeout(600);
    const idle2 = await idleSoFar();
    await page.waitForTimeout(1900);
    const afterKey = await settles();
    check("one size: nothing is measured ahead while a key is held, though the sizes kept are stale", whileHeld === beforeKey, { beforeKey, whileHeld });
    aheadCheck("one size: and it is measured once the key is up", afterKey > whileHeld, { whileHeld, afterKey }, (await idleSoFar()) - idle2);
    await page.evaluate(() => { const c = window.__nswpTest.controls; for (let i = 0; i < 12; i++) c.remove?.(`trial-ahead-${i}`); c.removeSection?.("trial-ahead"); });
    await page.waitForTimeout(300);
  }

  // ---- The sheet never lies over the row at the top (the owner, 2026-11-24, of kit 0.88.0, with a picture of a
  // wide, short window: "can we make sure the menu on flat screens dont cover the items at the top? Like the full
  // screen or login badge or the world info or menu button."). One size made every tab as tall as the largest, so
  // on a short window the sheet reached up over the world's card and the Menu button on every tab. At several sizes
  // of window, short ones among them, every tab is gone to and the sheet's box and each top thing's box are read:
  // they must not meet. And one size must still hold at each: the strip in the same place on every tab.
  {
    const read = () => page.evaluate(async () => {
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      const root = document.querySelector("nswp-hud").shadowRoot;
      const sheet = root.querySelector("section.sheet");
      await Promise.all(sheet.getAnimations().map((x) => x.finished.catch(() => null)));
      const box = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map((n) => Math.round(n * 10) / 10); };
      const things = [["the world's card", ".id"], ["the Menu button", ".menu"], ["Full screen", ".full"], ["who you are signed in as", ".as"], ["the quiet mark", ".quiet"]].map(([name, sel]) => {
        const e = root.querySelector(sel);
        const r = e?.getBoundingClientRect();
        const there = !!e && r.width > 0 && r.height > 0;
        const seen = there && getComputedStyle(e).visibility !== "hidden";
        // What a press at its middle would land on, where it is there at all.
        const onTop = there ? root.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2) : null;
        return { name, there, seen, box: there ? box(e) : null, pressable: there && !!onTop && (onTop === e || e.contains(onTop)) };
      });
      const rows = sheet.querySelector(".rows");
      return { sheet: box(sheet), strip: box(sheet.querySelector(".tabs")), things, scrolls: rows.scrollHeight > rows.clientHeight + 1, view: [innerWidth, innerHeight] };
    });
    const meets = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const goTo = (id) => page.evaluate((id) => window.__nswpTest.hud.setOpen(true, id), id);
    const near = (a, b) => a.every((n, i) => Math.abs(n - b[i]) < 0.6);
    // The owner's own was wide and short; then a desk, shorter desks, a wide strip, a phone on its side, a phone.
    for (const [width, height] of [[1333, 729], [1100, 700], [1300, 600], [1000, 560], [1600, 480], [760, 390], [390, 760]]) {
      const at = `${width} by ${height}`;
      await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
      await widthOf(width, height);
      await page.waitForTimeout(350);
      const closed = await read();
      const tabs = await page.evaluate(() => window.__nswpTest.controls.view().sections.map((x) => x.id));
      const seen = [];
      for (const id of tabs) {
        await goTo(id);
        await page.waitForTimeout(110);
        seen.push({ id, ...(await read()) });
      }
      const over = seen.flatMap((x) => x.things.filter((t) => t.seen && meets(x.sheet, t.box)).map((t) => `${t.name}, on ${x.id}: the sheet's top at ${x.sheet[1]}, its foot at ${t.box[3]}`));
      check(`the top row, at ${at}: on every one of ${tabs.length} tabs the sheet lies over nothing in the row at the top`, over.length === 0, [...new Set(over)].slice(0, 6));
      const moved = seen.filter((x) => !near(x.sheet, seen[0].sheet) || !near(x.strip, seen[0].strip));
      check(`the top row, at ${at}: and the sheet is still one size, its strip in the same place on every tab`, moved.length === 0, moved.map((x) => ({ id: x.id, sheet: x.sheet })).slice(0, 4));
      // Where the window is too short for both, the top things the sheet would lie over are out of sight while it
      // is up: then none of them is what a press at its place lands on, and the sheet is tall enough to use.
      // Out of sight because the sheet is up: seen with the menu away, and not seen with it up. (The mark for who
      // you are signed in as is there all along and shows only for a moment; its place is kept clear either way.)
      const tucked = seen[0].things.filter((t) => t.there && !t.seen && closed.things.find((c) => c.name === t.name)?.seen).map((t) => t.name);
      const pressableUnder = seen.flatMap((x) => x.things.filter((t) => t.there && meets(x.sheet, t.box) && t.pressable).map((t) => `${t.name} on ${x.id}`));
      check(`the top row, at ${at}: nothing of the top row can be pressed where the sheet is`, pressableUnder.length === 0, [...new Set(pressableUnder)].slice(0, 6));
      const tall = seen[0].sheet[3] - seen[0].sheet[1];
      check(`the top row, at ${at}: the sheet is tall enough to use (240 at the least)`, tall >= 239.5, tall);
      // Where something of the top row is out of sight while the sheet is up (the Menu button may be among it), the
      // menu is still put away by its own Close, pressed with the mouse, and by its key.
      if (tucked.length) {
        const close = hud.getByRole("button", { name: "Close", exact: true }).first();
        const box = await close.boundingBox().catch(() => null);
        if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        const byClose = await page.waitForFunction(() => window.__nswpTest.hud.open === false, null, { timeout: 3000 }).then(() => true, () => false);
        check(`the top row, at ${at}: with ${tucked.join(" and ")} out of sight, the sheet's own Close puts the menu away`, !!box && byClose, { closeAt: box, open: await page.evaluate(() => window.__nswpTest.hud.open) });
        await goTo(tabs[0]);
        await page.waitForTimeout(400);
        await page.keyboard.press("m");
        const byKey = await page.waitForFunction(() => window.__nswpTest.hud.open === false, null, { timeout: 3000 }).then(() => true, () => false);
        check(`the top row, at ${at}: and so does the menu's key`, byKey, await page.evaluate(() => window.__nswpTest.hud.open));
      }
      // And with the menu away, everything of the top row that was there before is there again.
      await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
      await page.waitForTimeout(350);
      const after = await read();
      check(`the top row, at ${at}: with the menu away the top row is as it was`, JSON.stringify(after.things.map((t) => [t.name, t.seen])) === JSON.stringify(closed.things.map((t) => [t.name, t.seen])), { before: closed.things.map((t) => [t.name, t.seen]), after: after.things.map((t) => [t.name, t.seen]) });
      results[`the top row, at ${at}: the sheet, how tall, what of the top row is in its way, and what gives way`] = { sheet: seen[0].sheet, tall: Math.round(tall), topRow: closed.things.filter((t) => t.seen).map((t) => `${t.name} to ${t.box[3]}`), outOfSightWhileItIsUp: tucked, tabsThatScroll: seen.filter((x) => x.scrolls).length };
    }
    await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
    await widthOf(1100, 700);
    await page.waitForTimeout(300);
  }

  // ---- A tab asked for before the menu has it (the orchestrator, 2026-11-24). A world may ask for the menu on a
  // tab of its own a moment before that tab is there. The asking used to be forgotten: the menu came up on its
  // first tab and stayed there when the tab came. It is kept for two seconds: the menu comes up where it last was
  // and goes to the tab when it arrives, unless the visitor has chosen a tab meanwhile or put the menu away.
  {
    const tabUp = () => page.evaluate(() => document.querySelector("nswp-hud").shadowRoot.querySelector('section.sheet [role="tab"][aria-selected="true"]')?.textContent.trim() ?? null);
    const isUp = () => page.evaluate(() => window.__nswpTest.hud.open === true);
    // Each asked for and added at a time by the page's own clock: the two seconds are the page's, and a slow page's
    // third of a second can be more than that there.
    const ask = (id) => page.evaluate((id) => { window.__askedAt = performance.now(); window.__nswpTest.hud.setOpen(true, id); }, id);
    const addTab = (id, label) => page.evaluate(([id, label]) => { const c = window.__nswpTest.controls; c.addSection({ id, label, icon: "save" }); c.add({ id: `${id}-row`, section: id, label: `A row of ${label}`, act: () => {} }); return Math.round(performance.now() - window.__askedAt); }, [id, label]);
    const KEEP_MS = 2000;
    const waitFor = (label, ms) => page.waitForFunction((label) => document.querySelector("nswp-hud").shadowRoot.querySelector('section.sheet [role="tab"][aria-selected="true"]')?.textContent.trim() === label, label, { timeout: ms }).then(() => true, () => false);
    await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "sound"));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
    await page.waitForTimeout(400);
    // 1. Asked for, and it comes a third of a second later.
    await ask("trial-early");
    await page.waitForTimeout(150);
    const meanwhile = { up: await isUp(), tab: await tabUp() };
    check("a tab asked for early: the menu comes up at once, where it last was", meanwhile.up && meanwhile.tab === "Sound", meanwhile);
    await page.waitForTimeout(180);
    const earlyAfter = await addTab("trial-early", "Early");
    const earlyName = "a tab asked for early: when the tab arrives a third of a second later, the menu goes to it";
    const wentEarly = await waitFor("Early", 2500);
    // Arriving past the two seconds by the page's clock, the asking is rightly let go: nothing here to judge.
    if (!wentEarly && earlyAfter >= KEEP_MS - 200) notJudged(earlyName, `the tab arrived ${earlyAfter} ms after the asking by the page's own clock, not a third of a second: past what the menu keeps`);
    else check(earlyName, wentEarly, { tab: await tabUp(), arrivedAfter: earlyAfter });
    // 2. It comes too late: after two and a half seconds the asking is no longer kept.
    await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "sound"));
    await page.waitForTimeout(200);
    await ask("trial-late");
    await page.waitForTimeout(2600);
    await addTab("trial-late", "Late");
    await page.waitForTimeout(700);
    check("a tab asked for early: one that arrives after two seconds and a half doesn't move the menu", (await tabUp()) === "Sound" && (await isUp()), await tabUp());
    // 3. The visitor chooses a tab meanwhile, with the mouse: theirs stands.
    await ask("trial-chosen");
    await page.waitForTimeout(200);
    let at = null;
    {
      const room = hud.getByRole("tab", { name: "Room", exact: true }).first();
      await room.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      // The tab's place, asked again for five seconds: on a page drawn without a graphics card the strip of tabs
      // can be without a place for a moment while it is laid out again. Never a place: nothing to click, not judged.
      for (const end = Date.now() + 5000; !at && Date.now() < end; ) {
        at = await room.boundingBox().catch(() => null);
        if (!at) await page.waitForTimeout(150);
      }
      if (!at) at = { noPlace: true };
      if (!at.noPlace) {
      // Whether the click reaches the Room tab at all, and what is under the mouse as it is made: so a click not
      // taken can be told as the page being slow (it reached the tab, and Room comes late) from a press lost.
      await page.evaluate(([x, y]) => {
        const root = document.querySelector("nswp-hud").shadowRoot;
        window.__tabClick = { reached: 0, under: (root.elementFromPoint(x, y)?.textContent ?? "").trim().slice(0, 30) };
        root.addEventListener("click", (e) => { if (e.composedPath().some((n) => n.getAttribute?.("role") === "tab" && /Room/.test(n.textContent ?? ""))) window.__tabClick.reached++; }, { capture: true, once: true });
      }, [at.x + at.width / 2, at.y + at.height / 2]);
      await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
      }
    }
    // The click must have been taken before there is anything to judge: Room chosen, by the visitor.
    const choseRoom = at.noPlace ? false : await waitFor("Room", 3000);
    // Not in three seconds: did it reach the tab, and does Room come later? Reached and late is the page being
    // slow; reached and never is a chosen tab lost, which fails; not reached says what was under the mouse.
    const clickSeen = choseRoom ? null : at.noPlace ? { reached: 0, under: "nothing: the Room tab had no place in five seconds", cameLate: false } : { ...(await page.evaluate(() => window.__tabClick)), cameLate: await waitFor("Room", 10000) };
    if (clickSeen && clickSeen.reached > 0 && !clickSeen.cameLate) check("a tab asked for early: a click that reached the Room tab chooses it", false, clickSeen);
    await addTab("trial-chosen", "Chosen");
    await page.waitForTimeout(800);
    const chosenName = "a tab asked for early: a tab the visitor chose meanwhile stands, and the one asked for doesn't take it";
    if (!choseRoom) notJudged(chosenName, `the click on Room was not taken in three seconds (${clickSeen.reached ? `it reached the tab, and Room came ${clickSeen.cameLate ? "later: the page was slow" : "never"}` : `it did not reach the tab: under the mouse was "${clickSeen.under}"`}), so there was no choice of the visitor's to stand`);
    else check(chosenName, (await tabUp()) === "Room", await tabUp());
    // 4. The visitor puts the menu away meanwhile: it stays away.
    await ask("trial-away");
    await page.waitForTimeout(200);
    await page.keyboard.press("m");
    await page.waitForFunction(() => window.__nswpTest.hud.open === false, null, { timeout: 3000 }).catch(() => undefined);
    await addTab("trial-away", "Away");
    await page.waitForTimeout(900);
    check("a tab asked for early: with the menu put away meanwhile, the tab's coming doesn't bring it back", (await isUp()) === false, await isUp());
    await page.keyboard.press("m");
    await page.waitForFunction(() => window.__nswpTest.hud.open === true, null, { timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const againName = "a tab asked for early: and brought up again by the visitor, the menu is where they left it, not there";
    if (!choseRoom) notJudged(againName, "follows from the visitor's choice of Room, which was not taken");
    else check(againName, (await tabUp()) === "Room", await tabUp());
    // Taken away again, for what comes after.
    await page.evaluate(() => { const c = window.__nswpTest.controls; for (const id of ["trial-early", "trial-late", "trial-chosen", "trial-away"]) { c.remove?.(`${id}-row`); c.removeSection?.(id); } window.__nswpTest.hud.setOpen(false); });
    await page.waitForTimeout(400);
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
    // Each drawing of the rows, and each change asked for by anything but this trial (the music's turn to its next
    // song, a world's own timer), in the order they came. A change that comes after a drawing is owed a drawing of
    // its own (found 2026-11-24, when a song's turn landed 730 ms after a press and was counted as the press's
    // second drawing); one before it is in that drawing.
    window.__ours = false;
    window.__seq = [];
    new MutationObserver((records) => { if (records.some((r) => r.type === "childList")) { window.__drawn++; window.__seq.push("d"); } }).observe(document.querySelector("nswp-hud").shadowRoot.querySelector(".rows"), { childList: true });
    window.__nswpTest.controls.subscribe(() => { if (!window.__ours) window.__seq.push("c"); });
    /** How many drawings came, and how many changes from elsewhere came after the first of them. */
    window.__owed = () => { const first = window.__seq.indexOf("d"); return { drawn: window.__drawn, later: first < 0 ? 0 : window.__seq.slice(first + 1).filter((x) => x === "c").length, seq: window.__seq.join("") }; };
  });
  const heldRow = hud.getByRole("button", { name: /Pressed while it changes/ }).first();
  await heldRow.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(700);
  /** Tell the menu something it shows has changed, as a counter ticking or a picture arriving does. */
  const somethingChanges = (what) => page.evaluate((what) => { if (what) window.__held[what]++; const c = window.__nswpTest.controls; window.__ours = true; try { c.setTheme({ scale: c.theme.scale }, true); } finally { window.__ours = false; } }, what);
  const rowWords = () => page.evaluate(() => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].map((b) => b.textContent.trim().slice(0, 40)));
  // A row being made anew has no place for an instant; drawn without a graphics card on a busy machine, for longer.
  // It is asked for again for five seconds. If it never has a place the press can't be made, and the step that
  // wanted it is not judged: it does not throw the whole trial away (as it did at a load of 25, 2026-11-24).
  const mouseDownOn = async (thing) => {
    let at = null;
    for (const end = Date.now() + 5000; !at && Date.now() < end; ) {
      at = await thing.boundingBox().catch(() => null);
      if (!at) await page.waitForTimeout(60);
    }
    if (!at) throw new NoPlace("the row had no place to press in five seconds: it was being made anew each time it was asked for");
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    return at;
  };
  /** A step whose press could not be made is not judged, by its name; anything else thrown is thrown on. */
  const unpressed = async (e, step) => {
    if (!(e instanceof NoPlace)) throw e;
    await page.mouse.up().catch(() => undefined);
    notJudged(`${step}: the press could not be made`, e.message);
  };

  for (const [what, change] of [
    ["another row's words change", "other"],
    ["the pressed row's own words change", "own"],
  ]) {
    try {
    const before = await page.evaluate(() => window.__held.presses);
    await mouseDownOn(heldRow);
    await somethingChanges(change);
    await page.waitForTimeout(80);
    await page.mouse.up();
    const heard = await page.waitForFunction((n) => window.__held.presses === n + 1, before, { timeout: 3000 }).then(() => true, () => false);
    check(`a press is still a press when ${what} while it is made`, heard, await page.evaluate(() => window.__held));
    } catch (e) { await unpressed(e, "a press made while the menu changes"); }
  }

  // 1. A change that came during a press is not dropped: it is drawn as soon as the press is over, and once.
  {
    try {
    await page.waitForTimeout(600);
    await mouseDownOn(heldRow);
    await somethingChanges("other");
    await page.waitForTimeout(80);
    const during = await page.evaluate(() => { window.__drawn = 0; window.__seq = []; return [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => /A row beside it 2/.test(b.textContent)); });
    await page.mouse.up();
    const shown = await page.waitForFunction(() => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => /A row beside it 2/.test(b.textContent)), null, { timeout: 2000 }).then(() => true, () => false);
    await page.waitForTimeout(900);
    const owed = await page.evaluate(() => window.__owed());
    check("what changed during a press is not drawn while the press is being made", during === false, during);
    check("it is drawn as soon as the press is over", shown, await rowWords());
    // The press itself changes nothing these rows show, so one drawing is the whole of what was owed.
    // One for what the press held back, and at most one more for each change asked from elsewhere after it (the
    // music's turn): never one for each thing that asked while the press was being made.
    check("and drawn once: one drawing of the rows, not one for each thing that asked meanwhile", owed.drawn >= 1 && owed.drawn <= 1 + owed.later, owed);
    } catch (e) { await unpressed(e, "what changed during a press is drawn once it is over"); }
  }

  // 2. The menu is never held still for long. A press that never ends is not waited for: the mouse goes down and
  // stays down, and what changed is drawn without the button ever coming up, a little after a press's own length.
  {
    try {
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
    } catch (e) { await unpressed(e, "a press that never ends is not waited for"); }
  }
  // The pointer taken off the page with its button still down: not waited for either, however the browser tells it.
  {
    try {
    await page.waitForTimeout(600);
    await mouseDownOn(heldRow);
    await page.mouse.move(-20, -20);
    const next = (await page.evaluate(() => window.__held.other)) + 1;
    await somethingChanges("other");
    const drawnAnyway = await page.waitForFunction((n) => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`)), next, { timeout: 3000, polling: 50 }).then(() => true, () => false);
    await page.mouse.up();
    check("nor a pointer taken off the page with its button down", drawnAnyway, await rowWords());
    } catch (e) { await unpressed(e, "a pointer taken off the page with its button down"); }
  }
  // And it is let go at once when the press is cancelled, or the page loses the keys: said to the page as the
  // browser says them (a finger that began to scroll; another window brought to the front).
  for (const [what, event] of [["the press is cancelled", "pointercancel"], ["the page loses the keys", "blur"]]) {
    try {
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
    } catch (e) { await unpressed(e, "a press cancelled, or the keys lost"); }
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
  // 3b. A menu that changes again and again while it is used: something it shows changes four times a second, then
  // ten (a counter, a world that speaks often). Twenty presses with a real mouse at each, held for as long as a
  // quick press and a slow one. Every one is heard, and the menu was in fact drawn again all the while.
  for (const [what, every] of [["four times a second", 250], ["ten times a second", 100]]) {
    await page.waitForTimeout(600);
    await heldRow.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    const before = await page.evaluate((every) => {
      window.__drawn = 0;
      window.__often = setInterval(() => { window.__held.other++; const c = window.__nswpTest.controls; c.setTheme({ scale: c.theme.scale }, true); }, every);
      return window.__held.presses;
    }, every);
    // Twenty presses made, counted as they are made: a row asked for in the instant it is being made anew has no
    // place to press, and is asked for again. That is not a press, and is counted as neither made nor lost.
    let made = 0;
    let noPlace = 0;
    for (let tries = 0; made < 20 && tries < 80; tries++) {
      const at = await heldRow.boundingBox().catch(() => null);
      if (!at) { noPlace++; await page.waitForTimeout(30); continue; }
      await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(40 + (made % 4) * 40);
      await page.mouse.up();
      made++;
      await page.waitForTimeout(110);
    }
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => { clearInterval(window.__often); return { presses: window.__held.presses, drawn: window.__drawn }; });
    // Judged on the presses made: each made is heard, once. Where none could be made (the row had no place in every
    // try, on a page so slow that each drawing takes most of a second), nothing was lost because nothing was made.
    const pressName = `with the menu changing ${what}, twenty presses with the mouse are twenty presses`;
    if (made === 0) notJudged(pressName, `no press could be made: the row had no place in all ${noPlace} tries, while the rows were drawn ${after.drawn} times`);
    else check(pressName, after.presses === before + made, { made, heard: after.presses - before, noPlace });
    check(`and the menu was drawn again all the while (${what})`, after.drawn >= 8, after.drawn);
    results[`with the menu changing ${what}: presses heard of 20, and drawings of the rows meanwhile`] = { made, heard: after.presses - before, drawn: after.drawn, noPlace };
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
    const during = await page.evaluate((n) => { window.__drawn = 0; window.__seq = []; return [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`)); }, next);
    await page.keyboard.up(" ");
    const shown = await page.waitForFunction((n) => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => b.textContent.includes(`A row beside it ${n}`)), next, { timeout: 2000 }).then(() => true, () => false);
    await page.waitForTimeout(900);
    const owed = await page.evaluate(() => window.__owed());
    check("the space bar: what changed while the bar was down is not drawn while it is down", during === false, during);
    check("the space bar: it is drawn as soon as the bar is up", shown, await rowWords());
    check("the space bar: and drawn once", owed.drawn >= 1 && owed.drawn <= 1 + owed.later, owed);
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
if (unjudged.length) console.error(`\nNOT JUDGED: ${unjudged.length}\n- ${unjudged.map((n) => `${n}: ${results[n]["not judged"]}`).join("\n- ")}`);
if (fail.length) {
  console.error(`\nFAILED: ${fail.length} of ${Object.keys(results).length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed${unjudged.length ? `, ${unjudged.length} NOT JUDGED` : ""}`);
