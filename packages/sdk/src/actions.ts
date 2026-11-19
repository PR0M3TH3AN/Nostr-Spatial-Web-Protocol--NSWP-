/**
 * What a visitor means by what their hands are doing.
 *
 * A world shouldn't know whether someone holds Quest, Pico, Index or Vive
 * controllers. WebXR already gives every tracked controller the same layout
 * (the "xr-standard" gamepad mapping), so this file reads that layout into a
 * few plain facts, and turns those facts into intent: turn, walk, step, open
 * the menu. Nothing here touches a headset or draws anything, so it is tested
 * like arithmetic.
 *
 * None of it is required to get around. Everything a visitor must be able to
 * do is done by pointing and selecting (protocol/09-what-a-world-owes.md).
 * Sticks, grips and buttons are a faster way for people who have them.
 */

export interface PadButton {
  pressed: boolean;
  touched?: boolean;
  value: number;
}

/** The part of a Gamepad this reads. */
export interface PadLike {
  mapping?: string;
  axes: readonly number[];
  buttons: readonly (PadButton | undefined)[];
}

export interface PadState {
  /** Where the thumb is: x to the right, y forward, each -1 to 1, with a dead middle. */
  stick: [number, number];
  /** What the thumb is on. A touchpad counts only while it is pressed, so a resting thumb does nothing. */
  from: "thumbstick" | "touchpad" | "none";
  /** The trigger under the first finger, 0 to 1. */
  trigger: number;
  /** The grip under the other fingers, 0 to 1. */
  squeeze: number;
  /** The lower button under the thumb: A or X. */
  primary: boolean;
  /** The upper one: B or Y. */
  secondary: boolean;
}

export const NO_PAD: PadState = { stick: [0, 0], from: "none", trigger: 0, squeeze: 0, primary: false, secondary: false };

/** A stick near its middle reads as still, and the rest of its travel is stretched to fill the range. */
export function deadzone(x: number, y: number, inner = 0.2): [number, number] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];
  const far = Math.hypot(x, y);
  if (far <= inner) return [0, 0];
  const scale = Math.min(1, (far - inner) / (1 - inner)) / far;
  return [x * scale, y * scale];
}

/**
 * Read a controller. The "xr-standard" layout puts the trigger at button 0,
 * the grip at 1, a touchpad's click at 2, a thumbstick's click at 3, then the
 * thumb's two buttons; and a touchpad's position in axes 0 and 1, a
 * thumbstick's in 2 and 3. A controller that lacks a part reports nothing
 * there, so reading by position works on all of them.
 */
export function readPad(pad: PadLike | null | undefined): PadState {
  if (!pad) return NO_PAD;
  const button = (i: number) => pad.buttons[i];
  const value = (i: number) => {
    const b = button(i);
    if (!b) return 0;
    // How far it is pulled, where the controller says; pressed or not, where it doesn't.
    return b.value > 0 ? Math.min(1, b.value) : b.pressed ? 1 : 0;
  };
  const axis = (i: number) => (Number.isFinite(pad.axes[i]) ? pad.axes[i]! : 0);
  // Up on a stick is negative in the Gamepad API; here forward is positive.
  const hasStick = pad.axes.length >= 4;
  const hasTouchpad = !!button(2);
  let stick: [number, number] = [0, 0];
  let from: PadState["from"] = "none";
  if (hasStick) {
    stick = deadzone(axis(2), -axis(3));
    from = "thumbstick";
  } else if (pad.axes.length >= 2 && !hasTouchpad) {
    // Two axes and nothing to click: a plain stick, reported the old way.
    stick = deadzone(axis(0), -axis(1));
    from = "thumbstick";
  }
  if (stick[0] === 0 && stick[1] === 0 && hasTouchpad) {
    // A touchpad stands in for a stick, but only while it is clicked. One that isn't is at rest.
    const touch = deadzone(axis(0), -axis(1), 0.3);
    if (button(2)!.pressed && (touch[0] !== 0 || touch[1] !== 0)) {
      stick = touch;
      from = "touchpad";
    } else if (!hasStick) from = "touchpad";
  }
  return { stick, from, trigger: value(0), squeeze: value(1), primary: !!button(4)?.pressed, secondary: !!button(5)?.pressed };
}

// ------------------------------------------------------------------- comfort

/** How a visitor likes to move. Theirs to choose, kept in this browser for this site. */
export interface Comfort {
  /** Pushing a stick forward: step to where you point when you let go, or walk smoothly. */
  move: "steps" | "smooth";
  /** Pushing a stick sideways: turn by a fixed amount at once, or turn smoothly. */
  turn: "steps" | "smooth";
  /** How far one turn goes, in degrees. */
  turnStep: 30 | 45 | 90;
  /** Darken the edge of the view while moving smoothly. It is what stops most people feeling ill. */
  narrow: boolean;
  /** Which hand's stick moves you. The other turns you. */
  moveHand: "left" | "right";
}

/**
 * The defaults are the comfortable ones: nothing slides. Smooth movement is
 * there for people who know they want it.
 */
export const DEFAULT_COMFORT: Comfort = { move: "steps", turn: "steps", turnStep: 30, narrow: true, moveHand: "left" };

/**
 * Two ways of moving, by name, so that one switch can choose between them.
 * Casual is the comfortable one and the default: nothing slides. Intense is
 * what people who play games expect: walking and turning smoothly, with the
 * whole view. Each setting can still be changed by itself afterwards.
 */
export const CASUAL_COMFORT: Partial<Comfort> = { move: "steps", turn: "steps", narrow: true };
export const INTENSE_COMFORT: Partial<Comfort> = { move: "smooth", turn: "smooth", narrow: false };
/** Whether a visitor's settings amount to the intense way: they walk and turn smoothly. */
export const isIntense = (comfort: Comfort): boolean => comfort.move === "smooth" && comfort.turn === "smooth";

/** Keep only values that are what they claim to be: this is read back from storage. */
export function cleanComfort(input: unknown): Partial<Comfort> {
  const out: Partial<Comfort> = {};
  if (!input || typeof input !== "object") return out;
  const c = input as Record<string, unknown>;
  if (c.move === "steps" || c.move === "smooth") out.move = c.move;
  if (c.turn === "steps" || c.turn === "smooth") out.turn = c.turn;
  if (c.turnStep === 30 || c.turnStep === 45 || c.turnStep === 90) out.turnStep = c.turnStep;
  if (typeof c.narrow === "boolean") out.narrow = c.narrow;
  if (c.moveHand === "left" || c.moveHand === "right") out.moveHand = c.moveHand;
  return out;
}

const KEY = "nswp:comfort";

export function loadComfort(): Comfort {
  try {
    return { ...DEFAULT_COMFORT, ...cleanComfort(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "{}")) };
  } catch {
    return { ...DEFAULT_COMFORT };
  }
}

export function saveComfort(comfort: Comfort): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(cleanComfort(comfort)));
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
}

// -------------------------------------------------------------------- intent

export type Handedness = "left" | "right" | "none";

export interface HeldPad {
  /** Which of the two input slots it is in. */
  index: number;
  hand: Handedness;
  pad: PadState;
}

export interface Intent {
  /** Turn by this many degrees now. Positive is to the left, as angles go. */
  turn: number;
  /** Walk this far now, in metres: x to the visitor's right, z ahead of them. */
  walk: [number, number];
  /** Slots whose stick was pushed forward and has been let go: step to where each points. */
  stepFrom: number[];
  /** Slots whose stick is held forward now: they are choosing where to step. */
  aiming: number[];
  /** The menu button went down. */
  menu: boolean;
  /** 0 to 1: how much of the view's edge to darken. */
  narrow: number;
}

/** Metres a second, walking smoothly. A brisk walk: faster reads as sliding. */
export const WALK_SPEED = 1.8;
/** Degrees a second, turning smoothly. */
export const TURN_SPEED = 110;
/** One stick pulled back, in step mode: a step backwards of this many metres. */
export const BACK_STEP = 1;

const PUSH = 0.6; // how far a stick must go to count as pushed
const LET_GO = 0.3; // and how far back before it counts as let go

/** What each stick is for. With two, one moves and one turns; one alone does both. */
export function stickRoles(pads: HeldPad[], moveHand: Comfort["moveHand"]): Map<number, "move" | "turn" | "both"> {
  const sticks = pads.filter((p) => p.pad.from !== "none");
  const roles = new Map<number, "move" | "turn" | "both">();
  if (sticks.length === 1) roles.set(sticks[0]!.index, "both");
  else if (sticks.length >= 2) {
    const mover = sticks.find((p) => p.hand === moveHand) ?? sticks[0]!;
    for (const p of sticks) roles.set(p.index, p === mover ? "move" : "turn");
  }
  return roles;
}

/**
 * Turns what the hands are doing into what the visitor means, a frame at a
 * time. It remembers only what it must: which sticks are pushed, so a held
 * stick turns once and a pushed-forward stick steps once.
 */
export class Locomotion {
  private readonly turned = new Set<number>();
  private readonly forward = new Set<number>();
  private readonly backward = new Set<number>();
  private menuDown = false;

  frame(dt: number, pads: HeldPad[], comfort: Comfort): Intent {
    const intent: Intent = { turn: 0, walk: [0, 0], stepFrom: [], aiming: [], menu: false, narrow: 0 };
    const roles = stickRoles(pads, comfort.moveHand);
    const seen = new Set<number>();
    let sliding = false;
    for (const p of pads) {
      seen.add(p.index);
      const role = roles.get(p.index);
      if (!role) continue;
      const [x, y] = p.pad.stick;

      // Sideways turns, on the turning stick, or on the only stick there is.
      if (role !== "move") {
        if (comfort.turn === "smooth") {
          if (x !== 0) {
            intent.turn -= x * TURN_SPEED * dt;
            sliding = true;
          }
        } else if (Math.abs(x) >= PUSH && Math.abs(x) > Math.abs(y)) {
          if (!this.turned.has(p.index)) {
            this.turned.add(p.index);
            intent.turn += x > 0 ? -comfort.turnStep : comfort.turnStep;
          }
        } else if (Math.abs(x) < LET_GO) this.turned.delete(p.index);
      }

      // Forward and back. Walking smoothly belongs to the moving stick; stepping works from either.
      if (comfort.move === "smooth" && role !== "turn") {
        const strafe = role === "both" ? 0 : x;
        if (strafe !== 0 || y !== 0) {
          // Never faster on a diagonal than straight ahead.
          const pace = (WALK_SPEED * dt) / Math.max(1, Math.hypot(strafe, y));
          intent.walk[0] += strafe * pace;
          intent.walk[1] += y * pace;
          sliding = true;
        }
      } else if (comfort.move === "steps") {
        if (y >= PUSH && Math.abs(y) >= Math.abs(x)) this.forward.add(p.index);
        else if (y < LET_GO && this.forward.delete(p.index)) intent.stepFrom.push(p.index);
        if (this.forward.has(p.index)) intent.aiming.push(p.index);
        if (y <= -PUSH && Math.abs(y) > Math.abs(x)) {
          if (!this.backward.has(p.index)) {
            this.backward.add(p.index);
            intent.walk[1] -= BACK_STEP;
          }
        } else if (y > -LET_GO) this.backward.delete(p.index);
      }
    }
    // A controller that went away takes its held stick with it: nothing fires when it comes back.
    for (const set of [this.turned, this.forward, this.backward]) for (const i of set) if (!seen.has(i) || !roles.has(i)) set.delete(i);

    const menu = pads.some((p) => p.pad.secondary);
    intent.menu = menu && !this.menuDown;
    this.menuDown = menu;
    intent.narrow = sliding && comfort.narrow ? 1 : 0;
    return intent;
  }
}
