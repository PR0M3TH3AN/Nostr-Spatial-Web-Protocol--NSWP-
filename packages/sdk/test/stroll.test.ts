import { describe, expect, it } from "vitest";
import { createStepPace, createStroll, dotsBetween, DOUBLE_TAP, FACE_RATE, PATH_MOST, reachOf, RUN, TAP_REACH, TOP_SPEED, WALK_SPEED } from "../src/stroll.js";
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

describe("a path, tapped out while walking", () => {
  /** A walker whose clock the test holds, so two taps are as far apart as it says. */
  const timed = () => {
    const at: [number, number] = [0, 0];
    let ms = 0;
    const stroll = createStroll({ where: () => [at[0], at[1]], canStand: (x) => x < 50, move: (dx, dz) => ((at[0] += dx), (at[1] += dz)), now: () => ms });
    return { at, stroll, wait: (by: number) => (ms += by), walk: (seconds: number) => { for (let i = 0; i < seconds * 60; i++) stroll.update(1 / 60); } };
  };
  it("starts from their feet when they are standing, and no further than a press reaches", () => {
    const { stroll } = timed();
    stroll.tap(0, -20);
    expect(stroll.path).toEqual([[0, -TAP_REACH]]);
    expect(stroll.target).toEqual([0, -TAP_REACH]);
  });
  it("goes on from where it ended, not from their feet, for each tap after", () => {
    const { at, stroll, wait, walk } = timed();
    stroll.tap(0, -4);
    wait(1000);
    walk(0.5);
    expect(at[1]).toBeLessThan(-1);
    stroll.tap(4, -4);
    wait(1000);
    stroll.tap(4, -30);
    // Three stretches: the first tap, then each from the end of the one before, each as far as a press reaches.
    expect(stroll.path).toEqual([[0, -4], [4, -4], [4, -4 - TAP_REACH]]);
    expect(stroll.target).toEqual([4, -4 - TAP_REACH]);
  });
  it("is walked in order, at a walk, to its end", () => {
    const { at, stroll, wait, walk } = timed();
    stroll.tap(0, -3);
    wait(1000);
    stroll.tap(3, -3);
    walk(1.2);
    // Still on the first stretch after 1.2 s at 2.4 m/s: they haven't cut the corner.
    expect(at[0]).toBeCloseTo(0, 5);
    expect(stroll.path.length).toBe(2);
    walk(0.3);
    expect(stroll.path).toEqual([[3, -3]]);
    walk(2);
    expect(stroll.going).toBe(false);
    expect(at[0]).toBeCloseTo(3, 1);
    expect(at[1]).toBeCloseTo(-3, 1);
  });
  it("is covered no faster than a walk, however many stretches it has", () => {
    const { at, stroll, wait, walk } = timed();
    stroll.tap(0, -6);
    for (let i = 0; i < 5; i++) {
      wait(1000);
      stroll.tap(i % 2 ? 0 : 6, -6 * (i + 2));
    }
    const before: [number, number] = [at[0], at[1]];
    let far = 0;
    for (let i = 0; i < 120; i++) {
      const was: [number, number] = [at[0], at[1]];
      stroll.update(1 / 60);
      far += Math.hypot(at[0] - was[0], at[1] - was[1]);
    }
    expect(far).toBeLessThanOrEqual(WALK_SPEED * 2 + 0.01);
    expect(before).toEqual([0, 0]);
  });
  it("takes two taps close together as a run straight there, with the rest forgotten", () => {
    const { stroll, wait } = timed();
    stroll.tap(0, -4);
    wait(1000);
    stroll.tap(4, -4);
    wait(1000);
    stroll.tap(-3, 0);
    wait(DOUBLE_TAP - 50);
    stroll.tap(-3, 0);
    expect(stroll.path).toEqual([[-3, 0]]);
    expect(stroll.running).toBe(true);
  });
  it("ends whole at a wall: nothing of it is walked after", () => {
    const at: [number, number] = [0, 0];
    let blocked = 0;
    let ms = 0;
    const stroll = createStroll({ where: () => [at[0], at[1]], canStand: (_x, z) => z > -2, move: (dx, dz) => ((at[0] += dx), (at[1] += dz)), now: () => ms, onBlocked: () => blocked++ });
    stroll.tap(0, -4);
    ms += 1000;
    stroll.tap(4, -4);
    for (let i = 0; i < 240; i++) stroll.update(1 / 60);
    expect(blocked).toBe(1);
    expect(stroll.going).toBe(false);
    expect(stroll.path).toEqual([]);
    expect(at[0]).toBeCloseTo(0, 5);
  });
  it("holds no more stretches than it may, and adds none for a tap on its own end", () => {
    const { stroll, wait } = timed();
    stroll.tap(0, -3);
    for (let i = 0; i < PATH_MOST + 6; i++) {
      wait(1000);
      stroll.tap(i % 2 ? 0 : 3, -3 * (i + 2));
    }
    expect(stroll.path.length).toBe(PATH_MOST);
    const end = stroll.target!;
    wait(1000);
    stroll.tap(end[0] + 0.1, end[1]);
    expect(stroll.path.length).toBe(PATH_MOST);
  });
  it("says where a press would lead: from their feet standing, from the path's end walking", () => {
    const { stroll } = timed();
    expect(stroll.reach(0, -30)).toEqual([0, -TAP_REACH]);
    stroll.tap(0, -4);
    expect(stroll.reach(0, -30)).toEqual([0, -4 - TAP_REACH]);
    expect(stroll.reach(2, -4)).toEqual([2, -4]);
  });
  it("is forgotten by a walk the page starts itself, and by stopping", () => {
    const { stroll, wait } = timed();
    stroll.tap(0, -4);
    wait(1000);
    stroll.tap(4, -4);
    wait(1000);
    stroll.to(1, 1);
    expect(stroll.path).toEqual([[1, 1]]);
    stroll.stop();
    expect(stroll.path).toEqual([]);
    expect(stroll.heading).toBeNull();
  });
});

describe("facing the way they walk", () => {
  const walker2 = () => {
    const at: [number, number] = [0, 0];
    let ms = 0;
    const stroll = createStroll({ where: () => [at[0], at[1]], canStand: () => true, move: (dx, dz) => ((at[0] += dx), (at[1] += dz)), now: () => ms });
    return { at, stroll, wait: (by: number) => (ms += by) };
  };
  it("is no turn at all while they stand", () => {
    const { stroll } = walker2();
    expect(stroll.heading).toBeNull();
    expect(stroll.face(1.2, 1 / 60)).toBe(1.2);
  });
  it("looks along the stretch being walked: straight ahead is no turn, to the left is a quarter turn", () => {
    const { stroll } = walker2();
    stroll.tap(0, -4);
    expect(stroll.heading).toBeCloseTo(0, 6);
    stroll.stop();
    stroll.tap(-4, 0);
    expect(stroll.heading).toBeCloseTo(Math.PI / 2, 6);
    stroll.stop();
    stroll.tap(4, 0);
    expect(stroll.heading).toBeCloseTo(-Math.PI / 2, 6);
  });
  it("turns the view there at an easy rate, the short way round, and settles on it", () => {
    const { stroll } = walker2();
    stroll.tap(-4, 0.001);
    let yaw = -Math.PI * 0.9; // nearly facing the other way: the short way is through the back
    let most = 0;
    for (let i = 0; i < 240; i++) {
      const next = stroll.face(yaw, 1 / 60);
      most = Math.max(most, Math.abs(next - yaw));
      yaw = next;
    }
    expect(most).toBeLessThanOrEqual(FACE_RATE / 60 + 1e-9);
    // Settled on the heading, give or take whole turns.
    const off = Math.abs((((yaw - stroll.heading!) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    expect(off).toBeLessThan(0.01);
    // And it went the short way: down past -pi, not up through zero.
    expect(yaw).toBeLessThan(-Math.PI * 0.9);
  });
  it("turns to each stretch as it is reached, and keeps its last heading as they arrive", () => {
    const { at, stroll, wait } = walker2();
    stroll.tap(0, -2);
    wait(1000);
    stroll.tap(-2, -2);
    for (let i = 0; i < 40; i++) stroll.update(1 / 60);
    expect(stroll.heading).toBeCloseTo(0, 3);
    for (let i = 0; i < 40; i++) stroll.update(1 / 60);
    expect(at[1]).toBeCloseTo(-2, 1);
    expect(stroll.heading).toBeCloseTo(Math.PI / 2, 2);
  });
});
