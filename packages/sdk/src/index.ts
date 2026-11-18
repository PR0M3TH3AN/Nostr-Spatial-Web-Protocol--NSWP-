/**
 * nswp-sdk — the world-side library (spec §6.6).
 *
 *   import { arrival, portal } from "nswp-sdk";
 *   const ctx = arrival.read();          // reads, validates and scrubs #nswp=
 *   portal.go({ naddr, url, entryPoint }); // sends the user through an Airlock
 *
 * Which Airlock (spec §6.3): the return address from the arrival context,
 * else the world's configured default, else a built-in confirmation screen.
 */
import {
  arrivalParam,
  buildAirlockUrl,
  buildArrivalUrl,
  checkDestination,
  decodeArrival,
  stripArrivalParam,
  type Arrival,
  type Issue,
  type PortalDestination,
} from "@nswp/core";

export type { Arrival, PortalDestination } from "@nswp/core";
export { room, RoomSession, type JoinOptions, type Member, type RoomStatus } from "./room.js";
export type { Pose, Transform } from "@nswp/core";

const RETURN_KEY = "nswp:return-airlock";
const LOOK_KEY = "nswp:look";

let defaultAirlock: string | undefined;
let cached: { context: Arrival | null; warnings: Issue[] } | undefined;

export function configure(opts: { defaultAirlock?: string }): void {
  if (opts.defaultAirlock !== undefined) {
    const chk = checkDestination(opts.defaultAirlock);
    if (!chk.ok) throw new Error(`nswp-sdk: defaultAirlock must be an https URL (${chk.error.code})`);
    defaultAirlock = chk.value.url;
  }
}

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const arrival = {
  /**
   * Read the arrival context once, then remove it from the URL so it doesn't
   * linger in history or reach third-party scripts. Call this before loading
   * any third-party code. Later calls return the same result.
   */
  read(): { context: Arrival | null; warnings: Issue[] } {
    if (cached) return cached;
    const raw = arrivalParam(location.hash);
    if (!raw) {
      cached = { context: null, warnings: [] };
      return cached;
    }
    history.replaceState(history.state, "", `${location.pathname}${location.search}${stripArrivalParam(location.hash)}`);
    const r = decodeArrival(raw);
    cached = r.ok ? { context: r.value, warnings: r.warnings } : { context: null, warnings: [...r.errors, ...r.warnings] };
    if (cached.context?.airlock) {
      try {
        session()?.setItem(RETURN_KEY, cached.context.airlock);
      } catch {
        /* storage may be unavailable */
      }
    }
    // Arriving through an Airlock says how to be seen on this visit: with a look, or plain.
    if (cached.context) {
      try {
        if (cached.context.look) session()?.setItem(LOOK_KEY, cached.context.look);
        else session()?.removeItem(LOOK_KEY);
      } catch {
        /* storage may be unavailable */
      }
    }
    return cached;
  },

  /**
   * The look this visitor arrived wearing, in its inline form (spec §4.2), or
   * undefined if they came plain. Hand it to a room so others see them as
   * they chose to be seen. Kept for this tab's session only.
   */
  look(): string | undefined {
    try {
      return session()?.getItem(LOOK_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  },

  /** The Airlock this visitor came from, for this tab's session only. */
  returnAirlock(): string | undefined {
    try {
      return session()?.getItem(RETURN_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  },
};

export interface GoOptions {
  /** End this immersive session before leaving (recommended in XR). */
  xrSession?: XRSession | null;
  /** Override the Airlock choice (tests, dedicated browsers). */
  airlock?: string;
}

export const portal = {
  /** Which Airlock `go()` would use right now, or null for the built-in screen. */
  airlockFor(opts: GoOptions = {}): string | null {
    return opts.airlock ?? arrival.returnAirlock() ?? defaultAirlock ?? null;
  },

  async go(dest: PortalDestination, opts: GoOptions = {}): Promise<void> {
    if (!dest.naddr && !dest.url) throw new Error("nswp-sdk: portal destination needs an naddr or a url");
    if (dest.url) {
      const chk = checkDestination(dest.url);
      if (!chk.ok) throw new Error(`nswp-sdk: refusing portal destination (${chk.error.code})`);
    }
    if (opts.xrSession) {
      try {
        await opts.xrSession.end();
      } catch {
        /* already ended */
      }
    }
    if (typeof window.nswp?.navigate === "function") {
      window.nswp.navigate(dest);
      return;
    }
    const airlock = portal.airlockFor(opts);
    if (airlock) {
      location.assign(buildAirlockUrl(airlock, dest));
      return;
    }
    showFallback(dest);
  },

  /**
   * Take the visitor back to their own client's start place (spec §6.3): the
   * Airlock they came through, opened with no destination. Returns false, and
   * does nothing, when there is no Airlock to go back to.
   */
  async home(opts: GoOptions = {}): Promise<boolean> {
    const airlock = portal.airlockFor(opts);
    if (!airlock) return false;
    if (opts.xrSession) {
      try {
        await opts.xrSession.end();
      } catch {
        /* already ended */
      }
    }
    location.assign(airlock);
    return true;
  },
};

declare global {
  interface Window {
    /** A future dedicated browser may provide native navigation (spec §6.6). */
    nswp?: { navigate?: (dest: PortalDestination) => void };
  }
}

/**
 * The built-in fallback (spec §6.3 step 3): destination origin and a confirm
 * button, nothing else. Never asks for credentials or identity.
 */
function showFallback(dest: PortalDestination): void {
  const chk = dest.url ? checkDestination(dest.url) : null;
  const host = document.createElement("div");
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(0,0,0,.72);font:16px/1.4 system-ui,sans-serif;color:#fff";
  const card = document.createElement("div");
  card.style.cssText = "background:#16181d;border:1px solid #333;border-radius:12px;padding:24px;max-width:min(92vw,480px)";
  const h = document.createElement("p");
  h.textContent = "This portal leads to:";
  h.style.margin = "0 0 8px";
  const where = document.createElement("p");
  where.style.cssText = "margin:0 0 16px;font-size:1.6em;word-break:break-all";
  if (chk?.ok) {
    const pre = document.createElement("span");
    pre.textContent = chk.value.hostPrefix;
    pre.style.opacity = "0.6";
    const dom = document.createElement("strong");
    dom.textContent = chk.value.registrableDomain ?? chk.value.hostname;
    where.append(pre, dom);
  } else where.textContent = "A world this page can't look up without an Airlock.";
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:12px;justify-content:flex-end";
  const cancel = document.createElement("button");
  cancel.textContent = "Stay here";
  const go = document.createElement("button");
  go.textContent = "Continue";
  for (const b of [cancel, go]) b.style.cssText = "font:inherit;padding:10px 18px;border-radius:8px;border:1px solid #555;background:#23262d;color:#fff;cursor:pointer";
  go.style.background = "#2f6df6";
  go.disabled = !chk?.ok;
  cancel.onclick = () => host.remove();
  go.onclick = () => {
    if (chk?.ok) location.assign(buildArrivalUrl(chk.value.url, dest.entryPoint ? { entry: dest.entryPoint } : {}));
  };
  row.append(cancel, go);
  card.append(h, where, row);
  host.append(card);
  document.body.append(host);
  go.focus();
}
