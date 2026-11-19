/**
 * Settings that travel: the few things a visitor sets once and expects to
 * find the same in the next world.
 *
 * Each world is a different website, and a website can only remember what a
 * visitor chose on that site. So someone who turned the music down, made the
 * text larger or filled their screen had to do it again in every world. These
 * settings go with them instead, through each door, the same way that how
 * they move does: the world they leave says what they are, their own client
 * passes that on, and the world they arrive in starts from it
 * (protocol/11-the-visitors-console.md, "Settings that travel").
 *
 * They are what the visitor has chosen, not what happened to be so when they
 * left: someone who prefers a filled screen and pressed Escape for a moment
 * in one world still prefers a filled screen in the next. Only their own
 * hand on the control for a thing changes what is said about it.
 *
 * They are preferences and nothing more. A link that says them falsely has
 * turned a volume down or made some text larger, and the visitor changes it
 * back. So nothing here is anything that needs asking about: a microphone,
 * who is blocked and hearing other people's music are not settings, and
 * travel under rules of their own or not at all.
 */

/** What goes with a visitor. Every part is optional: what isn't said is the next world's to decide. */
export interface TravelSettings {
  /** Their volumes, each from 0 to 1, and whether everything is off. */
  sound?: { off?: boolean; effects?: number; music?: number; voices?: number; hum?: boolean };
  /** The size of text and controls, 1 being normal. */
  text?: number;
  /** Whether things move when they open and close. */
  motion?: boolean;
  /** Which wrist carries the console in a headset. */
  wrist?: "left" | "right" | "off";
  /** How far one turn goes in a headset, in degrees, turning a notch at a time. */
  turn?: 30 | 45 | 90;
  /** Which hand's stick moves them in a headset. */
  hand?: "left" | "right";
  /** Whether the view narrows while they move smoothly in a headset. */
  narrow?: boolean;
  /** They prefer the world filling their screen: it is filled at their first press in each world. */
  full?: boolean;
  /** They prefer the intense way of moving at a desk: the mouse looks round and keys walk. */
  intense?: boolean;
  /** How fast the view turns under a mouse or a finger, 1 being normal: from 0.25 to 3. */
  look?: number;
  /** How wide they see at a desk, top to bottom, in degrees: from 50 to 110. Left out, each world's own. */
  fov?: number;
  /**
   * Whether they see other people's pictures. A picture is fetched from wherever its owner keeps it, which tells
   * that place the visitor's address, so this is theirs to turn off. Left out, pictures are shown.
   */
  pictures?: boolean;
}

/** The slowest and fastest the view may be set to turn, and the narrowest and widest it may be set to see. */
export const LOOK_RANGE = [0.25, 3] as const;
export const FOV_RANGE = [50, 110] as const;

/** The longest a set of settings may be on a link, in characters. */
export const SETTINGS_LINK_LIMIT = 400;

const level = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 100) / 100 : undefined);

/** Settings as they were said, with everything unknown or out of range left out. Never throws. */
export function cleanSettings(input: unknown): TravelSettings {
  const out: TravelSettings = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const s = input as Record<string, unknown>;
  if (s.sound && typeof s.sound === "object" && !Array.isArray(s.sound)) {
    const from = s.sound as Record<string, unknown>;
    const sound: NonNullable<TravelSettings["sound"]> = {};
    if (typeof from.off === "boolean") sound.off = from.off;
    for (const k of ["effects", "music", "voices"] as const) {
      const v = level(from[k]);
      if (v !== undefined) sound[k] = v;
    }
    if (typeof from.hum === "boolean") sound.hum = from.hum;
    if (Object.keys(sound).length) out.sound = sound;
  }
  if (typeof s.text === "number" && Number.isFinite(s.text)) out.text = Math.round(Math.min(1.5, Math.max(0.85, s.text)) * 100) / 100;
  if (typeof s.motion === "boolean") out.motion = s.motion;
  if (s.wrist === "left" || s.wrist === "right" || s.wrist === "off") out.wrist = s.wrist;
  if (s.turn === 30 || s.turn === 45 || s.turn === 90) out.turn = s.turn;
  if (s.hand === "left" || s.hand === "right") out.hand = s.hand;
  if (typeof s.narrow === "boolean") out.narrow = s.narrow;
  if (typeof s.full === "boolean") out.full = s.full;
  if (typeof s.intense === "boolean") out.intense = s.intense;
  if (typeof s.look === "number" && Number.isFinite(s.look)) out.look = Math.round(Math.min(LOOK_RANGE[1], Math.max(LOOK_RANGE[0], s.look)) * 100) / 100;
  if (typeof s.fov === "number" && Number.isFinite(s.fov)) out.fov = Math.round(Math.min(FOV_RANGE[1], Math.max(FOV_RANGE[0], s.fov)));
  if (typeof s.pictures === "boolean") out.pictures = s.pictures;
  return out;
}

/** Whether there is anything in them. */
export const hasSettings = (s: TravelSettings | undefined): s is TravelSettings => !!s && Object.keys(s).length > 0;

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64Url = (text: string): string => {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** Settings as they go on a link: "" when there are none, or they would be too long to send. */
export function encodeSettings(settings: TravelSettings | undefined): string {
  const clean = cleanSettings(settings);
  if (!hasSettings(clean)) return "";
  const text = toBase64Url(JSON.stringify(clean));
  return text.length <= SETTINGS_LINK_LIMIT ? text : "";
}

/** Settings read off a link. Anything unreadable is no settings at all. */
export function decodeSettings(text: unknown): TravelSettings {
  if (typeof text !== "string" || !text || text.length > SETTINGS_LINK_LIMIT || !/^[A-Za-z0-9_-]+$/.test(text)) return {};
  try {
    return cleanSettings(JSON.parse(fromBase64Url(text)));
  } catch {
    return {};
  }
}
