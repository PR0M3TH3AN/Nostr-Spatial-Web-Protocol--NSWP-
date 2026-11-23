// Own models, trial 2 (docs/plans/own-models.md): two visitors in the Grove as built here (`npm run build`), served
// by this script over https on this machine's network address. Ada arrives by name (a throwaway key, a pass for this
// site, through an Airlock that names no signer) with a look note naming a tiny VRM made in code
// (packages/sdk/test/tiny-vrm.ts), kept on the kit's own file host, which is a stand-in inside this test. Ben arrives
// as a guest. Both join the room. A stand-in relay carries the handshake and Ada's note. Nothing reaches the
// network. The world is told to draw models by the trial switch (`__nswpTrial.looks`), on a local address only.
// What should happen: Ben sees Ada as her own model at her height, fetched once by its hash; with "Show people's own
// models" off she is her simple look; on again, her model. A picture of Ben's view goes to .shots/.
//
// Trial 3, a world's word, is the same two visitors with MODE set:
//   MODE=none   the world names no format: everyone is drawn simple, nothing is fetched, and no row offers models.
//   MODE=own    the world dresses everyone itself (`dress: "own"`): the same.
import { createServer } from "node:https";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { HOST, ROOT as K, SHOTS } from "./lib.mjs";
const pw = await import(`${K}/node_modules/playwright-core/index.mjs`);
const core = await import(`${K}/packages/core/dist/index.js`);
const { sha256 } = await import(`${K}/node_modules/@noble/hashes/sha2.js`);
const work = mkdtempSync(join(tmpdir(), "own-models-"));
execFileSync(join(K, "node_modules", ".bin", "esbuild"), [join(K, "packages/sdk/test/tiny-vrm.ts"), "--format=esm", "--log-level=warning", `--outfile=${join(work, "tiny-vrm.mjs")}`], { stdio: "inherit" });
const { tinyVrm } = await import(join(work, "tiny-vrm.mjs"));
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const PORT = Number(process.env.PORT ?? 4378);
const MODE = process.env.MODE ?? "draw";
const LOOKS = MODE === "none" ? null : MODE === "own" ? { formats: ["vrm", "glb"], dress: "own" } : { formats: ["vrm", "glb"] };
const SITE = `https://${HOST}:${PORT}`;
const tls = join(homedir(), ".config/nswp/dev-https");
const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".ogg": "audio/ogg", ".glb": "model/gltf-binary", ".svg": "image/svg+xml" };
const server = await new Promise((ok) => {
  const s = createServer({ key: readFileSync(join(tls, "key.pem")), cert: readFileSync(join(tls, "cert.pem")) }, (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "https://x").pathname));
    let f = join(K, "sites/grove/dist", path);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": types[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
  }).listen(PORT, HOST, () => ok(s));
});
const vrm = Buffer.from(tinyVrm({ height: 1 }));
const vrmSha = hex(sha256(vrm));
const adaKey = crypto.getRandomValues(new Uint8Array(32)); // a throwaway, made here and gone with the test
const adaPub = core.getPublicKey(adaKey);
const T = Math.floor(Date.now() / 1000);
const adaNote = core.finalizeEvent({ kind: 37301, created_at: T, tags: [["d", "default"], ["model", `https://grove.bitblocks.network/items/${vrmSha}.vrm`, "vrm", vrmSha], ["height", "2.1"]], content: "" }, adaKey);
const relay = [adaNote];
const subs = new Set();
const matches = (f, e) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)) && (!f.since || e.created_at >= f.since) && Object.entries(f).every(([k, v]) => !k.startsWith("#") || e.tags.some((t) => t[0] === k.slice(1) && v.includes(t[1])));
const fileHits = [];
const browser = await pw.chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-features=WebRtcHideLocalIpsWithMdns", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const visitor = async (name, arrival) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 600 } });
  await ctx.routeWebSocket(/^wss:\/\//, (ws) => ws.onMessage((raw) => {
    const m = JSON.parse(raw);
    if (m[0] === "EVENT") { const e = m[1]; if (!(e.kind >= 20000 && e.kind < 30000)) relay.push(e); ws.send(JSON.stringify(["OK", e.id, true, ""])); for (const s of subs) if (s.filters.some((f) => matches(f, e))) try { s.ws.send(JSON.stringify(["EVENT", s.id, e])); } catch {} }
    else if (m[0] === "REQ") { const filters = m.slice(2); for (const e of relay) if (filters.some((f) => matches(f, e))) ws.send(JSON.stringify(["EVENT", m[1], e])); ws.send(JSON.stringify(["EOSE", m[1]])); subs.add({ ws, id: m[1], filters }); }
    else if (m[0] === "CLOSE") for (const s of subs) if (s.ws === ws && s.id === m[1]) subs.delete(s);
  }));
  // The kit's own file host, standing in: it has Ada's model by its hash, and nothing else.
  await ctx.route("https://grove.bitblocks.network/items/**", (r) => { const n = r.request().url().split("/").pop(); fileHits.push(`${name}:${n.slice(0, 10)}`); return n === `${vrmSha}.vrm` ? r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "model/gltf-binary" }, body: vrm }) : r.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "" }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${name}: ${String(e).slice(0, 160)}`));
  await page.addInitScript((looks) => { window.__nswpTrial = looks ? { looks } : {}; }, LOOKS);
  await page.goto(core.buildArrivalUrl(`${SITE}/`, { entry: "main-entrance", ...arrival }));
  for (let i = 0; i < 120; i++) { if (await page.evaluate(() => window.__nswpTest?.crossing?.() === "none").catch(() => false)) break; await page.waitForTimeout(300); }
  await page.waitForTimeout(800);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { name, page, errors, join: () => ev(() => window.__nswpTest.controls.run("room-join")), looks: () => ev(() => window.__nswpTest.lookInfo()), ev };
};
const sessionKey = crypto.getRandomValues(new Uint8Array(32));
const pass = core.finalizeEvent(core.buildRoomPass({ session: core.getPublicKey(sessionKey), origin: `${SITE}/`, createdAt: T, name: "Ada" }), adaKey);
const ada = await visitor("Ada", { airlock: "https://client.example/airlock/", pass, sessionKey: hex(sessionKey), avatar: core.encodeNaddr({ kind: 37301, pubkey: adaPub, identifier: "default" }) });
await ada.join();
await ada.page.waitForTimeout(2500);
const ben = await visitor("Ben", {});
await ben.join();
const r = {};
for (let i = 0; i < (MODE === "draw" ? 20 : 8); i++) { await ben.page.waitForTimeout(700); if ((await ben.looks()).some((x) => x.drawn === "model")) break; }
r.benSees = (await ben.looks()).map(({ drawn, why, height, model }) => ({ drawn, why, height, model: model?.slice(0, 10) ?? null }));
r.adaProvenForBen = (await ben.ev(() => window.__nswpTest.roomInfo())).map((p) => !p.guest);
const adaAt = await ben.ev(() => window.__nswpTest.roomInfo()[0]?.head);
// Ben stands a little behind where Ada is, facing the way everyone arrives facing here (-z), so she is in front of him.
await ben.ev(([x, z]) => window.__nswpTest.teleport(x, z + 2.8), [adaAt[0], adaAt[2]]);
await ben.page.waitForTimeout(1200);
mkdirSync(SHOTS, { recursive: true });
await ben.page.screenshot({ path: join(SHOTS, `own-models-ben${MODE === "draw" ? "" : `-${MODE}`}.png`) });
r.rows = await ben.ev(() => window.__nswpTest.controls.view().sections.find((s) => s.id === "people")?.items.map((i) => i.id) ?? null);
if (MODE === "draw") {
  await ben.ev(() => window.__nswpTest.controls.run("people-models"));
  await ben.page.waitForTimeout(1500);
  r.modelsOff = (await ben.looks()).map((x) => [x.drawn, x.why]);
  await ben.page.screenshot({ path: join(SHOTS, "own-models-ben-off.png") });
  await ben.ev(() => window.__nswpTest.controls.run("people-models"));
  await ben.page.waitForTimeout(1500);
  r.modelsOnAgain = (await ben.looks()).map((x) => x.drawn);
}
r.fileHits = fileHits;
r.errors = [...ada.errors, ...ben.errors];
console.log(JSON.stringify(r, null, 1));
await browser.close();
server.close();
const benFetched = fileHits.filter((h) => h.startsWith("Ben:")).length;
// A world that draws no models: Ada is there by name, drawn simple, nothing of hers is fetched, and no row offers models.
const okPlain = r.benSees[0]?.drawn === "simple" && r.adaProvenForBen[0] === true && fileHits.length === 0 && !r.rows.includes("people-models") && r.errors.length === 0;
const ok = MODE !== "draw" ? okPlain : r.benSees[0]?.drawn === "model" && r.benSees[0]?.height === 2.1 && r.adaProvenForBen[0] === true && r.modelsOff[0]?.[1] === "off" && r.modelsOnAgain[0] === "model" && fileHits.filter((h) => h.startsWith("Ben:")).length === 1 && r.errors.length === 0;
if (!ok) { console.error("own-models-two: not as expected"); process.exit(1); }
