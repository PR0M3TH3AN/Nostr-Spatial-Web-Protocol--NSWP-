// Serves the built sites on this machine, each on a port of its own, for trying a change before it is deployed.
//
//   node scripts/build-sites.mjs && node scripts/serve-local.mjs          this machine only
//   node scripts/serve-local.mjs --lan                                    other devices on the same network too
//
// BitPortal and the world template are served from their own repositories beside this one, if they are built.
// The Godot example is served if it has been exported (node scripts/build-godot-example.mjs, which needs Godot).
//
// What this is not: the real thing joined up. Each world is built for its real address, so a door still leads,
// through the Airlock, to the deployed site and not to the copy served here. Everything inside one place can be
// tried: moving, sound, the menu, a room with a second tab. And from another device (--lan) the address is not a
// secure one, so a browser withholds the microphone and a headset session there.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lan = process.argv.includes("--lan");
const first = Number(process.env.PORT ?? 4300);
const sites = [
  ["BitPortal", join(root, "..", "bitportal", "dist"), "/walk/ is the room, / the list"],
  ...["gallery", "grove", "tour", "arcade", "observatory", "workshop", "library"].map((name) => [`The ${name[0].toUpperCase()}${name.slice(1)}`, join(root, "sites", name, "dist"), ""]),
  ["The world template", join(root, "..", "nswp-world-template", "dist"), ""],
  ["A world in Godot", join(root, "engines", "godot", "dist"), "about 40 MB to load"],
];
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

/** The headers a site's own host would send, as its build wrote them down, less the ones that only make sense on https. */
function headersOf(dist) {
  try {
    const all = JSON.parse(readFileSync(join(dist, "vercel.json"), "utf8")).headers?.find((h) => h.source === "/(.*)")?.headers ?? [];
    return Object.fromEntries(all.filter((h) => !/strict-transport|upgrade-insecure/i.test(`${h.key} ${h.value}`)).map((h) => [h.key, h.value]));
  } catch {
    return {};
  }
}

const address = lan ? Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address : null;
let port = first;
for (const [name, dist, note] of sites) {
  const here = port++;
  if (!existsSync(join(dist, "index.html"))) {
    console.log(`  (not built) ${name}: ${dist}`);
    continue;
  }
  const extra = headersOf(dist);
  createServer((req, res) => {
    let path;
    try {
      path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    } catch {
      return res.writeHead(400).end("bad address");
    }
    let file = join(dist, path);
    // Nothing outside the built site is ever served.
    if (file !== dist && !file.startsWith(dist + sep)) return res.writeHead(403).end("no");
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    const body = readFileSync(file);
    const head = { ...extra, "content-type": types[extname(file)] ?? "application/octet-stream", "accept-ranges": "bytes", "cache-control": "no-store" };
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
    if (range) {
      const from = Number(range[1]);
      const to = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      if (from > to) return res.writeHead(416, { "content-range": `bytes */${body.length}` }).end();
      res.writeHead(206, { ...head, "content-range": `bytes ${from}-${to}/${body.length}`, "content-length": to - from + 1 });
      return res.end(body.subarray(from, to + 1));
    }
    res.writeHead(200, { ...head, "content-length": body.length });
    res.end(body);
  }).listen(here, lan ? "0.0.0.0" : "127.0.0.1");
  console.log(`  ${name.padEnd(20)} http://localhost:${here}/${address ? `   http://${address}:${here}/` : ""}${note ? `   (${note})` : ""}`);
}
console.log(lan ? "\nServing to this network. A door still leads to the deployed sites." : "\nServing to this machine only (add --lan for other devices). A door still leads to the deployed sites.");
