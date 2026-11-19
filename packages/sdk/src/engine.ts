/**
 * The kit for an engine that isn't written in JavaScript: Godot, Unity, or
 * anything else that exports to a web page.
 *
 * A world is a website, and what makes a website a world is small and has
 * nothing to do with how it draws: reading how the visitor arrived from the
 * page's address, and sending them on through their own Airlock. This is
 * those things and nothing else, as one script with no rendering in it, for
 * the page that holds an engine's canvas.
 *
 * Every engine has some way to call the page's JavaScript and pass text. So
 * everything here takes text and gives text back: JSON in, JSON out, nothing
 * thrown across the join, nothing that needs waiting for.
 *
 *   <script src="nswp-engine.js"></script>
 *   const a = JSON.parse(NSWP.start('{"airlock":"https://portal.example/go/"}'));
 *   // a.entry, a.immersive, a.joined, a.moving ... : how they arrived
 *   NSWP.go('{"url":"https://gallery.example/"}', '{"immersive":true}');
 *   NSWP.home('{}');
 *
 * Built into engines/nswp-engine.js by scripts/build-engine.mjs.
 *
 * It also carries the kit's own menu and sounds (engine-menu.ts), which need
 * no renderer: `menu()`, `events()`, `play()`, `moved()`.
 *
 * What an engine draws for itself: its doors, other people, and the
 * crossing's room. What it doesn't get here yet: rooms (voices and other
 * visitors), which need more than text to pass through.
 */
import { checkDestination, KIT_VERSION, type PortalDestination } from "@nswp/core";
import { arrival as arrivals, configure, portal, startingForm, type GoOptions } from "./index.js";

export { bump, check, claim, door, events, headset, kit, menu, moved, open, play, presence, run, say, target, view } from "./engine-menu.js";

/** Bumped when what the functions take or give changes, so an engine's side can tell. */
export const VERSION = 7;
/** The kit this script was built from, as a world's manifest should say it (`"kit": NSWP.KIT`). */
export const KIT = KIT_VERSION;

const read = (text: unknown): Record<string, unknown> => {
  try {
    const v: unknown = typeof text === "string" && text ? JSON.parse(text) : text;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** What the visitor's state adds to the link that takes them on, from what the engine says of it. Nothing unknown passes. */
function stateOf(text: unknown): GoOptions {
  const s = read(text);
  return {
    immersive: s.immersive === true,
    ...(s.joined === true ? { joined: true, ...(s.mic === true ? { mic: true } : {}) } : {}),
    ...(s.moving === "intense" ? { moving: "intense" as const } : {}),
    ...(Array.isArray(s.blocked) ? { blocked: s.blocked.filter((k): k is string => typeof k === "string") } : {}),
  };
}

/**
 * How the visitor arrived, as JSON. Reading it takes it out of the page's
 * address, as it must be: an arrival is for this visit and not for whoever
 * the address is shared with next.
 *
 * `form` is how to lay things out for them on a flat screen: "touch" or
 * "desk". It is how they were in the place they came from, where this device
 * can do the same, and otherwise what the device is.
 *
 * `settings` is what they had set where they came from (volumes, text size
 * and the rest). The menu and the sounds here begin from them already; an
 * engine with an interface of its own may read them too.
 *
 * `arrived` is false for someone who came by an ordinary link, and every
 * other field then has its plain value. `name` and `pubkey` are filled only
 * when they came by name and their pass checks out for this site; otherwise
 * `guest` is true. `canGoHome` says whether `home()` would lead anywhere, and
 * `signIn()` with it: both go to the visitor's own client.
 */
export function arrival(): string {
  const { context, warnings } = arrivals.read();
  const who = arrivals.identity();
  return JSON.stringify({
    arrived: !!context,
    entry: context?.entry ?? "",
    immersive: context?.immersive === true,
    home: arrivals.atHome(),
    joined: context?.joined === true,
    mic: context?.mic === true,
    moving: context?.moving ?? "casual",
    form: startingForm(),
    settings: context?.settings ?? {},
    blocked: context?.blocked ?? [],
    look: arrivals.look() ?? "",
    guest: !who,
    name: who?.name ?? "",
    pubkey: who?.pubkey ?? "",
    canGoHome: portal.airlockFor() !== null,
    warnings: warnings.map((w) => w.code),
  });
}

/**
 * Call once when the page comes up. `options` is JSON: `airlock` is the
 * Airlock to send a visitor through when they arrived without one of their
 * own. Returns what `arrival()` returns.
 */
export function start(options?: string): string {
  const o = read(options);
  if (typeof o.airlock === "string" && o.airlock) configure({ defaultAirlock: o.airlock });
  return arrival();
}

/**
 * Send the visitor through a door. `destination` is JSON with `url`, and
 * `naddr` and `entryPoint` if the door has them. `state` is JSON saying how
 * they are leaving: `immersive` (from a headset session, which the engine
 * ends first), `joined`, `mic`, `moving`, `blocked`.
 *
 * Returns "" when they are on their way, or one word for why not: the page
 * is about to be left, so there is nothing to wait for.
 */
export function go(destination: string, state?: string): string {
  const d = read(destination);
  const dest: PortalDestination = {
    ...(typeof d.url === "string" ? { url: d.url } : {}),
    ...(typeof d.naddr === "string" ? { naddr: d.naddr } : {}),
    ...(typeof d.entryPoint === "string" ? { entryPoint: d.entryPoint } : {}),
  };
  if (!dest.url && !dest.naddr) return "no_destination";
  if (dest.url) {
    const checked = checkDestination(dest.url);
    if (!checked.ok) return checked.error.code;
  }
  void portal.go(dest, stateOf(state)).catch(() => {});
  return "";
}

/** Take the visitor home: their own client's start. Returns false, and does nothing, when there is no way there. */
export function home(state?: string): boolean {
  if (portal.airlockFor() === null) return false;
  void portal.home(stateOf(state));
  return true;
}

/**
 * The visitor asked to say who they are: to sign in, switch to another
 * profile, or go on as a guest. A world never asks that itself, so this
 * leaves for their own client, which asks them in its own way and brings them
 * back here, by name if they chose that. The menu offers it; call this from a
 * button of your own if you draw one. Returns false, and does nothing, when
 * they came through no client.
 */
export function signIn(state?: string): boolean {
  if (portal.airlockFor() === null) return false;
  void portal.signIn(stateOf(state));
  return true;
}

/**
 * The visitor asked to change how they look. Their look is kept by their own
 * client and is the same in every world, so this leaves for it and brings
 * them back here wearing it. The menu offers it (a `figure` event); call this
 * then, or from a button of your own. A world never edits a look itself.
 */
export function changeLook(state?: string): boolean {
  if (portal.airlockFor() === null) return false;
  void portal.changeLook(stateOf(state));
  return true;
}

/** Take the visitor to their doors: for a world that is someone's home, which offers this where it offers the way home. */
export function doors(state?: string): boolean {
  if (portal.airlockFor() === null) return false;
  void portal.doors(stateOf(state));
  return true;
}
