/**
 * Jumping: the same hop in every world, however the visitor is moving.
 *
 * A jump is a small thing, about knee height and over in under a second. It
 * changes nothing about where a visitor may stand: the floor is where it
 * was, and they come down on it. It is there because a body in a place wants
 * to be able to, and because a world may build on it.
 *
 * However it is asked for, it is this one jump:
 *
 * - Space at a desk, moving the casual way or the intense way.
 * - The Jump control, which sits with the controls always at hand where
 *   there is no keyboard.
 * - The lower face button (A or X) in a headset.
 *
 *   const jump = addJump(controls, { presenting: () => renderer.xr.isPresenting, sounds, hud });
 *   // every frame:
 *   rig.position.y = floorY + jump.update(dt);
 *   if (!jump.airborne) sounds.moved(metresWalked);
 */
import { hasMouse } from "./fps.js";
import type { Controls } from "./ui/model.js";

/** How high a jump lifts a visitor, in metres. */
export const JUMP_HEIGHT = 0.45;
/** How hard they are pulled back down, in metres a second, each second. */
export const JUMP_GRAVITY = 9.8;
/** How fast they leave the floor, in metres a second: what reaches that height against that pull. */
export const JUMP_SPEED = Math.sqrt(2 * JUMP_GRAVITY * JUMP_HEIGHT);

export interface Jump {
  /** Leave the floor. Returns false, and does nothing, if they are already in the air. */
  jump(): boolean;
  /** Call every frame with the seconds since the last. Returns how far above the floor they are now, in metres. */
  update(dt: number): number;
  /** How far above the floor they are. */
  readonly height: number;
  readonly airborne: boolean;
  /** Put them back on the floor at once: a door was taken, a headset session began or ended. */
  land(): void;
  dispose(): void;
}

/** The jump itself, with nothing that asks for it. */
export function createJump(o: { onJump?(): void; onLand?(): void } = {}): Jump {
  let height = 0;
  /** Seconds since they left the floor. */
  let since = 0;
  let airborne = false;
  return {
    jump() {
      if (airborne) return false;
      airborne = true;
      since = 0;
      o.onJump?.();
      return true;
    },
    update(dt) {
      if (!airborne) return 0;
      // Worked out from how long they have been in the air, so a jump takes the same time at any frame rate.
      // A very long frame (a tab that was away) counts for a quarter of a second and no more.
      since += Math.min(Math.max(dt, 0), 0.25);
      height = JUMP_SPEED * since - 0.5 * JUMP_GRAVITY * since * since;
      if (height <= 0) {
        height = 0;
        airborne = false;
        o.onLand?.();
      }
      return height;
    },
    get height() {
      return height;
    },
    get airborne() {
      return airborne;
    },
    land() {
      height = 0;
      airborne = false;
    },
    dispose() {},
  };
}

export interface AddJumpOptions {
  /** In a headset, the page's keys and its control stand down: the controller's button asks instead. */
  presenting(): boolean;
  /** Something to make it heard: leaving the floor is a step, and coming down is a landing. */
  sounds?: { play(cue: "step" | "land"): void } | null;
  /** The menu, so that Space works it while it is open and doesn't jump. */
  hud?: { readonly open: boolean } | null;
  /** Return true while the keys belong to something else: a keyboard on screen, a game of the world's own. */
  busy?(): boolean;
}

/**
 * A jump, with the two ways of asking for it that a page has: Space, and a
 * control in the menu's Moving section. Where there is no keyboard, the
 * control is with the ones always at hand. A headset's button is the input
 * layer's (`createXrInput({ onJump: () => jump.jump() })`).
 */
export function addJump(controls: Controls, o: AddJumpOptions): Jump {
  const jump = createJump({ onJump: () => o.sounds?.play("step"), onLand: () => o.sounds?.play("land") });
  const typing = (e: KeyboardEvent) => {
    const t = (e.composedPath?.()[0] ?? e.target) as HTMLElement | null;
    return !!t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
  };
  // A world that has claimed every key for itself (`controls.claimInput`) has claimed this one too.
  const claimed = () => {
    const keys = controls.view().keys;
    return keys.menu === null && !keys.hotbar;
  };
  const ours = (e: KeyboardEvent) => e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e) && !o.hud?.open && !o.presenting() && !o.busy?.() && !claimed();
  const onKey = (e: KeyboardEvent) => {
    if (!ours(e)) return;
    // Space also presses whatever button was last used, and scrolls a page. Here it is a jump and nothing else.
    e.preventDefault();
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && (active.tagName === "BUTTON" || active.shadowRoot)) active.blur();
    if (!e.repeat) jump.jump();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (ours(e)) e.preventDefault();
  };
  addEventListener("keydown", onKey);
  addEventListener("keyup", onKeyUp);
  controls.add({
    id: "jump",
    section: "moving",
    icon: "step",
    label: "Jump",
    short: "Jump",
    // With a keyboard it is Space. Without one, it is kept at hand.
    hotbar: !hasMouse(),
    hidden: () => o.presenting(),
    act: () => void jump.jump(),
  });
  const dispose = jump.dispose;
  jump.dispose = () => {
    dispose();
    removeEventListener("keydown", onKey);
    removeEventListener("keyup", onKeyUp);
    controls.remove("jump");
  };
  return jump;
}
