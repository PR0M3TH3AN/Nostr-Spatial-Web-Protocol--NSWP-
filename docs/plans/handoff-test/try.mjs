// The hand-off, tried: a world opens the client's small window; the window gives the session to the client's own
// hidden signer in the world, and to nothing else.
// Run from the repository root, with the two sites up (node docs/plans/handoff-test/serve.mjs).
const pw = await import("../../../node_modules/playwright-core/index.mjs");
const which = process.argv[2] ?? "chrome";
// Playwright switches the walls between sites' storage off by default. Real browsers have them on, so here they are on.
const OFF = ["AvoidUnnecessaryBeforeUnloadCheckSync", "DestroyProfileOnBrowserClose", "HttpsUpgrades", "HttpsFirstBalancedModeAutoEnable", "LensOverlay", "MediaRouter", "PaintHolding", "ThirdPartyStoragePartitioning", "AvoidCorsURLLoaderRestartOnRedirect", "TcpPortRandomizationWin", "OptimizationHints", "NetworkTimeServiceQuerying", "AimEnabled", "PreconnectToSearch", "msForceBrowserSignIn", "msEdgeUpdateLaunchServicesPreferredVersion"];
const browser =
  which === "firefox"
    ? await pw.firefox.launch({ headless: true, executablePath: process.argv[3] })
    : await pw.chromium.launch({
        ...(which === "brave" ? { executablePath: process.argv[3] } : { channel: which }),
        headless: true,
        ignoreDefaultArgs: [`--disable-features=${OFF.join(",")}`],
        args: [`--disable-features=${OFF.filter((f) => f !== "ThirdPartyStoragePartitioning").join(",")}`],
      });
const CLIENT = "http://127.0.0.1:4391";
const WORLD = "http://localhost:4392";
const r = { browser: which, version: browser.version() };
const context = await browser.newContext();
// 1. Sign in at the client's own page.
const home = await context.newPage();
await home.goto(`${CLIENT}/?signin=1`);
const secret = await home.evaluate(() => localStorage.getItem("session"));
r.signedInAtClient = !!secret;

// 2. A world with the client's signer embedded. The signer starts knowing nothing: its storage is walled off.
const world = await context.newPage();
await world.goto(`${WORLD}/`);
await world.waitForFunction(() => window.seen.some((m) => m.data?.t === "ready"));
const ask = async (page, msg, want) => {
  await page.evaluate((m) => window.ask(m), msg);
  await page.waitForFunction((t) => window.seen.some((m) => m.data?.t === t), want, { timeout: 5000 });
  return page.evaluate((t) => window.seen.filter((m) => m.data?.t === t).pop().data, want);
};
r.signerAtStart = await ask(world, { t: "state" }, "state");
await world.click("#sign");
await world.waitForFunction(() => window.seen.some((m) => m.data?.t === "signed"));
r.signBeforeConnecting = await world.evaluate(() => window.seen.filter((m) => m.data?.t === "signed").pop().data);

// 3. Connect: the world opens the client's window, the visitor presses Allow in it.
const [popup] = await Promise.all([context.waitForEvent("page"), world.click("#connect")]);
await popup.waitForSelector("#allow:not([hidden])", { timeout: 8000 }).catch(() => null);
r.windowSays = await popup.evaluate(() => document.getElementById("who").textContent + " | " + document.getElementById("out").textContent);
r.whatTheWorldCanReadBefore = await world.evaluate(() => window.tryToSteal());
if (await popup.isVisible("#allow")) await popup.click("#allow");
await world.waitForFunction(() => window.seen.some((m) => m.data?.t === "unlocked"), null, { timeout: 5000 }).catch(() => null);
r.signerAfter = await ask(world, { t: "state" }, "state");
await world.evaluate(() => (window.seen = window.seen.filter((m) => m.data?.t !== "signed")));
await world.click("#sign");
await world.waitForFunction(() => window.seen.some((m) => m.data?.t === "signed"));
r.signAfterConnecting = await world.evaluate(() => window.seen.filter((m) => m.data?.t === "signed").pop().data);
// 4. Did the world ever see the secret?
r.worldSawTheSecret = await world.evaluate((s) => JSON.stringify(window.seen).includes(s), secret);
r.everythingTheWorldHeard = await world.evaluate(() => window.seen.map((m) => `${m.origin} ${JSON.stringify(m.data)}`));

// 5. A hostile world: no real signer, a frame of its own posing as one.
const bad = await context.newPage();
await bad.goto(`${WORLD}/hostile.html`);
const [popup2] = await Promise.all([context.waitForEvent("page"), bad.click("#connect")]);
await popup2.waitForTimeout(1500);
r.hostile = {
  windowSays: await popup2.evaluate(() => document.getElementById("who").textContent),
  allowOffered: await popup2.isVisible("#allow"),
  sawTheSecret: await bad.evaluate((s) => JSON.stringify(window.seen).includes(s), secret),
  heard: await bad.evaluate(() => window.seen.map((m) => JSON.stringify(m.data)).slice(0, 4)),
};
console.log(JSON.stringify(r, null, 1));
await browser.close();
process.exit(0);
