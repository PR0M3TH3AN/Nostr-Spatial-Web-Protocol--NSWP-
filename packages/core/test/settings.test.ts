import { describe, expect, it } from "vitest";
import { buildAirlockUrl, buildWayUrl, cleanSettings, PINS_MOST, decodeArrival, decodeSettings, encodeArrival, encodeSettings, parseAirlockFragment, SETTINGS_LINK_LIMIT, wayWithoutDestination, type TravelSettings } from "../src/index.js";

const mine: TravelSettings = { sound: { off: false, effects: 0.7, music: 0, voices: 1, hum: true }, text: 1.15, motion: false, wrist: "right", turn: 45, hand: "right", narrow: true, full: true, intense: true, look: 1.5, fov: 90 };

describe("settings that travel", () => {
  it("keeps what it knows and is in range, and leaves out the rest", () => {
    expect(cleanSettings(mine)).toEqual(mine);
    expect(cleanSettings({ sound: { music: 7, effects: -2, voices: "loud", bass: 1 }, text: 9, wrist: "ankle", turn: 60, full: "yes", theme: "dark" })).toEqual({ sound: { effects: 0, music: 1 }, text: 1.5 });
    expect(cleanSettings({ text: 0.1 })).toEqual({ text: 0.85 });
    expect(cleanSettings({ sound: {} })).toEqual({});
    for (const odd of [null, undefined, 7, "loud", [], [mine]]) expect(cleanSettings(odd)).toEqual({});
  });

  it("never carries what needs asking about, however it is spelt", () => {
    const sly = cleanSettings({ ...mine, mic: true, joined: true, blocked: ["a".repeat(64)], hearShared: true, sound: { ...mine.sound, hearShared: true, shared: 1 }, moving: "intense", pass: {}, home: true });
    expect(sly).toEqual(mine);
  });

  it("goes on a link and comes off it the same", () => {
    const text = encodeSettings(mine);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(text.length).toBeLessThanOrEqual(SETTINGS_LINK_LIMIT);
    expect(decodeSettings(text)).toEqual(mine);
    expect(encodeSettings({})).toBe("");
    expect(encodeSettings(undefined)).toBe("");
  });

  it("reads nothing from a link it can't read", () => {
    for (const bad of ["", "!!!", "e30", "bm90IGpzb24", "x".repeat(SETTINGS_LINK_LIMIT + 1), 7, null]) expect(decodeSettings(bad)).toEqual({});
  });

  it("travels through a door, and home", () => {
    const link = buildAirlockUrl("https://lobby.example/go/", { url: "https://world.example/" }, { settings: mine, moving: "intense" });
    expect(parseAirlockFragment(new URL(link).hash)).toMatchObject({ settings: mine, moving: "intense" });
    const home = buildWayUrl("https://lobby.example/go/", { settings: { sound: { music: 0 } }, immersive: true });
    expect(wayWithoutDestination(new URL(home).hash)).toEqual({ immersive: true, doors: false, settings: { sound: { music: 0 } } });
    // No settings, no flag.
    expect(buildWayUrl("https://lobby.example/go/", { settings: {} })).toBe("https://lobby.example/go/");
    // A way home with something else on it is still not a way home.
    expect(wayWithoutDestination("#set=e30&to=https%3A%2F%2Fworld.example%2F")).toBeNull();
    expect(wayWithoutDestination("#set=not base64")).toBeNull();
  });

  it("arrives in the arrival context, cleaned", () => {
    const r = decodeArrival(encodeArrival({ entry: "main-entrance", settings: mine }));
    expect(r.ok && r.value.settings).toEqual(mine);
    const odd = decodeArrival(Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", settings: { theme: "dark" } })).toString("base64url"));
    expect(odd.ok && odd.value.settings).toBeUndefined();
    expect(odd.warnings.map((w) => w.code)).toContain("invalid_settings");
  });

  it("keeps what a visitor prefers at a desk within what a world can do with it", () => {
    expect(cleanSettings({ intense: true, look: 9, fov: 170 })).toEqual({ intense: true, look: 3, fov: 110 });
    expect(cleanSettings({ intense: "yes", look: 0, fov: 12.4 })).toEqual({ look: 0.25, fov: 50 });
    expect(cleanSettings({ look: "fast", fov: null })).toEqual({});
    expect(cleanSettings({ fov: 84.6 })).toEqual({ fov: 85 });
  });
});

describe("the tabs a visitor keeps on their bar", () => {
  it("travel as short plain names, four at most, each once, in the order they were pinned", () => {
    expect(cleanSettings({ pins: ["people", "sound"] })).toEqual({ pins: ["people", "sound"] });
    expect(cleanSettings({ pins: ["people", "people", "sound", "display", "camera", "help"] }).pins).toEqual(["people", "sound", "display", "camera"]);
    expect(PINS_MOST).toBe(4);
  });
  it("carry nothing that isn't a tab's name: no sentences, no addresses, nothing long", () => {
    expect(cleanSettings({ pins: ["People", "two words", "https://x.example", "a".repeat(13), "", 7, null, { id: "room" }, "<b>", "room"] }).pins).toEqual(["room"]);
    expect(cleanSettings({ pins: "people" })).toEqual({});
    expect(cleanSettings({ pins: { 0: "people" } })).toEqual({});
  });
  it("say so when they took every tab off: none is a choice, and it travels", () => {
    expect(cleanSettings({ pins: [] })).toEqual({ pins: [] });
    expect(decodeSettings(encodeSettings({ pins: [] }))).toEqual({ pins: [] });
  });
  it("go on a link with everything else, and come off it the same", () => {
    const all: TravelSettings = { ...mine, pictures: true, chat: true, pins: ["people", "sound", "display", "camera"] };
    const sent = encodeSettings(all);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.length).toBeLessThanOrEqual(SETTINGS_LINK_LIMIT);
    expect(decodeSettings(sent)).toEqual(all);
  });
  it("are the first thing left behind if a link would be too long, so the rest still travels", () => {
    // The longest names there can be, with every other setting said: more than a link holds.
    const most: TravelSettings = { ...mine, sound: { off: false, effects: 0.77, music: 0.33, voices: 0.99, hum: false }, look: 1.25, text: 1.15, pictures: false, chat: false, pins: ["abcdefghijkl", "bcdefghijklm", "cdefghijklmn", "defghijklmno"] };
    const whole = JSON.stringify(cleanSettings(most));
    const sent = encodeSettings(most);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.length).toBeLessThanOrEqual(SETTINGS_LINK_LIMIT);
    const got = decodeSettings(sent);
    // Either it all fitted, or the pins are what was left out and nothing else.
    if (Math.ceil((whole.length * 4) / 3) > SETTINGS_LINK_LIMIT) expect(got).toEqual({ ...cleanSettings(most), pins: undefined });
    else expect(got).toEqual(cleanSettings(most));
    expect(got.text).toBe(1.15);
  });
});
