import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BACK_STEP, deadzone, DEFAULT_COMFORT, FADE_S, INTENSE_COMFORT, Locomotion, STEP_REACH, type HeldPad, type PadState } from "../src/actions.js";
import { askHowTheyMove, hands, handsPresenting, meetHands, resetHands } from "../src/engine-hands.js";
import { resetSettings } from "../src/settings.js";
import { createControls } from "../src/ui/model.js";

/**
 * What the hands mean in a headset, for a world made with another engine (`NSWP.hands`,
 * docs/plans/godot-headset-controls.md). The engine script must answer exactly as the kit does for a Three.js world,
 * since it is the kit's own `Locomotion` that answers: an engine decides nothing.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const kept = new Map<string, string>();
let t = 0;
beforeEach(() => {
  kept.clear();
  t = 0;
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
  resetSettings();
  resetHands(() => t);
});
afterEach(() => {
  resetHands();
  resetSettings();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

type Read = { index: number; hand: string; stick?: [number, number]; trigger?: number; squeeze?: number; primary?: boolean; secondary?: boolean; press?: boolean };
const ask = (pads: Read[], more: Record<string, unknown> = {}) => JSON.parse(hands(JSON.stringify({ dt: 1 / 72, pads, ...more }))) as Record<string, unknown>;
const left = (stick: [number, number] = [0, 0], more: Partial<Read> = {}): Read => ({ index: 0, hand: "left", stick, ...more });
const right = (stick: [number, number] = [0, 0], more: Partial<Read> = {}): Read => ({ index: 1, hand: "right", stick, ...more });
const pad = (stick: [number, number], more: Partial<PadState> = {}): PadState => ({ stick, from: "thumbstick", trigger: 0, squeeze: 0, primary: false, secondary: false, press: false, ...more });

describe("what the hands mean, asked by an engine", () => {
  it("is the casual way to start with: a stick held forward chooses where to step, and letting go steps", () => {
    expect(ask([left(), right()])).toMatchObject({ turn: 0, walk: [0, 0], aiming: [], stepFrom: [], fade: true, mayStep: true, intense: false, narrow: 0 });
    expect(ask([left([0, 1]), right()])).toMatchObject({ aiming: [0], stepFrom: [] });
    expect(ask([left([0, 1]), right()])).toMatchObject({ aiming: [0], stepFrom: [] });
    expect(ask([left(), right()])).toMatchObject({ aiming: [], stepFrom: [0] });
    expect(ask([left(), right()])).toMatchObject({ aiming: [], stepFrom: [] });
  });

  it("turns a notch for each flick of the other stick, to the right for a push to the right", () => {
    expect(ask([left(), right([1, 0])]).turn).toBe(-DEFAULT_COMFORT.turnStep);
    // Held, it is still one notch.
    expect(ask([left(), right([1, 0])]).turn).toBe(0);
    ask([left(), right()]);
    expect(ask([left(), right([-1, 0])]).turn).toBe(DEFAULT_COMFORT.turnStep);
  });

  it("steps back a metre for a stick pulled back, once, and paces it like any other step", () => {
    expect(ask([left([0, -1]), right()]).walk).toEqual([0, -BACK_STEP]);
    expect(ask([left([0, -1]), right()]).walk).toEqual([0, 0]);
    // Let go and pulled again at once: too soon, as someone running would not have covered a metre yet.
    ask([left(), right()]);
    const again = ask([left([0, -1]), right()]);
    expect([again.walk, again.mayStep]).toEqual([[0, 0], false]);
    ask([left(), right()]);
    t += 1000;
    expect(ask([left([0, -1]), right()]).walk).toEqual([0, -BACK_STEP]);
  });

  it("is told how far a step went, and says a step may not be taken until that ground would have been run", () => {
    expect(ask([left(), right()]).mayStep).toBe(true);
    expect(ask([left(), right()], { stepped: STEP_REACH }).mayStep).toBe(false);
    t += 200;
    expect(ask([left(), right()]).mayStep).toBe(false);
    t += 5000;
    expect(ask([left(), right()]).mayStep).toBe(true);
  });

  it("answers exactly as the kit's own Locomotion does, frame for frame, casual and intense", () => {
    const frames: [number, number][][] = [[[0, 0], [0, 0]], [[0, 0.9], [0.8, 0]], [[0.3, 0.9], [0.8, 0]], [[0, 0.1], [0, 0]], [[0, -0.9], [-0.9, 0.1]], [[0, 0], [0, 0]], [[0.7, 0.7], [0.2, 0]], [[0, 0], [0, 0]]];
    for (const comfort of [DEFAULT_COMFORT, { ...DEFAULT_COMFORT, ...INTENSE_COMFORT }, { ...DEFAULT_COMFORT, moveHand: "right" as const, turnStep: 90 as const }]) {
      kept.set("nswp:comfort", JSON.stringify(comfort));
      resetHands(() => (t += 10_000));
      const own = new Locomotion();
      for (const [l, r] of frames) {
        // An engine hands the sticks over as it read them; the dead middle is taken out here, as `readPad` does
        // for a Three.js world before the same `Locomotion` sees them.
        const pads: HeldPad[] = [{ index: 0, hand: "left", pad: pad(deadzone(...l!)) }, { index: 1, hand: "right", pad: pad(deadzone(...r!)) }];
        const mine = own.frame(1 / 72, pads, comfort);
        const said = ask([left(l), right(r)]);
        expect({ turn: said.turn, walk: said.walk, aiming: said.aiming, stepFrom: said.stepFrom, menu: said.menu, jump: said.jump, running: said.running, narrow: said.narrow }, JSON.stringify([comfort.move, l, r])).toEqual({ turn: mine.turn, walk: mine.walk, aiming: mine.aiming, stepFrom: mine.stepFrom, menu: mine.menu, jump: mine.jump, running: mine.running, narrow: mine.narrow });
      }
    }
  });

  it("walks and turns smoothly for someone who moves the intense way, with no fade and no notches", () => {
    kept.set("nswp:comfort", JSON.stringify({ ...DEFAULT_COMFORT, ...INTENSE_COMFORT }));
    resetHands(() => t);
    const moving = ask([left([0, 1]), right([1, 0])]);
    expect(moving).toMatchObject({ intense: true, fade: false, aiming: [], stepFrom: [] });
    expect((moving.walk as number[])[1]).toBeCloseTo(1.8 / 72, 6);
    expect(moving.turn as number).toBeCloseTo(-110 / 72, 6);
  });

  it("says the menu button (B or Y) and the jump button (A or X) once for each press", () => {
    expect(ask([left(), right([0, 0], { secondary: true })])).toMatchObject({ menu: true, jump: false });
    expect(ask([left(), right([0, 0], { secondary: true })]).menu).toBe(false);
    ask([left(), right()]);
    expect(ask([left([0, 0], { primary: true }), right()])).toMatchObject({ menu: false, jump: true });
  });

  it("takes whatever an engine hands it without throwing, and means nothing by what it can't read", () => {
    const nothing = { turn: 0, walk: [0, 0], aiming: [], stepFrom: [], menu: false, jump: false };
    for (const bad of ["", "nothing", "[]", "null", '{"pads":"two"}', '{"dt":"fast","pads":[null,5,{"index":7},{"index":0,"stick":"up"}]}']) expect(JSON.parse(hands(bad)), bad).toMatchObject(nothing);
    // Out of range, and more than two: clamped, and the first in each slot is the one read.
    const wild = ask([left([0, 99]), left([0, -99]), right([Infinity as never, 0]), { index: 1, hand: "right", stick: [-1, 0] }]);
    expect(wild).toMatchObject({ aiming: [0], turn: 0 });
    // A stick barely off its middle is at rest.
    expect(ask([left([0.05, 0.1]), right([0.1, 0])])).toMatchObject({ turn: 0, walk: [0, 0] });
  });

  it("starts each session with nothing held over from the last", () => {
    handsPresenting(true);
    ask([left([0, 1]), right()]);
    handsPresenting(false);
    handsPresenting(true);
    expect(ask([left(), right()]).stepFrom).toEqual([]);
  });

  it("gives an engine world the same rows in Moving as every world, and what they choose is what the hands then mean", async () => {
    (globalThis as { navigator?: unknown }).navigator ??= {};
    const xr = { isSessionSupported: async () => true };
    Object.defineProperty(globalThis.navigator, "xr", { value: xr, configurable: true });
    try {
      const controls = createControls({ title: "A world made with another engine" });
      meetHands(controls);
      await new Promise((r) => setTimeout(r, 0));
      const moving = () => controls.view().sections.find((s) => s.id === "moving")!.items;
      expect(moving().map((i) => i.id)).toEqual(["move-style", "move-mode", "turn-mode", "move-hand", "move-fade"]);
      expect(moving()[0]!.label).toBe("In a headset: casual");
      controls.run("move-style");
      await new Promise((r) => setTimeout(r, 0));
      expect(moving()[0]!.label).toBe("In a headset: intense");
      expect(ask([left([0, 1]), right()])).toMatchObject({ intense: true, fade: false });
      expect(JSON.parse(kept.get("nswp:comfort")!)).toMatchObject({ move: "smooth", turn: "smooth" });
    } finally {
      delete (globalThis.navigator as { xr?: unknown }).xr;
    }
  });
});

describe("the numbers a headset needs, beside the others", () => {
  it("are the kit's own: the fade, how far a step reaches, how far a step back goes", async () => {
    const { kit } = await import("../src/engine-menu.js");
    const k = JSON.parse(kit()) as Record<string, number>;
    expect([k.fadeSeconds, k.stepReach, k.backStep]).toEqual([FADE_S, STEP_REACH, BACK_STEP]);
    expect([FADE_S, STEP_REACH, BACK_STEP]).toEqual([0.12, 5, 1]);
    // The reference worlds step no further in a headset than the kit says an engine's world may.
    expect(readFileSync(join(root, "sites", "shared", "world.ts"), "utf8")).toMatch(new RegExp(`const STEP_MAX = ${STEP_REACH};`));
    // And a Three.js world's fade is the same one.
    expect(readFileSync(join(root, "packages", "sdk", "src", "input.ts"), "utf8")).toMatch(/dark \+ dt \/ FADE_S/);
  });

  it("ask which way they would like to move only once an engine shows it draws the console, and once", () => {
    const controls = createControls({ title: "The Foundry" });
    const shown: string[] = [];
    controls.onSignal((name) => void (name.startsWith("show:") && shown.push(name)));
    meetHands(controls);
    // A session starts in a world whose engine draws no console: nobody is asked where nobody could answer.
    handsPresenting(true);
    expect(shown).toEqual([]);
    // The engine draws the console (engine-console.ts calls this as it is first asked for it in a session).
    askHowTheyMove();
    expect(shown).toEqual(["show:how-you-move"]);
    askHowTheyMove();
    expect(shown).toHaveLength(1);
    // Answered, it is kept, and never asked again: not in the next session, nor by the next world's controls.
    controls.run("how-intense");
    return Promise.resolve().then(() => Promise.resolve()).then(() => {
      handsPresenting(false);
      handsPresenting(true);
      askHowTheyMove();
      const next = createControls({ title: "The next world" });
      next.onSignal((name) => void (name.startsWith("show:") && shown.push(name)));
      meetHands(next);
      askHowTheyMove();
      expect(shown).toHaveLength(1);
    });
  });

  it("come with a new version of the script, since an engine can see them", async () => {
    const engine = await import("../src/engine.js");
    expect([engine.VERSION, typeof engine.hands]).toEqual([20, "function"]);
  });
});
