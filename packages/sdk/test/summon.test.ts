import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Locomotion, DEFAULT_COMFORT, NO_PAD, type HeldPad } from "../src/actions.js";
import { createHeldButton, createHoldWatch, SUMMON_HOLD, SUMMON_KEY, SUMMON_SLOP } from "../src/ui/summon.js";

describe("the summons on a touch screen", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const two = (dx = 0, dy = 0) => [
    { x: 100, y: 200 },
    { x: 220 + dx, y: 210 + dy },
  ];

  it("is two fingers held still for a moment", () => {
    let held = 0;
    const w = createHoldWatch({ onHeld: () => held++ });
    w.touches(two());
    vi.advanceTimersByTime(SUMMON_HOLD - 20);
    expect(held).toBe(0);
    w.touches(two(3, -2)); // a finger is never perfectly still
    vi.advanceTimersByTime(40);
    expect(held).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(held).toBe(1);
  });

  it("is not a pinch, a drag, one finger, three fingers, or a tap", () => {
    let held = 0;
    const w = createHoldWatch({ onHeld: () => held++ });
    // A pinch or a two-finger drag: a finger moves.
    w.touches(two());
    w.touches(two(SUMMON_SLOP + 5, 0));
    vi.advanceTimersByTime(SUMMON_HOLD * 2);
    // One finger, however long.
    w.touches([{ x: 1, y: 1 }]);
    vi.advanceTimersByTime(SUMMON_HOLD * 2);
    // A third finger comes down.
    w.touches(two());
    w.touches([...two(), { x: 300, y: 300 }]);
    vi.advanceTimersByTime(SUMMON_HOLD * 2);
    // Two fingers tapped and lifted.
    w.touches(two());
    vi.advanceTimersByTime(100);
    w.touches([]);
    vi.advanceTimersByTime(SUMMON_HOLD * 2);
    expect(held).toBe(0);
  });
});

describe("the summons in a headset", () => {
  it("is the menu button held, once for each hold", () => {
    const held = createHeldButton();
    let fired = 0;
    for (let t = 0; t < 1.5; t += 1 / 72) if (held(true, 1 / 72)) fired++;
    expect(fired).toBe(1);
    expect(held(false, 1 / 72)).toBe(false);
    for (let t = 0; t < 0.3; t += 1 / 72) if (held(true, 1 / 72)) fired++;
    expect(fired).toBe(1); // a press, not a hold
  });

  it("reaches a world as its own word, apart from a press of the same button", () => {
    const l = new Locomotion();
    const pads = (secondary: boolean): HeldPad[] => [{ index: 0, hand: "right", pad: { ...NO_PAD, from: "thumbstick", secondary } }];
    const first = l.frame(0.1, pads(true), DEFAULT_COMFORT);
    expect(first).toMatchObject({ menu: true, summon: false });
    let summoned = 0;
    for (let i = 0; i < 10; i++) if (l.frame(0.1, pads(true), DEFAULT_COMFORT).summon) summoned++;
    expect(summoned).toBe(1);
    expect(l.frame(0.1, pads(false), DEFAULT_COMFORT).summon).toBe(false);
  });
});

describe("the summons at a desk", () => {
  it("is a key by where it is, so it is the same key on every keyboard", () => {
    expect(SUMMON_KEY).toBe("Backquote");
  });
});
