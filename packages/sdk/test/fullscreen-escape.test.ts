import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fullscreen, Escape and the button at the top (ui/fullscreen.ts). The owner, 2026-11-21: "a little fullscreen
 * button ... at the top center", and in fullscreen "Escape once should not exit full screen. It should pull up the
 * menu. Escape again from the menu should exit full screen." A browser lets a page hold Escape in fullscreen only
 * where the Keyboard Lock API is offered (Chromium); these stand in for a page with and without it.
 */
type Fullscreen = typeof import("../src/ui/fullscreen.js");
let fs: Fullscreen;
let doc: EventTarget & { fullscreenElement: unknown; fullscreenEnabled: boolean; documentElement: { requestFullscreen(): Promise<void> }; exitFullscreen(): Promise<void> };
let locked: string[][];
let lockOffered = true;

const fill = () => {
  doc.fullscreenElement = {};
  doc.dispatchEvent(new Event("fullscreenchange"));
};
const unfill = () => {
  doc.fullscreenElement = null;
  doc.dispatchEvent(new Event("fullscreenchange"));
};

beforeEach(async () => {
  vi.resetModules();
  locked = [];
  doc = Object.assign(new EventTarget(), {
    fullscreenElement: null as unknown,
    fullscreenEnabled: true,
    documentElement: { requestFullscreen: async () => fill() },
    exitFullscreen: async () => unfill(),
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("navigator", lockOffered ? { keyboard: { lock: async (keys: string[]) => void locked.push(keys), unlock: () => void locked.push([]) } } : {});
  fs = await import("../src/ui/fullscreen.js");
});
afterEach(() => {
  vi.unstubAllGlobals();
  lockOffered = true;
});

describe("what Escape does", () => {
  it("in fullscreen, where the page holds Escape: the first opens the menu, the next leaves fullscreen", () => {
    expect(fs.escapeDoes({ menuOpen: false, held: true })).toBe("open-menu");
    expect(fs.escapeDoes({ menuOpen: true, held: true })).toBe("leave-fullscreen");
  });

  it("otherwise as before: it closes an open menu, and does nothing to a closed one", () => {
    expect(fs.escapeDoes({ menuOpen: true, held: false })).toBe("close-menu");
    expect(fs.escapeDoes({ menuOpen: false, held: false })).toBe("nothing");
  });
});

describe("holding Escape in fullscreen", () => {
  it("holds it for every visitor while the screen is filled, where the browser lets it, and lets it go after", async () => {
    fs.watchEscape();
    expect(fs.escapeHeld()).toBe(false);
    fill();
    await Promise.resolve();
    await Promise.resolve();
    expect(locked).toEqual([["Escape"]]);
    expect(fs.escapeHeld()).toBe(true);
    unfill();
    expect(fs.escapeHeld()).toBe(false);
    expect(locked.at(-1)).toEqual([]);
  });

  it("says when the browser took the screen back by itself, and not when the page left it", async () => {
    fs.watchEscape();
    const left = vi.fn();
    fs.onBrowserLeftFullscreen(left);
    fill();
    await fs.leaveFullscreen();
    expect(left).not.toHaveBeenCalled();
    fill();
    unfill();
    expect(left).toHaveBeenCalledOnce();
  });
});

describe("holding Escape where the browser won't", () => {
  beforeEach(async () => {
    lockOffered = false;
    vi.resetModules();
    vi.stubGlobal("navigator", {});
    fs = await import("../src/ui/fullscreen.js");
  });

  it("holds nothing, so Escape leaves fullscreen as the browser insists, and the menu is told to come up", async () => {
    fs.watchEscape();
    const left = vi.fn();
    fs.onBrowserLeftFullscreen(left);
    fill();
    await Promise.resolve();
    expect(fs.escapeHeld()).toBe(false);
    unfill();
    expect(left).toHaveBeenCalledOnce();
  });
});

describe("the Full screen button at the top", () => {
  const controls = async () => {
    const { createControls } = await import("../src/ui/model.js");
    return createControls({ title: "A world" });
  };

  /** The device, as a page sees it: a mouse (a desk), or a touch screen only. */
  const device = (pointer: "fine" | "coarse") => vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes(pointer) }));

  it("shows on a desk while the screen isn't filled, hides once it is, and fills it when pressed", async () => {
    device("fine");
    const c = await controls();
    fs.fullscreenAction(c, () => false);
    expect(fs.fullscreenButton.shown()).toBe(true);
    expect(fs.fullscreenButton.label).toBe("Full screen");
    await fs.fullscreenButton.press(c);
    expect(doc.fullscreenElement).not.toBeNull();
    expect(fs.fullscreenButton.shown()).toBe(false);
    // Pressing it keeps a filled screen as what they prefer, as the menu's control does.
    expect(fs.prefersFullscreen()).toBe(true);
  });

  it("isn't on a touch screen: a phone that fills the screen at all keeps it in the menu", async () => {
    device("coarse");
    fs.fullscreenAction(await controls(), () => false);
    expect(fs.fullscreenButton.shown()).toBe(false);
  });

  it("never shows in a headset session, or where this page can't fill the screen", async () => {
    device("fine");
    const c = await controls();
    let presenting = true;
    fs.fullscreenAction(c, () => presenting);
    expect(fs.fullscreenButton.shown()).toBe(false);
    presenting = false;
    doc.fullscreenEnabled = false;
    expect(fs.fullscreenButton.shown()).toBe(false);
  });
});
