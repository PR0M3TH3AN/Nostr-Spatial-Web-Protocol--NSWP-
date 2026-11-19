// Serves the built sites on this machine, each on a port of its own, for trying a change before it is deployed.
//
//   node scripts/build-sites.mjs && node scripts/serve-local.mjs          this machine only
//   node scripts/serve-local.mjs --lan                                    other devices on the same network too
//   node scripts/serve-local.mjs --lan --https                            and over https too, on the same ports
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
// From another device (--lan), plain http is not a secure address: a browser withholds its cryptography (so nobody
// can sign in), the microphone and a headset session. With --https each port answers https as well as http, with a
// certificate made on this machine and kept in ~/.config/nswp/dev-https/, outside every repository. Nobody vouches
// for that certificate but this machine, so each device shows a warning the first time, and whoever is holding it
// accepts it: that is them trusting their own computer. After that the page is a secure one. A browser still
// refuses passkeys on a page whose certificate it was told to accept.
//
// What an Airlock checks is still the real site and its real announcement, however these copies are served.
import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { createServer } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { createServer as createSocketServer } from "node:net";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lan = process.argv.includes("--lan");
const wantHttps = process.argv.includes("--https");
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

/** An address only this machine or its own network can reach: the same rule a page uses (packages/core/src/local.ts). */
const isPrivate = (a) => /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a);
/**
 * The certificate this server answers https with: made here, for this machine's own local names and addresses and
 * nothing else, and made again when it is about to run out or this machine's address has changed. It can vouch
 * for no other certificate (it is not an authority), so trusting it trusts this server and nothing more.
 */
function certificate() {
  const dir = join(homedir(), ".config", "nswp", "dev-https");
  const keyFile = join(dir, "key.pem");
  const certFile = join(dir, "cert.pem");
  const mine = [...new Set(["127.0.0.1", ...Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4").map((i) => i.address).filter(isPrivate)])];
  const wanted = ["DNS:localhost", ...mine.map((a) => `IP:${a}`)];
  const stillGood = () => {
    try {
      const cert = new X509Certificate(readFileSync(certFile));
      const names = cert.subjectAltName ?? "";
      return existsSync(keyFile) && new Date(cert.validTo).getTime() - Date.now() > 7 * 864e5 && wanted.every((w) => names.includes(w.replace("IP:", "IP Address:")));
    } catch {
      return false;
    }
  };
  let made = false;
  if (!stillGood()) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const args = ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "365", "-keyout", keyFile, "-out", certFile, "-subj", "/CN=NSWP development server (this machine only)"];
    for (const ext of [`subjectAltName=${wanted.join(",")}`, "basicConstraints=critical,CA:FALSE", "keyUsage=critical,digitalSignature", "extendedKeyUsage=serverAuth"]) args.push("-addext", ext);
    execFileSync("openssl", args, { stdio: "ignore" });
    chmodSync(keyFile, 0o600);
    made = true;
  }
  const cert = readFileSync(certFile);
  return { key: readFileSync(keyFile), cert, made, dir, fingerprint: new X509Certificate(cert).fingerprint256, until: new X509Certificate(cert).validTo };
}
let tls = null;
if (wantHttps) {
  try {
    tls = certificate();
  } catch (err) {
    console.log(`  (no https: a certificate couldn't be made. It needs openssl. ${String(err.message ?? err).split("\n")[0].slice(0, 100)})`);
  }
}
// Which sites are being served, and where: the map every one of them publishes.
const served = sites.map(([name, dist, note, real], i) => ({ name, dist, note, real, port: first + i, built: existsSync(join(dist, "index.html")) }));
/** The map for someone who reached this server as `host`: each real address, to its copy at that same host. */
function localMap(host, secure) {
  // The host a browser used is echoed back only if it is this machine by a name this server knows.
  const name = String(host ?? "").replace(/:\d+$/, "");
  const known = name === "localhost" || name === "127.0.0.1" || (address !== null && name === address);
  // And as it came: someone who reached this server over https is sent on over https.
  return Object.fromEntries(served.filter((s) => s.built && s.real).map((s) => [s.real, `${secure ? "https" : "http"}://${known ? name : "localhost"}:${s.port}`]));
}

for (const { name, dist, note, port: here, built } of served) {
  if (!built) {
    console.log(`  (not built) ${name}: ${dist}`);
    continue;
  }
  const extra = headersOf(dist);
  const answer = (req, res) => {
    let path;
    try {
      path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    } catch {
      return res.writeHead(400).end("bad address");
    }
    if (path === "/.well-known/nswp-local.json") {
      return res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify(localMap(req.headers.host, !!req.socket.encrypted), null, 1));
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
  };
  const plain = createServer(answer);
  const listenOn = lan ? "0.0.0.0" : "127.0.0.1";
  if (tls) {
    // One port, both ways: an https connection always begins with the byte 22, and plain http with a letter.
    const secure = createSecureServer({ key: tls.key, cert: tls.cert }, answer);
    createSocketServer((socket) => {
      socket.on("error", () => {});
      socket.once("data", (first) => {
        socket.pause();
        socket.unshift(first);
        (first[0] === 22 ? secure : plain).emit("connection", socket);
        process.nextTick(() => socket.resume());
      });
    }).listen(here, listenOn);
  } else plain.listen(here, listenOn);
  const elsewhere = address ? `   ${tls ? "https" : "http"}://${address}:${here}/` : "";
  console.log(`  ${name.padEnd(20)} http://localhost:${here}/${elsewhere}${note ? `   (${note})` : ""}`);
}
console.log(`\n${lan ? "Serving to this network." : "Serving to this machine only (add --lan for other devices)."} Links between these sites lead to the copies here; anything else leads to the real site.`);
if (tls) {
  console.log(`\nhttps is answered on the same ports, with a certificate ${tls.made ? "just made" : "made earlier"} on this machine (${tls.dir}, good until ${tls.until}).`);
  console.log("Another device will warn about it the first time. Before accepting, check the fingerprint it shows is this one:");
  console.log(`  ${tls.fingerprint}`);
  console.log("On this machine, http://localhost needs no certificate and is already a secure address.");
} else if (lan) {
  console.log("\nOver plain http another device can look but not sign in, use a microphone or enter VR. Add --https for those.");
}
