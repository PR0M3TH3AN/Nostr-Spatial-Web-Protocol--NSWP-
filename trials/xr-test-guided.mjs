// The guided headset test (/xr-test/, "Start the guided test"), a whole run, with a made-up headset (IWER) and
// made-up relays: every relay connection is answered here, and nothing is posted anywhere. Needs nothing running:
// the built page (npm run build) is served at the worlds' real addresses by the browser's own routing.
//   1. a browser that carries nothing across, as the owner's Quest 3S did on 2026-11-21: every step lands flat,
//      asks its question, and is sent; and what was sent is signed, of the kind, tagged by run, and whole
//   2. a browser that does carry VR across: a step arrives in VR, the trigger ends it, the middle page goes on
//   3. the test by hand with the same-site tick: a real reload, and nothing sent
// LIVE_SHELL=1 also takes steps 6 and 7 inside BitPortal's page, which loads the LIVE portal.bitblocks.network
// (read only; the test page inside it is still the built one, and the relays are still made up).
// What a REAL headset's browser does at a door is what the page is for, and nothing here shows that.
import { readFileSync } from "node:fs";
import { ROOT as W } from "./lib.mjs";
const pw = await import(`${W}/node_modules/playwright-core/index.mjs`);
const { verifyEvent } = await import(`${W}/packages/core/dist/index.js`);
const IWER = readFileSync(`${W}/node_modules/iwer/build/iwer.min.js`, "utf8");
const DIR = `${W}/sites/gallery/dist/xr-test`;
const HEAD = { "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self' https://portal.bitblocks.network", "permissions-policy": "xr-spatial-tracking=(self), microphone=(self)", "x-content-type-options": "nosniff", "cache-control": "no-cache" };
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const bad = []; const notes = [];
const want = (name, got, expected) => { const ok = JSON.stringify(got) === JSON.stringify(expected); notes.push(`${ok ? "ok  " : "BAD "} ${name}`); if (!ok) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
const open = async ({ grant = false, shell = true } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const events = [];
  await ctx.routeWebSocket(/^wss:\/\/(nos\.lol|relay\.primal\.net|relay\.snort\.social|nostr\.mom)\/?$/, (ws) => {
    ws.onMessage((m) => { const said = JSON.parse(m); if (said[0] === "EVENT") { events.push({ relay: ws.url(), event: said[1] }); if (!ws.url().includes("nostr.mom")) ws.send(JSON.stringify(["OK", said[1].id, true, ""])); else ws.send(JSON.stringify(["OK", said[1].id, false, "blocked: test"])); } });
  });
  await ctx.route(/^https:\/\/(gallery|grove|tour)\.bitblocks\.network\/xr-test(\/.*)?(\?.*)?$/, (route) => {
    const p = new URL(route.request().url()).pathname;
    const f = p.endsWith("test.js") ? "test.js" : p.endsWith("post.js") ? "post.js" : "index.html";
    route.fulfill({ status: 200, headers: { ...HEAD, "content-type": f === "index.html" ? "text/html; charset=utf-8" : "application/javascript; charset=utf-8" }, body: readFileSync(`${DIR}/${f}`) });
  });
  await ctx.addInitScript(`if (location.pathname.startsWith("/xr-test")) { ${IWER}; window.__dev = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false }); window.__dev.installRuntime({ forceInstall: true }); ${grant ? `if (new URLSearchParams(location.search).get("arr") === "1") addEventListener("DOMContentLoaded", () => setTimeout(() => navigator.xr.dispatchEvent(new Event("sessiongranted")), 300));` : ""} }`);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error" && /xr-test|Refused|Content Security/i.test(m.text())) errors.push("console: " + m.text().slice(0, 300)); });
  return { ctx, page, errors, events };
};
const tf = (page) => page.frames().find((f) => /\/xr-test\//.test(f.url()) && f.url().includes("run="));
const st = (f) => f.evaluate(() => ({ ...window.__xrTest.state(), log: window.__xrTest.log.slice(), guide: document.getElementById("guide")?.innerText ?? "", sent: document.getElementById("sent")?.innerText ?? "", manualHidden: document.getElementById("manual").hidden }));
const until = async (page, fn, ms = 90000) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch {} await page.waitForTimeout(150); } return null; };
const has = (log, re) => log.some((l) => re.test(l));
const press = async (page, text) => { const f = await until(page, async () => { const f = tf(page); return f && (await f.locator("#guide button", { hasText: text }).count()) ? f : null; }); if (!f) throw new Error(`no button "${text}"; guide says: ${(await st(tf(page))).guide}`); await f.locator("#guide button", { hasText: text }).first().click(); };
const guideSays = (page, re) => until(page, async () => re.test((await st(tf(page))).guide));
// The trigger, pulled and let go until what it was pulled for has happened: a made-up headset under load can miss one, and the page takes a door once however many it hears.
const pull = async (page, done) => until(page, async () => { if (await done()) return true; const f = tf(page); await f.evaluate(() => window.__dev.controllers.right.updateButtonValue("trigger", 1)); await page.waitForTimeout(150); await tf(page).evaluate(() => window.__dev.controllers.right.updateButtonValue("trigger", 0)); await page.waitForTimeout(600); return done(); });

// ---- 1. A browser that carries nothing across, as the Quest did: every step lands flat, asks, and is sent.
{
  const { ctx, page, errors, events } = await open();
  await page.goto("https://grove.bitblocks.network/xr-test");
  await page.click("#guided");
  await guideSays(page, /WebXR navigation permission/);
  let s = await st(tf(page));
  const run = s.run;
  want("1a begins on site A at step 0, with a run code, the by-hand part put away", [new URL(tf(page).url()).host, s.step, /^[A-Z2-7]{6}$/.test(run), s.manualHidden, /WebXR navigation permission/.test(s.guide)], ["gallery.bitblocks.network", 0, true, true, true]);
  await press(page, "Enabled");
  await press(page, "Yes");
  await guideSays(page, /Step 0 of 7 is done/);
  s = await st(tf(page));
  want("1b the two answers are in the log, and the log was sent", [has(s.log, /ANSWER before the doors: .*WebXR navigation permission.* "Enabled"/), has(s.log, /closed and opened again.* "Yes"/), has(s.log, /log sent \(before the doors\): 3 of 4 relays took it/), /sent to 3 of 4 relays/.test(s.sent), has(s.log, /Browser: Mozilla/)], [true, true, true, true, true]);
  const doors = [null, { to: "grove", line: /to B; leaving VR first/ }, { to: "grove", line: /to B; STAYING in VR/ }, { to: "tour", line: /to MID on the way to B; STAYING/ }, { to: "gallery", line: /to A \(this same site\); leaving VR first/ }, { to: "gallery", line: /to A \(this same site\); STAYING/ }];
  for (let n = 1; n <= 5; n++) {
    await press(page, `Go to step ${n}`);
    await until(page, async () => (await st(tf(page))).step === n && /Enter VR/.test((await st(tf(page))).guide));
    s = await st(tf(page));
    const top = [page.url().includes("/shell/"), new URL(tf(page).url()).host];
    await press(page, "Enter VR");
    await until(page, async () => has((await st(tf(page))).log, new RegExp(`STEP ${n} of 7 begins`)) && (await st(tf(page))).presenting);
    await pull(page, async () => (await st(tf(page))).arrived);
    await guideSays(page, /one question/);
    s = await st(tf(page));
    want(`1c step ${n}: starts on A outside BitPortal's page, the trigger takes the right door, lands flat on ${doors[n].to}, says so, sends it, asks`, [top, new URL(tf(page).url()).host.split(".")[0], s.presenting, has(s.log, doors[n].line), has(s.log, /NO sessiongranted after 3 seconds: this browser did not carry VR across\.$/), has(s.log, /log sent \(arrived flat\)/)], [[false, "gallery.bitblocks.network"], doors[n].to, false, true, true, true]);
    await press(page, "I was put back on a flat page");
    await guideSays(page, new RegExp(`Step ${n} of 7 is done`));
    s = await st(tf(page));
    want(`1d step ${n}: the answer is in the log`, has(s.log, new RegExp(`ANSWER step ${n}: after the trigger at the door, "I was put back on a flat page"`)), true);
  }
  // What went to the relays: every note signed, of the kind, tagged with the run, and readable.
  const mine = events.filter((e) => e.relay.includes("nos.lol")).map((e) => e.event);
  const bodies = mine.map((e) => JSON.parse(e.content));
  want("1e notes: all signed and valid, kind 4573, tagged by topic and by run, to four relays, one key a page", [mine.every((e) => verifyEvent(e)), mine.every((e) => e.kind === 4573), mine.every((e) => e.tags.some((t) => t[0] === "t" && t[1] === "nswp-xr-test") && e.tags.some((t) => t[0] === "t" && t[1] === `nswp-xr-test-${run.toLowerCase()}`) && e.tags.some((t) => t[0] === "expiration")), new Set(events.map((e) => e.relay)).size, new Set(mine.map((e) => e.pubkey)).size > 5], [true, true, true, 4, true]);
  want("1f notes: one before the doors, and two for each of five steps (landed, answered), each with its step and the browser's name", [mine.length, bodies.map((b) => b.step).join(""), bodies.every((b) => b.run === run && /Mozilla/.test(b.ua) && Array.isArray(b.log)), bodies.filter((b) => b.why === "answered").length], [11, "01122334455", true, 5]);
  const all = [...new Set(bodies.flatMap((b) => b.log))];
  want("1g put together, the notes hold every step's door and answer", [1, 2, 3, 4, 5].map((n) => all.some((l) => new RegExp(`ANSWER step ${n}:`).test(l)) && all.some((l) => new RegExp(`STEP ${n} of 7 begins`).test(l))), [true, true, true, true, true]);
  want("1 errors", errors, []);
  // ---- steps 6 and 7 go inside BitPortal's page: the live one, framing the routed test.
  if (process.env.LIVE_SHELL !== "1") notes.push("--   steps 6 and 7 (inside BitPortal's page) not taken: LIVE_SHELL=1 takes them, through the live page");
  else {
  await press(page, "Go to step 6");
  const inShell = await until(page, async () => page.url().includes("portal.bitblocks.network/shell/") && tf(page) && (await st(tf(page))).step === 6, 30000);
  if (!inShell) { notes.push(`??   step 6: BitPortal's live page did not show the test in its frame (top: ${page.url().slice(0, 90)})`); }
  else {
    for (const [n, host] of [[6, "grove"], [7, "gallery"]]) {
      if (n === 7) { await press(page, "Go to step 7"); await until(page, async () => (await st(tf(page))).step === 7 && /Enter VR/.test((await st(tf(page))).guide)); }
      s = await st(tf(page));
      await press(page, "Enter VR");
      await until(page, async () => (await st(tf(page))).presenting);
      await tf(page).evaluate(() => void window.__xrTest.go("trigger"));
      await until(page, async () => (await st(tf(page))).arrived);
      await guideSays(page, /one question/);
      s = await st(tf(page));
      want(`1h step ${n}: inside BitPortal's page throughout, lands flat on ${host} in the frame, asks`, [page.url().includes("/shell/"), s.framed, new URL(tf(page).url()).host.split(".")[0], has(s.log, /\(framed\) .*STAYING in VR/), has(s.log, /\(framed\) .*NO sessiongranted/)], [true, true, host, true, true]);
      await press(page, "I was put back on a flat page");
      await guideSays(page, new RegExp(`Step ${n} of 7 is done`));
    }
    await press(page, "Finish");
    await guideSays(page, /Tell Claude this run's code/);
    s = await st(tf(page));
    want("1i the end: the run's code is shown, and the last of the log was sent", [s.guide.includes(run), has(s.log, /log sent \(finished\)/)], [true, true]);
    want("1 errors, inside BitPortal's page", errors, []);
  }
  }
  await ctx.close();
}
// ---- 2. A browser that does carry VR across: the step arrives in VR, the trigger ends it, and the question follows.
{
  const { ctx, page, errors, events } = await open({ grant: true });
  await page.goto("https://gallery.bitblocks.network/xr-test/?run=TESTAA&step=2");
  await press(page, "Enter VR");
  await until(page, async () => (await st(tf(page))).presenting);
  await tf(page).evaluate(() => void window.__xrTest.go("trigger"));
  await until(page, async () => { const s = await st(tf(page)); return s.arrived && s.presenting && has(s.log, /ARRIVED IN VR with no press \(step 2\)/); });
  let s = await st(tf(page));
  want("2a arrives on B in VR with no press, and says so", [s.me, s.presenting, has(s.log, /^B .*sessiongranted/), has(s.log, /ARRIVED IN VR with no press/)], ["B", true, true, true]);
  await pull(page, async () => /one question/.test((await st(tf(page))).guide));
  await guideSays(page, /one question/);
  s = await st(tf(page));
  want("2b the trigger ends the step where it is (no further door), and the question is asked", [s.me, s.presenting, has(s.log, /door taken/) && !has(s.log, /^A .*door taken/) ? "took a door" : "no door"], ["B", false, "no door"]);
  await press(page, "I stayed in VR");
  await guideSays(page, /Step 2 of 7 is done/);
  want("2c sent: arrived in VR, then the answer", events.filter((e) => e.relay.includes("nos.lol")).map((e) => JSON.parse(e.event.content).why), ["arrived in VR", "answered"]);
  // By a middle page: it takes VR and goes on by itself, and B is where the step is judged.
  await page.goto("https://gallery.bitblocks.network/xr-test/?run=TESTAA&step=3");
  await press(page, "Enter VR");
  await until(page, async () => (await st(tf(page))).presenting);
  await tf(page).evaluate(() => void window.__xrTest.go("trigger"));
  await until(page, async () => { const s = await st(tf(page)); return s.me === "B" && s.presenting; }, 30000);
  s = await st(tf(page));
  want("2d by the middle page in VR, on to B in VR", [s.me, has(s.log, /^MID .*first frame drawn in VR/), has(s.log, /^MID .*by itself, from the middle page/), has(s.log, /^B .*ARRIVED IN VR/)], ["B", true, true, true]);
  want("2 errors", errors, []);
  await ctx.close();
}
// ---- 3. By hand, as before, and the new tick: a door back to the same site really loads the page again.
{
  const { ctx, page, errors, events } = await open();
  await page.goto("https://gallery.bitblocks.network/xr-test/");
  await page.check("#same");
  await page.click("#enter");
  await until(page, async () => (await page.evaluate(() => window.__xrTest.state().presenting)));
  await page.evaluate(() => void window.__xrTest.go("trigger"));
  await until(page, async () => (await page.evaluate(() => window.__xrTest.log.some((l) => /NO sessiongranted after 3 seconds: this browser did not carry VR across\. Press Enter VR\./.test(l)))));
  const log = await page.evaluate(() => window.__xrTest.log.slice());
  want("3 by hand, same site: a new page on A, the tick kept, the old words, and nothing sent anywhere", [new URL(page.url()).host, await page.isChecked("#same"), has(log, /to A \(this same site\); leaving VR first/), log.filter((l) => /page began/.test(l)).length, events.length, await page.isVisible("#manual")], ["gallery.bitblocks.network", true, true, 2, 0, true]);
  want("3 errors", errors, []);
  await ctx.close();
}
await browser.close();
console.log(notes.join("\n"));
console.log(bad.length ? `\nFAILED (${bad.length}):\n${bad.join("\n")}` : "\nALL PASSED");
process.exit(bad.length ? 1 : 0);
