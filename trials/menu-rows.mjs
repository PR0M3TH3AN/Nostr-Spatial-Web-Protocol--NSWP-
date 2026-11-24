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
      return { words: line.textContent, settled, runningOnceMoved, line: at, sheet: box(root.querySelector("section.sheet")), foot: box(root.querySelector(".foot")), rows: box(root.querySelector(".rows")), onTop, over: onTop ? null : `${top?.tagName} ${top?.className}`, inSheet: !!line.closest("section.sheet") };
    }, [words, then ?? ""]);
  /** A look is a look only if the line had finished coming in: said by name, so that a slow page isn't read as a wrong place. */
  const settledFor = (what, look) => check(`${what}: the line had finished coming in before its place was read`, look?.settled === true, look && { settled: look.settled });
  const up = await sayAndLook("Said with the menu up.");
  results["a line said with the menu up, where it is"] = up;
  settledFor("said with the menu up", up);
  check("with the menu up, what is said for a moment is in the sheet, above its foot and below its rows", !!up && up.words === "Said with the menu up." && up.inSheet && up.line.left >= up.sheet.left && up.line.right <= up.sheet.right && up.line.bottom <= up.foot.top + 1 && up.line.top >= up.rows.bottom - 1, up);
  check("and nothing lies over it", up?.onTop === true, up);
  await page.screenshot({ path: join(SHOTS, "menu-rows-said-in-the-sheet.png") });
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
