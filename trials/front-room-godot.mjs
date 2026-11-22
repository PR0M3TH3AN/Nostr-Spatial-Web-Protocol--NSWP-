// The front room in a world made in another engine, walked on this machine: the Godot example (The Foundry) with
// its gate switched on in the scripted browser only. The same walk as front-room.mjs, as far as it goes: a visitor
// who holds nothing is stopped at the gate, buys from BitUnlock's sandbox with pretend sats, and walks past; the
// kit as shipped refuses the sandbox's receipt; another visitor is kept out; the pass runs out.
//
// What is real here: this checkout's own export of the Godot example (engines/godot/dist, so run
// `npm run build:godot` first, which needs Godot), the kit's own script inside it (the gate is the kit's, not
// Godot's), the add-on's `Nswp.gate`, and the example's own gate: something solid across the way while it is shut.
// What is a stand-in: the sign-in address and relays, as in front-room.mjs. BitLogin's own screen is NOT tried.
// What can't be checked here: the engine's sound. Its audio worklets are fetched past the scripted browser's
// interception, and nothing listens at this trial's address, so check 18 is reported as not run here, with why.
// Served for real (the local sites service), the Foundry loads them with no error.
//
// Nothing leaves this machine (front-room-lib.mjs), and nothing on disk is changed: The Foundry is not made paid.
// Needs: the sandbox at https://<this machine>:4312, and NODE_EXTRA_CA_CERTS set
// (`npm run trial -- trials/front-room-godot.mjs`). The engine is about forty megabytes: give it a few minutes.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
import { begin, finish, SIGN_IN, TERM } from "./front-room-lib.mjs";
const { readReceipt } = await import(`${NSWP}/packages/core/dist/index.js`);
const { mkdirSync } = await import("node:fs");
const { join } = await import("node:path");

const t = await begin({ dist: join(NSWP, "engines", "godot", "dist"), world: `https://${HOST}:4398` });
const { r, bad, want, A, B, LISTING, ISSUERS, held, asked, statusAsked } = t;

/** A visit to the Godot world: read through the kit's own script (`NSWP`), and through what the example says of itself. */
async function visit(opts = {}) {
  const v = await t.visit({ viewport: { width: 960, height: 600 }, ...opts });
  const { page, until } = v;
  /**
   * What the kit's script says of the gate, and what the example world has done about it. The kit's script is asked
   * only once the world is up and has begun its own gate: asking sooner would begin one, which is the world's to do.
   */
  const gate = () => page.evaluate(() => { const said = JSON.parse(window.nswpExample ?? "{}"); return said.gate ? { ...JSON.parse(window.NSWP.gate()), veil: said.veil, world: said.gate.state, at: said.at } : { state: "checking", offers: [], why: "", at: null, world: null }; });
  await page.goto(`${t.world}/`);
  // Ready means the engine is up, the gate has made up its mind and has read what is for sale (or found it can't
  // be offered), and the world has heard: its own gate stands as the kit's says.
  const up = await until(async () => { const g = await gate(); return g.at && g.state !== "checking" && g.world === g.state && (g.offers.length > 0 || /isn't offered|can't be bought/.test(g.why)) ? g : null; }, 300000, 500);
  if (!up) throw new Error(`The Godot world didn't come up with a gate: ${JSON.stringify(await gate().catch((e) => String(e))).slice(0, 300)}`);
  const rows = () => page.evaluate(() => JSON.parse(window.NSWP.view()).sections.find((s) => s.id === "travel")?.items.filter((i) => i.id.startsWith("gate-")).map((i) => i.label) ?? []);
  const press = () => v.pressRow(() => page.evaluate(() => window.NSWP.open(true)), () => page.evaluate(() => window.NSWP.open(false)));
  /** Walk straight ahead with the key a visitor would hold, until they are past the gate or have stood still a good while. Where they end up. */
  const walkAtIt = async () => {
    await v.toFront();
    await page.evaluate(() => { window.NSWP.open(false); document.querySelector("canvas")?.focus(); });
    const samples = [];
    let still = 0;
    await page.keyboard.down("KeyW");
    try {
      for (let i = 0; i < 240; i++) {
        await page.waitForTimeout(500);
        const z = (await gate()).at[1];
        still = samples.length && Math.abs(z - samples.at(-1)) < 0.01 ? still + 1 : 0;
        samples.push(z);
        if (z < -1.5) break;
        // Stood still a good while after having moved: stopped. Never moved at all: the keys aren't reaching it yet.
        if (still >= 12 && Math.abs(z - samples[0]) > 0.05) break;
        if (still >= 12 && i % 24 === 23) { await page.keyboard.up("KeyW"); await page.evaluate(() => document.querySelector("canvas")?.focus()); await page.keyboard.down("KeyW"); }
      }
    } finally {
      await page.keyboard.up("KeyW");
    }
    (r.walks ??= []).push({ from: samples[0], to: samples.at(-1), samples: samples.length });
    return samples.at(-1);
  };
  return { ...v, gate, rows, press, walkAtIt };
}

try {
  mkdirSync(SHOTS, { recursive: true });
  // ---- 1. A visitor who isn't signed in, and holds nothing.
  const v = await visit();
  const first = await v.gate();
  want("4 shut for someone not signed in, with what is for sale, and the world's own gate standing", [first.state, first.open, first.reason, first.offers, first.veil], ["shut", false, "signed-out", [{ listing: LISTING, name: "TEST: an hour past the gate", sats: 500, term: TERM, words: "500 sats, for 1 hour" }], true]);
  want("4b it says why in plain words", first.why, "Past here is for people who have bought it: TEST: an hour past the gate, 500 sats, for 1 hour. Sign in to buy, or to show what you already hold.");
  want("4c one control in the kit's menu, which offers sign-in first", await v.rows(), ["Sign in to buy TEST: an hour past the gate: 500 sats, for 1 hour"]);
  const stopped = await v.walkAtIt();
  want("5 nobody walks past it: they walked, and it stopped them there", [stopped > 0, stopped < 3.5], [true, true]);
  await v.page.screenshot({ path: `${SHOTS}/front-room-godot-1-shut.png` });
  await v.press();
  await v.until(() => v.popups.length > 0, 8000);
  want("6 pressed while signed out: the sign-in address's own window, and nothing asked to be bought", [v.popups.map((u) => new URL(u).origin + new URL(u).pathname), asked.length], [[`${SIGN_IN}/connect/`], 0]);
  // ---- 2. They sign in (the stand-in says so), still holding nothing.
  await v.signIn(A);
  await v.until(async () => (await v.gate()).reason === "nothing-held", 15000);
  want("7 signed in and holding nothing: still shut, and the same control now buys", [(await v.gate()).state, await v.rows()], ["shut", ["Buy TEST: an hour past the gate: 500 sats, for 1 hour"]]);
  // ---- 3. They press Buy. The stand-in buys from the sandbox; the kit checks what comes back.
  await v.press();
  await v.until(async () => { const g = await v.gate(); return g.state === "open" && g.world === "open"; }, 60000);
  const bought = held.get(`${A}|${LISTING}`);
  const check = bought ? readReceipt(bought, { listing: LISTING, buyer: A, issuers: ISSUERS }) : null;
  const open = await v.gate();
  want("8 bought: the sandbox signed a receipt, the gate opened on it, and the world's own gate is gone", [asked.length, r.lastPurchase, check?.ok ?? false, open.state, open.until === (check?.ok ? check.receipt.expiresAt : -1), open.veil, await v.rows()], [1, { quote: 201, parts: ["bitunlock:10", "seller:490"], unlock: 200 }, true, "open", true, false, []]);
  want("9 and now they walk past it", (await v.walkAtIt()) < -1.5, true);
  await v.page.screenshot({ path: `${SHOTS}/front-room-godot-2-open.png` });
  r.takenBackAsked = statusAsked.slice(0, 2);
  await v.close();

  // ---- 4. The kit as shipped: the same receipt, in a browser that was not told of the sandbox.
  const shipped = await visit({ who: A, believe: false });
  const strict = await shipped.gate();
  want("12 the kit as shipped opens nothing on a sandbox's receipt, and offers nothing sold through a sandbox", [strict.state, strict.offers, /can't take a receipt from/.test(strict.why), strict.veil], ["shut", [], true, true]);
  await shipped.close();

  // ---- 5. Somebody else, whose sign-in address hands over the first visitor's receipt.
  const other = await visit({ who: B, hands: bought });
  const theirs = await other.gate();
  want("13 another visitor is not let in on the first one's receipt", [theirs.state, theirs.reason, theirs.veil], ["shut", "nothing-held", true]);
  want("13b and can't walk past", (await other.walkAtIt()) > 0, true);
  await other.close();

  // ---- 6. The pass runs out with the visitor inside. This page's clock is moved on; nothing is loaded again.
  const late = await visit({ who: A, clock: true });
  want("14 inside, with an hour's pass", [(await late.gate()).state, (await late.walkAtIt()) < -1.5], ["open", true]);
  await late.page.evaluate(() => { window.__sameVisit = true; });
  await late.page.clock.fastForward((TERM + 5) * 1000);
  await late.until(async () => (await late.gate()).state === "ending", 30000);
  const ending = await late.gate();
  want("15 at its end: a couple of minutes, with the gate still open and the control to buy again back", [ending.state, ending.open, ending.veil, await late.rows()], ["ending", true, false, ["Buy TEST: an hour past the gate: 500 sats, for 1 hour"]]);
  await late.page.clock.fastForward(121 * 1000);
  await late.until(async () => { const g = await late.gate(); return g.state === "shut" && g.world === "shut" && g.at[1] > 0; }, 30000);
  const closed = await late.gate();
  want("16 then shut, the world's gate back, and they are stood before it again, in the same visit", [closed.state, closed.reason, closed.veil, closed.at[1] > 0, await late.page.evaluate(() => window.__sameVisit === true)], ["shut", "run-out", true, true, true]);
  await late.close();

  r.refused = [...t.refused];
  r.errors = t.errors.slice(0, 6);
  want("17 nothing but this machine was reached, and no page threw", [r.refused, r.errors], [[], []]);
  // The engine's sound: a check this trial keeps, and can't run (see `workletCheck` in front-room-lib.mjs).
  t.workletCheck("18 the engine's audio worklets load");
} catch (e) {
  // Whatever stopped the walk is said with what it had found, not instead of it.
  bad.push(`the walk stopped: ${String(e).slice(0, 400)}`);
} finally {
  await t.browser.close();
}
finish(t);
