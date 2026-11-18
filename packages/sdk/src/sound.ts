/**
 * Sound: what a place sounds like, and what happens in it.
 *
 * Three layers, each with a volume of the visitor's own:
 *
 * - **Cues.** A short sound for something that happened: a step, a press, a
 *   door. There is a default for each, made in the browser from tones and
 *   noise. A world replaces any of them with a file of its own, or silences
 *   it; whatever it doesn't name keeps the default.
 * - **The place's music.** What the world gave it, or, when it gave none, a
 *   quiet music the kit makes from the place's name: the same for everyone
 *   there, different from place to place.
 * - **The visitor's own music.** Songs they added from their own device,
 *   kept in this browser for this site. Only they hear it, and the place's
 *   music steps back while it plays.
 *
 * What a world can't do is take the volumes: they are the visitor's. And
 * everything passes one limiter on the way out, so nothing a world names
 * can be louder than the kit lets anything be.
 *
 *   const sounds = createSounds({ context: THREE.AudioContext.getContext(), seed: "The Grove", theme: { cues: { step: "sounds/step.ogg" }, music: null } });
 *   addSoundControls(controls, sounds);
 *   sounds.play("cross");
 *   // each frame, with how far the visitor was moved: sounds.moved(metres)
 *
 * Browsers hold all sound back until the visitor touches the page, so
 * nothing here is heard before their first tap or key.
 */
import { fileStore } from "./library.js";
import {
  ambiencePlan,
  CUES,
  cleanLevels,
  cleanSongs,
  cleanTheme,
  cueRecipe,
  LEVEL_WORDS,
  levelStep,
  nextLevel,
  seeded,
  songRefusal,
  songTitle,
  SOUND_LIMITS,
  type CleanTheme,
  type Cue,
  type CuePart,
  type Song,
  type SoundLevels,
  type SoundTheme,
} from "./sound-store.js";
import type { Controls } from "./ui/model.js";

export { CUES, type Cue, type Song, type SoundLevels, type SoundTheme } from "./sound-store.js";

export interface SoundsOptions {
  /** The page's sound context, if it has one already (three.js keeps one: `THREE.AudioContext.getContext()`). */
  context?: AudioContext;
  /** The world's own sounds. Left out, everything is the default. */
  theme?: SoundTheme | null;
  /** What the place's own music is made from when the world names none: its title is a good choice. */
  seed?: string;
  /** Where the theme's addresses are relative to. Left out, this page. */
  base?: string;
  /** Keep the visitor's volumes and songs under these names. Left out, the kit's own, for this site. */
  keep?: { levels?: string; songs?: string };
}

export interface Jukebox {
  /** The visitor's songs, in the order they were added. */
  list(): Song[];
  /** Keep a file as a song. Returns words for the visitor if it can't be kept, or null when it is. */
  add(file: Blob & { name?: string }): Promise<string | null>;
  remove(id: string): Promise<void>;
  /** Play a song, or carry on with the current one. Returns false if it couldn't be played. */
  play(id?: string): Promise<boolean>;
  pause(): void;
  next(): Promise<boolean>;
  readonly playing: boolean;
  readonly current: Song | null;
}

export interface Sounds {
  /** Play a cue: the world's, the default, or nothing if it is silenced or the visitor has effects off. */
  play(cue: Cue): void;
  /**
   * Tell it how far the visitor was moved this frame, in metres: it makes
   * the steps. A long way at once is a jump, and lands. Give it what moved
   * them (keys, a tap, a stick), not how their head swayed.
   */
  moved(metres: number): void;
  /** They walked into something. */
  bump(): void;
  readonly levels: SoundLevels;
  setLevels(patch: Partial<SoundLevels>): void;
  /** The visitor's own music. */
  readonly jukebox: Jukebox;
  /** Be told when a volume or the jukebox changed. Called once at the start. */
  onChange(fn: (levels: SoundLevels) => void): () => void;
  /** What the place's music is: the world's file, the kit's own, or none. */
  readonly music: "world" | "made" | "none";
  /** How loud everything going out is right now, from 0. For tests. */
  loudness(): number;
  dispose(): void;
}

/** The least time between two of the same cue, in seconds: so held keys and busy frames don't make a buzz. */
const GAP: Partial<Record<Cue, number>> = { step: 0.14, hover: 0.08, bump: 0.5, land: 0.2, notice: 0.25 };
/** How far a visitor walks between steps, in metres. */
const STRIDE = 0.75;
/** Being moved further than this in one frame is a jump. */
const JUMP = 1.2;

export function createSounds(o: SoundsOptions = {}): Sounds {
  const ctx = o.context ?? new AudioContext();
  const base = o.base ?? location.href;
  const theme: CleanTheme = cleanTheme(o.theme, base);
  const levelsKey = o.keep?.levels ?? "nswp:sound";
  const songsKey = o.keep?.songs ?? "nswp:jukebox";
  const read = (key: string): unknown => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  };
  const write = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* it lasts for this visit */
    }
  };
  let levels = cleanLevels(read(levelsKey));
  let songs = cleanSongs(read(songsKey));
  let disposed = false;

  // Everything goes out through one limiter: a world's file can be as loud as it likes going in.
  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 10;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  const meter = ctx.createAnalyser();
  meter.fftSize = 1024;
  master.connect(limiter);
  limiter.connect(meter);
  limiter.connect(ctx.destination);
  const effects = ctx.createGain();
  const placeMusic = ctx.createGain();
  const ownMusic = ctx.createGain();
  for (const g of [effects, placeMusic, ownMusic]) g.connect(master);

  const listeners = new Set<(levels: SoundLevels) => void>();
  const changed = () => {
    for (const fn of listeners) {
      try {
        fn(levels);
      } catch (err) {
        console.error("nswp-sdk sound listener failed", err);
      }
    }
  };
  const juke = { audio: null as HTMLAudioElement | null, url: "", current: null as Song | null, playing: false };
  const apply = () => {
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(levels.off ? 0 : 1, t, 0.05);
    effects.gain.setTargetAtTime(levels.effects, t, 0.05);
    // The place's music steps back while the visitor's own plays.
    placeMusic.gain.setTargetAtTime(levels.music * (juke.playing ? 0.1 : 1), t, 0.4);
    ownMusic.gain.setTargetAtTime(levels.music, t, 0.05);
  };
  apply();

  // ------------------------------------------------------------- cues
  let noiseBuffer: AudioBuffer | null = null;
  const noise = (): AudioBuffer => {
    if (noiseBuffer) return noiseBuffer;
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  };
  const playPart = (p: CuePart, when: number) => {
    const start = when + p.at;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(p.gain, start + Math.min(0.006, p.dur / 3));
    gain.gain.exponentialRampToValueAtTime(0.0008, start + p.dur);
    gain.connect(effects);
    if (p.kind === "tone") {
      const osc = ctx.createOscillator();
      osc.type = p.wave;
      osc.frequency.setValueAtTime(p.from, start);
      if (p.to !== undefined) osc.frequency.exponentialRampToValueAtTime(p.to, start + p.dur);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + p.dur + 0.02);
    } else {
      const src = ctx.createBufferSource();
      src.buffer = noise();
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = p.band;
      band.Q.value = 1.1;
      src.connect(band);
      band.connect(gain);
      src.start(start, Math.random() * 0.5);
      src.stop(start + p.dur + 0.02);
    }
  };

  // A world's own files for cues: fetched once, checked, and used from then on. One that can't be used leaves the default.
  const buffers = new Map<Cue, AudioBuffer>();
  for (const [cue, address] of Object.entries(theme.cues) as [Cue, string | null][]) {
    if (!address) continue;
    void (async () => {
      try {
        const res = await fetch(address);
        if (!res.ok) return;
        const bytes = await res.arrayBuffer();
        if (bytes.byteLength > SOUND_LIMITS.cueBytes) return;
        const buffer = await ctx.decodeAudioData(bytes);
        if (buffer.duration <= SOUND_LIMITS.cueSeconds && !disposed) buffers.set(cue, buffer);
      } catch {
        /* the default stays */
      }
    })();
  }

  const last = new Map<Cue, number>();
  const play = (cue: Cue) => {
    if (disposed || levels.off || levels.effects <= 0 || ctx.state !== "running") return;
    if (theme.cues[cue] === null) return; // the world wants this one silent
    const now = ctx.currentTime;
    if (now - (last.get(cue) ?? -1) < (GAP[cue] ?? 0.03)) return;
    last.set(cue, now);
    const buffer = buffers.get(cue);
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(effects);
      src.start();
      return;
    }
    for (const part of cueRecipe(cue)) playPart(part, now + 0.005);
  };

  let walked = 0;
  const moved = (metres: number) => {
    if (!(metres > 0.0005)) return;
    if (metres > JUMP) {
      walked = 0;
      return play("land");
    }
    walked += metres;
    if (walked >= STRIDE) {
      walked = 0;
      play("step");
    }
  };

  // ------------------------------------------------------------- the place's music
  const kind: Sounds["music"] = theme.music === null ? "none" : theme.music ? "world" : "made";
  let stopMusic: (() => void) | null = null;
  const startMusic = () => {
    if (stopMusic || disposed || kind === "none") return;
    if (kind === "world") {
      const audio = new Audio(theme.music!);
      audio.loop = true;
      const node = ctx.createMediaElementSource(audio);
      node.connect(placeMusic);
      void audio.play().catch(() => {});
      stopMusic = () => {
        audio.pause();
        node.disconnect();
      };
      return;
    }
    // The kit's own: held notes that swell and fade, and a single note over them now and then.
    const plan = ambiencePlan(o.seed ?? location.host);
    const bed = ctx.createGain();
    bed.gain.value = 0.12;
    const colour = ctx.createBiquadFilter();
    colour.type = "lowpass";
    colour.frequency.value = plan.colour;
    colour.connect(bed);
    bed.connect(placeMusic);
    const running: AudioScheduledSourceNode[] = [];
    plan.drones.forEach((d, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? "sine" : "triangle";
      osc.frequency.value = d.hz;
      osc.detune.value = d.detune;
      const swell = ctx.createGain();
      swell.gain.value = i < 2 ? 0.3 : 0.14;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1 / d.swell;
      const depth = ctx.createGain();
      depth.gain.value = swell.gain.value * 0.8;
      lfo.connect(depth);
      depth.connect(swell.gain);
      osc.connect(swell);
      swell.connect(colour);
      osc.start();
      lfo.start();
      running.push(osc, lfo);
    });
    const random = seeded(`notes:${o.seed ?? location.host}`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const note = () => {
      if (disposed) return;
      if (ctx.state === "running" && !levels.off && levels.music > 0) {
        const hz = plan.root * plan.scale[Math.floor(random() * plan.scale.length)]! * (random() < 0.5 ? 2 : 4);
        const t = ctx.currentTime + 0.05;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = hz;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.11, t + 0.5);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 4.5);
        osc.connect(g);
        g.connect(bed);
        osc.start(t);
        osc.stop(t + 4.6);
      }
      timer = setTimeout(note, (plan.gap[0] + random() * (plan.gap[1] - plan.gap[0])) * 1000);
    };
    timer = setTimeout(note, 1500);
    stopMusic = () => {
      clearTimeout(timer);
      for (const n of running) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      bed.disconnect();
    };
  };

  // Nothing is heard before the visitor's first touch: a browser's rule, and a good one.
  const wake = () => {
    void ctx.resume().then(startMusic, () => {});
    if (ctx.state === "running") startMusic();
  };
  const onTouch = () => wake();
  addEventListener("pointerdown", onTouch, true);
  addEventListener("keydown", onTouch, true);
  if (ctx.state === "running") startMusic();

  // ------------------------------------------------------------- the visitor's own music
  const keepSongs = () => write(songsKey, songs);
  const stopOwn = () => {
    juke.audio?.pause();
    juke.playing = false;
    apply();
    changed();
  };
  const jukebox: Jukebox = {
    list: () => [...songs],
    async add(file) {
      const refusal = songRefusal({ type: file.type, size: file.size, ...(file.name ? { name: file.name } : {}) }, songs.length);
      if (refusal) return refusal;
      const id = `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const kept = await fileStore("readwrite", (s) => s.put(file, `song:${id}`));
      if (kept === undefined) return "This browser couldn't keep that file.";
      songs = cleanSongs([...songs, { id, title: songTitle(file.name ?? ""), size: file.size, at: Math.floor(Date.now() / 1000) }]);
      keepSongs();
      changed();
      return null;
    },
    async remove(id) {
      if (juke.current?.id === id) {
        stopOwn();
        juke.current = null;
      }
      songs = songs.filter((s) => s.id !== id);
      keepSongs();
      await fileStore("readwrite", (s) => s.delete(`song:${id}`));
      changed();
    },
    async play(id) {
      const song = id ? songs.find((s) => s.id === id) : (juke.current ?? songs[0]);
      if (!song || disposed) return false;
      if (!juke.audio) {
        juke.audio = new Audio();
        ctx.createMediaElementSource(juke.audio).connect(ownMusic);
        juke.audio.addEventListener("ended", () => void jukebox.next());
      }
      if (juke.current?.id !== song.id || !juke.url) {
        const file = await fileStore<Blob>("readonly", (s) => s.get(`song:${song.id}`));
        if (!file) return false;
        if (juke.url) URL.revokeObjectURL(juke.url);
        juke.url = URL.createObjectURL(file);
        juke.audio.src = juke.url;
        juke.current = song;
      }
      try {
        await ctx.resume();
        await juke.audio.play();
      } catch {
        juke.playing = false;
        apply();
        changed();
        return false;
      }
      juke.playing = true;
      apply();
      changed();
      return true;
    },
    pause: stopOwn,
    async next() {
      if (songs.length === 0) return false;
      const at = songs.findIndex((s) => s.id === juke.current?.id);
      return jukebox.play(songs[(at + 1) % songs.length]!.id);
    },
    get playing() {
      return juke.playing;
    },
    get current() {
      return juke.current;
    },
  };

  const samples = new Float32Array(meter.fftSize);
  return {
    play,
    moved,
    bump: () => play("bump"),
    get levels() {
      return levels;
    },
    setLevels(patch) {
      levels = cleanLevels({ ...levels, ...patch });
      write(levelsKey, levels);
      apply();
      changed();
    },
    jukebox,
    onChange(fn) {
      listeners.add(fn);
      fn(levels);
      return () => listeners.delete(fn);
    },
    music: kind,
    loudness() {
      meter.getFloatTimeDomainData(samples);
      return Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length);
    },
    dispose() {
      disposed = true;
      removeEventListener("pointerdown", onTouch, true);
      removeEventListener("keydown", onTouch, true);
      stopMusic?.();
      juke.audio?.pause();
      if (juke.url) URL.revokeObjectURL(juke.url);
      master.disconnect();
    },
  };
}

/**
 * The Sound part of a world's controls: the visitor's volumes and their own
 * music. It also makes the kit's controls heard: a press, the menu, and the
 * things other parts of the kit signal (joining a room, a microphone).
 */
export function addSoundControls(controls: Controls, sounds: Sounds): { refresh(): void } {
  const word = (v: number) => LEVEL_WORDS[levelStep(v)]!;
  let listed: string[] = [];
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "audio/*";
  picker.multiple = true;
  picker.hidden = true;
  document.body.append(picker);
  picker.addEventListener("change", async () => {
    let added = 0;
    let refused = "";
    for (const file of [...(picker.files ?? [])]) {
      const no = await sounds.jukebox.add(file);
      if (no) refused = no;
      else added++;
    }
    picker.value = "";
    controls.say(added ? `${added === 1 ? "1 song" : `${added} songs`} added. Only you hear your music.${refused ? ` ${refused}` : ""}` : refused || "Nothing was added.");
    refresh();
  });

  const refresh = () => {
    for (const id of listed) controls.remove(id);
    const songs = sounds.jukebox.list();
    listed = songs.map((s) => `song-${s.id}`);
    controls.addSection({
      id: "sound",
      label: "Sound",
      icon: "mic",
      note: () =>
        `${sounds.levels.off ? "All sound is off. " : ""}${
          sounds.music === "none" ? "This place has no music of its own." : sounds.music === "world" ? "This place plays its own music." : "This place's music is made by your browser, from its name."
        } Your own music is kept in this browser, for this site, and only you hear it.`,
    });
    songs.forEach((s, i) =>
      controls.add({
        id: listed[i]!,
        section: "sound",
        icon: "note",
        on: () => sounds.jukebox.playing && sounds.jukebox.current?.id === s.id,
        label: () => (sounds.jukebox.playing && sounds.jukebox.current?.id === s.id ? `Playing: ${s.title}` : s.title),
        act: async () => {
          if (sounds.jukebox.playing && sounds.jukebox.current?.id === s.id) sounds.jukebox.pause();
          else if (!(await sounds.jukebox.play(s.id))) controls.say(`${s.title} couldn't be played.`);
        },
      }),
    );
  };

  const level = (id: string, name: string, key: "effects" | "music" | "voices") => ({
    id,
    section: "sound",
    label: () => `${name}: ${word(sounds.levels[key])}`,
    on: () => sounds.levels[key] > 0,
    act: () => sounds.setLevels({ [key]: nextLevel(sounds.levels[key]) }),
  });
  controls.addSection({ id: "sound", label: "Sound", icon: "mic" });
  controls.add(
    {
      id: "sound-all",
      section: "sound",
      icon: () => (sounds.levels.off ? "micOff" : "mic"),
      on: () => !sounds.levels.off,
      label: () => (sounds.levels.off ? "All sound: off" : "All sound: on"),
      act: () => sounds.setLevels({ off: !sounds.levels.off }),
    },
    level("sound-effects", "Effects", "effects"),
    level("sound-music", "Music", "music"),
    level("sound-voices", "Voices", "voices"),
    {
      id: "juke-add",
      section: "sound",
      icon: "save",
      label: "Add music from this device",
      act: () => picker.click(),
    },
    {
      id: "juke-play",
      section: "sound",
      icon: "note",
      on: () => sounds.jukebox.playing,
      hidden: () => sounds.jukebox.list().length === 0,
      label: () => (sounds.jukebox.playing ? "Pause your music" : "Play your music"),
      act: async () => {
        if (sounds.jukebox.playing) return sounds.jukebox.pause();
        if (!(await sounds.jukebox.play())) controls.say("Your music couldn't be played.");
      },
    },
    {
      id: "juke-next",
      section: "sound",
      icon: "turn",
      hidden: () => sounds.jukebox.list().length < 2,
      label: "Next song",
      act: () => void sounds.jukebox.next(),
    },
    {
      id: "juke-remove",
      section: "sound",
      icon: "exit",
      hidden: () => !sounds.jukebox.current,
      label: () => `Take out ${sounds.jukebox.current?.title ?? "this song"}`,
      act: async () => {
        const song = sounds.jukebox.current;
        if (!song) return;
        await sounds.jukebox.remove(song.id);
        controls.say(`${song.title} was taken out of this browser.`);
        refresh();
      },
    },
  );
  refresh();
  // The kit's own controls, heard: whatever any part of it signals that is a cue, and a note when it speaks.
  controls.onSignal((name) => {
    if ((CUES as readonly string[]).includes(name)) sounds.play(name as Cue);
  });
  controls.onSay(() => sounds.play("notice"));
  // A volume or the jukebox changed somewhere else: the words here are worked out again.
  sounds.onChange(() => refresh());
  return { refresh };
}
