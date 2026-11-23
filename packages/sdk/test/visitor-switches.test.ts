import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDeskControls, resetDesk } from "../src/desk.js";
import { describeWorld } from "../src/menu-above.js";
import { forgetModelsSwitch, showsModels } from "../src/models-switch.js";
import { resetPictures, showsPictures } from "../src/picture.js";
import { changeSettings, currentSettings, resetSettings } from "../src/settings.js";
import { resetChat, showsChat } from "../src/ui/chat.js";
import { createControls } from "../src/ui/model.js";
import { mergeView } from "../src/ui/port-below.js";
import { askDeskMoving, chatSwitch, deskMovingSwitch, forgetDeskMoving, modelsSwitch, picturesSwitch, VISITOR_SWITCHES } from "../src/visitor-switches.js";
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
  forgetDeskMoving();
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

describe("Moving, which both fill", () => {
  it("a world leaves how the visitor moves out of what it describes, and says what it does for them: a jump", () => {
    const c = createControls({ title: "The Gallery" });
    for (const id of ["fps", "look-speed", "move-style", "move-mode", "turn-mode", "move-hand", "move-narrow", "move-fade"]) c.add({ id, section: "moving", label: id, act: () => {} });
    c.add({ id: "jump", section: "moving", label: "Jump", short: "Jump", act: () => {} });
    const sent = describeWorld(c.view());
    expect((sent.sections as { id: string; rows: { id: string }[] }[]).map((s) => [s.id, s.rows.map((r) => r.id)])).toEqual([["moving", ["jump"]]]);
  });

  it("the client's own switch for how they move at a desk holds their choice, says it, and takes it from elsewhere", async () => {
    const c = createControls({ title: "A client" });
    const said: string[] = [];
    c.onSay((t) => said.push(t));
    const row = deskMovingSwitch(c);
    c.add(row);
    // Nothing is said of it to any world until they have chosen.
    expect(currentSettings().intense).toBeUndefined();
    expect([row.on?.(), typeof row.label === "function" ? row.label() : row.label]).toEqual([false, "Desk controls: casual"]);
    await row.act();
    expect(currentSettings().intense).toBe(true);
    expect(said[0]).toMatch(/^Intense: the mouse looks round/);
    changeSettings({ intense: false });
    expect([row.on?.(), currentSettings().intense]).toEqual([false, false]);
  });

  it("the client's menu has its own switches first in Moving, and the world's jump below under the world's name", () => {
    const world = createControls({ title: "The Gallery" });
    world.add({ id: "fps", section: "moving", label: "Desk controls: casual", act: () => {} });
    world.add({ id: "jump", section: "moving", label: "Jump", act: () => {} });
    const kept = cleanMenuWorld(describeWorld(world.view()))!;
    const client = createControls({ title: "A client" });
    client.add({ id: "fps", section: "moving", label: "Desk controls: casual", act: () => {} });
    client.add({ id: "look-speed", section: "moving", label: "Look speed: normal", act: () => {} });
    const view = mergeView(client.view(), kept, { address: "gallery.example", pins: [] });
    expect(view.sections.find((s) => s.id === "moving")!.items.map((i) => [i.id, i.from])).toEqual([["fps", undefined], ["look-speed", undefined], ["world:jump", "The Gallery"]]);
  });
});

describe("the one-time question, how you move at a desk, asked by a client", () => {
  /** A desk: a device whose pointer is a mouse. */
  const atADesk = () => vi.stubGlobal("matchMedia", (q: string) => ({ matches: /fine/.test(q) }));
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const client = () => {
    const c = createControls({ title: "A client" });
    const asked: string[] = [];
    const said: string[] = [];
    c.onSignal((n) => void (n.startsWith("show:") && asked.push(n)));
    c.onSay((t) => said.push(t));
    c.add(deskMovingSwitch(c));
    const stop = askDeskMoving(c);
    const rows = () => c.view().sections.find((s) => s.id === "how-you-move-desk")?.items.map((i) => i.label) ?? [];
    return { c, asked, said, rows, stop };
  };

  it("is asked a moment after the page is up, the first time, with the same words a world asks with", async () => {
    atADesk();
    const w = client();
    expect(w.asked).toEqual([]);
    await vi.advanceTimersByTimeAsync(1200);
    expect(w.asked).toEqual(["show:how-you-move-desk"]);
    expect(w.rows()).toEqual(["Casual: click to walk, drag to look", "Intense: the mouse looks, keys walk"]);
  });

  it("keeps the answer as the visitor's travelling setting, and is never asked again", async () => {
    atADesk();
    const w = client();
    await vi.advanceTimersByTimeAsync(1200);
    w.c.run("desk-intense");
    await vi.advanceTimersByTimeAsync(10);
    expect(currentSettings().intense).toBe(true);
    expect(w.said[0]).toMatch(/^Intense: the mouse looks round/);
    expect(w.rows()).toEqual([]);
    // The page is loaded again: the choice is kept on this site, so nothing is asked.
    forgetDeskMoving();
    resetSettings();
    const again = client();
    await vi.advanceTimersByTimeAsync(5000);
    expect(again.asked).toEqual([]);
    expect(currentSettings().intense).toBe(true);
  });

  it("takes the menu put away without an answer as casual, and that is an answer", async () => {
    atADesk();
    const w = client();
    await vi.advanceTimersByTimeAsync(1200);
    w.c.signal("menuClose");
    expect(currentSettings().intense).toBe(false);
    forgetDeskMoving();
    resetSettings();
    const again = client();
    await vi.advanceTimersByTimeAsync(5000);
    expect(again.asked).toEqual([]);
  });

  it("is not asked of someone who arrived with a choice, on a phone, or in a headset", async () => {
    atADesk();
    changeSettings({ intense: false });
    const chose = client();
    await vi.advanceTimersByTimeAsync(5000);
    expect(chose.asked).toEqual([]);
    forgetAll();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const phone = client();
    await vi.advanceTimersByTimeAsync(5000);
    expect(phone.asked).toEqual([]);
    forgetAll();
    atADesk();
    const c = createControls({ title: "A client" });
    const asked: string[] = [];
    c.onSignal((n) => void (n.startsWith("show:") && asked.push(n)));
    askDeskMoving(c, { presenting: () => true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(asked).toEqual([]);
  });

  it("is never said upward by a world: its own question's tab is not in what it describes", () => {
    const world = createControls({ title: "The Gallery" });
    world.addSection({ id: "how-you-move-desk", label: "How you move" });
    world.add({ id: "desk-casual", section: "how-you-move-desk", label: "Casual: click to walk, drag to look", act: () => {} });
    world.addSection({ id: "how-you-move", label: "How you move" });
    world.add({ id: "how-casual", section: "how-you-move", label: "Casual", act: () => {} });
    expect(describeWorld(world.view()).sections).toEqual([]);
  });
});

