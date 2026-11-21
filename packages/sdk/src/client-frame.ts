/**
 * A world shown inside its visitor's client (protocol/02-doors.md, "A client that keeps the screen").
 *
 * A client can keep one page on the screen and show each world in a frame inside it, so a filled screen isn't
 * given up at every door. The world in the frame is then not given the screen to fill (a frame that filled it
 * would take the client's with it when it left): the client holds it. So the world asks the client, in a few
 * words passed between the two pages, and the visitor's own control for it works as it does anywhere.
 *
 * What is said, and all that is said:
 *
 * - the world, as it loads: `{ nswp: "here", at }`, where `at` is its own path. So the client knows the place in
 *   its frame came up (and can go to it the ordinary way if it didn't), and where to come back to.
 * - the client, in answer and whenever it changes: `{ nswp: "screen", holds: true, filled }`.
 * - the world, at the visitor's press: `{ nswp: "screen", fill }`. A browser fills a screen only on a press, and a
 *   press in a frame counts for the page that holds it.
 *
 * And, where the client can show the sign-in address's own panel over the world, so that signing in doesn't take a
 * window either (which would give up the screen):
 *
 * - the client says so in the same answer: `signIn`, the sign-in address the panel is for.
 * - the world, at the visitor's press: `{ nswp: "sign-in", mode, menu? }`. `mode` is what the panel is for ("ask":
 *   let this world sign; "switch": another account; "account": the account's own pages; "files": their own
 *   files; "wallet": their own wallet; "library": what they have bought). `menu` is where the
 *   world's menu is on the screen, so the panel can be drawn in its place.
 * - the client, as the panel comes and goes: `{ nswp: "sign-in", open }`, with `failed` if it never came up, and
 *   `allowed` as it goes if the sign-in address said the visitor allowed this world.
 *
 * The panel is the sign-in address's page, drawn by the client above the world: this page can't see into it or
 * touch it. Whether the visitor said yes is learned from the world's own signer, as it always was.
 *
 * Nothing about the visitor is in any of it. Words are taken only from the page directly above this one, which a
 * world's own rules have already said may frame it (`frame-ancestors`).
 */

/** Whether this page is inside another. */
export const framed = (): boolean => {
  try {
    return typeof window !== "undefined" && window.parent !== window;
  } catch {
    return false;
  }
};

let holds = false;
let filled = false;
let met = false;
const watchers = new Set<() => void>();
/** The sign-in address the client shows a panel for, by its origin, or null. */
let signInAt: string | null = null;
let panelOpen = false;
/** The panel was asked for and never came up: on this page signing in takes a window from now on. */
let panelFailed = false;
const panelWatchers = new Set<(open: boolean, failed: boolean, allowed: boolean) => void>();

/** What a panel can be asked for. */
export type ClientPanelMode = "ask" | "switch" | "account" | "files" | "wallet" | "library";
/** Where the world's menu is on the screen, in CSS pixels: its left edge, its width, and how far its foot is from the bottom. */
export interface MenuPlace {
  left: number;
  width: number;
  bottom: number;
}
let menuPlace: (() => MenuPlace | null) | null = null;
/** For the menu: say where it is, when asked, so a panel can be drawn in its place. */
export function setMenuPlace(fn: (() => MenuPlace | null) | null): void {
  menuPlace = fn;
}

/** Whether the page above this one has said it holds the screen. False for a world opened as a page of its own. */
export const clientHoldsScreen = (): boolean => holds;
/** Whether it has the screen filled just now. */
export const clientScreenFilled = (): boolean => holds && filled;
/** Be told when either changes. */
export function onClientScreen(fn: () => void): () => void {
  watchers.add(fn);
  return () => void watchers.delete(fn);
}

const say = (words: Record<string, unknown>): void => {
  try {
    // To whoever is above: there is nothing in these words that matters who reads them.
    window.parent.postMessage({ nswp: words.nswp, ...words }, "*");
  } catch {
    /* nobody to tell */
  }
};

/** Ask the client to fill the screen, or to give it back. Call it from the visitor's own press. */
export function askClientForScreen(fill: boolean): void {
  if (framed()) say({ nswp: "screen", fill });
}

/** The sign-in address the client above shows a panel for (its origin), or null: then signing in takes a window. */
export const clientSignsInAt = (): string | null => signInAt;
/** Whether that panel is up just now. */
export const clientPanelOpen = (): boolean => panelOpen;
/**
 * Be told when the panel comes and goes; whether it failed to come up at all; and, as it goes, whether the sign-in
 * address said the visitor allowed this world. That last is a hint for not waiting on a "no": what is really so
 * is asked of the world's own signer.
 */
export function onClientSignIn(fn: (open: boolean, failed: boolean, allowed: boolean) => void): () => void {
  panelWatchers.add(fn);
  return () => void panelWatchers.delete(fn);
}
/**
 * Ask the client to show the sign-in address's panel. Call it from the visitor's own press: a client shows it for
 * nothing else. False where the client has no panel to show.
 */
export function askClientForSignIn(mode: ClientPanelMode = "ask"): boolean {
  if (!framed() || !signInAt) return false;
  let menu: MenuPlace | null = null;
  try {
    menu = menuPlace?.() ?? null;
  } catch {
    /* drawn where the client thinks best, then */
  }
  say({ nswp: "sign-in", mode, ...(menu ? { menu } : {}) });
  return true;
}

/** An address as the origin of a secure site, or null. */
const secureOrigin = (address: unknown): string | null => {
  if (typeof address !== "string" || address.length > 200) return null;
  try {
    const u = new URL(address);
    return u.protocol === "https:" && u.origin === address.replace(/\/$/, "") ? u.origin : null;
  } catch {
    return null;
  }
};

/**
 * Say this place has come up, and listen for what the client says of the screen. Once a page; does nothing for a
 * world opened as a page of its own.
 */
export function meetClient(): void {
  if (met || !framed()) return;
  met = true;
  addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window.parent) return;
    const said = e.data as { nswp?: unknown; holds?: unknown; filled?: unknown; signIn?: unknown; open?: unknown; failed?: unknown; allowed?: unknown } | null;
    if (!said || typeof said !== "object") return;
    if (said.nswp === "sign-in" && typeof said.open === "boolean") {
      const failed = !said.open && said.failed === true;
      // A panel that never came up isn't asked for again on this page: the next press opens a window, as before.
      if (failed) {
        panelFailed = true;
        signInAt = null;
      }
      if (panelOpen === said.open && !failed) return;
      panelOpen = said.open;
      for (const fn of panelWatchers) fn(panelOpen, failed, !said.open && said.allowed === true);
      if (failed) for (const fn of watchers) fn();
      return;
    }
    if (said.nswp !== "screen" || typeof said.holds !== "boolean") return;
    const was = `${holds}${filled}${signInAt}`;
    holds = said.holds;
    filled = said.filled === true;
    // Said once, with the first answer; a client that stops saying it hasn't taken it back.
    if (said.signIn !== undefined && !panelFailed) signInAt = secureOrigin(said.signIn);
    if (was !== `${holds}${filled}${signInAt}`) for (const fn of watchers) fn();
  });
  let at = "/";
  try {
    at = `${location.pathname}${location.search}`.slice(0, 300);
  } catch {
    /* the root, then */
  }
  say({ nswp: "here", at });
}

// Said as early as this is loaded: a client waits to hear that the place in its frame came up at all.
meetClient();

/** For tests: forget who was met. */
export function resetClientFrame(): void {
  holds = false;
  filled = false;
  signInAt = null;
  panelOpen = false;
  panelFailed = false;
  menuPlace = null;
  watchers.clear();
  panelWatchers.clear();
}
