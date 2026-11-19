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
