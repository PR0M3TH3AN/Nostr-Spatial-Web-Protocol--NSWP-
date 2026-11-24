import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONSOLE_H, CONSOLE_W, createConsoleDrawing, type Region } from "../src/console-drawing.js";
import { createControls } from "../src/ui/model.js";

/**
 * The headset console's picture (console-drawing.ts), drawn by the same code whatever shows it: a Three.js world's
 * panel, or the pixels handed to a world made with another engine. The canvas is a stand-in that takes any drawing
 * and counts it; what is checked is what the drawing keeps beside the picture.
 */
// An icon is drawn along a path, which a browser has and this test's world doesn't.
beforeAll(() => void ((globalThis as { Path2D?: unknown }).Path2D = class {}));
afterAll(() => void delete (globalThis as { Path2D?: unknown }).Path2D);

const canvasOf = () => {
  const drawn = { calls: 0 };
  const gradient = { addColorStop: () => {} };
  const g = new Proxy(
    {},
    {
      get: (_t, name) => {
        if (name === "measureText") return (text: string) => ({ width: String(text).length * 12 });
        if (name === "createLinearGradient") return () => gradient;
        return (..._a: unknown[]) => void drawn.calls++;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { canvas: { width: CONSOLE_W, height: CONSOLE_H, getContext: () => g } as unknown as HTMLCanvasElement, g, drawn };
};
const world = () => {
  const controls = createControls({ title: "The Foundry", address: "foundry.example" });
  controls.add({ id: "home", section: "travel", label: "Go home", icon: "home", act: () => {} });
  controls.add({ id: "door", section: "travel", label: "The Gallery", icon: "door", tone: "primary", act: () => {} });
  controls.add({ id: "mute", section: "sound", label: "Sound: on", on: () => true, act: () => {} });
  controls.add({ id: "leave", section: "room", label: "Leave the room", tone: "warn", act: () => {} });
  return controls;
};
const inside = (r: Region) => r.x >= 0 && r.y >= 0 && r.x + r.w <= CONSOLE_W && r.y + r.h <= CONSOLE_H && r.w > 0 && r.h > 0;

describe("the console's picture, drawn plain for an engine to light itself", () => {
  it("is drawn again when what it shows changes, and never for pointing", () => {
    const c = canvasOf();
    const d = createConsoleDrawing(world(), { canvas: c.canvas, context: c.g, plain: true });
    expect(d.paint()).toBe(true);
    const drawnOnce = c.drawn.calls;
    // Pointed at one row after another: the picture is the same picture.
    for (const row of d.regions) {
      d.aimed = row.id;
      expect(d.paint(), row.id).toBe(false);
    }
    d.aimed = null;
    expect([d.paint(), c.drawn.calls]).toEqual([false, drawnOnce]);
    // Another tab: drawn again.
    d.section = "sound";
    expect(d.paint()).toBe(true);
    expect(c.drawn.calls).toBeGreaterThan(drawnOnce);
  });

  it("lists every pressable thing with its place on the picture and how the kit wants it lit", () => {
    const c = canvasOf();
    const d = createConsoleDrawing(world(), { canvas: c.canvas, context: c.g, plain: true });
    d.paint();
    const ids = d.regions.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["close", "tab:travel", "tab:sound", "tab:room", "act:home", "act:door"]));
    expect(d.regions.every(inside)).toBe(true);
    // The look is whole for each: a fill, an edge, corners. Nothing is left for whatever draws it to choose.
    for (const r of d.regions.filter((x) => x.lit)) {
      expect(r.lit, r.id).toMatchObject({ fill: expect.stringMatching(/^#[0-9a-f]{6}$/i), stroke: expect.stringMatching(/^#[0-9a-f]{6}$/i) });
      expect([r.lit!.corners.length, r.lit!.fillAlpha > 0 && r.lit!.fillAlpha < 1, r.lit!.line >= 0], r.id).toEqual([4, true, true]);
    }
    const lit = (id: string) => d.regions.find((r) => r.id === id)!.lit;
    // The tab that is up looks the same pointed at or not: nothing lights it. The others are lit.
    expect([lit("tab:travel"), lit("tab:sound") !== null, lit("close") !== null]).toEqual([null, true, true]);
    // A button already filled is given less, to end at the same strength as one that isn't.
    expect(lit("act:door")!.fillAlpha).toBeLessThan(lit("act:home")!.fillAlpha);
  });

  it("lights a warning in the warning's colour, and says so whichever tab is up", () => {
    const controls = world();
    const c = canvasOf();
    const d = createConsoleDrawing(controls, { canvas: c.canvas, context: c.g, plain: true });
    d.section = "room";
    d.paint();
    const theme = controls.view().theme;
    expect(d.regions.find((r) => r.id === "act:leave")!.lit).toMatchObject({ fill: theme.warn, stroke: theme.warn, strokeAlpha: 1 });
    expect(d.regions.find((r) => r.id === "tab:room")!.lit).toBeNull();
    expect(d.regions.find((r) => r.id === "tab:travel")!.lit).toMatchObject({ fill: theme.accent });
  });
});

describe("the same picture with its own light, as a Three.js world shows it", () => {
  it("is drawn again when the row pointed at changes, with the rows in the same places", () => {
    const controls = world();
    const plain = canvasOf();
    const own = canvasOf();
    const p = createConsoleDrawing(controls, { canvas: plain.canvas, context: plain.g, plain: true });
    const d = createConsoleDrawing(controls, { canvas: own.canvas, context: own.g });
    p.paint();
    expect(d.paint()).toBe(true);
    d.aimed = "act:home";
    expect(d.paint()).toBe(true);
    d.aimed = "act:home";
    expect(d.paint()).toBe(false);
    // One list of places, whoever lights the row.
    const places = (list: readonly Region[]) => list.map((r) => [r.id, r.x, r.y, r.w, r.h]);
    expect(places(d.regions)).toEqual(places(p.regions));
  });

  it("tells whoever shows it each time it was drawn anew, and draws a late picture in only while it is shown", () => {
    const c = canvasOf();
    let told = 0;
    const d = createConsoleDrawing(world(), { canvas: c.canvas, context: c.g, painted: () => void told++ });
    d.paint();
    d.paint();
    d.again();
    d.paint();
    expect(told).toBe(2);
  });

  it("turns the pages of a section's lines round to the first", () => {
    const c = canvasOf();
    const d = createConsoleDrawing(world(), { canvas: c.canvas, context: c.g });
    d.paint();
    expect([d.linePage, d.linePages]).toEqual([0, 1]);
    d.turnPage();
    expect(d.linePage).toBe(0);
  });
});
