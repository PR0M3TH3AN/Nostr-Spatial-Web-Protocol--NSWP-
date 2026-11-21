// A stand-in relay for trying a purchase on this machine: it keeps what it is sent in memory and hands it to whoever
// asks. Nothing it is given goes anywhere else, and it is gone when this stops. It answers in two places with one
// store: plainly on 127.0.0.1 (for a local service that can't be told to accept this machine's own certificate), and
// over TLS on the network address (for the https pages).
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { homedir } from "node:os";
import { join } from "node:path";
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const { WebSocketServer } = await import(`${NSWP}/node_modules/ws/wrapper.mjs`);
const { verifyEvent } = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/pure.js`);

const PLAIN = Number(process.env.PLAIN_PORT ?? 4313);
const TLS = Number(process.env.TLS_PORT ?? 4314);
const LAN = HOST;
const events = [];
const subs = new Map();

const matches = (f, e) =>
  (!f.ids || f.ids.includes(e.id)) &&
  (!f.kinds || f.kinds.includes(e.kind)) &&
  (!f.authors || f.authors.includes(e.pubkey)) &&
  (f.since === undefined || e.created_at >= f.since) &&
  (f.until === undefined || e.created_at <= f.until) &&
  Object.keys(f).filter((k) => k[0] === "#").every((k) => e.tags.some((t) => t[0] === k.slice(1) && f[k].includes(t[1])));
const replaceable = (k) => k === 0 || k === 3 || (k >= 10000 && k < 20000);
const addressable = (k) => k >= 30000 && k < 40000;
const d = (e) => e.tags.find((t) => t[0] === "d")?.[1] ?? "";

function keep(e) {
  if (events.some((x) => x.id === e.id)) return "duplicate: already have this event";
  const same = (x) => x.pubkey === e.pubkey && x.kind === e.kind && (replaceable(e.kind) || (addressable(e.kind) && d(x) === d(e)));
  if (replaceable(e.kind) || addressable(e.kind)) {
    const old = events.find(same);
    if (old && old.created_at >= e.created_at) return "replaced: have a newer one";
    if (old) events.splice(events.indexOf(old), 1);
  }
  events.push(e);
  if (events.length > 2000) events.shift();
  return "";
}

function serve(server) {
  server.on("connection", (ws) => {
    subs.set(ws, new Map());
    ws.on("close", () => subs.delete(ws));
    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (!Array.isArray(msg)) return;
      if (msg[0] === "REQ") {
        const filters = msg.slice(2).filter((f) => f && typeof f === "object");
        subs.get(ws).set(String(msg[1]), filters);
        const found = events.filter((e) => filters.some((f) => matches(f, e))).sort((a, b) => b.created_at - a.created_at);
        const limit = Math.min(...filters.map((f) => (typeof f.limit === "number" ? f.limit : Infinity)));
        for (const e of found.slice(0, limit)) ws.send(JSON.stringify(["EVENT", msg[1], e]));
        ws.send(JSON.stringify(["EOSE", msg[1]]));
      } else if (msg[0] === "CLOSE") subs.get(ws).delete(String(msg[1]));
      else if (msg[0] === "EVENT") {
        const e = msg[1];
        let ok = false;
        try { ok = verifyEvent(e); } catch { ok = false; }
        if (!ok) return void ws.send(JSON.stringify(["OK", e?.id ?? "", false, "invalid: bad signature or id"]));
        const why = keep(e);
        ws.send(JSON.stringify(["OK", e.id, true, why]));
        if (why) return;
        console.log(`${new Date().toISOString()} kept kind ${e.kind} from ${e.pubkey.slice(0, 8)} d=${d(e).slice(0, 60)}`);
        for (const [sock, mine] of subs) for (const [id, filters] of mine) if (filters.some((f) => matches(f, e))) sock.send(JSON.stringify(["EVENT", id, e]));
      }
    });
  });
}

serve(new WebSocketServer({ host: "127.0.0.1", port: PLAIN }));
const dir = join(homedir(), ".config", "nswp", "dev-https");
const https = createServer({ key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) }, (req, res) => {
  res.writeHead(200, { "content-type": "application/nostr+json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify({ name: "stand-in relay (this machine only)", description: "Keeps test events in memory. Not a real relay.", supported_nips: [1] }));
});
serve(new WebSocketServer({ server: https }));
https.listen(TLS, "0.0.0.0", () => console.log(`stand-in relay: ws://127.0.0.1:${PLAIN} and wss://${LAN}:${TLS}`));
