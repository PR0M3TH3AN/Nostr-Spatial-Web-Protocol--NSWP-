// The headset test page's way of sending its log out, asked for by the owner on 2026-11-21 ("post the outputs of
// the logs as nostr event notes on like a random kind so they are not in my social feed... Its hard to get that
// text out of the vr env"). Built by scripts/build-sites.mjs into /xr-test/post.js on every world.
//
// Only the guided test uses it, and only after the press that starts it, which says so. What is sent: the log on
// the page, the answers pressed, and the browser's own name for itself. It is signed by a key made in the page
// for that one page and thrown away with it, so nothing ties a log to a person, and nobody is signed in. The kind
// is one no reader of notes shows. The notes ask relays to drop them after thirty days.
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/** A kind nothing else uses: these are not notes for anyone's feed. */
const KIND = 4573;
const TOPIC = "nswp-xr-test";
const RELAYS = ["wss://nos.lol", "wss://relay.primal.net", "wss://relay.snort.social", "wss://nostr.mom"];
const KEPT_FOR = 30 * 24 * 60 * 60;
const WAIT = 5000;

let key = null;
const secret = () => {
  // A key for this page alone. A number that isn't a key is as good as never drawn: draw again.
  while (!key) {
    const k = crypto.getRandomValues(new Uint8Array(32));
    try {
      key = { secret: k, pubkey: bytesToHex(schnorr.getPublicKey(k)) };
    } catch {
      key = null;
    }
  }
  return key;
};

const sign = (body, run, step) => {
  const { secret: sk, pubkey } = secret();
  const created_at = Math.floor(Date.now() / 1000);
  const tags = [
    ["t", TOPIC],
    ["t", `${TOPIC}-${String(run).toLowerCase()}`],
    ["step", String(step)],
    ["expiration", String(created_at + KEPT_FOR)],
  ];
  const content = JSON.stringify(body);
  const hash = sha256(utf8ToBytes(JSON.stringify([0, pubkey, created_at, KIND, tags, content])));
  return { id: bytesToHex(hash), pubkey, created_at, kind: KIND, tags, content, sig: bytesToHex(schnorr.sign(hash, sk)) };
};

/** Whether one relay took it: its own word, or nothing within a few seconds. */
const offer = (relay, event) =>
  new Promise((resolve) => {
    let ws;
    let done = false;
    const finish = (took) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* already gone */
      }
      resolve(took);
    };
    const timer = setTimeout(() => finish(false), WAIT);
    try {
      ws = new WebSocket(relay);
    } catch {
      return finish(false);
    }
    ws.onopen = () => ws.send(JSON.stringify(["EVENT", event]));
    ws.onerror = () => finish(false);
    ws.onclose = () => finish(false);
    ws.onmessage = (m) => {
      try {
        const said = JSON.parse(m.data);
        if (Array.isArray(said) && said[0] === "OK" && said[1] === event.id) finish(said[2] === true);
      } catch {
        /* not for us */
      }
    };
  });

window.__xrPost = {
  kind: KIND,
  relays: RELAYS.slice(),
  /** Sign what the page has and offer it to every relay. Says how many took it; never throws. */
  async send(body, run, step) {
    try {
      const event = sign(body, run, step);
      const took = await Promise.all(RELAYS.map((r) => offer(r, event)));
      return { ok: took.filter(Boolean).length, total: RELAYS.length, id: event.id };
    } catch (e) {
      return { ok: 0, total: RELAYS.length, id: null, error: String(e) };
    }
  },
};
