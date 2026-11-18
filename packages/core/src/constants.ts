/** Experimental event kinds. Not allocated by the NIPs process (spec §5.1, §22). */
export const WORLD_KIND = 37300;
export const AVATAR_KIND = 37301;
/** NIP-98 HTTP auth shape, reused for entry assertions (spec §4.4, Q3). */
export const ENTRY_ASSERTION_KIND = 27235;
/** NIP-51 curation sets, used for third-party world listings (spec §5.4). */
export const CURATION_SET_KIND = 30004;

export const SCHEMAS = {
  manifest: "nswp/manifest/0.3",
  portal: "nswp/portal/0.3",
  arrival: "nswp/arrival/0.3",
} as const;

export const WELL_KNOWN_PATH = "/.well-known/nswp.json";

export const MODES = ["2d", "inline-3d", "immersive-vr", "immersive-ar"] as const;
export const CAPABILITIES = [
  "webxr",
  "rooms",
  "multiplayer",
  "voice",
  "spatial-portals",
  "avatars",
  "entry-assertion",
  "payments", "home"] as const;
/**
 * Who a world is for, as its maker says. `kids`: made for children. `general`:
 * not made for children, and nothing an adult would need warning about.
 * `adult`: not for anyone under age; what some call NSFW.
 */
export const AUDIENCES = ["kids", "general", "adult"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const COMFORT = {
  locomotion: ["stationary", "teleport", "smooth", "vehicle"],
  intensity: ["low", "medium", "high"],
  seated: ["supported", "required", "unsupported"],
} as const;
export const INPUTS = ["controllers", "hands", "gaze", "keyboard-mouse", "touch", "gamepad"] as const;
export const PERF_TIERS = ["mobile", "standalone", "desktop"] as const;
export const STATUSES = ["live", "beta", "maintenance", "retired"] as const;

/** Kinds of preview a world can publish (spec §5.8). */
export const PREVIEW_TYPES = ["pano", "flat"] as const;
export type PreviewType = (typeof PREVIEW_TYPES)[number];
/** Ceilings a client enforces whatever a world claims (spec §5.8). */
export const PREVIEW_LIMITS = {
  pano: { width: 4096, height: 2048, bytes: 2 * 1024 * 1024 },
  flat: { width: 1920, height: 1080, bytes: 500 * 1024 },
} as const;

export const LIMITS = {
  manifestBytes: 64 * 1024,
  arrivalChars: 16 * 1024,
  maxReceipts: 8,
  maxIdLength: 128,
  maxTitleLength: 200,
  maxUrlLength: 2048,
  assertionTtlSec: 60,
  assertionFutureSkewSec: 10,
  minNonceLength: 16,
} as const;

export type Mode = (typeof MODES)[number];
export type Capability = (typeof CAPABILITIES)[number];
export type Locomotion = (typeof COMFORT.locomotion)[number];
export type Intensity = (typeof COMFORT.intensity)[number];
export type Seated = (typeof COMFORT.seated)[number];
export type Input = (typeof INPUTS)[number];
export type PerfTier = (typeof PERF_TIERS)[number];
export type Status = (typeof STATUSES)[number];
