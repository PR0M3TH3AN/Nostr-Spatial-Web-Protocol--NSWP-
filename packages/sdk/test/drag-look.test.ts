// Looking round by dragging, moving the casual way (stroll.ts): sideways turns, up and down tilts, within the limit,
// and the view comes back level as they walk.
import { describe, expect, it } from "vitest";
import { createDragLook, DRAG_LOOK, dragTurn, LEVEL_RATE, levelled, TILT_LIMIT } from "../src/stroll.js";

describe("a drag on a flat screen, moving the casual way", () => {
  it("turns them sideways as it always has, and tilts the view up and down", () => {
    const right = dragTurn(0, 0, 100, 0);
    expect(right.yaw).toBeCloseTo(100 * DRAG_LOOK, 9);
    expect(right.pitch).toBe(0);
    // Dragging down brings what was above into view: the view tilts up.
    expect(dragTurn(0, 0, 0, 80).pitch).toBeCloseTo(80 * DRAG_LOOK, 9);
    expect(dragTurn(0, 0, 0, -80).pitch).toBeCloseTo(-80 * DRAG_LOOK, 9);
  });

  it("never tilts past about sixty degrees either way", () => {
    expect(TILT_LIMIT).toBeCloseTo(Math.PI / 3, 9);
    expect(dragTurn(0, 0, 0, 100000).pitch).toBe(TILT_LIMIT);
    expect(dragTurn(0, 0, 0, -100000).pitch).toBe(-TILT_LIMIT);
    // Nonsense in is nothing out.
    expect(dragTurn(0.5, 0.2, Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ yaw: 0.5, pitch: 0.2 });
  });

  it("comes back to level while they walk, and never past it", () => {
    expect(levelled(0.5, 0.1)).toBeCloseTo(0.5 - 0.1 * LEVEL_RATE, 9);
    expect(levelled(-0.5, 0.1)).toBeCloseTo(-0.5 + 0.1 * LEVEL_RATE, 9);
    expect(levelled(0.05, 1)).toBe(0);
    // From the full tilt, level in under a second.
    expect(TILT_LIMIT / LEVEL_RATE).toBeLessThan(1);
  });
});

describe("the drag's hold on the view", () => {
  const view = () => ({ rig: { rotation: { y: 0 } }, camera: { rotation: { x: 0 } } });

  it("turns the rig and tilts the camera, and eases level only while they walk", () => {
    const v = view();
    const look = createDragLook(v);
    look.drag(40, 100);
    expect(v.rig.rotation.y).toBeCloseTo(40 * DRAG_LOOK, 9);
    expect(v.camera.rotation.x).toBeCloseTo(100 * DRAG_LOOK, 9);
    look.update(0.5, { walking: false, active: true });
    expect(v.camera.rotation.x).toBeCloseTo(100 * DRAG_LOOK, 9);
    look.update(0.1, { walking: true, active: true });
    expect(v.camera.rotation.x).toBeLessThan(100 * DRAG_LOOK);
    for (let i = 0; i < 20; i++) look.update(0.1, { walking: true, active: true });
    expect(v.camera.rotation.x).toBe(0);
  });

  it("hands the view over level, and leaves it alone while it is the intense way's or the headset's", () => {
    const v = view();
    const look = createDragLook(v);
    look.drag(0, -120);
    expect(v.camera.rotation.x).toBeLessThan(0);
    look.update(0.016, { walking: false, active: false });
    expect(v.camera.rotation.x).toBe(0);
    // Whatever holds the view now moves it: the drag neither writes it nor answers to a drag.
    v.camera.rotation.x = 0.3;
    look.update(0.016, { walking: true, active: false });
    look.drag(0, 200);
    expect(v.camera.rotation.x).toBe(0.3);
    expect(look.pitch).toBe(0);
  });

  it("follows the visitor's own look speed", () => {
    const v = view();
    createDragLook({ ...v, scale: () => 2 }).drag(10, 10);
    expect(v.rig.rotation.y).toBeCloseTo(20 * DRAG_LOOK, 9);
    expect(v.camera.rotation.x).toBeCloseTo(20 * DRAG_LOOK, 9);
  });
});
