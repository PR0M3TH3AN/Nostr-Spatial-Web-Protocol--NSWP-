// The trial itself. Signed out, it shows what a world is told with nobody signed in. With SIGN_IN=<a module whose
// default export is `async (t) => {...}`> it signs someone in on BitLogin's local copy first (that step belongs to
// whoever may do it: this file makes no account), then buys the listing and checks what the world is handed.
import { open, SANDBOX, SANDBOX_KEY } from "./buy-screen.mjs";
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const { readReceipt } = await import(`${NSWP}/packages/core/dist/index.js`);
// The listing to buy: LISTING, or the one `sandbox-buy.mjs` last left registered at the sandbox.
const { existsSync, readFileSync } = await import("node:fs");
const LISTING = process.env.LISTING ?? (existsSync(`${SHOTS}/sandbox-listing.json`) ? JSON.parse(readFileSync(`${SHOTS}/sandbox-listing.json`, "utf8")).listing : "");
if (!LISTING) throw new Error("No listing to buy. Run trials/sandbox-buy.mjs first, or give LISTING=<its coordinate>.");
const ISSUERS = [{ name: "BitUnlock sandbox (this machine)", service: SANDBOX, pubkey: SANDBOX_KEY }];
const t = await open();
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
await t.until(async () => (await t.rows()).length > 0, 40000);
want("0 the world's test hook hands over its signer", await t.frame().evaluate(() => typeof window.__nswpTest.signer()?.buy), "function");
const signIn = process.env.SIGN_IN ? (await import(process.env.SIGN_IN)).default : null;
if (!signIn) {
  r.signer = await t.ask("have", LISTING);
  want("1 signed out, the world is told nothing is held", await t.until(async () => { const a = await t.answer("have"); return a === "waiting" ? null : { got: a }; }, 15000), { got: null });
} else {
  await signIn(t);
  r.signer = await t.ask("have", LISTING);
  r.heldBefore = await t.until(async () => { const a = await t.answer("have"); return a === "waiting" ? null : { got: a }; }, 15000);
  await t.frame().evaluate(() => window.__nswpTest.hud.setOpen(true, "you"));
  await t.page.waitForTimeout(400);
  // A purchase is asked for at a press, as a world's own control would.
  await t.page.frameLocator("#view").locator("nswp-hud").getByRole("button").first().hover().catch(() => null);
  await t.ask("buy", LISTING);
  await t.until(async () => { const p = await t.panelBox(); return p && !p.waiting ? p : null; }, 15000);
  await t.page.waitForTimeout(2500);
  r.buyScreen = await t.says();
  await t.shot("buy-screen-2-asked");
  if (process.env.PRESS) {
    await t.panelFrame().getByRole("button", { name: new RegExp(process.env.PRESS, "i") }).first().click({ timeout: 90000 });
    const got = await t.until(async () => { const a = await t.answer("buy"); return a === "waiting" ? null : { got: a }; }, 90000);
    r.after = await t.says();
    await t.shot("buy-screen-3-after");
    // The kit's `buy` answers with what it read from the receipt, the receipt itself as `event`, and what was
    // delivered. It answers at all only if its own check passed (it does not believe the word "bought").
    r.bought = got?.got ? { listing: got.got.listing, buyer: got.got.buyer, seller: got.got.seller, expiresAt: got.got.expiresAt, issuer: got.got.issuer?.name, delivery: typeof got.got.delivery } : got;
    const check = got?.got?.event ? readReceipt(got.got.event, { listing: LISTING, now: Math.floor(Date.now() / 1000), issuers: ISSUERS }) : null;
    r.check = check?.ok ? "ok" : (check?.why ?? "nothing to check");
    want("2 the world is handed a receipt the kit believes (told of the sandbox)", [!!got?.got, got?.got?.listing === LISTING, check?.ok ?? false], [true, true, true]);
    await t.ask("have", LISTING);
    const held = await t.until(async () => { const a = await t.answer("have"); return a === "waiting" ? null : { got: a }; }, 15000);
    want("3 and asked again, it is held", !!held?.got?.event && readReceipt(held.got.event, { listing: LISTING, issuers: ISSUERS }).ok, true);
  }
}
r.refused = [...t.refused];
r.errors = t.errors.slice(0, 6);
console.log(JSON.stringify(r, null, 1));
await t.browser.close();
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
