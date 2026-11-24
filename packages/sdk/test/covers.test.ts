import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { portAbove, type MenuAbove } from "../src/menu-above.js";
import { keepMenu } from "../src/menu-keeper.js";
import { resetSettings } from "../src/settings.js";
import type { Hud } from "../src/ui/hud.js";
import { createControls } from "../src/ui/model.js";
import { portBelow } from "../src/ui/port-below.js";
import { keepSheet } from "../src/ui/sheet-box.js";

/**
 * The view clear of the menu (docs/plans/the-clients-menu.md, section 15; `covers`). Where its client draws the
 * menu, a world is told what of its view the menu covers, and answers the two calls a world's own menu has
 * (`cover()`, `bounds()`) from that. The pages are stand-ins; the words between them are the kit's own.
 */
const kept = new Map<string, string>();
beforeEach(() => {
  vi.useFakeTimers();
  kept.clear();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
  resetSettings();
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { localStorage?: unknown }).localStorage;
  resetSettings();
});

const NONE = { top: 0, bottom: 0, left: 0, right: 0 };
const HAS = { nswp: "menu", has: true, v: 1, settings: {} };

describe("a world whose client has the menu", () => {
  /** A world 1000 by 600, and the page above it. */
  const world = () => {
    const controls = createControls({ title: "The Gallery" });
    let hear: ((word: unknown) => void) | null = null;
    const above = portAbove(controls, { view: () => ({ w: 1000, h: 600 }), above: { framed: () => true, sinceHere: () => 0, say: () => {}, hear: (fn) => void (hear = fn) } });
    return { above, from: (word: unknown) => hear?.(word) };
  };

  it("knows nothing is covered until it is told", () => {
    const { above, from } = world();
    expect(above.menu.cover()).toEqual(NONE);
    expect(above.menu.bounds()).toEqual([]);
    from(HAS);
    expect(above.menu.cover()).toEqual(NONE);
    expect(above.menu.bounds()).toEqual([]);
  });

  it("answers what its client said: the edges for what is always there, a box for each part", () => {
    const { above, from } = world();
    from(HAS);
    from({ nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0 } });
    expect(above.menu.cover()).toEqual({ top: 48, bottom: 64, left: 0, right: 0 });
    expect(above.menu.bounds()).toEqual([
      { x: 0, y: 0, width: 1000, height: 48 },
      { x: 0, y: 536, width: 1000, height: 64 },
    ]);
  });

  it("is told of the sheet as a box, and never as an edge: a view moved clear of the edges stays still", () => {
    const { above, from } = world();
    from(HAS);
    from({ nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0 } });
    const before = above.menu.cover();
    from({ nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0, sheet: { x: 110, y: 100, width: 780, height: 420 } } });
    expect(above.menu.cover()).toEqual(before);
    expect(above.menu.bounds()).toContainEqual({ x: 110, y: 100, width: 780, height: 420 });
    from({ nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0 } });
    expect(above.menu.cover()).toEqual(before);
    expect(above.menu.bounds()).toHaveLength(2);
  });

  it("is told of a bar at a side too", () => {
    const { above, from } = world();
    from(HAS);
    from({ nswp: "menu", covers: { top: 0, bottom: 0, left: 72, right: 30 } });
    expect(above.menu.cover()).toEqual({ top: 0, bottom: 0, left: 72, right: 30 });
    expect(above.menu.bounds()).toEqual([
      { x: 0, y: 0, width: 72, height: 600 },
      { x: 970, y: 0, width: 30, height: 600 },
    ]);
  });

  it("reads more of a side than the view has as the whole side, and a sheet as what of it is over the view", () => {
    const { above, from } = world();
    from(HAS);
    from({ nswp: "menu", covers: { top: 5000, bottom: 64, left: 0, right: 8192, sheet: { x: 900, y: 500, width: 780, height: 420 } } });
    expect(above.menu.cover()).toEqual({ top: 600, bottom: 64, left: 0, right: 1000 });
    expect(above.menu.bounds()).toContainEqual({ x: 900, y: 500, width: 100, height: 100 });
  });

  it("takes nothing of it from a page that hasn't said it has the menu, and nothing that is not the word", () => {
    const { above, from } = world();
    from({ nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0 } });
    expect(above.menu.cover()).toEqual(NONE);
    from(HAS);
    for (const covers of [{ top: 48, bottom: 64 }, { top: -1, bottom: 0, left: 0, right: 0 }, { top: 9000, bottom: 0, left: 0, right: 0 }, { top: 1.5, bottom: 0, left: 0, right: 0 }, 64, "all of it"]) from({ nswp: "menu", covers });
    expect(above.menu.cover()).toEqual(NONE);
  });

  it("forgets it when its client no longer has the menu", () => {
    const { above, from } = world();
    from(HAS);
    from({ nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0 } });
    from({ nswp: "menu", has: false });
    expect(above.menu.cover()).toEqual(NONE);
    expect(above.menu.bounds()).toEqual([]);
    // And a client that takes it up again has said nothing yet.
    from(HAS);
    expect(above.menu.cover()).toEqual(NONE);
  });
});

describe("the kept menu answers the same two calls, whoever draws", () => {
  const make = (has: boolean) => {
    const controls = createControls({ title: "The Gallery" });
    const above: MenuAbove = {
      ready: Promise.resolve(has),
      has,
      onChange: () => () => {},
      menu: { open: false, setOpen: () => {}, cover: () => ({ top: 48, bottom: 64, left: 0, right: 0 }), bounds: () => [{ x: 0, y: 0, width: 1000, height: 48 }] },
      dispose: () => {},
    };
    const own = { open: false, setOpen: () => {}, setHidden: () => {}, remove: () => {}, cover: () => ({ top: 40, bottom: 56, left: 0, right: 0 }), bounds: () => [{ x: 0, y: 544, width: 1000, height: 56 }] } as unknown as Hud;
    return keepMenu(controls, above, () => own);
  };

  it("from the world's own menu where the world draws it", async () => {
    const menu = make(false);
    await menu.ready;
    expect(menu.cover()).toEqual({ top: 40, bottom: 56, left: 0, right: 0 });
    expect(menu.bounds()).toEqual([{ x: 0, y: 544, width: 1000, height: 56 }]);
  });

  it("from the client's word where the client draws it", async () => {
    const menu = make(true);
    await menu.ready;
    expect(menu.cover()).toEqual({ top: 48, bottom: 64, left: 0, right: 0 });
    expect(menu.bounds()).toEqual([{ x: 0, y: 0, width: 1000, height: 48 }]);
  });

  it("and nothing while hidden, as in a headset session, whoever draws", async () => {
    for (const has of [false, true]) {
      const menu = make(has);
      await menu.ready;
      menu.setHidden(true);
      expect(menu.cover()).toEqual(NONE);
      expect(menu.bounds()).toEqual([]);
      menu.setHidden(false);
      expect(menu.cover().bottom).toBeGreaterThan(0);
    }
  });
});

describe("a client says what its menu covers of the frame", () => {
  const WORLD = "https://gallery.example";
  /**
   * A client's page 1200 by 800 with the world's frame in it, and a menu that covers 48 at the top of the page and
   * 64 at the bottom. `at` is where the frame is in the page; `scaled` is how much this page has scaled it.
   */
  const client = (o: { at?: { left: number; top: number; width: number; height: number }; scaled?: number } = {}) => {
    const at = o.at ?? { left: 0, top: 0, width: 1200, height: 800 };
    const scaled = o.scaled ?? 1;
    const controls = createControls({ title: "The client" });
    const sent: Record<string, unknown>[] = [];
    const win = { postMessage: (word: Record<string, unknown>) => void sent.push(word) };
    const frame = {
      contentWindow: win,
      addEventListener: () => {},
      removeEventListener: () => {},
      focus: () => {},
      offsetWidth: at.width / scaled,
      getBoundingClientRect: () => ({ left: at.left, top: at.top, right: at.left + at.width, bottom: at.top + at.height, width: at.width, height: at.height }),
    } as unknown as HTMLIFrameElement;
    let onMessage: (e: MessageEvent) => void = () => {};
    let time = 1000;
    const below = portBelow(frame, { controls, origin: "https://client.example", view: () => ({ w: 1200, h: 800 }), now: () => time, hear: { addEventListener: (_t, fn) => void (onMessage = fn), removeEventListener: () => {} } });
    const covered = { top: 48, bottom: 64 };
    const sheet = { box: null as null | { x: number; y: number; width: number; height: number }, moving: false };
    const menu = { pressKey: () => {}, cover: () => ({ ...covered, left: 0, right: 0 }) };
    keepSheet(menu, () => ({ ...sheet }));
    const here = () => onMessage({ data: { nswp: "here", at: "/", menu: 1 }, origin: WORLD, source: win } as unknown as MessageEvent);
    const pass = (ms: number) => { time += ms; vi.advanceTimersByTime(ms); };
    return { below, controls, menu, covered, sheet, here, pass, covers: () => sent.filter((w) => w.covers !== undefined).map((w) => w.covers) };
  };

  it("with its answer that it has the menu: how far the menu reaches into the frame from each edge", () => {
    const c = client();
    c.below.attach(c.menu);
    c.here();
    expect(c.covers()).toEqual([{ top: 48, bottom: 64, left: 0, right: 0 }]);
  });

  it("says nothing of it where no menu is mounted, or the menu can't say what it covers", () => {
    const c = client();
    c.here();
    c.pass(1000);
    expect(c.covers()).toEqual([]);
    c.below.attach({ pressKey: () => {} });
    c.pass(1000);
    expect(c.covers()).toEqual([]);
  });

  it("says it once a menu is mounted, where the world came up first", () => {
    const c = client();
    c.here();
    c.below.attach(c.menu);
    c.pass(60);
    expect(c.covers()).toEqual([{ top: 48, bottom: 64, left: 0, right: 0 }]);
  });

  it("measures from the frame's own edges: a frame set in from the page's is covered by less", () => {
    // The frame starts 30 down and ends 20 above the foot of the page, and is 100 in from each side.
    const c = client({ at: { left: 100, top: 30, width: 1000, height: 750 } });
    c.below.attach(c.menu);
    c.here();
    expect(c.covers()).toEqual([{ top: 18, bottom: 44, left: 0, right: 0 }]);
  });

  it("a frame clear of the menu is covered by nothing, and is told so", () => {
    const c = client({ at: { left: 100, top: 60, width: 1000, height: 660 } });
    c.below.attach(c.menu);
    c.here();
    expect(c.covers()).toEqual([NONE]);
  });

  it("in pixels of the world's own page: a frame shown at half size is told twice the pixels", () => {
    const c = client({ scaled: 0.5 });
    c.below.attach(c.menu);
    c.here();
    expect(c.covers()).toEqual([{ top: 96, bottom: 128, left: 0, right: 0 }]);
  });

  it("nothing crosses while nothing changes", () => {
    const c = client();
    c.below.attach(c.menu);
    c.here();
    // Settings change, the menu comes and goes with no sheet over the frame, the window says it was resized.
    c.controls.setTheme({ scale: 1 }, true);
    c.pass(400);
    c.below.port.signal("menuOpen");
    c.pass(400);
    c.below.port.signal("menuClose");
    c.pass(400);
    expect(c.covers()).toHaveLength(1);
  });

  it("says it again when a number changes, and only then", () => {
    const c = client();
    c.below.attach(c.menu);
    c.here();
    c.covered.bottom = 80;
    c.controls.setTheme({ scale: 1 }, true);
    c.pass(200);
    expect(c.covers()).toEqual([{ top: 48, bottom: 64, left: 0, right: 0 }, { top: 48, bottom: 80, left: 0, right: 0 }]);
  });

  it("no oftener than eight times a second", () => {
    const c = client();
    c.below.attach(c.menu);
    c.here();
    // The bar grows a pixel every 10 ms for a second: a hundred changes.
    for (let i = 0; i < 100; i++) {
      c.covered.bottom++;
      c.controls.setTheme({ scale: 1 }, true);
      c.pass(10);
    }
    c.pass(500);
    const said = c.covers();
    expect(said.length).toBeLessThanOrEqual(1 + 8 + 1);
    // And the last one said is where it came to rest.
    expect(said.at(-1)).toEqual({ top: 48, bottom: 164, left: 0, right: 0 });
  });

  it("the sheet, while it is up: as its box in the frame, and gone again when it goes", () => {
    const c = client({ at: { left: 100, top: 0, width: 1000, height: 800 } });
    c.below.attach(c.menu);
    c.here();
    c.sheet.box = { x: 210, y: 150, width: 780, height: 500 };
    c.below.port.signal("menuOpen");
    c.pass(200);
    expect(c.covers().at(-1)).toEqual({ top: 48, bottom: 64, left: 0, right: 0, sheet: { x: 110, y: 150, width: 780, height: 500 } });
    c.sheet.box = null;
    c.below.port.signal("menuClose");
    c.pass(200);
    expect(c.covers().at(-1)).toEqual({ top: 48, bottom: 64, left: 0, right: 0 });
    expect(c.covers()).toHaveLength(3);
  });

  it("a sheet on its way is not said until it has come to rest, and then once", () => {
    const c = client();
    c.below.attach(c.menu);
    c.here();
    c.sheet.box = { x: 210, y: 700, width: 780, height: 500 };
    c.sheet.moving = true;
    c.below.port.signal("menuOpen");
    for (let i = 0; i < 4; i++) {
      c.pass(100);
      c.sheet.box = { x: 210, y: 700 - (i + 1) * 100, width: 780, height: 500 };
    }
    expect(c.covers()).toHaveLength(1);
    c.sheet.box = { x: 210, y: 150, width: 780, height: 500 };
    c.sheet.moving = false;
    c.pass(300);
    expect(c.covers()).toHaveLength(2);
    expect(c.covers().at(-1)).toEqual({ top: 48, bottom: 64, left: 0, right: 0, sheet: { x: 210, y: 150, width: 780, height: 500 } });
  });

  it("only as much of the sheet as is over the frame", () => {
    const c = client({ at: { left: 400, top: 200, width: 600, height: 400 } });
    c.below.attach(c.menu);
    c.here();
    c.sheet.box = { x: 210, y: 150, width: 780, height: 500 };
    c.below.port.signal("menuOpen");
    c.pass(200);
    expect(c.covers().at(-1)).toEqual({ ...NONE, sheet: { x: 0, y: 0, width: 590, height: 400 } });
  });

  it("a new page in the frame is told afresh, though nothing changed", () => {
    const c = client();
    c.below.attach(c.menu);
    c.here();
    c.here();
    expect(c.covers()).toHaveLength(2);
  });
});
