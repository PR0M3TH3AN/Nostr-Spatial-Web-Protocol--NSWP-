// The front room of a paid world, walked on this machine: a copy of the Gallery with its gate switched on in the
// scripted browser only, a visitor who holds nothing, a purchase from BitUnlock's sandbox with pretend sats, the gate
// opening on the receipt, and the pass running out with the visitor inside.
//
// What is real here: this checkout's own build of the Gallery (sites/gallery/dist, so run `npm run build` first),
// the kit's gate inside it, and BitUnlock's sandbox, which signs a real receipt for a pretend payment.
//
// What is a stand-in: the visitor's sign-in address. The world names bitlogin.network, and in this browser that
// address is answered by a page of this script's, which says who is signed in and, asked to buy, has this script
// buy from the sandbox with a throwaway key. BitLogin's own screen is NOT tried here: `buy-screen-run.mjs` tries
// that. Relays are stood in for too: the one listing is handed to the page by this script.
//
// Nothing leaves this machine (front-room-lib.mjs). Nothing on disk is changed: the Gallery is not made paid, here
// or anywhere. Needs: the sandbox at https://<this machine>:4312, and NODE_EXTRA_CA_CERTS set
// (`npm run trial -- trials/front-room.mjs`).
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
import { begin, finish, SIGN_IN, TERM } from "./front-room-lib.mjs";
const { readReceipt } = await import(`${NSWP}/packages/core/dist/index.js`);
const { mkdirSync } = await import("node:fs");
const { join } = await import("node:path");

// Nothing listens here: the scripted browser is handed this checkout's own build at this address.
const t = await begin({ dist: join(NSWP, "sites", "gallery", "dist"), world: `https://${HOST}:4399` });
const { r, bad, want, A, B, LISTING, ISSUERS, held, asked, statusAsked } = t;

/** A visit to the Gallery, with how this world is read and walked: its own test hook. */
async function visit(opts = {}) {
  const v = await t.visit(opts);
  const { page, until } = v;
  /** Open the world; or, `again`, refresh it as a visitor would (a refresh puts them back where they stood). */
  const load = async (again = false) => {
    if (again) {
      // Long enough for the world to have noted where they stand, which it does every second.
      await page.waitForTimeout(1500);
      await page.reload();
    } else await page.goto(`${t.world}/`);
    // Ready means the gate has made up its mind and has read what is for sale. On a busy machine the first asking of
    // relays can run out of time; the gate asks again by itself twenty seconds on, so this waits for that.
    await until(() => page.evaluate(() => { const g = window.__nswpTest?.state?.ready === true ? window.__nswpTest.gate?.() : null; return !!g && g.state !== "checking" && (g.offers.length > 0 || Object.values(g.unread).some((why) => why !== "no-relay" && why !== "not-found")); }), 120000);
    // What the world says from here on is kept.
    await page.evaluate(() => { window.__said = []; window.__nswpTest.controls.onSay((words) => window.__said.push(words)); });
  };
  await load();
  const gate = () => page.evaluate(() => { const g = window.__nswpTest.gate(); return g && { state: g.state, open: g.open, reason: g.reason, why: g.why, offers: g.offers, unread: g.unread, until: g.until, signedIn: g.signedIn }; });
  const rows = () => page.evaluate(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "travel")?.items.filter((i) => i.id.startsWith("gate-")).map((i) => i.label) ?? []);
  const said = () => page.evaluate(() => window.__said ?? []);
  const press = () => v.pressRow(() => page.evaluate(() => window.__nswpTest.hud.setOpen(true, "travel")), () => page.evaluate(() => window.__nswpTest.hud.setOpen(false)));
  /** Stand just before the gate and walk at it, as a press on the floor past it would. Where they end up, along the hall. */
  const walkAtIt = async () => {
    await v.toFront();
    const start = () => page.evaluate(() => { const h = window.__nswpTest; h.teleport(0, 1.5); h.face(0); h.step(0, -3.5); });
    await start();
    // A walk is drawn frame by frame, at whatever pace this machine manages, so nothing here goes by the clock
    // alone: it is watched until they are past, or have moved and then stood still a good while. A page that had
    // been behind a window may take a moment to draw again, so a walk that never began is asked for once more.
    const samples = [];
    let still = 0;
    let tries = 1;
    for (let i = 0; i < 160; i++) {
      await page.waitForTimeout(500);
      const z = await page.evaluate(() => window.__nswpTest.where()[1]);
      still = samples.length && Math.abs(z - samples.at(-1)) < 0.01 ? still + 1 : 0;
      samples.push(z);
      if (z < -1) break;
      const moved = Math.abs(z - 1.5) > 0.05;
      if (moved && still >= 12) break;
      if (!moved && still >= 12 && tries < 4) { tries++; still = 0; await page.bringToFront(); await start(); }
      if (!moved && still >= 12 && tries >= 4) break;
    }
    (r.walks ??= []).push({ tries, to: samples.at(-1), samples: samples.length });
    return samples.at(-1);
  };
  return { ...v, load, gate, rows, said, press, walkAtIt };
}

try {
  mkdirSync(SHOTS, { recursive: true });
  // ---- 1. A visitor who isn't signed in, and holds nothing.
  const v = await visit();
  const first = await v.gate();
  want("4 shut for someone not signed in, with what is for sale read from the seller's listing", [first.state, first.open, first.reason, first.offers], ["shut", false, "signed-out", [{ listing: LISTING, name: "TEST: an hour past the gate", sats: 500, term: TERM, words: "500 sats, for 1 hour" }]]);
  want("4b it says why in plain words", first.why, "Past here is for people who have bought it: TEST: an hour past the gate, 500 sats, for 1 hour. Sign in to buy, or to show what you already hold.");
  want("4c one control, which offers sign-in first", await v.rows(), ["Sign in to buy TEST: an hour past the gate: 500 sats, for 1 hour"]);
  want("5 nobody walks past it: everything before it is free, and it stops them there", (await v.walkAtIt()) >= 0, true);
  r.stoppedAt = await v.page.evaluate(() => window.__nswpTest.where());
  await v.page.screenshot({ path: `${SHOTS}/front-room-1-shut.png` });
  await v.page.setViewportSize({ width: 390, height: 780 });
  await v.page.evaluate(() => window.__nswpTest.hud.setOpen(true, "travel"));
  await v.page.waitForTimeout(500);
  await v.page.screenshot({ path: `${SHOTS}/front-room-1b-shut-phone-menu.png` });
  await v.page.evaluate(() => window.__nswpTest.hud.setOpen(false));
  await v.page.setViewportSize({ width: 1280, height: 800 });
  await v.press();
  await v.until(() => v.popups.length > 0, 8000);
  want("6 pressed while signed out: the sign-in address's own window, and nothing asked to be bought", [v.popups.map((u) => new URL(u).origin + new URL(u).pathname), asked.length], [[`${SIGN_IN}/connect/`], 0]);
  // ---- 2. They sign in (the stand-in says so), still holding nothing.
  await v.signIn(A);
  await v.until(async () => (await v.gate()).reason === "nothing-held", 15000);
  want("7 signed in and holding nothing: still shut, and the same control now buys", [(await v.gate()).state, await v.rows()], ["shut", ["Buy TEST: an hour past the gate: 500 sats, for 1 hour"]]);
  // ---- 3. They press Buy. The stand-in buys from the sandbox; the kit checks what comes back.
  await v.press();
  await v.until(async () => (await v.gate()).state === "open", 60000);
  const bought = held.get(`${A}|${LISTING}`);
  const check = bought ? readReceipt(bought, { listing: LISTING, buyer: A, issuers: ISSUERS }) : null;
  const open = await v.gate();
  want("8 bought: the sandbox signed a receipt, and the gate opened on it", [asked.length, r.lastPurchase, check?.ok ?? false, open.state, open.until === (check?.ok ? check.receipt.expiresAt : -1)], [1, { quote: 201, parts: ["bitunlock:10", "seller:490"], unlock: 200 }, true, "open", true]);
  want("8b the kit as shipped would not believe that receipt", bought ? readReceipt(bought, { listing: LISTING, buyer: A }) : null, { ok: false, why: "unknown-issuer" });
  want("8c it says so, and the control is gone", [(await v.said()).some((words) => /^Bought: TEST: an hour past the gate\. The way is open until /.test(words)), await v.rows()], [true, []]);
  want("9 and now they walk past it", (await v.walkAtIt()) < -1, true);
  await v.page.screenshot({ path: `${SHOTS}/front-room-2-open.png` });
  // ---- 4. The page refreshed: the sign-in address still holds the receipt, so it opens with nothing pressed.
  await v.load(true);
  const back = await v.gate();
  want("10 the page refreshed, signed in: open at once, nothing to press, and they are where they stood, past the gate", [back.state, await v.rows(), (await v.page.evaluate(() => window.__nswpTest.where()[1])) < -1], ["open", [], true]);
  r.takenBackAsked = statusAsked.slice(0, 3);
  want("11 the sandbox was asked whether the receipt was taken back, and answered", statusAsked.length > 0 && statusAsked.every((s) => s.status === 200), true);
  await v.close();

  // ---- 5. The kit as shipped: the same receipt, in a browser that was not told of the sandbox.
  const shipped = await visit({ who: A, believe: false });
  const strict = await shipped.gate();
  want("12 the kit as shipped opens nothing on a sandbox's receipt, and offers nothing sold through a sandbox", [strict.state, strict.offers, strict.unread[LISTING]], ["shut", [], "unknown-service"]);
  await shipped.close();

  // ---- 6. Somebody else, whose sign-in address hands over the first visitor's receipt.
  const other = await visit({ who: B, hands: bought });
  const theirs = await other.gate();
  want("13 another visitor is not let in on the first one's receipt", [theirs.state, theirs.reason], ["shut", "nothing-held"]);
  want("13b and can't walk past", (await other.walkAtIt()) >= 0, true);
  await other.close();

  // ---- 7. The pass runs out with the visitor inside. This page's clock is moved on; nothing is loaded again.
  const late = await visit({ who: A, clock: true });
  want("14 inside, with an hour's pass", [(await late.gate()).state, (await late.walkAtIt()) < -1], ["open", true]);
  await late.page.evaluate(() => { window.__sameVisit = true; });
  await late.page.clock.fastForward((TERM + 5) * 1000);
  await late.until(async () => (await late.gate()).state === "ending", 20000);
  const ending = await late.gate();
  want("15 at its end: a notice, and a couple of minutes", [ending.state, ending.open, (await late.said()).includes("Your time here has run out. This part closes in two minutes. Buy again to stay.")], ["ending", true, true]);
  want("15b the control to buy again is back", await late.rows(), ["Buy TEST: an hour past the gate: 500 sats, for 1 hour"]);
  await late.page.clock.fastForward(121 * 1000);
  await late.until(async () => (await late.gate()).state === "shut", 20000);
  const closed = await late.gate();
  const where = await late.page.evaluate(() => window.__nswpTest.where());
  want("16 then shut, and they are stood before the gate again, in the same visit", [closed.state, closed.reason, where[1] > 0, await late.page.evaluate(() => window.__sameVisit === true)], ["shut", "run-out", true, true]);
  await late.close();

  r.refused = [...t.refused];
  r.errors = t.errors.slice(0, 6);
  want("17 nothing but this machine was reached, and no page threw", [r.refused, r.errors], [[], []]);
  t.workletCheck("18 any audio worklet the page uses loads");
} catch (e) {
  // Whatever stopped the walk is said with what it had found, not instead of it.
  bad.push(`the walk stopped: ${String(e).slice(0, 300)}`);
} finally {
  await t.browser.close();
}
finish(t);
