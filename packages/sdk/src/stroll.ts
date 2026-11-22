/**
 * Walking to a spot on a flat screen.
 *
 * A tap or a click on the floor used to be a jump of up to five metres, which
 * is how a headset moves (a slide there turns stomachs) and is wrong for a
 * phone or a desk: the room lurches, and a visitor loses where they were. So
 * on a flat screen a tap is a walk, at the pace the keys walk, to a spot no
 * further than a few metres away.
 *
 * **A path, clicked out.** A tap while they are already walking doesn't start
 * again from their feet: it adds a stretch to the way they are going, from
 * where the last tap ended. So a visitor taps out a path as they walk it,
 * round a corner or between things, and the line on the floor is that path.
 *
 * **They face the way they walk.** While a walk is on, the view turns to
 * look along the stretch being walked, at an easy rate (`face`). Tapping
 * ahead is then always tapping where they are looking.
 *
 * Two taps close together are a run, straight to that spot, whatever was
 * planned: the way to change one's mind, and the only way to run for a
 * visitor with no keys to hold. Each tap after that keeps them running until
 * they arrive somewhere.
 *
 *   const stroll = createStroll({ where: () => [head.x, head.z], canStand, move: (dx, dz) => { rig.position.x += dx; rig.position.z += dz; } });
 *   // a tap on the floor, outside a headset:
 *   stroll.tap(spot.x, spot.z);
 *   // every frame:
 *   stroll.update(dt);
 *   if (stroll.going && !dragging) rig.rotation.y = stroll.face(rig.rotation.y, dt);
 *   // a key was pressed, a door was taken, a headset session began:
 *   stroll.stop();
 */

/** Metres a second: the pace the keys walk at, and so the pace a tap walks at. */
export const WALK_SPEED = 2.4;
/** How much faster a run is than a walk, however it is asked for: Shift, two taps, or a stick pressed in. */
export const RUN = 1.75;
/**
 * Radians a second: how fast the left and right arrow keys turn someone, the casual way on a flat screen. A
 * quarter turn in a little under a second: quick enough to look about, slow enough to stop where they meant.
 */
export const KEY_TURN = 1.9;
/**
 * The fastest anyone goes on foot, in metres a second: a run. Nobody in a room covers ground faster than this,
 * whatever they hold or wear: keys, a mouse, a finger on a phone, or a headset's sticks and steps.
 */
export const TOP_SPEED = WALK_SPEED * RUN;
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

/** How many stretches a path may have waiting. More taps than this are not added until some are walked. */
export const PATH_MOST = 12;
/** How fast the view turns to face the way they walk, at most, in radians a second: a little under half a turn. */
export const FACE_RATE = 2.8;

/** How far dragging turns a visitor on a flat screen, in radians a pixel. Dragging right brings what was on the left round. */
export const DRAG_LOOK = 0.005;

/**
 * How far a drag tilts the view up or down on a flat screen moving the casual way, at most, in radians: about sixty
 * degrees either way (the owner, 2026-11-22: "B, as recommended", with the tilt "about 60 degrees up and down").
 * Enough to look at someone on a balcony or something at their feet; never so far that up and down are lost.
 */
export const TILT_LIMIT = (60 * Math.PI) / 180;
/** How fast the view comes back to level once they walk, in radians a second: from the full tilt in under a second. */
export const LEVEL_RATE = 1.6;

/**
 * Where a visitor looks after a drag of (dx, dy) pixels on a flat screen, moving the casual way: a drag sideways
 * turns them as it always has, and a drag up or down tilts the view, held within `TILT_LIMIT`. The drag takes the
 * world with it, as the sideways one does: dragging down brings what was above into view.
 */
export function dragTurn(yaw: number, pitch: number, dx: number, dy: number, speed = DRAG_LOOK): { yaw: number; pitch: number } {
  const clean = (v: number) => (Number.isFinite(v) ? v : 0);
  return { yaw: yaw + clean(dx) * speed, pitch: Math.min(TILT_LIMIT, Math.max(-TILT_LIMIT, clean(pitch) + clean(dy) * speed)) };
}

/** The tilt a moment later while they walk: eased back towards level, never past it. */
export function levelled(pitch: number, dt: number, rate = LEVEL_RATE): number {
  const step = Math.max(0, dt) * rate;
  return Math.abs(pitch) <= step ? 0 : pitch - Math.sign(pitch) * step;
}

/**
 * Looking round by dragging, on a flat screen moving the casual way: the rig turns, the camera tilts. While it isn't
 * theirs to move (the intense way of moving holds the view to the mouse, a headset holds it to the head), it leaves
 * the view alone, and hands it over level.
 */
export function createDragLook(o: { rig: { rotation: { y: number } }; camera: { rotation: { x: number } }; scale?: () => number }): {
  /** A drag of (dx, dy) pixels. */
  drag(dx: number, dy: number): void;
  /** Call every frame: `walking` while a walk is under way (a tap's, or the keys'); `active` while the view is the drag's to move. */
  update(dt: number, s: { walking: boolean; active: boolean }): void;
  /** Bring the view level now. */
  level(): void;
  readonly pitch: number;
} {
  let pitch = 0;
  let active = true;
  return {
    drag(dx, dy) {
      if (!active) return;
      const next = dragTurn(o.rig.rotation.y, pitch, dx, dy, DRAG_LOOK * (o.scale?.() ?? 1));
      o.rig.rotation.y = next.yaw;
      pitch = next.pitch;
      o.camera.rotation.x = pitch;
    },
    update(dt, s) {
      if (!s.active) {
        // Handed over: level, so whatever holds the view now starts from where it expects.
        if (active && pitch !== 0) o.camera.rotation.x = 0;
        active = false;
        pitch = 0;
        return;
      }
      active = true;
      if (s.walking && pitch !== 0) {
        pitch = levelled(pitch, dt);
        o.camera.rotation.x = pitch;
      }
    },
    level() {
      pitch = 0;
      o.camera.rotation.x = 0;
    },
    get pitch() {
      return pitch;
    },
  };
}

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

/**
 * The pace of stepping. In a headset the casual way to move is a step that lands at once, because a slide there
 * turns stomachs. Left unpaced, a press is a jump of five metres and a visitor who presses fast enough outruns
 * everybody. So each step is paid for after it is taken: the next may not land until someone running would have
 * covered the same ground. A short step is ready again almost at once; a long one takes about a second.
 *
 *   const pace = createStepPace();
 *   // a step of `far` metres is asked for:
 *   if (pace.take(far)) moveThere();
 *   // each frame, to show whether a press would do anything:
 *   reticle.material.opacity = pace.ready ? 0.8 : 0.25;
 */
export interface StepPace {
  /** Take a step of this many metres, if one may be taken now. False, and nothing is spent, if it is too soon. */
  take(metres: number): boolean;
  /** Whether a step may be taken now. */
  readonly ready: boolean;
  /** Seconds until one may. 0 when ready. */
  readonly wait: number;
}

export function createStepPace(o: { speed?: number; now?: () => number } = {}): StepPace {
  const speed = o.speed && o.speed > 0 ? o.speed : TOP_SPEED;
  const now = o.now ?? (() => performance.now());
  let readyAt = -Infinity;
  return {
    take(metres) {
      const t = now();
      if (t < readyAt) return false;
      const far = Number.isFinite(metres) ? Math.max(0, metres) : 0;
      readyAt = t + (far / speed) * 1000;
      return true;
    },
    get ready() {
      return now() >= readyAt;
    },
    get wait() {
      return Math.max(0, (readyAt - now()) / 1000);
    },
  };
}

export interface Stroll {
  /**
   * Start walking to (x, z), from wherever the visitor is, and forget any path they had tapped out. Asked twice
   * close together, or while already running, or with `run` true, they run there. For a walk the page starts
   * itself (up to a door, say). A press on the floor is `tap`.
   */
  to(x: number, z: number, run?: boolean): void;
  /**
   * A press on the floor at (x, z). Standing still, it starts a walk towards it, no further than one press
   * reaches. Already walking, it adds a stretch to the path, from where the path ends, as far as one press
   * reaches from there. Two presses close together are a run straight to the spot, with the rest forgotten.
   */
  tap(x: number, z: number): void;
  /** Where a press at (x, z) would lead: for the ring under the pointer. From the end of the path while walking. */
  reach(x: number, z: number): [number, number];
  /** Whether they are running to where they are headed. */
  readonly running: boolean;
  /** Where they will end up, or null: the end of the path. */
  readonly target: readonly [number, number] | null;
  /** The way they are going: each spot still to be walked to, in order. Empty when they are standing. */
  readonly path: readonly (readonly [number, number])[];
  /**
   * The way they are walking now, as a turn about the vertical for something that looks down -Z (a three.js
   * camera's rig), in radians. Null when they are standing.
   */
  readonly heading: number | null;
  /** `yaw`, turned a little towards the way they are walking: call it every frame of a walk with their own turn. */
  face(yaw: number, dt: number): number;
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
  /** How far one press reaches, in metres. `TAP_REACH` when left out. */
  reach?: number;
  /** Called when something in the way stopped the walk short. */
  onBlocked?: () => void;
  /** The time now, in milliseconds. For tests. */
  now?: () => number;
}): Stroll {
  const speed = o.speed ?? WALK_SPEED;
  const reach = o.reach ?? TAP_REACH;
  const now = o.now ?? (() => performance.now());
  let path: [number, number][] = [];
  let running = false;
  let asked = -Infinity;
  let heading: number | null = null;
  /** The turn that faces from one spot towards another. Kept as it was when the two are all but the same spot. */
  const aim = (fx: number, fz: number, tx: number, tz: number) => {
    const dx = tx - fx;
    const dz = tz - fz;
    if (Math.hypot(dx, dz) > 0.3) heading = Math.atan2(-dx, -dz);
  };
  const halt = () => {
    path = [];
    running = false;
    heading = null;
  };
  return {
    to(x, z, run) {
      const t = now();
      const again = t - asked <= DOUBLE_TAP;
      asked = t;
      const wasRunning = path.length > 0 && running;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return halt();
      path = [[x, z]];
      running = run === true || again || wasRunning;
      aim(...o.where(), x, z);
    },
    tap(x, z) {
      const t = now();
      const again = t - asked <= DOUBLE_TAP;
      asked = t;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const [hx, hz] = o.where();
      if (again || path.length === 0) {
        // Standing, a walk begins. Pressed twice quickly, it is a run straight there and nothing else.
        const wasRunning = path.length > 0 && running;
        path = [reachOf(hx, hz, x, z, reach)];
        running = again || wasRunning;
        aim(hx, hz, path[0]![0], path[0]![1]);
        return;
      }
      // Walking already: the path goes on from where it ended.
      const end = path[path.length - 1]!;
      const next = reachOf(end[0], end[1], x, z, reach);
      if (path.length < PATH_MOST && Math.hypot(next[0] - end[0], next[1] - end[1]) > 0.3) path.push(next);
    },
    reach(x, z) {
      const from = path.length ? path[path.length - 1]! : o.where();
      return reachOf(from[0], from[1], x, z, reach);
    },
    stop: halt,
    update(dt) {
      const next = path[0];
      if (!next) return;
      const [x, z] = o.where();
      const dx = next[0] - x;
      const dz = next[1] - z;
      const far = Math.hypot(dx, dz);
      aim(x, z, next[0], next[1]);
      // A long frame (a tab that was away) is not a reason to leap.
      const step = Math.min(far, speed * (running ? RUN : 1) * Math.min(Math.max(dt, 0), 0.1));
      /** At a spot on the path: on to the next, or done. */
      const arrived = () => {
        path.shift();
        if (path.length === 0) halt();
      };
      if (far < 0.02 || step <= 0) {
        if (far < 0.02) arrived();
        return;
      }
      const sx = (dx / far) * step;
      const sz = (dz / far) * step;
      // Stop at the first place they may not stand: a wall, an edge, a chamber's side. The rest of the path goes too.
      if (!o.canStand(x + sx, z + sz)) {
        halt();
        o.onBlocked?.();
        return;
      }
      o.move(sx, sz);
      if (far - step < 0.02) arrived();
    },
    face(yaw, dt) {
      if (heading === null || !(dt > 0)) return yaw;
      // The short way round.
      const turn = ((((heading - yaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
      const most = FACE_RATE * Math.min(dt, 0.1);
      // Eased as it nears, so it settles and doesn't snap; never faster than the rate.
      return yaw + Math.max(-most, Math.min(most, turn * Math.min(1, dt * 7)));
    },
    get going() {
      return path.length > 0;
    },
    get running() {
      return running;
    },
    get target() {
      return path.length ? path[path.length - 1]! : null;
    },
    get path() {
      return path;
    },
    get heading() {
      return heading;
    },
  };
}
