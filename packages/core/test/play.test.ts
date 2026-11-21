import { describe, expect, it } from "vitest";
import { BAG_KIND, bagIn, bagTints, buildDid, buildHit, buildItem, buildShot, buildState, buildTints, changeBag, cleanAsk, cleanTints, parseTints, tintBag, TINT_PALETTE, createRate, finalizeEvent, GRAVITY, ITEM_BOX_CSP, ITEM_BOX_HTML, meetsPerson, parseDid, parseHit, parseItem, parseShot, parseState, PLAY_LIMITS, shotAt, struck } from "../src/index.js";
import { TEST_KEY_1 } from "./helpers.js";

const H = (c: string) => c.repeat(64);

describe("a thing sent out", () => {
  const shot = { id: 7, name: "dart", from: [1, 1.4, -2] as [number, number, number], velocity: [0, 3, -12] as [number, number, number], stick: 3 };

  it("is said to a room and read back the same", () => {
    const said = buildShot(shot)!;
    expect(said).toBe("shot:7,dart,1,1.4,-2,0,3,-12,3");
    expect(parseShot(said)).toEqual(shot);
  });

  it("is slowed to the fastest anything may go, and stays stuck no longer than anything may", () => {
    const fast = parseShot(buildShot({ ...shot, velocity: [0, 0, -400], stick: 99 })!)!;
    expect(Math.hypot(...fast.velocity)).toBeCloseTo(PLAY_LIMITS.speed, 3);
    expect(fast.stick).toBe(PLAY_LIMITS.stick);
    // And again by whoever reads it, whatever the sender's client did.
    expect(Math.hypot(...parseShot("shot:1,dart,0,1,0,0,0,-900,3")!.velocity)).toBeCloseTo(PLAY_LIMITS.speed, 3);
  });

  it("is nothing when it isn't one", () => {
    for (const bad of ["shot:1,dart,0,1,0,0,0,0,3", "shot:1,DART,0,1,0,0,0,-9,3", "shot:x,dart,0,1,0,0,0,-9,3", "shot:1,dart,0,1,0,0,0,-9", "shot:1,dart,0,NaN,0,0,0,-9,3", "shot:1,dart,99999,1,0,0,0,-9,3", "hit:1", 7, null]) expect(parseShot(bad), String(bad)).toBeNull();
  });

  it("flies straight on and falls: aimed level it drops, aimed higher it goes further", () => {
    const at = shotAt(shot, 0.5);
    expect(at[1]).toBeCloseTo(1.4 + 3 * 0.5 - 0.5 * GRAVITY * 0.25, 6);
    // How far along the ground before it is back at the height it left from.
    const reach = (up: number) => {
      const speed = 12;
      const v = [0, Math.sin(up) * speed, -Math.cos(up) * speed] as [number, number, number];
      const t = (2 * v[1]) / GRAVITY;
      return -shotAt({ from: [0, 0, 0], velocity: v }, t)[2];
    };
    expect(reach(0.3)).toBeGreaterThan(reach(0.1));
    expect(reach(Math.PI / 4)).toBeCloseTo((12 * 12) / GRAVITY, 3);
  });
});

describe("someone saying a thing reached them", () => {
  it("is said and read back, and is nothing when it isn't one", () => {
    const hit = { by: H("a"), id: 7, at: [0.1, 1.2, -0.05] as [number, number, number] };
    expect(parseHit(buildHit(hit))).toEqual(hit);
    for (const bad of [`hit:${H("a")},7,0,99,0`, "hit:nobody,7,0,1,0", `hit:${H("a")},-1,0,1,0`, `hit:${H("a")},7,0,1`]) expect(parseHit(bad), bad).toBeNull();
  });

  it("meets a person only where they stand, from their feet to their height", () => {
    const feet = [0, 0, 0];
    // Straight at their chest.
    expect(meetsPerson([0, 1.2, 3], [0, 1.2, -3], feet, 1.7, 0.28)).toBeGreaterThan(0.4);
    // Over their head, past their side, and short of them.
    expect(meetsPerson([0, 2.3, 3], [0, 2.3, -3], feet, 1.7, 0.28)).toBeNull();
    expect(meetsPerson([0.6, 1.2, 3], [0.6, 1.2, -3], feet, 1.7, 0.28)).toBeNull();
    expect(meetsPerson([0, 1.2, 3], [0, 1.2, 1], feet, 1.7, 0.28)).toBeNull();
    // Someone sitting is shorter.
    expect(meetsPerson([0, 1.5, 3], [0, 1.5, -3], feet, 1.2, 0.28)).toBeNull();
  });
});

describe("what an item did, and what a person has", () => {
  it("says a sound or an animation of its own by name, and nothing else", () => {
    expect(parseDid(buildDid({ kind: "sound", name: "fire" }))).toEqual({ kind: "sound", name: "fire" });
    expect(parseDid(buildDid({ kind: "clip", name: "Reload.001" }))).toEqual({ kind: "clip", name: "Reload.001" });
    for (const bad of ["did:sound,../etc", "did:video,fire", "did:sound", "did:clip,"]) expect(parseDid(bad), bad).toBeNull();
  });

  it("keeps health as whole numbers within what is full", () => {
    expect(parseState(buildState({ name: "health", value: 3, full: 5 }))).toEqual({ name: "health", value: 3, full: 5 });
    for (const bad of ["st:health,6,5", "st:health,-1,5", "st:mana,1,5", "st:health,1.5,5", "st:health,1,0"]) expect(parseState(bad), bad).toBeNull();
    expect(struck(5, 1)).toBe(4);
    expect(struck(1, 3)).toBe(0);
    // Nothing takes more than everything, and nothing here gives any back.
    expect(struck(5, 99)).toBe(0);
    expect(struck(3, -1)).toBe(2);
  });
});

describe("what an item's script may ask for", () => {
  it("is a closed list, each thing tidied", () => {
    expect(cleanAsk("play", ["fire"])).toEqual({ ask: "play", name: "fire" });
    expect(cleanAsk("send", ["dart", { speed: 14, stick: 3 }])).toEqual({ ask: "send", name: "dart", speed: 14, stick: 3, lift: 0, spread: 0 });
    expect(cleanAsk("send", ["dart", { speed: 9999, stick: 9999, spread: 9999 }])).toMatchObject({ speed: PLAY_LIMITS.speed, stick: PLAY_LIMITS.stick, spread: PLAY_LIMITS.spread });
    // A little off its aim, when asked: never the other way, and never by more than the ceiling.
    expect(cleanAsk("send", ["dart", { spread: 0.015 }])).toMatchObject({ spread: 0.015 });
    expect(cleanAsk("send", ["dart", { spread: -1 }])).toMatchObject({ spread: 0 });
    expect(cleanAsk("send", ["dart", null])).toMatchObject({ speed: 12, stick: 3 });
    // Its own words can't pass for the kit's, or carry anything but a few plain characters.
    expect(cleanAsk("show", ["5 / 5 <b>\u202eYou were signed out\n"])).toEqual({ ask: "show", text: "5 / 5 bYou were signed o" });
    for (const [name, args] of [["fetch", ["https://x.example"]], ["play", ["../x"]], ["send", [7]], ["eval", ["1"]], ["show", [5]]] as const) expect(cleanAsk(name, args), name).toBeNull();
  });

  it("is let through a few at once and then so many a second", () => {
    const rate = createRate(3, 2);
    expect([rate.take(0), rate.take(0), rate.take(0), rate.take(0)]).toEqual([true, true, true, false]);
    expect(rate.take(400)).toBe(false);
    expect(rate.take(600)).toBe(true);
  });

  it("runs in a page that may reach nothing", () => {
    expect(ITEM_BOX_CSP).toContain("default-src 'none'");
    for (const open of ["connect-src", "unsafe-eval", "http", "*"]) expect(ITEM_BOX_CSP).not.toContain(open);
    // The page itself names no address, loads nothing, and keeps nothing.
    expect(ITEM_BOX_HTML).not.toMatch(/https?:|src=|localStorage|indexedDB\.|document\.cookie/);
    expect(ITEM_BOX_HTML).toContain("worker.terminate()");
  });
});

describe("a holder's own colours", () => {
  const item = { tints: [{ slot: "accent" }, { slot: "dart" }] };

  it("are kept to the tints the item has, and to colours written as colours", () => {
    expect(cleanTints(item, { accent: "#8b5cf6", dart: "#46d95a", barrel: "#ffffff" })).toEqual({ accent: "#8b5cf6", dart: "#46d95a" });
    expect(cleanTints(item, { accent: "purple", dart: "#46D95A" })).toEqual({});
    expect(cleanTints(item, "red")).toEqual({});
    expect(cleanTints(null, { accent: "#8b5cf6" })).toEqual({});
  });

  it("are said to a room and read back, and nothing else is read as them", () => {
    const said = buildTints({ accent: "#8b5cf6", dart: "#46d95a" });
    expect(said).toBe("tint:accent=8b5cf6,dart=46d95a");
    expect(parseTints(said)).toEqual({ accent: "#8b5cf6", dart: "#46d95a" });
    // None chosen is a thing to say too: "as its maker made it".
    expect(parseTints(buildTints({}))).toEqual({});
    for (const bad of ["tint:accent=red", "tint:ACCENT=8b5cf6", "tint:accent=8b5cf6;x", "hold:x", 7]) expect(parseTints(bad), String(bad)).toBeNull();
  });

  it("are offered from a short list, each a colour written as one", () => {
    expect(TINT_PALETTE.length).toBeGreaterThanOrEqual(8);
    for (const c of TINT_PALETTE) expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(TINT_PALETTE.map((c) => c.color)).size).toBe(TINT_PALETTE.length);
  });

  it("go in the bag beside the thing they are for, and leave it when the thing does", () => {
    const LANTERN = `37303:${H("a")}:brass-lantern`;
    const BLASTER = `37303:${H("a")}:dart-blaster`;
    const bag = { kind: BAG_KIND, created_at: 100, tags: [["d", "bag"], ["a", LANTERN], ["a", BLASTER], ["t", "kept"]], content: "" };
    const coloured = tintBag(bag, { item: BLASTER, tints: { accent: "#8b5cf6", dart: "#46d95a" }, now: 50 })!;
    expect(coloured.created_at).toBe(101);
    expect(bagTints(coloured)).toEqual({ [BLASTER]: { accent: "#8b5cf6", dart: "#46d95a" } });
    // Everything else in the bag is as it was.
    expect(bagIn(coloured)).toEqual([LANTERN, BLASTER]);
    expect(coloured.tags.some((t) => t[0] === "t" && t[1] === "kept")).toBe(true);
    // The same colours again: nothing to sign. A thing that isn't in the bag: nothing to sign.
    expect(tintBag(coloured, { item: BLASTER, tints: { accent: "#8b5cf6", dart: "#46d95a" }, now: 200 })).toBeNull();
    expect(tintBag(bag, { item: `37303:${H("a")}:old-book`, tints: { accent: "#8b5cf6" }, now: 200 })).toBeNull();
    // Changed again, there is still one line for it. Taken out of the bag, its colours go with it.
    const again = tintBag(coloured, { item: BLASTER, tints: { accent: "#e8362c" }, now: 200 })!;
    expect(again.tags.filter((t) => t[0] === "tint")).toEqual([["tint", BLASTER, "accent=#e8362c"]]);
    expect(bagTints(changeBag(again, { remove: BLASTER, now: 300 })!)).toEqual({});
    // Colours for a thing that isn't in the bag are not read.
    expect(bagTints({ tags: [["d", "bag"], ["a", LANTERN], ["tint", BLASTER, "accent=#e8362c"]] })).toEqual({});
  });
});

describe("an item that does something, as its description says it", () => {
  const blaster = {
    d: "dart-blaster",
    title: "Dart blaster",
    model: { url: `https://items.example/${H("a")}.glb`, sha256: H("a") },
    size: [0.3, 0.2, 0.06] as [number, number, number],
    behaviors: ["holdable" as const],
    fits: ["hand-right" as const],
    script: { url: `https://items.example/${H("b")}.js`, sha256: H("b") },
    sounds: { fire: { url: `https://items.example/${H("c")}.ogg`, sha256: H("c") }, impact: { url: `https://items.example/${H("d")}.ogg`, sha256: H("d") } },
    sends: [{ name: "dart", model: { url: `https://items.example/${H("e")}.glb`, sha256: H("e") }, size: [0.02, 0.02, 0.09] as [number, number, number], lands: "impact", tells: "fire", trail: 0.22 }],
    tints: [
      { slot: "accent", label: "Accent", color: "#f2691c" },
      { slot: "dart", label: "Darts", color: "#35f0e0" },
    ],
    aim: { at: [0, 0.217, -0.076] as [number, number, number], zoom: 0.6 },
    effects: [{ of: "dart", state: "health" as const, take: 1 }],
    does: { use: "Fire", second: "Reload" },
  };

  it("is written and read back: its sounds, what it sends out, what that asks of a person, and its buttons", () => {
    const item = parseItem(finalizeEvent(buildItem({ ...blaster, now: 1_800_000_000 })!, TEST_KEY_1))!;
    expect(item.sounds).toEqual(blaster.sounds);
    expect(item.sends).toEqual(blaster.sends);
    expect(item.effects).toEqual(blaster.effects);
    expect(item.does).toEqual(blaster.does);
    expect(item.tints).toEqual(blaster.tints);
    expect(item.aim).toEqual(blaster.aim);
    expect(item.script).toEqual(blaster.script);
  });

  it("can't be written with a sound that isn't a file with a hash, or an effect that isn't on the list", () => {
    expect(buildItem({ ...blaster, sounds: { fire: { url: "http://items.example/a.ogg", sha256: H("c") } }, now: 1 })).toBeNull();
    expect(buildItem({ ...blaster, effects: [{ of: "dart", state: "health", take: 50 }], now: 1 })).toBeNull();
    expect(buildItem({ ...blaster, sends: [{ ...blaster.sends[0]!, lands: "../x" }], now: 1 })).toBeNull();
    // A trail longer than any may be, and a colour that isn't written as one.
    expect(buildItem({ ...blaster, sends: [{ ...blaster.sends[0]!, trail: 30 }], now: 1 })).toBeNull();
    expect(buildItem({ ...blaster, tints: [{ slot: "accent", label: "Accent", color: "orange" }], now: 1 })).toBeNull();
    // A sight that isn't on the item, and a zoom that widens the view or shuts it.
    expect(buildItem({ ...blaster, aim: { at: [0, 40, 0], zoom: 0.6 }, now: 1 })).toBeNull();
    expect(buildItem({ ...blaster, aim: { at: [0, 0.2, 0], zoom: 1.5 }, now: 1 })).toBeNull();
    expect(buildItem({ ...blaster, aim: { at: [0, 0.2, 0], zoom: 0 }, now: 1 })).toBeNull();
  });

  it("is read without what a reader doesn't understand: an effect on anything but health asks nothing", () => {
    const signed = finalizeEvent(buildItem({ ...blaster, now: 1_800_000_000 })!, TEST_KEY_1);
    const odd = { ...signed, tags: [...signed.tags, ["effect", "dart", "wallet", "-5"], ["effect", "dart", "health", "5"], ["sound", "BAD NAME", "https://x.example/a.ogg", H("c")], ["does", "third", "Explode"]] };
    const item = parseItem(odd)!;
    expect(item.effects).toEqual(blaster.effects);
    expect(Object.keys(item.sounds)).toEqual(["fire", "impact"]);
    expect(item.does).toEqual(blaster.does);
  });
});
