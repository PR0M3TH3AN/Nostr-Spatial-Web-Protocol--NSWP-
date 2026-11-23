import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cleanMenuSettings, cleanMenuWorld, LEAVE_MS, MENU_CARD_PICTURE, MENU_FILE_KINDS, MENU_KEYS, MENU_ROW_KINDS, MENU_SAVE_MS, MENU_SAVE_TYPES, menuFileKind, menuFileName, menuSaveType, MENU_LIMITS, MENU_REPORTED, MENU_VERSION, MENU_VISITOR_TABS, MENU_WAIT_MS, MENU_WORLD_TABS, menuBytes, menuVersionOf, readMenuWordDown, readMenuWordUp, reportedSettings, type MenuReadOptions, type MenuWorld } from "../src/menu.js";

/**
 * The client has the menu (protocol/02-doors.md): the words between a framed world and the page above it.
 * `vectors/menu-words.json` holds the examples; these run them, and try what a file of JSON can't hold: pictures,
 * and a world that sends far too much.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const v = JSON.parse(readFileSync(join(root, "vectors/menu-words.json"), "utf8")) as {
  limits: Record<string, number>;
  describing: { name: string; opts?: MenuReadOptions; world: unknown; expect: unknown }[];
  down: { name: string; word: unknown; expect: unknown }[];
  up: { name: string; word: unknown; expect: unknown }[];
  here: { name: string; here: unknown; expect: number }[];
};

describe("the menu's words, by the examples", () => {
  it("has examples of every kind", () => {
    expect([v.describing.length, v.down.length, v.up.length, v.here.length]).toEqual([21, 25, 16, 4]);
  });
  for (const c of v.describing) it(`a description: ${c.name}`, () => expect(cleanMenuWorld(c.world, c.opts)).toEqual(c.expect));
  for (const c of v.down) it(`a word from the page above: ${c.name}`, () => expect(readMenuWordDown(c.word)).toEqual(c.expect));
  for (const c of v.up) it(`a word from the page in the frame: ${c.name}`, () => expect(readMenuWordUp(c.word)).toEqual(c.expect));
  for (const c of v.here) it(`a world's here: ${c.name}`, () => expect(menuVersionOf(c.here)).toBe(c.expect));
});

describe("the limits and the lists", () => {
  it("are the ones the plan and the protocol give", () => {
    expect(MENU_LIMITS).toEqual({ sections: 12, rows: 60, allRows: 200, label: 120, picture: 256, bytes: 65536, ownTabs: 2, say: 200, copy: 2000, field: 500, title: 80, note: 400, file: 67_108_864, fileName: 255, save: 67_108_864, saves: 12 });
    expect(v.limits).toEqual(MENU_LIMITS);
    expect([MENU_VERSION, MENU_WAIT_MS, LEAVE_MS]).toEqual([1, 300, 1000]);
    expect(MENU_KEYS).toEqual(["summon", "escape", "menu", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("put no tab on both sides", () => {
    expect(MENU_VISITOR_TABS.filter((t) => (MENU_WORLD_TABS as readonly string[]).includes(t))).toEqual([]);
    expect(new Set([...MENU_VISITOR_TABS, ...MENU_WORLD_TABS]).size).toBe(MENU_VISITOR_TABS.length + MENU_WORLD_TABS.length);
  });

  it("let a world report back nothing that guards the visitor's privacy, or says who they are or what they hold", () => {
    for (const name of ["filesAnywhere", "pictures", "models", "chat", "items", "holding", "full"]) expect(MENU_REPORTED as readonly string[], name).not.toContain(name);
    expect(reportedSettings({ filesAnywhere: true, pictures: true, models: true, chat: true, items: true, holding: { item: `37303:${"ab".repeat(32)}:x` }, turn: 30 })).toEqual({ turn: 30 });
    expect(reportedSettings(null)).toEqual({});
  });

  it("let nothing above a world turn loading from anywhere on: a client's settings are cleaned as a link's are", () => {
    expect(cleanMenuSettings({ filesAnywhere: true, text: 1.1 })).toEqual({ text: 1.1 });
    expect(readMenuWordDown({ nswp: "menu", has: true, v: 1, settings: { filesAnywhere: true } })).toEqual({ what: "has", has: true, v: 1, settings: {} });
    expect(readMenuWordDown({ nswp: "menu", settings: { filesAnywhere: true } })).toEqual({ what: "settings", settings: {} });
    // Off is always safe, and is taken.
    expect(cleanMenuSettings({ filesAnywhere: false })).toEqual({ filesAnywhere: false });
    expect(cleanMenuSettings("on")).toEqual({});
  });
});

describe("the proven mark on a card", () => {
  const world = { sections: [{ id: "people", card: { title: "Ana", tag: "By name", proven: true }, rows: [] }] };
  it("is never kept from a world: the client would be vouching for a world's say-so", () => {
    expect(cleanMenuWorld(world)!.sections[0]!.card).toEqual({ title: "Ana", tag: "By name" });
    expect(cleanMenuWorld(world, { also: ["following", "messages"] })!.sections[0]!.card!.proven).toBeUndefined();
    expect(readMenuWordUp({ nswp: "menu", world })).toMatchObject({ what: "world" });
    expect(JSON.stringify(readMenuWordUp({ nswp: "menu", world }))).not.toMatch(/proven/);
  });
  it("is kept from a page of the client's own origin", () => {
    expect(cleanMenuWorld(world, { own: true })!.sections[0]!.card).toEqual({ title: "Ana", tag: "By name", proven: true });
  });
});

describe("signing in and out of a world", () => {
  it("has a word for signing out, which carries nothing, and no word for signing in", () => {
    expect(readMenuWordDown({ nswp: "menu", sign: "out" })).toEqual({ what: "sign", sign: "out" });
    expect(readMenuWordDown({ nswp: "menu", sign: "out", as: "npub1ana", name: "Ana" })).toEqual({ what: "sign", sign: "out" });
    for (const sign of ["in", "up", true, "", { out: true }]) expect(readMenuWordDown({ nswp: "menu", sign }), JSON.stringify(sign)).toBeNull();
    // And a world can't say it upward: it is the client's word.
    expect(readMenuWordUp({ nswp: "menu", sign: "out", say: "Signed out" })).toBeNull();
  });

  it("is told by a world as one of four facts, never as words of its own", () => {
    const state = (signIn: unknown) => cleanMenuWorld({ state: { signIn } })!.state.signIn;
    expect(["none", "ready", "asking", "unanswered"].map(state)).toEqual(["none", "ready", "asking", "unanswered"]);
    for (const said of ["Sign in at evil.example", "READY", 1, true, null, undefined]) expect(state(said), String(said)).toBe("none");
  });
});

describe("a card's picture, and a row named like one", () => {
  it("can never be confused: a row whose id begins as a card's picture's does is left out", () => {
    expect(MENU_CARD_PICTURE).toBe("card:");
    const world = { sections: [{ id: "people", card: { title: "Ana" }, rows: [{ id: "card:people", label: "A row made to look like the card" }, { id: "card", label: "Fine" }, { id: "postcard:1", label: "Fine too" }] }] };
    expect(cleanMenuWorld(world)!.sections[0]!.rows.map((r) => r.id)).toEqual(["card", "postcard:1"]);
    // A press can't be for one either: nothing the client drew has that id.
    expect(cleanMenuWorld(world, { own: true })!.sections[0]!.rows.map((r) => r.id)).toEqual(["card", "postcard:1"]);
  });
});

describe("pictures", () => {
  const bitmap = { width: 64, height: 64 };
  const big = { width: 512, height: 64 };
  const picture = (p: unknown) => !!p && typeof p === "object" && (p as { width: number }).width <= MENU_LIMITS.picture && (p as { height: number }).height <= MENU_LIMITS.picture;
  const world = { sections: [{ id: "camera", card: { title: "The view", picture: bitmap }, rows: [{ id: "small", label: "Small", kind: "tile", picture: bitmap }, { id: "large", label: "Large", kind: "tile", picture: big }] }] };

  it("are kept only when the caller's own check lets them through", () => {
    const got = cleanMenuWorld(world, { picture })!;
    expect(got.sections[0]!.rows.map((r) => [r.id, r.picture])).toEqual([["small", bitmap], ["large", undefined]]);
    expect(got.sections[0]!.card!.picture).toBe(bitmap);
    expect(cleanMenuWorld(world)!.sections[0]!.rows.every((r) => r.picture === undefined)).toBe(true);
  });

  it("are not counted in a description's size", () => {
    expect(menuBytes(cleanMenuWorld(world, { picture })!)).toBe(menuBytes(cleanMenuWorld(world)!));
  });

  it("sent alone are for a row by its id, and need the same check", () => {
    expect(readMenuWordUp({ nswp: "menu", picture: bitmap, id: "small" }, { picture })).toEqual({ what: "picture", id: "small", picture: bitmap });
    expect(readMenuWordUp({ nswp: "menu", picture: big, id: "small" }, { picture })).toBeNull();
    expect(readMenuWordUp({ nswp: "menu", picture: bitmap }, { picture })).toBeNull();
    expect(readMenuWordUp({ nswp: "menu", picture: bitmap, id: "small" })).toBeNull();
  });
});

describe("a world that sends too much", () => {
  it("is read in bounded work: only the first tabs and rows are looked at", () => {
    let looked = 0;
    const row = () => ({ get id() { looked++; return `r${looked}`; }, label: "Row" });
    const sections = Array.from({ length: 40 }, (_, i) => ({ id: i === 0 ? "room" : `t${i}`, label: "T", rows: Array.from({ length: 400 }, row) }));
    const got = cleanMenuWorld({ sections })!;
    // The room, and the two tabs of its own a world may add: the rest are never opened.
    expect(got.sections.map((s) => s.rows.length)).toEqual([60, 60, 60]);
    expect(looked).toBe(3 * MENU_LIMITS.rows);
  });

  it("is left out whole when what was kept is over the limit on size", () => {
    const fat = (n: number): unknown => ({ sections: ["room", "people", "view"].map((id) => ({ id, rows: Array.from({ length: n }, (_, i) => ({ id: `${id}${i}`, label: "Copy", kind: "copy", copy: "c".repeat(MENU_LIMITS.copy) })) })) });
    expect(cleanMenuWorld(fat(5))).not.toBeNull();
    expect(cleanMenuWorld(fat(20))).toBeNull();
  });

  it("has its size counted as the bytes of its JSON in UTF-8", () => {
    const base = cleanMenuWorld({})!;
    const titled = (title: string): MenuWorld => ({ ...base, title });
    expect(menuBytes(titled("a")) - menuBytes(base)).toBe(1);
    expect(menuBytes(titled("é")) - menuBytes(base)).toBe(2);
    expect(menuBytes(titled("世")) - menuBytes(base)).toBe(3);
    expect(menuBytes(titled("🌳")) - menuBytes(base)).toBe(4);
  });

  it("has characters counted as a reader counts them, not as the machine stores them", () => {
    const trees = "🌳".repeat(MENU_LIMITS.title);
    expect(cleanMenuWorld({ title: trees })!.title).toBe(trees);
    expect(cleanMenuWorld({ title: `${trees}🌳` })!.title).toBe("");
  });

  it("never throws, whatever arrives", () => {
    for (const bad of [null, undefined, 0, "", [], () => 1, { sections: "room" }, { sections: [null, 5, "x", { id: 5 }, { id: "room", rows: "many" }, { id: "room", rows: [null, 5, [], { id: {}, label: [] }] }] }, { state: 5, target: "x", loading: [] }]) {
      expect(() => cleanMenuWorld(bad)).not.toThrow();
      expect(() => readMenuWordUp({ nswp: "menu", world: bad })).not.toThrow();
      expect(() => readMenuWordDown({ nswp: "menu", settings: bad, press: bad })).not.toThrow();
    }
  });
});

/**
 * A file the visitor chose going down with a press, and a picture or a clip going up to be saved. A file of JSON
 * can't hold a file, so these are here and not among the examples.
 */
describe("a file going down, and a picture going up", () => {
  const file = (name: string, type: string, size = 70) => new File([new Uint8Array(size)], name, { type });
  /** A file that says it is bigger than it is: nothing of that size is made for a test. */
  const sized = (size: number, type: string) => Object.defineProperty(new Blob([new Uint8Array(4)], { type }), "size", { value: size });

  it("has the two kinds of row, the kinds of file, the types to save, and the limits, as given", () => {
    expect(MENU_ROW_KINDS).toEqual(["button", "swatch", "tile", "line", "copy", "field", "file", "save"]);
    expect(MENU_FILE_KINDS).toEqual(["image", "video"]);
    expect(MENU_SAVE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp", "video/webm", "video/mp4"]);
    expect([MENU_LIMITS.file, MENU_LIMITS.fileName, MENU_LIMITS.save, MENU_LIMITS.saves, MENU_SAVE_MS]).toEqual([67_108_864, 255, 67_108_864, 12, 10_000]);
  });

  it("a press carries the file itself, with its kind and its own name", () => {
    const f = file("a dot.png", "image/png");
    const word = readMenuWordDown({ nswp: "menu", press: "panel-file", file: f });
    expect(word).toEqual({ what: "press", press: "panel-file", file: f, kind: "image", name: "a dot.png" });
    expect((word as { file: Blob }).file).toBe(f);
    expect(readMenuWordDown({ nswp: "menu", press: "panel-file", file: file("clip.MP4", "Video/MP4") })).toMatchObject({ kind: "video", name: "clip.MP4" });
  });

  it("is no press with a file of no kind a row takes, an empty one, or one over the limit", () => {
    for (const type of ["audio/mpeg", "application/pdf", "text/html", "", "image", "/png"]) expect(readMenuWordDown({ nswp: "menu", press: "panel-file", file: file("x", type) }), type).toBeNull();
    expect(readMenuWordDown({ nswp: "menu", press: "panel-file", file: file("nothing.png", "image/png", 0) })).toBeNull();
    expect(readMenuWordDown({ nswp: "menu", press: "panel-file", file: sized(MENU_LIMITS.file, "image/png") })).not.toBeNull();
    expect(readMenuWordDown({ nswp: "menu", press: "panel-file", file: sized(MENU_LIMITS.file + 1, "image/png") })).toBeNull();
  });

  it("never carries both a file and what was typed", () => {
    expect(readMenuWordDown({ nswp: "menu", press: "panel-file", file: file("a.png", "image/png"), field: "and this" })).toBeNull();
  });

  it("leaves a name out that is too long, is a path, or has something unseen in it: the file still goes", () => {
    for (const name of ["n".repeat(MENU_LIMITS.fileName + 1), "C:\\Users\\ana\\dot.png", "home/ana/dot.png", "dot\u202egnp.exe", ""]) {
      const f = file(name, "image/png");
      const word = readMenuWordDown({ nswp: "menu", press: "panel-file", file: f });
      expect(word, name).toEqual({ what: "press", press: "panel-file", file: f, kind: "image" });
    }
    expect(readMenuWordDown({ nswp: "menu", press: "panel-file", file: file("n".repeat(MENU_LIMITS.fileName), "image/png") })).toMatchObject({ name: "n".repeat(MENU_LIMITS.fileName) });
    // A blob has no name at all.
    const blob = new Blob([new Uint8Array(4)], { type: "video/webm" });
    expect(readMenuWordDown({ nswp: "menu", press: "panel-file", file: blob })).toEqual({ what: "press", press: "panel-file", file: blob, kind: "video" });
  });

  it("a world hands up a picture or a clip, for a row by id, and its type is read without how it was packed", () => {
    const shot = new Blob([new Uint8Array(2561)], { type: "image/jpeg" });
    expect(readMenuWordUp({ nswp: "menu", save: shot, id: "camera-picture" })).toEqual({ what: "save", id: "camera-picture", save: shot, type: "image/jpeg" });
    const clip = new Blob([new Uint8Array(9)], { type: "video/webm;codecs=vp9" });
    expect(readMenuWordUp({ nswp: "menu", save: clip, id: "camera-clip" })).toEqual({ what: "save", id: "camera-clip", save: clip, type: "video/webm" });
  });

  it("reads nothing to save of another type, with no row, empty, or over the limit", () => {
    for (const type of ["image/svg+xml", "text/html", "application/pdf", "application/x-msdownload", "image/gif", "video/quicktime", ""]) expect(readMenuWordUp({ nswp: "menu", save: new Blob(["x"], { type }), id: "camera-picture" }), type).toBeNull();
    const shot = new Blob(["x"], { type: "image/png" });
    expect(readMenuWordUp({ nswp: "menu", save: shot })).toBeNull();
    expect(readMenuWordUp({ nswp: "menu", save: shot, id: "an id" })).toBeNull();
    expect(readMenuWordUp({ nswp: "menu", save: new Blob([], { type: "image/png" }), id: "camera-picture" })).toBeNull();
    expect(readMenuWordUp({ nswp: "menu", save: sized(MENU_LIMITS.save, "image/png"), id: "camera-picture" })).not.toBeNull();
    expect(readMenuWordUp({ nswp: "menu", save: sized(MENU_LIMITS.save + 1, "image/png"), id: "camera-picture" })).toBeNull();
  });

  it("is not read by the wrong side: a world never reads something to save, a client never reads a file", () => {
    const f = file("a.png", "image/png");
    expect(readMenuWordDown({ nswp: "menu", save: f, id: "camera-picture" })).toBeNull();
    expect(readMenuWordUp({ nswp: "menu", press: "panel-file", file: f })).toBeNull();
  });

  it("says a file's kind, a name that may go, and a type to save, of anything at all", () => {
    expect(["image/png", "IMAGE/x-anything", "video/mp4", "audio/ogg", "image", "", 5, null].map(menuFileKind)).toEqual(["image", "image", "video", null, null, null, null, null]);
    expect(["dot.png", "a/b.png", "a\\b.png", "", 5].map(menuFileName)).toEqual(["dot.png", undefined, undefined, undefined, undefined]);
    expect(["image/jpeg", " Video/WebM ; codecs=vp8", "image/gif", 5].map(menuSaveType)).toEqual(["image/jpeg", "video/webm", null, null]);
  });
});
