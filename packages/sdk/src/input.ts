/**
 * Hands in a headset: controllers of any make, and tracked hands.
 *
 * This is the part of the kit that touches WebXR. It reads whatever the
 * visitor is holding through the standard layout (`actions.ts`), and does the
 * things every world would otherwise write again: turning and moving with a
 * stick, in the comfortable way unless the visitor asks otherwise; picking
 * things up with the grip; a buzz in the hand when something happens; a menu
 * button; and something to see where the hands are.
 *
 * It adds to pointing and selecting, and never replaces it. A visitor with
 * one button, a pinch, or their gaze can still do everything a world owes
 * them (protocol/09-what-a-world-owes.md). A world keeps its own `select`
 * handling; this needs only to be told how to step.
 *
 * Nothing here is downloaded. The controller a visitor sees is drawn by this
 * file, in the kit's own style, so it is the same for every make and no
 * request tells anyone which headset they own.
 *
 *   const input = createXrInput({ renderer, scene, rig, camera, canStand, controls,
 *     stepFrom: (i) => stepWhere(controllers[i]), onMenu: () => xrConsole.toggle() });
 *   // each frame:  input.update(dt)
 *   // on select:   if (input.claimed(i)) return;   // that pinch picked something up
 *   input.grabbable(mesh);
 */
import * as THREE from "three";
import { cleanComfort, loadComfort, Locomotion, NO_PAD, readPad, saveComfort, type Comfort, type Handedness, type HeldPad, type PadLike, type PadState, CASUAL_COMFORT, INTENSE_COMFORT, isIntense } from "./actions.js";
import { createAlloy, type Alloy } from "./alloy.js";
import { MeshBuilder } from "./mesh.js";
import { turnVisitor } from "./turn.js";
import type { Controls } from "./ui/model.js";

export interface GrabOptions {
  /** How close a hand must be, in metres from the thing's surface. Default 0.1. */
  reach?: number;
  /** May it be picked up by pointing at it from a distance and squeezing? It comes to the hand. Default true. */
  far?: boolean;
  /** Taken from a distance, does it come to the hand? False keeps it at arm's length and moves it from there: right for something large. Default true. */
  pull?: boolean;
  /** When let go: stay where it is put, or go back to where it was. Default "stay". */
  release?: "stay" | "return";
  onGrab?: (slot: number) => void;
  onRelease?: (slot: number) => void;
}

export interface XrInputOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** The object that moves the visitor around; the camera is inside it. */
  rig: THREE.Object3D;
  camera: THREE.Camera;
  /**
   * The visitor arrived from a headset moving the intense way (their own client says so): they move that way
   * here too. A preference, and theirs to change.
   */
  arrivedIntense?: boolean;
  /** May the visitor's head be at (x, z)? Walking stops where this says no. Left out, anywhere. */
  canStand?: (x: number, z: number) => boolean;
  /**
   * Step to where the controller in this slot points, exactly as a `select` on
   * the floor would. Called when a stick pushed forward is let go. Left out,
   * a stick doesn't step, and pointing and selecting still does.
   */
  stepFrom?: (slot: number) => void;
  /** The menu button (B or Y) went down. */
  onMenu?: () => void;
  /**
   * The menu button (B or Y) has been held for a moment: the visitor is summoning their controls, which no world
   * may refuse (ui/summon.ts). Open the console: `() => xrConsole.setOpen(true)`.
   */
  onSummon?: () => void;
  /** The jump button (A or X) went down. Give it the world's jump: `() => jump.jump()` (jump.ts). */
  onJump?: () => void;
  /** The light on the controllers and hands. */
  accent?: THREE.ColorRepresentation;
  /** Give the visitor their choices under "Moving" in the controls. */
  controls?: Controls;
  /** Draw controllers and hands. Default true. A world with hands of its own turns this off. */
  models?: boolean;
}

export interface XrInputInfo {
  comfort: Comfort;
  /** What is in each of the two slots. */
  slots: { hand: Handedness; kind: "controller" | "hand" | "none"; pad: PadState }[];
  /** Slots choosing where to step: a stick is held forward. */
  aiming: number[];
  /** What each slot holds, by the name given to `grabbable`, or null. */
  holding: (string | null)[];
  /** How much of the view's edge is darkened, 0 to 1. */
  narrow: number;
  /** Buzzes sent so far, for tests: nothing else can see one. */
  pulses: number;
}

export interface XrInput {
  readonly comfort: Comfort;
  /** Whether the visitor moves the intense way in a headset: walking and turning smoothly. */
  readonly intense: boolean;
  /** Change how the visitor moves. `keep` remembers it as their choice, for this site. */
  setComfort(patch: Partial<Comfort>, keep?: boolean): void;
  /** Call once per frame with the seconds since the last one. */
  update(dt: number): void;
  /** Make something a visitor can pick up. Returns a function that takes that back. */
  grabbable(object: THREE.Object3D, opts?: GrabOptions): () => void;
  /** True while a pinch in this slot is holding something: its `select` picked that up, and is not a press. */
  claimed(slot: number): boolean;
  /** A short buzz in the hand, where the controller can. Strength 0 to 1, length in milliseconds. */
  pulse(slot: number, strength?: number, ms?: number): void;
  info(): XrInputInfo;
  dispose(): void;
}

/** What is drawn of the visitor's own hands is never in the way of what they point at. */
const unpointable = (root: THREE.Object3D): void => root.traverse((o) => void ((o as THREE.Mesh).raycast = () => {}));

type Source = { handedness?: string; gamepad?: PadLike | null; hand?: unknown; targetRayMode?: string };

/** A controller, drawn the same for every make: a handle, a lit nose, and a light that answers the trigger. */
function controllerModel(accent: THREE.Color): { group: THREE.Group; metal: Alloy; trigger: THREE.Mesh; squeeze: THREE.Mesh } {
  const b = new MeshBuilder().at();
  b.tone = new THREE.Color(0x1a222c);
  b.light = accent.clone();
  // The handle leans back and down from the palm, the way a hand holds one.
  const lean = new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(-52)).setPosition(0, -0.012, 0.022);
  b.place(lean);
  b.lathe([[0.0005, -0.07], [0.014, -0.068], [0.018, -0.02], [0.017, 0.03], [0.012, 0.046], [0.0005, 0.048]], [0, 0, 0], 6, (row) => (row === 1 ? { glow: 0.5 } : { shade: 0.9 + (row % 2) * 0.2 }));
  // The nose points where the ray goes.
  b.place(new THREE.Matrix4());
  b.box([0.03, 0.022, 0.07], [0, 0.004, -0.045], { bevel: 0.006, shade: 1.05 });
  b.box([0.018, 0.012, 0.004], [0, 0.004, -0.082], { glow: 1 });
  // A ring round it, as tracked controllers have, so it reads as one at a glance.
  b.place(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(64)).setPosition(0, 0.012, -0.04));
  b.lathe([[0.046, -0.004], [0.052, 0], [0.046, 0.004], [0.041, 0]], [0, 0, 0], 12, (row) => (row === 1 ? { glow: 0.7 } : { shade: 0.85 }));
  const metal = createAlloy(accent, { gloss: 0.6 });
  const group = new THREE.Group();
  group.add(b.build(metal));
  const light = () => new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(0.2) });
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.014), light());
  trigger.position.set(0, -0.016, -0.036);
  const squeeze = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.012), light());
  squeeze.position.set(0, -0.034, 0.018);
  squeeze.rotation.x = THREE.MathUtils.degToRad(-52);
  group.add(trigger, squeeze);
  unpointable(group);
  return { group, metal, trigger, squeeze };
}

const VIGNETTE_VERT = `varying float vFar; void main(){ vFar = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const VIGNETTE_FRAG = `uniform float uAmount; varying float vFar; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(0.24, 0.42, vFar) * uAmount); }`;

export function createXrInput(opts: XrInputOptions): XrInput {
  const { renderer, rig, camera } = opts;
  const accent = new THREE.Color(opts.accent ?? 0xffb65c);
  let comfort = loadComfort();
  const loco = new Locomotion();
  const listeners: [THREE.Object3D, string, (e: never) => void][] = [];
  const listen = (target: THREE.Object3D, type: string, fn: (e: never) => void) => {
    target.addEventListener(type as never, fn as never);
    listeners.push([target, type, fn]);
  };

  // ------------------------------------------------------------- the two slots
  // WebXR hands out up to two input sources. What each is arrives when it connects, and can change:
  // a visitor puts a controller down and their hand is tracked in its place.
  const slots = [0, 1].map((i) => {
    const ray = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    const hand = renderer.xr.getHand(i);
    const slot = { ray, grip, hand, source: null as Source | null, model: null as ReturnType<typeof controllerModel> | null };
    listen(ray, "connected", ((e: { data?: Source }) => {
      slot.source = e.data ?? null;
    }) as never);
    listen(ray, "disconnected", (() => {
      slot.source = null;
      release(i);
    }) as never);
    for (const o of [ray, grip, hand]) if (!o.parent) rig.add(o);
    if (opts.models !== false) {
      slot.model = controllerModel(accent);
      slot.model.group.visible = false;
      grip.add(slot.model.group);
    }
    return slot;
  });
  const kindOf = (s: (typeof slots)[number]): "controller" | "hand" | "none" => (!s.source ? "none" : s.source.hand ? "hand" : "controller");
  const handOf = (s: (typeof slots)[number]): Handedness => (s.source?.handedness === "left" || s.source?.handedness === "right" ? s.source.handedness : "none");

  // -------------------------------------------------------------------- hands
  // A tracked hand is drawn as its joints: a small solid at each, lit at the fingertips.
  const jointShape = new THREE.OctahedronGeometry(1, 1);
  const jointDark = new THREE.MeshBasicMaterial({ color: 0x27323f });
  const jointLit = new THREE.MeshBasicMaterial({ color: accent });
  const dressHand = (hand: THREE.Object3D) => {
    for (const joint of hand.children) {
      if (joint.userData.nswpJoint) continue;
      joint.userData.nswpJoint = true;
      const name = String((joint as unknown as { jointName?: string }).jointName ?? "");
      const tip = name.endsWith("-tip");
      const mesh = new THREE.Mesh(jointShape, tip ? jointLit : jointDark);
      const radius = (joint as unknown as { jointRadius?: number }).jointRadius;
      mesh.scale.setScalar(Math.min(0.02, Math.max(0.005, (radius ?? 0.008) * (tip ? 0.9 : 0.75))));
      unpointable(mesh);
      joint.add(mesh);
    }
  };

  // ---------------------------------------------------------------- the view
  // While sliding, the edge of the view goes dark. Seeing less move is what keeps most people well.
  const vignette = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 3, 48, 4),
    new THREE.ShaderMaterial({ uniforms: { uAmount: { value: 0 } }, vertexShader: VIGNETTE_VERT, fragmentShader: VIGNETTE_FRAG, transparent: true, depthTest: false, depthWrite: false }),
  );
  vignette.position.z = -0.4;
  vignette.renderOrder = 999;
  vignette.frustumCulled = false;
  vignette.visible = false;
  unpointable(vignette);
  camera.add(vignette);
  let narrow = 0;

  // ------------------------------------------------------------------ buzzes
  let pulses = 0;
  const pulse = (slot: number, strength = 0.4, ms = 25) => {
    const pad = slots[slot]?.source?.gamepad as unknown as
      | { hapticActuators?: { pulse?(strength: number, ms: number): unknown }[]; vibrationActuator?: { playEffect?(type: string, o: object): unknown } }
      | null
      | undefined;
    if (!pad) return;
    try {
      const actuator = pad.hapticActuators?.[0];
      if (actuator?.pulse) void actuator.pulse(Math.min(1, Math.max(0, strength)), ms);
      else if (pad.vibrationActuator?.playEffect) void pad.vibrationActuator.playEffect("dual-rumble", { duration: ms, strongMagnitude: strength, weakMagnitude: strength });
      else return;
      pulses++;
    } catch {
      /* a controller that can't buzz is not a problem */
    }
  };

  // ------------------------------------------------------------------- moving
  const headAt = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const canStand = opts.canStand ?? (() => true);
  /** Walk in the direction the head faces, sliding along anything in the way instead of sticking to it. */
  const walk = (right: number, forward: number) => {
    camera.getWorldPosition(headAt);
    camera.getWorldDirection(ahead);
    ahead.y = 0;
    if (ahead.lengthSq() < 1e-6) return;
    ahead.normalize();
    const dx = ahead.x * forward - ahead.z * right;
    const dz = ahead.z * forward + ahead.x * right;
    if (canStand(headAt.x + dx, headAt.z + dz)) rig.position.set(rig.position.x + dx, rig.position.y, rig.position.z + dz);
    else if (canStand(headAt.x + dx, headAt.z)) rig.position.x += dx;
    else if (canStand(headAt.x, headAt.z + dz)) rig.position.z += dz;
  };

  // ------------------------------------------------------------------ holding
  interface Grabbable extends Required<Pick<GrabOptions, "reach" | "far" | "pull" | "release">> {
    object: THREE.Object3D;
    onGrab?: (slot: number) => void;
    onRelease?: (slot: number) => void;
  }
  interface Held {
    thing: Grabbable;
    by: "squeeze" | "pinch";
    home: { parent: THREE.Object3D | null; position: THREE.Vector3; quaternion: THREE.Quaternion };
    /** Coming to the hand from a distance: where it started, in the hand's own space, and how far along it is. */
    pull?: { from: THREE.Vector3; t: number };
  }
  const things = new Map<THREE.Object3D, Grabbable>();
  const held = new Map<number, Held>();
  const returning: { object: THREE.Object3D; from: THREE.Vector3; fromQ: THREE.Quaternion; to: THREE.Vector3; toQ: THREE.Quaternion; t: number }[] = [];
  const box = new THREE.Box3();
  const ball = new THREE.Sphere();
  const handAt = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const turnOnly = new THREE.Matrix4();
  const HOLD_AT = new THREE.Vector3(0, 0, -0.06);
  /** How far away something can be taken from, in metres. */
  const FAR_REACH = 6;

  const isHeld = (object: THREE.Object3D) => [...held.values()].some((h) => h.thing.object === object);

  const grab = (slot: number, by: Held["by"]): boolean => {
    const s = slots[slot]!;
    if (held.has(slot) || !s.source) return false;
    (s.grip.visible ? s.grip : s.ray).getWorldPosition(handAt);
    let best: Grabbable | null = null;
    let bestFar = Infinity;
    for (const thing of things.values()) {
      if (isHeld(thing.object) || !thing.object.visible) continue;
      box.setFromObject(thing.object).getBoundingSphere(ball);
      const far = ball.center.distanceTo(handAt) - ball.radius;
      if (far <= thing.reach && far < bestFar) [best, bestFar] = [thing, far];
    }
    let pulled = false;
    if (!best && by === "squeeze") {
      // Nothing in reach: whatever the hand points at, if it may be taken from afar.
      turnOnly.identity().extractRotation(s.ray.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(s.ray.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(turnOnly);
      // Aim is forgiving: a small thing across a room is hard to point at exactly, so anything the ray
      // passes close to counts.
      let closest = Infinity;
      for (const thing of things.values()) {
        if (!thing.far || !thing.object.visible || isHeld(thing.object)) continue;
        box.setFromObject(thing.object).getBoundingSphere(ball);
        const along = ball.center.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
        if (along <= 0 || along > FAR_REACH) continue;
        const off = raycaster.ray.distanceToPoint(ball.center);
        if (off > ball.radius + 0.04 + along * 0.02) continue;
        // Of the things near the ray, the one it points at most squarely.
        if (off / along < closest) [best, closest] = [thing, off / along];
      }
      pulled = !!best && best.pull;
    }
    if (!best) return false;
    const object = best.object;
    const coming = returning.findIndex((r) => r.object === object);
    if (coming >= 0) returning.splice(coming, 1);
    const home = { parent: object.parent, position: object.position.clone(), quaternion: object.quaternion.clone() };
    const hand = s.grip.visible ? s.grip : s.ray;
    hand.attach(object); // keeps it where it is in the world, and from now on it moves with the hand
    held.set(slot, { thing: best, by, home, ...(pulled ? { pull: { from: object.position.clone(), t: 0 } } : {}) });
    pulse(slot, 0.6, 35);
    best.onGrab?.(slot);
    return true;
  };

  function release(slot: number): void {
    const h = held.get(slot);
    if (!h) return;
    held.delete(slot);
    const object = h.thing.object;
    const parent = h.home.parent ?? opts.scene;
    parent.attach(object);
    if (h.thing.release === "return") returning.push({ object, from: object.position.clone(), fromQ: object.quaternion.clone(), to: h.home.position, toQ: h.home.quaternion, t: 0 });
    pulse(slot, 0.25, 20);
    h.thing.onRelease?.(slot);
  }

  slots.forEach((s, i) => {
    // A controller's grip picks up; a tracked hand has no grip, so its pinch does, when something is in reach.
    listen(s.ray, "squeezestart", (() => void grab(i, "squeeze")) as never);
    listen(s.ray, "squeezeend", (() => {
      if (held.get(i)?.by === "squeeze") release(i);
    }) as never);
    listen(s.ray, "selectstart", (() => {
      if (kindOf(s) === "hand") grab(i, "pinch");
    }) as never);
    listen(s.ray, "selectend", (() => {
      if (held.get(i)?.by === "pinch") release(i);
    }) as never);
  });

  // ----------------------------------------------------------------- choices
  const setComfort = (patch: Partial<Comfort>, keep = false) => {
    comfort = { ...comfort, ...cleanComfort(patch) };
    if (keep) saveComfort(comfort);
  };
  // They were moving the intense way in a headset where they came from: the same here, kept as their choice.
  if (opts.arrivedIntense && !isIntense(comfort)) setComfort(INTENSE_COMFORT, true);
  if (opts.controls) {
    const controls = opts.controls;
    let headset = false;
    void navigator.xr
      ?.isSessionSupported("immersive-vr")
      .then((ok) => {
        headset = ok;
        controls.addSection({ id: "moving", label: "Moving", icon: "step", note });
      })
      .catch(() => {});
    const hidden = () => !headset;
    const note = () =>
      comfort.move === "steps"
        ? "With a controller: push a stick forward, point at the floor and let go to step there. Flick the other stick to turn. Squeeze the grip to pick things up. Pointing and selecting does everything too."
        : "With a controller: one stick walks, the other turns. If it makes you feel unwell, go back to stepping: it is the comfortable way.";
    controls.addSection({ id: "moving", label: "Moving", icon: "step", note });
    const change = (patch: Partial<Comfort>) => {
      setComfort(patch, true);
      controls.addSection({ id: "moving", label: "Moving", icon: "step", note });
    };
    controls.add(
      {
        // One switch for the two ways of moving in a headset. The settings under it are what it sets, and can
        // each be changed afterwards.
        id: "move-style",
        section: "moving",
        icon: "motion",
        hidden,
        on: () => isIntense(comfort),
        label: () => (isIntense(comfort) ? "Headset controls: intense" : "Headset controls: casual"),
        short: "Style",
        act: () => {
          const intense = !isIntense(comfort);
          change(intense ? INTENSE_COMFORT : CASUAL_COMFORT);
          controls.say(
            intense
              ? "Intense: one stick walks, the other turns, smoothly, with the whole view. If it makes you feel unwell, go back to casual."
              : "Casual: point at the floor to step there, and turn a notch at a time. The comfortable way.",
          );
        },
      },
      { id: "move-mode", section: "moving", icon: "step", hidden, on: () => comfort.move === "smooth", label: () => (comfort.move === "steps" ? "Moving in steps. Walk smoothly instead" : "Walking smoothly. Move in steps instead"), short: "Walk", act: () => change({ move: comfort.move === "steps" ? "smooth" : "steps" }) },
      {
        id: "turn-mode",
        section: "moving",
        icon: "turn",
        hidden,
        on: () => comfort.turn === "smooth",
        label: () => (comfort.turn === "smooth" ? "Turning smoothly. Turn in steps instead" : `Turning ${comfort.turnStep}° at a time. Change`),
        short: "Turn",
        // In steps of 30, then 45, then 90, then smoothly, and round again.
        act: () => change(comfort.turn === "smooth" ? { turn: "steps", turnStep: 30 } : comfort.turnStep === 30 ? { turnStep: 45 } : comfort.turnStep === 45 ? { turnStep: 90 } : { turn: "smooth" }),
      },
      { id: "move-hand", section: "moving", icon: "motion", hidden, label: () => `The ${comfort.moveHand} stick moves you. Swap hands`, short: "Hands", act: () => change({ moveHand: comfort.moveHand === "left" ? "right" : "left" }) },
      {
        id: "move-narrow",
        section: "moving",
        icon: "look",
        hidden: () => hidden() || (comfort.move === "steps" && comfort.turn === "steps"),
        on: () => comfort.narrow,
        label: () => (comfort.narrow ? "The view narrows while you move. Turn that off" : "Narrow the view while you move"),
        short: "Narrow",
        act: () => change({ narrow: !comfort.narrow }),
      },
    );
  }

  // -------------------------------------------------------------- each frame
  let aiming: number[] = [];
  const read = (): HeldPad[] =>
    slots.flatMap((s, index) => (kindOf(s) === "controller" && s.source?.gamepad ? [{ index, hand: handOf(s), pad: readPad(s.source.gamepad) }] : []));

  const update = (dt: number) => {
    const presenting = renderer.xr.isPresenting;
    if (!presenting) {
      aiming = [];
      narrow = 0;
      vignette.visible = false;
      for (const slot of [...held.keys()]) release(slot);
    } else {
      const pads = read();
      const intent = loco.frame(dt, pads, comfort);
      if (intent.turn !== 0) {
        turnVisitor(rig, camera, intent.turn);
        if (comfort.turn === "steps") for (const p of pads) if (Math.abs(p.pad.stick[0]) > 0.5) pulse(p.index, 0.2, 12);
      }
      if (intent.walk[0] !== 0 || intent.walk[1] !== 0) walk(intent.walk[0], intent.walk[1]);
      for (const slot of intent.stepFrom) {
        opts.stepFrom?.(slot);
        pulse(slot, 0.35, 20);
      }
      if (intent.menu) opts.onMenu?.();
      if (intent.jump) opts.onJump?.();
      if (intent.summon) opts.onSummon?.();
      aiming = intent.aiming;
      // Close in fast and open slowly: it is the closing that helps.
      narrow += (intent.narrow - narrow) * Math.min(1, dt * (intent.narrow > narrow ? 12 : 3));
      (vignette.material as THREE.ShaderMaterial).uniforms.uAmount!.value = narrow * 0.85;
      vignette.visible = narrow > 0.01;

      slots.forEach((s, i) => {
        const kind = kindOf(s);
        if (s.model) {
          s.model.group.visible = kind === "controller";
          const pad = pads.find((p) => p.index === i)?.pad ?? NO_PAD;
          (s.model.trigger.material as THREE.MeshBasicMaterial).color.copy(accent).multiplyScalar(0.2 + 0.8 * pad.trigger);
          (s.model.squeeze.material as THREE.MeshBasicMaterial).color.copy(accent).multiplyScalar(0.2 + 0.8 * pad.squeeze);
        }
        if (opts.models !== false && kind === "hand") dressHand(s.hand);
        s.hand.visible = opts.models !== false && kind === "hand";
      });
    }

    // Something taken from afar comes to the hand; something let go finds its way home.
    for (const h of held.values()) {
      if (!h.pull) continue;
      h.pull.t = Math.min(1, h.pull.t + dt / 0.18);
      h.thing.object.position.lerpVectors(h.pull.from, HOLD_AT, 1 - (1 - h.pull.t) ** 3);
      if (h.pull.t === 1) delete h.pull;
    }
    for (let i = returning.length - 1; i >= 0; i--) {
      const r = returning[i]!;
      r.t = Math.min(1, r.t + dt / 0.35);
      const k = 1 - (1 - r.t) ** 3;
      r.object.position.lerpVectors(r.from, r.to, k);
      r.object.quaternion.slerpQuaternions(r.fromQ, r.toQ, k);
      if (r.t === 1) returning.splice(i, 1);
    }
  };

  return {
    get comfort() {
      return comfort;
    },
    get intense() {
      return isIntense(comfort);
    },
    setComfort,
    update,
    grabbable(object, o = {}) {
      things.set(object, { object, reach: o.reach ?? 0.1, far: o.far ?? true, pull: o.pull ?? true, release: o.release ?? "stay", ...(o.onGrab ? { onGrab: o.onGrab } : {}), ...(o.onRelease ? { onRelease: o.onRelease } : {}) });
      return () => {
        for (const [slot, h] of held) if (h.thing.object === object) release(slot);
        things.delete(object);
      };
    },
    claimed: (slot) => held.get(slot)?.by === "pinch",
    pulse,
    info() {
      const pads = renderer.xr.isPresenting ? read() : [];
      return {
        comfort,
        slots: slots.map((s, i) => ({ hand: handOf(s), kind: kindOf(s), pad: pads.find((p) => p.index === i)?.pad ?? NO_PAD })),
        aiming,
        holding: [0, 1].map((i) => held.get(i)?.thing.object.name || (held.has(i) ? "(unnamed)" : null)),
        narrow: Math.round(narrow * 100) / 100,
        pulses,
      };
    },
    dispose() {
      for (const slot of [...held.keys()]) release(slot);
      for (const [target, type, fn] of listeners) target.removeEventListener(type as never, fn as never);
      camera.remove(vignette);
      vignette.geometry.dispose();
      (vignette.material as THREE.Material).dispose();
      for (const s of slots) {
        if (!s.model) continue;
        s.grip.remove(s.model.group);
        s.model.metal.dispose();
      }
      jointShape.dispose();
    },
  };
}
