import { describe, expect, it } from "vitest";
import { createStroll, DOUBLE_TAP, reachOf, RUN, TAP_REACH, WALK_SPEED } from "../src/stroll.js";

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

describe("running to a spot", () => {
  const runner = (clock: { t: number }) => {
    const at: [number, number] = [0, 0];
    const stroll = createStroll({ where: () => [at[0], at[1]], canStand: () => true, move: (dx, dz) => ((at[0] += dx), (at[1] += dz)), now: () => clock.t });
    return { at, stroll };
  };

  it("walks for one tap and runs for two close together", () => {
    const clock = { t: 1000 };
    const one = runner(clock);
    one.stroll.to(0, -3);
    expect(one.stroll.running).toBe(false);
    one.stroll.update(0.1);
    expect(one.at[1]).toBeCloseTo(-WALK_SPEED * 0.1, 6);

    const two = runner(clock);
    two.stroll.to(0, -3);
    clock.t += DOUBLE_TAP - 50;
    two.stroll.to(0, -3);
    expect(two.stroll.running).toBe(true);
    two.stroll.update(0.1);
    expect(two.at[1]).toBeCloseTo(-WALK_SPEED * RUN * 0.1, 6);
  });

  it("is a walk again for two taps far apart", () => {
    const clock = { t: 0 };
    const w = runner(clock);
    w.stroll.to(0, -3);
    for (let i = 0; i < 30; i++) w.stroll.update(0.1);
    clock.t += DOUBLE_TAP + 600;
    w.stroll.to(0, -6);
    expect(w.stroll.running).toBe(false);
  });

  it("keeps running for each tap while they are running, and stops running when they arrive", () => {
    const clock = { t: 0 };
    const w = runner(clock);
    w.stroll.to(0, -3);
    clock.t += 200;
    w.stroll.to(0, -3);
    w.stroll.update(0.1);
    // A while later, still on their way: one more tap, further on.
    clock.t += 5000;
    w.stroll.to(0, -6);
    expect(w.stroll.running).toBe(true);
    for (let i = 0; i < 40; i++) w.stroll.update(0.1);
    expect(w.stroll.going).toBe(false);
    expect(w.stroll.running).toBe(false);
    clock.t += 5000;
    w.stroll.to(0, -9);
    expect(w.stroll.running).toBe(false);
  });

  it("runs when told to, and never past the spot", () => {
    const clock = { t: 0 };
    const w = runner(clock);
    w.stroll.to(0, -1, true);
    expect(w.stroll.running).toBe(true);
    for (let i = 0; i < 20; i++) w.stroll.update(0.1);
    expect(w.at[1]).toBeCloseTo(-1, 2);
  });
});
