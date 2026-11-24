import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeWorld, portAbove } from "../src/menu-above.js";
import { resetSettings } from "../src/settings.js";
import { createControls } from "../src/ui/model.js";
import { portBelow, WORLDS } from "../src/ui/port-below.js";

/**
 * The menu comes up on a tab at a world's asking (`show`; protocol/02-doors.md, "The client has the menu";
 * docs/backlog/menu-opens-on-a-tab.md). A world's row that opened its own menu on a tab ("Change how you look")
 * asks its client for the same. It is a word of its own and not the visitor's summons: it never puts a menu away,
 * and a world can't hold the menu up with it against the visitor. The pages are stand-ins; the words are the kit's.
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

const HAS = { nswp: "menu", has: true, v: 1, settings: {} };

describe("a world asks for the menu on a tab", () => {
  const world = () => {
    const controls = createControls({ title: "The Gallery" });
    const sent: Record<string, unknown>[] = [];
    let hear: ((word: unknown) => void) | null = null;
    const above = portAbove(controls, { above: { framed: () => true, sinceHere: () => 0, say: (word) => void sent.push(word), hear: (fn) => void (hear = fn) } });
    return { controls, above, from: (word: unknown) => hear?.(word), shows: () => sent.filter((w) => w.show !== undefined), keys: () => sent.filter((w) => w.key !== undefined) };
  };

  it("says so upward where its own menu would have come up there, with the tab's id and nothing else", () => {
    const w = world();
    w.from(HAS);
    w.controls.signal("show:figure");
    expect(w.shows()).toEqual([{ show: "figure" }]);
    expect(w.keys()).toEqual([]);
  });

  it("says nothing where no client has the menu: its own menu hears the asking itself", () => {
    const w = world();
    w.controls.signal("show:figure");
    expect(w.shows()).toEqual([]);
  });

  it("asks by the tab's id through the kept menu's own call, and that is never the summons", () => {
    const w = world();
    w.from(HAS);
    w.above.menu.setOpen(true, "figure");
    expect(w.shows()).toEqual([{ show: "figure" }]);
    // With the client's menu already up, asking for a tab is still the asking, and not a key that would close it.
    w.from({ nswp: "menu", open: true });
    w.above.menu.setOpen(true, "people");
    expect(w.shows()).toEqual([{ show: "figure" }, { show: "people" }]);
    expect(w.keys()).toEqual([]);
  });

  it("with no tab named, bringing the menu up is the visitor's summons as it was", () => {
    const w = world();
    w.from(HAS);
    w.above.menu.setOpen(true);
    expect(w.keys()).toEqual([{ key: "summon" }]);
    expect(w.shows()).toEqual([]);
  });
});

describe("a client honours it, and is never held up by it", () => {
  const WORLD = "https://gallery.example";
  const client = () => {
    const controls = createControls({ title: "The client" });
    controls.add({ id: "look-size", section: "figure", label: "Bigger", act: () => {} });
    const win = { postMessage: () => {} };
    const frame = { contentWindow: win, addEventListener: () => {}, removeEventListener: () => {}, focus: () => {} } as unknown as HTMLIFrameElement;
    let onMessage: (e: MessageEvent) => void = () => {};
    let time = 1000;
    const below = portBelow(frame, { controls, origin: "https://client.example", now: () => time, hear: { addEventListener: (_t, fn) => void (onMessage = fn), removeEventListener: () => {} } });
    /** Every time the menu was told to come up or go, and on which tab. */
    const told: [boolean, string | undefined][] = [];
    let up = false;
    const set = (open: boolean, at?: string) => {
      told.push([open, at]);
      if (open === up) return;
      up = open;
      below.port.signal(open ? "menuOpen" : "menuClose");
    };
    below.attach({ pressKey: () => {}, setOpen: set });
    const from = (data: unknown) => onMessage({ data, origin: WORLD, source: win } as unknown as MessageEvent);
    from({ nswp: "here", at: "/", menu: 1 });
    // The world describes a row of its own, which the visitor can press in this menu.
    const w = createControls({ title: "The Gallery" });
    w.add({ id: "room-join", section: "room", label: "Join the room", act: () => {} });
    from({ nswp: "menu", world: describeWorld(w.view()) });
    told.length = 0;
    const pass = (ms: number) => { time += ms; vi.advanceTimersByTime(ms); };
    /** The visitor brings the menu up, or puts it away, themselves. */
    const visitor = (open: boolean) => { if (open !== up) { up = open; below.port.signal(open ? "menuOpen" : "menuClose"); } };
    return { below, told, from, pass, visitor, show: (tab?: unknown) => from({ nswp: "menu", show: tab === undefined ? "" : tab }), isUp: () => up, cameUp: () => told.filter(([open]) => open).length };
  };

  it("the menu comes up on the tab named", () => {
    const c = client();
    c.show("figure");
    expect(c.told).toEqual([[true, "figure"]]);
  });

  it("a show that is no id brings the menu up with no tab named: where it last was", () => {
    for (const tab of ["your look", true, undefined]) {
      const c = client();
      c.show(tab);
      expect(c.told, String(tab)).toEqual([[true, undefined]]);
    }
  });

  it("a tab it doesn't have yet is handed on as it was asked for: the menu keeps the asking a short while", () => {
    // A world may ask for a tab of its own before its description of that tab has arrived. The port doesn't drop
    // the asking for that; the menu comes up where it last was and goes to the tab if it comes soon (hud.ts,
    // `MENU_SHOW_KEEP_MS`; trials/menu-rows.mjs and the show visit of trials/menu-client.mjs hold that part).
    const c = client();
    c.show("no-such-tab");
    expect(c.told).toEqual([[true, "no-such-tab"]]);
  });

  it("it never puts the menu away", () => {
    const c = client();
    c.show("figure");
    c.below.port.run(`${WORLDS}room-join`);
    c.show("figure");
    c.show();
    c.pass(5000);
    c.show("figure");
    expect(c.told.every(([open]) => open)).toBe(true);
    expect(c.isUp()).toBe(true);
  });

  it("with the menu up on another tab, it is honoured in answer to a press of the world's row, and once", () => {
    const c = client();
    c.visitor(true);
    c.below.port.run(`${WORLDS}room-join`);
    c.pass(100);
    c.show("figure");
    expect(c.told).toEqual([[true, "figure"]]);
    // Said twice: the second is not an answer to any press.
    c.show("room");
    expect(c.told).toEqual([[true, "figure"]]);
  });

  it("with the menu up and no press, a world can't move the visitor about in it", () => {
    const c = client();
    c.visitor(true);
    for (let i = 0; i < 50; i++) {
      c.show("figure");
      c.pass(200);
    }
    expect(c.told).toEqual([]);
    // Nor long after a press: a second is the whole of an answer's time.
    c.below.port.run(`${WORLDS}room-join`);
    c.pass(1500);
    c.show("figure");
    expect(c.told).toEqual([]);
  });

  it("the visitor's closing wins: for two seconds nothing a world says brings the menu back", () => {
    const c = client();
    c.visitor(true);
    c.visitor(false);
    c.pass(1900);
    c.show("figure");
    expect(c.told).toEqual([]);
    c.pass(200);
    c.show("figure");
    expect(c.told).toEqual([[true, "figure"]]);
  });

  it("a world that says it again and again can't hold the menu up: each closing is waited out for longer", () => {
    const c = client();
    // The world asks ten times a second for five minutes; the visitor puts the menu away the moment it comes up.
    const at: number[] = [];
    for (let i = 0; i < 3000; i++) {
      c.show("figure");
      if (c.isUp()) {
        at.push(i / 10);
        c.visitor(false);
      }
      c.pass(100);
    }
    // At once, then after 4, 8, 16, 32 seconds, and then a minute apart: nine times in five minutes, not three thousand.
    expect(at.slice(0, 5).map(Math.round)).toEqual([0, 4, 12, 28, 60]);
    expect(at.length).toBeLessThanOrEqual(9);
    for (let i = 5; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(60);
  });

  it("and is forgiven once the visitor uses what it showed: the rest is two seconds again", () => {
    const c = client();
    for (let i = 0; i < 3; i++) {
      c.pass(70_000);
      c.show("figure");
      c.visitor(false);
    }
    // The fourth time they press something in it before putting it away.
    c.pass(70_000);
    c.show("figure");
    c.below.port.run(`${WORLDS}room-join`);
    c.visitor(false);
    const before = c.cameUp();
    c.pass(2100);
    c.show("figure");
    expect(c.cameUp()).toBe(before + 1);
  });

  it("does nothing where no menu is mounted, or the menu can't be brought up from here", () => {
    const controls = createControls({ title: "The client" });
    const win = { postMessage: () => {} };
    const frame = { contentWindow: win, addEventListener: () => {}, removeEventListener: () => {}, focus: () => {} } as unknown as HTMLIFrameElement;
    let onMessage: (e: MessageEvent) => void = () => {};
    const below = portBelow(frame, { controls, origin: "https://client.example", hear: { addEventListener: (_t, fn) => void (onMessage = fn), removeEventListener: () => {} } });
    const from = (data: unknown) => onMessage({ data, origin: WORLD, source: win } as unknown as MessageEvent);
    from({ nswp: "here", at: "/", menu: 1 });
    expect(() => from({ nswp: "menu", show: "figure" })).not.toThrow();
    const keys: string[] = [];
    below.attach({ pressKey: (k) => void keys.push(k) });
    from({ nswp: "menu", show: "figure" });
    expect(keys).toEqual([]);
  });
});
