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
import { createEngineCrossing, type EngineCrossing } from "./engine-crossing.js";
import { earlyMenu, loadingLine, onMenu, play as playCue, roomChanged, tellEngine } from "./engine-menu.js";
import { hereAs } from "./ui/identity.js";
import { arrival as arrivals, configure, portal, startingForm, type GoOptions } from "./index.js";

export { bump, check, claim, door, events, gate, headset, jumped, kit, load, menu, moved, offers, open, play, presence, run, save, say, target, view, who } from "./engine-menu.js";
export { frame } from "./engine-world.js";
export { items, itemSecond, itemsInfo, itemTap, itemUse, model } from "./engine-items.js";
export { board, figure, people, peopleInfo } from "./engine-people.js";
export { capturePreview, previewFaces, previewViews } from "./engine-panorama.js";
import { travellingNow } from "./engine-people.js";

/** Bumped when what the functions take or give changes, so an engine's side can tell. */
export const VERSION = 17;
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

// ------------------------------------------------------------------ the crossing's room
/**
 * The room a visitor arrives in and leaves from (engine-crossing.ts). It stands from the moment this script is
 * read, before the engine has begun to load, so that what a visitor sees between two worlds is the same room
 * whatever each is made with. A page that wants none says so on the script's tag: `data-crossing="off"`.
 */
const tag = typeof document !== "undefined" ? (document.currentScript as HTMLScriptElement | null) : null;
const hostOf = (url: string | null | undefined): string => {
  try {
    return url ? new URL(url, location.href).host : "";
  } catch {
    return "";
  }
};
const prefersStill = (): boolean => {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};
let room: EngineCrossing | null = null;
let holdDoors = false;
if (typeof document !== "undefined" && tag?.dataset.crossing !== "off") {
  // The world's name and colour, said on the page so the room wears them before the engine has loaded: two tags
  // in the page's head, or on this script's own tag. Without them, the page's title and the kit's own colour.
  const said = (name: string): string => document.querySelector<HTMLMetaElement>(`meta[name="nswp:${name}"]`)?.content ?? "";
  const accent = said("accent") || tag?.dataset.accent || "";
  room = createEngineCrossing({
    title: (said("title") || tag?.dataset.title || document.title || location.host).slice(0, 80),
    address: location.host,
    ...(accent ? { accent } : {}),
    still: prefersStill(),
  });
  room.onChange((state) => {
    roomChanged(state);
    tellEngine({ type: "crossing", state });
  });
  // The visitor's console, from now: Home and the address while the engine is still arriving, which can be minutes.
  // The world's own menu fills it in (`menu()`); a world that draws its own sees it go when its doors open.
  const roomTitle = (said("title") || tag?.dataset.title || document.title || location.host).slice(0, 80);
  // A script in the page's head runs before there is a body to put the console in: it waits for one.
  const mountEarly = () => earlyMenu({ title: roomTitle, ...(accent ? { accent } : {}), home: () => (arrivals.atHome() ? doors() : home()) });
  if (document.body) queueMicrotask(mountEarly);
  else document.addEventListener("DOMContentLoaded", mountEarly, { once: true });
  // The world named itself and its colour when it asked for its menu: the room wears them. And asking for a menu
  // is a world saying it is up, unless it said it will open the doors itself (`hold`).
  onMenu((look) => {
    room?.dress(look);
    holdDoors = look.hold === true;
    if (!holdDoors) ready();
  });
}

/** Where the crossing's room is: "arriving" (doors shut, the world loading), "opening", "none", "leaving", "shut", or "failed". */
export function crossing(): string {
  return room?.state ?? "none";
}

/**
 * How much of the world has arrived, from 0 to 1, or anything else (-1, say) for "loading, and nobody knows how much".
 *
 * - **Before the doors open,** the line of light over them fills. The page that starts the engine calls this as the
 *   engine downloads. `words` aren't shown there: the room's sign is the world's name and address.
 * - **Once the visitor is in** (after `ready()`, or asking for the menu, or on a page with no room), it is a line in the
 *   visitor's menu: `words` (plain text, at most 80 characters, "Loading the arena") and how far along. The menu,
 *   the way home and everything else work throughout. `loaded()`, or `loading(1)`, ends it.
 *
 * So a world that takes a while to be playable opens the doors as soon as there is something to see, and says what
 * it is still loading meanwhile, rather than keeping the visitor in the room.
 */
export function loading(fraction: number, words?: string): void {
  const f = typeof fraction === "number" && Number.isFinite(fraction) ? fraction : -1;
  if (room && room.state === "arriving") return void room.loading(f);
  if (f >= 1) return loaded();
  loadingLine({ ...(f >= 0 ? { fraction: f } : {}), ...(typeof words === "string" ? { words } : {}) });
}

/** The world has finished loading: the line in the visitor's menu that said it was still loading goes. */
export function loaded(): void {
  loadingLine(null);
}

/**
 * The world is ready to be stepped into: the doors open. Asking for the menu does this by itself, so a world calls
 * it only if it asked for its menu with `hold` true, to open the doors at a moment of its own choosing.
 */
export function ready(): void {
  if (!room || room.state !== "arriving") return;
  room.ready();
  if (arrivals.read().context) playCue("arrive");
}

/** The world couldn't start: the doors stay shut, and the sign says why. Plain words, shown as text. */
export function failed(words: string): void {
  room?.failed(typeof words === "string" && words ? words : "This world couldn't start.");
}

/** Shut the room's doors round the visitor, then go. Without a room, go at once. */
function leaveThen(to: { title: string; address: string }, going: () => void): void {
  if (!room || room.state === "leaving" || room.state === "shut") return going();
  // The sound of a crossing: the world's own, or the kit's.
  playCue("cross");
  void room.leave(to).then(going, going);
}

/** What the visitor's state adds to the link that takes them on, from what the engine says of it. Nothing unknown passes. */
function stateOf(text: unknown): GoOptions {
  const s = read(text);
  // Where this script keeps the room (engine-people.ts), it knows whether they are joined, and says so itself.
  const room = travellingNow();
  const joined = s.joined === true || room.joined === true;
  const blocked = [...(Array.isArray(s.blocked) ? s.blocked.filter((k): k is string => typeof k === "string") : []), ...(room.blocked ?? [])];
  return {
    immersive: s.immersive === true,
    ...(joined ? { joined: true, ...(s.mic === true || room.mic === true ? { mic: true } : {}) } : {}),
    ...(s.moving === "intense" ? { moving: "intense" as const } : {}),
    ...(blocked.length ? { blocked: [...new Set(blocked)] } : {}),
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
 * for someone signed in here, whose pass checks out for this site; otherwise
 * `guest` is true. It changes when they sign in or out in the menu: ask `who()`
 * when a `who` event comes. `canGoHome` says whether `home()` would lead anywhere, and
 * `signIn()` with it: both go to the visitor's own client.
 */
export function arrival(): string {
  const { context, warnings } = arrivals.read();
  // Who they are here: someone signed in here, and nobody else. Where their client named a sign-in address, a pass
  // they arrived with counts only once they have signed in at it (protocol/10-identity.md, "One sign-in").
  const who = hereAs();
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
 * own, and `signer` the sign-in address offered to a visitor no client
 * brought. Returns what `arrival()` returns.
 */
export function start(options?: string): string {
  const o = read(options);
  if (typeof o.airlock === "string" && o.airlock) configure({ defaultAirlock: o.airlock });
  // The signer offered to someone no client brought, so that signing in is the same however they came.
  if (typeof o.signer === "string") {
    try {
      configure({ defaultSigner: o.signer });
    } catch {
      /* not an https address: none is offered */
    }
  }
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
  const st = stateOf(state);
  const label = typeof d.title === "string" && d.title ? d.title.slice(0, 60) : hostOf(dest.url) || "another place";
  leaveThen({ title: label, address: hostOf(dest.url) }, () => void portal.go(dest, st).catch(() => {}));
  return "";
}

/** Take the visitor home: their own client's start. Returns false, and does nothing, when there is no way there. */
export function home(state?: string): boolean {
  const airlock = portal.airlockFor();
  if (airlock === null) return false;
  const st = stateOf(state);
  leaveThen({ title: "your home", address: hostOf(airlock) }, () => void portal.home(st));
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
  const airlock = portal.airlockFor();
  if (airlock === null) return false;
  const st = stateOf(state);
  leaveThen({ title: "your doors", address: hostOf(airlock) }, () => void portal.doors(st));
  return true;
}
