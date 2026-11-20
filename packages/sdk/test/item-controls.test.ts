// Pressing what is in hand (item-controls.ts): a tap is the item's first press, sent where it was pressed.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { addItemControls, TAP_MS } from "../src/item-controls.js";
import type { Play } from "../src/play.js";
import type { Controls, UiAction } from "../src/ui/model.js";

const set = (does: { use: string; second: string } | null) => {
  const actions = new Map<string, UiAction>();
  const said: string[] = [];
  const used: (THREE.Vector3 | undefined)[] = [];
  let seconds = 0;
  const controls = { add: (...xs: UiAction[]) => xs.forEach((x) => actions.set(x.id, x)), remove: (id: string) => void actions.delete(id), say: (t: string) => void said.push(t) } as unknown as Controls;
  const play = { does, use: (toward?: THREE.Vector3) => void used.push(toward), second: () => void seconds++ } as unknown as Play;
  const sights: boolean[] = [];
  const item = addItemControls(controls, { play: () => play, holdingHand: () => 1, sight: (on) => void sights.push(on) });
  return { item, actions, said, used, seconds: () => seconds, sights };
};
const ray = { origin: new THREE.Vector3(0, 1.6, 0), direction: new THREE.Vector3(0, 0, -1) };

describe("a press on the view, with something in hand that does something", () => {
  it("is its first press when it is a tap, and goes where they tapped", () => {
    const s = set({ use: "Fire", second: "Reload" });
    expect(s.item.tap(ray, 80)).toBe(true);
    expect(s.used.length).toBe(1);
    // Out along the way they pressed, from where the press was.
    expect(s.used[0]!.z).toBeLessThan(-10);
    expect(s.used[0]!.y).toBeCloseTo(1.6, 3);
  });

  it("is not, when it is held: that is still how they walk", () => {
    const s = set({ use: "Fire", second: "Reload" });
    expect(s.item.tap(ray, TAP_MS)).toBe(false);
    expect(s.item.tap(ray, 900)).toBe(false);
    expect(s.used.length).toBe(0);
  });

  it("is nothing of the item's with nothing in hand, or something that does nothing", () => {
    expect(set(null).item.tap(ray, 80)).toBe(false);
    expect(set({ use: "", second: "Reload" }).item.tap(ray, 80)).toBe(false);
  });

  it("puts the item's two presses at the front of the bar, and says once how the view is pressed", () => {
    const s = set({ use: "Fire", second: "Reload" });
    expect(s.actions.get("item-use")).toMatchObject({ label: "Fire", hotbar: true, lead: true });
    expect(s.actions.get("item-second")).toMatchObject({ label: "Reload", hotbar: true, lead: true });
    expect(s.said).toEqual(["Tap or click where you want to fire. Hold a press to walk."]);
    const none = set(null);
    expect(none.actions.size).toBe(0);
    expect(none.said).toEqual([]);
  });

  it("is the item's by a headset's trigger only on the hand that holds it", () => {
    const s = set({ use: "Fire", second: "Reload" });
    expect(s.item.trigger(0)).toBe(false);
    expect(s.item.trigger(1)).toBe(true);
    expect(s.used).toEqual([undefined]);
  });
});
