import { describe, expect, it } from "vitest";
import { heldKey, lookAfter, LOOK_SPEED, PITCH_LIMIT, SPRINT, strideOf } from "../src/fps.js";

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("looking with the mouse", () => {
  it("turns left for a move left and up for a move up", () => {
    const l = lookAfter(0, 0, -100, 0);
    expect(l.yaw).toBeGreaterThan(0);
    near(l.yaw, 100 * LOOK_SPEED);
    expect(lookAfter(0, 0, 0, -50).pitch).toBeGreaterThan(0);
    expect(lookAfter(0, 0, 0, 50).pitch).toBeLessThan(0);
  });

  it("never looks past straight up or down, and ignores a movement that isn't a number", () => {
    expect(lookAfter(0, 0, 0, -1e6).pitch).toBe(PITCH_LIMIT);
    expect(lookAfter(0, 0, 0, 1e6).pitch).toBe(-PITCH_LIMIT);
    expect(lookAfter(1, 0.5, Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ yaw: 1, pitch: 0.5 });
  });
});

describe("walking with the keys", () => {
  it("goes forward along the way the visitor faces", () => {
    const [x, z] = strideOf({ forward: true }, 0, 2, 1);
    near(x, 0);
    near(z, -2); // facing -Z with no turn
    const [x2, z2] = strideOf({ forward: true }, Math.PI / 2, 2, 1); // turned a quarter left: facing -X
    near(x2, -2);
    near(z2, 0);
    const [x3, z3] = strideOf({ right: true }, 0, 2, 1);
    near(x3, 2);
    near(z3, 0);
    const [x4, z4] = strideOf({ back: true }, 0, 2, 0.5);
    near(x4, 0);
    near(z4, 1);
  });

  it("is no faster on the diagonal, runs with Shift, and stands still with nothing or with both ways held", () => {
    const [x, z] = strideOf({ forward: true, right: true }, 0.7, 2, 1);
    near(Math.hypot(x, z), 2);
    const [rx, rz] = strideOf({ forward: true, sprint: true }, 0, 2, 1);
    near(Math.hypot(rx, rz), 2 * SPRINT);
    expect(strideOf({}, 0, 2, 1)).toEqual([0, 0]);
    expect(strideOf({ sprint: true }, 0, 2, 1)).toEqual([0, 0]);
    expect(strideOf({ forward: true, back: true }, 0, 2, 1)).toEqual([0, 0]);
    near(Math.hypot(...strideOf({ forward: true }, 0, 2, -1)), 0); // time doesn't run backwards
  });

  it("knows its keys", () => {
    expect(["KeyW", "ArrowUp", "KeyS", "ArrowDown", "KeyA", "ArrowLeft", "KeyD", "ArrowRight", "ShiftLeft", "ShiftRight"].map(heldKey)).toEqual(["forward", "forward", "back", "back", "left", "left", "right", "right", "sprint", "sprint"]);
    expect(heldKey("KeyF")).toBeNull();
    expect(heldKey("Space")).toBeNull();
  });
});
