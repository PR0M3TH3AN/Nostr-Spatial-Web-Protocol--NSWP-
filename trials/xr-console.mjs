// The console in a headset in a Three.js world (packages/sdk/src/console.ts), drawn by the kit's own drawing
// (console-drawing.ts), which a world made with another engine is handed too. This looks at it where it has always
// been: a reference world's own panel, in a session.
//
// What is real: this checkout's own build of the Gallery (`npm run build` first), opened by its address in a real
// Chrome, its console and the kit's drawing of it. What is a stand-in: the headset, a made-up one (`iwer`) that
// starts a session whenever asked, and the site's name. The made-up headset has no hands, so the console is opened
// and pressed through the world's test hook, by the words on it; and the picture is read from the panel's own
// canvas. What it can't show: how it looks in a headset, a ray from a real hand, a wrist.
//
// Nothing leaves this machine: the page is served from the build, every other request is refused, and no WebSocket
// reaches anything.
//
//   npm run build && node trials/xr-console.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const WORLD = "https://gallery.test";
const DIST = join(NSWP, "sites", "gallery", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".webp": "image/webp" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
mkdirSync(SHOTS, { recursive: true });
const IWER = readFileSync(join(NSWP, "node_modules", "iwer", "build", "iwer.min.js"), "utf8");

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript(`${IWER}; new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false }).installRuntime({ forceInstall: true });`);
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }));
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== WORLD) return route.abort();
    const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(100); } };
  await page.goto(`${WORLD}/`, { timeout: 60000 });
  await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
  // Into the session by the world's own row, pressed with the mouse.
  await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "look"));
  const enter = page.locator("nswp-hud").getByRole("button", { name: /Enter VR/ }).first();
  await until(() => enter.isVisible(), 10000);
  await enter.click({ timeout: 15000 }).catch(() => undefined);
  check("the Gallery starts a session in the made-up headset", await until(() => page.evaluate(() => window.__nswpTest.state.xr === "presenting"), 30000), await page.evaluate(() => window.__nswpTest.state.xr));

  const said = () => page.evaluate(() => window.__nswpTest.console.describe());
  /** The panel's own picture, read where it is drawn: how much of it has anything on it, and a copy to look at. */
  const picture = () => page.evaluate(() => {
    const panel = window.__nswpTest.console.group.children.find((c) => c.material?.uniforms?.map);
    const canvas = panel.material.uniforms.map.value.image;
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let drawn = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
    return { size: [canvas.width, canvas.height], drawn: drawn / (canvas.width * canvas.height), png: canvas.toDataURL("image/png") };
  });
  const keep = (name, p) => writeFileSync(join(SHOTS, name), Buffer.from(p.png.split(",")[1], "base64"));

  await page.evaluate(() => window.__nswpTest.console.setOpen(true));
  const open = await until(async () => { const d = await said(); return d.open && d.sections.length > 3 ? d : null; }, 10000);
  check("its console comes up, with the world's sections and the buttons of the one that is up", !!open && open.buttons.length > 0 && open.section !== "", open);
  results["the console, as it says it is"] = open && { section: open.section, sections: open.sections, buttons: open.buttons };
  await page.waitForTimeout(600);
  const first = await picture();
  check("the picture is drawn on the panel's own canvas, at the console's size", first.size.join() === "1024,640" && first.drawn > 0.9, { size: first.size, drawn: first.drawn });
  keep("xr-console-1-open.png", first);

  check("a press on another section brings it up", (await page.evaluate(() => window.__nswpTest.console.pressLabelled("Sound"))) && (await until(async () => (await said()).section === "sound", 5000)), await said());
  await page.waitForTimeout(500);
  const second = await picture();
  check("and the picture is drawn again for it", second.png !== first.png, null);
  // One size on every tab (the owner, 2026-11-24: "The menus size should be the same across all tabs", "in all
  // modes"). In a headset the console is one picture on one panel: every section is drawn on the same canvas, and
  // the panel is where it was and as large. Gone through section by section, and held to.
  {
    const placed = () => page.evaluate(() => { const g = window.__nswpTest.console.group; const panel = g.children.find((c) => c.material?.uniforms?.map); const canvas = panel.material.uniforms.map.value.image; return { picture: [canvas.width, canvas.height], scale: panel.scale.toArray().map((n) => Math.round(n * 1000) / 1000), at: g.position.toArray().map((n) => Math.round(n * 100) / 100) }; });
    const sections = (await said()).sections;
    const seen = [];
    for (const name of sections) {
      if (!(await page.evaluate((name) => window.__nswpTest.console.pressLabelled(name), name))) continue;
      await page.waitForTimeout(350);
      seen.push({ name, ...(await placed()) });
    }
    const differs = seen.filter((x) => JSON.stringify([x.picture, x.scale, x.at]) !== JSON.stringify([seen[0].picture, seen[0].scale, seen[0].at]));
    check(`one size in a headset: on every one of the console's ${seen.length} sections the picture is the same size, on a panel as large and where it was`, seen.length >= 6 && differs.length === 0, { first: seen[0], differs });
    await page.evaluate(() => window.__nswpTest.console.pressLabelled("Sound"));
    await page.waitForTimeout(350);
  }
  keep("xr-console-2-sound.png", second);
  // Pointed at, a row is lit in the picture itself here: the picture changes, and changes back. Aimed and read in
  // one go, inside the page: the world aims the console afresh every frame from where its hands point, and this
  // headset has none, so what is aimed here lasts only until the next frame.
  const lit = await page.evaluate(() => {
    const c = window.__nswpTest.console;
    const canvas = c.group.children.find((x) => x.material?.uniforms?.map).material.uniforms.map.value.image;
    // Twice round, so that what is compared was drawn in the same moment: lit, plain, lit, plain.
    const look = (at) => { c.aim(at); return canvas.toDataURL("image/png"); };
    const aimed = look("close");
    const plain = look(null);
    return { changed: aimed !== plain, back: look("close") === aimed && look(null) === plain, aimed };
  });
  check("a row pointed at is lit in the picture here, and unlit when the pointer leaves", lit.changed && lit.back, { changed: lit.changed, back: lit.back });
  keep("xr-console-3-close-lit.png", { png: lit.aimed });
  check("a press on Close puts it away", (await page.evaluate(() => window.__nswpTest.console.pressLabelled("Close"))) && (await until(async () => (await said()).open === false, 5000)), await said());
  check("nothing went wrong on the page", errors.length === 0, errors);
  await ctx.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
