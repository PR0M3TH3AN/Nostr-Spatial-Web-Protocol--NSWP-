/**
 * A picture of an item, for the Bag tab: the item itself, drawn from its own model (protocol/17-items.md).
 *
 * Nobody has to make a thumbnail for an item, and nobody can make a misleading one: what is shown in the bag is
 * the very model that would be in the visitor's hand, read and checked the same way, in the colours they chose.
 *
 * It is drawn by the page, in a small view of its own, whatever draws the world: so a bag looks the same in a
 * world made with Three.js and in one made with another engine. One view serves every picture. A still is drawn
 * once and kept; the one item the visitor has chosen is drawn again each time it is asked for, turning.
 */
import type { Item } from "@nswp/core";
import * as THREE from "three";

export interface ItemPreviews {
  /** An item as a still picture: kept once it has been drawn. Null while its model is on its way, or can't be drawn here. */
  still(item: Item, tints?: Record<string, string>): HTMLCanvasElement | null;
  /** The same, turning: drawn again each time this is asked for. `moving` false holds it still, for someone who asked for no motion. */
  turning(item: Item, tints?: Record<string, string>, moving?: boolean): HTMLCanvasElement | null;
  /** Be told when a picture that wasn't ready is. */
  onChange(fn: () => void): void;
}

export interface ItemPreviewsOptions {
  /** What gives an item's model: fetched, checked and counted (items.ts). A plain marker where that failed. */
  model(item: Item, tints?: Record<string, string>): Promise<THREE.Object3D>;
  /** Pixels along each side of a picture. Left out, 256. */
  size?: number;
}

/** How many items' models are kept ready at once: a bag is looked through a page at a time. */
const KEPT = 36;

interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Group;
}

export function createItemPreviews(o: ItemPreviewsOptions): ItemPreviews {
  const size = o.size ?? 256;
  const watchers = new Set<() => void>();
  /** A model that has been made, the round space it fills, and its pictures. Null while it is being made. */
  const ready = new Map<string, { object: THREE.Object3D; middle: THREE.Vector3; radius: number; still: HTMLCanvasElement | null; live: HTMLCanvasElement | null } | null>();
  let stage: Stage | null | undefined;

  const keyOf = (item: Item, tints?: Record<string, string>): string => `${item.id}|${item.model.sha256}|${JSON.stringify(tints ?? {})}`;

  /** The one small view everything is drawn in. Null where this device can't make one: then there are no pictures. */
  const stageNow = (): Stage | null => {
    if (stage !== undefined) return stage;
    if (typeof document === "undefined") return (stage = null);
    try {
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(1);
      renderer.setSize(size, size, false);
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      // Lit from above and in front, with a little from behind to pick out its edge: a thing on a shop's shelf.
      scene.add(new THREE.HemisphereLight(0xffffff, 0x29323d, 1.7));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(1.6, 2.6, 2.2);
      const rim = new THREE.DirectionalLight(0xbfd8ff, 1.3);
      rim.position.set(-2, 1.2, -2.4);
      const pivot = new THREE.Group();
      scene.add(key, rim, pivot);
      const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
      return (stage = { renderer, scene, camera, pivot });
    } catch {
      return (stage = null);
    }
  };

  /** Draw one thing, turned by `angle`, and copy the picture onto a canvas of its own. */
  const draw = (made: NonNullable<ReturnType<typeof ready.get>>, angle: number, onto: HTMLCanvasElement | null): HTMLCanvasElement | null => {
    const s = stageNow();
    if (!s) return null;
    s.pivot.clear();
    s.pivot.add(made.object);
    made.object.position.copy(made.middle).multiplyScalar(-1);
    s.pivot.rotation.set(0, angle, 0);
    // Far enough off that the whole of it is in the picture whichever way it is turned, seen from a little above.
    const away = (made.radius / Math.sin(THREE.MathUtils.degToRad(s.camera.fov / 2))) * 1.08;
    s.camera.position.set(0, away * 0.3, away * 0.95);
    s.camera.lookAt(0, 0, 0);
    s.camera.near = Math.max(0.005, away - made.radius * 2);
    s.camera.far = away + made.radius * 2;
    s.camera.updateProjectionMatrix();
    s.renderer.render(s.scene, s.camera);
    s.pivot.clear();
    const canvas = onto ?? document.createElement("canvas");
    if (!onto) canvas.width = canvas.height = size;
    const g = canvas.getContext("2d");
    if (!g) return null;
    g.clearRect(0, 0, size, size);
    g.drawImage(s.renderer.domElement, 0, 0, size, size);
    return canvas;
  };

  const want = (item: Item, tints?: Record<string, string>): NonNullable<ReturnType<typeof ready.get>> | null => {
    const key = keyOf(item, tints);
    const had = ready.get(key);
    if (had !== undefined) return had;
    if (!stageNow()) return null;
    ready.set(key, null);
    // The oldest go, once there are more than a bag shows at a time.
    for (const old of ready.keys()) {
      if (ready.size <= KEPT) break;
      if (old !== key) ready.delete(old);
    }
    void o.model(item, tints).then(
      (object) => {
        if (!ready.has(key)) return;
        const box = new THREE.Box3().setFromObject(object);
        const ball = box.getBoundingSphere(new THREE.Sphere());
        if (!Number.isFinite(ball.radius) || ball.radius <= 0) return void ready.delete(key);
        ready.set(key, { object, middle: ball.center.clone(), radius: ball.radius, still: null, live: null });
        for (const fn of watchers) fn();
      },
      () => void ready.delete(key),
    );
    return null;
  };

  return {
    still(item, tints) {
      const made = want(item, tints);
      if (!made) return null;
      // Turned a little to one side, as a thing is shown: its front and its side both in view.
      return (made.still ??= draw(made, -0.62, null));
    },
    turning(item, tints, moving = true) {
      const made = want(item, tints);
      if (!made) return null;
      const angle = moving ? ((typeof performance === "undefined" ? 0 : performance.now()) / 1000) * 0.7 : -0.62;
      return (made.live = draw(made, angle, made.live));
    },
    onChange(fn) {
      watchers.add(fn);
    },
  };
}
