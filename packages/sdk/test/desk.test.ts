import { beforeEach, describe, expect, it } from "vitest";
import { lookScale, onDeskChange, resetDesk, setLookScale, setVisitorFov, watchFov } from "../src/desk.js";
import { arriveWith, currentSettings, resetSettings } from "../src/settings.js";

beforeEach(() => {
  resetSettings();
  resetDesk();
});

describe("how fast the view turns, and how wide a visitor sees", () => {
  it("is the kit's own until they change it, and says so to nobody", () => {
    expect(lookScale()).toBe(1);
    expect(currentSettings().fov).toBeUndefined();
  });

  it("begins from what they arrived with, and goes on with them", () => {
    arriveWith({ look: 1.5, fov: 90 });
    expect(lookScale()).toBe(1.5);
    expect(currentSettings()).toMatchObject({ look: 1.5, fov: 90 });
  });

  it("keeps what they set within what a world can do with it", () => {
    setLookScale(40);
    expect(lookScale()).toBe(3);
    setLookScale(0);
    expect(lookScale()).toBe(0.25);
    setVisitorFov(200);
    expect(currentSettings().fov).toBe(110);
    setVisitorFov(null);
    expect(currentSettings().fov).toBeUndefined();
  });

  it("tells whoever is watching when either changes", () => {
    let told = 0;
    const stop = onDeskChange(() => told++);
    setLookScale(2);
    setVisitorFov(80);
    stop();
    setLookScale(1);
    expect(told).toBe(2);
  });

  it("leaves a camera as the world made it unless they asked for a width at a desk", () => {
    const camera = { fov: 70, updated: 0, updateProjectionMatrix() { this.updated++; } };
    watchFov(camera);
    expect(camera.fov).toBe(70);
    // Not at a desk here (there is no window at all), so asking changes nothing: a touch screen keeps the world's own.
    setVisitorFov(100);
    expect(camera.fov).toBe(70);
  });

  it("never touches a camera while a headset has the view", () => {
    const camera = { fov: 70, updateProjectionMatrix() {} };
    const refresh = watchFov(camera, { own: () => 55, presenting: () => true });
    refresh();
    expect(camera.fov).toBe(70);
  });
});
