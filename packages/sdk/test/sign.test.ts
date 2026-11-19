import { describe, expect, it } from "vitest";
import { viewScale } from "../src/sign.js";

describe("a sign that holds its size in a visitor's view", () => {
  it("is its own size at the distance it was made for, and in proportion elsewhere", () => {
    expect(viewScale(6, { at: 6 })).toBe(1);
    expect(viewScale(3, { at: 6 })).toBe(0.5);
    expect(viewScale(7.5, { at: 6 })).toBe(1.25);
    // The same size in the view: its width over its distance doesn't change.
    for (const d of [1.5, 2, 4, 6, 8]) expect((2.6 * viewScale(d, { at: 6 })) / d).toBeCloseTo(2.6 / 6);
  });

  it("stops shrinking and stops growing at its limits", () => {
    expect(viewScale(0.1, { at: 6 })).toBe(0.15);
    expect(viewScale(0.1, { at: 6, least: 0.3 })).toBe(0.3);
    expect(viewScale(100, { at: 6 })).toBe(1.5);
    expect(viewScale(100, { at: 6, most: 1.1 })).toBe(1.1);
  });

  it("leaves a sign alone when it is given nonsense", () => {
    expect(viewScale(Number.NaN, { at: 6 })).toBe(1);
    expect(viewScale(-1, { at: 6 })).toBe(1);
    expect(viewScale(3, { at: 0 })).toBe(1);
  });
});
