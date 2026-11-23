// The client has the menu, both ends together (docs/plans/the-clients-menu.md, step 1; protocol/02-doors.md, "The
// client has the menu"): a stand-in client that draws the visitor's menu, from this checkout's kit, above this
// checkout's own Gallery in a frame.
//
// What is real: the Gallery's build (sites/gallery/dist, so run `npm run build` first), the menu and both ends of
// its port as built from this checkout, a real Chrome, and a real mouse and keyboard at places on the screen. What
// is a stand-in: the client (trials/stand-in-client/main.ts: no sign-in, no bag, a way home and Display), the names
// of every site, the Gallery's own rules about who may frame it (left off so this page may), a world that never
// answers (a page that says `here` and nothing else), a page that doesn't speak the words, and "home". Three rows
// are added to the Gallery through its test hook, since nothing in it for a guest is typed into or copies. For the
// visitor's own music the file is a minute of one note, made here and removed, and this script chooses it at the
// browser's chooser. Nothing is fetched from anywhere else; the Gallery reaching for its sign-in address is refused.
//
// Presses and keys here are a mouse and a keyboard at places on the screen: where a thing is, is read from the page
// (reading moves no keys), and then the mouse is sent there. Nothing is clicked by asking the page to click it.
//
//   npm run build && node trials/menu-client.mjs
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const serve = async (ctx) => {
    await ctx.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (url.origin === CLIENT) return url.pathname === "/app.js" ? route.fulfill({ status: 200, contentType: TYPES[".js"], body: clientJs }) : url.pathname === "/home.html" ? route.fulfill({ status: 200, contentType: TYPES[".html"], body: said("home") }) : route.fulfill({ status: 200, contentType: TYPES[".html"], body: clientPage });
      if (url.origin === STUCK) return route.fulfill({ status: 200, contentType: TYPES[".html"], body: said("a world that is stuck") });
      if (url.origin === PLAIN) return route.fulfill({ status: 200, contentType: TYPES[".html"], body: said("a page that doesn't speak the words") });
      // "The next world", where a visit needs one: the same build under another site's name.
      if (url.origin === WORLD || url.origin === "https://grove.test") {
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
  };
  await serve(ctx);
  const page = await ctx.newPage();
  const until = async (ask, ms = 15000) => {
    const end = Date.now() + ms;
    for (;;) {
      const got = await Promise.resolve().then(ask).catch(() => null);
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

  // ---- A world's part of a tab both fill is under the world's name, below the client's own.
  check("in People, the world's rows stand under the world's name, below the client's own switches", await until(() => client(() => {
    const kids = [...document.querySelector("nswp-hud").shadowRoot.querySelector(".rows").children];
    const name = kids.findIndex((k) => k.classList.contains("from") && k.textContent === "The Gallery");
    const own = kids.findIndex((k) => /Profile pictures/.test(k.textContent));
    const worlds = kids.findIndex((k) => /Load people's files from anywhere/.test(k.textContent));
    return own !== -1 && name > own && worlds > name;
  })));

  // ---- Sound and Help: tabs both fill.
  const both = await client(() => {
    const view = window.__client.below.port.view();
    const tab = (id) => view.sections.find((s) => s.id === id);
    return {
      sound: tab("sound")?.items.map((i) => [i.id, i.from ?? null]),
      help: { note: tab("help")?.note, said: tab("help")?.said ?? null, rows: tab("help")?.items.map((i) => [i.id, i.from ?? null]) },
      hum: window.__client.below.world.state.hum,
    };
  });
  results["sound and help, as the client's menu has them"] = both;
  const ownSound = both.sound?.filter(([, from]) => !from).map(([id]) => id) ?? [];
  const worldSound = both.sound?.filter(([, from]) => from).map(([id]) => id) ?? [];
  check("Sound has the client's own volumes and music first", ["sound-all", "sound-effects", "sound-music", "sound-voices", "juke-add"].every((id) => ownSound.includes(id)) && both.sound.findIndex(([, from]) => from) === (worldSound.length ? ownSound.length : -1), both.sound);
  // The piece the place is playing, and the room's own switch for hearing music other people share.
  check("and of the world's, only what is the world's: never a volume or the visitor's music", worldSound.every((id) => ["world:sound-piece", "world:sound-hear"].includes(id)), worldSound);
  check("the switch for the room's hum is the client's, shown where the world says it has one", ownSound.includes("sound-hum") === (both.hum === true), { hum: both.hum, ownSound });
  check("Help has the client's own words on how to move as its own", /Drag to look around/.test(both.help.note ?? "") && /This menu is the same in every world\. Home always takes you home, whatever a world does\./.test(both.help.note ?? ""), both.help.note);
  check("and the world's sentence about itself after them, under the world's name", both.help.said?.from === "The Gallery" && both.help.said.note.length > 0 && !/Drag to look around/.test(both.help.said.note), both.help.said);
  await client(() => window.__client.menu.setOpen(true, "help"));
  check("the menu draws the world's words apart, with the world's name before them", await until(() => client(() => {
    const root = document.querySelector("nswp-hud").shadowRoot;
    const own = root.querySelector(".note:not(.said)");
    const said = root.querySelector(".note.said");
    return !!own && !!said && !said.hidden && said.querySelector("b")?.textContent === "The Gallery" && (own.compareDocumentPosition(said) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  })));
  await page.screenshot({ path: join(SHOTS, "menu-client-7-help.png") });

  // ---- Moving is a tab both fill: how the visitor moves is the client's to switch, and the world moves them so.
  const moving = await client(() => window.__client.below.port.view().sections.find((s) => s.id === "moving")?.items.map((i) => [i.id, i.from ?? null, i.label]) ?? []);
  results["moving, as the client's menu has it"] = moving;
  const ownMoving = moving.filter(([, from]) => !from).map(([id]) => id);
  const worldMoving = moving.filter(([, from]) => from).map(([id]) => id);
  check("Moving has the client's own switches first: how they move at a desk, and how fast they look", ownMoving.includes("fps") && ownMoving.includes("look-speed") && (worldMoving.length === 0 || moving.findIndex(([, from]) => from) === ownMoving.length), moving);
  check("and of the world's, only what the world does for them: never how they move", worldMoving.every((id) => id === "world:jump"), worldMoving);
  const worldsWay = () => world().evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "moving")?.items.find((i) => i.id === "fps")?.label);
  check("the world moves them the casual way to begin with", (await worldsWay()) === "Desk controls: casual", await worldsWay());
  await client(() => window.__client.menu.setOpen(true, "moving"));
  const desk = hud.getByRole("button", { name: "Desk controls: casual" });
  await until(() => desk.isVisible());
  await press(desk);
  check("switched to intense in the client's menu, the world moves them the intense way at once", await until(async () => (await worldsWay()) === "Desk controls: intense"), await worldsWay());
  // Back to casual, so the rest of this trial is as it was: the intense way takes the pointer at a press on the view.
  const deskNow = hud.getByRole("button", { name: "Desk controls: intense" });
  await until(() => deskNow.isVisible());
  await press(deskNow);
  check("and back to casual", await until(async () => (await worldsWay()) === "Desk controls: casual"), await worldsWay());

  // ---- One sound for one press: the client's page makes the menu's own sounds, and the world doesn't make them too.
  await client(() => { window.__cues = []; const s = window.__client.sounds; const play = s.play.bind(s); s.play = (cue, from) => { window.__cues.push(cue); return play(cue, from); }; });
  await world().evaluate(() => { window.__cues = []; const s = window.__nswpTest.sounds; const play = s.play.bind(s); s.play = (cue, from) => { window.__cues.push(cue); return play(cue, from); }; });
  await client(() => window.__client.menu.setOpen(true, "room"));
  await until(() => hud.getByRole("button", { name: "A row of the world's" }).first().isVisible());
  await press(hud.getByRole("button", { name: "A row of the world's" }).first());
  await until(() => world().evaluate(() => window.__got.filter((g) => g[0] === "plain").length >= 2));
  await page.waitForTimeout(400);
  const cues = { client: await client(() => window.__cues), world: await world().evaluate(() => window.__cues) };
  check("a press on a world's row is heard once, from the client's page", cues.client.filter((c) => c === "press").length === 1 && !cues.world.includes("press"), cues);
  check("and the menu coming up is heard from the client's page, not the world's", !cues.world.some((c) => c === "menuOpen" || c === "menuClose"), cues);

  // ---- You is the client's own: the world says where signing in stands as a fact, and the words are the menu's.
  // The Gallery names a sign-in address, which this trial refuses. Until the kit has waited on it the fact is "none"
  // (nothing to press yet); then it is "unanswered". Which of the two a run met used to depend on how fast the
  // machine was, and the press below was only tried in the second. So the fact is waited for.
  check("the world's fact for signing in becomes one that can be pressed, once its sign-in address has not answered", await until(() => client(() => window.__client.below.world.state.signIn !== "none"), 40000), await client(() => window.__client.below.world.state.signIn));
  const signing = await client(() => {
    const row = window.__client.below.port.view().sections.find((s) => s.id === "you")?.items.find((i) => i.id === "world-sign-in");
    return { fact: window.__client.below.world.state.signIn, named: window.__client.below.world.state.named, row: row ? [row.label, row.from ?? null] : null, worldsRowsInYou: (window.__client.below.world.sections.find((s) => s.id === "you")?.rows ?? []).length };
  });
  results["signing in, as the world says it and the client words it"] = signing;
  const WORDS = { ready: "Sign in to The Gallery", asking: "Asking your sign-in address…", unanswered: "Your sign-in address didn't answer. Press to try again." };
  check("the world says where signing in stands as one of four facts, and puts no row in You", ["none", "ready", "asking", "unanswered"].includes(signing.fact) && signing.worldsRowsInYou === 0, signing);
  check("the client words its own row from that fact", signing.fact !== "none" && signing.row?.[0] === WORDS[signing.fact] && signing.row[1] === null, signing);
  {
    await client(() => window.__client.menu.setOpen(true, "you"));
    const signIn = hud.getByRole("button", { name: WORDS[signing.fact] ?? "no such row" });
    await until(() => signIn.isVisible(), 5000);
    if (await signIn.isVisible()) await press(signIn);
    check("pressing it asks the client to open its sign-in, and says nothing to the world", await until(() => client(() => window.__client.asked.length === 1), 5000));
  }

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
  check("the menu is back over a page that speaks the words, with only the client's own tabs", await client(() => document.querySelector("nswp-hud").hidden === false && window.__client.below.port.view().sections.every((s) => ["travel", "look", "moving", "view", "sound", "help"].includes(s.id))), await client(() => window.__client.below.port.view().sections.map((s) => s.id)));
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

  // ---- "Enter VR" in the client's menu, then "Launch" in the world (the owner, 2026-11-23: two presses, each with
  // its own name). A fresh visit, with a made-up headset in the world's page (iwer): it starts a session whenever
  // asked, so what is tried is the kit's own rule, which asks the browser whether the press was in this page.
  // Nothing is run inside the world's page before the press on the client's menu: a scripted call into a page
  // counts there as a press (trials/README.md), and this is about exactly that.
  {
    const IWER = readFileSync(join(NSWP, "node_modules", "iwer", "build", "iwer.min.js"), "utf8");
    const ctx2 = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
    // In the next world, what its client first says to it is kept by the page, to be read here.
    await ctx2.addInitScript(`if (location.origin === "https://grove.test") addEventListener("message", (e) => { if (e.data && e.data.nswp === "menu" && e.data.has === true) window.__has = e.data.settings; });`);
    await ctx2.addInitScript(`if (location.origin === ${JSON.stringify(WORLD)}) { ${IWER}; new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false }).installRuntime({ forceInstall: true }); }`);
    await serve(ctx2);
    const page2 = await ctx2.newPage();
    const until2 = async (ask, ms = 30000) => {
      const end = Date.now() + ms;
      for (;;) {
        const got = await Promise.resolve().then(ask).catch(() => null);
        if (got || Date.now() > end) return got;
        await page2.waitForTimeout(100);
      }
    };
    await page2.goto(`${CLIENT}/?home=${encodeURIComponent(`${CLIENT}/home.html`)}`, { timeout: 60000 });
    const hud2 = page2.locator("nswp-hud");
    // Read from the client's page only: the world says it can start a headset session, and describes the row.
    const described = await until2(() => page2.evaluate(() => {
      const w = window.__client.below.world;
      const row = w?.sections.find((s) => s.id === "view")?.rows.find((r) => r.id === "vr");
      return row && w.state.headset.supported ? { label: row.label, bar: row.bar === true, presenting: w.state.headset.presenting } : null;
    }), 60000);
    check("launch/the world says it can start a headset session, and its row says Enter VR", described?.label === "Enter VR" && described.presenting === false, described);
    // Left a while with nothing pressed anywhere, so that no earlier press could count for the world.
    await page2.waitForTimeout(6000);
    const key = hud2.getByRole("button", { name: /Enter VR/ }).first();
    const box = await key.boundingBox();
    await page2.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const world2 = () => page2.frames().find((f) => f.url().startsWith(WORLD));
    const launchShown = await until2(() => world2().evaluate(() => {
      const scrim = document.getElementById("nswp-enter");
      return scrim ? { button: document.getElementById("nswp-enter-vr")?.textContent, hint: document.getElementById("nswp-enter-hint")?.textContent, label: scrim.getAttribute("aria-label") } : null;
    }), 15000);
    check("launch/a press on Enter VR above brings the world's own press up, and it says Launch", launchShown?.button === "Launch", launchShown);
    results["launch/the world's screen, as shown"] = launchShown;
    check("launch/no session started from the press above", (await world2().evaluate(() => window.__nswpTest.state.xr)) !== "presenting", await world2().evaluate(() => window.__nswpTest.state.xr));
    await page2.screenshot({ path: join(SHOTS, "menu-client-6-launch.png") });
    // The second press, in the world's own page, with a real mouse on its view (clear of the client's bar and marks,
    // which are over the world at the bottom and the top).
    await page2.mouse.click(550, 320);
    check("launch/a press on the world's view starts the session", await until2(() => world2().evaluate(() => window.__nswpTest.state.xr === "presenting"), 20000), await world2().evaluate(() => window.__nswpTest.state.xr));
    check("launch/and the world says so upward", await until2(() => page2.evaluate(() => window.__client.below.world?.state.headset.presenting === true), 10000));
    check("launch/its screen has gone", (await world2().evaluate(() => !document.getElementById("nswp-enter"))) === true);

    // ---- What they change in the headset is theirs afterwards, and in the next world. Inside a headset only the
    // world can draw the console, so it is there that they change how they move. The world says a change back,
    // by name, and the client keeps it. The made-up headset has no hands to press with, so the row is pressed
    // through the world's own controls, as its in-headset console does.
    const before = await page2.evaluate(() => window.__client.settings());
    const rowsInHeadset = await world2().evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "moving")?.items.map((i) => i.id) ?? []);
    results["headset/the world's own rows for how they move, while in the headset"] = rowsInHeadset;
    check("headset/the client had no word on the fade before", before.fade === undefined, before);
    await world2().evaluate(() => window.__nswpTest.controls.run("move-fade"));
    const after = await until2(async () => { const now = await page2.evaluate(() => window.__client.settings()); return typeof now.fade === "boolean" ? now : null; }, 15000);
    check("headset/a change made in the headset is the client's afterwards", typeof after?.fade === "boolean", after);
    results["headset/the client's settings afterwards"] = after;
    // A world's report can never turn a privacy switch on, or say what they hold: tried with a forged one.
    await world2().evaluate(() => parent.postMessage({ nswp: "menu", settings: { filesAnywhere: true, holding: { item: "37303:" + "ab".repeat(32) + ":x" }, full: true, turn: 90 } }, "*"));
    const forged = await until2(async () => { const now = await page2.evaluate(() => window.__client.settings()); return now.turn === 90 ? now : null; }, 10000);
    check("headset/a report takes only comfort and layout: never a privacy switch, what is held, or the screen", !!forged && forged.filesAnywhere === undefined && forged.holding === undefined && forged.full === undefined, forged);
    // The next world: what its client first says to it carries the change.
    await page2.evaluate(() => (document.getElementById("view").src = "https://grove.test/"));
    const told = await until2(() => page2.frames().find((f) => f.url().startsWith("https://grove.test"))?.evaluate(() => window.__has ?? null), 60000);
    check("headset/and it reaches the next world, with the client's first word to it", !!told && told.fade === after?.fade && told.turn === 90 && told.filesAnywhere === undefined, told);
    await ctx2.close();
  }

  // ---- The kit's own Bag, run in the client's page, which isn't a world; and what is taken up there reaching the
  // framed world (the orchestrator, 2026-11-23, to take the risk out of step 2). A fresh visit. The visitor is
  // someone made up whose bag holds one real item, the dart blaster, by its own signed description: the client's
  // page has a stand-in bag (`?bag=1`), and so has the world (`__nswpTrial.has`, which a world takes only on this
  // machine: so the world is served here under a name that is this machine's). No relay is asked: the script
  // answers the request for the blaster's description with it. Its files are served from the Grove's own build.
  {
    const WORLD3 = "https://gallery.localhost";
    const ITEMS = "https://grove.bitblocks.network";
    const GROVE = join(NSWP, "sites", "grove", "dist");
    const BLASTER = JSON.parse(readFileSync(join(NSWP, "sites", "items", "dart-blaster.event.json"), "utf8"));
    const COORD = `${BLASTER.kind}:${BLASTER.pubkey}:${BLASTER.tags.find((t) => t[0] === "d")[1]}`;
    const ctx3 = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
    await ctx3.addInitScript(`if (location.origin === ${JSON.stringify(WORLD3)}) window.__nswpTrial = { has: [${JSON.stringify(COORD)}] };`);
    const refused3 = new Set();
    const serveFrom = (route, root, pathname) => {
      const on = normalize(join(root, pathname.endsWith("/") ? `${pathname}index.html` : pathname));
      if (!on.startsWith(root) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
      return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", headers: { "access-control-allow-origin": "*" }, body: readFileSync(on) });
    };
    await ctx3.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (url.origin === CLIENT) return url.pathname === "/app.js" ? route.fulfill({ status: 200, contentType: TYPES[".js"], body: clientJs }) : route.fulfill({ status: 200, contentType: TYPES[".html"], body: clientPage.replace(`${WORLD}/`, `${WORLD3}/`) });
      if (url.origin === WORLD3) return serveFrom(route, DIST, url.pathname);
      if (url.origin === ITEMS && url.pathname.startsWith("/items/")) return serveFrom(route, GROVE, url.pathname);
      refused3.add(url.origin);
      return route.abort();
    });
    await ctx3.routeWebSocket(/^wss?:\/\//, (ws) => {
      ws.onMessage((m) => {
        let msg;
        try { msg = JSON.parse(String(m)); } catch { return; }
        if (msg[0] !== "REQ") return;
        const [, sub, ...filters] = msg;
        if (filters.some((f) => f.kinds?.includes(BLASTER.kind) && f.authors?.includes(BLASTER.pubkey))) ws.send(JSON.stringify(["EVENT", sub, BLASTER]));
        ws.send(JSON.stringify(["EOSE", sub]));
      });
    });
    const page3 = await ctx3.newPage();
    const until3 = async (ask, ms = 30000) => {
      const end = Date.now() + ms;
      for (;;) {
        const got = await Promise.resolve().then(ask).catch(() => null);
        if (got || Date.now() > end) return got;
        await page3.waitForTimeout(150);
      }
    };
    await page3.goto(`${CLIENT}/?bag=1`, { timeout: 60000 });
    const world3 = () => page3.frames().find((f) => f.url().startsWith(WORLD3));
    const hud3 = page3.locator("nswp-hud");
    await until3(() => world3()?.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
    await until3(() => page3.evaluate(() => window.__client.below.world?.sections.length > 0));
    const bagTab = () => page3.evaluate(() => window.__client.below.port.view().sections.find((s) => s.id === "bag")?.items.map((i) => [i.id, i.label, i.from ?? null]) ?? null);
    const rows0 = await until3(async () => { const r = await bagTab(); return r && r.length ? r : null; });
    check("bag/the kit's own Bag runs in the client's page, with the visitor's item in it", !!rows0 && rows0.some(([, label]) => /blaster/i.test(label)) && rows0.every(([, , from]) => from === null), rows0);
    check("bag/the world says nothing of the Bag: it is the client's alone", (await page3.evaluate(() => window.__client.below.world.sections.some((s) => s.id === "bag"))) === false);
    check("bag/nothing is in hand to begin with, by the world's word", (await page3.evaluate(() => window.__client.below.world.state.holding)) === "");
    // Chosen, then taken up, with a real mouse in the client's menu.
    await page3.evaluate(() => window.__client.menu.setOpen(true, "bag"));
    // Pressed with a real mouse where the thing is, and pressed again if the menu was being laid out afresh at that
    // moment and the press found nothing (the Bag's rows are drawn again whenever the world says anything).
    const pressUntil = async (target, shows) => {
      for (let i = 0; i < 4; i++) {
        const at = await target.boundingBox({ timeout: 8000 }).catch(() => null);
        if (at) await page3.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
        if (await until3(() => shows(), 6000)) return true;
      }
      return false;
    };
    const tile = hud3.getByRole("button", { name: /blaster/i }).first();
    await until3(() => tile.isVisible());
    const hold = hud3.getByRole("button", { name: /^Hold/ }).first();
    await pressUntil(tile, () => hold.isVisible());
    let box;
    results["bag/the client's Bag rows once the item is chosen"] = (await bagTab()).map(([, label]) => label);
    // The blaster does things of its own: the first press says so, in the client's menu, and holds nothing.
    const letIt = hud3.getByRole("button", { name: /^Let it run, and hold/ }).first();
    const askedFirst = await pressUntil(hold, () => letIt.isVisible());
    check("bag/a thing with logic of its own is asked about first, by the client's own Bag", askedFirst && (await page3.evaluate(() => window.__client.below.world.state.holding)) === "", (await bagTab()).map(([, label]) => label));
    await pressUntil(letIt, () => page3.evaluate((c) => window.__client.below.world.state.holding === c, COORD));
    check("bag/taken up in the client's Bag, the world says it is in hand", await until3(() => page3.evaluate((c) => window.__client.below.world.state.holding === c, COORD), 30000), await page3.evaluate(() => window.__client.below.world.state.holding));
    // Read in the world's own page: its own controls, which it draws for nobody here, now offer to put the thing away.
    const worldsBag = () => world3().evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "bag")?.items.map((i) => i.label) ?? []);
    check("bag/and it is in hand in the world itself", await until3(async () => (await worldsBag()).some((l) => /^Put .* away/i.test(l)), 10000), await worldsBag());
    await page3.screenshot({ path: join(SHOTS, "menu-client-8-bag.png") });
    // Put away again from the client's Bag.
    const away = hud3.getByRole("button", { name: /Put .*away|Put it away/i }).first();
    if (await until3(() => away.isVisible(), 8000)) {
      box = await away.boundingBox();
      await page3.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      check("bag/put away in the client's Bag, it is out of hand in the world", await until3(() => page3.evaluate(() => window.__client.below.world.state.holding === ""), 15000));
    } else check("bag/the client's Bag offers to put it away", false, (await bagTab()).map(([, label]) => label));
    results["bag/refused, as everything but these sites is"] = [...refused3];
    await ctx3.close();
  }

  // ---- The one-time question, "how you move at a desk" (the owner, 2026-11-21): asked by whoever draws the console,
  // which here is the client. A fresh visit by someone who has never said. A scripted browser is never asked
  // unless the page's address says so (`?ask=moving`), so the client's address does; and the worlds' addresses say
  // so too, to show that a world whose client has the menu doesn't ask. "The next world" is the same build of the
  // Gallery under another name: another site, as the next world is.
  {
    const NEXT = "https://grove.test";
    const ctx4 = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
    const refused4 = new Set();
    await ctx4.routeWebSocket(/^wss?:\/\//, (ws) => ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }));
    await ctx4.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (url.origin === CLIENT) return url.pathname === "/app.js" ? route.fulfill({ status: 200, contentType: TYPES[".js"], body: clientJs }) : route.fulfill({ status: 200, contentType: TYPES[".html"], body: clientPage.replace(`${WORLD}/"`, `${WORLD}/?ask=moving"`) });
      if (url.origin === WORLD || url.origin === NEXT) {
        const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
        if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
        return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
      }
      refused4.add(url.origin);
      return route.abort();
    });
    const page4 = await ctx4.newPage();
    const until4 = async (ask, ms = 30000) => {
      const end = Date.now() + ms;
      for (;;) {
        const got = await Promise.resolve().then(ask).catch(() => null);
        if (got || Date.now() > end) return got;
        await page4.waitForTimeout(150);
      }
    };
    const hud4 = page4.locator("nswp-hud");
    const frameAt = (origin) => page4.frames().find((f) => f.url().startsWith(origin));
    const worldUp = (origin) => until4(() => frameAt(origin)?.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
    const worldsWay4 = (origin) => frameAt(origin).evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "moving")?.items.find((i) => i.id === "fps")?.label);
    const worldAsking = (origin) => frameAt(origin).evaluate(() => (window.__nswpTest.controls.view().sections.find((s) => s.id === "how-you-move-desk")?.items ?? []).length > 0);
    const clientAsking = () => page4.evaluate(() => ({ open: window.__client.menu.open, rows: window.__client.below.port.view().sections.find((s) => s.id === "how-you-move-desk")?.items.map((i) => i.label) ?? [] }));

    await page4.goto(`${CLIENT}/?ask=moving`, { timeout: 60000 });
    await worldUp(WORLD);
    const asked = await until4(async () => { const a = await clientAsking(); return a.open && a.rows.length === 2 ? a : null; }, 15000);
    check("question/a first-time visitor is asked by the client, with the kit's own words", JSON.stringify(asked?.rows) === JSON.stringify(["Casual: click to walk, drag to look", "Intense: the mouse looks, keys walk"]), await clientAsking());
    await page4.waitForTimeout(2500);
    check("question/the world doesn't ask too, though its own address says it may", (await worldAsking(WORLD)) === false && (await frameAt(WORLD).evaluate(() => document.querySelectorAll("nswp-hud").length)) === 0);
    await page4.screenshot({ path: join(SHOTS, "menu-client-9-question.png") });
    const intenseRow = hud4.getByRole("button", { name: "Intense: the mouse looks, keys walk" });
    const at = await intenseRow.boundingBox();
    await page4.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    check("question/answered intense, the world moves them the intense way", await until4(async () => (await worldsWay4(WORLD)) === "Desk controls: intense", 15000), await worldsWay4(WORLD));
    check("question/and the question is gone", (await clientAsking()).rows.length === 0, await clientAsking());

    // The client's page loaded again: the answer is kept on the client's own site.
    await page4.reload({ timeout: 60000 });
    await worldUp(WORLD);
    await page4.waitForTimeout(4000);
    const again = await clientAsking();
    check("question/never asked again in this world", again.open === false && again.rows.length === 0, again);
    check("question/which still moves them the intense way, told by the client as it arrives", await until4(async () => (await worldsWay4(WORLD)) === "Desk controls: intense", 15000), await worldsWay4(WORLD));

    // The next world.
    await page4.evaluate((to) => (document.getElementById("view").src = to), `${NEXT}/?ask=moving`);
    await worldUp(NEXT);
    await page4.waitForTimeout(4000);
    const next = await clientAsking();
    check("question/nor in the next world, by the client or by that world", next.open === false && next.rows.length === 0 && (await worldAsking(NEXT)) === false, next);
    check("question/and the next world moves them the intense way from the start", await until4(async () => (await worldsWay4(NEXT)) === "Desk controls: intense", 15000), await worldsWay4(NEXT));
    results["question/refused, as everything but these sites is"] = [...refused4];
    await ctx4.close();
  }

  // ---- The visitor's own music (section 15, "Four more presses"): Sound is a tab the client fills, so the client's
  // page opens the chooser at the press on its own row, keeps the file on its own site, and plays it itself. The
  // world is told nothing of it, and it doesn't stop at a door. The file is a minute of one note, made here and
  // removed; this script chooses it at the browser's chooser, as a person would. Nobody listens: what is checked is
  // that the client's page says it is playing.
  {
    const NEXT = "https://grove.test";
    const tune = join(SHOTS, "Night drive.wav");
    const tune2 = join(SHOTS, "Low tide.wav");
    {
      const rate = 8000, n = rate * 60, head = Buffer.alloc(44);
      head.write("RIFF", 0); head.writeUInt32LE(36 + n, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
      head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate, 28); head.writeUInt16LE(1, 32); head.writeUInt16LE(8, 34); head.write("data", 36); head.writeUInt32LE(n, 40);
      for (const [file, note] of [[tune, 220], [tune2, 165]]) writeFileSync(file, Buffer.concat([head, Buffer.from(Array.from({ length: n }, (_, i) => 128 + Math.round(20 * Math.sin((i * 2 * Math.PI * note) / rate))))]));
    }
    const ctx5 = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
    const refused5 = new Set();
    await ctx5.routeWebSocket(/^wss?:\/\//, (ws) => ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }));
    await ctx5.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (url.origin === CLIENT) return url.pathname === "/app.js" ? route.fulfill({ status: 200, contentType: TYPES[".js"], body: clientJs }) : route.fulfill({ status: 200, contentType: TYPES[".html"], body: clientPage });
      if (url.origin === WORLD || url.origin === NEXT) {
        const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
        if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
        return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
      }
      refused5.add(url.origin);
      return route.abort();
    });
    // Every word that reaches a world, kept in that world's page from its first moment.
    await ctx5.addInitScript(() => { if (window === window.top) return; window.__told = []; addEventListener("message", (e) => { try { window.__told.push(JSON.stringify(e.data)); } catch { /* not words */ } }); });
    const page5 = await ctx5.newPage();
    const until5 = async (ask, ms = 30000) => {
      const end = Date.now() + ms;
      for (;;) {
        const got = await Promise.resolve().then(ask).catch(() => null);
        if (got || Date.now() > end) return got;
        await page5.waitForTimeout(150);
      }
    };
    const choosers = [];
    page5.on("filechooser", (c) => { choosers.push(c.page() === page5 && c.element() ? "opened" : "opened elsewhere"); void c.setFiles([tune, tune2]); });
    const hud5 = page5.locator("nswp-hud");
    const frameAt5 = (origin) => page5.frames().find((f) => f.url().startsWith(origin));
    const worldUp5 = (origin) => until5(() => frameAt5(origin)?.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
    // A press at where the row is once it has stopped moving: the sheet slides up as it opens, and a press sent to
    // where a row was a moment ago misses it.
    const press5 = async (name) => {
      const where = () => hud5.getByRole("button", { name }).first().boundingBox({ timeout: 1000 });
      let at = await until5(where, 8000);
      // A long tab scrolls: a row down the list is brought into sight first, as a person would scroll to it.
      if (at) await hud5.getByRole("button", { name }).first().scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined);
      for (let i = 0; at && i < 20; i++) {
        await page5.waitForTimeout(150);
        const now = await where().catch(() => null);
        if (now && now.x === at.x && now.y === at.y) break;
        at = now;
      }
      if (!at) return false;
      await page5.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
      return true;
    };
    const juke = () => page5.evaluate(() => { const j = window.__client.sounds.jukebox; return { songs: j.list().map((x) => x.title), playing: j.playing, current: j.current?.title ?? null, page: window.__sameSince }; });
    try {
      await page5.goto(`${CLIENT}/`, { timeout: 60000 });
      await worldUp5(WORLD);
      await page5.evaluate(() => { window.__sameSince = Math.random(); window.__client.menu.setOpen(true, "sound"); });
      const first = (await juke()).page;
      check("music/the client's own row opens the browser's chooser, at a press on the client's page", (await press5("Add music from this device")) && (await until5(() => choosers.length > 0, 8000)) && choosers[0] === "opened", choosers);
      check("music/the chosen files are kept by the client's page, named from their files", await until5(async () => JSON.stringify((await juke()).songs) === '["Night drive","Low tide"]', 10000), await juke());
      const title = (await juke()).songs[0];
      await until5(() => hud5.getByRole("button", { name: "Play your music" }).first().boundingBox(), 5000);
      await press5("Play your music");
      check("music/and played by it", await until5(async () => (await juke()).playing === true, 10000), await juke());
      const told = await frameAt5(WORLD).evaluate(() => window.__told ?? []);
      check("music/the world is told nothing of it", told.length > 0 && !told.some((w) => w.includes(title) || /song-|juke/.test(w)), told.filter((w) => w.includes(title) || /song-|juke/.test(w)).map((w) => w.slice(0, 200)));
      check("music/and keeps none of it", (await frameAt5(WORLD).evaluate(() => window.__nswpTest.sounds.jukebox.list().length)) === 0);

      // ---- Playback controls (docs/backlog/own-music-everywhere.md): the menu's own rows in Sound. What is playing
      // with a bar to move along and the time, the song before and after, a little way back and on, how it goes, and
      // play and pause on the bar where the visitor says. Presses are a real mouse at places on the screen.
      const place = () =>
        page5.evaluate(() => {
          const bar = document.querySelector("nswp-hud").shadowRoot.querySelector(".slide");
          const j = window.__client.sounds.jukebox;
          return bar ? { name: bar.querySelector(".name").textContent, time: bar.querySelector(".time").textContent, max: Number(bar.querySelector("input").max), at: j.position, long: j.duration, playing: j.playing, same: window.__bar ? window.__bar === bar : null } : null;
        });
      const at = async () => (await place())?.at ?? -1;
      const p0 = await until5(async () => { const p = await place(); return p && p.long > 0 ? p : null; }, 10000);
      check("controls/what is playing is named, with a bar to move along and the time", p0?.name === `Your music: ${title}` && /^0:\d\d of 1:00$/.test(p0.time) && p0.max === 60, p0);
      await page5.evaluate(() => { window.__bar = document.querySelector("nswp-hud").shadowRoot.querySelector(".slide"); });
      await page5.waitForTimeout(2300);
      const p1 = await place();
      check("controls/the time runs, and nothing is drawn again for it: the bar is the same one", p1.at > p0.at + 1.5 && p1.time !== p0.time && p1.same === true, [p0, p1]);
      const rowsNow = await page5.evaluate(() => window.__client.below.port.view().sections.find((x) => x.id === "sound").items.filter((i) => i.id.startsWith("juke-") || i.id.startsWith("song-")).map((i) => i.id.startsWith("song-") ? "a song" : i.id));
      check("controls/the rows: what is playing, before, play, after, back, on, shuffle, repeat, the bar, adding, taking out, the songs", JSON.stringify(rowsNow) === JSON.stringify(["juke-place", "juke-previous", "juke-play", "juke-next", "juke-back", "juke-forward", "juke-shuffle", "juke-repeat", "juke-bar", "juke-add", "juke-remove", "a song", "a song"]), rowsNow);
      await press5("Forward 15 seconds");
      check("controls/forward moves on a little way", await until5(async () => (await at()) >= p1.at + 14, 5000), await at());
      const range = await hud5.locator(".slide input").boundingBox();
      await page5.mouse.click(range.x + range.width * 0.75, range.y + range.height / 2);
      check("controls/a press along the bar moves to that place in the song", await until5(async () => Math.abs((await at()) - 45) < 5, 5000), await at());
      await press5("Back 15 seconds");
      check("controls/back moves a little way back", await until5(async () => Math.abs((await at()) - 31) < 5, 5000), await at());
      await page5.waitForTimeout(700);
      await page5.screenshot({ path: join(SHOTS, "menu-client-10-music.png") });
      await press5("Previous song");
      const again = await until5(async () => { const p = await place(); return p && p.at < 3 ? p : null; }, 5000);
      check("controls/previous, well into a song, goes to its start, still playing", again?.playing === true && again.name === `Your music: ${title}`, await place());
      await press5("Next song");
      check("controls/next goes to the song after", await until5(async () => (await place())?.name === "Your music: Low tide", 5000), await place());
      await press5("Previous song");
      check("controls/and previous, in a song's first seconds, to the song before", await until5(async () => (await place())?.name === `Your music: ${title}`, 5000), await place());
      await press5("Shuffle: off");
      check("controls/shuffle is turned on, and what is playing doesn't change", (await until5(() => page5.evaluate(() => window.__client.sounds.jukebox.how.shuffle === true), 3000)) && (await place())?.name === `Your music: ${title}`, await place());
      await press5("Shuffle: on");
      await press5("Repeat: all your songs");
      check("controls/what happens at the end goes round: all, this one, off", await until5(() => page5.evaluate(() => window.__client.sounds.jukebox.how.repeat === "one"), 3000) && (await press5("Repeat: this song")) && (await until5(() => page5.evaluate(() => window.__client.sounds.jukebox.how.repeat === "off"), 3000)), await page5.evaluate(() => window.__client.sounds.jukebox.how));
      await press5("Repeat: off");
      await page5.waitForTimeout(400);

      // Play and pause on the bar: a "now playing" at a glance, with the menu put away.
      await press5("Play and pause on your bar: off");
      const key = () => page5.evaluate((name) => { const k = [...document.querySelector("nswp-hud").shadowRoot.querySelectorAll(".hotbar button.key")].find((b) => b.querySelector(".name")?.textContent === name); const r = k?.getBoundingClientRect(); return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, title);
      check("controls/play and pause go on the bar where the visitor says, named for what is playing", !!(await until5(key, 5000)), await page5.evaluate(() => window.__client.below.port.view().hotbar.map((i) => [i.id, i.short])));
      // The rest of the tab, scrolled to: how it goes, the bar's switch, adding, taking out, and the songs.
      await hud5.getByRole("button", { name: "Low tide" }).first().scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined);
      await page5.waitForTimeout(500);
      await page5.screenshot({ path: join(SHOTS, "menu-client-10b-music-the-rest.png") });
      await page5.evaluate(() => window.__client.menu.setOpen(false));
      await page5.waitForTimeout(600);
      await page5.screenshot({ path: join(SHOTS, "menu-client-13-music-bar.png") });
      // The bar is laid out afresh as things change, so the key is looked for until it is there.
      let k = await until5(key, 8000);
      await page5.mouse.click(k.x, k.y);
      check("controls/pressed on the bar, it pauses", await until5(async () => (await juke()).playing === false, 5000), await juke());
      await page5.waitForTimeout(300);
      k = await until5(key, 8000);
      await page5.mouse.click(k.x, k.y);
      check("controls/and pressed again, it plays on", await until5(async () => (await juke()).playing === true, 5000), await juke());
      check("controls/none of it reached the world", !(await frameAt5(WORLD).evaluate(() => window.__told ?? [])).some((w) => w.includes(title) || /song-|juke/.test(w)));

      // The same rows in a world's own menu (the fallback: this Gallery opened as a page of its own, no client). Its
      // songs are its own site's: the file is chosen again there.
      {
        const own = await ctx5.newPage();
        own.on("filechooser", (c) => void c.setFiles([tune, tune2]));
        await own.goto(`${WORLD}/`, { timeout: 60000 });
        await until5(() => own.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
        const ownHud = own.locator("nswp-hud");
        // Where a thing is, once it is in sight and has stopped moving (a tab may be along the strip, a row down the list).
        // This page is only looked at, so the scripting tool's own press is used: it waits for a thing to be in sight
        // and still, and presses it with the mouse where it is.
        const pressOwn = (role, name) => ownHud.getByRole(role, { name }).first().click({ timeout: 15000 }).then(() => true, () => false);
        await pressOwn("button", "Menu");
        await pressOwn("tab", "Sound");
        await pressOwn("button", "Add music from this device");
        await until5(() => own.evaluate(() => window.__nswpTest.sounds.jukebox.list().length === 2), 10000);
        await pressOwn("button", "Play your music");
        await until5(() => own.evaluate(() => window.__nswpTest.sounds.jukebox.playing && window.__nswpTest.sounds.jukebox.duration > 0), 10000);
        const ownRows = await own.evaluate(() => window.__nswpTest.controls.view().sections.find((x) => x.id === "sound").items.filter((i) => i.id.startsWith("juke-") || i.id.startsWith("song-")).map((i) => (i.id.startsWith("song-") ? "a song" : i.id)));
        check("controls/a world's own menu has the same rows, where no client draws it", JSON.stringify(ownRows) === JSON.stringify(rowsNow), ownRows);
        const ownBar = await until5(() => own.evaluate(() => { const bar = document.querySelector("nswp-hud").shadowRoot.querySelector(".slide"); return bar && /of 1:00$/.test(bar.querySelector(".time").textContent) ? bar.querySelector(".name").textContent : null; }), 8000);
        check("controls/and draws the same bar", ownBar === `Your music: ${title}`, ownBar);
        await own.waitForTimeout(600);
        await own.screenshot({ path: join(SHOTS, "menu-client-14-music-own-menu.png") });
        await own.evaluate(() => window.__nswpTest.sounds.jukebox.pause());
        await own.close();
      }

      // Through a door: the next world comes into the frame, and the client's page stays.
      await page5.evaluate((to) => (document.getElementById("view").src = to), `${NEXT}/`);
      await worldUp5(NEXT);
      await page5.waitForTimeout(2000);
      const after = await juke();
      // The songs are a minute long, so by now it may have gone on to the other one: what matters is that it never stopped.
      check("music/it doesn't stop at a door: the client's page is the same one, still playing", after.playing === true && after.songs.includes(after.current) && after.page === first, after);
      check("music/and the next world is told nothing of it either", !(await frameAt5(NEXT).evaluate(() => window.__told ?? [])).some((w) => w.includes(title) || /song-|juke/.test(w)));
      results["music/refused, as everything but these sites is"] = [...refused5];
    } catch (e) {
      // Said with everything else, so that what was seen before it is not lost.
      check("music/the visit ran to its end", false, String(e).slice(0, 300));
    } finally {
      rmSync(tune, { force: true });
      rmSync(tune2, { force: true });
      await ctx5.close();
    }
  }

  // ---- A file handed down, and a picture handed up (section 15, "Four more presses"; protocol/02-doors.md, "A file
  // going down, and something to save going up"). A press on the client's menu is no press in the world's page, and
  // a browser shows its chooser, and may keep its save, for the page that was pressed. So the client's page opens
  // the chooser and hands the chosen file down, and the world hands its picture up for the client's page to save.
  // The files are a one-dot picture and a line of text, made here and removed; this script chooses them at the
  // browser's chooser, as a person would. Every chooser and every save is counted in the page that made it.
  {
    const dot = join(SHOTS, "menu-client-a-dot.png");
    const text = join(SHOTS, "menu-client-not-a-picture.txt");
    writeFileSync(dot, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64"));
    writeFileSync(text, "not a picture");
    const ctx6 = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 }, acceptDownloads: true });
    const refused6 = new Set();
    await ctx6.routeWebSocket(/^wss?:\/\//, (ws) => ws.onMessage((m) => { let msg; try { msg = JSON.parse(String(m)); } catch { return; } if (msg[0] === "REQ") ws.send(JSON.stringify(["EOSE", msg[1]])); }));
    await ctx6.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (url.origin === CLIENT) return url.pathname === "/app.js" ? route.fulfill({ status: 200, contentType: TYPES[".js"], body: clientJs }) : route.fulfill({ status: 200, contentType: TYPES[".html"], body: clientPage });
      if (url.origin === WORLD) {
        const on = normalize(join(DIST, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname));
        if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
        return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
      }
      refused6.add(url.origin);
      return route.abort();
    });
    // In every page, from its first moment: each chooser it opened, each save it made, and (in the world) each word
    // that reached it, with a file written as what it is.
    await ctx6.addInitScript(() => {
      window.__choosers = 0;
      window.__saves = [];
      const open = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () { if (this.type === "file") window.__choosers++; return open.call(this); };
      const save = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute("download")) window.__saves.push(this.download); return save.call(this); };
      if (window === window.top) return;
      window.__told = [];
      addEventListener("message", (e) => { try { window.__told.push(JSON.stringify(e.data, (_k, v) => (v instanceof Blob ? `[a file: ${v.name ?? "no name"}, ${v.size} bytes, ${v.type}]` : v))); } catch { /* not words */ } });
    });
    const page6 = await ctx6.newPage();
    const until6 = async (ask, ms = 30000) => {
      const end = Date.now() + ms;
      for (;;) {
        const got = await Promise.resolve().then(ask).catch(() => null);
        if (got || Date.now() > end) return got;
        await page6.waitForTimeout(150);
      }
    };
    const choosers6 = [];
    let choose = text;
    page6.on("filechooser", async (c) => { choosers6.push((await c.element().ownerFrame()) === page6.mainFrame() ? "the client's page" : "the world's page"); void c.setFiles(choose); });
    const saved6 = [];
    page6.on("download", (d) => { saved6.push(d.suggestedFilename()); void d.cancel().catch(() => undefined); });
    const hud6 = page6.locator("nswp-hud");
    const world6 = () => page6.frames().find((f) => f.url().startsWith(WORLD));
    // A press at where the row is once it has stopped moving: the sheet slides up as it opens, and a press sent to
    // where a row was a moment ago misses it.
    const press6 = async (name) => {
      const where = () => hud6.getByRole("button", { name }).first().boundingBox();
      let at = await until6(where, 8000);
      if (at) await hud6.getByRole("button", { name }).first().scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined);
      for (let i = 0; at && i < 20; i++) {
        await page6.waitForTimeout(150);
        const now = await where();
        if (now && now.x === at.x && now.y === at.y) break;
        at = now;
      }
      if (!at) return false;
      await page6.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
      return true;
    };
    const said6 = () => page6.evaluate(() => window.__said);
    const told6 = () => world6().evaluate(() => window.__told ?? []);
    try {
      await page6.goto(`${CLIENT}/`, { timeout: 60000 });
      await until6(() => world6()?.evaluate(() => window.__nswpTest?.state?.ready === true), 60000);
      await page6.evaluate(() => { window.__said = []; window.__client.below.port.onSay((t) => window.__said.push(t)); window.__client.menu.setOpen(true, "panels"); });
      const row = await until6(() => page6.evaluate(() => { const i = window.__client.below.port.view().sections.find((s) => s.id === "panels")?.items.find((x) => x.id === "world:panel-file"); return i ? { kind: i.kind, accept: i.accept, from: i.from ?? null, label: i.label } : null; }), 15000);
      check("file/the world's row that takes a file is in the client's Panels, under the world's name, with the kinds it takes", row?.kind === "file" && JSON.stringify(row.accept) === '["image","video"]' && row.from === "The Gallery", row);
      const line = await until6(() => page6.evaluate(() => document.querySelector("nswp-hud").shadowRoot.querySelector(".takes .to")?.textContent ?? null), 8000);
      check("file/and under it the client says which world gets the file", line === "The file you choose goes to The Gallery.", line);

      // A file of a kind the row didn't ask for: the chooser offers only pictures and video, but a person can choose
      // anything. The client refuses it, and says why; nothing reaches the world.
      await press6("Hang a picture or video from this device");
      check("file/the browser's chooser is opened by the client's page, at the press on the client's menu", (await until6(() => choosers6.length === 1, 8000)) && choosers6[0] === "the client's page", choosers6);
      check("file/a file of another kind is not handed over, and the client says why", await until6(async () => (await said6()).includes("Only pictures and video can go here."), 8000), await said6());
      check("file/and the world heard nothing of it", !(await told6()).some((w) => w.includes("a file:") || w.includes('"press"')), (await told6()).filter((w) => w.includes("press")));

      // A picture: handed down as the file it is, with its own name, and hung by the world.
      choose = dot;
      const before = await world6().evaluate(() => window.__nswpTest.panels.list().length);
      await press6("Hang a picture or video from this device");
      const word = await until6(async () => (await told6()).find((w) => w.includes("a file:")), 10000);
      check("file/a picture goes down with the press, as the file it is and under its own name", word === JSON.stringify({ press: "panel-file", file: "[a file: menu-client-a-dot.png, 70 bytes, image/png]", nswp: "menu" }), word);
      check("file/the world hangs it", await until6(async () => (await world6().evaluate(() => window.__nswpTest.panels.list().length)) === before + 1, 15000), await world6().evaluate(() => window.__nswpTest.panels.list().length));
      check("file/and says so, under its own name in the client's menu", await until6(async () => (await said6()).includes("The Gallery: Hung in front of you."), 8000), await said6());
      check("file/the world opened no chooser of its own, either time", (await world6().evaluate(() => window.__choosers)) === 0 && choosers6.every((c) => c === "the client's page") && choosers6.length === 2, { world: await world6().evaluate(() => window.__choosers), choosers6 });
      await page6.screenshot({ path: join(SHOTS, "menu-client-11-file.png") });

      // A picture taken from the client's menu: the world takes it and hands it up, and the client's page saves it.
      await page6.evaluate(() => { window.__said.length = 0; window.__client.menu.setOpen(true, "camera"); });
      const camera = await until6(() => page6.evaluate(() => window.__client.below.port.view().sections.find((s) => s.id === "camera")?.items.filter((x) => x.kind === "save").map((x) => x.id)), 15000);
      check("save/the world's camera rows are rows that save, in the client's menu", JSON.stringify(camera) === '["world:camera-picture","world:camera-selfie","world:camera-clip"]', camera);
      await press6("Take a picture");
      check("save/the picture is saved, under a name of the client's own making", (await until6(() => saved6.length === 1, 20000)) && /^the-gallery-\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.jpg$/.test(saved6[0]), saved6);
      const saves = { client: await page6.evaluate(() => window.__saves), world: await world6().evaluate(() => window.__saves) };
      check("save/by the client's page: the world's own page saved nothing", saves.client.length === 1 && saves.world.length === 0 && saves.client[0] === saved6[0], saves);
      check("save/the world did take it", (await world6().evaluate(() => { const last = window.__nswpTest.camera.last(); return last ? [last.kind, last.blob.type, last.blob.size > 1000] : null; }))?.join() === "picture,image/jpeg,true");
      const after = await said6();
      check("save/the client says what it saved and from which world, and the world doesn't claim to have saved it", after.includes("A picture from The Gallery was saved to this device.") && !after.some((t) => /Picture saved to this device/.test(t)), after);
      await page6.screenshot({ path: join(SHOTS, "menu-client-12-save.png") });
      results["file/refused, as everything but these sites is"] = [...refused6];
    } catch (e) {
      check("file/the visit ran to its end", false, String(e).slice(0, 300));
    } finally {
      rmSync(dot, { force: true });
      rmSync(text, { force: true });
      await ctx6.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
