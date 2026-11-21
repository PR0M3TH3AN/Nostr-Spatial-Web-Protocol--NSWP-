import { describe, expect, it } from "vitest";
import { buildWorldEvent, CAPABILITIES, DOOR_OFFERS, MORE_OFFERS, OFFERS, parseWorldEvent, worldOffers, type World, type WorldInput } from "../src/index.js";

const base: WorldInput = { d: "w", title: "W", url: "https://w.example/", previews: [{ url: "https://w.example/p.webp", type: "pano", sha256: "a".repeat(64) }] };
const read = (more: Partial<WorldInput>): World => {
  const parsed = parseWorldEvent(buildWorldEvent({ ...base, ...more }));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
};
const on = (world: World) => worldOffers(world).filter((o) => o.on).map((o) => o.id);
const words = (world: World, id: string) => worldOffers(world).find((o) => o.id === id)!.words;

describe("what a world offers, from its announcement", () => {
  it("is twelve things in a set order: seven for a door, then the rest", () => {
    expect([...DOOR_OFFERS]).toEqual(["headset", "people", "voice", "items", "saves", "records", "paid"]);
    expect([...OFFERS]).toEqual([...DOOR_OFFERS, ...MORE_OFFERS]);
    const all = worldOffers(read({}));
    expect(all.map((o) => o.id)).toEqual([...OFFERS]);
    expect(all.filter((o) => o.onDoor).map((o) => o.id)).toEqual([...DOOR_OFFERS]);
  });

  it("a world that says nothing offers nothing, and every line says it doesn't say", () => {
    const quiet = read({});
    expect(on(quiet)).toEqual([]);
    for (const o of worldOffers(quiet)) expect(o.words, o.id).toMatch(/^It doesn't say /);
  });

  it("nothing is on by a default: a world with no items tag allows items, and its door doesn't say so", () => {
    const quiet = read({ capabilities: ["webxr", "spatial-portals", "rooms"] });
    expect(quiet.items).toBeUndefined();
    expect(on(quiet)).toEqual(["people", "doors"]);
    expect(words(quiet, "items")).toBe("It doesn't say whether the things you carry work here.");
  });

  it("nothing is on by a guess from something else it said", () => {
    // Says it can show a headset session, and names no headset mode. Says it takes payments, and names nothing sold.
    expect(on(read({ capabilities: ["webxr", "payments"], modes: ["inline-3d"] }))).toEqual([]);
    // Rooms are people, not talking.
    expect(on(read({ capabilities: ["rooms"] }))).toEqual(["people"]);
  });

  it("a world that says everything has every line on, with the words for it", () => {
    const full = read({ modes: ["immersive-vr", "inline-3d"], capabilities: [...CAPABILITIES], items: "allowed", access: `30078:${"b".repeat(64)}:ticket` });
    expect(on(full)).toEqual([...OFFERS]);
    for (const o of worldOffers(full)) expect(o.words, o.id).not.toMatch(/doesn't say/);
    expect(words(full, "saves")).toBe("Your progress is kept for you here.");
    expect(words(full, "paid")).toBe("It costs money to go in.");
    expect(words(full, "records")).toBe("It keeps scores, and marks what you achieve.");
  });

  it("items have three words, and only two of them are something offered", () => {
    expect(worldOffers(read({ items: "allowed" })).find((o) => o.id === "items")).toMatchObject({ on: true, words: "The things you carry work here." });
    expect(worldOffers(read({ items: "play" })).find((o) => o.id === "items")).toMatchObject({ on: true, words: "The things you carry are part of the game here." });
    expect(worldOffers(read({ items: "none" })).find((o) => o.id === "items")).toMatchObject({ on: false, words: "The things you carry are put away here." });
  });

  it("scores and achievements are one line, which says which", () => {
    expect(words(read({ capabilities: ["scores"] }), "records")).toBe("It keeps scores.");
    expect(words(read({ capabilities: ["achievements"] }), "records")).toBe("It marks what you achieve.");
    expect(on(read({ capabilities: ["achievements"] }))).toEqual(["records"]);
  });

  it("people are met in a room or a game for several", () => {
    expect(on(read({ capabilities: ["multiplayer"] }))).toEqual(["people"]);
  });

  it("the four new words are on the list, so a world that says them is not warned", () => {
    for (const c of ["saves", "scores", "achievements", "tips"]) expect(CAPABILITIES as readonly string[]).toContain(c);
    const parsed = parseWorldEvent(buildWorldEvent({ ...base, capabilities: ["saves", "scores", "achievements", "tips"] }));
    expect(parsed.ok && parsed.warnings.filter((w) => w.code === "unknown_value")).toEqual([]);
  });

  it("every line has a name and a sentence a person can read", () => {
    for (const world of [read({}), read({ capabilities: [...CAPABILITIES], items: "play", modes: ["immersive-vr"] })])
      for (const o of worldOffers(world)) {
        expect(o.name.length, o.id).toBeGreaterThan(2);
        expect(o.name.length, o.id).toBeLessThanOrEqual(8);
        expect(o.words, o.id).toMatch(/^[A-Z].*\.$/);
        expect(o.words, o.id).not.toMatch(/capabilit|announcement|tag\b/i);
      }
  });
});
