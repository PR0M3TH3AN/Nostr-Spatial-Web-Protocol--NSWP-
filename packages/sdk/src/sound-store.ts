/**
 * What the kit's sounds are made of, with nothing that needs a browser:
 * the list of cues and how each default is built, what a world may put in
 * their place, the visitor's volumes, the music a place makes when nobody
 * gave it any, and the list of a visitor's own songs.
 *
 * Kept apart from the part that makes noise (sound.ts) so every rule here
 * can be tested without one.
 */

/**
 * Every sound the kit makes for something that happened. A closed list: a
 * world can replace or silence any of them, and can't add to it, so a
 * visitor's "effects" volume always covers everything a world plays through
 * the kit.
 */
export const CUES = [
  "step", // a footstep, walking
  "land", // arriving at the end of a jump: a step in a headset, or one taken at once
  "bump", // walking into something that can't be walked through
  "grab",
  "drop",
  "hover",
  "press",
  "menuOpen",
  "menuClose",
  "cross", // leaving through a door
  "arrive", // coming out of one
  "join", // someone is in the room who wasn't: the visitor, or another person
  "leave",
  "micOn",
  "micOff",
  "notice", // the kit has something to say
  "chat", // someone in the room wrote something: heard from where they stand
  "error",
] as const;
export type Cue = (typeof CUES)[number];

/** One piece of a default cue: a tone that may slide, or a breath of filtered noise. Times in seconds. */
export type CuePart =
  | { kind: "tone"; wave: "sine" | "triangle" | "square"; from: number; to?: number; at: number; dur: number; gain: number }
  | { kind: "noise"; band: number; at: number; dur: number; gain: number };

const tone = (from: number, to: number | undefined, at: number, dur: number, gain: number, wave: "sine" | "triangle" | "square" = "sine"): CuePart => ({
  kind: "tone",
  wave,
  from,
  ...(to === undefined ? {} : { to }),
  at,
  dur,
  gain,
});
const noise = (band: number, at: number, dur: number, gain: number): CuePart => ({ kind: "noise", band, at, dur, gain });

/**
 * The defaults: made in the browser from tones and noise, so there is no
 * file to fetch, nothing to license, and nothing that can fail to load. They
 * are short and quiet on purpose. A sound heard a thousand times a visit
 * should be one nobody notices until it is missing.
 */
const RECIPES: Record<Cue, CuePart[]> = {
  step: [noise(850, 0, 0.06, 0.2), tone(120, 70, 0, 0.07, 0.16)],
  land: [tone(190, 62, 0, 0.16, 0.3), noise(480, 0, 0.11, 0.2)],
  bump: [tone(96, 58, 0, 0.12, 0.28, "triangle"), noise(260, 0, 0.05, 0.14)],
  grab: [tone(520, 780, 0, 0.07, 0.16, "triangle")],
  drop: [tone(700, 420, 0, 0.08, 0.16, "triangle")],
  hover: [tone(1400, undefined, 0, 0.025, 0.05)],
  press: [tone(880, 1320, 0, 0.05, 0.15, "triangle")],
  menuOpen: [tone(660, undefined, 0, 0.05, 0.12), tone(990, undefined, 0.05, 0.07, 0.12)],
  menuClose: [tone(990, undefined, 0, 0.05, 0.12), tone(660, undefined, 0.05, 0.07, 0.12)],
  cross: [tone(196, 784, 0, 0.5, 0.22), noise(1400, 0.05, 0.45, 0.07), tone(392, 1568, 0.1, 0.4, 0.08)],
  arrive: [tone(784, 392, 0, 0.42, 0.2), tone(1176, 588, 0.04, 0.38, 0.08), noise(900, 0, 0.2, 0.05)],
  join: [tone(523.25, undefined, 0, 0.09, 0.14), tone(783.99, undefined, 0.09, 0.14, 0.14)],
  leave: [tone(783.99, undefined, 0, 0.09, 0.12), tone(523.25, undefined, 0.09, 0.14, 0.12)],
  micOn: [tone(600, 900, 0, 0.08, 0.14)],
  micOff: [tone(900, 600, 0, 0.08, 0.14)],
  notice: [tone(1046.5, undefined, 0, 0.08, 0.09), tone(1318.5, undefined, 0.08, 0.12, 0.08)],
  // Two soft syllables, low and falling at the end, with a breath in front: somebody said something. It is two
  // octaves under the kit's own notice, which is high, clean and rises, so the two are never taken for each other.
  chat: [noise(1900, 0, 0.03, 0.06), tone(360, 440, 0.005, 0.07, 0.15, "triangle"), tone(330, 262, 0.1, 0.11, 0.13, "triangle")],
  error: [tone(220, undefined, 0, 0.11, 0.13, "square"), tone(185, undefined, 0.14, 0.14, 0.13, "square")],
};

export function cueRecipe(cue: Cue): CuePart[] {
  return RECIPES[cue];
}

/** How long a recipe lasts, in seconds. */
export function recipeLength(parts: CuePart[]): number {
  return parts.reduce((end, p) => Math.max(end, p.at + p.dur), 0);
}

export const SOUND_LIMITS = {
  /** A world's own cue: a file this size at most, this long at most. Longer ones aren't sounds for something that happened. */
  cueBytes: 512 * 1024,
  cueSeconds: 3,
  /** Kinds of file a world may name. */
  extensions: ["ogg", "oga", "opus", "mp3", "m4a", "aac", "wav", "webm", "flac"],
  /** Files for one cue: one is chosen each time, so a sound heard often isn't the same sound every time. */
  variants: 6,
  /** Pieces of music for one place: they play in turn. */
  tracks: 8,
  /** The visitor's own songs: this many, each this size at most. */
  songs: 60,
  songBytes: 40 * 1024 * 1024,
  titleChars: 80,
} as const;

/**
 * A world's sounds. For each cue: an address of a file on the world's own
 * site to play instead, or null for silence. A cue it doesn't name keeps the
 * default. `music` is what plays in the place: an address, null for none, or
 * left out for the music the kit makes.
 */
export interface SoundTheme {
  /** A file, or several to choose among each time, or null for silence. */
  cues?: Partial<Record<Cue, string | string[] | null>>;
  /** A piece of music, or several to play in turn, or null for none. */
  music?: string | string[] | null;
  /**
   * A steady sound under the music: a room's hum. An address, null for
   * none, or left out for the kit's own where the kit's sounds are served.
   */
  hum?: string | null;
}

/** The same, read and checked: every address is on the world's own site and names a sound file. */
export interface CleanTheme {
  cues: Partial<Record<Cue, string[] | null>>;
  music?: string[] | null;
  hum?: string | null;
}

function ownSound(address: unknown, base: string): string | null {
  if (typeof address !== "string" || address.length > 2000) return null;
  let u: URL;
  let b: URL;
  try {
    b = new URL(base);
    u = new URL(address, b);
  } catch {
    return null;
  }
  // A world's sounds come from the world. Another site's file would tell that site who is here.
  if (u.origin !== b.origin || (u.protocol !== "https:" && u.protocol !== "http:")) return null;
  const ext = u.pathname.split(".").pop()?.toLowerCase() ?? "";
  if (!(SOUND_LIMITS.extensions as readonly string[]).includes(ext)) return null;
  u.hash = "";
  return u.href;
}

/** One address or several, as the ones that can be used, up to a limit. */
function ownSounds(value: unknown, base: string, limit: number): string[] {
  const out: string[] = [];
  for (const v of Array.isArray(value) ? value : [value]) {
    const address = ownSound(v, base);
    if (address && !out.includes(address)) out.push(address);
    if (out.length >= limit) break;
  }
  return out;
}

/** Read a world's theme, trusting nothing in it. What can't be used falls back to the default, never to silence. */
export function cleanTheme(input: unknown, base: string): CleanTheme {
  const out: CleanTheme = { cues: {} };
  if (!input || typeof input !== "object") return out;
  const { cues, music, hum } = input as Record<string, unknown>;
  if (cues && typeof cues === "object") {
    for (const cue of CUES) {
      const v = (cues as Record<string, unknown>)[cue];
      if (v === null) out.cues[cue] = null;
      else if (v !== undefined) {
        const files = ownSounds(v, base, SOUND_LIMITS.variants);
        if (files.length) out.cues[cue] = files;
      }
    }
  }
  if (music === null) out.music = null;
  else if (music !== undefined) {
    const tracks = ownSounds(music, base, SOUND_LIMITS.tracks);
    if (tracks.length) out.music = tracks;
  }
  if (hum === null) out.hum = null;
  else if (hum !== undefined) {
    const address = ownSound(hum, base);
    if (address) out.hum = address;
  }
  return out;
}

/**
 * The kit's own sound files, as a site serves them: a folder holding
 * `sounds.json` and the files it names. Each sound may come in two forms,
 * because no one form plays in every browser: `{ "ogg": "…", "mp3": "…" }`.
 */
export interface KitSounds {
  cues: Partial<Record<Cue, string[]>>;
  music?: string[];
  hum?: string;
}

/** Read the kit's `sounds.json`, choosing for each sound the form this browser plays. Addresses are relative to the folder. */
export function cleanKit(input: unknown, folder: string, playsOgg: boolean): KitSounds {
  const out: KitSounds = { cues: {} };
  if (!input || typeof input !== "object") return out;
  const pick = (entry: unknown): unknown => {
    if (!entry || typeof entry !== "object") return entry;
    const { ogg, mp3 } = entry as Record<string, unknown>;
    return playsOgg ? (ogg ?? mp3) : (mp3 ?? ogg);
  };
  const many = (value: unknown, limit: number) => ownSounds((Array.isArray(value) ? value : [value]).map(pick), folder, limit);
  const { cues, music, hum } = input as Record<string, unknown>;
  if (cues && typeof cues === "object") {
    for (const cue of CUES) {
      const files = many((cues as Record<string, unknown>)[cue], SOUND_LIMITS.variants);
      if (files.length) out.cues[cue] = files;
    }
  }
  const tracks = many(music, SOUND_LIMITS.tracks);
  if (tracks.length) out.music = tracks;
  const h = ownSound(pick(hum), folder);
  if (h) out.hum = h;
  return out;
}

/**
 * What a piece of music is called, from where it is kept: the file's own name, without what kind of file it is.
 * It is what a visitor reads in the menu, and what they can tell whoever runs the place if they'd rather not
 * hear it.
 */
export function pieceName(address: string): string {
  let name = address;
  try {
    name = decodeURIComponent(new URL(address, "https://x.invalid/").pathname.split("/").pop() ?? "");
  } catch {
    name = address.split(/[/?#]/).filter(Boolean).pop() ?? "";
  }
  name = name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[\u0000-\u001f]/g, "").trim();
  return name.slice(0, 60) || "a piece with no name";
}

/**
 * How one footstep differs from the last. No two real steps sound alike: the
 * weight on each foot differs, and so does what is under it. And a step is a
 * quiet thing, heard a thousand times a visit, so it sits well under every
 * other cue.
 */
export interface StepShape {
  /** How loud, as a share of what any other cue is. */
  gain: number;
  /** How fast it is played: above 1 is higher and shorter, below is lower and longer. */
  rate: number;
  /** Where its brightness is cut off, in hertz: a lower number is a softer tread. */
  cutoff: number;
  /** Which side it is on, from -1 (left) to 1: a little to the side of the foot that made it. */
  pan: number;
}

/** How loud the loudest step is, beside any other cue. */
export const STEP_LEVEL = 0.45;

/**
 * A jump is heard as two footsteps back to back, a little louder than a step (the owner, 2026-11-21: "play two of
 * our random footstep sounds back to back and slightly louder"). `louder`: how much a step's level is raised, 1.35
 * times (about 2.6 dB), which keeps the loudest jump step at 0.61 beside any other cue, still quieter than every one
 * of them. `gap`: the seconds from the first step to the second. Each is a footstep of its own (`stepShape`), so no
 * two jumps sound the same either.
 */
export const JUMP_STEPS = { louder: 1.35, gap: 0.09 } as const;

/**
 * The shape of the step a foot makes: `foot` counts steps, so even ones are
 * the left foot and odd ones the right. The two feet differ a little and
 * steadily, and every step differs a little more by chance.
 */
/** Where a sound made by somebody comes from: how far off they are, in metres, and how far to one side (-1 left, 1 right). */
/** How far a visitor walks between steps, in metres: the pace of their footsteps, and of anything that keeps time with them. */
export const STRIDE = 0.75;

export interface SoundPlace {
  distance: number;
  pan?: number;
}
/** Within `near` metres a sound is as written. By `far` it is as dull as it gets. It is never quieter than `floor`. */
export const HEARD = { near: 2, far: 25, floor: 0.14, fall: 6 } as const;
/**
 * How a sound made by somebody is heard from where they stand: quieter and
 * duller the further off, and to the side they are on. It never goes silent,
 * because what it says (someone wrote something) is true however far they
 * are; distance says where, not whether.
 */
export function heardFrom(place: SoundPlace): StepShape {
  const d = Number.isFinite(place.distance) ? Math.max(0, place.distance) : HEARD.far;
  const beyond = Math.max(0, d - HEARD.near);
  const gain = Math.max(HEARD.floor, 1 / (1 + (beyond / HEARD.fall) ** 2));
  const along = Math.min(1, beyond / (HEARD.far - HEARD.near));
  // From bright to dull, evenly by ear: 7000 Hz close by, 1100 Hz far off.
  const cutoff = Math.round(7000 * (1100 / 7000) ** along);
  const side = Number.isFinite(place.pan) ? Math.max(-1, Math.min(1, place.pan!)) : 0;
  return { gain: Math.round(gain * 1000) / 1000, cutoff, pan: Math.round(side * 0.8 * 100) / 100, rate: 1 };
}

export function stepShape(foot: number, random: () => number = Math.random): StepShape {
  const right = Math.abs(Math.trunc(foot)) % 2 === 1;
  const side = right ? 1 : -1;
  return {
    // Between a little over half and all of the step's level: a light tread now and then.
    gain: STEP_LEVEL * (0.6 + 0.4 * random()),
    // One foot falls a touch lower than the other, and each step is up to a semitone and a half either way.
    rate: (1 + side * 0.025) * Math.pow(2, (random() * 2 - 1) * (1.5 / 12)),
    cutoff: 1600 + random() * 3400,
    pan: side * (0.08 + random() * 0.1),
  };
}

/** Which of several to play next: any but the one just played, so nothing is heard twice running. */
export function nextVariant(count: number, last: number, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  if (last < 0 || last >= count) return Math.min(count - 1, Math.floor(random() * count));
  const i = Math.floor(random() * (count - 1));
  return i >= last ? i + 1 : i;
}

// ------------------------------------------------------------------ volumes

/** The visitor's volumes, each from 0 to 1. Theirs, kept for this site, and nothing a world sets. */
export interface SoundLevels {
  /** Everything off, whatever the rest says. */
  off: boolean;
  /** Cues: steps, presses, doors. */
  effects: number;
  /** The place's music, and the visitor's own. */
  music: number;
  /** Other people's voices. */
  voices: number;
  /**
   * Whether to hear music that people nearby are sharing. Off until the
   * visitor turns it on: nobody's music reaches anyone who didn't ask.
   */
  hearShared: boolean;
  /** How loud other people's music is. */
  shared: number;
  /** Whether the room's hum is heard: the steady sound under the music, where a place has one. */
  hum: boolean;
}

export const DEFAULT_LEVELS: SoundLevels = { off: false, effects: 0.7, music: 0.45, voices: 1, hearShared: false, shared: 0.7, hum: true };
/** The steps a volume goes through when its control is pressed. */
export const LEVEL_STEPS = [0, 0.35, 0.7, 1] as const;
export const LEVEL_WORDS = ["off", "low", "medium", "high"] as const;

const unit = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

export function cleanLevels(input: unknown): SoundLevels {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    off: i.off === true,
    effects: unit(i.effects, DEFAULT_LEVELS.effects),
    music: unit(i.music, DEFAULT_LEVELS.music),
    voices: unit(i.voices, DEFAULT_LEVELS.voices),
    hearShared: i.hearShared === true,
    shared: unit(i.shared, DEFAULT_LEVELS.shared),
    hum: i.hum !== false,
  };
}

/** Which step a volume is nearest, from 0 to 3. */
export function levelStep(v: number): number {
  let best = 0;
  LEVEL_STEPS.forEach((s, i) => {
    if (Math.abs(s - v) < Math.abs(LEVEL_STEPS[best]! - v)) best = i;
  });
  return best;
}

/** The next volume up, going round to off after the highest. */
export function nextLevel(v: number): number {
  return LEVEL_STEPS[(levelStep(v) + 1) % LEVEL_STEPS.length]!;
}

// ------------------------------------------------------- music shared by people nearby

/** How far someone's shared music carries, in metres. Past it, it isn't asked for and isn't sent. */
export const MUSIC_RANGE = 12;
/** How many people's music one visitor hears at once: the nearest. More than this is noise. */
export const MUSIC_SOURCES = 2;
/** How much shared music steps back while someone is speaking. */
export const MUSIC_DUCK = 0.35;

/**
 * Whose music to listen to: of the people sharing, the nearest few within
 * range, leaving out anyone the visitor has stopped hearing. Returns their
 * keys, nearest first.
 */
export function musicToHear(sharing: { pubkey: string; metres: number; refused?: boolean }[], hear: boolean): string[] {
  if (!hear) return [];
  return sharing
    .filter((s) => !s.refused && Number.isFinite(s.metres) && s.metres <= MUSIC_RANGE)
    .sort((a, b) => a.metres - b.metres || a.pubkey.localeCompare(b.pubkey))
    .slice(0, MUSIC_SOURCES)
    .map((s) => s.pubkey);
}

/** How much of someone's music is left at this distance, from 1 beside them to 0 at the edge of its range. */
export function musicFade(metres: number): number {
  if (!(metres >= 0)) return 0;
  const near = 2;
  if (metres <= near) return 1;
  if (metres >= MUSIC_RANGE) return 0;
  const t = (metres - near) / (MUSIC_RANGE - near);
  return (1 - t) * (1 - t);
}

// ------------------------------------------------------- the place's own music

/** A small generator of numbers from a seed: the same seed, the same numbers, on every device. */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AmbiencePlan {
  /** The note everything hangs from, in hertz. */
  root: number;
  /** The notes it may play, as multiples of the root, within one octave. */
  scale: number[];
  /** Notes held under everything: a frequency, how far it drifts in cents, and how many seconds its swell takes. */
  drones: { hz: number; detune: number; swell: number }[];
  /** How bright it is: where the filter sits, in hertz. */
  colour: number;
  /** Seconds between the single notes that come and go over the top, least and most. */
  gap: [number, number];
}

const ROOTS = [98, 110, 116.54, 130.81, 146.83, 155.56];
const SCALES = [
  [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3], // major pentatonic: open, bright
  [1, 6 / 5, 4 / 3, 3 / 2, 9 / 5], // minor pentatonic: darker
  [1, 9 / 8, 4 / 3, 3 / 2, 16 / 9], // suspended: unresolved, still
  [1, 5 / 4, 3 / 2, 15 / 8, 9 / 4], // major seventh: warm
];

/**
 * The music a place makes when its world gave it none: a few held notes
 * that swell and fade, and single notes over them now and then. It comes
 * from the place's name, so each place has its own and has the same one for
 * everybody, with no file anywhere.
 */
export function ambiencePlan(seed: string): AmbiencePlan {
  const r = seeded(`ambience:${seed}`);
  const root = ROOTS[Math.floor(r() * ROOTS.length)]!;
  const scale = SCALES[Math.floor(r() * SCALES.length)]!;
  const fifth = scale.includes(3 / 2) ? 3 / 2 : scale[3]!;
  const drones = [1, fifth, 2, scale[2]! * 2].map((m) => ({ hz: root * m, detune: (r() - 0.5) * 14, swell: 11 + r() * 18 }));
  const least = 3.5 + r() * 3;
  return { root, scale, drones, colour: 500 + r() * 900, gap: [least, least + 3 + r() * 4] };
}

// ------------------------------------------------------- the visitor's own songs

/** A song the visitor added from their own device. The file itself is kept beside this, in this browser. */
export interface Song {
  id: string;
  title: string;
  /** Its size in bytes. */
  size: number;
  /** When it was added, in seconds. */
  at: number;
}

/** A name for a song from its file's name: no folder, no ending, nothing invisible. */
export function songTitle(fileName: unknown): string {
  const raw = typeof fileName === "string" ? fileName : "";
  const cleaned = raw
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g, " ")
    .replace(/[_\s]+/g, " ")
    .trim();
  return [...cleaned].slice(0, SOUND_LIMITS.titleChars).join("").trim() || "A song";
}

export function cleanSongs(input: unknown): Song[] {
  if (!Array.isArray(input)) return [];
  const out: Song[] = [];
  const seen = new Set<string>();
  for (const s of input) {
    if (!s || typeof s !== "object") continue;
    const { id, title, size, at } = s as Record<string, unknown>;
    if (typeof id !== "string" || !/^[a-z0-9-]{4,40}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title: songTitle(title), size: typeof size === "number" && size > 0 ? Math.floor(size) : 0, at: typeof at === "number" && at > 0 ? Math.floor(at) : 0 });
    if (out.length >= SOUND_LIMITS.songs) break;
  }
  return out;
}

/** Whether a file may be kept as a song, and if not, why, in words for the visitor. */
export function songRefusal(file: { type?: string; size?: number; name?: string }, have: number): string | null {
  const ext = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";
  const isSound = (file.type ?? "").startsWith("audio/") || (SOUND_LIMITS.extensions as readonly string[]).includes(ext);
  if (!isSound) return "That isn't a sound file.";
  if (!file.size) return "That file is empty.";
  if (file.size > SOUND_LIMITS.songBytes) return `That file is over ${Math.round(SOUND_LIMITS.songBytes / 1024 / 1024)} MB, which is more than is kept here.`;
  if (have >= SOUND_LIMITS.songs) return `${SOUND_LIMITS.songs} songs are kept here at most. Take one out first.`;
  return null;
}
