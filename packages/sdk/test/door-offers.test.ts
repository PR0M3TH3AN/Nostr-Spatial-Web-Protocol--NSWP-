import { describe, expect, it } from "vitest";
import { CAPABILITIES, DOOR_OFFERS, OFFERS, worldOffers } from "@nswp/core";
import { DOOR_SPACING, PORTAL_HEIGHT, PORTAL_WIDTH } from "../src/gate-size.js";
import { OFFER_ICONS } from "../src/offer-icons.js";
import { ICONS } from "../src/ui/icons.js";
import { offers } from "../src/engine-menu.js";

// The column's own numbers, read without a renderer: door-offers.ts draws on a canvas, which a test has none of.
const TILE = 0.24;
const COLUMN_X = -(PORTAL_WIDTH / 2 + 0.34);

describe("the tiles beside a door", () => {
  it("every line a door shows has a drawing of its own, from the kit's set", () => {
    expect(Object.keys(OFFER_ICONS)).toEqual([...DOOR_OFFERS]);
    const drawings = Object.values(OFFER_ICONS);
    expect(new Set(drawings).size).toBe(drawings.length);
    for (const icon of drawings) expect(ICONS[icon], icon).toMatch(/^M[\d .,a-zA-Z-]+$/);
  });

  it("the column stands clear of the frame, and inside half the least distance between two doors", () => {
    // The frame's moulding is 0.18 m wide outside the opening.
    expect(COLUMN_X + TILE / 2).toBeLessThan(-(PORTAL_WIDTH / 2 + 0.18));
    expect(Math.abs(COLUMN_X) + TILE / 2).toBeLessThan(DOOR_SPACING / 2);
    // Seven tiles, with their gaps, are no taller than the doorway.
    expect(0.32 + 6 * (TILE + 0.03) + TILE / 2).toBeLessThan(PORTAL_HEIGHT + 0.2);
  });
});

describe("what another engine is given for a door's tiles", () => {
  const read = (world: unknown) => JSON.parse(offers(typeof world === "string" ? world : JSON.stringify(world))) as { id: string; on: boolean; name: string; words: string; onDoor: boolean; icon?: string }[];

  it("is the core's own list, word for word, with a drawing for each of the seven", () => {
    const world = { modes: ["immersive-vr"], capabilities: ["rooms", "saves"], items: "play" };
    const given = read(world);
    expect(given.map(({ icon: _icon, ...line }) => line)).toEqual(worldOffers({ modes: world.modes, capabilities: world.capabilities, items: "play" }));
    expect(given.map((o) => o.id)).toEqual([...OFFERS]);
    for (const line of given) expect(typeof line.icon === "string", line.id).toBe(line.onDoor);
    expect(given.find((o) => o.id === "items")).toMatchObject({ on: true, words: "The things you carry are part of the game here." });
  });

  it("a world that says everything lights everything; one that says nothing, or can't be read, lights nothing", () => {
    expect(read({ modes: ["immersive-vr"], capabilities: [...CAPABILITIES], items: "allowed", access: `30078:${"b".repeat(64)}:y`, byInvitation: true }).every((o) => o.on)).toBe(true);
    // "By invitation" is lit only by exactly true: what an engine reads loosely lights nothing.
    const invited = (byInvitation: unknown) => read({ modes: [], capabilities: [], byInvitation }).find((o) => o.id === "by-invitation")!.on;
    expect([invited(true), invited("true"), invited(1), invited(undefined)]).toEqual([true, false, false, false]);
    // "Paid" is lit only by a listing's coordinate, as a list or by itself: anything else names nothing sold.
    const paid = (access: unknown) => read({ modes: ["immersive-vr"], capabilities: [], access }).find((o) => o.id === "paid")!.on;
    expect([paid([`30078:${"b".repeat(64)}:y`]), paid("30078:x:y"), paid([]), paid(true), paid("paid")]).toEqual([true, false, false, false, false]);
    for (const nothing of [{}, { modes: "immersive-vr", capabilities: 7, items: "everything" }, "not json", "null", "[]"]) expect(read(nothing).some((o) => o.on), JSON.stringify(nothing)).toBe(false);
  });
});
