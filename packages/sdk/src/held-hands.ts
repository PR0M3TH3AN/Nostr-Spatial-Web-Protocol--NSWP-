/**
 * The kit's held hands: a see-through blue hand holding a see-through controller, for each side, in a headset with a
 * Quest's controllers (docs/backlog/hands-in-a-headset.md, part 2). Made by the 3D artist for the owner (bitportal-art
 * c30f660; packages/sdk/assets/hands/PROVENANCE.md), authored in WebXR grip space, so each goes straight onto its
 * controller's grip. The owner, 2026-11-25: "Use the live game as the testing ground. Ill let you know if they feel
 * off".
 *
 * Carried with the kit and served by the world itself, beside the kit's sounds (`hands/kit/`), never fetched from
 * anyone else while someone plays. Fetched once, on the first controller that is a Quest's, so a visitor on a flat
 * screen fetches none of it.
 *
 * The hand's clips are moved as the artist named them: `hold`, `index-rest`/`index-pulled` by the trigger,
 * `fingers-open`/`fingers-squeezed` by the grip, and one of `thumb-lower`, `-upper`, `-stick`, `-rest` or `-up` by
 * which control the thumb is on. The controller's trigger, grip, buttons and stick move by its own parts, as the
 * WebXR Input Profiles code moves them. Not part of the package's entries.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PadLike } from "./actions.js";

export type HeldSide = "left" | "right";

/** A Quest's controllers, by the profile ids a headset gives them: the ones these hands are made for. */
export function wantsHeldHands(profiles: readonly string[] | undefined): boolean {
  return !!profiles && profiles.some((p) => /^(meta-quest-|oculus-touch)/.test(p));
}

export interface HeldModel {
  /** The hand and its controller, in grip space. */
  readonly group: THREE.Group;
  /** Move them as the controller is held now. */
  pose(pad: PadLike | null | undefined): void;
}

/** Which control the thumb is on, from the xr-standard buttons: A/X lower, B/Y upper, the stick, the thumb rest, or none. */
export function thumbOn(b: PadLike["buttons"]): "lower" | "upper" | "stick" | "rest" | "up" {
  const on = (i: number) => !!b[i] && (!!b[i]!.touched || b[i]!.pressed);
  if (on(4)) return "lower";
  if (on(5)) return "upper";
  if (on(3)) return "stick";
  if (on(6)) return "rest";
  return "up";
}

/** The artist's look: see-through, with a rim that glows at the edges as they turn away. */
function rimMaterial(o: { color: number; rim: number; opacity: number; rimPower: number; vertexAlpha?: boolean }): THREE.MeshPhongMaterial {
  const m = new THREE.MeshPhongMaterial({ color: o.color, transparent: true, opacity: o.opacity, depthWrite: false, shininess: 60, specular: 0x334455, vertexColors: !!o.vertexAlpha, side: THREE.FrontSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.rimColor = { value: new THREE.Color(o.rim) };
    s.uniforms.rimPower = { value: o.rimPower };
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;")
      .replace(
        "#include <opaque_fragment>",
        `
        float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), rimPower);
        float seen = clamp(diffuseColor.a * 3.0, 0.0, 1.0);
        outgoingLight = mix(outgoingLight, rimColor, fr * seen);
        diffuseColor.a = clamp(diffuseColor.a * (1.0 + 1.5 * fr), 0.0, 1.0);
        #include <opaque_fragment>`,
      );
  };
  return m;
}

type Part = { value: THREE.Object3D; min: THREE.Object3D; max: THREE.Object3D };
const press = (part: Part | undefined, t: number) => {
  if (!part) return;
  part.value.position.lerpVectors(part.min.position, part.max.position, t);
  part.value.quaternion.slerpQuaternions(part.min.quaternion, part.max.quaternion, t);
};

type Loaded = { scene: THREE.Group; animations: THREE.AnimationClip[] };
// The kit's own loader, already in every world's script for items and own models: the hands add none of their own.
let loader: GLTFLoader | null = null;
const loadGlb = (url: string): Promise<Loaded> => (loader ??= new GLTFLoader()).loadAsync(url) as unknown as Promise<Loaded>;

/** The two sides, as they come: each fetched once, for every world on this page. Null where it couldn't be. */
const made = new Map<string, Promise<HeldModel | null>>();

/**
 * The held hand and controller for `side`, from the world's `at` (where it serves the kit's hand files, for example
 * "/hands/kit/"). `finish` is given each mesh as it is made, so the kit draws it as it draws a hand (last, and not
 * aimed at). Null where the files couldn't be had: the kit's own drawing is kept then.
 */
export function heldHand(at: string, side: HeldSide, finish: (root: THREE.Object3D) => void): Promise<HeldModel | null> {
  const base = at.endsWith("/") ? at : `${at}/`;
  const key = `${base}|${side}`;
  let got = made.get(key);
  if (!got) {
    got = Promise.all([loadGlb(`${base}controller-${side}.glb`), loadGlb(`${base}hand-${side}.glb`)])
      .then(([ctl, hand]) => build(ctl, hand, finish))
      .catch(() => null);
    made.set(key, got);
  }
  return got;
}

function build(ctl: Loaded, hand: Loaded, finish: (root: THREE.Object3D) => void): HeldModel {
  const group = new THREE.Group();
  group.name = "nswp-held-hand";
  group.add(ctl.scene, hand.scene);
  const edges = new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55 });
  ctl.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = rimMaterial({ color: 0xc8dcf2, rim: 0xe8fbff, opacity: 0.16, rimPower: 3.0 });
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 35), edges));
  });
  hand.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = rimMaterial({ color: 0x3f86ff, rim: 0x9fe8ff, opacity: 0.55, rimPower: 2.2, vertexAlpha: true });
    mesh.frustumCulled = false;
  });
  finish(group);
  // Both in the hands' last pass: the controller's edge lines with its shell, and the hand after the controller, so
  // the see-through hand is laid over the see-through shell it holds.
  ctl.scene.traverse((o) => {
    if ((o as THREE.LineSegments).isLineSegments && o.parent) o.renderOrder = o.parent.renderOrder;
  });
  hand.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.renderOrder += 1;
  });
  const mixer = new THREE.AnimationMixer(hand.scene);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of hand.animations) {
    const a = mixer.clipAction(clip);
    a.play();
    a.setEffectiveWeight(0);
    actions[clip.name] = a;
  }
  const node = (n: string) => ctl.scene.getObjectByName(n);
  const parts: Record<string, Part> = {};
  for (const v of ["xr_standard_trigger", "xr_standard_squeeze", "xr_standard_thumbstick", "xr_standard_thumbstick_xaxis", "xr_standard_thumbstick_yaxis", "a_button", "b_button", "x_button", "y_button"]) {
    const value = node(`${v}_pressed_value`);
    const min = node(`${v}_pressed_min`);
    const max = node(`${v}_pressed_max`);
    if (value && min && max) parts[v] = { value, min, max };
  }
  const w = (n: string, v: number) => actions[n]?.setEffectiveWeight(v);
  return {
    group,
    pose(pad) {
      const b = pad?.buttons ?? [];
      const a = pad?.axes ?? [];
      const trigger = b[0]?.value ?? 0;
      const grip = b[1]?.value ?? 0;
      const thumb = thumbOn(b);
      w("hold", 1);
      w("index-rest", 1 - trigger);
      w("index-pulled", trigger);
      w("fingers-open", 1 - grip);
      w("fingers-squeezed", grip);
      for (const n of Object.keys(actions)) if (n.startsWith("thumb-")) w(n, n === `thumb-${thumb}` ? 1 : 0);
      press(parts.xr_standard_trigger, trigger);
      press(parts.xr_standard_squeeze, grip);
      press(parts.xr_standard_thumbstick, b[3]?.pressed ? 1 : 0);
      press(parts.xr_standard_thumbstick_xaxis, ((a[2] ?? 0) + 1) / 2);
      press(parts.xr_standard_thumbstick_yaxis, ((a[3] ?? 0) + 1) / 2);
      const lower = parts.a_button ? "a_button" : "x_button";
      const upper = parts.b_button ? "b_button" : "y_button";
      press(parts[lower], b[4]?.pressed ? 1 : 0);
      press(parts[upper], b[5]?.pressed ? 1 : 0);
      mixer.update(0);
    },
  };
}
