import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PINS_MOST } from "@nswp/core";
import { arriveWith, currentSettings, resetSettings } from "../src/settings.js";
import { createControls } from "../src/ui/model.js";

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

/** Controls with something in three tabs, and one key on the bar. */
const some = () => {
  const controls = createControls({ title: "A world" });
  controls.add({ id: "home", section: "travel", label: "Go home", hotbar: true, act: () => {} });
  controls.add({ id: "who", section: "people", label: "Who is here", act: () => {} });
  controls.add({ id: "loud", section: "sound", label: "Louder", act: () => {} });
  return controls;
};

describe("a tab of the menu, kept on the bar", () => {
  it("is nobody's until they pin it: a bar starts with the place's own keys and nothing else", () => {
    const view = some().view();
    expect(view.pins).toEqual([]);
    expect(view.pinsFull).toBe(false);
    expect(view.sections.every((s) => !s.pinned)).toBe(true);
    // And nothing is said of it to the next world: they have made no choice.
    expect(currentSettings().pins).toBeUndefined();
  });
  it("goes after the bar's own keys, with the tab's own name and the next number", () => {
    const controls = some();
    expect(controls.setPinned("people", true)).toBe(true);
    expect(controls.setPinned("sound", true)).toBe(true);
    const view = controls.view();
    expect(view.pins.map((p) => [p.id, p.label, p.key])).toEqual([["people", "People", "2"], ["sound", "Sound", "3"]]);
    expect(view.sections.find((s) => s.id === "people")?.pinned).toBe(true);
    expect(view.sections.find((s) => s.id === "travel")?.pinned).toBe(false);
    // The place's own key keeps its number.
    expect(view.hotbar.map((k) => k.key)).toEqual(["1"]);
  });
  it("comes off again, and taking the last one off is still a choice that travels", () => {
    const controls = some();
    controls.setPinned("people", true);
    expect(currentSettings().pins).toEqual(["people"]);
    controls.setPinned("people", false);
    expect(controls.view().pins).toEqual([]);
    expect(currentSettings().pins).toEqual([]);
  });
  it("holds no more than it may, and takes no name that couldn't travel", () => {
    const controls = some();
    for (const id of ["travel", "people", "sound", "you"]) expect(controls.setPinned(id, true)).toBe(true);
    expect(controls.pins.length).toBe(PINS_MOST);
    expect(controls.view().pinsFull).toBe(true);
    expect(controls.setPinned("camera", true)).toBe(false);
    controls.setPinned("you", false);
    expect(controls.setPinned("Not A Name", true)).toBe(false);
    expect(controls.pins).toEqual(["travel", "people", "sound"]);
  });
  it("is remembered by this site, and goes on to the next world", () => {
    const controls = some();
    controls.setPinned("sound", true);
    resetSettings();
    const again = some();
    expect(again.pins).toEqual(["sound"]);
    expect(currentSettings().pins).toEqual(["sound"]);
  });
  it("arrives with them, in place of what this site remembered", () => {
    some().setPinned("sound", true);
    resetSettings();
    arriveWith({ pins: ["people"] });
    const here = some();
    expect(here.pins).toEqual(["people"]);
    expect(here.view().pins.map((p) => p.id)).toEqual(["people"]);
  });
  it("is kept, and not shown, where a place has no such tab: it is back in the next place that has", () => {
    arriveWith({ pins: ["doors", "people"] });
    const here = some();
    // This place has no Doors tab.
    expect(here.view().pins.map((p) => p.id)).toEqual(["people"]);
    expect(here.pins).toEqual(["doors", "people"]);
    expect(currentSettings().pins).toEqual(["doors", "people"]);
  });
});

describe("a tab whose id a client's menu won't take", () => {
  it("is said once, in the console, to whoever is making the world, and a good id or the kit's own questions never are", () => {
    const warned: string[] = [];
    const real = console.warn;
    console.warn = (...a: unknown[]) => void warned.push(a.map(String).join(" "));
    try {
      const controls = createControls({ title: "A world" });
      controls.addSection({ id: "trial-own-early", label: "Own early" });
      controls.addSection({ id: "trial-own-early", label: "Own early, again" });
      controls.addSection({ id: "Shop", label: "Shop" });
      controls.addSection({ id: "shop", label: "Shop" });
      controls.addSection({ id: "lantern-run", label: "Lantern run" });
      controls.addSection({ id: "how-you-move-desk", label: "How you move" });
      controls.addSection({ id: "how-you-move", label: "How you move" });
      controls.addSection({ id: "bag", label: "Bag" });
      expect(warned.length).toBe(2);
      expect(warned[0]).toContain('"trial-own-early"');
      expect(warned[0]).toContain("will not be in a client's");
      expect(warned[0]).toContain("twelve at most");
      expect(warned[1]).toContain('"Shop"');
      // The tab is still in the world's own menu: only a client leaves it out.
      controls.add({ id: "early-row", section: "trial-own-early", label: "A row", act: () => {} });
      expect(controls.view().sections.find((s) => s.id === "trial-own-early")?.items.map((i) => i.id)).toEqual(["early-row"]);
    } finally {
      console.warn = real;
    }
  });
});

describe("the kit's own question tabs", () => {
  it("are kept inside the kit: in none of the package's entries", async () => {
    const pkg = (await import("../package.json", { with: { type: "json" } })).default as { exports: Record<string, string | { import?: string; default?: string }> };
    const entries = Object.values(pkg.exports).map((e) => (typeof e === "string" ? e : (e.import ?? e.default ?? "")));
    expect(entries.length).toBeGreaterThan(5);
    for (const entry of entries) {
      const mod = (await import(`../${entry.replace(/^\.\//, "")}`)) as Record<string, unknown>;
      expect(Object.keys(mod), entry).not.toContain("KIT_QUESTION_TABS");
    }
  });
});
