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
import { setShowsModels, showsModels } from "./models-switch.js";
import { setShowsPictures, showsPictures } from "./picture.js";
import { setShowsChat, showsChat } from "./ui/chat.js";
import type { Controls, UiAction } from "./ui/model.js";

/**
 * The rows, by id, that are the visitor's own in a tab a world otherwise fills, and so are never in a world's
 * description: these, and how wide they see (desk.ts, `fov`, under View).
 */
export const VISITOR_SWITCHES: readonly string[] = ["people-pictures", "people-models", "room-chat-show", "fov"];

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
