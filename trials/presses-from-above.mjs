// Which presses must land in the world's own page (docs/plans/the-clients-menu.md, step 0b). When the client draws
// the menu above a framed world, a press on the menu is a press in the client's page, not the world's. A browser
// lets a page do some things only at a press in that page. This asks a real Chrome which.
//
// Two pages on two different sites, as a client and a world are: a page above (client.test) with a button, and a
// page in its frame (world.test), given exactly what BitPortal's shell gives a world (`allow`, read from its
// index.html on 2026-11-23). For each thing a world does at a press, it is tried twice, each on a page freshly
// loaded so no earlier press counts:
//   "none":  nothing is pressed anywhere; the page above tells the frame in words by itself. What no press gets.
//   "above": the button in the page above is pressed, which tells the frame in words; the frame tries at once.
//   "own":   a button in the frame's own page is pressed; the frame tries at once. The control.
//
// Nothing is ever run inside either page by this script, and no button is found by asking the page for it: a
// scripted call into a page counts there as a press, and so does the call a scripting tool makes to find a button.
// The first two runs of this trial were wrong for those reasons (the frame said it had been pressed with nothing
// pressed anywhere). So each page reads what to try from its own address and says what happened on its console,
// which is all this script reads; and presses are a mouse at a place on the screen, and keys, as a person's are.
//
// What is real: Chrome's own rules on presses, frames and what a frame is allowed. What is a stand-in: both pages
// (they do nothing else), the microphone (Chrome's made-up one, allowed without asking), and there is no headset:
// Chrome is asked for a session and its refusal is read. With no press it refuses for want of one ("SecurityError");
// with one it gets as far as finding there is no headset ("NotSupportedError"). The made-up headset the other
// trials use (iwer) is a script in the page and asks for no press at all, so it can't answer this.
//
// Nothing is fetched from anywhere: both pages are served by this script, and nothing else is reached.
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { mkdirSync, writeFileSync } = await import("node:fs");
const { join } = await import("node:path");

const CLIENT = "https://client.test";
const WORLD = "https://world.test";
/** What BitPortal's shell allows the page in its frame (bitportal src/shell/index.html). */
const ALLOW = "xr-spatial-tracking *; microphone *; autoplay *; gamepad *; clipboard-write *; fullscreen 'none'";

const above = (what, by) => `<!doctype html><meta charset="utf-8"><title>above</title><body style="margin:0">
<button id="ask" style="position:fixed;left:10px;top:10px;z-index:2;width:160px;height:40px">ask the frame</button>
<button id="back" style="position:fixed;left:190px;top:10px;z-index:2;width:160px;height:40px">give the keys back</button>
<iframe id="view" src="${WORLD}/#${what}" allow="${ALLOW}" style="position:fixed;left:0;top:60px;width:800px;height:500px;border:0"></iframe>
<script>
const view = document.getElementById("view");
const ask = () => view.contentWindow.postMessage({ try: ${JSON.stringify(what)} }, "${WORLD}");
addEventListener("message", (e) => {
  if (e.source !== view.contentWindow) return;
  console.log("SAID " + JSON.stringify(e.data));
  // The frame holds the pointer: say what this page sees of it, and try to let it go, with no press (none is needed to let go).
  if (${JSON.stringify(what)} === "pointerabove" && e.data && e.data.pointer === "held") setTimeout(() => { console.log("SAID " + JSON.stringify({ above: document.pointerLockElement ? document.pointerLockElement.tagName : null })); document.exitPointerLock(); }, 300);
});
document.getElementById("ask").addEventListener("click", ask);
document.getElementById("back").addEventListener("click", () => view.focus());
if (${JSON.stringify(what)} === "pasteabove") document.getElementById("ask").addEventListener("click", () => navigator.clipboard.readText().then(() => "read", (e) => e.name).then((got) => console.log("SAID " + JSON.stringify({ pasteAbove: got }))));
${by === "none" ? `view.addEventListener("load", () => setTimeout(ask, 600));` : ""}
${what === "handed" ? `view.addEventListener("load", () => { const out = {}; for (const w of ["fullscreen", "payment", "display-capture", "xr-spatial-tracking", "pointer-lock"]) { try { view.contentWindow.postMessage({ nothing: true }, { targetOrigin: "${WORLD}", delegate: w }); out[w] = "taken"; } catch (e) { out[w] = e.name; } } console.log("SAID " + JSON.stringify({ handed: out })); });` : ""}
</script>`;

const world = `<!doctype html><meta charset="utf-8"><title>world</title><body style="margin:0;background:#223">
<button id="own" style="position:fixed;left:10px;top:10px;width:160px;height:40px">try it here</button>
<canvas id="c" width="300" height="200" style="position:fixed;left:10px;top:70px;background:#445"></canvas>
<script>
const within = (p, ms) => Promise.race([p, new Promise((d) => setTimeout(() => d("no answer in time"), ms))]);
const name = (e) => (e && e.name) || String(e);
const tries = {
  headset: () => (navigator.xr ? navigator.xr.requestSession("immersive-vr").then((s) => (s.end(), "started"), name) : "this browser has no navigator.xr"),
  pointer: () => new Promise((done) => {
    const c = document.getElementById("c");
    const end = (said) => { document.removeEventListener("pointerlockchange", on); document.removeEventListener("pointerlockerror", off); done(said); };
    const on = () => end(document.pointerLockElement === c ? "taken" : "let go");
    const off = () => end("refused");
    document.addEventListener("pointerlockchange", on); document.addEventListener("pointerlockerror", off);
    try { const p = c.requestPointerLock(); if (p && p.catch) p.catch((e) => end("refused: " + name(e))); } catch (e) { end("refused: " + name(e)); }
    setTimeout(() => end("no answer in time"), 1500);
  }),
  microphone: () => navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => (s.getTracks().forEach((t) => t.stop()), "given"), name),
  sound: async () => { const a = new AudioContext(); await within(a.resume(), 1000); const s = a.state; a.close(); return s; },
  window: () => { const w = window.open("about:blank", "_blank", "popup,width=200,height=200"); if (w) w.close(); return w ? "opened" : "blocked"; },
  copy: () => navigator.clipboard.writeText("x").then(() => "written", name),
  paste: () => navigator.clipboard.readText().then(() => "read", name),
  fullscreen: () => document.documentElement.requestFullscreen().then(() => (document.exitFullscreen(), "filled"), name),
};
const run = async (what, by) => {
  const act = navigator.userActivation;
  const before = { pressedNow: act.isActive, everPressed: act.hasBeenActive };
  let got; try { got = await within(Promise.resolve(tries[what]()), 4000); } catch (e) { got = "threw: " + name(e); }
  parent.postMessage({ what, by, ...before, got }, "${CLIENT}");
};
addEventListener("message", (e) => { if (e.origin === "${CLIENT}" && e.data && e.data.try) run(e.data.try, "above"); });
document.getElementById("own").addEventListener("click", () => run(location.hash.slice(1) === "pointerabove" ? "pointer" : location.hash.slice(1), "own"));
parent.postMessage({ ready: true, pressedNow: navigator.userActivation.isActive, everPressed: navigator.userActivation.hasBeenActive }, "${CLIENT}");
addEventListener("keydown", (e) => parent.postMessage({ key: e.code }, "${CLIENT}"));
document.addEventListener("pointerlockchange", () => parent.postMessage({ pointer: document.pointerLockElement ? "held" : "free" }, "${CLIENT}"));
</script>`;

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
/** Where the buttons are on the screen: the page above's, and (60 px lower, in the frame) the frame's own. */
const AT = { ask: [90, 30], back: [270, 30], own: [90, 90], canvas: [160, 230] };
/** A fresh pair of pages, and everything the page above says on its console. */
const fresh = async (what, by) => {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 620 } });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === CLIENT) return route.fulfill({ status: 200, contentType: "text/html", body: above(what, by) });
    if (url.origin === WORLD) return route.fulfill({ status: 200, contentType: "text/html", body: world });
    return route.abort();
  });
  // The visitor has said yes to both sites reading and writing what they copy: what is left is the frame's allowance.
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: WORLD }).catch(() => undefined);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: CLIENT }).catch(() => undefined);
  const page = await ctx.newPage();
  const said = [];
  page.on("console", (m) => { const t = m.text(); if (t.startsWith("SAID ")) said.push(JSON.parse(t.slice(5))); });
  const wait = async (fits, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { const g = said.find(fits); if (g) return g; await new Promise((d) => setTimeout(d, 100)); } return null; };
  await page.goto(`${CLIENT}/`);
  const ready = await wait((x) => x.ready);
  // The frame says it is ready as its script starts, before it has been drawn: a press sent that instant can miss it.
  await new Promise((d) => setTimeout(d, 700));
  const press = (where) => page.mouse.click(...AT[where]);
  return { ctx, page, said, wait, press, ready };
};
const pause = (ms) => new Promise((d) => setTimeout(d, ms));

const r = { browser: browser.version(), allow: ALLOW, presses: {} };
for (const what of ["headset", "pointer", "microphone", "sound", "window", "copy", "paste", "fullscreen"]) {
  r.presses[what] = {};
  for (const by of ["none", "above", "own"]) {
    const { ctx, wait, press, ready } = await fresh(what, by);
    if (ready?.everPressed) r.tainted = "the frame said it had been pressed before anything was pressed";
    if (by === "above") await press("ask");
    if (by === "own") await press("own");
    const g = await wait((x) => x.what === what);
    r.presses[what][by] = g ? { pressedNow: g.pressedNow, everPressed: g.everPressed, got: g.got } : "the frame never answered";
    await ctx.close();
  }
}

// ---- The keys: after a press on the page above, who hears them, and can the page above give them back?
{
  const { ctx, page, said, press } = await fresh("keys", "own");
  const keys = async (code) => { said.length = 0; await page.keyboard.press(code); await pause(250); return said.filter((x) => x.key).map((x) => x.key); };
  await press("canvas");
  const afterPressInFrame = await keys("KeyA");
  await press("ask");
  const afterPressAbove = await keys("KeyB");
  await press("back");
  const afterGivenBack = await keys("KeyC");
  r.keys = { afterPressInFrame, afterPressAbove, afterGivenBack };
  await ctx.close();
}

// ---- The pointer, taken by the frame at a press in it: what the page above sees of it, and whether it can let it go.
{
  const { ctx, said, wait, press } = await fresh("pointerabove", "own");
  await press("own");
  const taken = await wait((x) => x.what === "pointer");
  const seen = await wait((x) => "above" in x, 3000);
  await pause(600);
  r.pointerFromAbove = { takenInFrame: taken?.got ?? null, whatThePageAboveSees: seen ? seen.above : "it never heard the frame held it", theFrameSaid: said.filter((x) => x.pointer).map((x) => x.pointer) };
  await ctx.close();
}

// ---- The control for reading what was copied: the page above reads it itself, at a press in it.
{
  const { ctx, wait, press } = await fresh("pasteabove", "above");
  await press("ask");
  r.pasteByThePageAbove = (await wait((x) => x.pasteAbove))?.pasteAbove ?? null;
  await ctx.close();
}

// ---- Can a press be handed down in the words themselves? A browser offers that for a few named things only.
{
  const { ctx, wait, press } = await fresh("handed", "own");
  r.handedDownWithNoPress = (await wait((x) => x.handed))?.handed ?? null;
  await ctx.close();
}
await browser.close();

mkdirSync(SHOTS, { recursive: true });
writeFileSync(join(SHOTS, "presses-from-above.json"), JSON.stringify(r, null, 1));
console.log(JSON.stringify(r, null, 1));
