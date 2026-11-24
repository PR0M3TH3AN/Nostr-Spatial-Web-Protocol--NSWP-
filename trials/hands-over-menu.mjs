// The visitor's own hands are never under the menu in a headset (packages/sdk/src/input.ts, `drawnLast`;
// docs/plans/headset-menu.md, "Hands are never under the menu"). The owner, 2026-11-24: "we need to make sure that the
// menu is not drawn above the hands in VR", then "ok lets draw the hands last".
//
// What it does. In a made-up headset, with the Gallery's console open, each hand is held at nine places across the
// console at three distances from the eyes, and once reached past it; then over the wrist's console, and over the
// Menu button with the console closed. At each place the view is taken twice, once with the menu and once with the
// menu taken out. Every pixel that is a hand's with the menu out must still be a hand's with it in. ONE pixel that
// is not fails the place. So that a hand's pixels can be told from the room's, which moves, what is drawn of a hand
// is painted one flat colour nothing else has; the paint keeps each thing's own place in the order of drawing, which
// is what is being asked about. Tried as controllers and as tracked hands.
//
// It also turns one hand back to the old way of drawing, at one place, and expects the check to FAIL there: a run
// that passes has shown, in that run, that it can see the fault.
//
// What is real: this checkout's own build of the Gallery (`npm run build` first), opened by its address in a real
// Chrome, its own console, its own controller and hand drawing. What is a stand-in: the headset (`iwer`), which has
// one eye and no lenses, and the site's name. What it can't show: a real hand, a real headset, what it is like.
//
// Nothing leaves this machine: the page is served from the build, every other request is refused, and no WebSocket
// reaches anything.
//
//   npm run build && node trials/hands-over-menu.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const WORLD = "https://gallery.test";
const DIST = join(NSWP, "sites", "gallery", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
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
  await ctx.addInitScript(`${IWER}; window.__xr = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false }); window.__xr.installRuntime({ forceInstall: true });`);
  const sockets = new Set();
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => { sockets.add(new URL(ws.url()).host); ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }); });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== WORLD) return route.abort();
    const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  const page = await ctx.newPage();
  // A second page, blank, only to count pixels in the pictures taken of the first.
  const counter = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const until = async (ask, ms = 15000) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(100); } };
  await page.bringToFront();
  await page.goto(`${WORLD}/`, { timeout: 60000 });
  await until(() => page.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
  await page.evaluate(() => window.__nswpTest.hud.setOpen(true, "look"));
  const enter = page.locator("nswp-hud").getByRole("button", { name: /Enter VR/ }).first();
  await until(() => enter.isVisible(), 10000);
  await enter.click({ timeout: 15000 }).catch(() => undefined);
  check("the Gallery starts a session in the made-up headset", await until(() => page.evaluate(() => window.__nswpTest.state.xr === "presenting"), 30000), await page.evaluate(() => window.__nswpTest.state.xr));

  // ---- What the page is asked to do, each in one go.
  /** Set up once: find the visitor's rig and what is drawn of their hands, and keep them where the rest can use them. */
  const setUp = () => page.evaluate(() => {
    const c = window.__nswpTest.console;
    let top = c.group;
    while (top.parent) top = top.parent;
    let camera = null;
    top.traverse((o) => { if (!camera && o.isPerspectiveCamera && o.parent && o.parent !== top) camera = o; });
    const rig = camera.parent;
    const under = (o, root) => { for (let at = o; at; at = at.parent) if (at === root) return true; return false; };
    window.__hands = {
      rig, camera, top,
      /** Every mesh drawn of the visitor's own hands just now: under their rig, and not their view or the console. */
      meshes: () => { const found = []; rig.traverse((o) => { if (o.isMesh && !under(o, camera) && !under(o, c.group)) { let seen = true; for (let at = o; at; at = at.parent) seen = seen && at.visible; if (seen) found.push(o); } }); return found; },
      painted: new Map(),
    };
    return { rigAt: rig.position.toArray(), meshes: window.__hands.meshes().length };
  });
  /**
   * Paint what is drawn of the hands one flat colour that nothing else has, keeping each thing's own place in the
   * order of drawing: its pass (see-through or not), its order, and how it stands in depth. Those are what decide
   * whether the menu is drawn over it, and they are the thing's own, not this trial's.
   */
  const paint = () => page.evaluate(() => {
    const h = window.__hands;
    let n = 0;
    for (const mesh of h.meshes()) {
      if (h.painted.has(mesh)) { n++; continue; }
      const was = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      // A paint of the same kind three.js already has in the page: taken from a joint's or a light's own, or made by copying one.
      const flat = (h.flat ??= (() => { let basic = null; h.top.traverse((o) => { if (!basic && o.isMesh && o.material?.isMeshBasicMaterial) basic = o.material; }); return basic; })()).clone();
      flat.map = null; flat.color.setRGB(1, 0, 1, "srgb"); flat.toneMapped = false; flat.fog = false; flat.opacity = 1; flat.blending = 1; flat.side = was.side ?? 0;
      flat.transparent = was.transparent; flat.depthTest = was.depthTest; flat.depthWrite = was.depthWrite;
      flat.needsUpdate = true;
      h.painted.set(mesh, mesh.material);
      mesh.material = flat;
      n++;
    }
    return n;
  });
  /** How the hands are drawn, as the page has them: the order and the pass of each mesh. */
  const drawnHow = () => page.evaluate(() => window.__hands.meshes().map((m) => ({ order: m.renderOrder, seeThroughPass: !!(Array.isArray(m.material) ? m.material[0] : m.material).transparent })));
  /** Turn what is drawn of the hands back to the old way (first pass, no order), or to how it was found. */
  const oldWay = (on) => page.evaluate((on) => {
    const h = window.__hands;
    h.kept ??= new Map();
    for (const mesh of h.meshes()) {
      const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (on) { if (!h.kept.has(mesh)) h.kept.set(mesh, [mesh.renderOrder, m.transparent]); mesh.renderOrder = 0; m.transparent = false; }
      else if (h.kept.has(mesh)) { const [order, pass] = h.kept.get(mesh); mesh.renderOrder = order; m.transparent = pass; h.kept.delete(mesh); }
      m.needsUpdate = true;
    }
  }, on);
  /** Where things of the menu are, in the room: nine places across the console, the Menu button, the eyes. */
  const where = () => page.evaluate(() => {
    const c = window.__nswpTest.console;
    const h = window.__hands;
    const [panel, opener] = [c.group.children.find((x) => x.material?.uniforms?.map), c.group.children.find((x) => x.material?.isMeshBasicMaterial)];
    c.group.updateMatrixWorld(true);
    const at = (o, x, y) => o.localToWorld(o.position.clone().set(x, y, 0)).toArray();
    const high = panel.geometry.parameters.height;
    const grid = [];
    for (const v of [0.38, 0, -0.38]) for (const u of [-0.42, 0, 0.42]) grid.push(at(panel, u, v * high));
    const eyes = h.camera.getWorldPosition(h.camera.position.clone()).toArray();
    const facing = h.camera.getWorldDirection(h.camera.position.clone()).toArray();
    return { grid, opener: at(opener, 0, 0), eyes, facing, open: c.describe().open, mount: c.describe().mount, wide: panel.scale.x };
  });
  /** The console's own picture with nothing pointed at, kept to tell a lit row by. Taken with both hands held low. */
  const keepPlain = () => page.evaluate(() => {
    const c = window.__nswpTest.console;
    const canvas = c.group.children.find((x) => x.material?.uniforms?.map).material.uniforms.map.value.image;
    window.__hands.plain = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.slice();
  });
  /** The row lit just now, if a hand points at one: where it is in the view, in the page's own pixels. */
  const litBox = () => page.evaluate(() => {
    const h = window.__hands;
    const panel = window.__nswpTest.console.group.children.find((x) => x.material?.uniforms?.map);
    const canvas = panel.material.uniforms.map.value.image;
    const now = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0;
    for (let y = 0; y < canvas.height; y += 2) for (let x = 0; x < canvas.width; x += 2) { const i = (y * canvas.width + x) * 4; if (Math.abs(now[i] - h.plain[i]) + Math.abs(now[i + 1] - h.plain[i + 1]) + Math.abs(now[i + 2] - h.plain[i + 2]) > 24) { n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
    if (n < 40) return null;
    const high = panel.geometry.parameters.height;
    const seen = (cx, cy) => { const v = panel.localToWorld(panel.position.clone().set(cx / canvas.width - 0.5, (0.5 - cy / canvas.height) * high, 0)).project(h.camera); return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight]; };
    const [a, b] = [seen(x0, y0), seen(x1, y1)];
    return { onThePicture: [x0, y0, x1, y1], x0: Math.round(Math.min(a[0], b[0])), y0: Math.round(Math.min(a[1], b[1])), x1: Math.round(Math.max(a[0], b[0])), y1: Math.round(Math.max(a[1], b[1])) };
  });
  /** Hold a hand at a place in the room, pointing away from the eyes. `kind` is which the headset says it is tracking. */
  const hold = (kind, places) => page.evaluate(([kind, places]) => {
    const d = window.__xr;
    const h = window.__hands;
    if (d.primaryInputMode !== kind) d.primaryInputMode = kind;
    const set = kind === "hand" ? d.hands : d.controllers;
    for (const side of ["left", "right"]) {
      const p = places[side];
      if (!p) continue;
      // The headset's own space is the rig's: where the visitor has been moved to is taken off.
      const local = h.rig.worldToLocal(h.camera.position.clone().set(p[0], p[1], p[2]));
      set[side].position.x = local.x; set[side].position.y = local.y; set[side].position.z = local.z;
    }
  }, [kind, places]);
  // Taking the menu out: by its paints, which the console never touches. (It says every frame whether its group is
  // shown, so a group hidden from here is shown again a frame later: the first writing of this did that, and every
  // place "passed" with the menu still in both pictures. The old-way place below is what caught it.)
  const menuShown = (shown) => page.evaluate((shown) => { for (const part of window.__nswpTest.console.group.children) if (part.material) part.material.visible = shown; }, shown);
  const along = (from, to, far) => { const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]; const len = Math.hypot(...d); return [from[0] + (d[0] / len) * far, from[1] + (d[1] / len) * far, from[2] + (d[2] / len) * far]; };
  const lengthOf = (from, to) => Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  /** Count, in two pictures of the same view: the hand's pixels with the menu out, and how many of those are not a hand's with it in. */
  const compare = (withMenu, without, lit) => counter.evaluate(async ([a, b, lit]) => {
    const read = async (b64) => { const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()); const cv = new OffscreenCanvas(bmp.width, bmp.height); const x = cv.getContext("2d"); x.drawImage(bmp, 0, 0); return x.getImageData(0, 0, bmp.width, bmp.height); };
    const [A, B] = [await read(a), await read(b)];
    const marked = (d, i) => d[i] > 235 && d[i + 1] < 20 && d[i + 2] > 235;
    let hand = 0, covered = 0, first = null;
    for (let i = 0; i < B.data.length; i += 4) {
      if (!marked(B.data, i)) continue;
      hand++;
      if (!marked(A.data, i)) { covered++; first ??= [(i / 4) % B.width, Math.floor(i / 4 / B.width)]; }
    }
    // The lit row, if there is one: how much of it is seen past the hands, in the picture with the menu in.
    let row = null;
    if (lit) { let all = 0, seen = 0; for (let y = Math.max(0, lit.y0); y <= Math.min(A.height - 1, lit.y1); y++) for (let x = Math.max(0, lit.x0); x <= Math.min(A.width - 1, lit.x1); x++) { all++; if (!marked(A.data, (y * A.width + x) * 4)) seen++; } row = all ? { pixels: all, seen: Math.round((seen / all) * 100) } : null; }
    return { hand, covered, first, row };
  }, [withMenu.toString("base64"), without.toString("base64"), lit]);
  /** The view with the menu and with it taken out, compared. */
  const look = async (name, keepAs) => {
    await menuShown(true);
    await page.waitForTimeout(220);
    await paint();
    await page.waitForTimeout(120);
    const lit = await litBox();
    const withMenu = await page.screenshot();
    await menuShown(false);
    await page.waitForTimeout(220);
    const without = await page.screenshot();
    await menuShown(true);
    if (keepAs) writeFileSync(join(SHOTS, keepAs), withMenu);
    return compare(withMenu, without, lit);
  };

  await page.evaluate(() => window.__nswpTest.console.setOpen(true));
  check("its console comes up, floating", await until(async () => (await page.evaluate(() => window.__nswpTest.console.describe())).open, 10000), null);
  await page.waitForTimeout(900);
  const set = await setUp();
  results["the rig, and what is drawn of the hands as the session begins"] = set;
  {
    const w = await where();
    await hold("controller", { left: [w.eyes[0] - 0.3, w.eyes[1] - 1.0, w.eyes[2]], right: [w.eyes[0] + 0.3, w.eyes[1] - 1.0, w.eyes[2]] });
    await page.waitForTimeout(500);
    await keepPlain();
  }

  const worst = { covered: 0 };
  for (const kind of ["controller", "hand"]) {
    const called = kind === "controller" ? "a controller" : "a tracked hand";
    // Somewhere in view first, so that the headset says what it is tracking and the kit draws it.
    const w0 = await where();
    await hold(kind, { left: along(w0.eyes, w0.grid[3], 0.5), right: along(w0.eyes, w0.grid[5], 0.5) });
    const drawn = await until(async () => ((await page.evaluate(() => window.__hands.meshes().length)) >= (kind === "controller" ? 6 : 20) ? true : null), 8000);
    check(`${called} in each hand is drawn by the kit`, !!drawn, await page.evaluate(() => window.__hands.meshes().length));
    results[`how ${called} is drawn: each mesh's order and pass`] = [...new Set((await drawnHow()).map((m) => JSON.stringify(m)))].map((m) => JSON.parse(m));

    // Nine places across the console at three distances from the eyes: the left hand at one, the right at the one
    // opposite, so that both are tried at every place.
    let places = 0;
    const failed = [];
    let smallest = Infinity;
    const rows = [];
    for (const far of [0.3, 0.5, 0.7]) {
      for (let i = 0; i < 9; i++) {
        const w = await where();
        await hold(kind, { left: along(w.eyes, w.grid[i], far), right: along(w.eyes, w.grid[8 - i], far) });
        const got = await look(`${kind} ${far} ${i}`, far === 0.5 && i === 2 ? `hands-over-menu-${kind}.png` : null);
        places++;
        smallest = Math.min(smallest, got.hand);
        if (got.covered > 0 || got.hand < 150) failed.push({ far, place: i, ...got });
        if (got.row) rows.push({ far, place: i, ...got.row });
        worst.covered = Math.max(worst.covered, got.covered);
      }
    }
    check(`${called}: at ${places} places across the console, 0.3 m, 0.5 m and 0.7 m from the eyes, no pixel of a hand is covered by the menu`, failed.length === 0, failed.slice(0, 6));
    results[`${called}: the fewest pixels a hand had at any place`] = smallest;
    // Where a press will land is the row lit on the console, and with a hand over the console it must still be
    // seen. Measured roughly: the box round everything lit on the console's picture (both hands' rows, and what is
    // between them), and how much of that box is not a hand's in the view. Held to "some of it": a tenth. The least
    // is said, since a hand held close and in the middle of the view covers most of anything.
    const hidden = rows.filter((r) => r.seen < 10);
    const least = rows.length ? rows.reduce((a, b) => (b.seen < a.seen ? b : a)) : null;
    check(`${called}: wherever a hand points at a row, what is lit is still seen past the hands`, rows.length >= 5 && hidden.length === 0, { litAt: rows.length, hidden: hidden.slice(0, 6) });
    results[`${called}: places where a row was lit, and the least of what was lit that was seen`] = { places: rows.length, least: least && `${least.seen} parts in a hundred, at ${least.far} m from the eyes, place ${least.place + 1} of 9` };

    // Reached past the console: 0.2 m beyond its middle. Still seen whole.
    {
      const w = await where();
      const beyond = lengthOf(w.eyes, w.grid[4]) + 0.2;
      await hold(kind, { left: along(w.eyes, w.grid[3], beyond), right: along(w.eyes, w.grid[5], beyond) });
      const got = await look(`${kind} past`, `hands-over-menu-${kind}-reached-past.png`);
      check(`${called} reached 0.2 m past the console is still seen whole`, got.covered === 0 && got.hand >= 40, got);
    }

    // And the check can see the fault: one place, drawn the old way, must be found covered.
    {
      const w = await where();
      await hold(kind, { left: along(w.eyes, w.grid[4], 0.5), right: along(w.eyes, w.grid[5], 0.5) });
      await page.waitForTimeout(200);
      await paint();
      await oldWay(true);
      await page.evaluate(() => { for (const [mesh] of window.__hands.painted) { const m = mesh.material; m.transparent = false; m.needsUpdate = true; mesh.renderOrder = 0; } });
      const got = await look(`${kind} the old way`, `hands-over-menu-${kind}-the-old-way.png`);
      check(`${called} drawn the old way at the console's middle IS covered: the check can see the fault`, got.covered > 100, got);
      results[`${called}, drawn the old way: pixels of a hand covered by the menu`] = `${got.covered} of ${got.hand}`;
      // Put back as found: the paint is taken off, and each thing has its own order and pass again.
      await page.evaluate(() => { const h = window.__hands; for (const [mesh, was] of h.painted) mesh.material = was; h.painted.clear(); });
      await oldWay(false);
    }
  }

  // ---- The Menu button, with the console closed: a hand held between the eyes and the button.
  await page.evaluate(() => window.__nswpTest.console.setOpen(false));
  await page.waitForTimeout(700);
  {
    const w = await where();
    const far = lengthOf(w.eyes, w.opener);
    await hold("controller", { right: along(w.eyes, w.opener, Math.min(0.45, far - 0.1)), left: along(w.eyes, w.grid[0], 0.7) });
    await page.waitForTimeout(400);
    const got = await look("the Menu button", "hands-over-menu-the-button.png");
    check("with the console closed, a controller held in front of the Menu button is not covered by it", w.open === false && got.covered === 0 && got.hand >= 150, { ...got, open: w.open, buttonAt: far });
    await page.evaluate(() => { const h = window.__hands; for (const [mesh, was] of h.painted) mesh.material = was; h.painted.clear(); });
  }

  // ---- The wrist's console: the left wrist raised in front of the face, and the right hand held over what it shows.
  {
    const w = await where();
    // In front of the face and a little down, as a wrist is raised to be looked at.
    const ahead = [w.eyes[0] + w.facing[0] * 0.36, w.eyes[1] + w.facing[1] * 0.36 - 0.07, w.eyes[2] + w.facing[2] * 0.36];
    await hold("controller", { left: ahead, right: [w.eyes[0] + w.facing[0] * 0.3 + 0.35, w.eyes[1] - 0.6, w.eyes[2] + w.facing[2] * 0.3] });
    const up = await until(async () => { const d = await page.evaluate(() => window.__nswpTest.console.describe()); return d.open && d.mount === "wrist" ? d : null; }, 6000);
    check("the wrist's console comes up when the left wrist is raised", !!up, await page.evaluate(() => { const d = window.__nswpTest.console.describe(); return { open: d.open, mount: d.mount }; }));
    if (up) {
      await page.waitForTimeout(700);
      const w2 = await where();
      // The right hand between the eyes and the middle of the wrist's console; the left stays where it carries it.
      await hold("controller", { right: along(w2.eyes, w2.grid[4], Math.max(0.15, lengthOf(w2.eyes, w2.grid[4]) - 0.12)) });
      await page.waitForTimeout(400);
      const got = await look("the wrist", "hands-over-menu-the-wrist.png");
      check("neither the hand that carries the wrist's console nor the one held over it is covered by it", got.covered === 0 && got.hand >= 150, got);
      await page.evaluate(() => { const h = window.__hands; for (const [mesh, was] of h.painted) mesh.material = was; h.painted.clear(); });
    }
  }

  check("nothing went wrong on the page", errors.length === 0, errors);
  results["relays asked for, and answered here with nothing"] = [...sockets];
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
