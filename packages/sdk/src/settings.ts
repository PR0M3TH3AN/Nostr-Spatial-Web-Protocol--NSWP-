/**
 * Settings that travel with a visitor from world to world.
 *
 * Each part of the kit that holds something a visitor sets (their volumes,
 * the size of their text, their hands in a headset, whether their screen is
 * filled) does two things here. When it starts, it asks what they arrived
 * with and begins from that, in place of what this site remembered. And it
 * says what they have now, so that it can go on with them through the next
 * door. Nothing else has to know: `arrival.read()` says what they arrived
 * with, and `portal.go()` and `portal.home()` send what they have.
 *
 * What may travel, and why it is only ever a preference, is in the core
 * (`settings.ts`) and in protocol/11-the-visitors-console.md.
 */
import { cleanSettings, type TravelSettings } from "@nswp/core";

export type { TravelSettings } from "@nswp/core";

let arrived: TravelSettings = {};
const parts = new Map<string, () => TravelSettings>();

/** Say what the visitor arrived with (`arrival.read()` does). A client's own page says it for itself. */
export function arriveWith(settings: unknown): void {
  arrived = cleanSettings(settings);
}

/** What they arrived with: for a part of the kit to begin from. */
export function arrivedSettings(): TravelSettings {
  return arrived;
}

/**
 * Say what the visitor has now, for one part of what travels. `now` is asked
 * whenever they leave. Returns how to stop being asked.
 */
export function reportSettings(part: string, now: () => TravelSettings): () => void {
  parts.set(part, now);
  return () => {
    if (parts.get(part) === now) parts.delete(part);
  };
}

/**
 * What goes on with them: what they arrived with, and over it whatever each
 * part says they have now. So a setting that nothing here could show or
 * change (their hands in a headset, on a visit made at a desk) still goes on
 * to the next world untouched.
 */
export function currentSettings(): TravelSettings {
  let out: TravelSettings = { ...arrived };
  for (const now of parts.values()) {
    let said: TravelSettings = {};
    try {
      said = cleanSettings(now());
    } catch {
      /* a part that can't say leaves what was there */
    }
    out = { ...out, ...said, ...(said.sound || out.sound ? { sound: { ...out.sound, ...said.sound } } : {}) };
  }
  return cleanSettings(out);
}

/** For tests: forget everything. */
export function resetSettings(): void {
  arrived = {};
  parts.clear();
}
