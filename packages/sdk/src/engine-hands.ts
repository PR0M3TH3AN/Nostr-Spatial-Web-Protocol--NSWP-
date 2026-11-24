/**
 * What the hands mean in a headset, for a world made with another engine.
 *
 * An engine reads its own controllers. What a stick, a trigger and a button mean is not the engine's to decide: it
 * is the kit's (actions.ts, `Locomotion`), the same in every world, by the visitor's own settings (casual or
 * intense, the turn, which hand moves them, narrowing, the fade). So an engine hands what it read to `hands()` each
 * frame of a headset session, and does what comes back: turn by so much, walk so far, show where a step would
 * land, step, darken the edge. Nothing here draws or touches a headset.
 *
 *   // each frame of a session:
 *   const intent = JSON.parse(NSWP.hands(JSON.stringify({ dt, pads: [{ index: 0, hand: "left", stick: [x, y], trigger, squeeze, primary, secondary, press }, ...] })));
 *   // intent.turn (degrees, positive to the left), intent.walk ([right, ahead] in metres, as the head faces),
 *   // intent.aiming / intent.stepFrom (which hands are choosing where to step, and which let go),
 *   // intent.menu, intent.summon, intent.jump, intent.narrow (0 to 1), intent.fade, intent.mayStep, intent.stepping
 *
 * A stick is `[x, y]`, x to the right and y forward, each -1 to 1, as it was read: the dead middle is taken out
 * here. `stepped`, in the next call, says how many metres a step that was just made covered, so that the next is
 * paced as in every world: no sooner than someone running would have covered the same ground.
 */
import { BACK_STEP, deadzone, isIntense, Locomotion, type Comfort, type Handedness, type HeldPad, type Intent } from "./actions.js";
import { keepComfort, type ComfortKeeper } from "./comfort-controls.js";
import { createStepPace, type StepPace } from "./stroll.js";
import type { Controls } from "./ui/model.js";

let keeper: ComfortKeeper | null = null;
let loco = new Locomotion();
let pace: StepPace = createStepPace();
let inSession = false;

/**
 * Keep how the visitor moves in a headset, with the rows in Moving that change it, for this world's controls. Called
 * once, as the engine script makes its menu. Without it `hands()` still answers, by what was kept and carried.
 */
export function meetHands(controls: Controls | undefined, arrivedIntense = false): void {
  keeper?.dispose();
  starts.clear();
  // The one question ("casual or intense?") is asked in the headset's console, the first time they are in a headset.
  // So it is asked once an engine shows that it draws the console (`askHowTheyMove`, called from engine-console.ts),
  // and never by a world whose engine draws none: there it would be asked where nobody could answer. Such a
  // visitor moves the casual way unless they chose otherwise, here or where they came from.
  keeper = keepComfort({
    ...(controls ? { controls } : {}),
    ...(arrivedIntense ? { arrivedIntense: true } : {}),
    presenting: () => inSession,
    onSessionStart: (fn) => {
      starts.add(fn);
      return () => void starts.delete(fn);
    },
  });
}

/** What asks the one question, once a console is there to ask it in. */
const starts = new Set<() => void>();
/** The engine draws the console, and a headset session is running: ask how they would like to move, if never asked. */
export function askHowTheyMove(): void {
  for (const fn of [...starts]) fn();
}

/** The engine said whether a headset session is running (`NSWP.headset`). */
export function handsPresenting(on: boolean): void {
  if (on === inSession) return;
  inSession = on;
  // Nothing held over from the last session: a stick that was forward then steps nobody now.
  loco = new Locomotion();
}

const num = (v: unknown, least: number, most: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(most, Math.max(least, v)) : 0);

/** One controller as an engine read it, made safe: at most two, each in its own slot. */
function readPads(input: unknown): HeldPad[] {
  const out: HeldPad[] = [];
  for (const raw of Array.isArray(input) ? input.slice(0, 4) : []) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const index = p.index === 0 || p.index === 1 ? p.index : null;
    if (index === null || out.some((x) => x.index === index)) continue;
    const hand: Handedness = p.hand === "left" || p.hand === "right" ? p.hand : "none";
    const at = Array.isArray(p.stick) ? p.stick : [];
    const stick = deadzone(num(at[0], -1, 1), num(at[1], -1, 1));
    out.push({ index, hand, pad: { stick, from: "thumbstick", trigger: num(p.trigger, 0, 1), squeeze: num(p.squeeze, 0, 1), primary: p.primary === true, secondary: p.secondary === true, press: p.press === true } });
  }
  return out;
}

/** What `hands()` answers with: the kit's `Intent`, and what an engine needs beside it to do the same as every world. */
export interface HandsAnswer extends Intent {
  /** Whether a jump the kit makes (a step, a step back) fades to black and back for this visitor. */
  fade: boolean;
  /** Whether a step may be taken now: false while the last one is still being paid for. The ring is dim until then. */
  mayStep: boolean;
  /** Whether they move the intense way: walking and turning smoothly. */
  intense: boolean;
  /**
   * Whether they move in steps. Then what `walk` says is one step, landing at once (a step back): a jump, faded for
   * someone who fades. Otherwise `walk` is how far to walk this frame, and is never faded.
   */
  stepping: boolean;
}

/**
 * What the hands mean this frame, as JSON, from JSON: `dt` (seconds since the last frame), `pads` (each controller
 * as the engine read it), and `stepped` (metres, where a step was just made). See the head of this file.
 */
export function hands(input: string): string {
  let o: Record<string, unknown> = {};
  try {
    const v: unknown = JSON.parse(input);
    if (v && typeof v === "object" && !Array.isArray(v)) o = v as Record<string, unknown>;
  } catch {
    /* nothing read: nothing is meant */
  }
  const comfort: Comfort = (keeper ??= keepComfort({ presenting: () => inSession })).comfort;
  // A step the engine just made is paid for, so the next is paced.
  const stepped = num(o.stepped, 0, 100);
  if (stepped > 0) pace.take(stepped);
  const intent = loco.frame(num(o.dt, 0, 0.25), readPads(o.pads), comfort);
  // Stepping, what is walked is one step backwards, landing at once: paced like any other step.
  if (comfort.move === "steps" && (intent.walk[0] !== 0 || intent.walk[1] !== 0) && !pace.take(Math.hypot(intent.walk[0], intent.walk[1]))) intent.walk = [0, 0];
  const answer: HandsAnswer = { ...intent, fade: comfort.fade, mayStep: pace.ready, intense: isIntense(comfort), stepping: comfort.move === "steps" };
  return JSON.stringify(answer);
}

/** For tests: forget everything, and tell the time by this. */
export function resetHands(now?: () => number): void {
  keeper?.dispose();
  keeper = null;
  loco = new Locomotion();
  pace = createStepPace(now ? { now } : {});
  inSession = false;
}

export { BACK_STEP };
