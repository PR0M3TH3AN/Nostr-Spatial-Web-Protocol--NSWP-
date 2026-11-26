// The headset's menu is the flat menu, drawn again (packages/sdk/src/menu-drawing.ts; docs/plans/headset-menu.md,
// "How the two are kept the same"). For every tab of three worlds, the flat menu is opened and its boxes read from
// the page as the browser lays them out: every tab in the strip, every row, line, box to type in, song's bar, colour,
// tile and card, the note, the foot's two buttons, the sheet's own height, and every key on the bar. The headset's
// layout of the same `controls.view()` is worked out in the same page, by the kit's own code, and each box held to
// its twin. **Every box must be within 2 px,** in the same order and of the same kind; one that isn't fails it.
//
// Three passes: a desk (two columns, the sheet 780 px), a phone's width (one column, 480 px: the wrist's layout), and
// a desk with the visitor's text made larger. Rows a guest alone never sees are added to each world's own menu as
// stand-ins, so that both drawings draw them: a person's card, a thing's card, things in the bag, a song's bar, lines,
// a row to type in, a row that copies.
//
// What is real: this checkout's build of each world and its kit, a real Chrome. Made up: the stand-in rows, and
// BitLogin (a stand-in signer: nobody is signed in). Nothing is fetched from anywhere else.
//
//   npm run build && npm run trial -- trials/headset-menu-same.mjs [--pictures]
//
// With --pictures, each desk tab of each world is also saved twice in SHOTS, as the browser draws it and as the
// headset draws it (`drawSheet`), to look at side by side. Never committed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const PICTURES = process.argv.includes("--pictures");
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { build } = await import(`${NSWP}/node_modules/esbuild/lib/main.js`);

const SIGN_IN = "https://bitlogin.network";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
const WORLDS = ["gallery", "grove", "arcade"];
const TOLERANCE = 2;

// The kit's own layout, from its source, for the page.
const DRAWING = (await build({ entryPoints: [join(NSWP, "packages", "sdk", "src", "menu-drawing.ts")], bundle: true, format: "iife", globalName: "__menuDrawing", target: "es2022", write: false, logLevel: "warning" })).outputFiles[0].text + "\nwindow.__menuDrawing = __menuDrawing;";

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};

const signerPage = (world) => `<!doctype html><meta charset="utf-8"><script>
const say = (m) => parent.postMessage({ nswp: "nswp-signer", v: 1, ...m }, ${JSON.stringify(world)});
addEventListener("message", (e) => { const d = e.data; if (!d || d.nswp !== "nswp-signer") return; if (d.t === "state") say({ t: "state", ...(d.id ? { id: d.id } : {}), unlocked: false }); });
say({ t: "ready" });
</script>`;

/** Rows a guest alone never sees, added to the world's own menu (in the page). */
const standIns = () => {
  const c = window.__nswpTest.controls;
  const thing = (hue) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const g = cv.getContext("2d");
    g.fillStyle = `hsl(${hue} 70% 55%)`;
    g.beginPath();
    g.arc(32, 32, 24, 0, Math.PI * 2);
    g.fill();
    return () => cv;
  };
  c.addSection({ id: "people", card: () => ({ title: "Juniper", tag: "By name", proven: true, sub: "npub1jun…q8x2", copy: "", text: "Here most evenings. Ask me about the music in the Grove, and the lanterns by the water.", picture: "", color: "#8ecae6", now: [] }) });
  c.addSection({ id: "bag", card: () => ({ title: "Lantern orb", tag: "", proven: false, sub: "From the Workshop", copy: "", text: "A small light that floats where you leave it.", picture: "", color: "", now: [], draw: thing(40) }) });
  c.add(
    { id: "stand-in-follow", section: "people", label: "Follow Juniper", icon: "people", act() {} },
    { id: "stand-in-letter", section: "people", label: "Write to Juniper, who is here most evenings and likes long letters", icon: "chat", act() {} },
    { id: "stand-in-tile-1", section: "bag", kind: "tile", label: "Dart blaster", short: "Dart", picture: thing(190), mark: "bag", on: () => true, act() {} },
    { id: "stand-in-tile-2", section: "bag", kind: "tile", label: "Lantern orb", short: "Lantern", picture: thing(40), mark: "bag", act() {} },
    { id: "stand-in-tile-3", section: "bag", kind: "tile", label: "Shard of the Gallery, the long name", short: "Shard", picture: thing(280), act() {} },
    { id: "stand-in-tile-4", section: "bag", kind: "tile", label: "Offered here", short: "Offered", picture: thing(120), faint: () => true, act() {} },
    { id: "stand-in-song", section: "sound", kind: "slider", label: "Night Market", icon: "music", slider: { value: () => 72, max: () => 220, text: () => "1:12 of 3:40" }, act() {} },
    { id: "stand-in-line-1", section: "following", kind: "line", label: "Juniper is in the Grove now.", icon: "people", on: () => true, act() {} },
    { id: "stand-in-line-2", section: "following", kind: "line", label: "Rook was last here two days ago, in the Workshop, by the long bench under the windows where the light comes in.", icon: "people", on: () => false, act() {} },
    { id: "stand-in-field", section: "messages", kind: "field", label: "Send", icon: "chat", act() {} },
    { id: "stand-in-copy", section: "you", kind: "copy", label: "Copy your key", icon: "key", copy: "npub1stand-in", act() {} },
    { id: "stand-in-primary", section: "you", label: "A wide press, the kind that stands alone", icon: "check", tone: "primary", act() {} },
  );
  c.setPinned("sound", true);
  c.setPinned("people", true);
};

/** The flat menu's boxes, read from the page, from the sheet's (or the bar's) top left. */
const flatBoxes = () => {
  const root = document.querySelector("nswp-hud").shadowRoot;
  const sheet = root.querySelector(".sheet");
  const s = sheet.getBoundingClientRect();
  const at = (e, o = s) => { const r = e.getBoundingClientRect(); return { x: r.x - o.x, y: r.y - o.y, w: r.width, h: r.height }; };
  const kindOf = (e) => (e.classList.contains("person") ? "card" : e.classList.contains("swatches") ? "swatches" : e.classList.contains("tiles") ? "tiles" : e.classList.contains("line") ? "line" : e.classList.contains("field") ? "field" : e.classList.contains("slide") ? "slider" : e.classList.contains("takes") ? "file" : e.classList.contains("from") ? "from" : e.classList.contains("row") ? "row" : e.className);
  const rowsEl = sheet.querySelector(".rows");
  const rows = [];
  if (rowsEl && !rowsEl.hidden) {
    for (const e of rowsEl.children) {
      rows.push({ kind: kindOf(e), ...at(e) });
      for (const sub of e.querySelectorAll(":scope > .swatch, :scope > .tile")) rows.push({ kind: sub.classList.contains("swatch") ? "swatch" : "tile", ...at(sub) });
    }
  }
  const note = sheet.querySelector(".note:not(.said)");
  const bar = root.querySelector(".bar");
  const b = bar.getBoundingClientRect();
  return {
    sheet: { w: s.width, h: s.height },
    // Along the strip from its start, not where it is slid to: how far the flat menu's strip is slid is its own
    // moment's (a tab brought into sight before larger text has settled stops short), and is checked apart, below.
    tabs: (() => { const slid = sheet.querySelector(".tabs").scrollLeft; return [...sheet.querySelectorAll(".tab")].map((e) => ({ ...at(e), x: at(e).x + slid })); })(),
    rows,
    note: note && note.getBoundingClientRect().height > 0 ? at(note) : null,
    pin: (() => { const p = sheet.querySelector(".pin-it"); return p && !p.hidden ? at(p) : null; })(),
    close: at(sheet.querySelector(".foot .close")),
    keys: [...bar.querySelectorAll(".key")].map((e) => at(e, b)),
  };
};

/** The headset's layout of the same view, by the kit's own code, in the same page. */
const drawnBoxes = ([tab, width, before]) => {
  const g = document.createElement("canvas").getContext("2d");
  const measure = (text, f) => { g.font = f; return g.measureText(text).width; };
  const view = window.__nswpTest.controls.view();
  const L = window.__menuDrawing.laySheet(view, tab, { measure, width, title: view.title, tabsScroll: before, bring: true });
  const B = window.__menuDrawing.layBar(view, { measure });
  const pick = (b) => ({ x: b.x, y: b.y, w: b.w, h: b.h });
  return {
    scroll: L.tabsScroll,
    sheet: { w: L.width, h: L.height },
    tabs: L.tabs.map((t) => pick(t)),
    // The open tab, as the drawing slides the strip: wholly in sight.
    inSight: (() => { const t = L.tabs.find((x) => x.id === `tab:${L.section?.id}`); return !t || (t.x - L.tabsScroll >= 1 - 0.01 && t.x - L.tabsScroll + t.w <= L.width - 1 + 0.01); })(),
    rows: L.rows.map((b) => ({ kind: b.kind, ...pick(b) })),
    note: L.note && pick(L.note),
    pin: L.pin && pick(L.pin),
    close: pick(L.close),
    keys: B.keys.map((k) => ({ ...pick(k), h: undefined })),
  };
};

/** Every box against its twin: how far the worst is out, and every one more than the tolerance. */
const compare = (flat, drawn, keys) => {
  const bad = [];
  let worst = 0;
  const near = (where, a, b, sides = ["x", "y", "w", "h"]) => {
    if (!a || !b) {
      if (a || b) bad.push(`${where}: ${a ? "flat only" : "drawn only"}`);
      return;
    }
    for (const k of sides) {
      if (a[k] === undefined || b[k] === undefined) continue;
      const d = Math.abs(a[k] - b[k]);
      worst = Math.max(worst, d);
      if (d > TOLERANCE) bad.push(`${where}.${k}: flat ${a[k].toFixed(1)}, drawn ${b[k].toFixed(1)}`);
    }
  };
  near("sheet", flat.sheet, drawn.sheet, ["w", "h"]);
  if (!drawn.inSight) bad.push("the open tab isn't wholly in sight in the drawing's strip");
  if (flat.tabs.length !== drawn.tabs.length) bad.push(`tabs: ${flat.tabs.length} flat, ${drawn.tabs.length} drawn`);
  flat.tabs.forEach((t, i) => near(`tab ${i}`, t, drawn.tabs[i]));
  const kinds = (r) => r.map((b) => b.kind).join(",");
  if (kinds(flat.rows) !== kinds(drawn.rows)) bad.push(`rows: flat ${kinds(flat.rows)} | drawn ${kinds(drawn.rows)}`);
  else flat.rows.forEach((b, i) => near(`${b.kind} ${i}`, b, drawn.rows[i]));
  near("note", flat.note, drawn.note);
  near("pin", flat.pin, drawn.pin);
  near("close", flat.close, drawn.close);
  // The bar: where it is shown at all (a quiet world keeps it away), and only at a desk. A phone's bar is its own
  // smaller keys; a headset's bar is always the desk's, and the wrist has none.
  if (keys && flat.keys.some((k) => k.w > 0)) {
    if (flat.keys.length !== drawn.keys.length) bad.push(`keys: ${flat.keys.length} flat, ${drawn.keys.length} drawn`);
    flat.keys.forEach((k, i) => near(`key ${i}`, k, drawn.keys[i], ["x", "y", "w"]));
  }
  return { worst: Math.round(worst * 10) / 10, bad };
};

const PASSES = [
  { name: "desk", viewport: { width: 1400, height: 900 }, width: 780, worlds: WORLDS, scale: 1 },
  { name: "phone width (the wrist's layout)", viewport: { width: 500, height: 900 }, width: 480, worlds: ["gallery"], scale: 1 },
  { name: "desk, text larger", viewport: { width: 1400, height: 900 }, width: 780, worlds: ["gallery"], scale: 1.25 },
];

const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const elsewhere = new Set();
let tabsChecked = 0;
try {
  for (const pass of PASSES) {
    for (const name of pass.worlds) {
      const WORLD = `https://${name}.test`;
      const DIST = join(NSWP, "sites", name, "dist");
      if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: pass.viewport, deviceScaleFactor: PICTURES ? 2 : 1 });
      await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }));
      await ctx.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
        if (url.origin === SIGN_IN && url.pathname === "/signer/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: signerPage(WORLD) });
        if (url.origin !== WORLD) {
          elsewhere.add(url.origin);
          return route.abort();
        }
        const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
        if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
        return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      await page.goto(`${WORLD}/`, { timeout: 60000 });
      await page.waitForFunction(() => window.__nswpTest?.state?.ready === true, null, { timeout: 60000 });
      await page.waitForTimeout(1500);
      await page.evaluate(DRAWING);
      await page.evaluate(standIns);
      if (pass.scale !== 1) await page.evaluate((scale) => window.__nswpTest.controls.setTheme({ scale }), pass.scale);
      // The bar, with the menu down, as it stands.
      await page.evaluate(() => window.__nswpTest.hud.setOpen(false));
      await page.waitForTimeout(300);
      const tabs = await page.evaluate(() => window.__nswpTest.controls.view().sections.map((s) => s.id));
      const outs = [];
      let worst = 0;
      // The strip of tabs is slid from where it was, in both: the drawing keeps its own, as the flat menu does.
      let slid = 0;
      for (const tab of tabs) {
        await page.evaluate((id) => window.__nswpTest.hud.setOpen(true, id), tab);
        // Up, laid out, and its motion done: the rows arrive over a few hundred milliseconds.
        await page.waitForTimeout(700);
        const flat = await page.evaluate(flatBoxes);
        const drawn = await page.evaluate(drawnBoxes, [tab, flat.sheet.w, slid]);
        slid = drawn.scroll;
        const got = compare(flat, drawn, pass.width >= 780);
        if (PICTURES && pass.name === "desk") {
          mkdirSync(SHOTS, { recursive: true });
          const box = await page.locator("nswp-hud").locator(".sheet").boundingBox();
          if (box) await page.screenshot({ path: join(SHOTS, `headset-menu-same-${name}-${tab}-flat.png`), clip: box });
          const png = await page.evaluate((tab) => {
            const canvas = document.createElement("canvas");
            const g = canvas.getContext("2d");
            const measure = (text, f) => { g.font = f; return g.measureText(text).width; };
            const view = window.__nswpTest.controls.view();
            const L = window.__menuDrawing.laySheet(view, tab, { measure, width: 780, title: view.title });
            canvas.width = L.width * 2;
            canvas.height = L.height * 2;
            window.__menuDrawing.drawSheet(g, view, L, { scale: 2, glass: 0.82 });
            return canvas.toDataURL("image/png");
          }, tab);
          writeFileSync(join(SHOTS, `headset-menu-same-${name}-${tab}-drawn.png`), Buffer.from(png.split(",")[1], "base64"));
        }
        worst = Math.max(worst, got.worst);
        tabsChecked++;
        if (got.bad.length) outs.push({ tab, bad: got.bad.slice(0, 12) });
      }
      check(`${pass.name}, ${name}: every tab of ${tabs.length} within ${TOLERANCE} px (worst ${worst} px)`, outs.length === 0, outs);
      check(`${pass.name}, ${name}: nothing went wrong on the page`, errors.length === 0, errors);
      await ctx.close();
    }
  }
  check("nothing was asked of anywhere else", elsewhere.size === 0, [...elsewhere]);
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const total = Object.keys(results).length;
console.log(`\n${tabsChecked} tabs compared`);
console.log(fail.length ? `\n${fail.length} of ${total} checks failed: ${fail.join("; ")}` : `\nall ${total} checks passed`);
process.exit(fail.length ? 1 : 0);
