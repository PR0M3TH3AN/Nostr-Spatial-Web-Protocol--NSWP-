import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanSettings } from "@nswp/core";
import { CASUAL_COMFORT, cleanComfort, DEFAULT_COMFORT, INTENSE_COMFORT } from "../src/actions.js";

/**
 * The fade for jumps the kit makes (docs/plans/seated-mode.md, 3.4; docs/backlog/headset-casual-and-intense.md, "A
 * fade for jumps the kit makes"): in a headset, for someone whose `fade` is on (casual's default), the view goes
 * dark, the jump is made while it is, and the view comes back. Intense keeps the instant cut. A headset is stood in
 * for: what the input asks of the renderer, and whether a session is running.
 */
let presenting = true;
const renderer = () =>
  ({
    xr: {
      get isPresenting() {
        return presenting;
      },
      getController: () => new THREE.Group(),
      getControllerGrip: () => new THREE.Group(),
      getHand: () => new THREE.Group(),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  }) as unknown as THREE.WebGLRenderer;

const kept = new Map<string, string>();
beforeEach(() => {
  presenting = true;
  kept.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

const make = async () => {
  const { createXrInput } = await import("../src/input.js");
  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera();
  rig.add(camera);
  scene.add(rig);
  return { input: createXrInput({ renderer: renderer(), scene, rig, camera, models: false }), rig };
};

describe("the fade for a jump", () => {
  it("is casual's, and not intense's: each kept with the other comfort settings", () => {
    expect([DEFAULT_COMFORT.fade, CASUAL_COMFORT.fade, INTENSE_COMFORT.fade]).toEqual([true, true, false]);
    expect(cleanComfort({ fade: false })).toEqual({ fade: false });
    expect(cleanComfort({ fade: "yes" })).toEqual({});
    // And it travels, beside turn, hand and narrow (NSWP-11).
    expect(cleanSettings({ fade: false, narrow: true })).toEqual({ fade: false, narrow: true });
    expect(cleanSettings({ fade: 1 })).toEqual({});
  });

  it("makes the jump only once the view is wholly dark, then brings it back", async () => {
    const { input, rig } = await make();
    const jump = vi.fn(() => void (rig.position.x += 2));
    input.jump(jump);
    expect(jump).not.toHaveBeenCalled();
    input.update(0.06);
    expect(input.info().dark).toBe(0.5);
    expect(jump).not.toHaveBeenCalled();
    input.update(0.07);
    expect(jump).toHaveBeenCalledOnce();
    expect([input.info().dark, rig.position.x]).toEqual([1, 2]);
    input.update(0.06);
    expect(input.info().dark).toBe(0.5);
    input.update(0.07);
    expect(input.info().dark).toBe(0);
  });

  it("cuts at once for someone moving the intense way, or who turned the fade off, or out of a headset", async () => {
    const { input } = await make();
    input.setComfort(INTENSE_COMFORT);
    const a = vi.fn();
    input.jump(a);
    expect([a.mock.calls.length, input.info().dark]).toEqual([1, 0]);
    input.setComfort({ ...CASUAL_COMFORT, fade: false });
    const b = vi.fn();
    input.jump(b);
    expect(b).toHaveBeenCalledOnce();
    input.setComfort(CASUAL_COMFORT);
    presenting = false;
    const c = vi.fn();
    input.jump(c);
    expect(c).toHaveBeenCalledOnce();
  });

  it("makes a second jump in the dark too, going dark again from where it was", async () => {
    const { input } = await make();
    const first = vi.fn();
    const second = vi.fn();
    input.jump(first);
    input.update(0.13);
    expect(first).toHaveBeenCalledOnce();
    input.update(0.06);
    input.jump(second);
    expect(second).not.toHaveBeenCalled();
    input.update(0.07);
    expect(second).toHaveBeenCalledOnce();
    expect(input.info().dark).toBe(1);
  });

  it("makes a waiting jump at once when the headset session ends, and leaves nothing dark", async () => {
    const { input } = await make();
    const jump = vi.fn();
    input.jump(jump);
    input.update(0.05);
    presenting = false;
    input.update(0.016);
    expect([jump.mock.calls.length, input.info().dark]).toEqual([1, 0]);
  });
});
