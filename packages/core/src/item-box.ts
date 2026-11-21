/**
 * The locked box an item's own logic runs in (protocol/17-items.md, "An item's own logic").
 *
 * An item's script is somebody else's code. It runs only on the device of the person carrying the item, and only
 * in here: a page of its own, served by the world under rules that give it nothing.
 *
 * - **No network.** The page's content rules name no place it may reach: no fetch, no socket, no script or
 *   picture from anywhere.
 * - **No storage, and nothing of the world.** The world frames it with `sandbox="allow-scripts"`, so it has an
 *   origin of its own that is nobody's: no cookies, no storage, and no way to the page that holds it.
 * - **Stopped at once.** The script runs in a worker inside this page. One that doesn't answer is ended.
 * - **Nothing of the device.** Inside the worker the script is given one object, `item`, and the names it might
 *   reach the rest by (`self`, `navigator`, `location`, `fetch` and the like) are empty for it.
 * - **It hears and says only words.** Events come in by message; asks go out by message; the kit decides what to
 *   do with each (`cleanAsk`, `ITEM_ASKS`).
 *
 * A world that draws items serves this page as `item-box.html` with exactly `ITEM_BOX_CSP` as its
 * Content-Security-Policy (or `itemBoxCsp(client)`, where the world lets its visitors' client show it in a frame:
 * the box must then let that client be above it too), and with none of its other content rules, which would stop
 * the page's own script.
 * Where it isn't served, or is served under other rules, scripts simply don't run there, and items are shapes.
 */
import { ITEM_EVENTS, SCRIPT_LIMITS } from "./play.js";

/** The content rules the box's page must be served with. Nothing may be reached; only its own inline script and the worker it makes may run. */
export const ITEM_BOX_CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; frame-ancestors 'self'";

/**
 * The box's rules for a world that may itself be shown in a frame by its visitors' client (protocol/02-doors.md,
 * "A client that keeps the screen"). A page says who may be above it all the way up: the box is in its world, and
 * the world is then in the client, so the box has to let that client be above it too or it won't start there.
 *
 * Only who may be above the box changes, and only by that one site: what the box may reach is the same nothing.
 * `client` is the client's origin, as the world's own rules name it. Anything that isn't one https origin, and
 * no client at all, gives the box's ordinary rules.
 */
export function itemBoxCsp(client?: string): string {
  if (typeof client !== "string") return ITEM_BOX_CSP;
  let origin = "";
  try {
    const at = new URL(client);
    if (at.protocol === "https:" && at.origin === client && /^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(client)) origin = at.origin;
  } catch {
    /* not an address */
  }
  return origin ? `${ITEM_BOX_CSP} ${origin}` : ITEM_BOX_CSP;
}

/** What goes round a script inside the worker: the one object it is given, and nothing else. */
const WORKER_HEAD = `"use strict";
const __on = Object.create(null);
let __timers = [];
let __now = 0;
const __ask = (name, args) => postMessage({ t: "ask", name, args });
const item = Object.freeze({
  on(event, fn) { if (typeof fn === "function") __on[String(event)] = fn; },
  play(name) { __ask("play", [String(name)]); },
  clip(name) { __ask("clip", [String(name)]); },
  send(name, how) { __ask("send", [String(name), { speed: Number(how && how.speed), stick: Number(how && how.stick), lift: Number(how && how.lift), spread: Number(how && how.spread) }]); },
  show(text) { __ask("show", [String(text)]); },
  after(ms, fn) { if (typeof fn === "function" && __timers.length < 32) __timers.push({ at: __now + Math.max(0, Number(ms) || 0), fn }); },
});
const __run = (fn, arg) => { try { fn(arg); } catch (err) { postMessage({ t: "error", text: String(err).slice(0, 200) }); } };
onmessage = (e) => {
  const m = e.data;
  if (!m || m.t !== "event") return;
  if (m.name === "tick") {
    __now = Number(m.arg) || 0;
    const due = __timers.filter((x) => x.at <= __now);
    __timers = __timers.filter((x) => x.at > __now);
    for (const x of due) __run(x.fn);
  }
  if (__on[m.name]) __run(__on[m.name], m.arg);
  postMessage({ t: "beat", n: m.n });
};
try {
(function (item, self, globalThis, postMessage, onmessage, navigator, location, fetch, XMLHttpRequest, WebSocket, EventSource, BroadcastChannel, indexedDB, caches, importScripts, Worker, close) {
`;
const WORKER_TAIL = `
})(item);
postMessage({ t: "started" });
} catch (err) { postMessage({ t: "error", text: String(err).slice(0, 200) }); }
`;

/**
 * The box's page, whole. A world's build writes it out as `item-box.html`. It takes a script by message from the
 * page that frames it, runs it in a worker, passes events in and asks out, and ends the worker if it stops
 * answering.
 */
export const ITEM_BOX_HTML = `<!doctype html>
<meta charset="utf-8">
<title>An item's locked box</title>
<script>
"use strict";
(() => {
  const EVENTS = ${JSON.stringify(ITEM_EVENTS)};
  const SILENT = ${SCRIPT_LIMITS.silentMs};
  const MOST = ${SCRIPT_LIMITS.bytes};
  const HEAD = ${JSON.stringify(WORKER_HEAD)};
  const TAIL = ${JSON.stringify(WORKER_TAIL)};
  let worker = null;
  let sent = 0;
  let answered = 0;
  // When the script last answered anything, or last had nothing to answer. It is ended only if something has been
  // waiting on it since then for too long: a busy device, with one thing always on its way in, is not a hung script.
  let lastWord = 0;
  // Seen silent once already. A page that was itself held up for a moment finds the script's answers waiting for
  // it when it comes back: so silence has to be seen twice, with a turn between for those answers to be read.
  let suspect = false;
  const up = (m) => parent.postMessage(Object.assign({ nswpItemBox: 1 }, m), "*");
  const stop = (why) => {
    if (!worker) return;
    worker.terminate();
    worker = null;
    up({ t: "stopped", why });
  };
  const start = (script) => {
    stop("replaced");
    if (typeof script !== "string" || script.length > MOST) return up({ t: "stopped", why: "too long" });
    try {
      worker = new Worker(URL.createObjectURL(new Blob([HEAD, script, TAIL], { type: "text/javascript" })));
    } catch (err) {
      return up({ t: "stopped", why: "no worker" });
    }
    sent = answered = 0;
    suspect = false;
    lastWord = performance.now();
    worker.onmessage = (e) => {
      const m = e.data;
      if (!m) return;
      if (m.t === "beat") { answered = Math.max(answered, Number(m.n) || 0); lastWord = performance.now(); suspect = false; }
      else if (m.t === "ask") up({ t: "ask", name: String(m.name), args: m.args });
      else if (m.t === "started") up({ t: "started" });
      else if (m.t === "error") up({ t: "error", text: String(m.text).slice(0, 200) });
    };
    worker.onerror = (e) => { up({ t: "error", text: String(e && e.message).slice(0, 200) }); stop("failed"); };
  };
  addEventListener("message", (e) => {
    if (e.source !== parent) return;
    const m = e.data;
    if (!m || m.nswpItemBox !== 1) return;
    if (m.t === "run") start(m.script);
    else if (m.t === "stop") stop("asked");
    else if (m.t === "event" && worker && EVENTS.includes(m.name)) {
      if (answered >= sent) lastWord = performance.now();
      sent += 1;
      worker.postMessage({ t: "event", name: m.name, arg: m.arg, n: sent });
    }
  });
  // A script that has stopped answering is ended: it can hang nothing but itself.
  setInterval(() => {
    if (!worker || sent <= answered || performance.now() - lastWord <= SILENT) return void (suspect = false);
    if (suspect) stop("silent");
    else suspect = true;
  }, 300);
  up({ t: "ready" });
})();
</script>
`;
