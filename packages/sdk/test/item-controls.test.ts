// Pressing what is in hand (item-controls.ts): a tap is the item's first press, sent where it was pressed.
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addItemControls, TAP_MS } from "../src/item-controls.js";
import { resetForm } from "../src/form.js";
import { DEFAULT_THEME } from "../src/ui/theme.js";
import type { Play } from "../src/play.js";
import type { Controls, UiAction } from "../src/ui/model.js";

const set = (does: { use: string; second: string } | null) => {
  const actions = new Map<string, UiAction>();
  const said: string[] = [];
  const used: (THREE.Vector3 | undefined)[] = [];
  let seconds = 0;
  const controls = { add: (...xs: UiAction[]) => xs.forEach((x) => actions.set(x.id, x)), remove: (id: string) => void actions.delete(id), say: (t: string) => void said.push(t), onSignal: () => () => {}, theme: DEFAULT_THEME } as unknown as Controls;
  const play = { does, use: (toward?: THREE.Vector3) => void used.push(toward), second: () => void seconds++ } as unknown as Play;
  const sights: boolean[] = [];
  const item = addItemControls(controls, { play: () => play, holdingHand: () => 1, sight: (on) => void sights.push(on) });
  return { item, actions, said, used, seconds: () => seconds, sights };
};
const ray = { origin: new THREE.Vector3(0, 1.6, 0), direction: new THREE.Vector3(0, 0, -1) };
// The device: a desk with a mouse unless a test says it is a touch screen.
const asDesk = () => vi.stubGlobal("matchMedia", (q: string) => ({ matches: /fine/.test(q) }));
const asTouch = () => vi.stubGlobal("matchMedia", (q: string) => ({ matches: /coarse/.test(q) }));
beforeEach(() => {
  resetForm();
  asDesk();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetForm();
});

describe("a press on the view, with something in hand that does something", () => {
  it("is its first press when it is a tap, and goes where they tapped", () => {
    const s = set({ use: "Fire", second: "Reload" });
    expect(s.item.tap(ray, 80)).toBe(true);
    expect(s.used.length).toBe(1);
    // Out along the way they pressed, from where the press was.
    expect(s.used[0]!.z).toBeLessThan(-10);
    expect(s.used[0]!.y).toBeCloseTo(1.6, 3);
  });

  it("is never a touch: on a touch screen a tap walks, and the first press is under the thumb", () => {
    const s = set({ use: "Fire", second: "Reload" });
    expect(s.item.tap(ray, 80, "touch")).toBe(false);
    expect(s.item.tap(ray, 80, "mouse")).toBe(true);
    expect(s.used.length).toBe(1);
    s.item.dispose();
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
    expect(s.said).toEqual(["Click where you want to fire. Hold a press to walk."]);
    const none = set(null);
    // Nothing to press: only the choice of thumb, which isn't shown with nothing in hand.
    expect([...none.actions.keys()]).toEqual(["item-thumbs"]);
    expect(none.actions.get("item-thumbs")!.hidden?.()).toBe(true);
    expect(none.said).toEqual([]);
  });

  it("aims along the sight at one press of the other mouse button, and puts it down at the next: nothing is held", () => {
    // The pointer is the view's (moving the intense way): that is when the mouse buttons are the item's.
    vi.stubGlobal("document", { pointerLockElement: {}, addEventListener: () => {}, removeEventListener: () => {} });
    try {
      const actions = new Map<string, UiAction>();
      const controls = { add: (...xs: UiAction[]) => xs.forEach((x) => actions.set(x.id, x)), remove: (id: string) => void actions.delete(id), say: () => {}, onSignal: () => () => {}, theme: DEFAULT_THEME } as unknown as Controls;
      let does: { use: string; second: string } | null = { use: "Fire", second: "Reload" };
      const play = { get does() { return does; }, use: () => {}, second: () => {} } as unknown as Play;
      const sights: boolean[] = [];
      const dom = new EventTarget();
      const item = addItemControls(controls, { play: () => play, holdingHand: () => -1, dom: dom as unknown as HTMLElement, sight: (on) => void sights.push(on) });
      const press = (button: number) => dom.dispatchEvent(Object.assign(new Event("mousedown"), { button }));
      press(2);
      expect(sights).toEqual([true]);
      // Letting go changes nothing: there is no letting go to hear.
      press(2);
      expect(sights).toEqual([true, false]);
      press(2);
      // Put away while aiming: the sight comes down with it.
      does = null;
      item.refresh();
      expect(sights).toEqual([true, false, true, false]);
      item.dispose();
    } finally {
      vi.unstubAllGlobals();
      asDesk();
    }
  });

  it("is the item's by a headset's trigger only on the hand that holds it", () => {
    const s = set({ use: "Fire", second: "Reload" });
    expect(s.item.trigger(0)).toBe(false);
    expect(s.item.trigger(1)).toBe(true);
    expect(s.used).toEqual([undefined]);
  });
});

describe("on a touch screen, with something in hand that does something", () => {
  it("keeps the two presses off the bar (they are under the thumb), still one press away in the Bag tab, and says where they are", () => {
    asTouch();
    try {
      const s = set({ use: "Fire", second: "Reload" });
      expect(s.actions.get("item-use")).toMatchObject({ label: "Fire", section: "bag", hotbar: false, lead: false });
      expect(s.actions.get("item-second")).toMatchObject({ label: "Reload", section: "bag", hotbar: false, lead: false });
      expect(s.said).toEqual(["Fire is by your right thumb, and goes where the ring in the middle is. Tap to walk; drag to look round."]);
      // A tap on the view is a walk, whatever the press says it was: the device they are on decides.
      expect(s.item.tap(ray, 80)).toBe(false);
      // Which thumb is theirs to choose, beside what they hold.
      expect(s.actions.get("item-thumbs")).toBeTruthy();
      expect(s.actions.get("item-thumbs")!.hidden?.()).toBe(false);
      s.item.dispose();
      expect(s.actions.has("item-thumbs")).toBe(false);
    } finally {
      resetForm();
    }
  });

  it("offers no choice of thumb at a desk, or with nothing in hand", () => {
    const desk = set({ use: "Fire", second: "Reload" });
    expect(desk.actions.get("item-thumbs")!.hidden?.()).toBe(true);
    desk.item.dispose();
    asTouch();
    try {
      const none = set(null);
      expect(none.actions.get("item-thumbs")!.hidden?.()).toBe(true);
      none.item.dispose();
    } finally {
      resetForm();
    }
  });
});

describe("the thumb buttons on a site with strict rules", () => {
  it("are styled by a constructed stylesheet, never an inline <style> a strict content security policy refuses", async () => {
    const { readFileSync } = (await import(/* @vite-ignore */ ["node", "fs"].join(":"))) as { readFileSync(path: URL, encoding: string): string };
    const src = readFileSync(new URL("../src/thumb-presses.ts", import.meta.url), "utf8");
    expect(src).toContain("root.adoptedStyleSheets = [sheet];");
    expect(src).not.toMatch(/innerHTML\s*=\s*`<style>/);
  });
});
