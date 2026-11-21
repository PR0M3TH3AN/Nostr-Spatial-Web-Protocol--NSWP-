// Sends one throwaway event to the stand-in relay by each of its two addresses and reads it back by the other.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const { default: WebSocket } = await import(`${NSWP}/node_modules/ws/wrapper.mjs`);
const { generateSecretKey, finalizeEvent } = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/pure.js`);
const sk = generateSecretKey();
const e = finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), tags: [["d", "try:one"]], content: "{}" }, sk);
const talk = (url, send, want) => new Promise((res, rej) => { const ws = new WebSocket(url, { rejectUnauthorized: false }); const got = []; ws.on("open", () => ws.send(JSON.stringify(send))); ws.on("message", (m) => { const j = JSON.parse(String(m)); got.push(j); if (j[0] === want) { ws.close(); res(got); } }); ws.on("error", rej); setTimeout(() => rej(new Error("timeout " + url)), 4000); });
const ok = await talk("ws://127.0.0.1:4313", ["EVENT", e], "OK");
const back = await talk(`wss://${HOST}:4314`, ["REQ", "a", { kinds: [30078], authors: [e.pubkey], "#d": ["try:one"] }], "EOSE");
const bad = await talk("ws://127.0.0.1:4313", ["EVENT", { ...e, content: "changed" }], "OK");
console.log(JSON.stringify({ accepted: ok[0][2], readBack: back.filter((m) => m[0] === "EVENT").length, forgedRefused: bad[0][2] === false }));
