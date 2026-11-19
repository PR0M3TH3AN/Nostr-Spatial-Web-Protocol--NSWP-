// Two tiny sites for trying the hand-off: a "client" (stands in for BitPortal) and a "world".
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const site = (dir, port, host) =>
  createServer((req, res) => {
    const path = join(here, dir, new URL(req.url, "http://x").pathname.replace(/^\/$/, "/index.html"));
    if (!path.startsWith(join(here, dir)) || !existsSync(path)) return void res.writeHead(404).end("no");
    res.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8", "cache-control": "no-store" }).end(readFileSync(path));
  }).listen(port, host);
site("client", 4391, "127.0.0.1");
site("world", 4392, "127.0.0.1");
console.log("serving");
