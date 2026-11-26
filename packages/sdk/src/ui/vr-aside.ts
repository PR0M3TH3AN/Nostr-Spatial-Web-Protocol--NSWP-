/**
 * Out of VR for a moment, and back in one press (docs/backlog/bitlogin-from-a-headset.md, everything-in-vr.md). The
 * owner, 2026-11-25: "just make it as rare and a seemless as possible", and "the only thing that should force us out
 * of VR is the initial phone pairing and the browsers immurrsive VR site to site limitation".
 *
 * A headset draws nothing but the world, so BitLogin's own screens (its panel, its window, its page for signing in
 * from a phone) can't be seen in one. Where a press needs one, `outOfVr` ends the session itself and opens it, in
 * that same press; then "Back into VR" is up over the page, pressable once BitLogin's screen has gone, and one press
 * goes back in where they were (place, facing, what is in hand: ending a session moves nothing).
 *
 * Kept small and replaceable: only the few reasons in `VR_ASIDE` come here, and a test of the kit's own source holds
 * it to them (packages/sdk/test/vr-aside.test.ts). Once BitLogin's screens are drawn in VR for a visitor who chose
 * that, the wallet's, Files', buying's and an Allow's go away from here. The kit's own; not in any entry.
 */
import type { Controls } from "./model.js";
import { onClientSignIn } from "../client-frame.js";

/** Why a press goes out of VR: the few things only BitLogin's own screens can do. */
/**
 * `file`: a file from the headset's own storage, for a row that takes one. No browser lets a page pick one inside
 * immersive VR, the same kind of limit as going from site to site (given 2026-11-25). For a visitor who chose BitLogin's
 * VR way, their BitLogin Files will be offered in VR instead, once BitLogin's half is released.
 */
export const VR_ASIDE = ["sign-in", "secure", "wallet", "files", "buy", "allow", "file"] as const;
export type VrAsideWhy = (typeof VR_ASIDE)[number];

/**
 * What the press opened. `shown`: whether BitLogin's screen is up (false: the browser refused a window). `gone`: when
 * it has gone again (closed, or answered), and "Back into VR" may be pressed.
 */
export interface Opened {
  shown: boolean;
  gone: Promise<void>;
}

/** What a page with a headset session lends `outOfVr` (three.ts, `addViewControls`). */
export interface VrAsideHost {
  presenting(): boolean;
  /** End the session. Nothing about where they stand or what they hold changes. */
  end(): Promise<void>;
  /** Put up "Back into VR", pressable once `waiting` is done. */
  back(waiting: Promise<void>): void;
  /** Put up one press that opens BitLogin, where the browser refused to from inside VR; then "Back into VR". */
  openFromHere(open: () => Opened): void;
}

const hosts = new WeakMap<Controls, VrAsideHost>();

/** Said by `addViewControls` for the controls of a page that can be in a headset. */
export function hostVrAside(controls: Controls, host: VrAsideHost): void {
  hosts.set(controls, host);
}

/** The one line before the first time, on this device. */
export const VR_ASIDE_WORDS = "This opens BitLogin outside VR for a moment. Press Back into VR when you're done.";
const TOLD_KEY = "nswp:vr-aside-told";
const toldBefore = (): boolean => {
  try {
    if (globalThis.localStorage?.getItem(TOLD_KEY)) return true;
    globalThis.localStorage?.setItem(TOLD_KEY, "1");
  } catch {
    /* a private window: told each time, which is no harm */
  }
  return false;
};

/**
 * Open BitLogin's screen for `why`, from the visitor's press. Out of a headset it just opens. In one, the session is
 * ended, the screen opened in the same press, and "Back into VR" put up; where a window was refused, one press on
 * the flat page opens it.
 */
export function outOfVr(controls: Controls, open: () => Opened, why: VrAsideWhy): Opened {
  if (!(VR_ASIDE as readonly string[]).includes(why)) throw new Error(`outOfVr: ${why} is not one of VR_ASIDE`);
  const host = hosts.get(controls);
  if (!host || !host.presenting()) return open();
  if (!toldBefore()) controls.say(VR_ASIDE_WORDS);
  // Opened first, while the press is still a press: a window is let open only from one.
  const opened = open();
  void host.end().then(() => (opened.shown ? host.back(opened.gone) : host.openFromHere(open)));
  return opened;
}

/** A window of BitLogin's: gone once it is closed. Watched, since a closed window says nothing. */
export function whenWindowGone(win: Window | null): Promise<void> {
  if (!win) return Promise.resolve();
  return new Promise((done) => {
    const look = setInterval(() => {
      if (!win.closed) return;
      clearInterval(look);
      done();
    }, 400);
  });
}

/**
 * BitLogin's screen opened by the signer or the client, which could be the client's panel or a window: gone when
 * the client says its panel has closed, or, for a window, when this page has the focus back.
 */
export function whenScreenGone(panel: boolean): Promise<void> {
  return new Promise((done) => {
    if (panel) {
      let seen = false;
      const finish = () => {
        stop();
        clearTimeout(cap);
        done();
      };
      const stop = onClientSignIn((open) => {
        if (open) seen = true;
        else if (seen) finish();
      });
      // A panel that never came up, or is left open: this stops watching after a while all the same.
      const cap = setTimeout(finish, 600_000);
      return;
    }
    const back = () => {
      removeEventListener("focus", back);
      done();
    };
    // A window takes the focus as it opens: this page has it back only once it has gone, or been put aside.
    setTimeout(() => addEventListener("focus", back), 300);
  });
}
