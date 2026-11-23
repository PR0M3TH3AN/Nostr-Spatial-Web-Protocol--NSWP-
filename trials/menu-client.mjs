// The client has the menu, both ends together (docs/plans/the-clients-menu.md, step 1; protocol/02-doors.md, "The
// client has the menu"): a stand-in client that draws the visitor's menu, from this checkout's kit, above this
// checkout's own Gallery in a frame.
//
// What is real: the Gallery's build (sites/gallery/dist, so run `npm run build` first), the menu and both ends of
// its port as built from this checkout, a real Chrome, and a real mouse and keyboard at places on the screen. What
// is a stand-in: the client (trials/stand-in-client/main.ts: no sign-in, no bag, a way home and Display), the names
// of every site, the Gallery's own rules about who may frame it (left off so this page may), a world that never
// answers (a page that says `here` and nothing else), a page that doesn't speak the words, and "home". Three rows
// are added to the Gallery through its test hook, since nothing in it for a guest is typed into or copies. Nothing
// is fetched from anywhere else; the Gallery reaching for its sign-in address is refused.
//
// Presses and keys here are a mouse and a keyboard at places on the screen: where a thing is, is read from the page
// (reading moves no keys), and then the mouse is sent there. Nothing is clicked by asking the page to click it.
//
//   npm run build && node trials/menu-client.mjs
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { build } = await import(`${NSWP}/node_modules/esbuild/lib/main.js`);

const CLIENT = "https://client.test";
const WORLD = "https://gallery.test";
const STUCK = "https://stuck.test";
const PLAIN = "https://plain.test";
const DIST = join(NSWP, "sites", "gallery", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".txt": "text/plain" };
if (!existsSync(join(DIST, "index.html"))) throw new Error("Build the sites first: npm run build");
mkdirSync(SHOTS, { recursive: true });

// The stand-in client's own code, built from this checkout's kit as a client would build its copy.
const bundle = await build({ entryPoints: [join(NSWP, "trials", "stand-in-client", "main.ts")], bundle: true, format: "esm", target: "es2022", write: false, logLevel: "warning", absWorkingDir: NSWP });
const clientJs = bundle.outputFiles[0].text;
const clientPage = `<!doctype html><meta charset="utf-8"><title>stand-in client</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;display:block}</style>
<iframe id="view" src="${WORLD}/" allow="xr-spatial-tracking *; microphone *; autoplay *; gamepad *; clipboard-write *; fullscreen 'none'"></iframe>
<script type="module" src="/app.js"></script>`;
const said = (words) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#123;color:#fff;font:16px sans-serif">${words}<script>parent.postMessage(${words.includes("stuck") ? '{ nswp: "here", at: "/", menu: 1 }' : '{ nswp: "here", at: "/" }'}, "*"); let n = 0; addEventListener("keydown", () => (window.keysHeard = ++n));</script>`;

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};

const browser = await pw.chromium.launch({ channel: "chrome", headless: true });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: CLIENT });
  const fetched = [];
  const refused = new Set();
  const sockets = new Set();
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === CLIENT) return url.pathname === "/app.js" ? route.fulfill({ status: 200, contentType: TYPES[".js"], body: clientJs }) : url.pathname === "/home.html" ? route.fulfill({ status: 200, contentType: TYPES[".html"], body: said("home") }) : route.fulfill({ status: 200, contentType: TYPES[".html"], body: clientPage });
    if (url.origin === STUCK) return route.fulfill({ status: 200, contentType: TYPES[".html"], body: said("a world that is stuck") });
    if (url.origin === PLAIN) return route.fulfill({ status: 200, contentType: TYPES[".html"], body: said("a page that doesn't speak the words") });
    if (url.origin === WORLD) {
      fetched.push(url.pathname);
      const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
      if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
      return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
    }
    refused.add(url.origin);
    return route.abort();
  });
  // No relay is reached: every WebSocket is answered here, with nothing, and its address kept to be listed.
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
    sockets.add(new URL(ws.url()).host);
    ws.onMessage((m) => {
      let msg;
      try { msg = JSON.parse(String(m)); } catch { return; }
      if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]]));
    });
  });
  const page = await ctx.newPage();
  const until = async (ask, ms = 15000) => {
    const end = Date.now() + ms;
    for (;;) {
      const got = await ask().catch(() => null);
      if (got || Date.now() > end) return got;
      await page.waitForTimeout(100);
    }
  };
  await page.goto(`${CLIENT}/?home=${encodeURIComponent(`${CLIENT}/home.html`)}`, { timeout: 60000 });
  const world = () => page.frames().find((f) => f.url().startsWith(WORLD));
  const inFrame = () => page.frames().find((f) => f !== page.mainFrame());
  const hud = page.locator("nswp-hud");
  // A real mouse at the middle of something, found by reading where it is.
  const press = async (locator) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error("nothing there to press");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  const client = (fn, arg) => page.evaluate(fn, arg);

  // ---- One menu, the client's, over the Gallery.
  check("the menu is there before the world is", await until(() => client(() => document.querySelectorAll("nswp-hud").length === 1)));
  await until(() => world()?.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
  await until(() => client(() => window.__client.below.world?.sections.length > 0));
  check("the client's menu is headed by the world's name and the address the browser gave", await client(() => { const v = window.__client.below.port.view(); return v.title === "The Gallery" && v.address === "gallery.test"; }), await client(() => { const v = window.__client.below.port.view(); return [v.title, v.address]; }));
  check("there is one menu, and it is the client's: the world drew none", (await world().evaluate(() => document.querySelectorAll("nswp-hud").length)) === 0 && (await client(() => document.querySelectorAll("nswp-hud").length)) === 1);
  check("the world never fetched the menu", !fetched.some((p) => /\/chunks\/menu-.*\.js$/.test(p)), fetched.filter((p) => p.includes("menu")));
  const tabs = await client(() => window.__client.below.port.view().sections.map((s) => s.id));
  check("the menu has the client's own tabs and the world's", ["travel", "room", "look"].every((t) => tabs.includes(t)), tabs);
  results["the tabs, as drawn"] = tabs;

  // Three rows of the world's own, added through its test hook: a plain one, one typed into, one that copies.
  await world().evaluate(() => {
    window.__got = [];
    let keys = 0;
    addEventListener("keydown", () => (window.__keys = ++keys), true);
    window.__keys = 0;
    const c = window.__nswpTest.controls;
    c.add({ id: "trial-plain", section: "room", label: "A row of the world's", hotbar: true, short: "Trial", act: () => void window.__got.push(["plain"]) });
    // In the keeper's tab: a row typed into may stand only there and in a world's own tabs.
    c.add({ id: "trial-field", section: "guests", kind: "field", label: "Add someone by key", act: (typed) => void window.__got.push(["field", typed]) });
    c.add({ id: "trial-copy", section: "room", kind: "copy", copy: "npub1trialkey", label: "Copy the room's key", act: () => void window.__got.push(["copy"]) });
  });
  await until(() => client(() => window.__client.below.port.view().hotbar.some((i) => i.id === "world:trial-plain")));
  await page.screenshot({ path: join(SHOTS, "menu-client-1-bar.png") });

  // ---- Who has the keys (section 17.2), with the sheet down.
  await page.mouse.click(550, 300);
  await page.keyboard.press("KeyW");
  const keysBefore = await until(() => world().evaluate(() => window.__keys > 0 && window.__keys));
  check("a key pressed on the world reaches the world", keysBefore > 0, keysBefore);
  await press(hud.getByRole("button", { name: /A row of the world.s/ }).first());
  check("a press on a bar key of the world's reaches the world as a word", await until(() => world().evaluate(() => window.__got.some((g) => g[0] === "plain"))), await world().evaluate(() => window.__got));
  await page.waitForTimeout(300);
  check("after a press on the client's bar, the frame has the keys again", await client(() => document.activeElement?.tagName === "IFRAME"), await client(() => document.activeElement?.tagName));
  await page.keyboard.press("KeyW");
  check("and the world goes on hearing keys with no press on the view", await until(() => world().evaluate((n) => window.__keys > n, keysBefore)), [keysBefore, await world().evaluate(() => window.__keys)]);

  // ---- The summons, pressed with the world holding the keys, brings the client's menu up.
  await page.keyboard.press("Backquote");
  check("the summons in the world brings the client's menu up", await until(() => client(() => window.__client.menu.open === true)));
  check("the world is told the menu is up", await until(() => world().evaluate(() => window.__nswpTest.hud.open === true)));
  check("with the menu up the client has the keys", await client(() => document.activeElement?.tagName !== "IFRAME"), await client(() => document.activeElement?.tagName));
  await client(() => window.__client.menu.setOpen(true, "guests"));
  const box = hud.getByRole("textbox", { name: "Add someone by key" });
  await until(() => box.isVisible());
  check("a row typed into says it goes to the world, by the world's name", ((await hud.locator(".field .to").textContent()) ?? "") === "What you type here goes to The Gallery.", await hud.locator(".field .to").textContent());

  // ---- Typed in the client's box: the world hears no key, and gets the text only at the press.
  const keysAt = await world().evaluate(() => window.__keys);
  await press(box);
  await page.keyboard.type("npub1 typed above", { delay: 30 });
  await page.waitForTimeout(400);
  check("nothing typed into the menu is heard by the world", (await world().evaluate(() => window.__keys)) === keysAt, [keysAt, await world().evaluate(() => window.__keys)]);
  check("nothing typed reaches the world before the press", !(await world().evaluate(() => window.__got.some((g) => g[0] === "field"))));
  await page.screenshot({ path: join(SHOTS, "menu-client-2-typed.png") });
  await page.keyboard.press("Enter");
  check("at the press the world's row is given what was typed", await until(() => world().evaluate(() => JSON.stringify(window.__got.find((g) => g[0] === "field")) === JSON.stringify(["field", "npub1 typed above"]))), await world().evaluate(() => window.__got));

  // ---- A row that copies is copied by the client, at the press on the client's page.
  await client(() => window.__client.menu.setOpen(true, "room"));
  await until(() => hud.getByRole("button", { name: "Copy the room's key" }).isVisible());
  await press(hud.getByRole("button", { name: "Copy the room's key" }));
  check("a row that copies is copied by the client's page", await until(() => client(() => navigator.clipboard.readText().then((t) => t === "npub1trialkey"))), await client(() => navigator.clipboard.readText().catch((e) => String(e))));
  check("and the world is told of the press", await until(() => world().evaluate(() => window.__got.some((g) => g[0] === "copy"))));

  // ---- A setting changed in the client's menu reaches the world.
  await client(() => window.__client.controls.setTheme({ scale: 1.3 }, true));
  check("a setting changed in the client's menu is the world's at once", await until(() => world().evaluate(() => window.__nswpTest.controls.theme.scale === 1.3)));

  // ---- The rows that change a setting the visitor carries are the client's own, inside the tabs the world fills.
  const SWITCHES = ["people-pictures", "people-models", "room-chat-show", "fov"];
  const worldSays = await client(() => window.__client.below.world.sections.flatMap((s) => s.rows.map((r) => r.id)));
  check("the world leaves the visitor's switches out of what it describes", !worldSays.some((id) => SWITCHES.includes(id)), worldSays);
  const inTabs = await client(() => Object.fromEntries(window.__client.below.port.view().sections.map((s) => [s.id, s.items.map((i) => i.id)])));
  check("the client draws them itself, first in the world's People and Room", inTabs.people?.[0] === "people-pictures" && inTabs.room?.[0] === "room-chat-show", { people: inTabs.people, room: inTabs.room });
  results["the client's own rows in the world's tabs"] = Object.fromEntries(Object.entries(inTabs).map(([tab, ids]) => [tab, ids.filter((id) => !id.startsWith("world:"))]).filter(([, ids]) => ids.length));
  await client(() => window.__client.menu.setOpen(true, "people"));
  const pictures = hud.getByRole("button", { name: /Profile pictures: on/ });
  await until(() => pictures.isVisible());
  await press(pictures);
  const offInWorld = () => world().evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "people")?.items.find((i) => i.id === "people-pictures")?.on === false);
  check("people's pictures turned off in the client's menu are off in the world at once", await until(offInWorld));
  check("and the client's row says so", await until(() => hud.getByRole("button", { name: /Profile pictures: off/ }).isVisible()));
  await page.screenshot({ path: join(SHOTS, "menu-client-4-switches.png") });

  // ---- "Load people's files from anywhere" is the world's own row, pressed through the client. The place keeps it;
  // the client never holds it and never says it, on or off.
  await world().evaluate(() => {
    window.__down = [];
    addEventListener("message", (e) => { if (e.data && e.data.nswp === "menu" && e.data.settings) window.__down.push(JSON.stringify(e.data.settings)); });
  });
  const anywhereInWorld = () => world().evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "people")?.items.find((i) => i.id === "files-anywhere")?.on);
  check("loading files from anywhere starts off in the world", (await anywhereInWorld()) === false, await anywhereInWorld());
  const anywhere = hud.getByRole("button", { name: /Load people's files from anywhere: off/ });
  await until(() => anywhere.isVisible());
  check("its row in the client's menu is the world's own, not the client's", (await client(() => window.__client.below.port.view().sections.find((s) => s.id === "people")?.items.map((i) => i.id))).includes("world:files-anywhere"));
  await press(anywhere);
  check("pressed through the client, it is on in the world", await until(async () => (await anywhereInWorld()) === true));
  check("and the client's menu shows the world's word for it", await until(() => hud.getByRole("button", { name: /Load people's files from anywhere: on/ }).isVisible()));
  // The client then says another setting down. The switch stays as the visitor set it, and was never in any word.
  await client(() => window.__client.controls.setTheme({ scale: 1.1 }, true));
  await until(() => world().evaluate(() => window.__nswpTest.controls.theme.scale === 1.1));
  check("it stays on when the client says its settings again", (await anywhereInWorld()) === true);
  const down = await world().evaluate(() => window.__down);
  check("and the client never said it, on or off", down.length > 0 && !down.some((w) => w.includes("filesAnywhere")), down);

  // ---- A picture of the world's crosses as a bitmap, and the client draws it.
  await world().evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const g = canvas.getContext("2d");
    g.fillStyle = "#c02010";
    g.fillRect(0, 0, 512, 512);
    window.__nswpTest.controls.add({ id: "trial-tile", section: "camera", kind: "tile", label: "A photo (trial)", picture: () => canvas, act: () => {} });
  });
  await client(() => window.__client.menu.setOpen(true, "camera"));
  const tileAbove = () => client(() => {
    const picture = window.__client.below.port.view().sections.find((s) => s.id === "camera")?.items.find((i) => i.id === "world:trial-tile")?.picture?.();
    return picture instanceof ImageBitmap ? [picture.width, picture.height] : null;
  });
  const sizeAbove = await until(tileAbove);
  check("a tile's picture crosses to the client as a bitmap, no bigger than the limit", JSON.stringify(sizeAbove) === "[256,256]", sizeAbove);
  check("and the client's menu draws it", await until(() => client(() => {
    const canvas = [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".tile")].find((t) => t.getAttribute("aria-label") === "A photo (trial)")?.querySelector("canvas");
    if (!canvas) return false;
    const [r, g, b] = canvas.getContext("2d").getImageData(96, 96, 1, 1).data;
    return r > 150 && g < 80 && b < 80;
  })));
  await page.screenshot({ path: join(SHOTS, "menu-client-5-picture.png") });

  // ---- The menu goes: the world is told, and has the keys.
  await page.keyboard.press("Escape");
  check("Escape puts the client's menu away", await until(() => client(() => window.__client.menu.open === false)));
  check("the world is told it went", await until(() => world().evaluate(() => window.__nswpTest.hud.open === false)));
  check("and the frame has the keys again", await until(() => client(() => document.activeElement?.tagName === "IFRAME")));

  // ---- Nothing of the visitor's own tabs was ever said down.
  results["refused, as everything but these sites is"] = [...refused];
  results["relays asked for, and answered here with nothing"] = [...sockets];

  // ---- The chat's pane: the world's own until a client runs chat itself (section 15, "The chat's pane").
  check("a world with nothing to write to draws nothing at all, and still hasn't fetched the menu", (await world().evaluate(() => document.querySelectorAll("nswp-hud").length)) === 0 && !fetched.some((p) => /\/chunks\/menu-.*\.js$/.test(p)));
  // A stand-in for joining a room: somewhere to write, and a row of the world's that opens the chat.
  await world().evaluate(() => {
    window.__chatSent = [];
    const c = window.__nswpTest.controls;
    c.chat.attach((text) => void window.__chatSent.push(text), { title: "Room chat" });
    c.add({ id: "trial-chat", section: "room", label: "Chat (trial)", act: () => c.signal("toggle:chat") });
  });
  check("once there is a room to write to, the world draws the chat's pane itself", await until(() => world().evaluate(() => window.__nswpTest.chatPane() === true && document.querySelectorAll("nswp-hud.chat-only").length === 1)));
  const shownInWorld = await world().evaluate(() => {
    const root = document.querySelector("nswp-hud").shadowRoot;
    return [".low", ".menu", ".quiet", ".sheet", ".id", ".says", ".full"].filter((sel) => { const el = root.querySelector(sel); return el && getComputedStyle(el).display !== "none"; });
  });
  check("and nothing else of a menu: no bar, no mark, no sheet", shownInWorld.length === 0, shownInWorld);
  check("the pane says whose it is, at its head: the world's name", (await world().evaluate(() => document.querySelector("nswp-hud").shadowRoot.querySelector(".chat .whose")?.textContent)) === "The Gallery", await world().evaluate(() => document.querySelector("nswp-hud").shadowRoot.querySelector(".chat .whose")?.textContent));
  check("there is still one menu, the client's", (await client(() => document.querySelectorAll("nswp-hud:not(.chat-only)").length)) === 1);
  // Opened from the row the world described, pressed in the client's menu while it is up.
  await client(() => window.__client.menu.setOpen(true, "room"));
  await until(() => hud.getByRole("button", { name: "Chat (trial)" }).isVisible());
  await press(hud.getByRole("button", { name: "Chat (trial)" }));
  check("the row the world described opens the chat's pane in the world", await until(() => world().evaluate(() => document.querySelector("nswp-hud").shadowRoot.querySelector(".chat")?.getAttribute("data-state") === "open")));
  check("the client's menu goes as the chat comes up: one thing at a time", await until(() => client(() => window.__client.menu.open === false)));
  check("and the frame has the keys, to write with", await until(() => client(() => document.activeElement?.tagName === "IFRAME")));
  await page.waitForTimeout(300);
  await page.keyboard.type("hello room", { delay: 30 });
  await page.keyboard.press("Enter");
  check("what is written in the pane is said by the world, to its room", await until(() => world().evaluate(() => JSON.stringify(window.__chatSent) === JSON.stringify(["hello room"]))), await world().evaluate(() => window.__chatSent));
  await page.screenshot({ path: join(SHOTS, "menu-client-3-chat.png") });
  await page.keyboard.press("Escape");
  check("Escape puts the chat's pane away", await until(() => world().evaluate(() => document.querySelector("nswp-hud").shadowRoot.querySelector(".chat")?.getAttribute("data-state") !== "open")));

  // ---- A page that doesn't speak the words: the client draws no menu over it, and the Gallery's tabs are gone.
  await client((to) => (document.getElementById("view").src = to), `${PLAIN}/`);
  check("a description is gone when the frame loads another page", await until(() => client(() => window.__client.below.world === null && window.__client.below.port.view().title !== "The Gallery")));
  check("over a page that doesn't speak the words the client draws no menu", await until(() => client(() => document.querySelector("nswp-hud").hidden === true)));

  // ---- Home as a guarantee: a world that says it speaks the words and then answers nothing.
  await client((to) => (document.getElementById("view").src = to), `${STUCK}/`);
  await until(() => client(() => window.__client.below.speaks === true));
  // Its own tabs, and none of a world's: the switches for people's pictures and for chat stand only where a world
  // fills People and Room.
  check("the menu is back over a page that speaks the words, with only the client's own tabs", await client(() => document.querySelector("nswp-hud").hidden === false && window.__client.below.port.view().sections.every((s) => ["travel", "look", "moving", "view"].includes(s.id))), await client(() => window.__client.below.port.view().sections.map((s) => s.id)));
  const saidHome = [];
  await client(() => { window.__said = []; window.__client.below.port.onSay((t) => window.__said.push(t)); });
  const startedAt = Date.now();
  await press(hud.getByRole("button", { name: "Home" }).first());
  const homeAt = await until(() => Promise.resolve(inFrame()?.url().startsWith(`${CLIENT}/home.html`) ? Date.now() : null), 5000);
  check("Home takes the visitor home though the world never answers", !!homeAt, inFrame()?.url());
  results["how long Home took with a world that never answers, in ms"] = homeAt ? homeAt - startedAt : null;
  check("within a second and a bit", !!homeAt && homeAt - startedAt < 2500, homeAt && homeAt - startedAt);
  check("and says what was in hand was left behind", (await client(() => window.__said)).some((t) => /left behind/.test(t)), await client(() => window.__said));
  void saidHome;
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
