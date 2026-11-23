// Moving in a headset in a Godot world (docs/plans/godot-headset-controls.md): the add-on's visitor reads two hands,
// asks the kit what they mean (`NSWP.hands`), and does it. Casual: a stick held forward shows where a step would
// land, letting go steps there, a stick pulled back steps back, the other stick turns a notch. Intense: one stick
// walks, the other turns, smoothly.
//
// What is real: this checkout's export of the Godot example (`npm run build:godot`), its add-on and its engine
// script, Godot's own floors and walls, and the kit deciding what the hands mean. What is a stand-in: **the headset
// and the hands.** No scripted browser can be in a headset in a Godot world (Godot needs WebXR Layers, which the
// made-up headset lacks: trials/godot-leave-vr.mjs). So this runs on the flat page, and the example is handed hands
// this script makes up (`window.nswpPretendHands`): where each stick is, where the hand is, and the way it points.
// Everything after the reading of a real controller is the same code as in a headset. What it can't show: a real
// controller's names for its stick and buttons, which way a real stick reads as forward, the fade (made only in a
// session), the hands drawn, and how any of it feels. Those are the owner's, on a Quest.
//
// Nothing leaves this machine: the page is served from the build, every other request is refused and listed, and
// no WebSocket reaches anything. Godot's two audio worklets come from the local sites service at the Foundry's own
// port, so that service has to be up. This is not a trial about presses on a page: the script reads it directly.
//
//   npm run build:godot && node trials/godot-hands.mjs
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const pw = await import(`${NSWP}/node_modules/playwright-core/index.mjs`);

const DIST = join(NSWP, "engines", "godot", "dist");
if (!existsSync(join(DIST, "nswp-engine.js"))) throw new Error("The Godot example isn't exported in this checkout. Run `npm run build:godot` first.");
const ORIGIN = `https://${HOST}:${process.env.FOUNDRY_PORT ?? 4309}`;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ogg": "audio/ogg", ".wasm": "application/wasm", ".pck": "application/octet-stream", ".webp": "image/webp" };
mkdirSync(SHOTS, { recursive: true });

const results = {};
const fail = [];
const check = (name, ok, got) => {
  results[name] = ok ? "ok" : { failed: got ?? null };
  if (!ok) fail.push(name);
};
const refused = new Set();
const errors = [];
// Drawn with this machine's own graphics card, so that Godot keeps its pace: drawn without one it falls behind time.
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });

/** A visit to the example by someone who moves this way in a headset, with made-up hands. */
async function visit(name, comfort) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript((kept) => { try { if (kept) localStorage.setItem("nswp:comfort", kept); } catch {} }, comfort ? JSON.stringify(comfort) : "");
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== ORIGIN) { refused.add(url.origin); return route.abort(); }
    const p = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    const on = normalize(join(DIST, p));
    if (!on.startsWith(DIST) || !existsSync(on)) return route.fulfill({ status: 404, contentType: "text/plain", body: "not here" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(on)] ?? "application/octet-stream", body: readFileSync(on) });
  });
  await ctx.routeWebSocket(/^wss?:\/\//, (ws) => ws.close());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${String(e).slice(0, 200)}`));
  const until = async (ask, ms = 15000, every = 100) => { const end = Date.now() + ms; for (;;) { const got = await Promise.resolve().then(ask).catch(() => null); if (got || Date.now() > end) return got; await page.waitForTimeout(every); } };
  const said = () => page.evaluate(() => JSON.parse(window.nswpExample ?? "{}"));
  await page.goto(`${ORIGIN}/`, { timeout: 180000, waitUntil: "domcontentloaded" });
  const up = await until(async () => { const s = await said(); return s.ready === true && s.hands ? s : null; }, 180000);
  /** The way they face along the floor, and a hand at their side pointing at the floor `far` metres ahead. */
  const ahead = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
  const pointing = (s, far) => {
    const [fx, fz] = ahead(s.yaw);
    const from = [s.at[0], s.height + 1.3, s.at[1]];
    const to = [s.at[0] + fx * far, s.height, s.at[1] + fz * far];
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const n = Math.hypot(...d);
    return { from, towards: d.map((v) => v / n) };
  };
  const rest = { stick: [0, 0], trigger: 0, squeeze: 0, primary: false, secondary: false, press: false };
  const hands = async (left = {}, right = {}) => {
    const s = await said();
    const at = pointing(s, 2);
    await page.evaluate((pads) => { window.nswpPretendHands = JSON.stringify(pads); }, [{ index: 0, hand: "left", ...rest, ...at, ...left }, { index: 1, hand: "right", ...rest, ...at, ...right }]);
  };
  const settle = (ms = 350) => page.waitForTimeout(ms);
  const turned = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return { ctx, page, up, until, said, hands, settle, pointing, ahead, turned, far };
}

try {
  // ---- Casual, which is how everyone starts: steps, a step back, notches.
  {
    const v = await visit("casual", null);
    check("casual/the Godot example comes up, and says what its hands mean", !!v.up, v.up && v.up.hands);
    await v.hands();
    await v.settle();
    let s = await v.said();
    check("casual/with both sticks at rest nothing is meant, and they move the casual way", s.hands.pretending === true && s.hands.meant.turn === 0 && s.hands.meant.intense === false && s.hands.meant.stepping === true && s.hands.meant.fade === true, s.hands);
    const start = s;

    // A notch for each flick of the right stick.
    await v.hands({}, { stick: [1, 0] });
    const right = await v.until(async () => { const now = await v.said(); return Math.abs(v.turned(now.yaw, start.yaw) + Math.PI / 6) < 0.03 ? now : null; }, 5000);
    check("casual/the right stick pushed right turns them one notch to the right, 30 degrees", !!right, [(await v.said()).yaw, start.yaw]);
    await v.settle(600);
    check("casual/held, it is still one notch", Math.abs(v.turned((await v.said()).yaw, start.yaw) + Math.PI / 6) < 0.03, (await v.said()).yaw);
    check("casual/turning on the spot leaves them standing where they were", v.far((await v.said()).at, start.at) < 0.05, [(await v.said()).at, start.at]);
    await v.hands();
    await v.settle();
    await v.hands({}, { stick: [-1, 0] });
    check("casual/and pushed left, back again", await v.until(async () => Math.abs(v.turned((await v.said()).yaw, start.yaw)) < 0.03, 5000), [(await v.said()).yaw, start.yaw]);
    await v.hands();
    await v.settle();

    // A stick held forward: a ring where the hand points. Letting go: the step.
    s = await v.said();
    const [fx, fz] = v.ahead(s.yaw);
    const there = [s.at[0] + fx * 2, s.at[1] + fz * 2];
    await v.hands({ stick: [0, 1] });
    const aimed = await v.until(async () => { const now = await v.said(); return now.hands.spot ? now : null; }, 5000);
    check("casual/the left stick held forward shows where a step would land: the floor two metres ahead, where the hand points", !!aimed && v.far(aimed.hands.spot, there) < 0.2 && aimed.marks.ring === true && aimed.hands.meant.aiming.length === 1, aimed && [aimed.hands.spot, there, aimed.marks.ring]);
    check("casual/and nothing has moved them yet", v.far((await v.said()).at, s.at) < 0.05, [(await v.said()).at, s.at]);
    await v.page.screenshot({ path: join(SHOTS, "godot-hands-1-aiming.png") });
    await v.hands();
    const stepped = await v.until(async () => { const now = await v.said(); return v.far(now.at, there) < 0.25 ? now : null; }, 5000);
    check("casual/letting go steps them there", !!stepped, [(await v.said()).at, there]);
    check("casual/and the ring is gone", (await v.said()).hands.spot === null);

    // Pointing at nothing they could stand on: up, and level.
    await v.settle(1200);
    s = await v.said();
    for (const [what, towards] of [["up, at the sky", [0, 1, 0]], ["level, at whatever is ahead", [v.ahead(s.yaw)[0], 0, v.ahead(s.yaw)[1]]]]) {
      await v.hands({ stick: [0, 1], towards });
      await v.settle(500);
      const no = (await v.said()).hands.spot;
      await v.hands({ towards });
      await v.settle(500);
      check(`casual/pointing ${what}: no ring, and letting go moves nobody`, no === null && v.far((await v.said()).at, s.at) < 0.05, [no, (await v.said()).at, s.at]);
    }

    // A step back: a metre, the way they were not facing.
    await v.settle(1200);
    s = await v.said();
    const behind = [s.at[0] - v.ahead(s.yaw)[0], s.at[1] - v.ahead(s.yaw)[1]];
    await v.hands({ stick: [0, -1] });
    check("casual/the left stick pulled back steps them back a metre", await v.until(async () => v.far((await v.said()).at, behind) < 0.2, 5000), [(await v.said()).at, behind]);
    await v.settle(700);
    check("casual/held back, it is still one step", v.far((await v.said()).at, behind) < 0.2, (await v.said()).at);
    await v.hands();

    // Further than a step reaches: as far that way as one goes, and then not again until that ground would have been run.
    await v.settle(1500);
    s = await v.said();
    const reach = s.kit.stepReach;
    await v.hands({ stick: [0, 1], ...v.pointing(s, 9) });
    const farSpot = await v.until(async () => { const now = await v.said(); return now.hands.spot ? now.hands.spot : null; }, 3000);
    if (farSpot) {
      check("casual/pointing further than a step reaches: the ring is as far that way as a step goes", Math.abs(v.far(farSpot, s.at) - reach) < 0.2, [farSpot, s.at, reach]);
      // Let go with the hand still pointing where it did, as a hand does.
      await v.hands({ ...v.pointing(s, 9) });
      await v.until(async () => v.far((await v.said()).at, farSpot) < 0.3, 4000);
      const landed = await v.said();
      check("casual/letting go steps them there, as far as a step goes", v.far(landed.at, farSpot) < 0.3, [s.at, farSpot, landed.at]);
      // At once, another: too soon.
      await v.hands({ stick: [0, 1] });
      await v.settle(150);
      await v.hands();
      await v.settle(250);
      const soon = await v.said();
      check("casual/a second step at once does nothing: the last is still being paid for", v.far(soon.at, landed.at) < 0.1, [soon.at, landed.at, soon.hands.ready]);
      await v.settle(1600);
      await v.hands({ stick: [0, 1] });
      await v.settle(400);
      await v.hands();
      check("casual/and a moment later it steps", await v.until(async () => v.far((await v.said()).at, landed.at) > 1.5, 4000), [(await v.said()).at, landed.at]);
    } else results["casual/NOT SHOWN: a step further than a step reaches"] = "There is no floor nine metres ahead of where they stood in this world.";

    // A door: a hand pointed at it from within reach lights it. The trigger is not pressed here, which would leave the page.
    await v.settle(1200);
    s = await v.said();
    const door = s.gate_at;
    const away = Math.hypot(door[0] - s.at[0], door[2] - s.at[1]);
    results["casual/how far the door is, and how near it must be"] = [Math.round(away * 100) / 100, s.kit.doorReach];
    const from = [s.at[0], s.height + 1.3, s.at[1]];
    const to = [door[0] - from[0], door[1] + 1 - from[1], door[2] - from[2]];
    const n = Math.hypot(...to);
    await v.hands({}, { from, towards: to.map((x) => x / n) });
    await v.settle(600);
    check(`casual/a hand pointed at the door from ${away <= s.kit.doorReach ? "within reach lights it" : "further off than its reach does not light it"}`, (await v.said()).aimed === (away <= s.kit.doorReach), [(await v.said()).aimed, away]);
    await v.hands();
    await v.page.evaluate(() => { window.nswpPretendHands = "[]"; });
    await v.settle(400);
    check("casual/with the hands gone, nothing is pretended and nothing moves", (await v.said()).hands.pretending === false);
    await v.ctx.close();
  }

  // ---- Intense: one stick walks, the other turns, smoothly.
  {
    const v = await visit("intense", { move: "smooth", turn: "smooth", turnStep: 30, narrow: false, fade: false, moveHand: "left" });
    check("intense/the Godot example comes up", !!v.up);
    await v.hands();
    await v.settle();
    const start = await v.said();
    check("intense/they move the intense way: no steps, no fade", start.hands.meant.intense === true && start.hands.meant.stepping === false && start.hands.meant.fade === false, start.hands.meant);
    await v.hands({ stick: [0, 1] });
    await v.page.waitForTimeout(1000);
    await v.hands();
    await v.settle(300);
    const walked = await v.said();
    const [fx, fz] = v.ahead(start.yaw);
    const along = (walked.at[0] - start.at[0]) * fx + (walked.at[1] - start.at[1]) * fz;
    const beside = Math.abs((walked.at[0] - start.at[0]) * fz - (walked.at[1] - start.at[1]) * fx);
    check("intense/the left stick forward walks them ahead, at about a brisk walk, and not sideways", along > 0.8 && along < 3 && beside < 0.2, { along, beside });
    check("intense/and no ring is shown: nothing is stepped to", walked.hands.spot === null && walked.marks.ring === false, [walked.hands.spot, walked.marks.ring]);
    await v.hands({}, { stick: [1, 0] });
    await v.page.waitForTimeout(500);
    await v.hands();
    await v.settle(300);
    const spun = v.turned((await v.said()).yaw, walked.yaw);
    check("intense/the right stick turns them smoothly to the right, not by a notch", spun < -0.3 && spun > -1.8 && Math.abs(spun + Math.PI / 6) > 0.02, spun);
    const stood = await v.said();
    await v.page.waitForTimeout(600);
    check("intense/with the sticks at rest they stand still", v.far((await v.said()).at, stood.at) < 0.05 && Math.abs(v.turned((await v.said()).yaw, stood.yaw)) < 0.02, [(await v.said()).at, stood.at]);
    await v.ctx.close();
  }
  results["refused, as everything but this site is"] = [...refused].sort();
  results["page errors"] = errors;
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (fail.length) {
  console.error(`\nFAILED: ${fail.length}\n- ${fail.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall ${Object.values(results).filter((r) => r === "ok").length} checks passed`);
