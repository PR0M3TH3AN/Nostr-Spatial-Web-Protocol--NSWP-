// Captures each reference world's preview panorama (spec §5.8).
//
//   npm run build && npm run previews
//
// It serves each built world from localhost, opens it in headless Chrome,
// asks the world to capture itself, and stores the file under its SHA-256 in
// sites/previews/. It then records the hashes in sites/previews/index.json
// and in each world.json. Re-sign and republish the announcements afterwards.
//
//   npm run previews -- --only foundry    take only the named worlds' pictures, and keep the rest
//
// The world made with Godot (engines/godot, `npm run build:godot` first) is asked the same way:
// its engine takes six views and the kit paints them into one picture (NSWP.capturePreview).
//
// Needs Google Chrome installed (it is driven through playwright-core).
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sites = JSON.parse(readFileSync(join(root, "sites", "sites.json"), "utf8"));
const outDir = join(root, "sites", "previews");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".txt": "text/plain", ".wasm": "application/wasm", ".png": "image/png", ".ogg": "audio/ogg" };
/** The world made with another engine: where it is built to, and where its own details are kept. */
const GODOT = { name: "foundry", dist: join(root, "engines", "godot", "dist"), world: join(root, "engines", "godot", "world.json") };

function serve(dir) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    let file = join(dir, path);
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// --elsewhere-only: take no pictures; only bring in the previews of worlds kept elsewhere.
const elsewhereOnly = process.argv.includes("--elsewhere-only");
// --only a b: take only these worlds' pictures. Every other picture is kept as it is, so its hash doesn't change.
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt < 0 ? null : process.argv.slice(onlyAt + 1).filter((a) => !a.startsWith("--"));
const wanted = (name) => !elsewhereOnly && (!only || only.includes(name));
const before = existsSync(join(outDir, "index.json")) ? JSON.parse(readFileSync(join(outDir, "index.json"), "utf8")) : {};
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const index = elsewhereOnly || only ? Object.fromEntries(Object.entries(before).filter(([, p]) => !p.elsewhere)) : {};
const keep = (name, shot) => {
  const bytes = Buffer.from(shot.base64, "base64");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(join(outDir, `${sha256}.webp`), bytes);
  console.log(`${name}: ${shot.width}x${shot.height}, ${bytes.length} bytes, ${sha256}`);
  return { sha256, width: shot.width, height: shot.height, bytes: bytes.length };
};
try {
  for (const name of Object.keys(sites.worlds).filter(wanted)) {
    const dist = join(root, "sites", name, "dist");
    if (!existsSync(join(dist, "index.html"))) throw new Error(`sites/${name}/dist is missing; run npm run build`);
    const server = await serve(dist);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.__nswpTest?.state?.ready === true, null, { timeout: 30000 });
    await page.waitForTimeout(800); // let the scene settle for a frame or two
    const shot = await page.evaluate(() => window.__nswpTest.capturePreview(2048));
    await page.close();
    server.close();
    if (errors.length) throw new Error(`${name}: ${errors.join("; ")}`);
    index[name] = keep(name, shot);
  }
  // The world made with Godot. Its engine takes the views; the page hands back the finished picture.
  if (wanted(GODOT.name)) {
    if (!existsSync(join(GODOT.dist, "index.html"))) throw new Error("engines/godot/dist is missing; run npm run build:godot");
    const server = await serve(GODOT.dist);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => typeof window.NSWP?.capturePreview === "function" && !!window.nswpExample, null, { timeout: 120000 });
    await page.waitForTimeout(1500); // let the scene settle
    const shot = await page.evaluate(() => window.NSWP.capturePreview(2048));
    await page.close();
    server.close();
    if (errors.length) throw new Error(`${GODOT.name}: ${errors.join("; ")}`);
    index[GODOT.name] = { ...keep(GODOT.name, shot), godot: true };
  }
} finally {
  await browser.close();
}

// Worlds kept elsewhere that a door here leads to: their previews are mirrored
// too, from where their own repository keeps them.
for (const [name, place] of Object.entries(sites.elsewhere ?? {})) {
  const from = join(root, "sites", "template-demo");
  const world = JSON.parse(readFileSync(join(from, "world.json"), "utf8")).world;
  const p = world.d === place.d ? world.previews?.[0] : undefined;
  if (!p) continue;
  writeFileSync(join(outDir, `${p.sha256}.webp`), readFileSync(join(from, "previews", `${p.sha256}.webp`)));
  index[name] = { sha256: p.sha256, width: p.width, height: p.height, elsewhere: true };
}

// Drop preview files that no world uses any more.
const used = new Set(Object.values(index).map((p) => `${p.sha256}.webp`));
for (const f of readdirSync(outDir)) if (f.endsWith(".webp") && !used.has(f)) rmSync(join(outDir, f));
writeFileSync(join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

for (const [name, p] of Object.entries(index)) {
  if (p.elsewhere || !wanted(name)) continue;
  const path = p.godot ? GODOT.world : join(root, "sites", name, "world.json");
  const world = JSON.parse(readFileSync(path, "utf8"));
  world.previews = [{ url: new URL(`/previews/${p.sha256}.webp`, (sites.worlds[name] ?? sites.elsewhere[name]).url).href, type: "pano", sha256: p.sha256, width: p.width, height: p.height }];
  writeFileSync(path, `${JSON.stringify(world, null, 2)}\n`);
}
console.log("updated sites/previews/index.json and each world.json");
