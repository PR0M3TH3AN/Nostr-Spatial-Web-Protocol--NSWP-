// A tip to a person in BitPortal's own room, on the local sites: two visitors, each with a throwaway identity, in the
// local page that keeps the screen. BitLogin's client is a stand-in in each (it says who is signed in, signs with the
// throwaway key, and records what it was asked to tip), and every relay is the stand-in relay on this machine: no
// account is used, nothing real is signed, asked, paid or sent. What this does NOT try is BitLogin's own client and
// page, or any payment.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);
const core = await import(`${NSWP}/packages/core/dist/index.js`);
const { default: WebSocket } = await import(`${NSWP}/node_modules/ws/wrapper.mjs`);
const SHELL = process.env.SHELL_AT ?? `https://${HOST}:4300`;
const RELAY = "ws://127.0.0.1:4313";
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };

const client = (pub, name) => `
export function createBitLoginClient() {
  const st = { signedIn: true, pubkey: ${JSON.stringify(pub)}, name: ${JSON.stringify(name)}, until: Math.floor(Date.now() / 1000) + 86400, canAsk: true };
  const ls = new Set();
  globalThis.__tips = [];
  return {
    ready: async () => st, state: () => st,
    onChange(fn) { ls.add(fn); queueMicrotask(() => fn(st)); return () => ls.delete(fn); },
    signIn: async () => true, switchAccount: async () => true, signOut: async () => {},
    getPublicKey: async () => st.pubkey,
    signEvent: (e) => globalThis.__sign(JSON.stringify(e)).then((s) => JSON.parse(s)),
    nip44: { encrypt: async () => { throw new Error("stand-in"); }, decrypt: async () => { throw new Error("stand-in"); } },
    nip04: { encrypt: async () => { throw new Error("stand-in"); }, decrypt: async () => { throw new Error("stand-in"); } },
    decryptEvent: async () => { throw new Error("stand-in"); },
    propose: async () => null,
    async tip(t, o) { const shown = await o?.show?.(); globalThis.__tips.push({ ...t, shown: !!shown }); return globalThis.__tipGoes === false ? null : {}; },
    destroy() {},
  };
}`;

async function visitor(fill, name) {
  const key = new Uint8Array(32).fill(fill);
  const pub = core.getPublicKey(key);
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 }, permissions: ["microphone"] });
  await ctx.exposeFunction("__sign", (json) => { const e = JSON.parse(json); return JSON.stringify(core.finalizeEvent({ kind: e.kind, content: e.content ?? "", tags: e.tags ?? [], created_at: e.created_at ?? Math.floor(Date.now() / 1000) }, key)); });
  await ctx.route("**/vendor/bitlogin/bitlogin-client.js", (route) => route.fulfill({ contentType: "text/javascript", body: client(pub, name) }));
  // Every relay is the one on this machine.
  await ctx.routeWebSocket(/^wss:\/\//, (ws) => {
    const up = new WebSocket(RELAY);
    const waiting = [];
    up.on("open", () => { for (const m of waiting.splice(0)) up.send(m); });
    up.on("message", (m) => { try { ws.send(String(m)); } catch { /* gone */ } });
    up.on("error", () => {});
    ws.onMessage((m) => (up.readyState === 1 ? up.send(m) : waiting.push(m)));
    ws.onClose(() => up.close());
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${SHELL}/shell/`);
  const frame = () => page.frames().find((f) => f.parentFrame() === page.mainFrame() && /\/walk\//.test(f.url()));
  const until = async (fn, ms = 90000) => { const end = Date.now() + ms; while (Date.now() < end) { try { const g = await fn(); if (g) return g; } catch { /* not yet */ } await page.waitForTimeout(400); } return null; };
  await until(() => frame()?.evaluate(() => window.__bitportalTest?.state?.ready === true && !!window.__bitportalTest.controls));
  const items = () => frame().evaluate(() => window.__bitportalTest.controls.view().sections.flatMap((s) => s.items.map((i) => ({ id: i.id, label: i.label, section: s.id }))));
  const run = (id) => frame().evaluate((x) => window.__bitportalTest.controls.run(x), id);
  const join = await until(async () => (await items()).find((i) => i.label === "Join the room"), 20000);
  if (join) await run(join.id);
  await until(async () => (await items()).some((i) => /^Leave the room/.test(i.label)), 30000);
  return { key, pub, name, page, frame, until, items, run, errors, ctx };
}

const a = await visitor(21, "Ada Test");
const b = await visitor(22, "Ben Test");
r.room = await a.frame().evaluate(() => window.__bitportalTest.roomInfo());
r.allA = (await a.items()).map((i) => `${i.section}: ${i.label}`);
r.stateA = await a.frame().evaluate(() => window.__bitportalTest.state.room);
if (process.env.LOOK) { console.log(JSON.stringify(r, null, 1)); await browser.close(); process.exit(0); }
// Each sees the other, come by name.
const seen = async (me, them) => me.until(async () => (await me.frame().evaluate(() => window.__bitportalTest.roomInfo())).find?.((m) => m.identity === them.pub || m.name === them.name), 60000);
const benAtAda = await seen(a, b);
r.benAtAda = benAtAda ?? (await a.frame().evaluate(() => window.__bitportalTest.roomInfo()));
r.itemsA = (await a.items()).filter((i) => /Ben|people|tip/i.test(i.label + i.section)).slice(0, 12);
want("1 Ada sees Ben, come by name", !!benAtAda && benAtAda.identity === b.pub, true);
if (benAtAda) {
  const row = await a.until(async () => (await a.items()).find((i) => /^person-[0-9a-f]+$/.test(i.id)), 15000);
  const WHO = row?.label;
  r.benIsCalled = WHO;
  if (!row) { r.peopleRows = (await a.items()).filter((i) => !/^(figure|doors|look|sound|bag|travel|view|moving|camera|panels)$/.test(i.section)); r.benAtAda = benAtAda; console.log(JSON.stringify(r, null, 1)); await browser.close(); process.exit(1); }
  await a.run(row.id);
  await a.page.waitForTimeout(600);
  const tipRow = await a.until(async () => (await a.items()).find((i) => i.label === `Send ${WHO} a tip`), 10000);
  want("2 Ben's card offers a tip", !!tipRow, true);
  await a.run(tipRow.id);
  await a.page.waitForTimeout(400);
  const amounts = (await a.items()).filter((i) => i.label.endsWith(` sats to ${WHO}`));
  want("3 three amounts and no more, with nowhere to type one", amounts.map((i) => i.label), [21, 100, 500].map((n) => `${n} sats to ${WHO}`));
  await a.run(amounts[1].id);
  const asked = await a.until(() => a.frame().evaluate(() => (globalThis.__tips.length ? globalThis.__tips : null)), 10000);
  want("4 BitLogin's client is asked: Ben's key and the amount, nothing else", asked, [{ to: b.pub, sats: 100, shown: asked?.[0]?.shown ?? false }]);
  r.shownInPanel = asked?.[0]?.shown;
  const said = await a.until(() => a.frame().evaluate((w) => { const t = document.querySelector("nswp-hud")?.shadowRoot?.textContent ?? ""; return t.includes(w) ? w : null; }, `100 sats went to ${WHO}.`), 10000);
  want("5 and the room says it went", said, `100 sats went to ${WHO}.`);
  // Told no: the room says it didn't go, and nothing else changes.
  await a.frame().evaluate(() => { globalThis.__tipGoes = false; });
  await a.run((await a.items()).find((i) => i.label === `Send ${WHO} a tip`).id);
  await a.page.waitForTimeout(300);
  await a.run((await a.items()).find((i) => i.label === `21 sats to ${WHO}`).id);
  const not = await a.until(() => a.frame().evaluate((w) => { const t = document.querySelector("nswp-hud")?.shadowRoot?.textContent ?? ""; return t.includes(w) ? "said" : null; }, `The tip to ${WHO} didn't go.`), 10000);
  want("6 a no is said as a no", not, "said");
  want("7 no row to tip the room itself", (await a.items()).some((i) => /Tip this world/.test(i.label)), false);
  await a.page.screenshot({ path: `${SHOTS}/room-tip.png` });
}
r.errors = [...a.errors, ...b.errors].slice(0, 5);
console.log(JSON.stringify(r, null, 1));
await browser.close();
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
