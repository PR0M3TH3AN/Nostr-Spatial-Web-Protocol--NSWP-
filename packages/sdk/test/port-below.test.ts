import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAVE_MS, MENU_LIMITS, MENU_SAVE_MS } from "@nswp/core";
import { describeWorld } from "../src/menu-above.js";
import { resetSettings } from "../src/settings.js";
import { createControls } from "../src/ui/model.js";
import { mergeView, portBelow, WORLDS, type MenuBelowOptions, type SavedAbout } from "../src/ui/port-below.js";

/**
 * The client's end of the menu's port (protocol/02-doors.md, "The client has the menu"): the client's own controls
 * with a framed world's tabs laid in, and the words between the two pages. The frame and its page are stand-ins.
 */
const WORLD = "https://gallery.example";
const CLIENT = "https://client.example";
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

/** A world's description, as its own end of the port would say it. */
const described = () => {
  const w = createControls({ title: "The Gallery" });
  w.add({ id: "home", section: "travel", label: "Go home", hotbar: true, act: () => {} });
  w.add({ id: "door-grove", section: "travel", label: "To the Grove", act: () => {} });
  w.add({ id: "room-join", section: "room", label: "Join the room", short: "Join", icon: "room", hotbar: true, act: () => {} });
  w.add({ id: "room-link", section: "room", label: "Copy the room's link", kind: "copy", copy: "https://gallery.example/#room", act: () => {} });
  w.add({ id: "guests-key", section: "guests", label: "Add someone by key", kind: "field", act: () => {} });
  w.addSection({ id: "shop", label: "Shop", icon: "save" });
  w.add({ id: "shop-print", section: "shop", label: "A print", act: () => {} });
  w.add({ id: "bag-steal", section: "bag", label: "Your bag, says the world", act: () => {} });
  return describeWorld(w.view());
};

const make = (o: { origin?: string; home?: (left: boolean) => void; more?: Partial<MenuBelowOptions> } = {}) => {
  const controls = createControls({ title: "The client" });
  const pressed: string[] = [];
  controls.add({ id: "home", section: "travel", label: "Home", icon: "home", hotbar: true, act: () => void pressed.push("home") });
  controls.add({ id: "bag-item", section: "bag", label: "A lantern", act: () => void pressed.push("bag-item") });
  const sent: { word: Record<string, unknown>; to: string }[] = [];
  const win = { postMessage: (word: Record<string, unknown>, to: string) => void sent.push({ word, to }) };
  const frameFns = new Map<string, () => void>();
  let focused = 0;
  const frame = { contentWindow: win, addEventListener: (t: string, fn: () => void) => void frameFns.set(t, fn), removeEventListener: (t: string) => void frameFns.delete(t), focus: () => void focused++ } as unknown as HTMLIFrameElement;
  let onMessage: (e: MessageEvent) => void = () => {};
  const below = portBelow(frame, {
    controls,
    also: ["following", "messages"],
    origin: CLIENT,
    hear: { addEventListener: (_t, fn) => void (onMessage = fn), removeEventListener: () => {} },
    ...(o.home ? { home: o.home } : {}),
    ...(o.more ?? {}),
  });
  const from = (data: unknown, origin = o.origin ?? WORLD, source: unknown = win) => onMessage({ data, origin, source } as MessageEvent);
  const here = (menu: number | undefined = 1, origin?: string) => from({ nswp: "here", at: "/", ...(menu ? { menu } : {}) }, origin);
  return { controls, below, sent, from, here, pressed, load: () => frameFns.get("load")?.(), focused: () => focused, words: () => sent.map((s) => s.word) };
};

describe("meeting the page in the frame", () => {
  it("answers a world that speaks the words at once, with the visitor's settings, to that world's origin only", () => {
    const c = make();
    c.here();
    expect(c.sent).toEqual([{ word: { nswp: "menu", has: true, v: 1, settings: {} }, to: WORLD }]);
    expect([c.below.speaks, c.below.origin]).toEqual([true, WORLD]);
  });

  it("says nothing to a page that doesn't speak them, and draws nothing of it", () => {
    const c = make();
    c.here(0);
    expect(c.sent).toEqual([]);
    expect(c.below.speaks).toBe(false);
    c.from({ nswp: "menu", world: described() });
    expect(c.below.world).toBeNull();
  });

  it("takes words only from the frame's own page, and only from the origin that said here", () => {
    const c = make();
    c.here();
    c.from({ nswp: "menu", world: described() }, WORLD, {});
    c.from({ nswp: "menu", world: described() }, "https://elsewhere.example");
    expect(c.below.world).toBeNull();
    c.from({ nswp: "menu", world: described() });
    expect(c.below.world?.title).toBe("The Gallery");
  });

  it("drops a world's description at the load of the next page, and at the next here", () => {
    const c = make();
    // The first page: it says here as its script starts, and then the frame's load is told. Nothing is dropped.
    c.here();
    c.load();
    c.from({ nswp: "menu", world: described() });
    expect([c.below.world?.title, c.below.speaks, c.below.origin]).toEqual(["The Gallery", true, WORLD]);
    // Another page loads and says nothing: the Gallery's name and tabs are gone.
    c.load();
    expect([c.below.world, c.below.speaks, c.below.origin]).toEqual([null, false, ""]);
    expect(c.below.port.view().title).toBe("The client");
    // It says here late, after its load: that is this page's, and the load after it drops it again.
    c.here();
    c.from({ nswp: "menu", world: described() });
    expect(c.below.world?.title).toBe("The Gallery");
    c.load();
    expect([c.below.world, c.below.speaks]).toEqual([null, false]);
    // A page that says here before its load, over one that had a description: the old one is gone at the here.
    c.here();
    c.from({ nswp: "menu", world: described() });
    c.here(0, "https://plain.example");
    expect([c.below.world, c.below.speaks, c.below.origin]).toEqual([null, false, "https://plain.example"]);
    c.load();
    expect(c.below.origin).toBe("https://plain.example");
  });
});

describe("what the menu draws over a world", () => {
  const drawn = () => {
    const c = make();
    c.here();
    c.from({ nswp: "menu", world: described() });
    return { c, view: c.below.port.view() };
  };

  it("is headed by the world's name, and the address the browser gave for it", () => {
    const { view } = drawn();
    expect([view.title, view.address]).toEqual(["The Gallery", "gallery.example"]);
  });

  it("has the client's own tabs and the world's, in the menu's own order, the world's own tab last and under its name", () => {
    const { view } = drawn();
    expect(view.sections.map((s) => [s.id, s.label])).toEqual([["travel", "Travel"], ["room", "Room"], ["guests", "Who comes in"], ["bag", "Bag"], ["look", "Display"], ["shop", "Shop · The Gallery"]]);
  });

  it("keeps the client's rows first in a tab both fill, and every id of the world's apart from the client's own", () => {
    const { view } = drawn();
    expect(view.sections[0]!.items.map((i) => i.id)).toEqual(["home", `${WORLDS}door-grove`]);
    // The world described a row in the visitor's Bag: it isn't there. The Bag is the client's alone.
    expect(view.sections.find((s) => s.id === "bag")!.items.map((i) => i.id)).toEqual(["bag-item"]);
  });

  it("puts the client's keys first on the bar, then the world's, numbered as they stand", () => {
    const { view } = drawn();
    expect(view.hotbar.map((i) => [i.id, i.key])).toEqual([["home", "1"], [`${WORLDS}room-join`, "2"]]);
    expect(view.sections.find((s) => s.id === "room")!.items[0]).toMatchObject({ key: "2", short: "Join", icon: "room" });
  });

  it("carries the two kinds of row the menu does itself", () => {
    const { view } = drawn();
    const rows = view.sections.flatMap((s) => s.items);
    expect(rows.find((r) => r.id === `${WORLDS}room-link`)).toMatchObject({ kind: "copy", copy: "https://gallery.example/#room" });
    expect(rows.find((r) => r.id === `${WORLDS}guests-key`)).toMatchObject({ kind: "field" });
  });

  it("is the client's own view where there is no world to lay in", () => {
    const c = make();
    expect(mergeView(c.controls.view(), null, { address: "", pins: [] })).toEqual(c.controls.view());
  });

  it("lets a world say how much room the console takes, and that it has taken the keys", () => {
    const c = make();
    c.here();
    c.from({ nswp: "menu", world: { ...described(), level: "quiet", corner: "top-right", keys: false } });
    const view = c.below.port.view();
    expect([view.presence, view.corner, view.keys, c.below.port.presence]).toEqual(["quiet", "top-right", { menu: null, hotbar: false, chat: null }, "quiet"]);
  });
});

describe("a tab both fill", () => {
  /** The client's own Sound and Help, and a world that adds what is its own to each. */
  const drawn = () => {
    const c = make();
    c.controls.add({ id: "sound-all", section: "sound", label: "All sound: on", act: () => {} });
    c.controls.add({ id: "sound-music", section: "sound", label: "Music", act: () => {} });
    c.controls.addSection({ id: "help", label: "Help", note: "Drag to look around. These controls are your own client's." });
    c.here();
    c.from({
      nswp: "menu",
      world: {
        title: "The Gallery",
        sections: [
          { id: "sound", rows: [{ id: "sound-piece", label: "Playing here: Nocturne. Next of 2" }, { id: "sound-name", label: "Name this piece", kind: "field" }] },
          { id: "help", note: "Six sculptures, each a few lines of code turned into a shape.", rows: [{ id: "fresh", label: "This world has been updated" }] },
          { id: "camera", note: "Pictures are saved to this device.", rows: [{ id: "shot", label: "Take a picture" }] },
          { id: "shop", label: "Shop", note: "Open till late.", rows: [{ id: "shop-print", label: "A print" }] },
        ],
      },
    });
    const view = c.below.port.view();
    const tab = (id: string) => view.sections.find((s) => s.id === id)!;
    return { c, tab };
  };

  it("has the client's own rows first, and the world's below them under the world's name", () => {
    const { tab } = drawn();
    expect(tab("sound").items.map((i) => [i.id, i.from])).toEqual([["sound-all", undefined], ["sound-music", undefined], ["world:sound-piece", "The Gallery"]]);
    expect(tab("help").items.map((i) => [i.id, i.from])).toEqual([["world:fresh", "The Gallery"]]);
  });

  it("keeps the client's own words as the tab's, and the world's as the world's, after them", () => {
    const { tab } = drawn();
    expect(tab("help").note).toBe("Drag to look around. These controls are your own client's.");
    expect(tab("help").said).toEqual({ from: "The Gallery", note: "Six sculptures, each a few lines of code turned into a shape." });
  });

  it("never lets a world's words stand as the menu's own, even in a tab the client says nothing in", () => {
    const { tab } = drawn();
    expect([tab("camera").note, tab("camera").said]).toEqual(["", { from: "The Gallery", note: "Pictures are saved to this device." }]);
    expect(tab("camera").items.map((i) => i.from)).toEqual(["The Gallery"]);
  });

  it("takes nothing typed for a world from Sound or Help", () => {
    const { tab } = drawn();
    expect(tab("sound").items.some((i) => i.kind === "field")).toBe(false);
  });

  it("leaves a tab of the world's own as it is: the world's name is on the tab", () => {
    const { tab } = drawn();
    expect([tab("shop").label, tab("shop").note, tab("shop").said, tab("shop").items.map((i) => i.from)]).toEqual(["Shop · The Gallery", "Open till late.", undefined, [undefined]]);
  });
});

describe("a press", () => {
  const up = () => {
    const c = make();
    c.here();
    c.from({ nswp: "menu", world: described() });
    c.sent.length = 0;
    return c;
  };

  it("on a row of the world's goes down as a word, by the world's own id", () => {
    const c = up();
    expect(c.below.port.run(`${WORLDS}room-join`)).toBe(true);
    expect(c.words()).toEqual([{ nswp: "menu", press: "room-join" }]);
  });

  it("on a row typed into carries what was typed, and on any other row carries nothing", () => {
    const c = up();
    c.below.port.run(`${WORLDS}guests-key`, "npub1ana");
    c.below.port.run(`${WORLDS}room-join`, "not typed there");
    expect(c.words()).toEqual([{ nswp: "menu", press: "guests-key", field: "npub1ana" }, { nswp: "menu", press: "room-join" }]);
  });

  it("on a row of the client's own is the client's, and nothing is said down", async () => {
    const c = up();
    expect(c.below.port.run("home")).toBe(true);
    await vi.runAllTimersAsync();
    expect([c.pressed, c.words()]).toEqual([["home"], []]);
  });

  it("on something the world never described goes nowhere", () => {
    const c = up();
    expect(c.below.port.run(`${WORLDS}bag-steal`)).toBe(false);
    expect(c.below.port.run(`${WORLDS}home`)).toBe(false);
    expect(c.words()).toEqual([]);
  });
});

describe("the menu coming up and going, keys, and words for a moment", () => {
  it("tells the world, and gives the frame the keys as it goes", () => {
    const c = make();
    c.here();
    c.sent.length = 0;
    c.below.port.signal("menuOpen");
    expect(c.focused()).toBe(0);
    c.below.port.signal("menuClose");
    expect([c.words(), c.focused()]).toEqual([[{ nswp: "menu", open: true }, { nswp: "menu", open: false }], 1]);
  });

  it("gives a forwarded key to the menu that was mounted", () => {
    const c = make();
    const keys: string[] = [];
    c.below.attach({ pressKey: (k) => void keys.push(k) });
    c.from({ nswp: "menu", key: "summon" });
    c.here();
    for (const key of ["summon", "3", "a"]) c.from({ nswp: "menu", key });
    expect(keys).toEqual(["summon", "3"]);
  });

  it("shows a world's words under the world's name", () => {
    const c = make();
    const said: string[] = [];
    c.below.port.onSay((t) => said.push(t));
    c.here();
    c.from({ nswp: "menu", world: described() });
    c.from({ nswp: "menu", say: "Saved to your bag." });
    expect(said).toEqual(["The Gallery: Saved to your bag."]);
  });

  it("says a setting down when the visitor changes one here, and not when nothing changed", () => {
    const c = make();
    c.here();
    c.sent.length = 0;
    c.controls.setTheme({ scale: 1.3 }, true);
    c.controls.setTheme({ scale: 1.3 }, true);
    expect(c.words()).toEqual([{ nswp: "menu", settings: { text: 1.3 } }]);
  });
});

describe("a world's pictures", () => {
  const picture = (p: unknown) => !!p && typeof p === "object";
  const up = () => {
    const controls = createControls({ title: "The client" });
    const win = { postMessage: () => {} };
    const frame = { contentWindow: win, addEventListener: () => {}, removeEventListener: () => {}, focus: () => {} } as unknown as HTMLIFrameElement;
    let onMessage: (e: MessageEvent) => void = () => {};
    const below = portBelow(frame, { controls, origin: CLIENT, picture, hear: { addEventListener: (_t, fn) => void (onMessage = fn), removeEventListener: () => {} } });
    const from = (data: unknown) => onMessage({ data, origin: WORLD, source: win } as MessageEvent);
    const world = (rows: string[], card = true) => ({ nswp: "menu", world: { title: "The Gallery", sections: [{ id: "people", ...(card ? { card: { title: "Ana" } } : {}), rows: rows.map((id) => ({ id, label: id, kind: "tile" })) }] } });
    from({ nswp: "here", at: "/", menu: 1 });
    const drawn = () => {
      const people = below.port.view().sections.find((s) => s.id === "people")!;
      return { face: people.card?.face ?? null, rows: Object.fromEntries(people.items.map((i) => [i.id, i.picture?.() ?? null])) };
    };
    return { from, world, drawn };
  };
  const A = { bitmap: "a" };
  const B = { bitmap: "b" };

  it("come each alone, for a row by its id and a card by its tab, and are what the menu draws", () => {
    const c = up();
    c.from(c.world(["print"]));
    expect(c.drawn()).toEqual({ face: null, rows: { "world:print": null } });
    c.from({ nswp: "menu", picture: A, id: "print" });
    c.from({ nswp: "menu", picture: B, id: "card:people" });
    expect(c.drawn()).toEqual({ face: B, rows: { "world:print": A } });
  });

  it("stay while the world says the same things again, and go with a row or a card it stops describing", () => {
    const c = up();
    c.from(c.world(["print", "other"]));
    c.from({ nswp: "menu", picture: A, id: "print" });
    c.from({ nswp: "menu", picture: B, id: "card:people" });
    c.from(c.world(["print", "other"]));
    expect(c.drawn()).toEqual({ face: B, rows: { "world:print": A, "world:other": null } });
    c.from(c.world(["other"], false));
    c.from(c.world(["print", "other"]));
    expect(c.drawn()).toEqual({ face: null, rows: { "world:print": null, "world:other": null } });
  });

  it("are kept only for something the world described, and only where they pass the client's check", () => {
    const c = up();
    c.from(c.world(["print"]));
    c.from({ nswp: "menu", picture: A, id: "nothing-there" });
    c.from({ nswp: "menu", picture: "https://tracker.example/pixel.png", id: "print" });
    expect(c.drawn()).toEqual({ face: null, rows: { "world:print": null } });
  });
});

describe("loading people's files from anywhere", () => {
  it("is never said down, on or off: it is for one place, and that place keeps it", async () => {
    const { reportSettings } = await import("../src/settings.js");
    // A part of this page says it is off, as the kit's own does wherever the switch has been read.
    reportSettings("files-anywhere", () => ({ filesAnywhere: false }));
    const c = make();
    c.here();
    c.controls.setTheme({ scale: 1.2 }, true);
    expect(c.words()).toEqual([{ nswp: "menu", has: true, v: 1, settings: {} }, { nswp: "menu", settings: { text: 1.2 } }]);
    expect(JSON.stringify(c.words())).not.toMatch(/filesAnywhere/);
  });
});

describe("signing out of a world, and what is in hand", () => {
  const LANTERN = `37303:${"ab".repeat(32)}:brass-lantern`;
  const holding = (item: string) => ({ nswp: "menu", world: { title: "The Gallery", state: { holding: item }, sections: [] } });

  it("tells the world to sign the visitor out, in a word that carries nothing", () => {
    const c = make();
    c.below.signOut();
    c.here();
    c.sent.length = 0;
    c.below.signOut();
    expect(c.words()).toEqual([{ nswp: "menu", sign: "out" }]);
  });

  it("says what the visitor took up, and it is in their hand once the world says so", async () => {
    const c = make();
    c.here();
    c.from(holding(""));
    c.sent.length = 0;
    const took = c.below.hold(LANTERN, { tints: { accent: "#8b5cf6" }, script: "c".repeat(64) });
    expect(c.words()).toEqual([{ nswp: "menu", settings: { holding: { item: LANTERN, tints: { accent: "#8b5cf6" }, script: "c".repeat(64) } } }]);
    c.from(holding(LANTERN));
    await expect(took).resolves.toBe(true);
  });

  it("is not in their hand where the world never says it is: it wasn't in their bag there, or nothing is carried", async () => {
    const c = make();
    c.here();
    c.from(holding(""));
    const took = c.below.hold(LANTERN);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(took).resolves.toBe(false);
  });

  it("says they put it away, and never says what is in hand with their other settings", async () => {
    const c = make();
    const { reportSettings } = await import("../src/settings.js");
    // A part of this page says what is held, as the kit's own Bag does: it is the world's word, not to be said back.
    reportSettings("holding", () => ({ holding: { item: LANTERN } }));
    c.here();
    c.from(holding(LANTERN));
    c.controls.setTheme({ scale: 1.2 }, true);
    expect(JSON.stringify(c.words())).not.toMatch(/holding/);
    c.sent.length = 0;
    const put = c.below.hold("");
    expect(c.words()).toEqual([{ nswp: "menu", settings: { holding: "" } }]);
    c.from(holding(""));
    await expect(put).resolves.toBe(true);
  });

  it("says nothing to a page that doesn't speak the words", async () => {
    const c = make();
    c.here(0);
    await expect(c.below.hold(LANTERN)).resolves.toBe(false);
    expect(c.sent).toEqual([]);
  });
});

describe("what a visitor changed in a world's headset session", () => {
  const presenting = (on: boolean) => ({ nswp: "menu", world: { title: "The Gallery", state: { headset: { supported: true, presenting: on } }, sections: [] } });

  it("is taken as theirs while the world says its session runs, and said to the next world", async () => {
    const { currentSettings } = await import("../src/settings.js");
    const c = make();
    c.here();
    c.from(presenting(true));
    c.from({ nswp: "menu", settings: { turn: 90, hand: "left", text: 1.3 } });
    expect(currentSettings()).toMatchObject({ turn: 90, hand: "left", text: 1.3 });
    expect(c.controls.theme.scale).toBe(1.3);
    // The next world: its first word from the client carries what they changed in the last one's headset.
    c.sent.length = 0;
    c.here(1, "https://grove.example");
    expect(c.sent[0]).toMatchObject({ to: "https://grove.example", word: { has: true, settings: { turn: 90, hand: "left", text: 1.3 } } });
  });

  it("is not taken where the world says no session is running: there the menu is the client's, and so are the settings", async () => {
    const { currentSettings } = await import("../src/settings.js");
    const c = make();
    c.here();
    c.from(presenting(false));
    c.from({ nswp: "menu", settings: { turn: 90, text: 1.4 } });
    expect(currentSettings()).toEqual({});
  });

  it("can never turn a privacy switch on, change what they hold, or say who they are", async () => {
    const { currentSettings } = await import("../src/settings.js");
    const { showsPictures, setShowsPictures, resetPictures } = await import("../src/picture.js");
    setShowsPictures(false);
    const c = make();
    c.here();
    c.from(presenting(true));
    c.from({ nswp: "menu", settings: { filesAnywhere: true, pictures: true, models: true, chat: true, items: true, holding: { item: `37303:${"ab".repeat(32)}:x` }, full: true, turn: 45 } });
    expect(showsPictures()).toBe(false);
    expect(currentSettings()).toEqual({ pictures: false, turn: 45 });
    resetPictures();
  });

  it("goes to the client's own keeper of settings where it has one", async () => {
    const taken: unknown[] = [];
    const controls = createControls({ title: "The client" });
    const win = { postMessage: () => {} };
    const frame = { contentWindow: win, addEventListener: () => {}, removeEventListener: () => {}, focus: () => {} } as unknown as HTMLIFrameElement;
    let onMessage: (e: MessageEvent) => void = () => {};
    portBelow(frame, { controls, origin: CLIENT, onReported: (s) => taken.push(s), hear: { addEventListener: (_t, fn) => void (onMessage = fn), removeEventListener: () => {} } });
    const from = (data: unknown) => onMessage({ data, origin: WORLD, source: win } as MessageEvent);
    from({ nswp: "here", at: "/", menu: 1 });
    from(presenting(true));
    from({ nswp: "menu", settings: { fade: false, pictures: true } });
    expect(taken).toEqual([{ fade: false }]);
  });
});

describe("the way home", () => {
  it("is asked of the world first, and taken by the client when the world hasn't gone in time", async () => {
    const went: boolean[] = [];
    const c = make({ home: (left) => void went.push(left) });
    c.here();
    c.sent.length = 0;
    c.below.leave();
    c.below.leave();
    expect(c.words()).toEqual([{ nswp: "menu", go: "home" }]);
    await vi.advanceTimersByTimeAsync(LEAVE_MS - 1);
    expect(went).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(went).toEqual([true]);
  });

  it("is left to the world where it went by itself: the frame loaded in time", async () => {
    const went: boolean[] = [];
    const c = make({ home: (left) => void went.push(left) });
    c.here();
    c.load();
    c.below.leave();
    c.load();
    await vi.advanceTimersByTimeAsync(LEAVE_MS * 2);
    expect(went).toEqual([]);
  });

  it("is taken at once, with nothing lost, over a page that doesn't speak the words", () => {
    const went: boolean[] = [];
    const c = make({ home: (left) => void went.push(left) });
    c.here(0);
    c.below.leave();
    expect([went, c.sent]).toEqual([[false], []]);
  });
});

describe("a file the visitor chose, and something a world hands up to save", () => {
  const file = (name: string, type: string, size = 70) => new File([new Uint8Array(size)], name, { type });
  const sized = (size: number, type: string) => Object.defineProperty(new File([new Uint8Array(4)], "big.png", { type }), "size", { value: size });
  const shot = (type = "image/jpeg") => new Blob([new Uint8Array(2561)], { type });
  const world = () => {
    const w = createControls({ title: "The Gallery" });
    w.add({ id: "panel-file", section: "panels", label: "Hang a picture from this device", kind: "file", accept: ["image"], act: () => {} });
    w.add({ id: "camera-picture", section: "camera", label: "Take a picture", kind: "save", act: () => {} });
    w.add({ id: "camera-clip", section: "camera", label: "Stop recording", kind: "save", act: () => {} });
    w.add({ id: "room-join", section: "room", label: "Join the room", act: () => {} });
    return describeWorld(w.view());
  };
  /** A client above that world, keeping what it is asked to save and what it says. */
  const met = (more: Partial<MenuBelowOptions> = {}) => {
    const saved: [Blob, SavedAbout][] = [];
    let t = 1000;
    const c = make({ more: { onSave: (f, about) => void saved.push([f, about]), now: () => t, ...more } });
    const said: string[] = [];
    c.controls.onSay((text) => said.push(text));
    c.here();
    c.from({ nswp: "menu", world: world() });
    c.sent.length = 0;
    return { ...c, saved, said, later: (ms: number) => (t += ms) };
  };

  it("draws a world's row that takes a file with the kinds it takes, and its row that saves", () => {
    const c = met();
    const items = c.below.port.view().sections.flatMap((s) => s.items);
    expect(items.find((i) => i.id === `${WORLDS}panel-file`)).toMatchObject({ kind: "file", accept: ["image"], label: "Hang a picture from this device" });
    expect(items.find((i) => i.id === `${WORLDS}camera-picture`)).toMatchObject({ kind: "save" });
  });

  it("hands the chosen file down as it is, with the press, to that world's origin only", () => {
    const c = met();
    const f = file("a dot.png", "image/png");
    expect(c.below.port.run(`${WORLDS}panel-file`, undefined, f)).toBe(true);
    expect(c.sent).toEqual([{ word: { nswp: "menu", press: "panel-file", file: f }, to: WORLD }]);
    expect((c.sent[0]!.word as { file: Blob }).file).toBe(f);
  });

  it("hands nothing down with no file, a file of a kind the row didn't ask for, an empty one, or one over the limit", () => {
    const c = met();
    expect(c.below.port.run(`${WORLDS}panel-file`)).toBe(false);
    expect(c.below.port.run(`${WORLDS}panel-file`, undefined, file("clip.mp4", "video/mp4"))).toBe(false);
    expect(c.below.port.run(`${WORLDS}panel-file`, undefined, file("notes.txt", "text/plain"))).toBe(false);
    expect(c.below.port.run(`${WORLDS}panel-file`, undefined, file("nothing.png", "image/png", 0))).toBe(false);
    expect(c.below.port.run(`${WORLDS}panel-file`, undefined, sized(MENU_LIMITS.file + 1, "image/png"))).toBe(false);
    expect(c.sent).toEqual([]);
    expect(c.below.port.run(`${WORLDS}panel-file`, undefined, sized(MENU_LIMITS.file, "image/png"))).toBe(true);
  });

  it("sends a file whose name may not go with it without one, and nothing else of where it was", () => {
    const c = met();
    for (const name of ["home/ana/secret plans.png", "n".repeat(MENU_LIMITS.fileName + 1)]) c.below.port.run(`${WORLDS}panel-file`, undefined, file(name, "image/png"));
    for (const { word } of c.sent) {
      const sent = (word as { file: Blob & { name?: string } }).file;
      expect([sent.name, sent.size, sent.type]).toEqual([undefined, 70, "image/png"]);
    }
    expect(c.sent).toHaveLength(2);
  });

  it("gives no file to a row that takes none: a press on it is a press and nothing more", () => {
    const c = met();
    expect(c.below.port.run(`${WORLDS}room-join`, undefined, file("a.png", "image/png"))).toBe(true);
    expect(c.sent.map((x) => x.word)).toEqual([{ nswp: "menu", press: "room-join" }]);
  });

  it("saves what a world hands up as the answer to a press on a row that saves, under a name of its own, and says so", () => {
    const c = met();
    c.below.port.run(`${WORLDS}camera-picture`);
    const picture = shot();
    c.from({ nswp: "menu", save: picture, id: "camera-picture" });
    expect(c.saved).toHaveLength(1);
    expect(c.saved[0]![0]).toBe(picture);
    expect(c.saved[0]![1]).toMatchObject({ world: "The Gallery", kind: "picture", type: "image/jpeg" });
    expect(c.saved[0]![1].name).toMatch(/^the-gallery-\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.jpg$/);
    expect(c.said).toEqual(["A picture from The Gallery was saved."]);
  });

  it("names a clip as a clip, with an ending from its kind however it was packed", () => {
    const c = met();
    c.below.port.run(`${WORLDS}camera-clip`);
    c.from({ nswp: "menu", save: shot("video/webm;codecs=vp9"), id: "camera-clip" });
    expect(c.saved[0]![1]).toMatchObject({ kind: "clip", type: "video/webm" });
    expect(c.saved[0]![1].name).toMatch(/^the-gallery-clip-[0-9-]+\.webm$/);
    expect(c.said).toEqual(["A clip from The Gallery was saved."]);
  });

  it("saves nothing a world hands up unasked: with no press, for another row, too late, or from another site", () => {
    const c = met();
    c.from({ nswp: "menu", save: shot(), id: "camera-picture" });
    c.below.port.run(`${WORLDS}room-join`);
    c.from({ nswp: "menu", save: shot(), id: "room-join" });
    c.below.port.run(`${WORLDS}camera-picture`);
    c.from({ nswp: "menu", save: shot(), id: "camera-clip" });
    c.from({ nswp: "menu", save: shot(), id: "camera-picture" }, "https://elsewhere.example");
    c.from({ nswp: "menu", save: new Blob(["<p>"], { type: "text/html" }), id: "camera-picture" });
    c.later(MENU_SAVE_MS + 1);
    c.from({ nswp: "menu", save: shot(), id: "camera-picture" });
    expect([c.saved, c.said]).toEqual([[], []]);
    // In time, it is.
    c.below.port.run(`${WORLDS}camera-picture`);
    c.later(MENU_SAVE_MS);
    c.from({ nswp: "menu", save: shot(), id: "camera-picture" });
    expect(c.saved).toHaveLength(1);
  });

  it("takes only so many for one press, and none once another page is in the frame", () => {
    const c = met();
    c.below.port.run(`${WORLDS}camera-picture`);
    for (let i = 0; i < MENU_LIMITS.saves + 3; i++) c.from({ nswp: "menu", save: shot(), id: "camera-picture" });
    expect(c.saved).toHaveLength(MENU_LIMITS.saves);
    c.below.port.run(`${WORLDS}camera-picture`);
    c.here();
    c.from({ nswp: "menu", world: world() });
    c.from({ nswp: "menu", save: shot(), id: "camera-picture" });
    expect(c.saved).toHaveLength(MENU_LIMITS.saves);
  });

  it("says the client's own words for it where the client gives some", () => {
    const c = met({ onSave: () => "Kept in your files." });
    c.below.port.run(`${WORLDS}camera-picture`);
    c.from({ nswp: "menu", save: shot(), id: "camera-picture" });
    expect(c.said).toEqual(["Kept in your files."]);
  });

  it("saves it to the device from this page, where the client keeps files nowhere of its own", () => {
    const link = { href: "", download: "", rel: "", click: vi.fn(), remove: vi.fn() };
    (globalThis as { document?: unknown }).document = { createElement: () => link, body: { append: vi.fn() } };
    try {
      const c = met({ onSave: undefined });
      c.below.port.run(`${WORLDS}camera-picture`);
      c.from({ nswp: "menu", save: shot("image/png"), id: "camera-picture" });
      expect(link.click).toHaveBeenCalledTimes(1);
      expect(link.download).toMatch(/^the-gallery-[0-9-]+\.png$/);
      expect(c.said).toEqual(["A picture from The Gallery was saved to this device."]);
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });
});

/**
 * A page of its client's own origin (a client's own room, in the client's frame) fills the visitor's own tabs
 * itself, and says so with `own` at the world's end (menu-above.ts). That only changes what a page says: whether it
 * is taken is decided here, by the frame's origin exactly.
 */
describe("a page that says it is its client's own", () => {
  /** A page with a row in the visitor's Bag, one in You, one of its own in Display, a way home and a list of doors. */
  const page = (own: boolean) => {
    const w = createControls({ title: "The room" });
    w.add({ id: "home", section: "travel", label: "Go home", act: () => {} });
    w.add({ id: "list", section: "travel", label: "Your doors, as a list", act: () => {} });
    w.add({ id: "door-grove", section: "travel", label: "To the Grove", act: () => {} });
    w.add({ id: "bag-lantern", section: "bag", label: "A lantern", act: () => {} });
    w.add({ id: "you-sign-out", section: "you", label: "Sign out", act: () => {} });
    w.add({ id: "figure-edit", section: "figure", label: "Change how you look", act: () => {} });
    w.add({ id: "room-join", section: "room", label: "Join the room", act: () => {} });
    return describeWorld(w.view(), {}, "", own);
  };
  const rowsOf = (c: ReturnType<typeof make>) => c.below.port.view().sections.flatMap((s) => s.items.filter((i) => i.id.startsWith(WORLDS)).map((i) => `${s.id}/${i.id.slice(WORLDS.length)}`));

  it("says the visitor's own tabs, and its own rows under Travel, only where it says it is its client's own", () => {
    const tabs = (w: Record<string, unknown>) => (w.sections as { id: string; rows: { id: string }[] }[]).map((s) => `${s.id}: ${s.rows.map((r) => r.id).join(" ")}`);
    expect(tabs(page(false))).toEqual(["travel: door-grove", "room: room-join"]);
    expect(tabs(page(true))).toEqual(["travel: home list door-grove", "you: you-sign-out", "room: room-join", "figure: figure-edit", "bag: bag-lantern"].sort((a, b) => tabs(page(true)).indexOf(a) - tabs(page(true)).indexOf(b)));
    // What the client's page makes for itself from the same kit is still not said, or it would be there twice:
    // Display's own rows, and the switches that change a setting.
    expect(JSON.stringify(page(true))).not.toMatch(/look-lantern|look-size|look-motion/);
  });

  it("is taken, visitor's tabs and all, from a page whose origin is the client's own", () => {
    const c = make({ origin: CLIENT });
    c.here();
    c.from({ nswp: "menu", world: page(true) });
    expect(rowsOf(c).sort()).toEqual(["bag/bag-lantern", "figure/figure-edit", "room/room-join", "travel/door-grove", "travel/home", "travel/list", "you/you-sign-out"]);
  });

  it("gains a page of any other origin nothing: the visitor's tabs it says are left out, exactly as if it had not said them", async () => {
    const honest = make();
    honest.here();
    honest.from({ nswp: "menu", world: page(false) });
    const claims = make();
    claims.here();
    claims.from({ nswp: "menu", world: page(true) });
    // Nothing in You, Your look or the Bag from it, whatever it said.
    expect(rowsOf(claims).filter((r) => /^(you|figure|bag|look|wallet|files)\//.test(r))).toEqual([]);
    // Under Travel it says two rows more, which any world could have described under any id: they are the world's,
    // drawn under the world's name and marked as the world's, never the client's own way home.
    expect(rowsOf(claims).sort()).toEqual([...rowsOf(honest), "travel/home", "travel/list"].sort());
    const travel = claims.below.port.view().sections.find((s) => s.id === "travel")!.items;
    expect(travel[0]).toMatchObject({ id: "home", label: "Home" });
    expect(travel.find((i) => i.id === `${WORLDS}home`)).toMatchObject({ from: "The room", label: "Go home" });
    // The client's own Home is the client's: pressed, nothing is said to the world.
    claims.sent.length = 0;
    claims.below.port.run("home");
    await vi.advanceTimersByTimeAsync(0);
    expect([claims.pressed, claims.sent.filter((x) => x.word.press !== undefined)]).toEqual([["home"], []]);
  });
});
