import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lookScale, resetDesk, visitorFov } from "../src/desk.js";
import { filesAnywhere, forgetFileHosts, setFilesAnywhere } from "../src/file-hosts.js";
import { forgetItemsSwitch, showsItems } from "../src/item-store.js";
import { forgetModelsSwitch, showsModels } from "../src/look-models.js";
import { resetPictures, showsPictures } from "../src/picture.js";
import { arrivedSettings, arriveWith, changeSettings, currentSettings, reportSettings, resetSettings } from "../src/settings.js";
import { resetChat, showsChat } from "../src/ui/chat.js";
import { createControls } from "../src/ui/model.js";

/**
 * A setting changed while the visitor is in a world: their own client draws their menu above this page, and they
 * changed something in it (protocol/02-doors.md, "The client has the menu"). Each part of the kit that holds one
 * takes it at once, as their own hand on its control here would have.
 */
const kept = new Map<string, string>();
const forgetAll = () => {
  resetSettings();
  resetDesk();
  forgetFileHosts();
  forgetItemsSwitch();
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

describe("a setting their client says has changed", () => {
  it("is given to each part that takes one, cleaned, and to no part that has gone", () => {
    const heard: unknown[] = [];
    const stop = reportSettings("sound", () => ({}), (now) => heard.push(["sound", now]));
    reportSettings("look", () => ({}), (now) => heard.push(["look", now]));
    reportSettings("silent", () => ({}));
    expect(changeSettings({ text: 1.3, mic: true, sound: { music: 0.2, bass: 9 } })).toEqual({ text: 1.3, sound: { music: 0.2 } });
    expect(heard).toEqual([["sound", { text: 1.3, sound: { music: 0.2 } }], ["look", { text: 1.3, sound: { music: 0.2 } }]]);
    stop();
    heard.length = 0;
    changeSettings({ motion: false });
    expect(heard).toEqual([["look", { motion: false }]]);
  });

  it("is where a part that starts later begins from", () => {
    arriveWith({ text: 1.1, sound: { music: 0.5, effects: 0.6 } });
    changeSettings({ sound: { music: 0 }, turn: 90 });
    expect(arrivedSettings()).toEqual({ text: 1.1, sound: { music: 0, effects: 0.6 }, turn: 90 });
  });

  it("doesn't stop at a part that can't take its share", () => {
    const heard: string[] = [];
    reportSettings("broken", () => ({}), () => {
      throw new Error("no");
    });
    reportSettings("fine", () => ({}), () => heard.push("fine"));
    expect(() => changeSettings({ text: 1 })).not.toThrow();
    expect(heard).toEqual(["fine"]);
  });

  it("is never taken from anything that isn't settings", () => {
    for (const bad of [null, "loud", 5, ["text"]]) expect(changeSettings(bad)).toEqual({});
  });
});

describe("each switch of the visitor's", () => {
  it("is turned off and on again by their client", () => {
    expect([showsItems(), showsPictures(), showsModels(), showsChat()]).toEqual([true, true, true, true]);
    changeSettings({ items: false, pictures: false, models: false, chat: false });
    expect([showsItems(), showsPictures(), showsModels(), showsChat()]).toEqual([false, false, false, false]);
    // And it is kept here as their own hand would have kept it, and goes on with them.
    expect(currentSettings()).toMatchObject({ items: false, pictures: false, models: false, chat: false });
    changeSettings({ items: true, chat: true });
    expect([showsItems(), showsPictures(), showsModels(), showsChat()]).toEqual([true, false, false, true]);
  });

  it("is where it was said to be for a part first asked afterwards", () => {
    changeSettings({ pictures: false });
    expect(showsPictures()).toBe(false);
  });

  it("takes how fast they look round and how wide they see", () => {
    expect(lookScale()).toBe(1);
    changeSettings({ look: 2, fov: 90 });
    expect(lookScale()).toBe(2);
    expect(currentSettings()).toMatchObject({ look: 2, fov: 90 });
    void visitorFov;
  });
});

describe("loading people's files from anywhere", () => {
  it("is never turned on by a link's settings", () => {
    arriveWith({ filesAnywhere: true });
    expect(filesAnywhere()).toBe(false);
  });

  it("is never turned on by the visitor's client either: nothing above a world can", () => {
    expect(filesAnywhere()).toBe(false);
    expect(changeSettings({ filesAnywhere: true, text: 1.2 })).toEqual({ text: 1.2 });
    expect(filesAnywhere()).toBe(false);
  });

  it("isn't on from the start because a client said so before anything asked", () => {
    changeSettings({ filesAnywhere: true });
    expect(filesAnywhere()).toBe(false);
  });

  it("is turned on by the visitor's own press here, and off by their client, which is always safe", () => {
    setFilesAnywhere(true);
    expect(filesAnywhere()).toBe(true);
    changeSettings({ text: 1.1 });
    expect(filesAnywhere()).toBe(true);
    changeSettings({ filesAnywhere: false });
    expect(filesAnywhere()).toBe(false);
  });

  it("never goes on through a door, though it is on here", () => {
    setFilesAnywhere(true);
    expect(currentSettings().filesAnywhere).toBeUndefined();
  });
});

describe("the menu's own look, and the bar", () => {
  it("take the size of text, whether things move, and the wrist", () => {
    const controls = createControls({ title: "A world" });
    let drawn = 0;
    controls.subscribe(() => drawn++);
    changeSettings({ text: 1.3, motion: false, wrist: "right" });
    expect(controls.theme).toMatchObject({ scale: 1.3, motion: false, wrist: "right" });
    expect(drawn).toBe(1);
    expect(currentSettings()).toMatchObject({ text: 1.3, motion: false, wrist: "right" });
    changeSettings({ turn: 45 });
    expect(drawn).toBe(1);
  });

  it("take the tabs they pinned", () => {
    const controls = createControls({ title: "A world" });
    controls.add({ id: "who", section: "people", label: "Who is here", act: () => {} });
    controls.add({ id: "join", section: "room", label: "Join", act: () => {} });
    changeSettings({ pins: ["people", "room"] });
    expect(controls.view().pins.map((p) => p.id)).toEqual(["people", "room"]);
    changeSettings({ pins: [] });
    expect(controls.view().pins).toEqual([]);
  });
});
