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
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { mkdirSync } = await import("node:fs");

const WORLD = "https://gallery.test";
const DIST = join(NSWP, "sites", "gallery", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".txt": "text/plain" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
mkdirSync(SHOTS, { recursive: true });

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

  // Words said for a moment, with the menu up (as "Copied." was, just now): they are where they can be read. The
  // sheet lies over where they stand with the menu down, on all but the widest screens, so they are in the sheet,
  // above its foot. A line lasts four seconds, so it is said and looked at in one go, inside the page.
  //
  // Nothing here waits a fixed time before measuring. A line comes in with a short slide, and on a page that draws
  // two frames a second "a moment later" may still be its first frame: the line's own animations are waited for,
  // each to its end, and a look says whether they ended (`settled`). A line can also be moved first, by the menu
  // coming or going: then what is asked, at once, is whether anything is still running on it. A line already up
  // is simply there, and doesn't come in a second time.
  const sayAndLook = (words, then) =>
    page.evaluate(async ([words, then]) => {
      const t = window.__nswpTest;
      const root = document.querySelector("nswp-hud").shadowRoot;
      // To the end of everything running on the line, and on the sheet it may be in (the sheet unfolds as it comes
      // up, and what is still folded away can't be pressed or asked about), or eight seconds, whichever is first.
      const settle = (line) => Promise.race([Promise.all([...line.getAnimations(), ...root.querySelector("section.sheet").getAnimations()].map((a) => a.finished.catch(() => null))).then(() => true), new Promise((no) => setTimeout(() => no(false), 8000))]);
      if (words) t.controls.say(words);
      const line = [...root.querySelectorAll(".say")].at(-1);
      if (!line) return null;
      let settled = await settle(line);
      let runningOnceMoved = null;
      if (then) {
        t.hud.setOpen(then === "open", "room");
        runningOnceMoved = line.getAnimations().map((a) => a.animationName ?? a.transitionProperty ?? "something");
        settled = (await settle(line)) && settled;
      }
      const box = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
      const at = box(line);
      const top = root.elementFromPoint((at.left + at.right) / 2, (at.top + at.bottom) / 2);
      const onTop = top === line || line.contains(top);
      // In the sheet a line takes no press: what is under its middle is asked for, and should be the sheet's own.
      const underInSheet = !!top && !!top.closest?.("section.sheet");
      return { words: line.textContent, settled, runningOnceMoved, underInSheet, line: at, sheet: box(root.querySelector("section.sheet")), foot: box(root.querySelector(".foot")), rows: box(root.querySelector(".rows")), onTop, over: onTop ? null : `${top?.tagName} ${top?.className}`, inSheet: !!line.closest("section.sheet") };
    }, [words, then ?? ""]);
  /** A look is a look only if the line had finished coming in: said by name, so that a slow page isn't read as a wrong place. */
  const settledFor = (what, look) => check(`${what}: the line had finished coming in before its place was read`, look?.settled === true, look && { settled: look.settled });
  // Nothing in the sheet moves as a line comes or goes: a row a visitor is about to press is where it was. (When a
  // line took room of its own, every row went up by its height and came down four seconds later, and a second press
  // on the same row landed somewhere else.)
  // Two rows for a later part (a press made while the menu is drawn again), added here so that the rows are the
  // same ones from the first reading of their places to the last.
  await page.evaluate(() => {
    window.__held = { presses: 0, other: 0, own: 0 };
    const c = window.__nswpTest.controls;
    c.add({ id: "trial-held", section: "room", label: () => `Pressed while it changes ${window.__held.own}`, act: () => void window.__held.presses++ });
    c.add({ id: "trial-beside", section: "room", label: () => `A row beside it ${window.__held.other}`, act: () => {} });
  });
  await page.waitForTimeout(600);
  const rowsAt = () => page.evaluate(() => { const sh = document.querySelector("nswp-hud").shadowRoot; const box = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }; return { sheet: box(sh.querySelector("section.sheet")), rows: [...sh.querySelectorAll(".rows button")].map(box) }; });
  await page.waitForFunction(() => !document.querySelector("nswp-hud").shadowRoot.querySelector(".say"), null, { timeout: 12000 }).catch(() => {});
  const still = [await rowsAt()];
  const up = await sayAndLook("Said with the menu up.");
  still.push(await rowsAt());
  results["a line said with the menu up, where it is"] = up;
  settledFor("said with the menu up", up);
  check("with the menu up, what is said for a moment is in the sheet, lying just above its foot", !!up && up.words === "Said with the menu up." && up.inSheet && up.line.left >= up.sheet.left && up.line.right <= up.sheet.right && up.line.top >= up.sheet.top && up.line.bottom <= up.foot.top + 1, up);
  check("it is on top where it lies: a press there is a press on the line", up?.onTop === true, up && { onTop: up.onTop, over: up.over });
  check("as it comes, no row in the sheet moves and the sheet doesn't grow", still[0].rows.length > 0 && JSON.stringify(still[0]) === JSON.stringify(still[1]), still);
  await page.screenshot({ path: join(SHOTS, "menu-rows-said-in-the-sheet.png") });

  // ---- A press on a line. A line lies over rows it hides, so a press on it must never be a press on what is under
  // it: it puts that line away, and nothing else. Three lines are said, so that one lies over a row; a place is
  // found that is on a line and over a row; and the mouse is pressed there, twice.
  await page.waitForFunction(() => !document.querySelector("nswp-hud").shadowRoot.querySelector(".say"), null, { timeout: 12000 }).catch(() => {});
  const over = await page.evaluate(() => {
    const t = window.__nswpTest;
    for (const words of ["The first of three.", "The second of three.", "The third of three."]) t.controls.say(words);
    window.__saidAt = performance.now();
    const root = document.querySelector("nswp-hud").shadowRoot;
    const box = (e) => e.getBoundingClientRect();
    for (const line of root.querySelectorAll(".say")) {
      const l = box(line);
      for (const row of root.querySelectorAll(".rows button")) {
        const r = box(row);
        const x0 = Math.max(l.left, r.left), x1 = Math.min(l.right, r.right), y0 = Math.max(l.top, r.top), y1 = Math.min(l.bottom, r.bottom);
        if (x1 - x0 < 12 || y1 - y0 < 8) continue;
        const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
        if (root.elementFromPoint(x, y) !== line) continue;
        window.__pressedLine = line;
        window.__rowUnder = row;
        window.__rowPresses = 0;
        row.addEventListener("click", () => window.__rowPresses++, true);
        return { x, y, line: line.textContent, row: row.textContent.trim().slice(0, 40), lines: root.querySelectorAll(".say").length };
      }
    }
    return null;
  });
  check("three lines up, one of them lies over a row, at a place the mouse can press", !!over && over.lines === 3, over);
  if (over) {
    await page.mouse.click(over.x, over.y);
    const first = await page.evaluate(() => ({ lineGone: !window.__pressedLine.isConnected, rowPresses: window.__rowPresses, open: window.__nswpTest.hud.open, lines: document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".say").length, after: Math.round(performance.now() - window.__saidAt) }));
    // A line goes by itself after four seconds: the press has to have come well before that to be what removed it.
    check("the press came while the lines were still up by themselves", first.after < 3500, first.after);
    check("a press on a line puts that line away, and only that one", first.lineGone && first.lines === 2, first);
    check("and is nothing else: the row under it is not pressed, and the menu stays up", first.rowPresses === 0 && first.open === true, first);
    results["a press on a line: the line, and the row it lay over"] = [over.line, over.row];
    await page.mouse.click(over.x, over.y);
    const second = await page.evaluate(() => ({ rowPresses: window.__rowPresses, under: (() => { const root = document.querySelector("nswp-hud").shadowRoot; return root.querySelector(".rows").contains(window.__rowUnder); })() }));
    check("a second press at the same place presses the row, which can now be seen", second.rowPresses === 1, second);
  }
  await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "room"));
  await page.waitForFunction(() => !document.querySelector("nswp-hud").shadowRoot.querySelector(".say"), null, { timeout: 12000 }).catch(() => {});

  // ---- A press, with the menu drawn again while it is being made. A press is the mouse going down on a thing and
  // coming up on the same thing; drawing the menu again makes every row anew; so a drawing between the two took the
  // row from under the mouse, and the press was never delivered. Now the menu waits for the press to be over. The
  // mouse goes down on a row, the menu is told something changed, and the mouse comes up: three ways.
  const heldRow = hud.getByRole("button", { name: /Pressed while it changes/ }).first();
  await heldRow.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(700);
  for (const [what, change] of [
    ["nothing it shows changes", ""],
    ["another row's words change", "other"],
    ["the pressed row's own words change", "own"],
  ]) {
    const at = await heldRow.boundingBox();
    const before = await page.evaluate(() => window.__held.presses);
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    // The menu is told something changed, as it is when a counter ticks or a picture arrives.
    await page.evaluate((change) => { if (change) window.__held[change]++; const c = window.__nswpTest.controls; c.setTheme({ scale: c.theme.scale }, true); }, change);
    await page.waitForTimeout(80);
    await page.mouse.up();
    const heard = await page.waitForFunction((n) => window.__held.presses === n + 1, before, { timeout: 3000 }).then(() => true, () => false);
    check(`a press is still a press when the menu is told to draw again while it is made, and ${what}`, heard, await page.evaluate(() => window.__held));
  }
  // And what changed meanwhile is drawn as soon as the press is over: it was put off, not lost.
  const shownAfter = await page.waitForFunction(() => { const labels = [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].map((b) => b.textContent); return labels.some((l) => /A row beside it 1/.test(l)) && labels.some((l) => /Pressed while it changes 1/.test(l)); }, null, { timeout: 3000 }).then(() => true, () => false);
  check("what changed during a press is drawn once the press is over", shownAfter, await page.evaluate(() => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].map((b) => b.textContent.trim().slice(0, 40))));
  // A thing held for longer than a press is isn't kept waiting on: the menu is drawn again under it.
  {
    const at = await heldRow.boundingBox();
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.evaluate(() => { window.__held.other++; const c = window.__nswpTest.controls; c.setTheme({ scale: c.theme.scale }, true); });
    const drawnMeanwhile = await page.waitForFunction(() => [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".rows button")].some((b) => /A row beside it 2/.test(b.textContent)), null, { timeout: 4000 }).then(() => true, () => false);
    await page.mouse.up();
    check("held for longer than a press is, the menu is drawn again without waiting for it", drawnMeanwhile, null);
  }
  // A phone's width, where the sheet is the whole width: the same. The page is given the new width and asked for
  // its next frame, so that what is measured is laid out at that width.
  const widthOf = async (width, height) => {
    await page.setViewportSize({ width, height });
    await page.evaluate((w) => new Promise((done) => { const look = () => (innerWidth === w ? requestAnimationFrame(() => done()) : setTimeout(look, 50)); look(); }), width);
  };
  await widthOf(390, 760);
  const narrow = await sayAndLook("Said on a narrow screen.");
  settledFor("said on a narrow screen", narrow);
  check("the same on a narrow screen", !!narrow && narrow.words === "Said on a narrow screen." && narrow.inSheet && narrow.onTop && narrow.line.left >= 0 && narrow.line.right <= 390 && narrow.line.bottom <= narrow.foot.top + 1, narrow);
  await page.screenshot({ path: join(SHOTS, "menu-rows-said-in-the-sheet-narrow.png") });
  await widthOf(1100, 700);
  // And as the lines go, each after its four seconds, the rows are still where they were before any was said.
  await page.waitForFunction(() => !document.querySelector("nswp-hud").shadowRoot.querySelector(".say"), null, { timeout: 12000 }).catch(() => {});
  const afterwards = await rowsAt();
  check("as it goes, no row moves either", JSON.stringify(afterwards) === JSON.stringify(still[0]), [still[0], afterwards]);
  // With the menu down they are where they were: at the lower left, over the view. A line still up as the menu
  // goes moves there with it, and is simply there: it doesn't slide and fade in a second time. What is on top
  // there can't be asked as above: over the view a said line takes no presses, so the browser answers with the
  // view under it. Its place is what is checked, against a line said with the menu down all along.
  const down = await sayAndLook("Said as the menu goes.", "close");
  settledFor("moved as the menu went", down);
  check("a line already up doesn't come in again when the menu goes: nothing is running on it once moved", JSON.stringify(down?.runningOnceMoved) === "[]", down?.runningOnceMoved);
  const plain = await sayAndLook("Said with the menu down.");
  settledFor("said with the menu down", plain);
  check("with the menu down, it is at the lower left as before, and a line still up went there with it", !!down && down.words === "Said as the menu goes." && !down.inSheet && down.line.left < 40 && down.line.top > 350 && !!plain && !plain.inSheet && plain.line.left === down.line.left, { down, plain });
  // And the other way: a line said with the menu down, still up as the menu comes, is in the sheet with the rest.
  const raised = await sayAndLook("Said as the menu comes.", "open");
  settledFor("moved as the menu came", raised);
  check("nor when the menu comes: nothing is running on it once moved, and it is in the sheet", JSON.stringify(raised?.runningOnceMoved) === "[]" && raised.inSheet && raised.onTop, raised);
  await page.screenshot({ path: join(SHOTS, "menu-rows-said-as-the-menu-comes.png") });
  await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
  // A line lasts its moment and goes, wherever it stands.
  await page.waitForFunction(() => !document.querySelector("nswp-hud").shadowRoot.querySelector(".say"), null, { timeout: 12000 }).catch(() => {});
  check("and it goes after its moment", (await sayAndLook("")) === null, await sayAndLook(""));

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
