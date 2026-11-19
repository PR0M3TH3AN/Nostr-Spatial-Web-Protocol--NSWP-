/** Reading any controller into intent. No headset is involved: it is arithmetic. */
import { describe, expect, it } from "vitest";
import { BACK_STEP, cleanComfort, deadzone, DEFAULT_COMFORT, Locomotion, NO_PAD, readPad, RUN_FACTOR, stickRoles, TURN_SPEED, WALK_SPEED, type Comfort, type HeldPad, type PadState } from "../src/actions.js";

const b = (value = 0) => ({ pressed: value > 0.5, touched: value > 0, value });
/** A controller with a thumbstick, laid out as WebXR says: Quest, Pico, Index, Reverb. */
const touch = (o: { stick?: [number, number]; trigger?: number; squeeze?: number; a?: boolean; b?: boolean } = {}) => ({
  mapping: "xr-standard",
  axes: [0, 0, o.stick?.[0] ?? 0, o.stick?.[1] ?? 0],
  buttons: [b(o.trigger), b(o.squeeze), undefined, b(), b(o.a ? 1 : 0), b(o.b ? 1 : 0)],
});
/** A wand with a touchpad and no stick: the first Vive. */
const wand = (o: { pad?: [number, number]; clicked?: boolean } = {}) => ({ mapping: "xr-standard", axes: [o.pad?.[0] ?? 0, o.pad?.[1] ?? 0], buttons: [b(), b(), b(o.clicked ? 1 : 0)] });

describe("reading a controller", () => {
  it("reads the same facts from any controller with a stick", () => {
    const s = readPad(touch({ stick: [1, -1], trigger: 0.7, squeeze: 1, b: true }));
    expect(s.from).toBe("thumbstick");
    expect(s.stick[0]).toBeGreaterThan(0.5); // right
    expect(s.stick[1]).toBeGreaterThan(0.5); // up on the stick is forward
    expect(s).toMatchObject({ trigger: 0.7, squeeze: 1, primary: false, secondary: true });
  });

  it("treats a stick near its middle as still", () => {
    expect(deadzone(0.1, -0.1)).toEqual([0, 0]);
    expect(deadzone(1, 0)).toEqual([1, 0]);
    expect(deadzone(0.6, 0)[0]).toBeCloseTo(0.5);
    expect(deadzone(NaN, 1)).toEqual([0, 0]);
    expect(Math.hypot(...deadzone(1, 1))).toBeCloseTo(1); // never more than full
  });

  it("uses a touchpad only while it is clicked, so a resting thumb does nothing", () => {
    expect(readPad(wand({ pad: [0.9, 0] })).stick).toEqual([0, 0]);
    const clicked = readPad(wand({ pad: [0.9, 0], clicked: true }));
    expect(clicked.from).toBe("touchpad");
    expect(clicked.stick[0]).toBeGreaterThan(0.5);
  });

  it("makes nothing of a hand, a gaze, or a controller that isn't there", () => {
    expect(readPad(null)).toBe(NO_PAD);
    expect(readPad({ axes: [], buttons: [] })).toMatchObject({ stick: [0, 0], from: "none", trigger: 0, squeeze: 0 });
    expect(readPad({ axes: [0, 0, NaN, 0], buttons: [undefined] }).stick).toEqual([0, 0]);
  });

  it("reads a plain two-axis stick reported the old way", () => {
    expect(readPad({ mapping: "", axes: [0, -1], buttons: [b(), b()] })).toMatchObject({ from: "thumbstick", stick: [0, 1] });
  });
});

const pad = (stick: [number, number], more: Partial<PadState> = {}): PadState => ({ ...NO_PAD, stick, from: "thumbstick", ...more });
const both = (left: [number, number], right: [number, number], more: Partial<PadState> = {}): HeldPad[] => [
  { index: 0, hand: "left", pad: pad(left) },
  { index: 1, hand: "right", pad: pad(right, more) },
];
const steps: Comfort = DEFAULT_COMFORT;
const smooth: Comfort = { ...DEFAULT_COMFORT, move: "smooth", turn: "smooth" };

describe("what each stick is for", () => {
  it("gives two sticks a job each, and one stick both", () => {
    expect([...stickRoles(both([0, 0], [0, 0]), "left")]).toEqual([[0, "move"], [1, "turn"]]);
    expect([...stickRoles(both([0, 0], [0, 0]), "right")]).toEqual([[0, "turn"], [1, "move"]]);
    expect([...stickRoles([{ index: 1, hand: "right", pad: pad([0, 0]) }], "left")]).toEqual([[1, "both"]]);
    expect(stickRoles([{ index: 0, hand: "none", pad: NO_PAD }], "left").size).toBe(0);
  });
});

describe("the comfortable defaults", () => {
  it("are steps and turns at once, with nothing sliding", () => {
    expect(DEFAULT_COMFORT).toMatchObject({ move: "steps", turn: "steps", turnStep: 30, narrow: true });
  });

  it("turns once for a flick, however long the stick is held", () => {
    const l = new Locomotion();
    expect(l.frame(0.016, both([0, 0], [1, 0]), steps).turn).toBe(-30); // right is clockwise
    expect(l.frame(0.016, both([0, 0], [1, 0]), steps).turn).toBe(0);
    expect(l.frame(0.016, both([0, 0], [0.5, 0]), steps).turn).toBe(0); // not let go yet
    expect(l.frame(0.016, both([0, 0], [0, 0]), steps).turn).toBe(0);
    expect(l.frame(0.016, both([0, 0], [-1, 0]), steps).turn).toBe(30);
    expect(l.frame(0.016, both([0, 0], [0, 0]), steps).turn).toBe(0);
    expect(l.frame(0.016, both([0, 0], [1, 0]), { ...steps, turnStep: 45 }).turn).toBe(-45);
  });

  it("does not turn from the moving stick", () => {
    expect(new Locomotion().frame(0.016, both([1, 0], [0, 0]), steps).turn).toBe(0);
  });

  it("steps where you point when a stick pushed forward is let go, from either hand", () => {
    for (const [left, right, slot] of [[[0, 1], [0, 0], 0], [[0, 0], [0, 1], 1]] as [[number, number], [number, number], number][]) {
      const l = new Locomotion();
      const held = l.frame(0.016, both(left, right), steps);
      expect(held).toMatchObject({ aiming: [slot], stepFrom: [], walk: [0, 0], narrow: 0 });
      expect(l.frame(0.016, both([0, 0], [0, 0]), steps)).toMatchObject({ aiming: [], stepFrom: [slot] });
      expect(l.frame(0.016, both([0, 0], [0, 0]), steps).stepFrom).toEqual([]);
    }
  });

  it("takes one step back for a pull back, not a slide", () => {
    const l = new Locomotion();
    expect(l.frame(0.016, both([0, -1], [0, 0]), steps).walk).toEqual([0, -BACK_STEP]);
    expect(l.frame(0.016, both([0, -1], [0, 0]), steps).walk).toEqual([0, 0]);
  });

  it("forgets a held stick when its controller goes away", () => {
    const l = new Locomotion();
    l.frame(0.016, both([0, 1], [0, 0]), steps);
    expect(l.frame(0.016, [{ index: 1, hand: "right", pad: pad([0, 0]) }], steps).stepFrom).toEqual([]);
    expect(l.frame(0.016, both([0, 0], [0, 0]), steps).stepFrom).toEqual([]);
  });
});

describe("smooth movement, for those who ask for it", () => {
  it("walks at a steady pace with the moving stick and narrows the view", () => {
    const i = new Locomotion().frame(0.5, both([1, 1], [0, 0]), smooth);
    expect(i.walk[0]).toBeGreaterThan(0);
    expect(Math.hypot(...i.walk)).toBeCloseTo(WALK_SPEED * 0.5);
    expect(i).toMatchObject({ narrow: 1, stepFrom: [], aiming: [] });
    expect(new Locomotion().frame(0.5, both([0, 1], [0, 0]), { ...smooth, narrow: false }).narrow).toBe(0);
  });

  it("turns at a steady rate with the other", () => {
    const i = new Locomotion().frame(0.5, both([0, 0], [1, 0]), smooth);
    expect(i.turn).toBeCloseTo(-TURN_SPEED * 0.5);
    expect(i.walk).toEqual([0, 0]);
  });

  it("never strafes with a single stick: sideways is for turning", () => {
    const i = new Locomotion().frame(0.5, [{ index: 0, hand: "right", pad: pad([0.7, 0.7]) }], { ...smooth, turn: "steps" });
    expect(i.walk[0]).toBe(0);
    expect(i.walk[1]).toBeGreaterThan(0);
  });
});

describe("the menu button", () => {
  it("fires once when B or Y goes down", () => {
    const l = new Locomotion();
    expect(l.frame(0.016, both([0, 0], [0, 0], { secondary: true }), steps).menu).toBe(true);
    expect(l.frame(0.016, both([0, 0], [0, 0], { secondary: true }), steps).menu).toBe(false);
    expect(l.frame(0.016, both([0, 0], [0, 0]), steps).menu).toBe(false);
    expect(l.frame(0.016, both([0, 0], [0, 0], { secondary: true }), steps).menu).toBe(true);
  });
});

describe("what is read back from storage", () => {
  it("keeps only what it knows", () => {
    expect(cleanComfort({ move: "smooth", turn: "spin", turnStep: 60, narrow: "yes", moveHand: "right", extra: 1 })).toEqual({ move: "smooth", moveHand: "right" });
    expect(cleanComfort(null)).toEqual({});
  });
});

describe("jumping and running in a headset", () => {
  const moving = (left: [number, number], more: Partial<PadState> = {}): HeldPad[] => [
    { index: 0, hand: "left", pad: pad(left, more) },
    { index: 1, hand: "right", pad: pad([0, 0]) },
  ];

  it("jumps once for one press of A or X, from either hand, however they are moving", () => {
    for (const comfort of [steps, smooth]) {
      const l = new Locomotion();
      expect(l.frame(0.016, both([0, 0], [0, 0]), comfort).jump).toBe(false);
      expect(l.frame(0.016, both([0, 0], [0, 0], { primary: true }), comfort).jump).toBe(true);
      // Held: no second jump until it is let go and pressed again.
      expect(l.frame(0.016, both([0, 0], [0, 0], { primary: true }), comfort).jump).toBe(false);
      expect(l.frame(0.016, both([0, 0], [0, 0]), comfort).jump).toBe(false);
      expect(l.frame(0.016, moving([0, 0], { primary: true }), comfort).jump).toBe(true);
    }
  });

  it("runs once the moving stick is pressed in, until that stick is let go", () => {
    const l = new Locomotion();
    const walked = l.frame(0.5, moving([0, 1]), smooth);
    expect(walked.running).toBe(false);
    expect(walked.walk[1]).toBeCloseTo(WALK_SPEED * 0.5);
    const ran = l.frame(0.5, moving([0, 1], { press: true }), smooth);
    expect(ran.running).toBe(true);
    expect(ran.walk[1]).toBeCloseTo(WALK_SPEED * RUN_FACTOR * 0.5);
    // The press is let go but the stick is still pushed: still running.
    expect(l.frame(0.5, moving([0, 1]), smooth).walk[1]).toBeCloseTo(WALK_SPEED * RUN_FACTOR * 0.5);
    // The stick comes back to rest: the run is over, and the next push is a walk.
    expect(l.frame(0.5, moving([0, 0]), smooth).running).toBe(false);
    expect(l.frame(0.5, moving([0, 1]), smooth).walk[1]).toBeCloseTo(WALK_SPEED * 0.5);
  });

  it("doesn't run for a stick pressed in while standing still, or for the turning stick", () => {
    const l = new Locomotion();
    expect(l.frame(0.5, moving([0, 0], { press: true }), smooth).running).toBe(false);
    const turning: HeldPad[] = [
      { index: 0, hand: "left", pad: pad([0, 1]) },
      { index: 1, hand: "right", pad: pad([0, 0], { press: true }) },
    ];
    expect(l.frame(0.5, turning, smooth).running).toBe(false);
  });

  it("reads a pressed-in stick, and never a touchpad, as the way to run", () => {
    const b = (pressed: boolean) => ({ pressed, touched: pressed, value: pressed ? 1 : 0 });
    expect(readPad({ axes: [0, 0, 0, -1], buttons: [b(false), b(false), undefined, b(true), b(false), b(false)] }).press).toBe(true);
    expect(readPad({ axes: [0, 0, 0, -1], buttons: [b(false), b(false), undefined, b(false), b(true), b(false)] })).toMatchObject({ press: false, primary: true });
    expect(readPad({ axes: [0, -1], buttons: [b(false), b(false), b(true)] }).press).toBe(false);
  });
});
