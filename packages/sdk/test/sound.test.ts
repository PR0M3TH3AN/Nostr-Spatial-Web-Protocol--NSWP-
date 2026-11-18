import { describe, expect, it } from "vitest";
import { cleanKit, nextVariant, MUSIC_RANGE, MUSIC_SOURCES, musicFade, musicToHear, ambiencePlan, cleanLevels, cleanSongs, cleanTheme, cueRecipe, CUES, DEFAULT_LEVELS, levelStep, LEVEL_STEPS, nextLevel, recipeLength, seeded, songRefusal, songTitle, SOUND_LIMITS } from "../src/sound-store.js";

describe("the default cues", () => {
  it("has one for everything on the list, each short and quiet", () => {
    for (const cue of CUES) {
      const parts = cueRecipe(cue);
      expect(parts.length, cue).toBeGreaterThan(0);
      expect(recipeLength(parts), cue).toBeLessThanOrEqual(0.8);
      for (const p of parts) {
        expect(p.gain, cue).toBeGreaterThan(0);
        expect(p.gain, cue).toBeLessThanOrEqual(0.35);
        expect(p.dur, cue).toBeGreaterThan(0);
        if (p.kind === "tone") expect(p.from, cue).toBeGreaterThan(40);
      }
    }
    expect(recipeLength(cueRecipe("step"))).toBeLessThan(0.1); // heard a thousand times a visit
  });
});

describe("a world's own sounds", () => {
  const base = "https://world.example/play/";
  it("takes files from the world's own site, silence where it says so, and the default everywhere else", () => {
    const t = cleanTheme({ cues: { step: "sounds/step.ogg", press: null, cross: "/shared/door.MP3#t=2", hover: 7 }, music: "music/loop.opus" }, base);
    expect(t.cues).toEqual({ step: ["https://world.example/play/sounds/step.ogg"], press: null, cross: ["https://world.example/shared/door.MP3"] });
    expect(t.music).toEqual(["https://world.example/play/music/loop.opus"]);
    expect(cleanTheme({ music: null }, base).music).toBeNull();
    expect("music" in cleanTheme({}, base)).toBe(false);
  });

  it("takes several files for a cue, several pieces of music, and a hum", () => {
    const t = cleanTheme({ cues: { step: ["a.ogg", "b.ogg", "a.ogg", "https://elsewhere.example/c.ogg", "d.txt"] }, music: ["one.ogg", "two.ogg"], hum: "hum.ogg" }, base);
    expect(t.cues.step).toEqual(["https://world.example/play/a.ogg", "https://world.example/play/b.ogg"]);
    expect(t.music).toEqual(["https://world.example/play/one.ogg", "https://world.example/play/two.ogg"]);
    expect(t.hum).toBe("https://world.example/play/hum.ogg");
    expect(cleanTheme({ hum: null }, base).hum).toBeNull();
    expect("hum" in cleanTheme({ hum: "https://elsewhere.example/hum.ogg" }, base)).toBe(false);
    expect(cleanTheme({ cues: { step: Array.from({ length: 20 }, (_, i) => `s${i}.ogg`) } }, base).cues.step).toHaveLength(6);
    // Every address in a list unusable: the default stays, as with one.
    expect(cleanTheme({ cues: { step: ["x.txt"] }, music: ["//elsewhere.example/a.ogg"] }, base)).toEqual({ cues: {} });
  });

  it("reads the kit's own files, in the form this browser plays", () => {
    const folder = "https://world.example/sounds/kit/";
    const json = { cues: { step: [{ ogg: "cues/step.ogg", mp3: "cues/step.mp3" }], hover: [{ ogg: "cues/h1.ogg", mp3: "cues/h1.mp3" }, { ogg: "cues/h2.ogg", mp3: "cues/h2.mp3" }], boom: ["x.ogg"] }, hum: { ogg: "hum.ogg", mp3: "hum.mp3" }, music: ["music/default.ogg"] };
    const ogg = cleanKit(json, folder, true);
    expect(ogg.cues).toEqual({ step: [`${folder}cues/step.ogg`], hover: [`${folder}cues/h1.ogg`, `${folder}cues/h2.ogg`] });
    expect(ogg.hum).toBe(`${folder}hum.ogg`);
    expect(ogg.music).toEqual([`${folder}music/default.ogg`]);
    const mp3 = cleanKit(json, folder, false);
    expect(mp3.cues.step).toEqual([`${folder}cues/step.mp3`]);
    expect(mp3.hum).toBe(`${folder}hum.mp3`);
    expect(cleanKit({ cues: { step: ["https://elsewhere.example/s.ogg"] }, hum: "../../../etc/passwd" }, folder, true)).toEqual({ cues: {} });
    expect(cleanKit(null, folder, true)).toEqual({ cues: {} });
  });

  it("never plays the same one of several twice running", () => {
    expect(nextVariant(1, 0)).toBe(0);
    expect(nextVariant(0, -1)).toBe(0);
    for (let last = 0; last < 3; last++) for (const r of [0, 0.3, 0.6, 0.99]) expect(nextVariant(3, last, () => r)).not.toBe(last);
    expect(new Set([0, 0.2, 0.4, 0.6, 0.8].map((r) => nextVariant(3, -1, () => r)))).toEqual(new Set([0, 1, 2])); // the first time, any of them
  });

  it("refuses another site's file, anything that isn't a sound, and a cue that isn't on the list", () => {
    const t = cleanTheme({ cues: { step: "https://elsewhere.example/step.ogg", land: "//elsewhere.example/land.ogg", bump: "sounds/bump.js", grab: "javascript:alert(1)", drop: "data:audio/wav;base64,AAAA", explode: "boom.ogg" }, music: "https://tracker.example/who-is-here.mp3" }, base);
    expect(t.cues).toEqual({});
    expect("music" in t).toBe(false);
    for (const junk of [null, "x", 5, [], { cues: "all" }]) expect(cleanTheme(junk, base)).toEqual({ cues: {} });
    expect(cleanTheme({ cues: { step: "a.ogg" } }, "not an address")).toEqual({ cues: {} });
  });
});

describe("the visitor's volumes", () => {
  it("are theirs, within bounds, with sensible ones to start", () => {
    expect(cleanLevels(null)).toEqual(DEFAULT_LEVELS);
    expect(cleanLevels({ off: true, effects: 5, music: -1, voices: "loud" })).toEqual({ off: true, effects: 1, music: 0, voices: 1, hearShared: false, shared: 0.7, hum: true });
    expect(cleanLevels({ hum: false }).hum).toBe(false);
    // Hearing other people's music is off until the visitor turns it on, and "yes" in a kept file isn't that.
    expect(DEFAULT_LEVELS.hearShared).toBe(false);
    expect(cleanLevels({ hearShared: "yes" }).hearShared).toBe(false);
    expect(cleanLevels({ hearShared: true, shared: 2 })).toMatchObject({ hearShared: true, shared: 1 });
    expect(cleanLevels({ off: "yes" }).off).toBe(false);
  });

  it("go round four steps", () => {
    expect(LEVEL_STEPS.map((s) => levelStep(s))).toEqual([0, 1, 2, 3]);
    expect(levelStep(0.45)).toBe(1);
    expect([0, 0.35, 0.7, 1].map(nextLevel)).toEqual([0.35, 0.7, 1, 0]);
  });
});

describe("the music a place makes for itself", () => {
  it("is the same for everyone in a place, and different from place to place", () => {
    expect(ambiencePlan("The Grove")).toEqual(ambiencePlan("The Grove"));
    const plans = ["The Grove", "The Gallery", "The Arcade", "The Library", "The Tour", "The Workshop", "The Observatory"].map((n) => JSON.stringify(ambiencePlan(n)));
    expect(new Set(plans).size).toBe(plans.length);
  });

  it("stays low, slow and in tune with itself", () => {
    for (const name of ["a", "b", "The Grove", ""]) {
      const p = ambiencePlan(name);
      expect(p.root).toBeGreaterThanOrEqual(90);
      expect(p.root).toBeLessThanOrEqual(160);
      expect(p.drones).toHaveLength(4);
      for (const d of p.drones) {
        expect(d.swell).toBeGreaterThanOrEqual(11);
        expect(Math.abs(d.detune)).toBeLessThanOrEqual(7);
      }
      expect(p.gap[0]).toBeGreaterThanOrEqual(3.5);
      expect(p.gap[1]).toBeGreaterThan(p.gap[0]);
    }
    const r = seeded("x");
    const a = [r(), r(), r()];
    expect(a.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(new Set(a).size).toBe(3);
  });
});

describe("the visitor's own songs", () => {
  it("are named from their files, with nothing hidden in the name", () => {
    expect(songTitle("C:\\Music\\My_Song  (live).mp3")).toBe("My Song (live)");
    expect(songTitle("/home/a/track.01.flac")).toBe("track.01");
    expect(songTitle(`ok${String.fromCharCode(0x202e)}gpj.exe.ogg`)).toBe("ok gpj.exe");
    expect(songTitle("")).toBe("A song");
    expect(songTitle(5)).toBe("A song");
    expect([...songTitle("x".repeat(300))]).toHaveLength(SOUND_LIMITS.titleChars);
  });

  it("are kept as a list that trusts nothing it reads back", () => {
    const read = cleanSongs([{ id: "abcd-1234", title: "One.mp3", size: 10, at: 5 }, { id: "abcd-1234", title: "twice" }, { id: "NO" }, null, { id: "wxyz-9", title: 4, size: -2 }]);
    expect(read).toEqual([{ id: "abcd-1234", title: "One", size: 10, at: 5 }, { id: "wxyz-9", title: "A song", size: 0, at: 0 }]);
    expect(cleanSongs("x")).toEqual([]);
    expect(cleanSongs(Array.from({ length: 200 }, (_, i) => ({ id: `song-${i}` })))).toHaveLength(SOUND_LIMITS.songs);
  });

  it("takes sound files of a sensible size, and says why not otherwise", () => {
    expect(songRefusal({ type: "audio/mpeg", size: 1000, name: "a.mp3" }, 0)).toBeNull();
    expect(songRefusal({ type: "", size: 1000, name: "a.FLAC" }, 0)).toBeNull();
    expect(songRefusal({ type: "image/png", size: 1000, name: "a.png" }, 0)).toMatch(/isn't a sound/);
    expect(songRefusal({ type: "audio/mpeg", size: 0, name: "a.mp3" }, 0)).toMatch(/empty/);
    expect(songRefusal({ type: "audio/mpeg", size: SOUND_LIMITS.songBytes + 1, name: "a.mp3" }, 0)).toMatch(/MB/);
    expect(songRefusal({ type: "audio/mpeg", size: 1000, name: "a.mp3" }, SOUND_LIMITS.songs)).toMatch(/at most/);
  });
});

describe("music shared by people nearby", () => {
  const near = [
    { pubkey: "c", metres: 9 },
    { pubkey: "a", metres: 3 },
    { pubkey: "b", metres: 6 },
    { pubkey: "d", metres: MUSIC_RANGE + 1 },
  ];
  it("is heard by nobody who hasn't asked", () => {
    expect(musicToHear(near, false)).toEqual([]);
  });

  it("is the nearest few within range, without anyone the visitor stopped hearing", () => {
    expect(musicToHear(near, true)).toEqual(["a", "b"]);
    expect(musicToHear(near, true)).toHaveLength(MUSIC_SOURCES);
    expect(musicToHear([{ pubkey: "a", metres: 3, refused: true }, ...near.slice(0, 1), near[2]!], true)).toEqual(["b", "c"]);
    expect(musicToHear([{ pubkey: "far", metres: MUSIC_RANGE + 0.1 }, { pubkey: "lost", metres: Number.NaN }], true)).toEqual([]);
    expect(musicToHear([{ pubkey: "z", metres: 4 }, { pubkey: "y", metres: 4 }], true)).toEqual(["y", "z"]); // a tie breaks the same way for everyone
  });

  it("fades with distance, to nothing at the edge", () => {
    expect(musicFade(0)).toBe(1);
    expect(musicFade(2)).toBe(1);
    expect(musicFade(MUSIC_RANGE)).toBe(0);
    expect(musicFade(MUSIC_RANGE + 5)).toBe(0);
    expect(musicFade(Number.NaN)).toBe(0);
    const steps = [2, 4, 6, 8, 10, 11.9].map(musicFade);
    for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeLessThan(steps[i - 1]!);
    expect(musicFade(11.9)).toBeLessThan(0.01);
  });
});
