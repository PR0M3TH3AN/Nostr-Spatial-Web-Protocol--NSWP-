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
  JUMP_STEPS,
  cleanKit,
  cleanLevels,
  nextVariant,
  pieceName,
  stepShape,
  heardFrom,
  type SoundPlace,
  type StepShape,
  type KitSounds,
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
  type SoundTheme, STRIDE } from "./sound-store.js";
import { arrivedSettings, reportSettings } from "./settings.js";
import type { Controls } from "./ui/model.js";

export { CUES, type Cue, type Song, type SoundLevels, type SoundPlace, type SoundTheme } from "./sound-store.js";

export interface SoundsOptions {
  /** The page's sound context, if it has one already (three.js keeps one: `THREE.AudioContext.getContext()`). */
  context?: AudioContext;
  /** The world's own sounds. Left out, everything is the default. */
  theme?: SoundTheme | null;
  /** What the place's own music is made from when the world names none: its title is a good choice. */
  seed?: string;
  /** Where the theme's addresses are relative to. Left out, this page. */
  base?: string;
  /**
   * Where this site serves the kit's own sound files: a folder holding `sounds.json` (for example "/sounds/kit/").
   * With it, the defaults are those files: recorded cues, a hum, a piece of music. Without it, or where a file
   * can't be had, the defaults are the ones made in the browser.
   */
  kit?: string;
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
  /**
   * What the jukebox is playing, as a line that can be sent to someone else:
   * for sharing music with people nearby, which is the visitor's to turn on.
   * It is the music as it is, whatever their own volume is set to.
   */
  output(): MediaStreamTrack;
}

export interface Sounds {
  /**
   * Play a cue: the world's, the default, or nothing if it is silenced or the visitor has effects off. With
   * `from`, it is heard from where somebody stands: quieter and duller the further off, and to their side.
   */
  play(cue: Cue, from?: SoundPlace): void;
  /**
   * Tell it how far the visitor was moved this frame, in metres: it makes
   * the steps. A long way at once is a jump, and lands. Give it what moved
   * them (keys, a tap, a stick), not how their head swayed.
   */
  moved(metres: number): void;
  /** They walked into something. */
  bump(): void;
  /**
   * They jumped: two footsteps back to back, a little louder than a step (`JUMP_STEPS`). The world's own `step`
   * sound where it named one, silent where it silenced it, and at the visitor's own volume for effects.
   */
  jumped(): void;
  readonly levels: SoundLevels;
  setLevels(patch: Partial<SoundLevels>): void;
  /** The visitor's own music. */
  readonly jukebox: Jukebox;
  /** Be told when a volume or the jukebox changed. Called once at the start. */
  onChange(fn: (levels: SoundLevels) => void): () => void;
  /** What the place's music is: the world's own, the kit's recorded default, the one made in the browser, or none. */
  readonly music: "world" | "kit" | "made" | "none";
  /**
   * The piece of the place's music that is playing now, by name (its file's name), and how many pieces the place
   * has. Null when the place has none, when it is made in the browser, and before any has begun.
   */
  readonly piece: { name: string; of: number } | null;
  /** Go on to the place's next piece now. Returns false when there is only one, or none. */
  nextPiece(): boolean;
  /** Whether this place has a hum to hear. */
  readonly hasHum: boolean;
  /** How loud everything going out is right now, from 0. For tests. */
  loudness(): number;
  /**
   * Make a sound that isn't one of the kit's ready to play: an item's own (protocol/17-items.md). Null if it
   * isn't a sound, or runs longer than `FOREIGN_SOUND.seconds`. It is levelled as it is read, so that none can be
   * louder than the kit's own cues.
   */
  decode(bytes: Uint8Array): Promise<ForeignSound | null>;
  /**
   * Play one, at the visitor's own volume for effects. With `from` it is heard from where it happened: quieter
   * and duller the further off, to its side, and not at all beyond `FOREIGN_SOUND.gone` metres.
   */
  playForeign(sound: ForeignSound, from?: SoundPlace): void;
  /** How many sounds that aren't the kit's have been played. For tests. */
  readonly foreignPlayed: number;
  dispose(): void;
}

/** A sound that isn't one of the kit's own, ready to play. */
export interface ForeignSound {
  buffer: AudioBuffer;
  /** What it is turned down by, so its loudest moment is no louder than a cue's. */
  gain: number;
}

/** The longest such a sound may be, how loud its loudest moment may come out, and where it stops being heard. */
export const FOREIGN_SOUND = { seconds: 4, peak: 0.7, fades: 25, gone: 45 } as const;

/** The least time between two of the same cue, in seconds: so held keys and busy frames don't make a buzz. */
const GAP: Partial<Record<Cue, number>> = { step: 0.14, hover: 0.08, bump: 0.5, land: 0.2, notice: 0.25, chat: 0.3 };
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
  // The volumes they arrived with, if they came through a door, in place of what this site remembered: a visitor
  // who turned the music down in the last world doesn't have to do it again here (settings.ts).
  const came = arrivedSettings().sound;
  let levels = cleanLevels({ ...(read(levelsKey) as object | null), ...came });
  let songs = cleanSongs(read(songsKey));
  let disposed = false;
  if (came) write(levelsKey, levels);
  const stopReporting = reportSettings(
    "sound",
    () => ({ sound: { off: levels.off, effects: levels.effects, music: levels.music, voices: levels.voices, hum: levels.hum } }),
    // Their client's menu changed a volume (settings.ts, `changeSettings`): as their own hand on it here would.
    (now) => {
      if (!now.sound || disposed) return;
      levels = cleanLevels({ ...levels, ...now.sound });
      write(levelsKey, levels);
      apply();
      changed();
    },
  );

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
  // The room's hum sits with the place's music, with a switch of its own.
  const humGain = ctx.createGain();
  humGain.connect(placeMusic);

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
  const juke = { audio: null as HTMLAudioElement | null, url: "", current: null as Song | null, playing: false, tap: null as MediaStreamAudioDestinationNode | null };
  const apply = () => {
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(levels.off ? 0 : 1, t, 0.05);
    effects.gain.setTargetAtTime(levels.effects, t, 0.05);
    // The place's music steps back while the visitor's own plays.
    placeMusic.gain.setTargetAtTime(levels.music * (juke.playing ? 0.1 : 1), t, 0.4);
    ownMusic.gain.setTargetAtTime(levels.music, t, 0.05);
    humGain.gain.setTargetAtTime(levels.hum ? 1 : 0, t, 0.3);
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
  /** `to` is where it is heard through, and `rate` how much higher or lower than written it is played. */
  const playPart = (p: CuePart, when: number, to: AudioNode = effects, rate = 1) => {
    const start = when + p.at;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(p.gain, start + Math.min(0.006, p.dur / 3));
    gain.gain.exponentialRampToValueAtTime(0.0008, start + p.dur);
    gain.connect(to);
    if (p.kind === "tone") {
      const osc = ctx.createOscillator();
      osc.type = p.wave;
      osc.frequency.setValueAtTime(p.from * rate, start);
      if (p.to !== undefined) osc.frequency.exponentialRampToValueAtTime(p.to * rate, start + p.dur);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + p.dur + 0.02);
    } else {
      const src = ctx.createBufferSource();
      src.buffer = noise();
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = p.band * rate;
      band.Q.value = 1.1;
      src.connect(band);
      band.connect(gain);
      src.start(start, Math.random() * 0.5);
      src.stop(start + p.dur + 0.02);
    }
  };

  // A world's own files for cues: fetched once, checked, and used from then on. One that can't be used leaves the default.
  /** How loud a cue of a world's own is let be: about what the loudest default is. A quieter file is left alone. */
  const CUE_LOUDNESS = 0.14;
  const loudnessOf = (buffer: AudioBuffer): number => {
    let sum = 0;
    let n = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i += 4) {
        sum += data[i]! * data[i]!;
        n++;
      }
    }
    return n ? Math.sqrt(sum / n) : 0;
  };
  const loadCue = async (address: string): Promise<{ buffer: AudioBuffer; gain: number } | null> => {
    try {
      const res = await fetch(address);
      if (!res.ok) return null;
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength > SOUND_LIMITS.cueBytes) return null;
      const buffer = await ctx.decodeAudioData(bytes);
      if (buffer.duration > SOUND_LIMITS.cueSeconds || disposed) return null;
      // Whoever supplies a cue chooses what it sounds like, not how loud it is: a loud file is brought down to the others.
      const loud = loudnessOf(buffer);
      return { buffer, gain: loud > CUE_LOUDNESS ? CUE_LOUDNESS / loud : 1 };
    } catch {
      return null; // the next default stays
    }
  };
  type Loaded = { buffer: AudioBuffer; gain: number }[];
  /** The world's own files for each cue, and the kit's. Several for one cue are chosen among each time. */
  const own = new Map<Cue, Loaded>();
  const fromKit = new Map<Cue, Loaded>();
  const loadInto = (into: Map<Cue, Loaded>, files: Partial<Record<Cue, string[] | null>>) => {
    for (const [cue, addresses] of Object.entries(files) as [Cue, string[] | null][]) {
      for (const address of addresses ?? []) {
        void loadCue(address).then((loaded) => {
          if (loaded) into.set(cue, [...(into.get(cue) ?? []), loaded]);
        });
      }
    }
  };

  // The kit's own files, where this site serves them. What they are is read at once; the files themselves are
  // fetched at the visitor's first touch, with everything else that makes a sound.
  let kit: KitSounds = { cues: {} };
  const kitReady: Promise<void> = o.kit
    ? (async () => {
        try {
          const folder = new URL(o.kit!.endsWith("/") ? o.kit! : `${o.kit}/`, base).href;
          const res = await fetch(new URL("sounds.json", folder).href);
          if (!res.ok) return;
          const playsOgg = new Audio().canPlayType('audio/ogg; codecs="opus"') !== "";
          kit = cleanKit(await res.json(), folder, playsOgg);
        } catch {
          /* no kit files here: the defaults are the made ones */
        }
      })()
    : Promise.resolve();
  let cuesAsked = false;
  const loadCues = () => {
    if (cuesAsked || disposed) return;
    cuesAsked = true;
    loadInto(own, theme.cues);
    void kitReady.then(() => {
      // Only the cues the world hasn't spoken for.
      const rest = Object.fromEntries(Object.entries(kit.cues).filter(([cue]) => theme.cues[cue as Cue] === undefined));
      loadInto(fromKit, rest);
    });
  };

  const last = new Map<Cue, number>();
  const lastVariant = new Map<Cue, number>();
  let foot = 0;
  /** Somewhere for one step to be heard through: softened, turned down and set a little to one side. */
  const shaped = (shape: StepShape): AudioNode => {
    const soft = ctx.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = shape.cutoff;
    soft.Q.value = 0.5;
    const level = ctx.createGain();
    level.gain.value = shape.gain;
    soft.connect(level);
    if (typeof ctx.createStereoPanner === "function") {
      const side = ctx.createStereoPanner();
      side.pan.value = shape.pan;
      level.connect(side);
      side.connect(effects);
    } else level.connect(effects);
    return soft;
  };
  let foreignPlayed = 0;
  const play = (cue: Cue, from?: SoundPlace) => {
    if (disposed || levels.off || levels.effects <= 0 || ctx.state !== "running") return;
    if (theme.cues[cue] === null) return; // the world wants this one silent
    const now = ctx.currentTime;
    if (now - (last.get(cue) ?? -1) < (GAP[cue] ?? 0.03)) return;
    last.set(cue, now);
    sound(cue, now, from);
  };
  /**
   * Make one cue heard, starting at `at` (the context's time). `louder` raises a footstep's level: for a jump.
   * A footstep is quieter than any other cue, and no two are alike (sound-store.ts, stepShape). And one made by
   * somebody is heard from where they stand (heardFrom).
   */
  const sound = (cue: Cue, at: number, from?: SoundPlace, louder = 1) => {
    const now = at;
    const stepped = cue === "step" ? stepShape(foot++) : null;
    const shape = stepped ? { ...stepped, gain: stepped.gain * louder } : from ? heardFrom(from) : null;
    const out = shape ? shaped(shape) : effects;
    const files = own.get(cue) ?? fromKit.get(cue);
    if (files?.length) {
      const which = nextVariant(files.length, lastVariant.get(cue) ?? -1);
      lastVariant.set(cue, which);
      const src = ctx.createBufferSource();
      src.buffer = files[which]!.buffer;
      if (shape) src.playbackRate.value = shape.rate;
      const level = ctx.createGain();
      level.gain.value = files[which]!.gain;
      src.connect(level);
      level.connect(out);
      src.start(now);
      return;
    }
    for (const part of cueRecipe(cue)) playPart(part, now + 0.005, out, shape?.rate ?? 1);
  };
  /** A jump: two footsteps back to back, each its own, a little louder than a step. */
  const jumped = () => {
    if (disposed || levels.off || levels.effects <= 0 || ctx.state !== "running") return;
    if (theme.cues.step === null) return; // the world silenced its steps: its jumps too
    const now = ctx.currentTime;
    sound("step", now, undefined, JUMP_STEPS.louder);
    sound("step", now + JUMP_STEPS.gap, undefined, JUMP_STEPS.louder);
    // A step taken just after is still spaced from these, as steps are.
    last.set("step", now + JUMP_STEPS.gap);
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
  /**
   * Plays pieces of sound one after another for as long as it is asked to, each fading into the next with the
   * loudness held level (one gain falls as a cosine while the other rises as a sine). With one piece, it fades
   * into itself. Each is played as it arrives, not held whole in memory: a minute of music held whole is tens of
   * megabytes, and a headset or a phone has better uses for them.
   */
  const loopPlayer = (tracks: string[], into: AudioNode, opts: { fade?: number; gain?: number; onFail?: () => void; onTurn?: () => void } = {}) => {
    const fade = opts.fade ?? 2;
    const out = ctx.createGain();
    out.gain.value = opts.gain ?? 1;
    out.connect(into);
    const deck = () => {
      const audio = new Audio();
      audio.preload = "auto";
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(audio).connect(gain);
      gain.connect(out);
      return { audio, gain };
    };
    const decks = [deck(), deck()];
    let active = 0;
    let index = 0;
    /** The piece that is heard: it changes when the next has begun, not when it was asked for. */
    let heard = 0;
    let turning = false;
    let stopped = false;
    const curve = (rising: boolean) => Float32Array.from({ length: 32 }, (_, k) => (rising ? Math.sin : Math.cos)(((k / 31) * Math.PI) / 2));
    const turn = () => {
      if (turning || stopped) return;
      turning = true;
      const from = decks[active]!;
      const to = decks[1 - active]!;
      index = (index + 1) % tracks.length;
      to.audio.src = tracks[index]!;
      to.audio.currentTime = 0;
      void to.audio.play().then(
        () => {
          const t = ctx.currentTime + 0.02;
          from.gain.gain.cancelScheduledValues(t);
          to.gain.gain.cancelScheduledValues(t);
          from.gain.gain.setValueCurveAtTime(curve(false), t, fade);
          to.gain.gain.setValueCurveAtTime(curve(true), t, fade);
          active = 1 - active;
          heard = index;
          opts.onTurn?.();
          setTimeout(() => {
            from.audio.pause();
            turning = false;
          }, (fade + 0.1) * 1000);
        },
        () => {
          turning = false;
        },
      );
    };
    for (const d of decks) {
      // Near the end of a piece, the next begins under it.
      d.audio.addEventListener("timeupdate", () => {
        if (d !== decks[active] || !Number.isFinite(d.audio.duration)) return;
        if (d.audio.duration - d.audio.currentTime <= fade + 0.35) turn();
      });
      // A piece that ran out before its turn came (a stalled tab) still hands on.
      d.audio.addEventListener("ended", () => {
        if (d === decks[active]) turn();
      });
      d.audio.addEventListener("error", () => {
        if (stopped || d !== decks[active] || turning) return;
        stopped = true;
        opts.onFail?.();
      });
    }
    const first = decks[0]!;
    first.audio.src = tracks[0]!;
    void first.audio.play().then(
      () => first.gain.gain.setTargetAtTime(1, ctx.currentTime, 0.8),
      () => {},
    );
    return {
      stop() {
        stopped = true;
        for (const d of decks) {
          d.audio.pause();
          d.audio.removeAttribute("src");
        }
        out.disconnect();
      },
      /** How many times one piece has handed on to the next. For tests. */
      get index() {
        return index;
      },
      /** Where the piece that is heard now is kept. */
      get now() {
        return tracks[heard]!;
      },
      get count() {
        return tracks.length;
      },
      /** Hand on to the next piece now. */
      next() {
        if (tracks.length < 2 || turning || stopped) return false;
        turn();
        return true;
      },
    };
  };

  let kind: Sounds["music"] = theme.music === null ? "none" : theme.music ? "world" : "made";
  let stopMusic: (() => void) | null = null;
  /** The place's recorded music, while it is playing: which piece, and the way on to the next. */
  let pieces: { readonly now: string; readonly count: number; next(): boolean } | null = null;
  let stopHum: (() => void) | null = null;
  let humAddress: string | null = null;
  let musicAsked = false;
  const startMusic = () => {
    if (musicAsked || disposed) return;
    musicAsked = true;
    loadCues();
    void kitReady.then(() => {
      if (disposed) return;
      // The hum: the world's, or the kit's unless the world said none.
      humAddress = theme.hum === null ? null : (theme.hum ?? kit.hum ?? null);
      if (humAddress) stopHum = loopPlayer([humAddress], humGain, { gain: 0.55 }).stop;
      // The music: the world's, else the kit's recorded piece, else the one made here.
      const tracks = theme.music === null ? null : (theme.music ?? kit.music ?? null);
      if (theme.music === undefined && kit.music) kind = "kit";
      changed();
      if (theme.music === null) return;
      if (tracks) {
        // A piece that can't be played here (a kind of file this browser doesn't know) gives way to the made one.
        const player = loopPlayer(tracks, placeMusic, {
          gain: 0.6,
          onTurn: () => changed(),
          onFail: () => {
            stopMusic?.();
            pieces = null;
            kind = "made";
            stopMusic = madeMusic();
            changed();
          },
        });
        pieces = player;
        stopMusic = player.stop;
        changed();
        return;
      }
      stopMusic = madeMusic();
    });
  };
  const madeMusic = (): (() => void) => {
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
    return () => {
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
  /** The one player the visitor's songs go through, made when it is first needed. */
  const player = (): { audio: HTMLAudioElement; tap: MediaStreamAudioDestinationNode } => {
    if (!juke.audio || !juke.tap) {
      juke.audio = new Audio();
      const source = ctx.createMediaElementSource(juke.audio);
      source.connect(ownMusic);
      // A second way out, before the visitor's own volume: what would be shared, if they share.
      juke.tap = ctx.createMediaStreamDestination();
      source.connect(juke.tap);
      juke.audio.addEventListener("ended", () => void jukebox.next());
    }
    return { audio: juke.audio, tap: juke.tap };
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
      player();
      if (juke.current?.id !== song.id || !juke.url) {
        const file = await fileStore<Blob>("readonly", (s) => s.get(`song:${song.id}`));
        if (!file) return false;
        if (juke.url) URL.revokeObjectURL(juke.url);
        juke.url = URL.createObjectURL(file);
        juke.audio!.src = juke.url;
        juke.current = song;
      }
      try {
        await ctx.resume();
        await juke.audio!.play();
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
    output: () => player().tap.stream.getAudioTracks()[0]!,
  };

  const samples = new Float32Array(meter.fftSize);
  return {
    play,
    moved,
    bump: () => play("bump"),
    jumped,
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
    get music() {
      return kind;
    },
    get piece() {
      return pieces ? { name: pieceName(pieces.now), of: pieces.count } : null;
    },
    nextPiece() {
      return pieces?.next() ?? false;
    },
    get hasHum() {
      return !!humAddress;
    },
    async decode(bytes) {
      try {
        const buffer = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
        if (!(buffer.duration > 0) || buffer.duration > FOREIGN_SOUND.seconds) return null;
        let peak = 0;
        for (let c = 0; c < buffer.numberOfChannels; c++) for (const x of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(x));
        return { buffer, gain: peak > 0 ? Math.min(1, FOREIGN_SOUND.peak / peak) : 1 };
      } catch {
        return null;
      }
    },
    playForeign(sound, from) {
      if (disposed || levels.off || levels.effects <= 0 || ctx.state !== "running") return;
      // Beyond where the kit's own sounds have gone dull, these go on down to nothing: a dart landing a long way
      // off isn't heard at all.
      const far = from && Number.isFinite(from.distance) ? Math.max(0, from.distance) : 0;
      const reach = far <= FOREIGN_SOUND.fades ? 1 : Math.max(0, 1 - (far - FOREIGN_SOUND.fades) / (FOREIGN_SOUND.gone - FOREIGN_SOUND.fades));
      if (reach <= 0) return;
      const src = ctx.createBufferSource();
      src.buffer = sound.buffer;
      const level = ctx.createGain();
      level.gain.value = sound.gain * reach;
      src.connect(level);
      level.connect(from ? shaped(heardFrom(from)) : effects);
      src.start();
      foreignPlayed++;
    },
    get foreignPlayed() {
      return foreignPlayed;
    },
    loudness() {
      meter.getFloatTimeDomainData(samples);
      return Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length);
    },
    dispose() {
      stopReporting();
      disposed = true;
      removeEventListener("pointerdown", onTouch, true);
      removeEventListener("keydown", onTouch, true);
      stopMusic?.();
      stopHum?.();
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
      icon: "sound",
      note: () =>
        `${sounds.levels.off ? "All sound is off. " : ""}${
          sounds.music === "none"
            ? "This place has no music of its own."
            : sounds.music === "world"
              ? "This place plays its own music."
              : sounds.music === "kit"
                ? "This place plays the music every world starts with."
                : "This place's music is made by your browser, from its name."
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
  controls.addSection({ id: "sound", label: "Sound", icon: "sound" });
  controls.add(
    {
      id: "sound-all",
      section: "sound",
      icon: () => (sounds.levels.off ? "soundOff" : "sound"),
      on: () => !sounds.levels.off,
      label: () => (sounds.levels.off ? "All sound: off" : "All sound: on"),
      act: () => sounds.setLevels({ off: !sounds.levels.off }),
    },
    level("sound-effects", "Effects", "effects"),
    level("sound-music", "Music", "music"),
    {
      // What the place is playing, by name, so a visitor can say which piece they mean. Pressing goes on to the next.
      id: "sound-piece",
      section: "sound",
      icon: "note",
      hidden: () => sounds.music === "none" || sounds.music === "made" || !sounds.piece,
      label: () => {
        const p = sounds.piece;
        if (!p) return "This place's music";
        return `Playing here: ${p.name}${p.of > 1 ? `. Next of ${p.of}` : ""}`;
      },
      act: () => {
        const p = sounds.piece;
        if (!p) return;
        if (sounds.nextPiece()) controls.say(`Going on from ${p.name} to this place's next piece.`);
        else controls.say(`${p.name} is the only piece this place has. Music: off, above, silences it.`);
      },
    },
    level("sound-voices", "Voices", "voices"),
    {
      id: "sound-hum",
      section: "sound",
      icon: "sound",
      on: () => sounds.levels.hum,
      hidden: () => !sounds.hasHum,
      label: () => (sounds.levels.hum ? "The room's hum: on" : "The room's hum: off"),
      act: () => sounds.setLevels({ hum: !sounds.levels.hum }),
    },
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
