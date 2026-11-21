// The new headset test page on the local Gallery: it loads with no error, and sends nothing by itself. Every relay
// connection is refused and counted, and the guided button is NOT pressed: nothing is posted anywhere.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 800 } });
let sockets = 0; const errors = [];
await ctx.routeWebSocket(/^wss?:\/\//, (ws) => { sockets++; ws.close(); });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
const out = {};
for (const path of ["/xr-test", "/xr-test/"]) {
  await page.goto(`https://${HOST}:4301${path}`);
  await page.waitForTimeout(1500);
  out[path] = { buttons: await page.evaluate(() => [...document.querySelectorAll("button, a.btn")].map((b) => b.textContent.trim().slice(0, 60))), post: await page.evaluate(() => (window.__xrPost ? { kind: window.__xrPost.kind, relays: window.__xrPost.relays.length } : null)), log: await page.evaluate(() => document.getElementById("log")?.textContent.split("\n").filter(Boolean).length) };
}
out.socketsOpenedWithoutAPress = sockets; out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
