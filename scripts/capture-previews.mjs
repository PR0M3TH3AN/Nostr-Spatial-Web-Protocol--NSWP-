// Captures each reference world's preview panorama (spec §5.8).
//
//   npm run build && npm run previews
//
// It serves each built world from localhost, opens it in headless Chrome,
// asks the world to capture itself, and stores the file under its SHA-256 in
// sites/previews/. It then records the hashes in sites/previews/index.json
// and in each world.json. Re-sign and republish the announcements afterwards.
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
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".css": "text/css", ".txt": "text/plain" };

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
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const index = elsewhereOnly ? Object.fromEntries(Object.entries(JSON.parse(readFileSync(join(outDir, "index.json"), "utf8"))).filter(([, p]) => !p.elsewhere)) : {};
try {
  for (const name of elsewhereOnly ? [] : Object.keys(sites.worlds)) {
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
    const bytes = Buffer.from(shot.base64, "base64");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    writeFileSync(join(outDir, `${sha256}.webp`), bytes);
    index[name] = { sha256, width: shot.width, height: shot.height, bytes: bytes.length };
    console.log(`${name}: ${shot.width}x${shot.height}, ${bytes.length} bytes, ${sha256}`);
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
const keep = new Set(Object.values(index).map((p) => `${p.sha256}.webp`));
for (const f of readdirSync(outDir)) if (f.endsWith(".webp") && !keep.has(f)) rmSync(join(outDir, f));
writeFileSync(join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

for (const [name, p] of Object.entries(index)) {
  if (p.elsewhere || elsewhereOnly) continue;
  const path = join(root, "sites", name, "world.json");
  const world = JSON.parse(readFileSync(path, "utf8"));
  world.previews = [{ url: new URL(`/previews/${p.sha256}.webp`, sites.worlds[name].url).href, type: "pano", sha256: p.sha256, width: p.width, height: p.height }];
  writeFileSync(path, `${JSON.stringify(world, null, 2)}\n`);
}
console.log("updated sites/previews/index.json and each world.json");
