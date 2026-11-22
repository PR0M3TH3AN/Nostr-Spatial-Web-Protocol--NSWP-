import { describe, expect, it } from "vitest";
import { createJump, JUMP_GRAVITY, JUMP_HEIGHT, JUMP_SPEED } from "../src/jump.js";

describe("a jump", () => {
  it("lifts a visitor about knee height and puts them back on the floor in under a second", () => {
    let landed = 0;
    let left = 0;
    const jump = createJump({ onJump: () => left++, onLand: () => landed++ });
    expect(jump.update(0.016)).toBe(0);
    expect(jump.jump()).toBe(true);
    expect(left).toBe(1);
    let top = 0;
    let time = 0;
    while (jump.airborne && time < 5) {
      top = Math.max(top, jump.update(1 / 90));
      time += 1 / 90;
    }
    expect(top).toBeGreaterThan(JUMP_HEIGHT * 0.95);
    expect(top).toBeLessThan(JUMP_HEIGHT * 1.02);
    expect(time).toBeGreaterThan(0.4);
    expect(time).toBeLessThan(0.8);
    expect(jump.height).toBe(0);
    expect(landed).toBe(1);
    expect(JUMP_SPEED).toBeCloseTo(Math.sqrt(2 * JUMP_GRAVITY * JUMP_HEIGHT), 9);
  });

  it("is one jump at a time: asking again in the air does nothing", () => {
    let left = 0;
    const jump = createJump({ onJump: () => left++ });
    expect(jump.jump()).toBe(true);
    jump.update(0.1);
    expect(jump.jump()).toBe(false);
    expect(left).toBe(1);
    for (let i = 0; i < 100; i++) jump.update(0.02);
    expect(jump.jump()).toBe(true);
  });

  it("takes the same time at any frame rate", () => {
    const airTime = (dt: number) => {
      const jump = createJump();
      jump.jump();
      let time = 0;
      while (jump.airborne && time < 5) {
        jump.update(dt);
        time += dt;
      }
      return time;
    };
    const exact = (2 * JUMP_SPEED) / JUMP_GRAVITY;
    for (const fps of [144, 60, 30, 12]) expect(Math.abs(airTime(1 / fps) - exact)).toBeLessThanOrEqual(1 / fps + 1e-9);
  });

  it("never sinks through the floor or hangs in the air after a long frame", () => {
    const jump = createJump();
    jump.jump();
    for (let i = 0; i < 40; i++) expect(jump.update(3)).toBeGreaterThanOrEqual(0);
    expect(jump.airborne).toBe(false);
  });

  it("can be put down at once, without a landing being heard", () => {
    let landed = 0;
    const jump = createJump({ onLand: () => landed++ });
    jump.jump();
    jump.update(0.1);
    jump.land();
    expect(jump.height).toBe(0);
    expect(jump.airborne).toBe(false);
    expect(landed).toBe(0);
  });
});

describe("the sound of a jump", () => {
  it("is two footsteps back to back, a little louder than a step, and still quieter than every other cue", async () => {
    const { JUMP_STEPS, STEP_LEVEL } = await import("../src/sound-store.js");
    // The owner's words: "two of our random footstep sounds back to back and slightly louder".
    expect(JUMP_STEPS.louder).toBeGreaterThan(1);
    expect(JUMP_STEPS.louder).toBeLessThanOrEqual(1.5);
    // Every other cue plays at its full level, 1: the loudest jump step stays under it.
    expect(STEP_LEVEL * JUMP_STEPS.louder).toBeLessThan(1);
    // Back to back, and heard as two: closer than a walking step's spacing (0.14 s), further than a click.
    expect(JUMP_STEPS.gap).toBeGreaterThanOrEqual(0.05);
    expect(JUMP_STEPS.gap).toBeLessThan(0.14);
  });

  it("is what a jump asks for, and one step where whatever makes sounds has no jump of its own", async () => {
    const { addJump } = await import("../src/jump.js");
    const { createControls } = await import("../src/ui/model.js");
    const heard: string[] = [];
    const listeners: Record<string, (e: unknown) => void> = {};
    (globalThis as { addEventListener?: unknown }).addEventListener = (type: string, fn: (e: unknown) => void) => void (listeners[type] = fn);
    (globalThis as { removeEventListener?: unknown }).removeEventListener = () => {};
    try {
      const withJump = addJump(createControls({ title: "A world" }), { presenting: () => false, sounds: { play: (cue) => void heard.push(cue), jumped: () => void heard.push("jumped") } });
      withJump.jump();
      const plain = addJump(createControls({ title: "A world" }), { presenting: () => false, sounds: { play: (cue) => void heard.push(cue) } });
      plain.jump();
      expect(heard).toEqual(["jumped", "step"]);
    } finally {
      delete (globalThis as { addEventListener?: unknown }).addEventListener;
      delete (globalThis as { removeEventListener?: unknown }).removeEventListener;
    }
  });
});
