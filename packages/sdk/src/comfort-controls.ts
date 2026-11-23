/**
 * How a visitor moves in a headset: what they chose, kept in this browser and carried from world to world, and the
 * rows in Moving that change it. Casual or intense, the turn, which hand moves them, narrowing, the fade; and the
 * one question, asked the first time they are in a headset with no choice said or kept.
 *
 * It draws nothing and touches no headset, so that every world has the same rows and the same choices whatever it
 * is made with: a Three.js world's hands (input.ts) and the engine script (engine-hands.ts) both keep it here.
 * Moved out of input.ts word for word, with the two things it asked of the renderer (whether a session is running,
 * and to be told when one starts) handed in.
 */
import { cleanComfort, hasComfort, loadComfort, saveComfort, CASUAL_COMFORT, INTENSE_COMFORT, isIntense, type Comfort } from "./actions.js";
import { mayAskHowTheyMove } from "./ask-once.js";
import { arrivedSettings, reportSettings } from "./settings.js";
import type { Controls } from "./ui/model.js";

/** The words of the question asked once, the first time a visitor is in a headset with no choice said or kept. */
export const MOVE_QUESTION = {
  casual: "Casual: point to step, turn in notches",
  intense: "Intense: walk and turn smoothly with the sticks",
} as const;

export interface ComfortOptions {
  /** The world's controls: the rows in Moving are added to them, and the one question. Left out, there are no rows. */
  controls?: Controls;
  /** They were moving the intense way in a headset where they came from (their own client says so). */
  arrivedIntense?: boolean;
  /** Whether a headset session is running now. */
  presenting(): boolean;
  /** Be told when a headset session starts. Returns how to stop. */
  onSessionStart?(fn: () => void): () => void;
}

export interface ComfortKeeper {
  /** How they move, as it is now. */
  readonly comfort: Comfort;
  /** Change it. `keep` remembers it as their own choice, for this site and the next. */
  setComfort(patch: Partial<Comfort>, keep?: boolean): void;
  dispose(): void;
}

export function keepComfort(o: ComfortOptions): ComfortKeeper {
  // How they had their hands set where they came from, in place of what this site remembered (settings.ts).
  const came = arrivedSettings();
  // Whether they have said how they move in a headset: in their settings as they arrived, kept on this site, or
  // moving the intense way where they came from. Until then nothing is said about it to the next place, and the
  // first time they are in a headset here they are asked (the owner, 2026-11-21).
  let answered = came.headset !== undefined || hasComfort() || o.arrivedIntense === true;
  let comfort: Comfort = { ...loadComfort(), ...(came.headset === "intense" ? INTENSE_COMFORT : came.headset === "casual" ? CASUAL_COMFORT : {}), ...(came.turn !== undefined ? { turnStep: came.turn } : {}), ...(came.hand !== undefined ? { moveHand: came.hand } : {}), ...(came.narrow !== undefined ? { narrow: came.narrow } : {}), ...(came.fade !== undefined ? { fade: came.fade } : {}) };
  if (came.turn !== undefined || came.hand !== undefined || came.narrow !== undefined || came.fade !== undefined || came.headset !== undefined) saveComfort(comfort);
  reportSettings("hands", () => ({ turn: comfort.turnStep, hand: comfort.moveHand, narrow: comfort.narrow, fade: comfort.fade, ...(answered ? { headset: isIntense(comfort) ? ("intense" as const) : ("casual" as const) } : {}) }), (now) => {
    // Their client's menu changed how they move in a headset (settings.ts, `changeSettings`).
    const patch: Partial<Comfort> = { ...(now.headset === "intense" ? INTENSE_COMFORT : now.headset === "casual" ? CASUAL_COMFORT : {}), ...(now.turn !== undefined ? { turnStep: now.turn } : {}), ...(now.hand !== undefined ? { moveHand: now.hand } : {}), ...(now.narrow !== undefined ? { narrow: now.narrow } : {}), ...(now.fade !== undefined ? { fade: now.fade } : {}) };
    if (now.headset !== undefined) answered = true;
    if (Object.keys(patch).length) setComfort(patch, true);
  });
  /** What to undo when this is put away. */
  const stops: (() => void)[] = [];

  const setComfort = (patch: Partial<Comfort>, keep = false) => {
    comfort = { ...comfort, ...cleanComfort(patch) };
    if (keep) {
      saveComfort(comfort);
      // Their own hand on a control is a choice: from now on it goes with them.
      answered = true;
    }
  };
  // They were moving the intense way in a headset where they came from: the same here, kept as their choice.
  if (o.arrivedIntense && !isIntense(comfort)) setComfort(INTENSE_COMFORT, true);
  if (o.controls) {
    const controls = o.controls;
    let headset = false;
    void navigator.xr
      ?.isSessionSupported("immersive-vr")
      .then((ok) => {
        headset = ok;
        controls.addSection({ id: "moving", label: "Moving", icon: "step", note });
      })
      .catch(() => {});
    const hidden = () => !headset;
    const note = () =>
      comfort.move === "steps"
        ? "With a controller: push a stick forward, point at the floor and let go to step there. Flick the other stick to turn. Squeeze the grip to pick things up. Pointing and selecting does everything too."
        : "With a controller: one stick walks, the other turns. If it makes you feel unwell, go back to stepping: it is the comfortable way.";
    controls.addSection({ id: "moving", label: "Moving", icon: "step", note });
    const change = (patch: Partial<Comfort>) => {
      setComfort(patch, true);
      controls.addSection({ id: "moving", label: "Moving", icon: "step", note });
    };
    controls.add(
      {
        // One switch for the two ways of moving in a headset. The settings under it are what it sets, and can
        // each be changed afterwards.
        id: "move-style",
        section: "moving",
        icon: "motion",
        hidden,
        on: () => isIntense(comfort),
        label: () => `${o.presenting() ? "How you move" : "In a headset"}: ${isIntense(comfort) ? "intense" : "casual"}`,
        short: "Style",
        act: () => {
          const intense = !isIntense(comfort);
          change(intense ? INTENSE_COMFORT : CASUAL_COMFORT);
          controls.say(
            intense
              ? "Intense: one stick walks, the other turns, smoothly, with the whole view. If it makes you feel unwell, go back to casual."
              : "Casual: point at the floor to step there, and turn a notch at a time. The comfortable way.",
          );
        },
      },
      { id: "move-mode", section: "moving", icon: "step", hidden, on: () => comfort.move === "smooth", label: () => (comfort.move === "steps" ? "Moving in steps. Walk smoothly instead" : "Walking smoothly. Move in steps instead"), short: "Walk", act: () => change({ move: comfort.move === "steps" ? "smooth" : "steps" }) },
      {
        id: "turn-mode",
        section: "moving",
        icon: "turn",
        hidden,
        on: () => comfort.turn === "smooth",
        label: () => (comfort.turn === "smooth" ? "Turning smoothly. Turn in steps instead" : `Turning ${comfort.turnStep}° at a time. Change`),
        short: "Turn",
        // In steps of 30, then 45, then 90, then smoothly, and round again.
        act: () => change(comfort.turn === "smooth" ? { turn: "steps", turnStep: 30 } : comfort.turnStep === 30 ? { turnStep: 45 } : comfort.turnStep === 45 ? { turnStep: 90 } : { turn: "smooth" }),
      },
      { id: "move-hand", section: "moving", icon: "motion", hidden, label: () => `The ${comfort.moveHand} stick moves you. Swap hands`, short: "Hands", act: () => change({ moveHand: comfort.moveHand === "left" ? "right" : "left" }) },
      {
        id: "move-narrow",
        section: "moving",
        icon: "look",
        hidden: () => hidden() || (comfort.move === "steps" && comfort.turn === "steps"),
        on: () => comfort.narrow,
        label: () => (comfort.narrow ? "The view narrows while you move. Turn that off" : "Narrow the view while you move"),
        short: "Narrow",
        act: () => change({ narrow: !comfort.narrow }),
      },
      {
        // A jump the kit makes (a step, being stepped aside) fades to black and back: casual's default, intense's not.
        id: "move-fade",
        section: "moving",
        icon: "look",
        hidden,
        on: () => comfort.fade,
        label: () => (comfort.fade ? "The view fades when you step. Turn that off" : "Fade the view when you step"),
        short: "Fade",
        act: () => change({ fade: !comfort.fade }),
      },
    );
    // The first time they are in a headset here, with no choice said or kept: asked once, in the headset, and
    // remembered. Put away without an answer, it is casual, and not asked again. (The owner, 2026-11-21: "the
    // first time they enter VR ... ask if they prefer casual or intense mode".)
    let asking = false;
    const answer = (intense: boolean) => {
      asking = false;
      setComfort(intense ? INTENSE_COMFORT : CASUAL_COMFORT, true);
      controls.say(intense ? "Intense: one stick walks, the other turns, smoothly. You can change it in Moving." : "Casual: point at the floor to step there, and turn a notch at a time. You can change it in Moving.");
    };
    controls.addSection({ id: "how-you-move", label: "How you move", icon: "step", note: () => (asking ? "You can change this whenever you like, in Moving." : "") });
    controls.add(
      { id: "how-casual", section: "how-you-move", icon: "step", hidden: () => !asking, label: MOVE_QUESTION.casual, act: () => answer(false) },
      { id: "how-intense", section: "how-you-move", icon: "motion", hidden: () => !asking, label: MOVE_QUESTION.intense, act: () => answer(true) },
    );
    // Put away without an answer is casual: the console closed while they are in the headset, after it came up
    // with the question. Not the flat menu closing as the session starts, which is no answer of theirs.
    let askedAt = 0;
    const stopAsking = controls.onSignal((name) => {
      if (name === "menuClose" && asking && o.presenting() && performance.now() - askedAt > 1500) answer(false);
    });
    const ask = () => {
      if (answered || asking || !mayAskHowTheyMove()) return;
      asking = true;
      askedAt = performance.now();
      controls.signal("show:how-you-move");
    };
    const stopStart = o.onSessionStart?.(ask);
    stops.push(() => {
      stopStart?.();
      stopAsking();
    });
  }

  return {
    get comfort() {
      return comfort;
    },
    setComfort,
    dispose() {
      for (const stop of stops.splice(0)) stop();
    },
  };
}
