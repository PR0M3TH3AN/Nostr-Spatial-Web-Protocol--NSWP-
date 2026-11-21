import { describe, expect, it } from "vitest";
import { buildWorldEvent, OFFERS, parseWorldEvent, worldOffers, type WorldInput } from "@nswp/core";
import { addDoorControls, vouchedWords, type MenuDoor } from "../src/door-controls.js";
import { createControls } from "../src/ui/model.js";

const offersOf = (more: Partial<WorldInput>) => {
  const parsed = parseWorldEvent(buildWorldEvent({ d: "w", title: "W", url: "https://w.example/", previews: [{ url: "https://w.example/p.webp", type: "pano", sha256: "a".repeat(64) }], ...more }));
  if (!parsed.ok) throw new Error("bad world");
  return worldOffers(parsed.value);
};
const grove: MenuDoor = { id: "grove", title: "The Grove", url: "https://grove.example/", vouched: "verified", offers: offersOf({ modes: ["immersive-vr"], capabilities: ["rooms", "saves"], items: "allowed" }) };
const listed: MenuDoor = { id: "listed", title: "A sample", url: "https://sample.example/vr.html", vouched: "listed", listedBy: "BitPortal's starter set", offers: null };
const setUp = (more: Partial<Parameters<typeof addDoorControls>[1]> = {}) => {
  const controls = createControls({ title: "A world" });
  const taken: string[] = [];
  const doors = addDoorControls(controls, { doors: () => [grove, listed], travel: (d) => taken.push(d.id), ...more });
  const travel = () => controls.view().sections.find((s) => s.id === "travel")!;
  return { controls, doors, taken, travel };
};

describe("a door's details in the menu", () => {
  it("lists every door; choosing one shows its details and takes nobody anywhere", () => {
    const { controls, taken, travel } = setUp();
    expect(travel().items.map((i) => i.label)).toEqual(["The Grove", "A sample"]);
    expect(travel().card).toBeNull();
    controls.run(travel().items[0]!.id);
    return Promise.resolve().then(() => {
      expect(taken).toEqual([]);
      const s = travel();
      expect(s.card).toMatchObject({ title: "The Grove", tag: "Verified for this site", proven: true, sub: "https://grove.example/" });
      expect(s.items.filter((i) => i.kind !== "line").map((i) => i.label)).toEqual(["Travel here", "Back to every door"]);
    });
  });

  it('"Travel here" is the page\'s own way through the door, called once with that door, and nothing else', async () => {
    const { controls, doors, taken } = setUp();
    doors.choose("grove");
    controls.run("door-travel");
    await Promise.resolve();
    await Promise.resolve();
    expect(taken).toEqual(["grove"]);
  });

  it("what it offers is the same list in the same words as the tiles beside it, as lines to read", () => {
    const { doors, travel } = setUp();
    doors.choose("grove");
    const lines = travel().items.filter((i) => i.kind === "line");
    expect(lines.map((l) => l.id)).toEqual(OFFERS.map((id) => `door-offer:${id}`));
    expect(lines.map((l) => l.label)).toEqual(grove.offers!.map((o) => o.words));
    expect(lines.map((l) => l.on)).toEqual(grove.offers!.map((o) => o.on));
    for (const l of lines) expect(l.icon, l.id).toBeTruthy();
  });

  it("a line is never pressed, by any way there is, and never goes on the hotbar", async () => {
    const { controls, doors, travel } = setUp();
    let ran = 0;
    controls.add({ id: "trap", section: "travel", kind: "line", hotbar: true, label: "Read me.", on: () => true, act: () => void ran++ });
    doors.choose("grove");
    expect(controls.run("trap")).toBe(false);
    expect(controls.run("door-offer:saves")).toBe(false);
    await Promise.resolve();
    expect(ran).toBe(0);
    expect(controls.view().hotbar.map((i) => i.id)).not.toContain("trap");
    expect(travel().items.find((i) => i.id === "trap")?.kind).toBe("line");
  });

  it("a place whose maker said nothing for themselves has no lines, and says why", () => {
    const { doors, travel } = setUp();
    doors.choose("listed");
    expect(travel().card).toMatchObject({ tag: "Listed by BitPortal's starter set, not verified", proven: false });
    expect(travel().card!.text).toMatch(/hasn't said anything about it themselves/);
    expect(travel().items.some((i) => i.kind === "line")).toBe(false);
  });

  it("what else the page offers for a door comes after Travel here; Back returns to the list", async () => {
    const { controls, doors, travel } = setUp({ also: (d) => [{ id: "save", label: `Save ${d.title}`, act: () => {} }] });
    doors.choose("grove");
    expect(travel().items.filter((i) => i.kind !== "line").map((i) => i.label)).toEqual(["Travel here", "Save The Grove", "Back to every door"]);
    controls.run("door-back");
    await Promise.resolve();
    await Promise.resolve();
    expect(travel().card).toBeNull();
    expect(doors.chosen()).toBeNull();
    expect(travel().items.map((i) => i.label)).toEqual(["The Grove", "A sample"]);
  });

  it("a door that is no longer listed shows the list again", () => {
    let list: MenuDoor[] = [grove];
    const controls = createControls({ title: "A world" });
    const doors = addDoorControls(controls, { doors: () => list, travel: () => {} });
    doors.choose("grove");
    list = [];
    doors.refresh();
    expect(doors.chosen()).toBeNull();
  });

  it("says what is known of a door's site in the Airlock's own words, and nothing where nobody looked", () => {
    expect(vouchedWords({ vouched: "verified" })).toBe("Verified for this site");
    expect(vouchedWords({ vouched: "listed", listedBy: "Ann" })).toBe("Listed by Ann, not verified");
    expect(vouchedWords({ vouched: "listed" })).toBe("Listed, not verified");
    expect(vouchedWords({ vouched: "unknown" })).toBe("");
  });

  it("keeps the section's own name and icon", () => {
    const { travel } = setUp();
    expect(travel()).toMatchObject({ label: "Travel", icon: "door" });
  });
});
