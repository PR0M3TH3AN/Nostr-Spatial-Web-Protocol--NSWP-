import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDeskControls, resetDesk } from "../src/desk.js";
import { describeWorld } from "../src/menu-above.js";
import { forgetModelsSwitch, showsModels } from "../src/models-switch.js";
import { resetPictures, showsPictures } from "../src/picture.js";
import { changeSettings, currentSettings, resetSettings } from "../src/settings.js";
import { resetChat, showsChat } from "../src/ui/chat.js";
import { createControls } from "../src/ui/model.js";
import { mergeView } from "../src/ui/port-below.js";
import { chatSwitch, modelsSwitch, picturesSwitch, VISITOR_SWITCHES } from "../src/visitor-switches.js";
import { cleanMenuWorld } from "@nswp/core";

/**
 * The rows that change a setting the visitor carries from world to world (protocol/02-doors.md, "The client has the
 * menu"): where a client draws the menu they are the client's own, drawn inside the tab they stand in, and the world
 * leaves them out of what it describes.
 */
const kept = new Map<string, string>();
const forgetAll = () => {
  resetSettings();
  resetDesk();
  forgetModelsSwitch();
  resetPictures();
  resetChat();
};
beforeEach(() => {
  kept.clear();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
  forgetAll();
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
  forgetAll();
});

const withSwitches = (title: string) => {
  const c = createControls({ title });
  const said: string[] = [];
  c.onSay((t) => said.push(t));
  addDeskControls(c, { presenting: () => false });
  c.add(picturesSwitch(c), modelsSwitch(c), chatSwitch((t) => c.say(t)));
  return { c, said };
};

describe("the visitor's own switches", () => {
  it("are the rows they have always been, by id, tab and words", () => {
    const { c } = withSwitches("A world");
    const rows = c.view().sections.flatMap((s) => s.items.map((i) => [s.id, i.id, i.label, i.on]));
    expect(rows).toContainEqual(["people", "people-pictures", "Profile pictures: on", true]);
    expect(rows).toContainEqual(["people", "people-models", "Show people's own models: on", true]);
    expect(rows).toContainEqual(["room", "room-chat-show", "Written chat: on", true]);
  });

  it("each change the setting that goes with the visitor, and say what that means", async () => {
    const { c, said } = withSwitches("A client");
    for (const id of ["people-pictures", "people-models", "room-chat-show"]) c.run(id);
    await new Promise((r) => setTimeout(r, 0));
    expect([showsPictures(), showsModels(), showsChat()]).toEqual([false, false, false]);
    expect(currentSettings()).toMatchObject({ pictures: false, models: false, chat: false });
    expect(said).toHaveLength(3);
  });
});

describe("a world whose client has the menu", () => {
  it("leaves the visitor's switches out of what it describes, and keeps everything else in those tabs", () => {
    const { c } = withSwitches("The Gallery");
    c.add({ id: "people-ana", section: "people", label: "Ana", act: () => {} });
    c.add({ id: "room-join", section: "room", label: "Join the room", act: () => {} });
    c.add({ id: "vr", section: "view", label: "Enter VR", act: () => {} });
    const sent = describeWorld(c.view());
    const ids = (sent.sections as { id: string; rows: { id: string }[] }[]).map((s) => [s.id, s.rows.map((r) => r.id)]);
    expect(ids).toEqual([["room", ["room-join"]], ["people", ["people-ana"]], ["view", ["vr"]]]);
    expect(JSON.stringify(sent)).not.toMatch(new RegExp(VISITOR_SWITCHES.join("|")));
  });

  it("is told when the visitor turns one off in their client's menu, and takes it at once", () => {
    expect([showsPictures(), showsModels(), showsChat()]).toEqual([true, true, true]);
    changeSettings({ pictures: false, models: false, chat: false, fov: 90 });
    expect([showsPictures(), showsModels(), showsChat()]).toEqual([false, false, false]);
    expect(currentSettings().fov).toBe(90);
  });
});

describe("the client's menu over that world", () => {
  it("has the switches as the client's own rows, first in the tabs the world fills", () => {
    const world = withSwitches("The Gallery").c;
    world.add({ id: "people-ana", section: "people", label: "Ana", act: () => {} });
    world.add({ id: "room-join", section: "room", label: "Join the room", act: () => {} });
    const kept = cleanMenuWorld(describeWorld(world.view()))!;
    const client = withSwitches("A client").c;
    const view = mergeView(client.view(), kept, { address: "gallery.example", pins: [] });
    const rows = (tab: string) => view.sections.find((s) => s.id === tab)!.items.map((i) => i.id);
    expect(rows("people")).toEqual(["people-pictures", "people-models", "world:people-ana"]);
    expect(rows("room")).toEqual(["room-chat-show", "world:room-join"]);
  });
});
