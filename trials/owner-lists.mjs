// A world owner keeps someone out, walked on this machine (protocol/10-identity.md, "A world's own lists"): a
// copy of the Gallery whose manifest, in the scripted browsers only, names a keeper, and a block list that keeper
// signed, on the stand-in relay. Three visitors by name: Ana and Cy, and Ben, whom the owner blocked. Then the same
// world by invitation, with the owner's guest list naming Ana and Cy.
//
// What is real here: this checkout's own build of the Gallery (sites/gallery/dist, so run `npm run build` first),
// the kit's gate and rooms inside it, a list in BitGate's shape signed with a throwaway key, the stand-in relay
// service (ws://127.0.0.1:4313), and WebRTC between the scripted browsers.
//
// What is a stand-in: each visitor's sign-in address (it says who is signed in and signs their room pass with a
// throwaway key) and the world's manifest, changed in these browsers only. One visitor's copy of the kit is also
// told nothing of the list, standing in for a client that doesn't keep the rule: the others' kits must keep him
// out anyway.
//
// Nothing leaves this machine. Every relay is the stand-in relay; every other request to anywhere but the world's
// copy is refused and listed; and the rooms' public STUN servers are taken out in these browsers, so a connection
// is made from this machine's own addresses alone. Throwaway keys, nothing published but to the stand-in relay
// (memory only, gone when it stops), nothing on disk changed: the Gallery keeps no list.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { generateSecretKey, getPublicKey, finalizeEvent } = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/pure.js`);
const { default: WebSocket } = await import(`${NSWP}/node_modules/ws/wrapper.mjs`);
const { buildRoomPass, ownerListTemplate, worldSubject, readOwnerList } = await import(`${NSWP}/packages/core/dist/index.js`);
const { existsSync, mkdirSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

const RELAY = process.env.RELAY ?? "ws://127.0.0.1:4313";
const WORLD = `https://${HOST}:4397`;
const SIGN_IN = "https://bitlogin.network";
const DIST = join(NSWP, "sites", "gallery", "dist");
if (!existsSync(join(DIST, "app.js"))) throw new Error("The Gallery isn't built in this checkout. Run `npm run build` first.");
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };

// ---- Who is who. All thrown away when this ends.
const keeper = generateSecretKey();
const KEEPER = getPublicKey(keeper);
const people = { ana: generateSecretKey(), ben: generateSecretKey(), cy: generateSecretKey() };
const pub = Object.fromEntries(Object.entries(people).map(([n, s]) => [n, getPublicKey(s)]));
const names = { ana: "Ana Test", ben: "Ben Test", cy: "Cy Test" };

// ---- The world as its own site says it, and as these browsers are handed it: a keeper named, and perhaps a rule.
const file = JSON.parse(readFileSync(join(DIST, ".well-known", "nswp.json"), "utf8"));
const D = Object.keys(file.worlds)[0];
const PUBLISHER = Object.keys(file.publishers)[0];
want("1 as built, the Gallery keeps no list and closes its rooms to nobody", [file.worlds[D].keepers ?? null, file.worlds[D].named_only ?? null], [null, null]);
const manifestFor = ({ knows = true, namedOnly = false, invitation = false } = {}) => JSON.stringify({ ...file, worlds: { ...file.worlds, [D]: { ...file.worlds[D], ...(knows ? { keepers: [KEEPER] } : {}), ...(knows && namedOnly ? { named_only: true } : {}), ...(knows && invitation ? { by_invitation: true } : {}) } } });

// ---- The owner's block list: Ben. Signed by the keeper and put on the stand-in relay, as `nswp sign-world-list`
// and `nswp publish` would. A list from before it, naming nobody, goes up first: the newer must stand.
const subject = worldSubject(PUBLISHER, D);
const signList = (who, at) => finalizeEvent(ownerListTemplate({ scope: "user-deny", subject, people: who, createdAt: at }), keeper);
const toRelay = (event) => new Promise((res, rej) => { const ws = new WebSocket(RELAY); ws.on("open", () => ws.send(JSON.stringify(["EVENT", event]))); ws.on("message", (m) => { const j = JSON.parse(String(m)); if (j[0] === "OK") { ws.close(); res(j[2]); } }); ws.on("error", rej); setTimeout(() => rej(new Error("relay timeout")), 4000); });
const now = Math.floor(Date.now() / 1000);
const older = signList([], now - 600);
const list = signList([pub.ben], now - 5);
want("2 the stand-in relay takes the owner's lists, and the newer names Ben", [await toRelay(older), await toRelay(list), ((x) => (x.ok ? x.entries : x.reason))(readOwnerList(list, { root: [KEEPER] }))], [true, true, [pub.ben]]);

// ---- The scripted browsers.
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".ogg": "audio/ogg", ".txt": "text/plain; charset=utf-8", ".png": "image/png" };
const rules = (JSON.parse(readFileSync(join(DIST, "vercel.json"), "utf8")).headers ?? []).map((rule) => ({ fits: new RegExp(`^${rule.source}$`), headers: Object.fromEntries(rule.headers.filter((h) => !/strict-transport|cache-control/i.test(h.key)).map((h) => [h.key, h.value])) }));
const headersFor = (path) => Object.assign({}, ...rules.filter((rule) => rule.fits.test(path)).map((rule) => rule.headers));
/** The stand-in sign-in address: who is signed in, and their room pass, signed with their throwaway key by this script. */
const signerPage = `<!doctype html><meta charset="utf-8"><title>stand-in signer</title><script>
const WORLD = ${JSON.stringify(WORLD)};
let who = null;
const say = (m) => parent.postMessage({ nswp: "nswp-signer", v: 1, ...m }, WORLD);
const state = (id) => say({ t: "state", ...(id ? { id } : {}), unlocked: !!who, ...(who ? { pubkey: who, name: "Trial visitor", remembered: true } : {}) });
addEventListener("message", async (e) => {
  const d = e.data;
  if (e.origin !== WORLD || !d || d.nswp !== "nswp-signer") return;
  if (d.t === "state") return state(d.id);
  if (d.t === "have") return say({ t: "none", id: d.id });
  if (d.t === "pass" && who) return say({ t: "signed", id: d.id, event: JSON.parse(await window.__trialPass(d.session)) });
});
window.__trialWho().then((w) => { who = w; say({ t: "ready" }); });
</script>`;
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const refused = new Set();
const errors = [];

/** A visitor: `who` signed in by name (or nobody), and what their copy of the kit is told of the world's rules. */
async function visitor(who, { knows = true, namedOnly = false, invitation = false } = {}) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.grantPermissions(["local-network-access"]).catch(() => undefined);
  await ctx.exposeFunction("__trialWho", () => (who ? pub[who] : null));
  await ctx.exposeFunction("__trialPass", (session) => JSON.stringify(finalizeEvent(buildRoomPass({ session, origin: WORLD, name: names[who], createdAt: Math.floor(Date.now() / 1000) }), people[who])));
  await ctx.addInitScript(() => {
    window.__nswpTrial = { gate: true };
    // No public STUN server: a connection between these browsers is made from this machine's own addresses.
    const Real = window.RTCPeerConnection;
    if (Real) {
      window.RTCPeerConnection = function (config) { return new Real({ ...(config ?? {}), iceServers: [] }); };
      window.RTCPeerConnection.prototype = Real.prototype;
    }
  });
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === SIGN_IN && url.pathname === "/signer/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: signerPage });
    if (url.origin === SIGN_IN && url.pathname === "/connect/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<p>stand-in" });
    if (url.origin === WORLD) {
      const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
      const headers = { ...headersFor(url.pathname), "access-control-allow-origin": "*" };
      if (url.pathname === "/.well-known/nswp.json") return route.fulfill({ status: 200, contentType: TYPES[".json"], headers, body: manifestFor({ knows, namedOnly, invitation }) });
      const on = normalize(join(DIST, path));
      if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
      return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", headers, body: readFileSync(on) });
    }
    refused.add(url.origin);
    return route.abort();
  });
  // Every relay is the stand-in relay.
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => {
    const up = new WebSocket(RELAY);
    const waiting = [];
    up.on("open", () => { for (const m of waiting.splice(0)) up.send(m); });
    up.on("message", (m) => { try { ws.send(String(m)); } catch { /* gone */ } });
    up.on("error", () => {});
    ws.onMessage((m) => (up.readyState === 1 ? up.send(m) : waiting.push(m)));
    ws.onClose(() => up.close());
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${who ?? "guest"}: ${String(e).slice(0, 200)}`));
  const until = async (fn, ms = 60000, every = 300) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(every); } return null; };
  // A busy machine with several browsers open loads slowly: given time.
  await page.goto(`${WORLD}/`, { timeout: 180000 });
  // Ready means the gate has read the owner's list from the relay, where this kit is told of one. Where no relay
  // answered in time (a busy machine), the gate stops nobody and asks again within twenty seconds: waited for.
  await until(() => page.evaluate((knows) => { const g = window.__nswpTest?.state?.ready === true ? window.__nswpTest.gate?.() : null; return !!g && g.state !== "checking" && (knows ? (g.lists === "read" || g.lists === "not-found") && (!g.byInvitation || g.invites === "read" || g.invites === "not-found") : true); }, knows), 180000);
  await page.evaluate(() => { window.__said = []; window.__nswpTest.controls.onSay((w) => window.__said.push(w)); });
  const gate = () => page.evaluate(() => window.__nswpTest.gate());
  const said = () => page.evaluate(() => window.__said);
  /** Walk at the gate, as a press on the floor past it would: where they end up along the hall. */
  const walkAtIt = async () => {
    for (const other of ctx.pages()) if (other !== page) await other.close().catch(() => undefined);
    await page.bringToFront();
    await page.evaluate(() => { const h = window.__nswpTest; h.teleport(0, 1.5); h.face(0); h.step(0, -3.5); });
    const zs = [];
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500);
      zs.push(await page.evaluate(() => window.__nswpTest.where()[1]));
      if (zs.at(-1) < -1 || (zs.length > 12 && Math.abs(zs.at(-1) - zs.at(-13)) < 0.01 && Math.abs(zs.at(-1) - 1.5) > 0.05)) break;
    }
    return zs.at(-1);
  };
  /** Press Join as a visitor would, and wait until they are in, or told why not. */
  const joinRoom = async () => {
    await page.evaluate(() => window.__nswpTest.controls.run("room-join"));
    return until(async () => {
      const room = await page.evaluate(() => window.__nswpTest.state.room);
      if (room?.self) return { joined: true, self: room.self };
      const last = (await said()).find((w) => /^Couldn't join/.test(w));
      return last ? { joined: false, said: last } : null;
    }, 30000);
  };
  /** Who this visitor's room shows now, by session key. */
  const shown = () => page.evaluate(() => window.__nswpTest.state.room?.members ?? []);
  return { who, page, gate, said, walkAtIt, joinRoom, shown, until, close: () => ctx.close() };
}

try {
  mkdirSync(SHOTS, { recursive: true });
  // ---- 1. At the gate. Ana and Cy come in; Ben, whom the owner blocked, is stopped and told why.
  const ana = await visitor("ana");
  const ben = await visitor("ben");
  const cy = await visitor("cy");
  const [ga, gb, gc] = [await ana.gate(), await ben.gate(), await cy.gate()];
  want("3 Ana and Cy are let in; Ben is kept out, by the owner's list as read from the relay", [ga.state, gc.state, gb.state, gb.reason, gb.lists, gb.ownerBlocked], ["open", "open", "shut", "blocked", "read", 1]);
  want("3b Ben is told plainly, and offered nothing to press", [gb.why, await ben.page.evaluate(() => window.__nswpTest.controls.view().sections.flatMap((s) => s.items).filter((i) => i.id.startsWith("gate-")).length)], ["The owner of this world has asked you not to come in.", 0]);
  want("4 Ben can't walk past the gate; Ana can", [(await ben.walkAtIt()) >= 0, (await ana.walkAtIt()) < -1], [true, true]);
  await ben.page.screenshot({ path: `${SHOTS}/owner-lists-1-ben-at-the-gate.png` });

  // ---- 2. In the room. Ana and Cy join and see each other. Ben's own kit refuses to join him at all.
  const inA = await ana.joinRoom();
  const inC = await cy.joinRoom();
  want("5 Ana and Cy join the room", [inA?.joined, inC?.joined], [true, true]);
  const seesCy = await ana.until(async () => (await ana.shown()).includes(inC.self), 90000, 500);
  want("5b and Ana's room shows Cy", !!seesCy, true);
  const benTries = await ben.joinRoom();
  want("6 Ben's own kit won't join him, and says why", benTries, { joined: false, said: "Couldn't join: the owner of this world has asked you not to come in." });
  await ben.close();

  // ---- 3. Ben again, with a copy of the kit told nothing of the list, standing in for a client that doesn't keep
  // the rule. He joins by name. Ana's and Cy's kits know the list, and keep him out of their rooms anyway.
  const rogue = await visitor("ben", { knows: false });
  want("7 with a kit told nothing of the list, Ben is let past his own gate", (await rogue.gate()).state, "free");
  const inB = await rogue.joinRoom();
  want("7b and joins the room by name", inB?.joined, true);
  // He announces himself and shows his pass; the others' kits let him go when they read it. Give the room time.
  await ana.page.waitForTimeout(25000);
  const [atAna, atCy] = [await ana.shown(), await cy.shown()];
  want("8 Ana's and Cy's rooms never keep Ben, and still show each other", [atAna.includes(inB.self), atCy.includes(inB.self), atAna.includes(inC.self), atCy.includes(inA.self)], [false, false, true, true]);
  r.benSees = (await rogue.shown()).length;
  await ana.page.screenshot({ path: `${SHOTS}/owner-lists-2-ana-room.png` });
  for (const v of [ana, cy, rogue]) await v.close();

  // ---- 4. A world whose rooms show only named people. Ana joins. A guest is refused at Join by their own kit; a
  // guest whose kit is told nothing of the rule joins, and Ana's room never shows them and lets them go.
  const anaN = await visitor("ana", { namedOnly: true });
  want("9 the gate says the world's rooms show only named people", (await anaN.gate()).namedOnly, true);
  const inAN = await anaN.joinRoom();
  const guest = await visitor(null, { namedOnly: true });
  want("10 a guest's own kit won't join them, and says why", await guest.joinRoom(), { joined: false, said: "Couldn't join: this world's rooms show only people who are signed in. Sign in, then join." });
  await guest.close();
  const rogueGuest = await visitor(null, { knows: false });
  const inG = await rogueGuest.joinRoom();
  want("11 a guest whose kit is told nothing of the rule joins", [inAN?.joined, inG?.joined], [true, true]);
  // Watched for longer than a member has to show a pass: never shown at any look.
  let everShown = false;
  for (let i = 0; i < 30; i++) {
    if ((await anaN.shown()).includes(inG.self)) everShown = true;
    await anaN.page.waitForTimeout(1000);
  }
  want("12 Ana's room never shows the guest, at any look over thirty seconds", everShown, false);
  for (const v of [anaN, rogueGuest]) await v.close();

  // ---- 5. A world by invitation. The owner's allow list names Ana and Cy; Ben is on neither, so he is not invited.
  const invite = finalizeEvent(ownerListTemplate({ scope: "user-allow", subject, people: [pub.ana, pub.cy], createdAt: Math.floor(Date.now() / 1000) - 5 }), keeper);
  want("14 the stand-in relay takes the owner's guest list", await toRelay(invite), true);
  const anaI = await visitor("ana", { invitation: true });
  const cyI = await visitor("cy", { invitation: true });
  const guestI = await visitor(null, { invitation: true });
  const [gaI, gcI, ggI] = [await anaI.gate(), await cyI.gate(), await guestI.gate()];
  want("15 Ana and Cy, invited, are let in; a guest is asked to sign in first", [gaI.state, gaI.byInvitation, gaI.invites, gcI.state, ggI.state, ggI.reason], ["open", true, "read", "open", "shut", "signed-out"]);
  want("15b and the guest is told why, with one thing to press: sign in", [ggI.why, await guestI.page.evaluate(() => window.__nswpTest.controls.view().sections.flatMap((s) => s.items).filter((i) => i.id.startsWith("gate-")).map((i) => i.label))], ["This world is by invitation. Sign in, so it can see whether you are invited.", ["Sign in, to show you are invited"]]);
  // Ben was blocked earlier; take him off the block list, so what keeps him out here is not being invited.
  want("16 the owner unblocks Ben", await toRelay(signList([], Math.floor(Date.now() / 1000) - 2)), true);
  const benI = await visitor("ben", { invitation: true });
  const gbI = await benI.gate();
  want("17 Ben, signed in and not invited, is kept out and told so, with nothing to press", [gbI.state, gbI.reason, gbI.why], ["shut", "not-invited", "This world is by invitation, and its owner hasn't invited you."]);
  want("17b and can't walk past the gate", (await benI.walkAtIt()) >= 0, true);
  await benI.page.screenshot({ path: `${SHOTS}/owner-lists-3-ben-not-invited.png` });
  want("18 Ben's own kit won't join him to the room, and says why", await benI.joinRoom(), { joined: false, said: "Couldn't join: this world is by invitation, and its owner hasn't invited you." });
  await benI.close();
  await guestI.close();
  const inAI = await anaI.joinRoom();
  const inCI = await cyI.joinRoom();
  // Ben again, with a kit told nothing of it: he joins by name, and Ana's and Cy's rooms let him go.
  const rogueI = await visitor("ben", { knows: false });
  const inBI = await rogueI.joinRoom();
  want("19 Ana and Cy join; Ben, with a kit told nothing of it, joins too", [inAI?.joined, inCI?.joined, inBI?.joined], [true, true, true]);
  const seesEachOther = await anaI.until(async () => (await anaI.shown()).includes(inCI.self), 90000, 500);
  await anaI.page.waitForTimeout(20000);
  const [atAnaI, atCyI] = [await anaI.shown(), await cyI.shown()];
  want("20 Ana's and Cy's rooms show each other, and not Ben", [!!seesEachOther, atAnaI.includes(inCI.self), atCyI.includes(inAI.self), atAnaI.includes(inBI.self), atCyI.includes(inBI.self)], [true, true, true, false, false]);
  for (const v of [anaI, cyI, rogueI]) await v.close();

  r.refused = [...refused];
  r.errors = errors.slice(0, 6);
  want("21 nothing but this machine was reached, and no page threw", [r.refused, r.errors], [[], []]);
} catch (e) {
  bad.push(`the walk stopped: ${String(e).slice(0, 400)}`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(r, null, 1));
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
