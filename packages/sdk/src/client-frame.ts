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

/**
 * The words for a row that reads what the visitor copied, when the browser refused the read. `copy` says what to
 * copy ("Copy an item's address").
 *
 * A world shown inside another site's page is not let read it whatever the visitor presses or allows: the page
 * above doesn't hand that down, and must not (docs/plans/the-clients-menu-presses.md). So there the words say why,
 * and what does work, where "allow this site" would send them looking for a switch that isn't there.
 */
export const copiedRefused = (copy: string, inFrame: boolean = framed()): string =>
  inFrame
    ? `What you copied can't be read in a world shown inside another page. Open this world by its own address, ${copy.charAt(0).toLowerCase()}${copy.slice(1)}, and press again.`
    : `What you copied couldn't be read here. ${copy}, allow this site to read what you copy, and press again.`;

/**
 * Whether this page may ask the browser to share the visitor's screen: true or false where the browser says, null
 * where it doesn't say. A page in another site's frame may only where that frame hands it down
 * (`display-capture`), and a client's frame does not and must not: the browser's own "choose what to share" names
 * the page above, not the world asking, and comes up with no press at all
 * (docs/plans/the-clients-menu-handed-over.md). Outside a frame it always may.
 */
export const mayShareScreen = (inFrame: boolean = framed()): boolean | null => {
  if (!inFrame) return true;
  try {
    const policy = (document as unknown as { permissionsPolicy?: { allowsFeature?(name: string): boolean }; featurePolicy?: { allowsFeature?(name: string): boolean } });
    const says = policy.permissionsPolicy?.allowsFeature ?? policy.featurePolicy?.allowsFeature;
    return typeof says === "function" ? says.call(policy.permissionsPolicy ?? policy.featurePolicy, "display-capture") === true : null;
  } catch {
    return null;
  }
};

/** The address of the page this one is shown inside, where the browser says; "" where it doesn't, or outside a frame. */
export const framedBy = (): string => {
  try {
    const above = framed() ? (location as unknown as { ancestorOrigins?: ArrayLike<string> }).ancestorOrigins?.[0] : undefined;
    return above ? new URL(above).host : "";
  } catch {
    return "";
  }
};

/**
 * What a world says where it can't share the visitor's screen because of the page it is shown inside: two lines,
 * each short enough for a row. The page above is named by its address where that is known and fits.
 */
export const screenNotHere = (by: string = framedBy()): [string, string] => {
  const named = `Sharing your screen isn't available in a world shown inside ${by}.`;
  return [by && named.length <= 120 ? named : "Sharing your screen isn't available in a world shown inside another page.", "Open this world by its own address."];
};

let holds = false;
let filled = false;
/** The version of the menu's words this page speaks, said in its `here` (protocol/02-doors.md, "The client has the menu"), or 0. */
let menuSpoken = 0;
/** When this page said `here`, by its own clock, or null before it has. */
let saidHereAt: number | null = null;
/** The menu's words from the page above, for the world's end of the menu's port (menu-above.ts). */
let menuHearer: ((word: unknown) => void) | null = null;
/** Those that came before anything listened: a client answers a `here` at once, and a world is still starting. */
let menuUnheard: unknown[] = [];
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

/**
 * Say, before this page's `here` goes, that it speaks the menu's words: once a client above says it has the menu,
 * this page draws no console of its own. Only the world's end of the menu's port calls it (menu-above.ts), as that
 * file is loaded: a page that said so and then drew its own console would leave the visitor with two.
 */
export function speakMenu(version: number): void {
  if (saidHereAt === null) menuSpoken = version;
}
/** How long ago this page said `here`, in milliseconds, or null if it hasn't (it isn't in a frame). */
export const sinceHere = (): number | null => (saidHereAt === null ? null : performance.now() - saidHereAt);
/**
 * Hear the menu's words from the page above, as they were sent: whoever listens reads them (`readMenuWordDown`).
 * One listener, the world's end of the port. It is given at once whatever came before it listened.
 */
export function hearClientMenu(fn: ((word: unknown) => void) | null): void {
  menuHearer = fn;
  if (!fn) return;
  const waiting = menuUnheard;
  menuUnheard = [];
  for (const word of waiting) fn(word);
}
/** Say one of the menu's words to the page above. Nothing about the visitor is ever in one. */
export function sayToClient(word: Record<string, unknown>): void {
  if (framed()) say({ ...word, nswp: "menu" });
}

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
    if (said.nswp === "menu") {
      if (menuHearer) menuHearer(said);
      // Kept only for a page that speaks these words, and only a few: a client says little before a world listens.
      else if (menuSpoken && menuUnheard.length < 32) menuUnheard.push(said);
      return;
    }
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
  // Said once the files loaded with this one have all run, and not a moment later: one of them may be the world's
  // end of the menu's port, which says as it loads that this page speaks the menu's words (`speakMenu`). `here` is
  // said once only: a client takes a second as the next page's.
  const hello = () => {
    saidHereAt = performance.now();
    say({ nswp: "here", at, ...(menuSpoken ? { menu: menuSpoken } : {}) });
  };
  if (typeof queueMicrotask === "function") queueMicrotask(hello);
  else hello();
}

// Said as early as this is loaded: a client waits to hear that the place in its frame came up at all.
meetClient();

/**
 * Where what this world would save goes, while its client has the menu. A press on the client's menu is not a
 * press in this page, and a browser may refuse a page a save it wasn't pressed for. So a picture or a clip is
 * handed up, as the answer to the visitor's press on a row that saves, and the client's page saves it. Set by the
 * world's end of the menu's words (`menu-above.ts`); nothing, where no client has the menu.
 */
let saver: { handUp(file: Blob): boolean; waits(): boolean; making?(): boolean } | null = null;
export function setSaver(next: { handUp(file: Blob): boolean; waits(): boolean; making?(): boolean } | null): void {
  saver = next;
}
/**
 * This page has begun making what a press asked it to save, and it may take a while: a picture drawn afresh at its
 * full size, on a slow device. Said once to the client, as the answer to that press, so that the press is held open
 * for longer (`MENU_MAKING_MS`) and the visitor is told. Call it as the making starts, before anything is waited
 * for. Nothing, where no press on the client's menu is waiting for something to save.
 *
 * True where the word was said. **It has then only been said, not sent:** a page's word to the page above leaves
 * once the script that said it has finished. A world that goes straight on to something long (drawing a picture is
 * one long piece of script) is heard only when that is done. So where this is true, let the script end first
 * (`await sent()`), and then begin.
 */
export const making = (): boolean => saver?.making?.() ?? false;
/** A turn of the page's own, after which a word just said to the page above has gone. */
export const sent = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
/** Hand something to save up to the client. False where it isn't the client's to save just now: this page saves it. */
export const handUp = (file: Blob): boolean => saver?.handUp(file) ?? false;
/**
 * Whether something to save should be kept for a press: a client has the menu, and no press on a row that saves
 * is waiting for it. Saving it from this page would be a save nobody pressed for.
 */
export const savesWait = (): boolean => saver?.waits() ?? false;

/** For tests: forget who was met. */
export function resetClientFrame(): void {
  saver = null;
  holds = false;
  filled = false;
  signInAt = null;
  panelOpen = false;
  panelFailed = false;
  menuPlace = null;
  menuHearer = null;
  menuUnheard = [];
  watchers.clear();
  panelWatchers.clear();
}
