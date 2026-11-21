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

/**
 * Say this place has come up, and listen for what the client says of the screen. Once a page; does nothing for a
 * world opened as a page of its own.
 */
export function meetClient(): void {
  if (met || !framed()) return;
  met = true;
  addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window.parent) return;
    const said = e.data as { nswp?: unknown; holds?: unknown; filled?: unknown } | null;
    if (!said || typeof said !== "object" || said.nswp !== "screen" || typeof said.holds !== "boolean") return;
    const was = `${holds}${filled}`;
    holds = said.holds;
    filled = said.filled === true;
    if (was !== `${holds}${filled}`) for (const fn of watchers) fn();
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
  watchers.clear();
}
