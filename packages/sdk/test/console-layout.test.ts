import { describe, expect, it } from "vitest";
import { pageLines, TAB_MIN, tabLayout } from "../src/console.js";

const H = 640;

describe("the headset console's sections, down the left", () => {
  it("are one column while each tab has room, and two once there are too many for that", () => {
    expect(tabLayout(6).cols).toBe(1);
    expect(tabLayout(9).cols).toBe(1);
    expect(tabLayout(10).cols).toBe(2);
    // The room's eighteen, and one more: each tab is still big enough to aim at, and every one is on the console.
    const many = tabLayout(19);
    expect(many.cols).toBe(2);
    expect(many.rows * many.cols).toBeGreaterThanOrEqual(19);
    expect(many.tabH).toBeGreaterThanOrEqual(44);
  });

  it("never touch each other, or run past the bottom, however many there are", () => {
    for (let n = 1; n <= 24; n++) {
      const t = tabLayout(n);
      const iconSize = Math.min(36, t.tabH - 18);
      // The icon sits inside its own tab, with room above and below it.
      expect(iconSize, `${n}`).toBeLessThanOrEqual(t.tabH - 18);
      if (t.cols === 1) expect(t.tabH, `${n}`).toBeGreaterThanOrEqual(TAB_MIN);
      expect(134 + t.rows * t.tabH, `${n}`).toBeLessThanOrEqual(H - 16 + 1);
      // The open section's buttons start right of the last column of tabs.
      expect(t.left, `${n}`).toBeGreaterThanOrEqual(24 + t.cols * t.colW + (t.cols - 1) * 8);
    }
  });
});

describe("the lines of a section, a page at a time", () => {
  it("keep every line, once, in order", () => {
    const pages = pageLines([30, 30, 56, 30, 30, 30, 56, 30, 30, 30, 30, 30, 30], 130);
    expect(pages.flat()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("put on a page only what fits it, so nothing is drawn over what is under it", () => {
    const heights = [30, 30, 56, 30, 30, 30, 56, 30, 30, 30, 30, 30, 30];
    for (const page of pageLines(heights, 130)) expect(page.reduce((a, i) => a + heights[i]!, 0)).toBeLessThanOrEqual(130);
  });

  it("are one page when they all fit, and never an empty page", () => {
    expect(pageLines([30, 30], 200)).toEqual([[0, 1]]);
    expect(pageLines([], 200)).toEqual([]);
    // A line taller than the room still has a page of its own, rather than being lost or made smaller.
    expect(pageLines([300, 30], 100)).toEqual([[0], [1]]);
  });
});
