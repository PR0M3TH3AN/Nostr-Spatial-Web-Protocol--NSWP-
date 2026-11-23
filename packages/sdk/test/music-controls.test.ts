import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanMenuWorld } from "@nswp/core";
import { describeWorld } from "../src/menu-above.js";
import { addSoundControls, type JukeHow, type Jukebox, type Song, type Sounds } from "../src/sound.js";
import { cleanHow, DEFAULT_LEVELS } from "../src/sound-store.js";
import { createControls } from "../src/ui/model.js";
import { visitorsOwnRow } from "../src/visitor-switches.js";

/**
 * The playback controls for a visitor's own music (docs/backlog/own-music-everywhere.md): the menu's own rows in
 * Sound, the same wherever they are drawn. The jukebox here is a stand-in that keeps what it was asked; no sound is
 * made.
 */
beforeEach(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ addEventListener: vi.fn(), click: vi.fn() }), body: { append: vi.fn() } };
});
afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

const SONGS: Song[] = [
  { id: "song-one", title: "First light", size: 10, at: 1 },
  { id: "song-two", title: "Second wind", size: 10, at: 2 },
];

const make = (o: { songs?: Song[]; current?: Song | null } = {}) => {
  const asked: string[] = [];
  const listeners = new Set<() => void>();
  const changed = () => void [...listeners].forEach((fn) => fn());
  const state = { songs: o.songs ?? SONGS, current: o.current === undefined ? SONGS[0]! : o.current, playing: false, position: 83, duration: 225, how: cleanHow(null) as JukeHow };
  const jukebox: Jukebox = {
    list: () => [...state.songs],
    add: async () => null,
    remove: async () => {},
    play: async (id) => (asked.push(`play ${id ?? ""}`.trim()), (state.playing = true), changed(), true),
    pause: () => (asked.push("pause"), (state.playing = false), changed()),
    next: async () => (asked.push("next"), true),
    previous: async () => (asked.push("previous"), true),
    seek: (seconds) => void asked.push(`seek ${seconds}`),
    get playing() {
      return state.playing;
    },
    get current() {
      return state.current;
    },
    get position() {
      return state.position;
    },
    get duration() {
      return state.duration;
    },
    get how() {
      return state.how;
    },
    setHow: (patch) => ((state.how = cleanHow({ ...state.how, ...patch })), changed()),
    output: () => ({}) as MediaStreamTrack,
  };
  const sounds = {
    jukebox,
    levels: DEFAULT_LEVELS,
    setLevels: () => {},
    onChange: (fn: () => void) => (listeners.add(fn), fn(), () => listeners.delete(fn)),
    play: () => {},
    music: "none",
    piece: null,
    nextPiece: () => false,
    hasHum: false,
  } as unknown as Sounds;
  const controls = createControls({ title: "A page" });
  addSoundControls(controls, sounds);
  const sound = () => controls.view().sections.find((s) => s.id === "sound")!.items;
  const row = (id: string) => sound().find((i) => i.id === id);
  const press = async (id: string, typed?: string) => {
    controls.run(id, typed);
    await new Promise((r) => setTimeout(r, 0));
  };
  return { controls, state, asked, sound, row, press };
};

describe("the rows for a visitor's own music", () => {
  it("are what is playing with a bar to move along, the song before, play, the song after, a little way back and on, how it goes, then the songs", () => {
    const m = make();
    const music = m.sound().map((i) => i.id).filter((id) => id.startsWith("juke-") || id.startsWith("song-"));
    expect(music).toEqual(["juke-place", "juke-previous", "juke-play", "juke-next", "juke-back", "juke-forward", "juke-shuffle", "juke-repeat", "juke-bar", "juke-add", "juke-remove", "song-song-one", "song-song-two"]);
  });

  it("say what is playing, and where in it, on a bar that is asked again as it is drawn", () => {
    const m = make();
    const place = m.row("juke-place")!;
    expect([place.kind, place.label, place.on]).toEqual(["slider", "Your music, paused: First light", false]);
    expect([place.slider!.value(), place.slider!.max(), place.slider!.text!()]).toEqual([83, 225, "1:23 of 3:45"]);
    m.state.playing = true;
    m.state.position = 84;
    expect(m.row("juke-place")!.label).toBe("Your music: First light");
    // The same bar says the new place: nothing has to be drawn again for the time to run.
    expect(place.slider!.text!()).toBe("1:24 of 3:45");
    // Until the browser knows how long the song is, only how far in.
    m.state.duration = 0;
    expect([place.slider!.max(), place.slider!.text!()]).toEqual([0, "1:24"]);
  });

  it("move within the song: to where the bar was let go, and a little way back or on", async () => {
    const m = make();
    await m.press("juke-place", "42");
    await m.press("juke-back");
    await m.press("juke-forward");
    expect(m.asked).toEqual(["seek 42", "seek 68", "seek 98"]);
  });

  it("go to the song before and the song after, and play and pause", async () => {
    const m = make();
    await m.press("juke-previous");
    await m.press("juke-next");
    await m.press("juke-play");
    expect(m.row("juke-play")).toMatchObject({ label: "Pause your music", icon: "pause", on: true });
    await m.press("juke-play");
    expect(m.row("juke-play")).toMatchObject({ label: "Play your music", icon: "play", on: false });
    expect(m.asked).toEqual(["previous", "next", "play", "pause"]);
  });

  it("turn shuffle on and off, and go round what happens at the end: off, all, this one", async () => {
    const m = make();
    expect([m.row("juke-shuffle")!.label, m.row("juke-repeat")!.label]).toEqual(["Shuffle: off", "Repeat: all your songs"]);
    await m.press("juke-shuffle");
    expect([m.state.how.shuffle, m.row("juke-shuffle")!.label, m.row("juke-shuffle")!.on]).toEqual([true, "Shuffle: on", true]);
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      await m.press("juke-repeat");
      seen.push(`${m.state.how.repeat} / ${m.row("juke-repeat")!.label} / ${m.row("juke-repeat")!.on}`);
    }
    expect(seen).toEqual(["one / Repeat: this song / true", "off / Repeat: off / false", "all / Repeat: all your songs / true"]);
  });

  it("put play and pause on the bar where the visitor says, named for what is playing, and take it off again", async () => {
    const m = make();
    expect(m.controls.view().hotbar.map((i) => i.id)).toEqual([]);
    await m.press("juke-bar");
    expect(m.row("juke-bar")).toMatchObject({ label: "Play and pause on your bar: on", on: true });
    expect(m.controls.view().hotbar.map((i) => [i.id, i.short, i.icon])).toEqual([["juke-play", "First light", "play"]]);
    await m.press("juke-bar");
    expect(m.controls.view().hotbar).toEqual([]);
    // The bar that is moved along is never a key on the bar, whatever is asked.
    expect(m.controls.view().hotbar.some((i) => i.kind === "slider")).toBe(false);
  });

  it("show only what there is to use: nothing to move in before a song is chosen, nothing to go between with one song", () => {
    const none = make({ songs: [], current: null });
    expect(none.sound().map((i) => i.id).filter((id) => id.startsWith("juke-"))).toEqual(["juke-add"]);
    const one = make({ songs: [SONGS[0]!], current: null });
    expect(one.sound().map((i) => i.id).filter((id) => id.startsWith("juke-"))).toEqual(["juke-play", "juke-repeat", "juke-bar", "juke-add"]);
  });

  it("are never described to a client by a world: what a visitor listens to is not a world's to say", () => {
    const m = make();
    for (const id of m.sound().map((i) => i.id).filter((id) => id.startsWith("juke-") || id.startsWith("song-"))) expect(visitorsOwnRow(id), id).toBe(true);
    const said = JSON.stringify(describeWorld(m.controls.view()));
    expect(said).not.toMatch(/juke-|song-|First light|Second wind|slider/);
    // And a bar of a world's own making is not described either: no word of the menu's carries one.
    m.controls.add({ id: "film-place", section: "view", label: "Where in the film", kind: "slider", slider: { value: () => 1, max: () => 9 }, act: () => {} });
    m.controls.add({ id: "film-play", section: "view", label: "Play the film", act: () => {} });
    const world = cleanMenuWorld(describeWorld(m.controls.view()));
    expect(world?.sections.find((s) => s.id === "view")?.rows.map((r) => r.id)).toEqual(["film-play"]);
  });
});
