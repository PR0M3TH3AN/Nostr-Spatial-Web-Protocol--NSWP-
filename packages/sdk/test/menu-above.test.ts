import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanMenuWorld, MENU_LIMITS, MENU_SAVE_MS, MENU_WAIT_MS, readMenuWordUp } from "@nswp/core";
import { handUp, savesWait } from "../src/client-frame.js";
import { filesAnywhere, forgetFileHosts } from "../src/file-hosts.js";
import { describeWorld, portAbove, type MenuAboveOptions } from "../src/menu-above.js";
import { resetSettings } from "../src/settings.js";
import { createControls } from "../src/ui/model.js";

/**
 * The world's end of the menu's port (protocol/02-doors.md, "The client has the menu"): a framed world whose
 * client has the menu draws none, says what it is upward, and takes presses, settings and keys. The page above is
 * a stand-in here that keeps what it was sent.
 */
const kept = new Map<string, string>();
beforeEach(() => {
  vi.useFakeTimers();
  kept.clear();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
  resetSettings();
  forgetFileHosts();
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { localStorage?: unknown }).localStorage;
  resetSettings();
  forgetFileHosts();
});

const HAS = { nswp: "menu", has: true, v: 1, settings: {} };

/** A world with a few tabs, and the page above it. */
const make = (o: { framed?: boolean; since?: number | null; before?: unknown[]; state?: MenuAboveOptions["state"] } = {}) => {
  const controls = createControls({ title: "The Gallery" });
  const pressed: [string, string | undefined][] = [];
  const act = (id: string) => (typed?: string) => void pressed.push([id, typed]);
  controls.add({ id: "home", section: "travel", label: "Go home", hotbar: true, act: act("home") });
  controls.add({ id: "door-grove", section: "travel", label: "To the Grove", act: act("door-grove") });
  controls.add({ id: "room-join", section: "room", label: "Join the room", short: "Join", icon: "room", hotbar: true, act: act("room-join") });
  controls.add({ id: "room-link", section: "room", label: "Copy the room's link", kind: "copy", copy: "https://gallery.example/#room", act: act("room-link") });
  controls.add({ id: "guests-key", section: "guests", label: "Add someone by key", kind: "field", act: act("guests-key") });
  controls.add({ id: "bag-item", section: "bag", label: "A lantern", act: act("bag-item") });
  controls.add({ id: "big", section: "look", label: "Bigger", act: act("big") });
  controls.add({ id: "follow-ana", section: "following", label: "Ana", act: act("follow-ana") });
  const sent: Record<string, unknown>[] = [];
  let hear: ((word: unknown) => void) | null = null;
  const before = [...(o.before ?? [])];
  const keyFns = new Map<string, (e: unknown) => void>();
  const signals: string[] = [];
  controls.onSignal((n) => signals.push(n));
  let went = 0;
  const above = portAbove(controls, {
    above: {
      framed: () => o.framed !== false,
      sinceHere: () => (o.since === undefined ? 0 : o.since),
      say: (word) => sent.push({ ...word, nswp: "menu" }),
      hear: (fn) => {
        hear = fn;
        if (fn) for (const w of before.splice(0)) fn(w);
      },
    },
    keys: { addEventListener: ((type: string, fn: (e: unknown) => void) => void keyFns.set(type, fn)) as never, removeEventListener: ((type: string) => void keyFns.delete(type)) as never },
    home: () => went++,
    ...(o.state ? { state: o.state } : {}),
  });
  const key = (e: Partial<KeyboardEvent>) => {
    const ev = { key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, repeat: false, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn(), composedPath: () => [], ...e };
    keyFns.get("keydown")?.(ev);
    return ev;
  };
  return { controls, above, sent, say: (w: unknown) => hear?.(w), pressed, key, signals, went: () => went, worlds: () => sent.filter((w) => w.world).map((w) => w.world as Record<string, unknown>) };
};

describe("who has the menu", () => {
  it("is the world, at once, where it isn't in a frame", async () => {
    const w = make({ framed: false });
    await expect(w.above.ready).resolves.toBe(false);
    expect(w.sent).toEqual([]);
  });

  it("is the world, when nothing is said in time", async () => {
    const w = make();
    let known: boolean | null = null;
    void w.above.ready.then((h) => (known = h));
    await vi.advanceTimersByTimeAsync(MENU_WAIT_MS - 1);
    expect(known).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(known).toBe(false);
    expect(w.sent).toEqual([]);
  });

  it("is counted from when the page said here, not from when the world got round to asking", async () => {
    const w = make({ since: MENU_WAIT_MS + 50 });
    await expect(w.above.ready).resolves.toBe(false);
  });

  it("is the client, when it says so: the world describes itself at once", async () => {
    const w = make();
    w.say(HAS);
    await expect(w.above.ready).resolves.toBe(true);
    expect(w.above.has).toBe(true);
    expect(w.worlds()).toHaveLength(1);
  });

  it("is the client, when it answered before the world was listening", async () => {
    const w = make({ since: MENU_WAIT_MS + 500, before: [HAS] });
    await expect(w.above.ready).resolves.toBe(true);
    expect(w.worlds()).toHaveLength(1);
  });

  it("becomes the client's when it answers late, and the world's again when it stops", async () => {
    const w = make();
    const heard: boolean[] = [];
    w.above.onChange((h) => heard.push(h));
    await vi.advanceTimersByTimeAsync(MENU_WAIT_MS);
    await expect(w.above.ready).resolves.toBe(false);
    w.say(HAS);
    w.say({ nswp: "menu", has: false });
    expect(heard).toEqual([true, false]);
    expect(w.above.has).toBe(false);
  });
});

describe("what a world says of itself", () => {
  it("is only the tabs that are its to fill: nothing of the visitor's own, and not the way home", () => {
    const w = make();
    w.say(HAS);
    const world = w.worlds()[0]!;
    const sections = world.sections as { id: string; rows: { id: string }[] }[];
    expect(sections.map((s) => [s.id, s.rows.map((r) => r.id)])).toEqual([["travel", ["door-grove"]], ["room", ["room-join", "room-link"]], ["following", ["follow-ana"]], ["guests", ["guests-key"]]]);
    expect(JSON.stringify(w.sent)).not.toMatch(/lantern|Bigger|bag|"look"/);
  });

  it("is what a client keeps whole: it is within every limit as it leaves", () => {
    const w = make({ state: () => ({ room: { has: true, joined: false, mic: null, count: 2 }, named: true }) });
    w.say(HAS);
    const read = readMenuWordUp(w.sent[0], { also: ["following", "messages"] });
    expect(read).toMatchObject({ what: "world", world: { title: "The Gallery", level: "full", keys: true, state: { room: { has: true, count: 2 }, named: true } } });
    const kept = cleanMenuWorld(w.worlds()[0], { also: ["following", "messages"] })!;
    expect(kept.sections.flatMap((s) => s.rows).map((r) => [r.id, r.kind])).toEqual([["door-grove", "button"], ["room-join", "button"], ["room-link", "copy"], ["follow-ana", "button"], ["guests-key", "field"]]);
    expect(kept.sections[1]!.rows[0]).toEqual({ id: "room-join", label: "Join the room", short: "Join", icon: "room", kind: "button", bar: true });
    expect(kept.sections[1]!.rows[1]!.copy).toBe("https://gallery.example/#room");
  });

  it("is said again when it changes, whole, and no oftener than eight times a second", async () => {
    const w = make();
    w.say(HAS);
    for (let i = 0; i < 20; i++) w.controls.setTarget(`Painting ${i}`);
    expect(w.worlds()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(125);
    expect(w.worlds()).toHaveLength(2);
    expect(w.worlds()[1]!.target).toEqual(["Painting 19"]);
    // Nothing changed: nothing is said.
    w.controls.setTarget("Painting 19");
    await vi.advanceTimersByTimeAsync(500);
    expect(w.worlds()).toHaveLength(2);
  });

  it("says its words for a moment upward, and nothing while the menu is its own", () => {
    const w = make();
    w.controls.say("Not yet.");
    w.say(HAS);
    w.controls.say("Saved to your bag.");
    expect(w.sent.filter((s) => s.say)).toEqual([{ nswp: "menu", say: "Saved to your bag." }]);
  });

  it("describes from a view the same way with no client there to hear", () => {
    const w = make({ framed: false });
    expect((describeWorld(w.controls.view()).sections as unknown[]).length).toBe(4);
  });
});

describe("Sound and Help, which both fill", () => {
  /** A world's own menu's Sound and Help: the visitor's rows and the kit's words on how to move among the world's own. */
  const world = () => {
    const c = createControls({ title: "The Gallery" });
    c.addSection({ id: "help", label: "Help", note: "Six sculptures. Drag to look around. Walk with W, A, S, D." });
    c.add({ id: "fresh", section: "help", label: "This world has been updated", act: () => {} });
    for (const id of ["sound-all", "sound-effects", "sound-music", "sound-voices", "sound-hum", "juke-add", "juke-play", "juke-next", "juke-remove"]) c.add({ id, section: "sound", label: id, act: () => {} });
    c.add({ id: "sound-piece", section: "sound", label: "Playing here: Nocturne. Next of 2", act: () => {} });
    return c;
  };
  const sections = (said: Record<string, unknown>) => Object.fromEntries((said.sections as { id: string; note?: string; rows: { id: string }[] }[]).map((s) => [s.id, { note: s.note, rows: s.rows.map((r) => r.id) }]));

  it("in Sound a world says only what is its own: the piece it is playing. The volumes and the visitor's music are the client's", () => {
    expect(sections(describeWorld(world().view())).sound).toEqual({ note: undefined, rows: ["sound-piece"] });
  });

  it("in Help a world says its own sentence about itself, and not the words on how to move, which are the client's to say", () => {
    const said = sections(describeWorld(world().view(), {}, "Six sculptures, each a few lines of code turned into a shape."));
    expect(said.help).toEqual({ note: "Six sculptures, each a few lines of code turned into a shape.", rows: ["fresh"] });
    expect(JSON.stringify(said)).not.toMatch(/Drag to look around/);
  });

  it("says nothing of itself in Help where it has nothing to say, or too much", () => {
    expect(sections(describeWorld(world().view())).help).toEqual({ note: undefined, rows: ["fresh"] });
    expect(sections(describeWorld(world().view(), {}, "x".repeat(401))).help).toEqual({ note: undefined, rows: ["fresh"] });
  });

  it("is kept by a client as it was said, and says whether the place has a hum", () => {
    const kept = cleanMenuWorld(describeWorld(world().view(), { hum: true }, "Six sculptures."))!;
    expect(kept.state.hum).toBe(true);
    expect(kept.sections.map((s) => [s.id, s.note, s.rows.map((r) => r.id)])).toEqual([["sound", undefined, ["sound-piece"]], ["help", "Six sculptures.", ["fresh"]]]);
  });
});

describe("what a world says of the things only it can run", () => {
  it("is said again when it changes, though nothing told the controls: a headset session starting", async () => {
    let presenting = false;
    const w = make({ state: () => ({ headset: { supported: true, presenting } }) });
    w.say(HAS);
    expect(w.worlds().at(-1)!.state).toMatchObject({ headset: { supported: true, presenting: false } });
    presenting = true;
    await vi.advanceTimersByTimeAsync(600);
    expect(w.worlds()).toHaveLength(2);
    expect(w.worlds().at(-1)!.state).toMatchObject({ headset: { supported: true, presenting: true } });
    // And not again while nothing changes.
    await vi.advanceTimersByTimeAsync(2000);
    expect(w.worlds()).toHaveLength(2);
  });
});

describe("what a visitor changes in a headset, said back to their client", () => {
  /** A world in a frame whose client has the menu, with a headset session that can be started and ended. */
  const inHeadset = () => {
    let presenting = false;
    const w = make({ state: () => ({ headset: { supported: true, presenting } }) });
    w.say(HAS);
    const said = () => w.sent.filter((s) => s.settings).map((s) => s.settings);
    const tick = () => vi.advanceTimersByTimeAsync(600);
    return { ...w, said, tick, enter: () => (presenting = true), leave: () => (presenting = false) };
  };

  it("is said upward while the session runs, by name: comfort and layout", async () => {
    const w = inHeadset();
    w.enter();
    await w.tick();
    expect(w.said()).toEqual([]);
    w.controls.setTheme({ scale: 1.3 }, true);
    await w.tick();
    expect(w.said()).toEqual([{ text: 1.3 }]);
  });

  it("is never a switch that guards their privacy, though they changed it there", async () => {
    const { setShowsPictures, resetPictures } = await import("../src/picture.js");
    const w = inHeadset();
    w.enter();
    await w.tick();
    setShowsPictures(false);
    w.controls.setTheme({ motion: false }, true);
    await w.tick();
    expect(w.said()).toEqual([{ motion: false }]);
    expect(JSON.stringify(w.sent)).not.toMatch(/pictures|filesAnywhere|holding/);
    resetPictures();
  });

  it("is not said outside a headset: there the client draws the menu, and holds the settings itself", async () => {
    const w = inHeadset();
    w.controls.setTheme({ scale: 1.3 }, true);
    await w.tick();
    expect(w.said()).toEqual([]);
    // Nor is what they had as the session began: only a change made in it.
    w.enter();
    await w.tick();
    expect(w.said()).toEqual([]);
  });

  it("is not what the client itself said down: that is the client's already", async () => {
    const w = inHeadset();
    w.enter();
    await w.tick();
    w.say({ nswp: "menu", settings: { text: 1.2 } });
    await w.tick();
    expect(w.controls.theme.scale).toBe(1.2);
    expect(w.said()).toEqual([]);
  });

  it("stops when the session ends", async () => {
    const w = inHeadset();
    w.enter();
    await w.tick();
    w.leave();
    await w.tick();
    w.controls.setTheme({ scale: 1.1 }, true);
    await w.tick();
    expect(w.said()).toEqual([]);
  });
});

describe("what a world takes from above", () => {
  it("is a press on something it described, and on nothing else", () => {
    const w = make();
    w.say({ nswp: "menu", press: "room-join" });
    expect(w.pressed).toEqual([]);
    w.say(HAS);
    for (const id of ["room-join", "home", "bag-item", "big", "nothing"]) w.say({ nswp: "menu", press: id });
    return vi.advanceTimersByTimeAsync(50).then(() => expect(w.pressed).toEqual([["room-join", undefined]]));
  });

  it("is what was typed into a row, at the press", async () => {
    const w = make();
    w.say(HAS);
    w.say({ nswp: "menu", press: "guests-key", field: "npub1ana" });
    w.say({ nswp: "menu", press: "room-join", field: "ignored" });
    await vi.advanceTimersByTimeAsync(50);
    expect(w.pressed).toEqual([["guests-key", "npub1ana"], ["room-join", undefined]]);
  });

  it("is that the menu came up and went, as its own menu would have said", () => {
    const w = make();
    w.say(HAS);
    w.say({ nswp: "menu", open: true });
    w.say({ nswp: "menu", open: false });
    expect(w.signals.filter((s) => s.startsWith("menu"))).toEqual(["menuOpen", "menuClose"]);
  });

  it("is the visitor's settings, with the first answer and after", () => {
    const w = make();
    w.say({ nswp: "menu", has: true, v: 1, settings: { text: 1.3 } });
    expect(w.controls.theme.scale).toBe(1.3);
    // And never "load people's files from anywhere": nothing above a world turns that on.
    w.say({ nswp: "menu", settings: { motion: false, filesAnywhere: true } });
    expect(w.controls.theme.motion).toBe(false);
    expect(filesAnywhere()).toBe(false);
  });

  it("is nothing at all from a page that hasn't said it has the menu", () => {
    const w = make();
    w.say({ nswp: "menu", settings: { text: 1.4, filesAnywhere: true } });
    w.say({ nswp: "menu", open: true });
    w.say({ nswp: "menu", go: "home" });
    expect([w.controls.theme.scale, filesAnywhere(), w.signals, w.went()]).toEqual([1, false, [], 0]);
  });

  it("is to sign the visitor out here, done without asking and only from a client that has the menu", () => {
    let out = 0;
    const controls = createControls({ title: "The Gallery" });
    let hear: ((word: unknown) => void) | null = null;
    portAbove(controls, {
      above: { framed: () => true, sinceHere: () => 0, say: () => {}, hear: (fn) => (hear = fn) },
      keys: { addEventListener: (() => {}) as never, removeEventListener: (() => {}) as never },
      signOut: () => out++,
    });
    hear!({ nswp: "menu", sign: "out" });
    expect(out).toBe(0);
    hear!(HAS);
    hear!({ nswp: "menu", sign: "out" });
    hear!({ nswp: "menu", sign: "in" });
    expect(out).toBe(1);
  });

  it("is to go home, asked once", () => {
    const w = make();
    w.say(HAS);
    w.say({ nswp: "menu", go: "home" });
    w.say({ nswp: "menu", go: "home" });
    expect(w.went()).toBe(1);
  });
});

describe("the visitor's few keys", () => {
  it("go upward by name, and the summons is never heard by the world", () => {
    const w = make();
    w.say(HAS);
    const summon = w.key({ code: "Backquote", key: "`" });
    expect(summon.stopImmediatePropagation).toHaveBeenCalled();
    w.key({ key: "Escape", code: "Escape" });
    w.key({ key: "m", code: "KeyM" });
    w.key({ key: "3", code: "Digit3" });
    expect(w.sent.filter((s) => s.key).map((s) => s.key)).toEqual(["summon", "escape", "menu", "3"]);
  });

  it("are never any other key, a key held down, or anything typed into a box", () => {
    const w = make();
    w.say(HAS);
    for (const k of ["a", "w", " ", "Enter", "0", "F1"]) w.key({ key: k, code: k });
    w.key({ key: "3", code: "Digit3", repeat: true });
    w.key({ key: "3", code: "Digit3", ctrlKey: true });
    w.key({ key: "3", code: "Digit3", composedPath: () => [{ tagName: "INPUT" }] as never });
    expect(w.sent.filter((s) => s.key)).toEqual([]);
  });

  it("are the world's own while it has taken every key, but for the summons and Escape", async () => {
    const w = make();
    w.say(HAS);
    expect(w.worlds().at(-1)!.keys).toBe(true);
    w.controls.claimInput(true);
    for (const [key, code] of [["m", "KeyM"], ["3", "Digit3"], ["`", "Backquote"], ["Escape", "Escape"]]) w.key({ key, code });
    expect(w.sent.filter((s) => s.key).map((s) => s.key)).toEqual(["summon", "escape"]);
    // And it says so, so that the client leaves its digits alone too.
    await vi.advanceTimersByTimeAsync(125);
    expect(w.worlds().at(-1)!.keys).toBe(false);
  });

  it("are said to nobody while the menu is the world's own", () => {
    const w = make();
    const e = w.key({ code: "Backquote", key: "`" });
    expect(e.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(w.sent).toEqual([]);
  });
});

describe("pictures", () => {
  /** A world with a tile that has a picture, and a card with someone's picture by its address. */
  const withPictures = () => {
    const controls = createControls({ title: "The Gallery" });
    const canvas = { width: 512, height: 256 } as unknown as CanvasImageSource;
    controls.add({ id: "print", section: "camera", kind: "tile", label: "A print", picture: () => canvas, act: () => {} });
    controls.addSection({ id: "people", label: "People", card: () => ({ title: "Ana", tag: "By name", proven: true, sub: "npub1ana…", copy: "", text: "", picture: "https://pics.example/ana.png", color: "#336699", now: [] }) });
    const sent: Record<string, unknown>[] = [];
    let hear: ((word: unknown) => void) | null = null;
    const asked: unknown[] = [];
    const above = portAbove(controls, {
      above: { framed: () => true, sinceHere: () => 0, say: (word) => sent.push(word), hear: (fn) => (hear = fn) },
      keys: { addEventListener: (() => {}) as never, removeEventListener: (() => {}) as never },
      picture: async (from) => {
        asked.push(from);
        return { bitmapOf: typeof from === "string" ? from : "the print" };
      },
    });
    const worlds = () => sent.filter((w) => w.world).map((w) => w.world);
    /** The pictures sent, each alone, by the id it was for. */
    const pictures = () => Object.fromEntries(sent.filter((w) => w.picture).map((w) => [w.id as string, w.picture]));
    return { controls, above, say: (w: unknown) => hear?.(w), worlds, pictures, sent, asked, canvas };
  };

  it("are not made while the menu is down: nobody would see them", async () => {
    const w = withPictures();
    w.say(HAS);
    await vi.advanceTimersByTimeAsync(500);
    expect(w.asked).toEqual([]);
    expect(w.pictures()).toEqual({});
  });

  it("go up each alone once the menu is up, as bitmaps: a row's by its id, a card's by its tab", async () => {
    const w = withPictures();
    w.say(HAS);
    w.say({ nswp: "menu", open: true });
    await vi.advanceTimersByTimeAsync(500);
    // In the order of the tabs: People's card, then Camera's tile.
    expect(w.asked).toEqual(["https://pics.example/ana.png", w.canvas]);
    expect(w.pictures()).toEqual({ "card:people": { bitmapOf: "https://pics.example/ana.png" }, print: { bitmapOf: "the print" } });
    // What a client reads of each: a picture for an id, where it has a check for pictures.
    const word = w.sent.find((s) => s.id === "print")!;
    expect(readMenuWordUp({ ...word, nswp: "menu" }, { picture: (p) => !!p && typeof p === "object" })).toEqual({ what: "picture", id: "print", picture: { bitmapOf: "the print" } });
  });

  it("are never in the description, and neither is anyone's address", async () => {
    const w = withPictures();
    w.say(HAS);
    w.say({ nswp: "menu", open: true });
    await vi.advanceTimersByTimeAsync(500);
    expect(JSON.stringify(w.worlds())).not.toMatch(/picture|pics\.example/);
  });

  it("are made once for each thing, and afresh the next time the menu comes up", async () => {
    const w = withPictures();
    w.say(HAS);
    w.say({ nswp: "menu", open: true });
    await vi.advanceTimersByTimeAsync(500);
    w.controls.setTarget("A painting");
    await vi.advanceTimersByTimeAsync(500);
    expect(w.asked).toHaveLength(2);
    w.say({ nswp: "menu", open: false });
    w.say({ nswp: "menu", open: true });
    await vi.advanceTimersByTimeAsync(500);
    expect(w.asked).toHaveLength(4);
  });
});

describe("a file handed down, and something to save handed up", () => {
  const file = (name: string, type: string) => new File([new Uint8Array(70)], name, { type });
  const shot = () => new Blob([new Uint8Array(2561)], { type: "image/jpeg" });
  /** A world with a row that takes a picture or video, one that takes only pictures, and a camera. */
  const world = (has = true) => {
    const w = make();
    const got: [string, Blob | undefined][] = [];
    w.controls.add({ id: "panel-file", section: "panels", label: "Hang a picture or video from this device", kind: "file", accept: ["image", "video"], act: (_typed, f) => void got.push(["panel-file", f]) });
    w.controls.add({ id: "panel-photo", section: "panels", label: "Hang a photo", kind: "file", accept: ["image"], act: (_typed, f) => void got.push(["panel-photo", f]) });
    w.controls.add({ id: "camera-picture", section: "camera", label: "Take a picture", kind: "save", act: () => void got.push(["camera-picture", undefined]) });
    if (has) w.say(HAS);
    return { ...w, got, saves: () => w.sent.filter((x) => x.save !== undefined) };
  };
  const flush = () => vi.advanceTimersByTimeAsync(0);

  it("says a row that takes a file with the kinds it takes, and a row that saves as one", () => {
    const w = world();
    const said = cleanMenuWorld(w.worlds().at(-1));
    expect(said?.sections.find((s) => s.id === "panels")?.rows).toEqual([
      { id: "panel-file", label: "Hang a picture or video from this device", kind: "file", accept: ["image", "video"] },
      { id: "panel-photo", label: "Hang a photo", kind: "file", accept: ["image"] },
    ]);
    expect(said?.sections.find((s) => s.id === "camera")?.rows).toEqual([{ id: "camera-picture", label: "Take a picture", kind: "save" }]);
  });

  it("gives the row the file itself, with its own name", async () => {
    const w = world();
    const f = file("a dot.png", "image/png");
    w.say({ nswp: "menu", press: "panel-file", file: f });
    await flush();
    expect(w.got).toEqual([["panel-file", f]]);
    expect(w.got[0]![1]).toBe(f);
  });

  it("takes a file only for a row that takes one, and only of a kind that row asked for", async () => {
    const w = world();
    w.say({ nswp: "menu", press: "panel-photo", file: file("clip.mp4", "video/mp4") });
    w.say({ nswp: "menu", press: "camera-picture", file: file("a.png", "image/png") });
    w.say({ nswp: "menu", press: "room-join", file: file("a.png", "image/png") });
    w.say({ nswp: "menu", press: "no-such-row", file: file("a.png", "image/png") });
    await flush();
    expect([w.got, w.pressed]).toEqual([[], []]);
  });

  it("gives a file whose name may not go with it without one", async () => {
    const w = world();
    w.say({ nswp: "menu", press: "panel-file", file: file("home/ana/secret plans.png", "image/png") });
    await flush();
    const given = w.got[0]![1]!;
    expect([(given as { name?: string }).name, given.size, given.type]).toEqual([undefined, 70, "image/png"]);
  });

  it("gives a row that takes a file nothing, where the press carried none", async () => {
    const w = world();
    w.say({ nswp: "menu", press: "panel-file" });
    await flush();
    expect(w.got).toEqual([["panel-file", undefined]]);
  });

  it("hands what it would save up to the client, as the answer to a press on a row that saves", async () => {
    const w = world();
    // No press yet: there is nothing for a save to answer, so it waits for one.
    expect([savesWait(), handUp(shot())]).toEqual([true, false]);
    w.say({ nswp: "menu", press: "camera-picture" });
    await flush();
    expect(savesWait()).toBe(false);
    const picture = shot();
    expect(handUp(picture)).toBe(true);
    expect(w.saves()).toEqual([{ nswp: "menu", save: picture, id: "camera-picture" }]);
    expect((w.saves()[0] as { save: Blob }).save).toBe(picture);
  });

  it("hands up only so many for one press, only for a while, and only a picture or a clip", async () => {
    const w = world();
    w.say({ nswp: "menu", press: "camera-picture" });
    expect(handUp(new Blob(["<p>"], { type: "text/html" }))).toBe(false);
    expect(handUp(new Blob([], { type: "image/png" }))).toBe(false);
    for (let i = 0; i < MENU_LIMITS.saves; i++) expect(handUp(shot()), String(i)).toBe(true);
    expect([handUp(shot()), savesWait()]).toEqual([false, true]);
    expect(w.saves()).toHaveLength(MENU_LIMITS.saves);
    // Another press, and then too long after it.
    w.say({ nswp: "menu", press: "camera-picture" });
    await vi.advanceTimersByTimeAsync(MENU_SAVE_MS + 1);
    expect([handUp(shot()), savesWait()]).toEqual([false, true]);
    expect(w.saves()).toHaveLength(MENU_LIMITS.saves);
  });

  it("is not opened by a press on any other kind of row", async () => {
    const w = world();
    w.say({ nswp: "menu", press: "room-join" });
    await flush();
    expect([w.pressed.map(([id]) => id), handUp(shot()), savesWait()]).toEqual([["room-join"], false, true]);
  });

  it("saves from its own page where no client has the menu, and again once a client gives the menu back", async () => {
    const alone = world(false);
    await vi.advanceTimersByTimeAsync(MENU_WAIT_MS + 1);
    expect([savesWait(), handUp(shot())]).toEqual([false, false]);
    expect(alone.saves()).toEqual([]);
    const w = world();
    w.say({ nswp: "menu", press: "camera-picture" });
    w.say({ nswp: "menu", has: false });
    expect([savesWait(), handUp(shot())]).toEqual([false, false]);
    // And a client that takes it again starts with no press waiting.
    w.say(HAS);
    expect([savesWait(), handUp(shot())]).toEqual([true, false]);
    w.above.dispose();
    expect([savesWait(), handUp(shot())]).toEqual([false, false]);
  });
});

describe("a page of its client's own origin", () => {
  it("describes the visitor's own tabs too, and takes presses on them, where it says so; and says none of them otherwise", async () => {
    const tabsOf = (w: Record<string, unknown> | undefined) => (w?.sections as { id: string }[]).map((s) => s.id);
    const plain = make();
    plain.say(HAS);
    expect(tabsOf(plain.worlds().at(-1))).toEqual(["travel", "room", "following", "guests"]);
    plain.say({ nswp: "menu", press: "bag-item" });
    await vi.advanceTimersByTimeAsync(0);
    expect(plain.pressed).toEqual([]);

    const controls = createControls({ title: "The room" });
    const pressed: string[] = [];
    controls.add({ id: "home", section: "travel", label: "Go home", act: () => void pressed.push("home") });
    controls.add({ id: "bag-item", section: "bag", label: "A lantern", act: () => void pressed.push("bag-item") });
    controls.add({ id: "people-pictures", section: "people", label: "Pictures", act: () => {} });
    const sent: Record<string, unknown>[] = [];
    let hear: ((word: unknown) => void) | null = null;
    portAbove(controls, { own: true, above: { framed: () => true, sinceHere: () => 0, say: (word) => sent.push(word), hear: (fn) => void (hear = fn) }, keys: { addEventListener: (() => {}) as never, removeEventListener: (() => {}) as never } });
    hear!(HAS);
    const said = sent.filter((w) => w.world).at(-1)!.world as Record<string, unknown>;
    expect((said.sections as { id: string; rows: { id: string }[] }[]).map((s) => `${s.id}: ${s.rows.map((r) => r.id).join(" ")}`)).toEqual(["travel: home", "bag: bag-item"]);
    // A switch that changes a setting is still the client's page's own to draw, and is not said.
    expect(JSON.stringify(said)).not.toMatch(/people-pictures|look-/);
    hear!({ nswp: "menu", press: "bag-item" });
    hear!({ nswp: "menu", press: "home" });
    await vi.advanceTimersByTimeAsync(0);
    expect(pressed).toEqual(["bag-item", "home"]);
  });
});
