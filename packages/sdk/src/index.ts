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
  buildWayUrl,
  checkDestination,
  decodeArrival,
  localMap,
  stripArrivalParam,
  toLocal,
  verifyRoomPass,
  type Arrival,
  type Issue,
  type NostrEvent,
  type PortalDestination,
} from "@nswp/core";

import { arriveAs, currentForm, type Form } from "./form.js";
import { arriveWith, currentSettings } from "./settings.js";

export { arrivedSettings, arriveWith, currentSettings, reportSettings, type TravelSettings } from "./settings.js";

export type { Arrival, PortalDestination } from "@nswp/core";
export { currentForm, startingForm, type Form } from "./form.js";
export { room, RoomSession, type JoinOptions, type Member, type RoomStatus } from "./room.js";
export type { Pose, Transform } from "@nswp/core";
export { dropBrought, somethingBrought, takeBrought, watchBrought, type Brought } from "./bring.js";

const RETURN_KEY = "nswp:return-airlock";
const LOOK_KEY = "nswp:look";
const PASS_KEY = "nswp:pass";
const HOME_KEY = "nswp:at-home";

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
    // On a development server, find out now where the local copies are, so a door needn't wait (core, local.ts).
    void localMap();
    const raw = arrivalParam(location.hash);
    if (!raw) {
      cached = { context: null, warnings: [] };
      arriveAs(undefined);
      return cached;
    }
    history.replaceState(history.state, "", `${location.pathname}${location.search}${stripArrivalParam(location.hash)}`);
    const r = decodeArrival(raw);
    cached = r.ok ? { context: r.value, warnings: r.warnings } : { context: null, warnings: [...r.errors, ...r.warnings] };
    // The form they were in where they came from: this place starts them the same way, where the device can.
    arriveAs(cached.context?.form);
    // And the settings they had there: each part of the kit begins from them (settings.ts).
    arriveWith(cached.context?.settings);
    // Arriving any way but home ends being at home, for this tab.
    try {
      if (cached.context?.home) session()?.setItem(HOME_KEY, "1");
      else if (cached.context) session()?.removeItem(HOME_KEY);
    } catch {
      /* storage may be unavailable */
    }
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
        // And whether by name. A pass made for another site, or one that has run out, is not kept.
        const { pass, sessionKey } = cached.context;
        if (pass && sessionKey && verifyRoomPass(pass, { origin: location.origin }).ok) session()?.setItem(PASS_KEY, JSON.stringify({ pass, sessionKey }));
        else session()?.removeItem(PASS_KEY);
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

  /**
   * Who this visitor chose to be here, if they came by name
   * (protocol/10-identity.md): their public key, the name on their pass, and
   * the pass and session key to hand to a room. Checked against this site and
   * the clock each time; undefined for a guest, and once the pass has run out.
   * The world never sees their own key, only this throwaway one.
   */
  identity(): { pubkey: string; name: string; pass: NostrEvent; sessionKey: string } | undefined {
    try {
      const kept = JSON.parse(session()?.getItem(PASS_KEY) ?? "null") as { pass?: NostrEvent; sessionKey?: string } | null;
      if (!kept?.pass || typeof kept.sessionKey !== "string") return undefined;
      const checked = verifyRoomPass(kept.pass, { origin: location.origin });
      if (!checked.ok) {
        session()?.removeItem(PASS_KEY);
        return undefined;
      }
      return { pubkey: checked.value.pubkey, name: checked.value.name, pass: kept.pass, sessionKey: kept.sessionKey };
    } catch {
      return undefined;
    }
  },

  /** The Airlock this visitor came from, for this tab's session only. */
  /**
   * Whether this world is where the visitor starts: their own client brought
   * them home (NSWP-07). Remembered for the tab, so a refresh at home is
   * still at home. From here the way home leads nowhere new.
   */
  atHome(): boolean {
    try {
      return session()?.getItem(HOME_KEY) === "1";
    } catch {
      return false;
    }
  },

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
  /**
   * The visitor is in a headset session as they leave. Their Airlock passes
   * it on, so the next place can offer the way back in at once. Left out, it
   * is taken from whether `xrSession` was given.
   */
  immersive?: boolean;
  /**
   * The visitor is in this world's open room as they leave (`addRoomControls(...).travelling()`). Their Airlock
   * may pass it on, so they stay among people where they arrive (protocol/02-doors.md, "Staying joined").
   */
  joined?: boolean;
  /** Their microphone is on. Passed only with `joined`, and only kept by a client they have told it may be. */
  mic?: boolean;
  /**
   * Named people the visitor blocked here during this visit, by identity key (`travelling().blocked`). Their own
   * client asks whether to block them everywhere (protocol/02-doors.md, "Blocks that travel").
   */
  blocked?: string[];
  /**
   * What the visitor is using a flat screen with: their fingers or a mouse and keys. Left out, it is what they
   * last used here, which is nearly always right. It goes with them through a door, never on the way home.
   */
  form?: Form;
  /** The visitor is moving the intense way here (`fps.enabled` at a desk, `input.intense` in a headset), and would go on doing so where they arrive. */
  moving?: "intense" | "casual";
}

/** What a visitor's state adds to the link that takes them on. */
const carried = (opts: GoOptions, immersive: boolean) => ({
  immersive,
  ...(opts.joined ? { joined: true, ...(opts.mic ? { mic: true } : {}) } : {}),
  ...(opts.blocked?.length ? { blocked: opts.blocked } : {}),
  ...(opts.moving === "intense" ? { moving: "intense" as const } : {}),
  form: opts.form ?? currentForm(),
  // Their settings as they are now, so the next place needn't be set up again.
  settings: currentSettings(),
});

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
    const immersive = opts.immersive ?? !!opts.xrSession;
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
      // The Airlock's own address is followed to its local copy on a development server, and nowhere else.
      location.assign(await toLocal(buildAirlockUrl(airlock, dest, carried(opts, immersive))));
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
    const immersive = opts.immersive ?? !!opts.xrSession;
    if (opts.xrSession) {
      try {
        await opts.xrSession.end();
      } catch {
        /* already ended */
      }
    }
    // An Airlock opened with no destination is the way home. Saying "from a headset" doesn't make it a destination.
    location.assign(await toLocal(buildWayUrl(airlock, carried(opts, immersive))));
    return true;
  },

  /**
   * Take the visitor to their doors: their client's own place for them. For
   * most visitors that is where home is too. It is a different place for one
   * whose home is a world of their own, and a world that can be a home
   * offers this wherever it offers the way home (protocol/07-homes.md).
   */
  async doors(opts: GoOptions = {}): Promise<boolean> {
    const airlock = portal.airlockFor(opts);
    if (!airlock) return false;
    const immersive = opts.immersive ?? !!opts.xrSession;
    if (opts.xrSession) {
      try {
        await opts.xrSession.end();
      } catch {
        /* already ended */
      }
    }
    location.assign(await toLocal(buildWayUrl(airlock, { ...carried(opts, immersive), doors: true })));
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
    if (chk?.ok) void toLocal(buildArrivalUrl(chk.value.url, dest.entryPoint ? { entry: dest.entryPoint } : {})).then((to) => location.assign(to));
  };
  row.append(cancel, go);
  card.append(h, where, row);
  host.append(card);
  document.body.append(host);
  go.focus();
}
