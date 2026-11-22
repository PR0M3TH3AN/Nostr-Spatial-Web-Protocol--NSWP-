// The owner's screen, "Who comes in", walked on this machine (protocol/10-identity.md, "The owner's screen";
// docs/plans/a-world-by-invitation.md §4): a world by invitation, its keeper signed in, letting Ben in from inside the
// world, and Ben, kept out before, let in after.
//
// What is real here: this checkout's own build of the Gallery (sites/gallery/dist, so run `npm run build` first),
// the kit's gate, console and signer client inside it, the stand-in relay service (ws://127.0.0.1:4313), and a list
// in BitGate's shape, checked by the kit as it comes back and as the gate reads it.
//
// What is a stand-in: the sign-in address. Its page answers the kit's `guests` request as BitLogin's does (asking,
// then signed), by building the one change with the kit's own `changeOwnerList` and signing it with the keeper's
// throwaway key; it checks nothing BitLogin would (that the account is a keeper, the newest list), which is
// BitLogin's own test's to try. And the world's manifest, changed in these browsers only to name a keeper and say it
// is by invitation.
//
// Nothing leaves this machine. Every relay is the stand-in relay; every other request to anywhere but the world's
// copy is refused and listed. Throwaway keys; nothing published but to the stand-in relay (memory only, gone when it
// stops); nothing on disk changed but the pictures.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const { generateSecretKey, getPublicKey, finalizeEvent } = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/pure.js`);
const { default: WebSocket } = await import(`${NSWP}/node_modules/ws/wrapper.mjs`);
const { buildRoomPass, changeOwnerList, encodeNpub, ownerListTemplate, readOwnerList, worldSubject } = await import(`${NSWP}/packages/core/dist/index.js`);
const { existsSync, mkdirSync, readFileSync } = await import("node:fs");
const { extname, join, normalize } = await import("node:path");

const RELAY = process.env.RELAY ?? "ws://127.0.0.1:4313";
const WORLD = `https://${HOST}:4393`;
const SIGN_IN = "https://bitlogin.network";
const DIST = join(NSWP, "sites", "gallery", "dist");
if (!existsSync(join(DIST, "app.js"))) throw new Error("The Gallery isn't built in this checkout. Run `npm run build` first.");
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };

// ---- Who is who. All thrown away when this ends.
const keeper = generateSecretKey();
const KEEPER = getPublicKey(keeper);
const people = { keeper, ben: generateSecretKey(), cy: generateSecretKey() };
const pub = Object.fromEntries(Object.entries(people).map(([n, s]) => [n, getPublicKey(s)]));
const names = { keeper: "The Keeper", ben: "Ben Test", cy: "Cy Test" };

// ---- The world, by invitation, its keeper named, in these browsers only.
const file = JSON.parse(readFileSync(join(DIST, ".well-known", "nswp.json"), "utf8"));
const D = Object.keys(file.worlds)[0];
const PUBLISHER = Object.keys(file.publishers)[0];
const manifest = JSON.stringify({ ...file, worlds: { ...file.worlds, [D]: { ...file.worlds[D], keepers: [KEEPER], by_invitation: true } } });
const subject = worldSubject(PUBLISHER, D);

// ---- On the stand-in relay: the guest list as it stands (Cy, invited), and Ben's and Cy's names.
const toRelay = (event) => new Promise((res, rej) => { const ws = new WebSocket(RELAY); ws.on("open", () => ws.send(JSON.stringify(["EVENT", event]))); ws.on("message", (m) => { const j = JSON.parse(String(m)); if (j[0] === "OK") { ws.close(); res(j[2]); } }); ws.on("error", rej); setTimeout(() => rej(new Error("relay timeout")), 4000); });
const fromRelay = (filter) => new Promise((res, rej) => { const ws = new WebSocket(RELAY); const got = []; ws.on("open", () => ws.send(JSON.stringify(["REQ", "q", filter]))); ws.on("message", (m) => { const j = JSON.parse(String(m)); if (j[0] === "EVENT") got.push(j[2]); if (j[0] === "EOSE") { ws.close(); res(got); } }); ws.on("error", rej); setTimeout(() => rej(new Error("relay timeout")), 4000); });
const now = Math.floor(Date.now() / 1000);
const before = finalizeEvent(ownerListTemplate({ scope: "user-allow", subject, people: [pub.cy], createdAt: now - 60 }), keeper);
for (const n of ["ben", "cy"]) await toRelay(finalizeEvent({ kind: 0, created_at: now - 30, tags: [], content: JSON.stringify({ name: names[n] }) }, people[n]));
want("1 the stand-in relay holds the guest list as it stands: Cy invited", [await toRelay(before), ((x) => (x.ok ? x.entries : x.reason))(readOwnerList(before, { root: [KEEPER] }))], [true, [pub.cy]]);

// What the sign-in address will answer, signed here beforehand as BitLogin builds it, from the list as it stands, for
// the two changes the keeper asks: Ben onto the guest list, and Cy onto a block list started from none. Answered in
// the stand-in's page with no call back to this script, which a browser slows once the world's page is behind the
// sign-in window. A change it wasn't given, or of another list than the one standing, it refuses.
const answers = {
  [`allow:${pub.ben}`]: { list: before.id, event: finalizeEvent(changeOwnerList(before, { subject, change: "allow", key: pub.ben, now: Math.floor(Date.now() / 1000) }), keeper) },
  [`block:${pub.cy}`]: { list: null, event: finalizeEvent(changeOwnerList(null, { subject, change: "block", key: pub.cy, now: Math.floor(Date.now() / 1000) }), keeper) },
};

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".ogg": "audio/ogg", ".txt": "text/plain; charset=utf-8", ".png": "image/png" };
const rules = (JSON.parse(readFileSync(join(DIST, "vercel.json"), "utf8")).headers ?? []).map((rule) => ({ fits: new RegExp(`^${rule.source}$`), headers: Object.fromEntries(rule.headers.filter((h) => !/strict-transport|cache-control/i.test(h.key)).map((h) => [h.key, h.value])) }));
const headersFor = (path) => Object.assign({}, ...rules.filter((rule) => rule.fits.test(path)).map((rule) => rule.headers));
/** The stand-in sign-in address: who is signed in, their room pass, and the one change to a world's list, as BitLogin answers it. */
const signerPage = `<!doctype html><meta charset="utf-8"><title>stand-in signer</title><script>
const WORLD = ${JSON.stringify(WORLD)};
const ANSWERS = ${JSON.stringify(answers)};
let who = null;
window.__did = [];
const say = (m) => parent.postMessage({ nswp: "nswp-signer", v: 1, ...m }, WORLD);
const state = (id) => say({ t: "state", ...(id ? { id } : {}), unlocked: !!who, ...(who ? { pubkey: who, name: "Trial visitor", remembered: true } : {}) });
addEventListener("message", async (e) => {
  const d = e.data;
  if (e.origin !== WORLD || !d || d.nswp !== "nswp-signer") return;
  if (d.t === "state") return state(d.id);
  if (d.t === "have") return say({ t: "none", id: d.id });
  if (d.t === "pass" && who) return say({ t: "signed", id: d.id, event: JSON.parse(await window.__trialPass(d.session)) });
  if (d.t === "guests" && who) {
    void window.__trialAsked(JSON.stringify({ world: d.world, change: d.change, key: d.key, list: d.list && d.list.id, none: !!d.none }));
    window.__did.push("asked " + d.id);
    try {
      say({ t: "asking", id: d.id });
      window.__did.push("said asking");
      const a = ANSWERS[d.change + ":" + d.key];
      const fits = a && (a.list === null ? d.list === null && d.none === true : d.list && d.list.id === a.list);
      window.__did.push("fits " + !!fits);
      // A person takes a moment to press Yes: answered after it, as BitLogin's page is. (Answered in the same instant
      // as "asking", the scripted browser now and then lost the answer: the world's page opens the sign-in window on
      // "asking", and a message posted to it at that moment didn't arrive. BitLogin answers only at a press.)
      await new Promise((done) => setTimeout(done, Number(${JSON.stringify(process.env.ANSWER_MS ?? "2000")})));
      say(fits ? { t: "signed", id: d.id, event: a.event } : { t: "refused", id: d.id });
      window.__did.push("said answer");
    } catch (err) {
      window.__did.push("threw " + String(err));
    }
    return;
  }
});
window.__trialWho().then((w) => { who = w; say({ t: "ready" }); });
</script>`;
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const refused = new Set();
const errors = [];
const asked = [];
mkdirSync(SHOTS, { recursive: true });

async function visitor(who) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 720 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: WORLD }).catch(() => undefined);
  await ctx.grantPermissions(["local-network-access"]).catch(() => undefined);
  await ctx.exposeFunction("__trialWho", () => (who ? pub[who] : null));
  await ctx.exposeFunction("__trialPass", (session) => JSON.stringify(finalizeEvent(buildRoomPass({ session, origin: WORLD, name: names[who], createdAt: Math.floor(Date.now() / 1000) }), people[who])));
  await ctx.exposeFunction("__trialAsked", (said) => void asked.push(JSON.parse(said)));
  await ctx.addInitScript(() => {
    window.__nswpTrial = { gate: true };
    // What the page hears from the sign-in address, for a trial that stops to read: the kind and id of each.
    window.__heard = [];
    addEventListener("message", (e) => { const d = e.data; if (window.top !== window) return; if (d && d.nswp === "nswp-signer") window.__heard.push(`${d.t}${d.id ? ` ${d.id}` : ""} from ${e.origin}`); else window.__heard.push(`other: ${String(e.origin)} ${typeof d === "object" ? Object.keys(d ?? {}).slice(0, 4).join(",") : String(d).slice(0, 30)}`); }, true);
  });
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin === SIGN_IN && url.pathname === "/signer/") return route.fulfill({ status: 200, contentType: TYPES[".html"], body: signerPage });
    if (url.origin === SIGN_IN && url.pathname.startsWith("/connect")) return route.fulfill({ status: 200, contentType: TYPES[".html"], body: "<p>stand-in: the sign-in address's own page" });
    if (url.origin === WORLD) {
      const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
      const headers = { ...headersFor(url.pathname), "access-control-allow-origin": "*" };
      if (url.pathname === "/.well-known/nswp.json") return route.fulfill({ status: 200, contentType: TYPES[".json"], headers, body: manifest });
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
  // The sign-in address's own window opens as a page of its own, and the world's page goes to the back, where a
  // browser slows it and its frames: the stand-in's answer then took more than half a minute. The stand-in's window
  // has nothing to press, so the world's page is brought straight back to the front, as a person returns to it.
  ctx.on("page", (opened) => { if (opened !== page) void page.bringToFront().catch(() => undefined); });
  if (process.env.DIAG === "1") {
    r[`${who} diag`] = [];
    page.on("console", (m) => r[`${who} diag`].length < 30 && r[`${who} diag`].push(`${m.type()}: ${m.text().slice(0, 200)}`));
    ctx.on("page", (p) => r[`${who} diag`].push(`popup: ${p.url()}`));
  }
  page.on("pageerror", (e) => errors.push(`${who}: ${String(e).slice(0, 200)}`));
  const until = async (fn, ms = 60000, every = 300) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(every); } return null; };
  const arrive = async () => {
    await page.goto(`${WORLD}/`, { timeout: 180000 });
    // Ready means the gate has read the lists from the relay: a busy machine is given time. A gate that heard no
    // relay rightly changes nothing, so the trial waits for one that has.
    await until(() => page.evaluate(() => { const g = window.__nswpTest?.state?.ready === true ? window.__nswpTest.gate?.() : null; return !!g && g.state !== "checking" && (g.invites === "read" || g.invites === "not-found"); }), 180000);
    await page.evaluate(() => { window.__said = []; window.__nswpTest.controls.onSay((w) => window.__said.push(w)); });
  };
  await arrive();
  const hud = () => page.locator("nswp-hud");
  const section = () => page.evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "guests") ?? null);
  return { ctx, page, until, arrive, hud, section, gate: () => page.evaluate(() => window.__nswpTest.gate()), said: () => page.evaluate(() => window.__said), close: () => ctx.close() };
}

try {
  // ---- Ben, not invited: kept out.
  const ben = await visitor("ben");
  const gb = await ben.gate();
  want("2 Ben, not invited, is kept out", [gb.state, gb.reason], ["shut", "not-invited"]);
  want("3 Ben has no 'Who comes in': it is a keeper's", await ben.section(), null);

  // ---- The keeper: the screen.
  const k = await visitor("keeper");
  const s0 = await k.until(async () => { const s = await k.section(); return s && s.note.startsWith("Anyone") ? s : null; }, 30000);
  want("4 the keeper's console has 'Who comes in', saying anyone can read the list", s0 && [s0.label, s0.note], ["Who comes in", "Anyone can read this list. 1 person invited, 0 people kept out."]);
  // Ben's key, copied, then pressed in: the way a keeper names someone who isn't here.
  await k.page.evaluate((npub) => navigator.clipboard.writeText(npub), encodeNpub(pub.ben));
  await k.page.evaluate(() => window.__nswpTest.hud.setOpen(true, "guests"));
  await k.page.waitForTimeout(400);
  await k.hud().getByRole("button", { name: "Someone whose key I copied" }).click();
  const letIn = k.hud().getByRole("button", { name: /^Let Ben Test in$/ });
  const named = await k.until(() => letIn.isVisible(), 20000);
  want("5 Ben is offered by his own name, from his key", !!named, true);
  await k.page.screenshot({ path: join(SHOTS, "owners-screen-1-offered.png") });
  await letIn.click();
  const done = await k.until(async () => (await k.said()).find((w) => /Invited\. Anyone can read this list\./.test(w)), 90000);
  r.said = await k.said();
  r.heard = await k.page.evaluate(() => window.__heard.filter((h) => !h.startsWith("state")).slice(-16));
  r.frames = await Promise.all(k.page.frames().map(async (f) => [f.url().slice(0, 60), await f.evaluate(() => window.__did ?? null).catch((e) => String(e).slice(0, 80))]));
  want("6 the keeper's sign-in address was asked one change: Ben, onto the list as it stood", asked.filter((a) => a.change).map((a) => [a.change, a.key === pub.ben, a.list === before.id, a.none]), [["allow", true, true, false]]);
  want("7 and the keeper is told: invited, and anyone can read the list", !!done, true);
  const g2 = await k.gate();
  // The gate's count is who the list itself names: Cy and Ben (the keeper is let in by being the keeper).
  want("8 the keeper's gate takes it at once: two invited", g2.invited, 2);
  await k.page.screenshot({ path: join(SHOTS, "owners-screen-2-invited.png") });

  // ---- What the stand-in relay now holds: the new list, by the keeper, naming Ben and Cy.
  const lists = await fromRelay({ kinds: [30078], authors: [KEEPER], "#d": [`nswp:governance:user-allow:v1:${subject}`] });
  const newest = lists.sort((a, b) => b.created_at - a.created_at)[0];
  want("9 the new list is on the relay, and reads: Ben and Cy", newest && ((x) => (x.ok ? x.entries : x.reason))(readOwnerList(newest, { root: [KEEPER] })), [pub.ben, pub.cy].sort());

  // ---- Ben, arriving again: let in.
  await ben.arrive();
  const gb2 = await ben.until(async () => { const g = await ben.gate(); return g.state !== "checking" ? g : null; }, 60000);
  want("10 Ben, arriving again, is let in", [gb2.state, gb2.open], ["open", true]);

  // ---- Blocking: Cy, from the keeper's screen. Blocked beats invited.
  const block = k.hud().getByRole("button", { name: /^Block Cy Test$/ });
  await k.until(() => block.isVisible(), 20000);
  const changes = () => asked.filter((a) => a.change);
  const askedBefore = changes().length;
  await block.click();
  const again = await k.until(async () => (await k.said()).find((w) => /No block list for this world was found\. Press again/.test(w)), 20000);
  want("11 no block list yet: the first press says so, and asks nothing", [!!again, changes().length - askedBefore], [true, 0]);
  await block.click();
  const blocked = await k.until(async () => (await k.said()).find((w) => /Kept out\./.test(w)), 90000);
  want("12 the second press starts one, naming only Cy", [!!blocked, changes().at(-1)?.change, changes().at(-1)?.key === pub.cy, changes().at(-1)?.none], [true, "block", true, true]);
  r.asked = asked;
  await k.page.screenshot({ path: join(SHOTS, "owners-screen-3-blocked.png") });

  for (const v of [ben, k]) await v.close();
  r.refused = [...refused];
  r.errors = errors.slice(0, 6);
  want("13 nothing but this machine was reached, and no page threw", [r.refused, r.errors], [[], []]);
} catch (e) {
  bad.push(`the walk stopped: ${String(e).slice(0, 400)}`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(r, null, 1));
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
