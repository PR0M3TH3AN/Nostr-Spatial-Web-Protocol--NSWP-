import { describe, expect, it } from "vitest";
import { createStroll, reachOf, TAP_REACH, WALK_SPEED } from "../src/stroll.js";

const walker = (canStand: (x: number, z: number) => boolean = () => true) => {
  const at: [number, number] = [0, 0];
  const stroll = createStroll({ where: () => [at[0], at[1]], canStand, move: (dx, dz) => ((at[0] += dx), (at[1] += dz)) });
  return { at, stroll };
};

describe("a tap on a flat screen", () => {
  it("reaches no further than a few steps", () => {
    expect(reachOf(0, 0, 1, 0)).toEqual([1, 0]);
    const [x, z] = reachOf(0, 0, 30, 40);
    expect(Math.hypot(x, z)).toBeCloseTo(TAP_REACH);
    expect(x / z).toBeCloseTo(30 / 40);
    expect(reachOf(2, 2, 2, 2)).toEqual([2, 2]);
  });

  it("is a walk at the keys' pace, not a jump", () => {
    const { at, stroll } = walker();
    stroll.to(3, 0);
    stroll.update(1 / 60);
    expect(at[0]).toBeCloseTo(WALK_SPEED / 60);
    expect(stroll.going).toBe(true);
    for (let i = 0; i < 59; i++) stroll.update(1 / 60);
    expect(at[0]).toBeCloseTo(WALK_SPEED, 1); // a second in, a second's walk along
    for (let i = 0; i < 60; i++) stroll.update(1 / 60);
    expect(at[0]).toBeCloseTo(3, 1);
    expect(stroll.going).toBe(false);
  });

  it("doesn't leap after a long frame, stops at a wall, and can be redirected or stopped", () => {
    const a = walker();
    a.stroll.to(3, 0);
    a.stroll.update(5); // a tab that was away
    expect(a.at[0]).toBeLessThan(0.3);

    const b = walker((x) => x < 1);
    b.stroll.to(3, 0);
    for (let i = 0; i < 200; i++) b.stroll.update(1 / 60);
    expect(b.at[0]).toBeLessThan(1);
    expect(b.stroll.going).toBe(false);

    const c = walker();
    c.stroll.to(3, 0);
    c.stroll.update(0.1);
    c.stroll.to(0, -3);
    for (let i = 0; i < 200; i++) c.stroll.update(1 / 60);
    expect(c.at[1]).toBeCloseTo(-3, 1);
    c.stroll.to(9, 9);
    c.stroll.stop();
    c.stroll.update(0.1);
    expect(c.at[1]).toBeCloseTo(-3, 1);
    c.stroll.to(Number.NaN, 0);
    expect(c.stroll.going).toBe(false);
  });
});
