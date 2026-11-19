import { describe, expect, it } from "vitest";
import { createControls, type UiCard } from "../src/ui/model.js";
import { CUES, cueRecipe, heardFrom, HEARD } from "../src/sound-store.js";

const alice: UiCard = { title: "Alice", tag: "By name", proven: true, sub: "npub1abc…wxyz", copy: "npub1abcdefwxyz", text: "Keeper of the east wing.", picture: "", color: "#ffcc00", now: [] };

describe("a card at the head of a section", () => {
  it("is in the view when the section has one, and asked for each time", () => {
    const controls = createControls({ title: "A world" });
    let who: UiCard | null = null;
    controls.addSection({ id: "people", label: "People", card: () => who });
    // Nothing in the section at all: it isn't shown.
    expect(controls.view().sections.find((s) => s.id === "people")).toBeUndefined();
    who = alice;
    const people = controls.view().sections.find((s) => s.id === "people");
    expect(people?.card).toEqual(alice);
    who = null;
    expect(controls.view().sections.find((s) => s.id === "people")).toBeUndefined();
  });

  it("is null for a section without one", () => {
    const controls = createControls({ title: "A world" });
    for (const s of controls.view().sections) expect(s.card).toBeNull();
  });

  it("survives a section being described again without it", () => {
    const controls = createControls({ title: "A world" });
    controls.addSection({ id: "people", label: "People", card: () => alice });
    controls.addSection({ id: "people", label: "People", note: "Two people are here." });
    expect(controls.view().sections.find((s) => s.id === "people")?.card).toEqual(alice);
  });
});

describe("the sound of someone writing", () => {
  it("is a cue like the others, and not to be taken for the kit's own notice", () => {
    expect(CUES).toContain("chat");
    const tones = (cue: "chat" | "notice") => cueRecipe(cue).flatMap((p) => (p.kind === "tone" ? [p.from, p.to ?? p.from] : []));
    // Every note of it is at least an octave under every note of the notice.
    expect(Math.max(...tones("chat")) * 2).toBeLessThanOrEqual(Math.min(...tones("notice")));
  });

  it("is as written close by, and quieter and duller the further off", () => {
    const close = heardFrom({ distance: 1 });
    expect(close).toMatchObject({ gain: 1, cutoff: 7000, pan: 0, rate: 1 });
    const steps = [2, 5, 10, 20, 40].map((distance) => heardFrom({ distance }));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.gain).toBeLessThanOrEqual(steps[i - 1]!.gain);
      expect(steps[i]!.cutoff).toBeLessThanOrEqual(steps[i - 1]!.cutoff);
    }
    expect(heardFrom({ distance: 8 }).gain).toBeCloseTo(0.5, 1);
  });

  it("never goes silent, however far off they are", () => {
    for (const distance of [60, 1000, Infinity, NaN]) {
      const far = heardFrom({ distance });
      expect(far.gain).toBeGreaterThanOrEqual(HEARD.floor);
      expect(far.cutoff).toBeGreaterThanOrEqual(1100);
    }
  });

  it("is on the side they are on, and never hard over", () => {
    expect(heardFrom({ distance: 4, pan: -1 }).pan).toBe(-0.8);
    expect(heardFrom({ distance: 4, pan: 0.5 }).pan).toBe(0.4);
    expect(heardFrom({ distance: 4, pan: 9 }).pan).toBe(0.8);
    expect(heardFrom({ distance: 4, pan: NaN }).pan).toBe(0);
  });
});
