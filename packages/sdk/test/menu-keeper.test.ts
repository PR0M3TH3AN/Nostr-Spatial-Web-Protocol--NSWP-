import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MenuAbove } from "../src/menu-above.js";
import { keepMenu } from "../src/menu-keeper.js";
import { resetSettings } from "../src/settings.js";
import type { Hud } from "../src/ui/hud.js";
import { createControls } from "../src/ui/model.js";

/**
 * One menu, never two (docs/plans/the-clients-menu.md, section 6): the rule every place that wires a menu keeps,
 * tried here with a stand-in for the page above and stand-ins for the menus themselves.
 */
const kept = new Map<string, string>();
beforeEach(() => {
  kept.clear();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
  resetSettings();
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
  resetSettings();
});

const tick = () => new Promise((ok) => setTimeout(ok, 0));

const make = (o: { has?: boolean; known?: boolean } = {}) => {
  const controls = createControls({ title: "The Gallery" });
  let has = o.has === true;
  let settle: (has: boolean) => void = () => {};
  const ready = new Promise<boolean>((ok) => (settle = ok));
  if (o.known !== false) settle(has);
  const watchers = new Set<(has: boolean) => void>();
  const asked: boolean[] = [];
  let menuOpen = false;
  const above: MenuAbove = {
    ready,
    get has() {
      return has;
    },
    onChange: (fn) => (watchers.add(fn), () => void watchers.delete(fn)),
    menu: { get open() { return menuOpen; }, setOpen: (open) => void asked.push(open) },
    dispose: () => {},
  };
  /** Every menu mounted, by kind, and whether it is still on the page. */
  const mounted: { only: string; on: boolean; hidden: boolean }[] = [];
  const waiting: (() => void)[] = [];
  let slow = false;
  const menu = (only: string): Hud => {
    const m = { only, on: true, hidden: false };
    mounted.push(m);
    return { open: false, setOpen: () => {}, setHidden: (h: boolean) => void (m.hidden = h), remove: () => void (m.on = false) } as unknown as Hud;
  };
  const mount = (only?: "chat") => (slow ? new Promise<Hud>((ok) => waiting.push(() => ok(menu(only ?? "whole")))) : menu(only ?? "whole"));
  const keeper = keepMenu(controls, above, mount);
  const say = (next: boolean) => {
    has = next;
    settle(has);
    for (const fn of [...watchers]) fn(has);
  };
  return { controls, keeper, say, mounted, on: () => mounted.filter((m) => m.on).map((m) => m.only), asked, arrive: () => waiting.splice(0).forEach((fn) => fn()), slowly: () => (slow = true), openAbove: () => (menuOpen = true) };
};

describe("who draws the menu", () => {
  it("is the world, where nobody above has it", async () => {
    const w = make();
    await w.keeper.ready;
    expect(w.on()).toEqual(["whole"]);
    expect(w.keeper.own).not.toBeNull();
  });

  it("is nobody here, where the client has it", async () => {
    const w = make({ has: true });
    await w.keeper.ready;
    expect(w.on()).toEqual([]);
    expect([w.keeper.own, w.keeper.chatPane]).toEqual([null, false]);
  });

  it("waits for the answer before drawing anything", async () => {
    const w = make({ known: false });
    await tick();
    expect(w.mounted).toEqual([]);
    w.say(false);
    await w.keeper.ready;
    expect(w.on()).toEqual(["whole"]);
  });

  it("becomes the client when it answers late, and the world again when it stops", async () => {
    const w = make();
    await w.keeper.ready;
    w.say(true);
    await tick();
    expect(w.on()).toEqual([]);
    w.say(false);
    await tick();
    expect(w.on()).toEqual(["whole"]);
    expect(w.mounted).toHaveLength(2);
  });
});

describe("a client that answers while the world's own menu is on its way", () => {
  it("has that menu put away as it arrives: one menu, never two", async () => {
    const w = make();
    w.slowly();
    await tick();
    expect(w.mounted).toEqual([]);
    // The world gave up waiting and asked for its menu; the client answers before it comes.
    w.say(true);
    w.arrive();
    await tick();
    expect(w.on()).toEqual([]);
    expect(w.keeper.own).toBeNull();
  });

  it("asks for its menu once, however often the answer changes while it is on its way", async () => {
    const w = make();
    w.slowly();
    await tick();
    w.say(true);
    w.say(false);
    w.say(true);
    w.say(false);
    w.arrive();
    await tick();
    expect(w.on()).toEqual(["whole"]);
    expect(w.mounted.filter((m) => m.only === "whole")).toHaveLength(1);
  });
});

describe("the chat's pane, kept by a world whose client has the menu", () => {
  it("is mounted only once there is something to write to", async () => {
    const w = make({ has: true });
    await w.keeper.ready;
    expect(w.on()).toEqual([]);
    w.controls.chat.attach(() => null);
    await tick();
    expect(w.on()).toEqual(["chat"]);
    expect(w.keeper.chatPane).toBe(true);
  });

  it("goes when the client stops having the menu, and the whole menu takes its place", async () => {
    const w = make({ has: true });
    await w.keeper.ready;
    w.controls.chat.attach(() => null);
    await tick();
    w.say(false);
    await tick();
    expect(w.on()).toEqual(["whole"]);
  });

  it("asks the client's menu to go as the chat comes up, so the frame has the keys to write with", async () => {
    const w = make({ has: true });
    await w.keeper.ready;
    w.openAbove();
    w.controls.signal("chatOpen");
    expect(w.asked).toEqual([false]);
  });

  it("is never mounted in a world that draws its own menu", async () => {
    const w = make();
    await w.keeper.ready;
    w.controls.chat.attach(() => null);
    await tick();
    expect(w.on()).toEqual(["whole"]);
  });
});

describe("what this page draws", () => {
  it("is hidden and shown together, and a menu that comes later is hidden too", async () => {
    const w = make({ has: true });
    await w.keeper.ready;
    w.keeper.setHidden(true);
    w.say(false);
    await tick();
    expect(w.mounted.at(-1)).toMatchObject({ only: "whole", on: true, hidden: true });
  });

  it("is all put away when the keeping stops, and nothing more is drawn", async () => {
    const w = make();
    await w.keeper.ready;
    w.keeper.remove();
    w.say(true);
    w.say(false);
    await tick();
    expect(w.on()).toEqual([]);
  });
});
