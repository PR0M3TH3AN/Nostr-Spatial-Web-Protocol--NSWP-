// Four more presses that must land in the page that asks, and whether the client can do the browser's part itself
// and hand the result over (docs/plans/the-clients-menu.md, section 15, "Four more presses"; the result is written
// up in docs/plans/the-clients-menu-handed-over.md). The second half of trials/presses-from-above.mjs, built the
// same way.
//
// Two pages on two different sites, as a client and a world are: a page above (client.test) and a page in its frame
// (world.test), given exactly what BitPortal's shell gives a world (`allow`, read from its index.html on 2026-11-23).
//
// - Choosing a file. The frame opens the browser's chooser: with nothing pressed, at a press above, at a press in
//   its own page. Then the other way round: the page above opens the chooser at its own press and hands the chosen
//   file down in words; the frame says what it got, and draws it to show it can use it.
// - Saving a picture. The frame saves one itself, the same three ways. Then the other way round: the frame makes
//   the picture and hands it up, and the page above saves it: at once, seven seconds after the press, twice from
//   one press, and with nothing ever pressed.
// - Sharing the screen. The frame asks to, the same three ways, with what the shell allows it and then with
//   `display-capture` allowed as well; and with the press above handed down by name (`delegate`). Asked of a second
//   Chrome, which is given no made-up yes and is started without the scripting tool's test switches: where it lets
//   the asking through, its own chooser comes up and nobody answers it. A chooser is not part of any page, so whether it came up is only known from a picture of the whole
//   screen: `--shown` runs that Chrome with a window, for a screen nobody is looking at
//   (`xvfb-run -a -s "-screen 0 1280x900x24" node trials/presses-handed-over.mjs --shown`), and keeps the pictures
//   in `.shots/`. Without `--shown` that part says only "no answer".
//   Then the other way round: the page above shares the screen itself at its own press and hands the picture down,
//   first as the track itself and then over a connection between the two pages, set up in words. That is asked of
//   a third Chrome, with a made-up yes at the chooser and a made-up screen.
// - Music needs no trial here: the page above chooses and plays it, and both are its own page's presses. It is tried
//   in the stand-in client (trials/menu-client.mjs).
//
// Nothing is ever run inside either page by this script: a scripted call into a page counts there as a press. Each
// page reads what to try from its own address and says what happened on its console. Presses are a mouse at a place
// on the screen. Whether a chooser opened and whether a file was saved are seen from outside, by the browser's own
// events, and a chosen file is given to the chooser from outside, as a person would choose one.
//
// What is real: Chrome's own rules on presses, frames and what a frame is allowed. What is a stand-in: both pages
// (they do nothing else), the person at the chooser (this script chooses), the files (a one-dot picture and 64 MB
// of nothing, made here and removed), where saved files go (nowhere: the save is seen and dropped), and the screen:
// where the frame asks, nothing is ever shared; where the page above shares, it is Chrome's made-up screen.
//
// Nothing is fetched from anywhere: both pages are served by this script, and nothing else is reached.
//
//   node trials/presses-handed-over.mjs
//   xvfb-run -a -s "-screen 0 1280x900x24" node trials/presses-handed-over.mjs --shown
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { mkdirSync, rmSync, writeFileSync } = await import("node:fs");
const { execFileSync } = await import("node:child_process");
const SHOWN = process.argv.includes("--shown");
const { join } = await import("node:path");

const CLIENT = "https://client.test";
const WORLD = "https://world.test";
/** What BitPortal's shell allows the page in its frame (bitportal src/shell/index.html). */
const ALLOW = "xr-spatial-tracking *; microphone *; autoplay *; gamepad *; clipboard-write *; fullscreen 'none'";
const BIG = 64 * 1024 * 1024;
const DOT = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64");

const above = (what, by, allow) => `<!doctype html><meta charset="utf-8"><title>above</title><body style="margin:0">
<button id="ask" style="position:fixed;left:10px;top:10px;z-index:2;width:160px;height:40px">ask the frame</button>
<input id="picker" type="file" hidden>
<iframe id="view" src="${WORLD}/#${what}" allow="${allow}" style="position:fixed;left:0;top:60px;width:800px;height:500px;border:0"></iframe>
<script>
const what = ${JSON.stringify(what)};
const view = document.getElementById("view");
const picker = document.getElementById("picker");
const say = (x) => console.log("SAID " + JSON.stringify(x));
const name = (e) => ((e && e.name) || String(e)) + (e && e.message ? ": " + e.message.slice(0, 90) : "");
// The page above shares the screen itself, at its own press, and hands the picture down: first the track as it is,
// then over a connection between the two pages, set up in words.
let pc = null;
const shareFromHere = async () => {
  let stream;
  try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true }); } catch (e) { return say({ sharedAbove: name(e) }); }
  const track = stream.getVideoTracks()[0];
  say({ sharedAbove: "the page above has the screen" });
  const copy = track.clone();
  try { view.contentWindow.postMessage({ track: copy }, "${WORLD}", [copy]); say({ trackHandedDown: "sent" }); } catch (e) { say({ trackHandedDown: name(e) }); copy.stop(); }
  pc = new RTCPeerConnection();
  pc.onicecandidate = (e) => { if (e.candidate) view.contentWindow.postMessage({ ice: e.candidate.toJSON() }, "${WORLD}"); };
  pc.addTrack(track, stream);
  await pc.setLocalDescription(await pc.createOffer());
  view.contentWindow.postMessage({ offer: pc.localDescription.toJSON(), sent: Date.now() }, "${WORLD}");
};
const ask = () => {
  if (what === "screenabove") return void shareFromHere();
  if (what === "handdown" || what === "handdownbig") return picker.click();
  if (what.startsWith("handup")) return view.contentWindow.postMessage({ shoot: what }, "${WORLD}");
  if (what === "screendelegated") { try { view.contentWindow.postMessage({ try: "screen" }, { targetOrigin: "${WORLD}", delegate: "display-capture" }); } catch (e) { say({ delegating: name(e) }); } return; }
  view.contentWindow.postMessage({ try: what }, "${WORLD}");
};
// A file chosen in this page goes down to the frame as it is: nothing is sent until one is chosen.
picker.addEventListener("change", () => {
  const file = picker.files[0];
  if (!file) return;
  say({ chosenAbove: { name: file.name, size: file.size } });
  view.contentWindow.postMessage({ file, sent: Date.now() }, "${WORLD}");
});
let saved = 0;
addEventListener("message", (e) => {
  if (e.source !== view.contentWindow) return;
  const d = e.data || {};
  if (d.answer && pc) return void pc.setRemoteDescription(d.answer);
  if (d.ice && pc) return void pc.addIceCandidate(d.ice).catch(() => undefined);
  // A picture handed up: saved from this page, under a name of this page's own.
  if (d.picture instanceof Blob) {
    const act = navigator.userActivation;
    const n = ++saved;
    say({ savingAbove: n, pressedNow: act.isActive, everPressed: act.hasBeenActive, size: d.picture.size, type: d.picture.type, sincePress: pressedAt ? Date.now() - pressedAt : null });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(d.picture);
    a.download = "saved-above-" + n + ".jpg";
    document.body.append(a); a.click(); a.remove();
    return;
  }
  say(d);
});
let pressedAt = 0;
document.getElementById("ask").addEventListener("click", () => { pressedAt = Date.now(); say({ abovePressed: true }); ask(); });
${by === "none" ? `view.addEventListener("load", () => setTimeout(ask, 600));` : ""}
</script>`;

const world = `<!doctype html><meta charset="utf-8"><title>world</title><body style="margin:0;background:#223">
<button id="own" style="position:fixed;left:10px;top:10px;width:160px;height:40px">try it here</button>
<input id="picker" type="file" hidden>
<canvas id="c" width="300" height="200" style="position:fixed;left:10px;top:70px;background:#445"></canvas>
<script>
const within = (p, ms) => Promise.race([p, new Promise((d) => setTimeout(() => d("no answer in time"), ms))]);
const name = (e) => ((e && e.name) || String(e)) + (e && e.message ? ": " + e.message.slice(0, 90) : "");
const c = document.getElementById("c");
const g = c.getContext("2d"); g.fillStyle = "#7bd88f"; g.fillRect(20, 20, 260, 160);
const shot = () => new Promise((d) => c.toBlob(d, "image/jpeg", 0.9));
const tries = {
  choose: () => { document.getElementById("picker").click(); return "asked for the chooser"; },
  save: async () => { const a = document.createElement("a"); a.href = URL.createObjectURL(await shot()); a.download = "saved-in-the-frame.jpg"; document.body.append(a); a.click(); a.remove(); return "asked to save"; },
  screen: () => within(navigator.mediaDevices.getDisplayMedia({ video: true }).then((s) => (s.getTracks().forEach((t) => t.stop()), "shared"), name), 4000).then((got) => (got === "no answer in time" ? "no answer: the picture says whether the browser's own chooser was up" : got)),
};
const run = async (what, by) => {
  const act = navigator.userActivation;
  const before = { pressedNow: act.isActive, everPressed: act.hasBeenActive };
  let got; try { got = await within(Promise.resolve(tries[what]()), 6000); } catch (e) { got = "threw: " + name(e); }
  parent.postMessage({ what, by, ...before, got }, "${CLIENT}");
};
const hash = location.hash.slice(1);
let link = null;
addEventListener("message", async (e) => {
  if (e.origin !== "${CLIENT}" || !e.data) return;
  const d = e.data;
  if (d.try) return run(d.try, "above");
  // A file handed down: what it is, and whether this page can use it.
  if (d.file instanceof Blob) {
    const got = { name: d.file.name, size: d.file.size, type: d.file.type, msToArrive: Date.now() - d.sent };
    const t = performance.now();
    try { const b = await createImageBitmap(d.file); got.drawn = b.width + "x" + b.height; } catch (err) { got.drawn = name(err); }
    try { got.lastBytes = new Uint8Array(await d.file.slice(-4).arrayBuffer()).join(","); } catch (err) { got.lastBytes = name(err); }
    try { const all = await d.file.arrayBuffer(); got.readAll = all.byteLength; } catch (err) { got.readAll = name(err); }
    got.msToRead = Math.round(performance.now() - t);
    return parent.postMessage({ fileGot: got }, "${CLIENT}");
  }
  // The screen, shared by the page above and handed down: the track as it is, or over a connection.
  if (d.track) return parent.postMessage({ trackGot: d.track.kind + ", " + d.track.readyState }, "${CLIENT}");
  if (d.offer) {
    link = new RTCPeerConnection();
    link.onicecandidate = (ev) => { if (ev.candidate) parent.postMessage({ ice: ev.candidate.toJSON() }, "${CLIENT}"); };
    link.ontrack = (ev) => {
      const v = document.createElement("video");
      v.muted = true; v.srcObject = new MediaStream([ev.track]); v.style.cssText = "position:fixed;right:10px;top:70px;width:300px";
      document.body.append(v); v.play().catch(() => undefined);
      const tick = () => {
        if (v.videoWidth) return parent.postMessage({ screenGot: { kind: ev.track.kind, size: v.videoWidth + "x" + v.videoHeight, msFromTheOffer: Date.now() - d.sent, pressedNow: navigator.userActivation.isActive } }, "${CLIENT}");
        if (Date.now() - d.sent < 9000) return setTimeout(tick, 100);
        parent.postMessage({ screenGot: "a track arrived, but no picture in 9 s" }, "${CLIENT}");
      };
      tick();
    };
    await link.setRemoteDescription(d.offer);
    await link.setLocalDescription(await link.createAnswer());
    return parent.postMessage({ answer: link.localDescription.toJSON() }, "${CLIENT}");
  }
  if (d.ice && link) return void link.addIceCandidate(d.ice).catch(() => undefined);
  // A picture handed up: at once, late, or twice.
  if (d.shoot) {
    const act = navigator.userActivation;
    parent.postMessage({ shooting: d.shoot, pressedNow: act.isActive }, "${CLIENT}");
    if (d.shoot === "handuplate") await new Promise((r) => setTimeout(r, 7000));
    parent.postMessage({ picture: await shot() }, "${CLIENT}");
    if (d.shoot === "handuptwice") { await new Promise((r) => setTimeout(r, 7000)); parent.postMessage({ picture: await shot() }, "${CLIENT}"); }
  }
});
document.getElementById("own").addEventListener("click", () => run(hash.replace("delegated", ""), "own"));
parent.postMessage({ ready: true, pressedNow: navigator.userActivation.isActive, everPressed: navigator.userActivation.hasBeenActive }, "${CLIENT}");
</script>`;

mkdirSync(SHOTS, { recursive: true });
const bigFile = join(SHOTS, "presses-handed-over-big.bin");
const dotFile = join(SHOTS, "presses-handed-over-dot.png");
writeFileSync(bigFile, Buffer.alloc(BIG, 7));
writeFileSync(dotFile, DOT);

const browser = await pw.chromium.launch({ channel: "chrome", headless: true });
// For sharing the screen: a Chrome of its own, with a window where `--shown` says so, and started without the
// scripting tool's test switches, so that it is as near a person's Chrome as a scripted one gets.
const screens = await pw.chromium.launch({ channel: "chrome", headless: !SHOWN, args: SHOWN ? ["--window-position=0,0", "--window-size=1000,760"] : [], ignoreDefaultArgs: ["--enable-automation", "--disable-popup-blocking", "--disable-field-trial-config", "--test-type="] });
// And one with a made-up yes at the browser's chooser, for the page above sharing the screen itself.
const yes = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen"] });
/** A picture of the whole screen, where there is one: the browser's own chooser is not part of any page. */
const pictureOfTheScreen = (name) => {
  if (!SHOWN || !process.env.DISPLAY) return null;
  const file = join(SHOTS, name);
  try { execFileSync("import", ["-display", process.env.DISPLAY, "-window", "root", file], { timeout: 15000 }); return file; } catch (e) { return `no picture: ${String(e).slice(0, 80)}`; }
};
/** Where the buttons are on the screen: the page above's, and (60 px lower, in the frame) the frame's own. */
const AT = { ask: [90, 30], own: [90, 90] };
const pause = (ms) => new Promise((d) => setTimeout(d, ms));
/** A fresh pair of pages; everything the page above says on its console; and what the browser did, seen from outside. */
const fresh = async (what, by, allow = ALLOW, choose = null, from = browser) => {
  const ctx = await from.newContext({ viewport: { width: 900, height: 620 }, acceptDownloads: true });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === CLIENT) return route.fulfill({ status: 200, contentType: "text/html", body: above(what, by, allow) });
    if (url.origin === WORLD) return route.fulfill({ status: 200, contentType: "text/html", body: world });
    return route.abort();
  });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.close());
  const page = await ctx.newPage();
  const said = [];
  const seen = { choosers: [], saved: [] };
  page.on("console", (m) => { const t = m.text(); if (t.startsWith("SAID ")) said.push(JSON.parse(t.slice(5))); });
  // The browser's chooser, whichever page opened it. A file is chosen only where this visit says one is.
  page.on("filechooser", (c) => { seen.choosers.push(c.page() === page ? "opened" : "opened elsewhere"); if (choose) void c.setFiles(choose).catch((e) => seen.choosers.push(`couldn't choose: ${String(e).slice(0, 80)}`)); });
  page.on("download", (d) => { seen.saved.push(d.suggestedFilename()); void d.cancel().catch(() => undefined); });
  const wait = async (fits, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { const g = said.find(fits); if (g) return g; await pause(100); } return null; };
  await page.goto(`${CLIENT}/`);
  const ready = await wait((x) => x.ready);
  // The frame says it is ready as its script starts, before it has been drawn: a press sent that instant can miss it.
  await pause(700);
  const press = (where) => page.mouse.click(...AT[where]);
  return { ctx, page, said, seen, wait, press, ready };
};
const three = async (what, allow, read, from = browser, picture = null) => {
  const out = {};
  for (const by of ["none", "above", "own"]) {
    const v = await fresh(what, by, allow, null, from);
    if (v.ready?.everPressed) r.tainted = "the frame said it had been pressed before anything was pressed";
    if (by === "above") await v.press("ask");
    if (by === "own") await v.press("own");
    if (picture) { await pause(2500); (out.pictures ??= {})[by] = pictureOfTheScreen(`${picture}-${by}.png`); }
    const g = await v.wait((x) => x.what === what.replace("delegated", ""), 9000);
    await pause(1500);
    out[by] = g ? { pressedNow: g.pressedNow, ...read(g, v.seen) } : "the frame never answered";
    await v.ctx.close();
  }
  return out;
};

const r = { browser: browser.version(), allow: ALLOW };
try {
  // ---- Choosing a file: the frame opens the chooser itself.
  r.chooseInTheFrame = await three("choose", ALLOW, (_g, seen) => ({ chooser: seen.choosers[0] ?? "never opened" }));

  // ---- Choosing a file: the page above opens the chooser at its own press, and hands the file down.
  r.fileHandedDown = {};
  for (const [what, file] of [["handdown", dotFile], ["handdownbig", bigFile]]) {
    const v = await fresh(what, "above", ALLOW, file);
    await v.press("ask");
    const got = await v.wait((x) => x.fileGot, 30000);
    r.fileHandedDown[what === "handdown" ? "a picture" : "64 MB"] = { chooserAbove: v.seen.choosers[0] ?? "never opened", theFrameGot: got?.fileGot ?? "nothing arrived" };
    await v.ctx.close();
  }
  // Nothing chosen, nothing sent: the chooser opens and this script chooses nothing.
  {
    const v = await fresh("handdown", "above");
    await v.press("ask");
    await pause(2000);
    r.fileHandedDown["nothing chosen"] = { chooserAbove: v.seen.choosers[0] ?? "never opened", theFrameGot: v.said.find((x) => x.fileGot)?.fileGot ?? "nothing arrived" };
    await v.ctx.close();
  }

  // ---- Saving a picture: the frame saves it itself.
  r.saveInTheFrame = await three("save", ALLOW, (g, seen) => ({ got: g.got, saved: seen.saved.length ? seen.saved : "nothing was saved" }));

  // ---- Saving a picture: the frame hands it up, and the page above saves it.
  r.pictureHandedUp = {};
  for (const [what, by, label, ms] of [["handup", "above", "at once", 3000], ["handuplate", "above", "seven seconds after the press", 10000], ["handuptwice", "above", "twice from one press, seven seconds apart", 10000], ["handup", "none", "with nothing ever pressed", 3000]]) {
    const v = await fresh(what, by);
    if (by === "above") await v.press("ask");
    await v.wait((x) => x.savingAbove, ms);
    await pause(ms);
    r.pictureHandedUp[label] = { saves: v.said.filter((x) => x.savingAbove).map(({ savingAbove, ...x }) => x), saved: v.seen.saved.length ? v.seen.saved : "nothing was saved" };
    await v.ctx.close();
  }

  // ---- Sharing the screen: with what the shell allows the frame, and with `display-capture` allowed as well.
  const far = (g) => ({ got: g.got });
  r.screen = { shown: SHOWN, asTheShellAllows: await three("screen", ALLOW, far, screens), withDisplayCaptureAllowed: await three("screen", `${ALLOW}; display-capture *`, far, screens, "presses-handed-over-screen") };
  // The press above, handed down by name.
  {
    const v = await fresh("screendelegated", "above", `${ALLOW}; display-capture *`, null, screens);
    await v.press("ask");
    await pause(2500);
    r.screen.pictureOfTheChooserHandedDown = pictureOfTheScreen("presses-handed-over-screen-handed-down.png");
    const g = await v.wait((x) => x.what === "screen", 9000);
    r.screen.pressAboveHandedDown = { delegating: v.said.find((x) => x.delegating)?.delegating ?? "taken", ...(g ? { pressedNow: g.pressedNow, got: g.got } : { got: "the frame never answered" }) };
    await v.ctx.close();
  }
  // ---- The page above shares the screen itself, at its own press, and hands it down. The frame is allowed only
  // what the shell allows it today.
  {
    const v = await fresh("screenabove", "above", ALLOW, null, yes);
    await v.press("ask");
    const got = await v.wait((x) => x.screenGot, 15000);
    await v.page.screenshot({ path: join(SHOTS, "presses-handed-over-screen-shared-above.png") });
    r.screen.sharedAboveAndHandedDown = {
      thePageAbove: v.said.find((x) => x.sharedAbove)?.sharedAbove ?? "never answered",
      theTrackItself: v.said.find((x) => x.trackHandedDown)?.trackHandedDown === "sent" ? `sent; the frame got: ${v.said.find((x) => x.trackGot)?.trackGot ?? "nothing"}` : (v.said.find((x) => x.trackHandedDown)?.trackHandedDown ?? "not tried"),
      overAConnection: got?.screenGot ?? "nothing arrived",
    };
    await v.ctx.close();
  }
} finally {
  await browser.close();
  await screens.close();
  await yes.close();
  rmSync(bigFile, { force: true });
  rmSync(dotFile, { force: true });
}

console.log(JSON.stringify(r, null, 2));
// The rules this trial stands on: with nothing pressed the frame is not counted as pressed, and each control (a
// press in the frame's own page) does what it should. If either fails, nothing else here says anything.
const bad = [];
if (r.tainted) bad.push(r.tainted);
if (r.chooseInTheFrame.none.pressedNow !== false) bad.push("with nothing pressed, the frame counted as pressed");
if (r.chooseInTheFrame.own.chooser !== "opened") bad.push("the control failed: a press in the frame didn't open the chooser");
if (!Array.isArray(r.saveInTheFrame.own.saved)) bad.push("the control failed: a press in the frame didn't save");
if (bad.length) {
  console.error(`\nThis run says nothing:\n- ${bad.join("\n- ")}`);
  process.exit(1);
}
