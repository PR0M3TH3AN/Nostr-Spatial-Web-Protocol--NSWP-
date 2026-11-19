import { describe, expect, it } from "vitest";
import { createStepPace, createStroll, dotsBetween, DOUBLE_TAP, reachOf, RUN, TAP_REACH, TOP_SPEED, WALK_SPEED } from "../src/stroll.js";
import { RUN_FACTOR, WALK_SPEED as HEADSET_WALK } from "../src/actions.js";
import { SPRINT } from "../src/fps.js";

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

describe("the dotted line to where a tap leads", () => {
  it("runs from a little way out from the visitor's feet to just short of where they are going", () => {
    const dots = dotsBetween(0, 0, 0, -3);
    expect(dots.length).toBeGreaterThan(5);
    for (const [x, z] of dots) {
      expect(x).toBeCloseTo(0, 9);
      expect(z).toBeLessThanOrEqual(-0.45 + 1e-9);
      expect(z).toBeGreaterThanOrEqual(-2.7 - 1e-9);
    }
    // Evenly spaced.
    const gaps = dots.slice(1).map((d, i) => Math.abs(d[1] - dots[i]![1]));
    for (const g of gaps) expect(g).toBeCloseTo(0.4, 9);
  });

  it("keeps its dots where they are on the floor as the visitor walks along it", () => {
    const before = dotsBetween(0, 0, 0, -3).map(([, z]) => z.toFixed(3));
    const after = dotsBetween(0, -0.8, 0, -3).map(([, z]) => z.toFixed(3));
    for (const z of after) expect(before).toContain(z);
    expect(after.length).toBeLessThan(before.length);
  });

  it("is nothing when they are nearly there, and never more than it is told", () => {
    expect(dotsBetween(0, 0, 0, -0.5)).toEqual([]);
    expect(dotsBetween(1, 1, 1, 1)).toEqual([]);
    expect(dotsBetween(0, 0, 0, Number.NaN)).toEqual([]);
    expect(dotsBetween(0, 0, 0, -500, { most: 12 })).toHaveLength(12);
  });

  it("is told where a tap is taking them", () => {
    const w = walker();
    expect(w.stroll.target).toBeNull();
    w.stroll.to(1, -2);
    expect(w.stroll.target).toEqual([1, -2]);
    w.stroll.stop();
    expect(w.stroll.target).toBeNull();
  });
});

describe("the fastest anyone goes", () => {
  it("is a run, and no way of moving on foot is faster", () => {
    expect(TOP_SPEED).toBeCloseTo(WALK_SPEED * RUN);
    // The keys with Shift, the intense way at a desk, and walking smoothly in a headset with the stick pressed in.
    expect(WALK_SPEED * SPRINT).toBeLessThanOrEqual(TOP_SPEED);
    expect(HEADSET_WALK * RUN_FACTOR).toBeLessThanOrEqual(TOP_SPEED);
  });

  it("holds for a tap however fast the taps come", () => {
    const { at, stroll } = walker();
    // Ten seconds of tapping as far ahead as a tap reaches, four times a second: running the whole way.
    for (let i = 0; i < 600; i++) {
      if (i % 15 === 0) stroll.to(at[0] + TAP_REACH, 0, true);
      stroll.update(1 / 60);
    }
    expect(at[0]).toBeLessThanOrEqual(TOP_SPEED * 10 + 0.01);
  });
});

describe("stepping, as a headset moves", () => {
  it("lands at once and is paid for afterwards: the next step waits as long as running there would have taken", () => {
    let t = 0;
    const pace = createStepPace({ now: () => t });
    expect(pace.ready).toBe(true);
    expect(pace.take(5)).toBe(true);
    expect(pace.ready).toBe(false);
    expect(pace.wait).toBeCloseTo(5 / TOP_SPEED);
    // Pressing again and again does nothing, and costs nothing.
    for (t = 100; t < 1100; t += 100) expect(pace.take(5)).toBe(false);
    t = (5 / TOP_SPEED) * 1000;
    expect(pace.ready).toBe(true);
    expect(pace.take(1)).toBe(true);
    expect(pace.wait).toBeCloseTo(1 / TOP_SPEED);
  });

  it("covers ground no faster than a run, however fast the presses come", () => {
    let t = 0;
    let gone = 0;
    const pace = createStepPace({ now: () => t });
    // A minute of pressing twenty times a second for the longest step there is.
    for (t = 0; t <= 60_000; t += 50) if (pace.take(5)) gone += 5;
    // One step's head start, and nothing more.
    expect(gone).toBeLessThanOrEqual(TOP_SPEED * 60 + 5);
    expect(gone).toBeGreaterThan(TOP_SPEED * 60 * 0.9);
  });

  it("is ready again almost at once after a short step, and never held up by nonsense", () => {
    let t = 0;
    const pace = createStepPace({ now: () => t });
    expect(pace.take(0.5)).toBe(true);
    t = 130;
    expect(pace.take(0.5)).toBe(true);
    t = 10_000;
    expect(pace.take(Number.NaN)).toBe(true);
    expect(pace.take(-3)).toBe(true);
    expect(pace.ready).toBe(true);
  });
});
