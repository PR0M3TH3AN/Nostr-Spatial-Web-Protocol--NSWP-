/**
 * The visitor's own switches that stand in tabs a world fills: whether they see people's pictures and people's own
 * models (People), and what people write (Room).
 *
 * Each changes a setting that travels with the visitor (protocol/11-the-visitors-console.md, "Settings that travel"),
 * and the first two guard their privacy. So where a client draws the visitor's menu above a world, these rows are the
 * client's own, drawn by the client inside those tabs, and the world leaves them out of what it describes
 * (protocol/02-doors.md, "The client has the menu"): the client holds the visitor's settings and says them to each
 * world, and a world that changed one itself would leave the client, and so the next world, with the old value.
 * Where a world draws its own menu they are where they have always been: the kit's room controls add these same
 * rows (room-controls.ts).
 *
 * Nothing here draws a model or a picture, so a client's own page can carry it.
 */
import { mayAskHowTheyMove } from "./ask-once.js";
import { DESK_QUESTION, DESK_WORDS, hasMouse, keepIntense, keptIntense, startsIntense } from "./fps.js";
import { setShowsModels, showsModels } from "./models-switch.js";
import { setShowsPictures, showsPictures } from "./picture.js";
import { arrivedSettings, reportSettings } from "./settings.js";
import { setShowsChat, showsChat } from "./ui/chat.js";
import type { Controls, UiAction } from "./ui/model.js";

/**
 * The rows, by id, that are the visitor's own in a tab a world otherwise fills, and so are never in a world's
 * description: the switches here, how wide they see (desk.ts, `fov`, under View), and in Sound the volumes, the
 * hum's switch and the visitor's own music (sound.ts).
 */
export const VISITOR_SWITCHES: readonly string[] = [
  "people-pictures",
  "people-models",
  "room-chat-show",
  "fov",
  // In Sound, which both fill: the volumes, the hum's switch and the visitor's own music are the client's (sound.ts).
  // What is the world's there is the piece it is playing.
  "sound-all",
  "sound-effects",
  "sound-music",
  "sound-voices",
  "sound-hum",
  "juke-add",
  "juke-play",
  "juke-next",
  "juke-remove",
  // In Moving, which both fill: how they move at a desk, how fast they look round, and how they move in a headset
  // (fps.ts, desk.ts, input.ts) are the visitor's, each a setting that travels. What is the world's there is what
  // it does for them: a jump.
  "fps",
  "look-speed",
  "move-style",
  "move-mode",
  "turn-mode",
  "move-hand",
  "move-narrow",
  "move-fade",
];

/** Whether this visitor sees pictures at all. It is theirs, and goes with them from world to world. */
export const picturesSwitch = (controls: Pick<Controls, "say">): UiAction => ({
    id: "people-pictures",
    section: "people",
    icon: "selfie",
    on: () => showsPictures(),
    label: () => (showsPictures() ? "Profile pictures: on" : "Profile pictures: off"),
    short: "Pictures",
    act: () => {
      setShowsPictures(!showsPictures());
      controls.say(showsPictures() ? "People's own pictures are shown over their names. Each is fetched from wherever its owner keeps it, which tells that place your address." : "No pictures are fetched or shown, here or in the next world.");
    },
  });

/** Whether this visitor sees people's own models, where a world draws them. Theirs, and it travels. */
export const modelsSwitch = (controls: Pick<Controls, "say">): UiAction => ({
    id: "people-models",
    section: "people",
    icon: "people",
    on: () => showsModels(),
    label: () => (showsModels() ? "Show people's own models: on" : "Show people's own models: off"),
    short: "Models",
    act: () => {
      setShowsModels(!showsModels());
      controls.say(showsModels() ? "People who wear a model of their own are drawn as it here, and in the next world that draws them." : "Everyone is drawn as their simple look, here and in the next world.");
    },
  });

/** Whether this visitor sees what people write in a room, and may write. `tell` says the words for a moment. */
export const chatSwitch = (tell: (text: string) => void): UiAction => ({
    id: "room-chat-show",
    section: "room",
    icon: "chat",
    label: () => (showsChat() ? "Written chat: on" : "Written chat: off"),
    on: () => showsChat(),
    act: () => {
      setShowsChat(!showsChat());
      tell(showsChat() ? "What people write in a room is shown to you, and you can write. It goes only to the people in the room, and is kept nowhere." : "Nothing anyone writes is shown to you, here or in the next world, and nobody is told.");
    },
  });

/** The visitor's choice of how they move at a desk, as this page holds it: one for the page, whoever asks or shows it. */
let desk: { intense: boolean; chosen: boolean } | null = null;
const deskChoice = () => {
  if (desk) return desk;
  // Whether they have said how they move at a desk: until they have, nothing is said of it to any world.
  const now = (desk = { intense: startsIntense(false), chosen: typeof arrivedSettings().intense === "boolean" || keptIntense() });
  reportSettings(
    "moving",
    () => (now.chosen ? { intense: now.intense } : {}),
    (said) => {
      if (typeof said.intense !== "boolean") return;
      now.intense = said.intense;
      now.chosen = true;
      keepIntense(now.intense);
    },
  );
  return now;
};
/** For tests: forget the choice, so it is read afresh. */
export function forgetDeskMoving(): void {
  desk = null;
}

/**
 * How they move at a desk, casual or intense, for a page that draws the menu but moves nobody: a client's page,
 * above a world. It holds the visitor's choice here, kept as a world keeps it, and says it with their other
 * settings; the world in the frame takes it at once and moves them that way (fps.ts). The same row, by the same
 * words, as a world draws for itself. Not offered where there is no mouse, or in a headset.
 */
export function deskMovingSwitch(controls: Pick<Controls, "say">, o: { presenting?: () => boolean } = {}): UiAction {
  const choice = deskChoice();
  return {
    id: "fps",
    section: "moving",
    icon: "step",
    on: () => choice.intense,
    hidden: () => !hasMouse() || o.presenting?.() === true,
    label: () => (choice.intense ? DESK_WORDS.intense : DESK_WORDS.casual),
    act: () => {
      choice.intense = !choice.intense;
      choice.chosen = true;
      keepIntense(choice.intense);
      controls.say(choice.intense ? DESK_WORDS.nowIntense : DESK_WORDS.nowCasual);
    },
  };
}

/**
 * The one-time question, "how you move at a desk": casual or intense, asked once and kept (the owner, 2026-11-21:
 * "the first time someone enters the game in 2D desktop mode. Casual or intense."). Whoever draws the console
 * asks. Above a world that is the visitor's client, so this is the question in a form a client's page runs: the
 * same tab, rows and words as a world asks with (fps.ts), with the answer kept here as their travelling setting and
 * said to every world. A world whose client has the menu doesn't ask.
 *
 * Asked a moment after the page is up, the first time a visitor is at a desk with a mouse and has no choice said
 * or kept. Put away without an answer, it is casual, and that is an answer. Never asked on a phone, in a headset
 * (the world draws the console there, and asks its own question), or of a browser driven by a script unless the
 * page's address says `?ask=moving`. Returns how to stop.
 */
export function askDeskMoving(controls: Controls, o: { presenting?: () => boolean; after?: number } = {}): () => void {
  const choice = deskChoice();
  let asking = false;
  const answer = (intense: boolean) => {
    asking = false;
    choice.intense = intense;
    choice.chosen = true;
    keepIntense(intense);
    controls.say(intense ? DESK_WORDS.nowIntense : DESK_WORDS.nowCasual);
    // Told as a change, so that whoever says the visitor's settings onward says this one now.
    controls.setTheme({});
  };
  controls.addSection({ id: "how-you-move-desk", label: "How you move", icon: "step", note: () => (asking ? "You can change this whenever you like, in Moving." : "") });
  controls.add(
    { id: "desk-casual", section: "how-you-move-desk", icon: "step", hidden: () => !asking || o.presenting?.() === true, label: DESK_QUESTION.casual, act: () => answer(false) },
    { id: "desk-intense", section: "how-you-move-desk", icon: "look", hidden: () => !asking || o.presenting?.() === true, label: DESK_QUESTION.intense, act: () => answer(true) },
  );
  const stopSignals = controls.onSignal((name) => {
    if (name === "menuClose" && asking) answer(false);
  });
  let timer: ReturnType<typeof setTimeout> | null = null;
  if (hasMouse() && !choice.chosen && mayAskHowTheyMove()) {
    // A moment after the page is up, so the question isn't the first thing drawn over a place still arriving.
    timer = setTimeout(() => {
      timer = null;
      if (choice.chosen || o.presenting?.() === true) return;
      asking = true;
      controls.signal("show:how-you-move-desk");
    }, o.after ?? 1200);
  }
  return () => {
    if (timer) clearTimeout(timer);
    stopSignals();
    controls.remove("desk-casual");
    controls.remove("desk-intense");
  };
}
