/**
 * Walking to a spot on a flat screen.
 *
 * A tap or a click on the floor used to be a jump of up to five metres, which
 * is how a headset moves (a slide there turns stomachs) and is wrong for a
 * phone or a desk: the room lurches, and a visitor loses where they were. So
 * on a flat screen a tap is a walk, at the pace the keys walk, to a spot no
 * further than a few metres away. A second tap changes where they are headed.
 *
 * Two taps close together are a run: the same few steps, taken at a run, and
 * each tap after that keeps them running until they arrive somewhere. It is
 * the only way to run for a visitor with no keys to hold.
 *
 *   const stroll = createStroll({ where: () => [head.x, head.z], canStand, move: (dx, dz) => { rig.position.x += dx; rig.position.z += dz; } });
 *   // a tap on the floor, outside a headset:
 *   stroll.to(...reachOf(head.x, head.z, spot.x, spot.z));
 *   // every frame:
 *   stroll.update(dt);
 *   // a key was pressed, a door was taken, a headset session began:
 *   stroll.stop();
 */

/** Metres a second: the pace the keys walk at, and so the pace a tap walks at. */
export const WALK_SPEED = 2.4;
/** How much faster a run is than a walk, however it is asked for: Shift, two taps, or a stick pressed in. */
export const RUN = 1.75;
/** Two taps within this many milliseconds are a run. */
export const DOUBLE_TAP = 400;
/**
 * How far one tap or click takes a visitor on a flat screen, in metres: two and a half seconds of walking.
 *
 * It was three. But a visitor standing up, looking level, can't see the floor nearer than about 2.8 metres: it is
 * below the bottom of their screen. So the mark for where a press would take them, and the line to it, were never
 * on screen. At six they are in the lower part of the view, where a press on the floor is made. It is still a walk
 * at the keys' pace and never a jump, and it is shown before it is taken, so it surprises nobody.
 */
export const TAP_REACH = 6;

/** How far dragging turns a visitor on a flat screen, in radians a pixel. Dragging right brings what was on the left round. */
export const DRAG_LOOK = 0.005;

/** The spot a tap leads to: the one tapped, or the point `reach` metres towards it when it is further off. */
export function reachOf(fromX: number, fromZ: number, toX: number, toZ: number, reach = TAP_REACH): [number, number] {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const far = Math.hypot(dx, dz);
  if (!Number.isFinite(far) || far <= reach || far === 0) return [toX, toZ];
  return [fromX + (dx / far) * reach, fromZ + (dz / far) * reach];
}

/**
 * The spots of a dotted line over the floor from one place to another: evenly spaced, starting a little way out
 * from under the visitor's feet and stopping short of where they are going, which has a mark of its own.
 */
export function dotsBetween(fromX: number, fromZ: number, toX: number, toZ: number, opts: { gap?: number; clear?: number; short?: number; most?: number } = {}): [number, number][] {
  const gap = opts.gap ?? 0.4;
  const clear = opts.clear ?? 0.45;
  const short = opts.short ?? 0.3;
  const most = opts.most ?? 40;
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const far = Math.hypot(dx, dz);
  const out: [number, number][] = [];
  if (!Number.isFinite(far) || far <= clear + short || !(gap > 0)) return out;
  // Counted back from where they are going, so the dots stay put on the floor as the visitor walks along them.
  for (let d = far - short; d >= clear && out.length < most; d -= gap) out.push([fromX + (dx / far) * d, fromZ + (dz / far) * d]);
  return out;
}

export interface Stroll {
  /**
   * Start walking to (x, z), from wherever the visitor is. Asked twice close together, or while already
   * running, or with `run` true, they run there.
   */
  to(x: number, z: number, run?: boolean): void;
  /** Whether they are running to where they are headed. */
  readonly running: boolean;
  /** Where they are headed, or null: for showing them, and nobody else, where a tap is taking them. */
  readonly target: readonly [number, number] | null;
  /** Stop where they are. */
  stop(): void;
  /** Call every frame with the seconds since the last. */
  update(dt: number): void;
  /** Whether they are on their way somewhere. */
  readonly going: boolean;
}

export function createStroll(o: {
  /** Where the visitor's head is over the floor. */
  where(): [number, number];
  /** May they stand at (x, z)? */
  canStand(x: number, z: number): boolean;
  /** Move them by this much. */
  move(dx: number, dz: number): void;
  /** Metres a second. */
  speed?: number;
  /** Called when something in the way stopped the walk short. */
  onBlocked?: () => void;
  /** The time now, in milliseconds. For tests. */
  now?: () => number;
}): Stroll {
  const speed = o.speed ?? WALK_SPEED;
  const now = o.now ?? (() => performance.now());
  let target: [number, number] | null = null;
  let running = false;
  let asked = -Infinity;
  return {
    to(x, z, run) {
      const t = now();
      const again = t - asked <= DOUBLE_TAP;
      asked = t;
      const wasRunning = target !== null && running;
      target = Number.isFinite(x) && Number.isFinite(z) ? [x, z] : null;
      running = target !== null && (run === true || again || wasRunning);
    },
    stop() {
      target = null;
      running = false;
    },
    update(dt) {
      if (!target) return;
      const [x, z] = o.where();
      const dx = target[0] - x;
      const dz = target[1] - z;
      const far = Math.hypot(dx, dz);
      // A long frame (a tab that was away) is not a reason to leap.
      const step = Math.min(far, speed * (running ? RUN : 1) * Math.min(Math.max(dt, 0), 0.1));
      if (far < 0.02 || step <= 0) {
        if (far < 0.02) {
          target = null;
          running = false;
        }
        return;
      }
      const sx = (dx / far) * step;
      const sz = (dz / far) * step;
      // Stop at the first place they may not stand: a wall, an edge, a chamber's side.
      if (!o.canStand(x + sx, z + sz)) {
        target = null;
        running = false;
        o.onBlocked?.();
        return;
      }
      o.move(sx, sz);
      if (far - step < 0.02) {
        target = null;
        running = false;
      }
    },
    get going() {
      return target !== null;
    },
    get running() {
      return running;
    },
    get target() {
      return target;
    },
  };
}
