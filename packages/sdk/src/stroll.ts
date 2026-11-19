/**
 * Walking to a spot on a flat screen.
 *
 * A tap or a click on the floor used to be a jump of up to five metres, which
 * is how a headset moves (a slide there turns stomachs) and is wrong for a
 * phone or a desk: the room lurches, and a visitor loses where they were. So
 * on a flat screen a tap is a walk, at the pace the keys walk, to a spot no
 * further than a few steps away. A second tap changes where they are headed.
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
/** How far one tap or click takes a visitor on a flat screen, in metres. A little over a second of walking. */
export const TAP_REACH = 3;

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

export interface Stroll {
  /** Start walking to (x, z), from wherever the visitor is. */
  to(x: number, z: number): void;
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
}): Stroll {
  const speed = o.speed ?? WALK_SPEED;
  let target: [number, number] | null = null;
  return {
    to(x, z) {
      target = Number.isFinite(x) && Number.isFinite(z) ? [x, z] : null;
    },
    stop() {
      target = null;
    },
    update(dt) {
      if (!target) return;
      const [x, z] = o.where();
      const dx = target[0] - x;
      const dz = target[1] - z;
      const far = Math.hypot(dx, dz);
      // A long frame (a tab that was away) is not a reason to leap.
      const step = Math.min(far, speed * Math.min(Math.max(dt, 0), 0.1));
      if (far < 0.02 || step <= 0) {
        if (far < 0.02) target = null;
        return;
      }
      const sx = (dx / far) * step;
      const sz = (dz / far) * step;
      // Stop at the first place they may not stand: a wall, an edge, a chamber's side.
      if (!o.canStand(x + sx, z + sz)) {
        target = null;
        o.onBlocked?.();
        return;
      }
      o.move(sx, sz);
      if (far - step < 0.02) target = null;
    },
    get going() {
      return target !== null;
    },
  };
}
