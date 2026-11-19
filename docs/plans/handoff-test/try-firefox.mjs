// The same hand-off in Firefox, driven over Marionette (its own remote protocol). Real clicks.
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Run with the two sites up (node docs/plans/handoff-test/serve.mjs). Needs Firefox on the path.
const profile = mkdtempSync(join(tmpdir(), "ff-handoff-"));
writeFileSync(join(profile, "user.js"), ['user_pref("marionette.port", 2829);', 'user_pref("browser.shell.checkDefaultBrowser", false);', 'user_pref("datareporting.policy.dataSubmissionEnabled", false);', 'user_pref("browser.link.open_newwindow", 3);'].join("\n"));
const ff = spawn("firefox", ["--headless", "--marionette", "--no-remote", "-profile", profile], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let sock;
for (let i = 0; i < 60 && !sock; i++) {
  await sleep(500);
  sock = await new Promise((res) => { const s = connect(2829, "127.0.0.1", () => res(s)); s.on("error", () => res(null)); });
}
if (!sock) { console.log("no marionette"); ff.kill(); process.exit(1); }
let buf = Buffer.alloc(0);
const waiting = new Map();
let hello;
const gotHello = new Promise((r) => (hello = r));
sock.on("data", (d) => {
  buf = Buffer.concat([buf, d]);
  for (;;) {
    const colon = buf.indexOf(":");
    if (colon === -1) return;
    const len = Number(buf.subarray(0, colon).toString());
    if (buf.length < colon + 1 + len) return;
    const msg = JSON.parse(buf.subarray(colon + 1, colon + 1 + len).toString());
    buf = buf.subarray(colon + 1 + len);
    if (!Array.isArray(msg)) hello(msg);
    else waiting.get(msg[1])?.(msg);
  }
});
await gotHello;
let id = 0;
const cmd = (name, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id;
    waiting.set(n, (m) => (m[2] ? rej(new Error(`${name}: ${m[2].message}`)) : res(m[3])));
    const body = JSON.stringify([0, n, name, params]);
    sock.write(`${Buffer.byteLength(body)}:${body}`);
  });
const js = async (script, args = []) => (await cmd("WebDriver:ExecuteScript", { script, args })).value;
const click = async (sel) => {
  const el = (await cmd("WebDriver:FindElement", { using: "css selector", value: sel })).value;
  await cmd("WebDriver:ElementClick", { id: Object.values(el)[0] });
};
const handles = async () => await cmd("WebDriver:GetWindowHandles");
const until = async (script, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(script)) return true; await sleep(150); } return false; };
const r = { browser: "firefox" };
try {
  const session = await cmd("WebDriver:NewSession", { capabilities: { alwaysMatch: { acceptInsecureCerts: true } } });
  r.version = session.capabilities.browserVersion;
  const CLIENT = "http://127.0.0.1:4391", WORLD = "http://localhost:4392";
  await cmd("WebDriver:Navigate", { url: `${CLIENT}/?signin=1` });
  const secret = await js("return localStorage.getItem('session')");
  r.signedInAtClient = !!secret;
  await cmd("WebDriver:Navigate", { url: `${WORLD}/` });
  await until("return window.seen.some((m) => m.data && m.data.t === 'ready')");
  const state = async () => { await js("window.seen = window.seen.filter((m) => !(m.data && m.data.t === 'state')); window.ask({ t: 'state' })"); await until("return window.seen.some((m) => m.data && m.data.t === 'state')"); return js("return window.seen.filter((m) => m.data && m.data.t === 'state').pop().data"); };
  r.signerAtStart = await state();
  const main = (await handles())[0];
  await click("#connect");
  await sleep(1500);
  const all = await handles();
  r.windowsOpen = all.length;
  const popup = all.find((h) => h !== main);
  if (popup) {
    await cmd("WebDriver:SwitchToWindow", { handle: popup });
    await until("return !document.getElementById('allow').hidden", 6000);
    r.windowSays = await js("return document.getElementById('who').textContent + ' | ' + document.getElementById('out').textContent");
    await cmd("WebDriver:SwitchToWindow", { handle: main });
    r.whatTheWorldCanRead = await js("return window.tryToSteal()");
    await cmd("WebDriver:SwitchToWindow", { handle: popup });
    if (await js("return !document.getElementById('allow').hidden")) await click("#allow");
    await sleep(700);
    await cmd("WebDriver:SwitchToWindow", { handle: main });
  }
  await until("return window.seen.some((m) => m.data && m.data.t === 'unlocked')", 3000);
  r.signerAfter = await state();
  await click("#sign");
  await until("return window.seen.some((m) => m.data && m.data.t === 'signed')");
  r.signAfterConnecting = await js("return window.seen.filter((m) => m.data && m.data.t === 'signed').pop().data");
  r.worldSawTheSecret = await js("return JSON.stringify(window.seen).includes(arguments[0])", [secret]);
  // The hostile world.
  await cmd("WebDriver:Navigate", { url: `${WORLD}/hostile.html` });
  const before = await handles();
  await click("#connect");
  await sleep(2000);
  const after = await handles();
  const popup2 = after.find((h) => !before.includes(h));
  const hostile = { windowOpened: !!popup2 };
  if (popup2) {
    await cmd("WebDriver:SwitchToWindow", { handle: popup2 });
    hostile.windowSays = await js("return document.getElementById('who').textContent");
    hostile.allowOffered = await js("return !document.getElementById('allow').hidden");
    await cmd("WebDriver:SwitchToWindow", { handle: before[0] });
  }
  hostile.sawTheSecret = await js("return JSON.stringify(window.seen).includes(arguments[0])", [secret]);
  r.hostile = hostile;
} catch (err) {
  r.error = String(err.message ?? err).slice(0, 300);
}
console.log(JSON.stringify(r, null, 1));
ff.kill();
process.exit(0);
