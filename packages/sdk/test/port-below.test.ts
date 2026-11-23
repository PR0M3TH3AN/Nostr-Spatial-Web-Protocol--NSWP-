import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAVE_MS } from "@nswp/core";
import { describeWorld } from "../src/menu-above.js";
import { resetSettings } from "../src/settings.js";
import { createControls } from "../src/ui/model.js";
import { mergeView, portBelow, WORLDS } from "../src/ui/port-below.js";

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

const make = (o: { origin?: string; home?: (left: boolean) => void } = {}) => {
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
