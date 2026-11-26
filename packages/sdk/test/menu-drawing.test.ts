import { describe, expect, it } from "vitest";
import { kindLaid, laySheet, layBar, wrapWords, type Measure } from "../src/menu-drawing.js";
import { createControls, type UiItemView } from "../src/ui/model.js";
import { SHEET_LOOK } from "../src/ui/sheet-look.js";

/**
 * The headset's menu, laid out as the flat menu is (menu-drawing.ts; docs/plans/headset-menu.md). Words are measured
 * here by a stand-in: each letter is 0.55 of its font's size, so the numbers below are worked out by hand from the
 * flat menu's own styles. `trials/headset-menu-same.mjs` holds the layout to the flat menu in a real browser, within
 * 2 px; this holds it to known numbers in the gate, so a change to either is seen.
 */
const measure: Measure = (text, font) => text.length * 0.55 * Number(/ ([\d.]+)px /.exec(font)![1]);

const view = (add: (c: ReturnType<typeof createControls>) => void) => {
  const c = createControls({ title: "A world" });
  add(c);
  return c.view();
};
const act = () => {};

describe("the headset's menu, laid out as the flat one", () => {
  it("draws every kind of row ui/model.ts has, each its way: in a column, across, or in a run", () => {
    const all: Record<UiItemView["kind"], "half" | "full" | "run"> = { button: "half", copy: "half", save: "half", swatch: "run", tile: "run", line: "full", field: "full", file: "full", slider: "full" };
    for (const [kind, laid] of Object.entries(all)) expect(kindLaid({ kind, tone: "normal" } as UiItemView), kind).toBe(laid);
    expect(kindLaid({ kind: "button", tone: "primary" } as UiItemView)).toBe("full");
  });

  it("at a desk: tabs along the top, rows in two columns, a wide press across both", () => {
    const v = view((c) => {
      c.addSection({ id: "s", label: "Sound" });
      c.add({ id: "a", section: "s", label: "One", act }, { id: "b", section: "s", label: "Two", act }, { id: "c", section: "s", label: "Three", act, tone: "primary" }, { id: "d", section: "s", label: "Four", act });
    });
    const L = laySheet(v, "s", { measure, width: 780 });
    // The strip: 1 of edge, 12 of room, then each tab 9 + a 20.15 icon + 8 + its 2 px line under it.
    const tab = L.tabs.find((t) => t.id === "tab:s")!;
    expect(tab.y).toBe(13);
    expect(tab.h).toBeCloseTo(39.15, 2);
    const rows = Object.fromEntries(L.rows.map((b) => [b.id, b]));
    // The list: under the strip, its line, 12 of room; 754 wide inside, two columns of 374 with 6 between.
    expect(rows["act:a"]!.x).toBe(13);
    expect(rows["act:a"]!.y).toBeCloseTo(65.15, 2);
    expect(rows["act:a"]!.w).toBe(374);
    expect(rows["act:b"]!.x).toBe(393);
    expect(rows["act:b"]!.y).toBeCloseTo(rows["act:a"]!.y, 5);
    expect(rows["act:a"]!.h).toBe(46);
    expect(rows["act:c"]).toMatchObject({ x: 13, w: 754 });
    expect(rows["act:c"]!.y).toBeCloseTo(65.15 + 46 + 6, 2);
    // A half row after a wide one starts a row of its own, in the first column.
    expect(rows["act:d"]).toMatchObject({ x: 13 });
    expect(rows["act:d"]!.y).toBeCloseTo(65.15 + 2 * (46 + 6), 2);
    // Close at the foot's right, 38 tall, 12 in from the edge.
    expect(L.close.x + L.close.w).toBe(780 - 1 - 12);
    expect(L.close.h).toBe(SHEET_LOOK.foot.close.height);
  });

  it("on a phone's width, and on the wrist: one column", () => {
    const v = view((c) => c.add({ id: "a", section: "sound", label: "One", act }, { id: "b", section: "sound", label: "Two", act }));
    const L = laySheet(v, "sound", { measure, width: 480 });
    const [a, b] = ["act:a", "act:b"].map((id) => L.rows.find((r) => r.id === id)!);
    expect(a!.w).toBe(480 - 2 - 24);
    expect(b!.x).toBe(a!.x);
    expect(b!.y).toBeCloseTo(a!.y + 46 + 6, 5);
  });

  it("is one size on every tab, the tallest's, so it doesn't jump as tabs change", () => {
    const v = view((c) => {
      for (let i = 0; i < 12; i++) c.add({ id: `r${i}`, section: "sound", label: `Row ${i}`, act });
      c.add({ id: "x", section: "look", label: "Only one", act });
    });
    const heights = v.sections.map((s) => laySheet(v, s.id, { measure, width: 780 }).height);
    expect(new Set(heights).size).toBe(1);
    // Rounded up, as the flat menu's is.
    expect(Number.isInteger(heights[0])).toBe(true);
  });

  it("scrolls a tab that is taller than its room, and says so", () => {
    const v = view((c) => {
      for (let i = 0; i < 40; i++) c.add({ id: `r${i}`, section: "sound", label: `Row ${i}`, act });
    });
    const L = laySheet(v, "sound", { measure, width: 780, most: 420 });
    expect(L.height).toBe(420);
    expect(L.rowsAt!.h).toBeLessThan(L.rowsContent);
  });

  it("slides the strip of tabs along to bring the open one into sight, clear of the arrows", () => {
    const v = view((c) => {
      for (let i = 0; i < 16; i++) c.addSection({ id: `t${i}`, label: `A long tab ${i}` });
      for (let i = 0; i < 16; i++) c.add({ id: `r${i}`, section: `t${i}`, label: "Row", act });
    });
    const last = v.sections.at(-1)!.id;
    const L = laySheet(v, last, { measure, width: 780 });
    const t = L.tabs.find((x) => x.id === `tab:${last}`)!;
    expect(L.more.left).toBe(true);
    expect(t.x - L.tabsScroll + t.w).toBeLessThanOrEqual(780 - 2 + 0.01);
    const first = laySheet(v, v.sections[0]!.id, { measure, width: 780 });
    expect(first.tabsScroll).toBe(0);
    expect(first.more).toEqual({ left: false, right: true });
  });

  it("wraps a row's long words onto more lines, and the row grows for them", () => {
    const long = "A row whose words are far too many to fit on one line of a column at a desk, so they wrap";
    const v = view((c) => c.add({ id: "a", section: "sound", label: long, act }));
    const a = laySheet(v, "sound", { measure, width: 780 }).rows.find((r) => r.id === "act:a")!;
    expect(a.lines!.length).toBeGreaterThan(1);
    expect(a.h).toBeCloseTo(2 + 16 + a.lines!.length * 13 * 1.35, 5);
    expect(wrapWords(measure, "one two", "500 13px x", 1)).toEqual(["one", "two"]);
  });

  it("lays the bar out as the flat one: keys 62 wide, 10 apart, the tabs kept on it after a line", () => {
    const v = view((c) => {
      c.add({ id: "j", label: "Join", act, hotbar: true }, { id: "k", label: "Jump", act, hotbar: true }, { id: "s", section: "sound", label: "Sound on", act });
      c.setPinned("sound", true);
    });
    const B = layBar(v, { measure });
    expect(B.keys.map((k) => k.x)).toEqual([14, 86, 158 + 15]);
    expect(B.keys.at(-1)!.id).toBe("tab:sound");
    expect(B.theirs).not.toBeNull();
  });
});
