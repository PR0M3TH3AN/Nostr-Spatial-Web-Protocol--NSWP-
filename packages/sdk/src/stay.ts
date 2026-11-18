/**
 * Staying put through a refresh.
 *
 * Someone building a world refreshes it all day. Being sent back to the
 * entrance each time, facing the wrong way, makes every change feel like
 * starting again. This remembers where a visitor stood and which way they
 * faced, for this tab only, and gives it back when the page comes up again
 * because it was refreshed. Arriving any other way is an arrival: through a
 * door, by a link, in a new tab.
 *
 *   const stay = createStay();
 *   const stood = arrivedThroughADoor ? null : stay.before;
 *   if (stood) { rig.position.set(stood.x, 0, stood.z); rig.rotation.y = stood.yaw * Math.PI / 180; }
 *   // now and then, and as the page goes:  stay.keep({ x, z, yaw, headset })
 *
 * A refresh always ends a headset session: that is the browser's rule, not
 * ours. `headset` says they were in one, so the way back in can be offered
 * first and alone.
 */

export interface Stood {
  x: number;
  z: number;
  /** Which way they faced, in degrees round the vertical. */
  yaw: number;
  /** Whether they were in a headset session when the page went. */
  headset: boolean;
  /** Seconds since 1970. */
  at: number;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Read what was kept, or null for anything that isn't a place someone could have stood. */
export function cleanStood(input: unknown, now: number, maxAgeSec = 12 * 3600): Stood | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Partial<Stood>;
  if (!finite(s.x) || !finite(s.z) || !finite(s.yaw) || !finite(s.at)) return null;
  if (Math.abs(s.x) > 10000 || Math.abs(s.z) > 10000) return null;
  if (s.at > now + 60 || now - s.at > maxAgeSec) return null;
  return { x: s.x, z: s.z, yaw: ((s.yaw % 360) + 360) % 360, headset: s.headset === true, at: s.at };
}

/** Whether this page came up because it was refreshed. */
export function wasRefreshed(): boolean {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "reload";
  } catch {
    return false;
  }
}

export interface Stay {
  /** Where they stood before a refresh brought this page up, or null on any other kind of arrival. */
  readonly before: Stood | null;
  keep(now: { x: number; z: number; yaw: number; headset: boolean }): void;
  /** Forget it: they left on purpose. */
  clear(): void;
}

export function createStay(o: { name?: string; refreshed?: boolean; storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null; now?: () => number } = {}): Stay {
  const now = o.now ?? (() => Math.floor(Date.now() / 1000));
  let storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = null;
  try {
    storage = o.storage === undefined ? sessionStorage : o.storage;
  } catch {
    /* a browser that won't keep anything: every load is an arrival */
  }
  const key = `nswp:stood:${o.name ?? (typeof location === "undefined" ? "" : location.pathname)}`;
  let before: Stood | null = null;
  if (o.refreshed ?? wasRefreshed()) {
    try {
      before = cleanStood(JSON.parse(storage?.getItem(key) ?? "null"), now());
    } catch {
      /* nothing kept */
    }
  }
  return {
    before,
    keep(s) {
      const stood = cleanStood({ ...s, at: now() }, now());
      if (!stood) return;
      try {
        storage?.setItem(key, JSON.stringify(stood));
      } catch {
        /* not kept this time */
      }
    },
    clear() {
      try {
        storage?.removeItem(key);
      } catch {
        /* nothing to forget */
      }
    },
  };
}
