/**
 * "Achievements", in a world's menu: what the world marks, which of it the visitor has earned, and the way to
 * show it (protocol/16-achievements.md).
 *
 * A world adds this itself, for the achievements it names. A world that has none has no such tab.
 *
 * The same on a phone, at a desk and on a headset's wrist. What is shown of anyone is a claim, and it says so.
 */
import type { AchievementHolders } from "@nswp/core";
import type { Achievements } from "./achievements.js";
import type { Controls, UiAction } from "./ui/model.js";
import { signInHere } from "./ui/sign-in-here.js";

export interface AchievingOptions {
  achievements: Achievements;
  /** Whether the visitor is signed in here. */
  signedIn(): boolean;
}

export interface Achieving {
  refresh(): void;
}

export function addAchievementControls(controls: Controls, opts: AchievingOptions): Achieving {
  const a = opts.achievements;
  let shown: string[] = [];
  let holders: Map<string, AchievementHolders> | null | undefined;
  let looking = false;
  const look = (fresh = false) => {
    if (looking) return;
    looking = true;
    void a
      .holders(fresh)
      .catch(() => null)
      .then((got) => {
        looking = false;
        holders = got;
        refresh();
      });
  };

  const refresh = () => {
    for (const id of shown) controls.remove(id);
    shown = [];
    if (a.list.length === 0) return;
    const add = (...actions: UiAction[]) => {
      for (const x of actions) shown.push(x.id);
      controls.add(...actions.map((x) => ({ section: "achievements", ...x })));
    };
    const earned = a.earned();
    const out = a.shown();
    const waiting = earned.filter((id) => !out.includes(id)).length;
    controls.addSection({
      id: "achievements",
      label: "Achievements",
      icon: "check",
      note: () => `You have earned ${earned.length} of ${a.list.length} here. What you earn is kept on this device until you show it. Showing it says publicly that you were here, and what you did. Nothing checks what anyone shows.`,
    });
    // Its first row says to sign in, while they aren't, to show what they earned: the press is right there.
    if (earned.length > 0 && !opts.signedIn()) add(signInHere(controls, "achievements"));
    add({
      id: "achievements-show",
      icon: "check",
      tone: waiting ? "primary" : "normal",
      label: () =>
        earned.length === 0
          ? "Nothing earned here yet"
          : !opts.signedIn()
            ? `Sign in to show the ${earned.length} you have earned`
            : waiting === 0
              ? `All ${earned.length} you have earned ${earned.length === 1 ? "is" : "are"} shown as yours`
              : `Show the ${waiting} I have earned, as mine (public)`,
      short: "Show",
      act: async () => {
        if (earned.length === 0) return controls.say("Earn one first: it is kept on this device until you show it.");
        const done = await a.show();
        controls.say(done.said);
        look(true);
        refresh();
      },
    });
    if (holders === undefined) look();
    for (const one of a.list) {
      const mine = earned.includes(one.id);
      const h = holders?.get(one.id);
      // One that is hidden isn't named until it is earned.
      const title = one.hidden && !mine ? "Something not yet found" : one.title;
      const about = one.hidden && !mine ? "" : one.about ? `: ${one.about}` : "";
      const others = h ? h.holders - (h.mine ? 1 : 0) : 0;
      const held = others > 0 ? ` Shown by ${others === 1 ? "1 other" : `${others} others`}${h!.known.length ? `, ${h!.known.length} you follow` : ""}.` : "";
      add({
        id: `achievements-${one.id}`,
        icon: mine ? "check" : "step",
        on: () => mine,
        label: `${title}${about}.${held}`.replace(/\.\./g, "."),
        act: () => controls.say(mine ? `You earned "${one.title}"${out.includes(one.id) ? ", and it is shown as yours" : ". It is kept on this device until you show it"}.` : one.hidden ? "Not found yet." : `Not earned yet: ${one.about ?? one.title}.`),
      });
    }
  };

  let drawing = false;
  const soon = () => {
    if (drawing) return;
    drawing = true;
    queueMicrotask(() => {
      drawing = false;
      refresh();
    });
  };
  a.onChange(soon);
  // Said once, as it happens: what they earned, and that it is theirs to show.
  a.onEarn((one) => {
    controls.say(`Achievement: ${one.title}. It is kept on this device. Show it as yours from Achievements, in the menu.`);
    controls.signal("achievement");
  });
  refresh();
  return { refresh };
}
