// Serves the built sites on this machine, each on a port of its own, for trying a change before it is deployed.
//
//   node scripts/build-sites.mjs && node scripts/serve-local.mjs          this machine only
//   node scripts/serve-local.mjs --lan                                    other devices on the same network too
//
// BitPortal and the world template are served from their own repositories beside this one, if they are built.
// The Godot example is served if it has been exported (node scripts/build-godot-example.mjs, which needs Godot).
//
// Links lead to the copies served here. Each site is built for its real address, and stays that way: what is tried
// here is what gets deployed. But this server publishes a map, real address to local copy, at
// /.well-known/nswp-local.json, and a page that is itself on a local address follows it when it sends the browser
// on (packages/core/src/local.ts). So a door in the Gallery leads to the BitPortal served here, and its Airlock to
// the Grove served here. A site that isn't being served here still leads to the real one. Once deployed, a page asks
// for no map, and every link is the real address.
//
// What this is not: a secure address. From another device (--lan) a browser withholds the microphone and a headset
// session. And what an Airlock checks is still the real site and its real announcement.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lan = process.argv.includes("--lan");
const first = Number(process.env.PORT ?? 4300);
/** A world's real address, as its own settings give it, or "" if it has none worth following. */
function realOrigin(file) {
  try {
    const u = new URL(JSON.parse(readFileSync(file, "utf8")).url);
    return u.protocol === "https:" && !/(^|\.)example(\.|$)/.test(u.hostname) ? u.origin : "";
  } catch {
    return "";
  }
}
// Each: its name, what is served, a note, and the real address it is a copy of.
const sites = [
  ["BitPortal", join(root, "..", "bitportal", "dist"), "/walk/ is the room, / the list", "https://portal.bitblocks.network"],
  ...["gallery", "grove", "tour", "arcade", "observatory", "workshop", "library"].map((name) => [`The ${name[0].toUpperCase()}${name.slice(1)}`, join(root, "sites", name, "dist"), "", realOrigin(join(root, "sites", name, "world.json"))]),
  ["The world template", join(root, "..", "nswp-world-template", "dist"), "", realOrigin(join(root, "..", "nswp-world-template", "world.json"))],
  ["A world in Godot", join(root, "engines", "godot", "dist"), "about 40 MB to load", ""],
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
// Which sites are being served, and where: the map every one of them publishes.
const served = sites.map(([name, dist, note, real], i) => ({ name, dist, note, real, port: first + i, built: existsSync(join(dist, "index.html")) }));
/** The map for someone who reached this server as `host`: each real address, to its copy at that same host. */
function localMap(host) {
  // The host a browser used is echoed back only if it is this machine by a name this server knows.
  const name = String(host ?? "").replace(/:\d+$/, "");
  const known = name === "localhost" || name === "127.0.0.1" || (address !== null && name === address);
  return Object.fromEntries(served.filter((s) => s.built && s.real).map((s) => [s.real, `http://${known ? name : "localhost"}:${s.port}`]));
}

for (const { name, dist, note, port: here, built } of served) {
  if (!built) {
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
    if (path === "/.well-known/nswp-local.json") {
      return res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify(localMap(req.headers.host), null, 1));
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
console.log(`\n${lan ? "Serving to this network." : "Serving to this machine only (add --lan for other devices)."} Links between these sites lead to the copies here; anything else leads to the real site.`);
