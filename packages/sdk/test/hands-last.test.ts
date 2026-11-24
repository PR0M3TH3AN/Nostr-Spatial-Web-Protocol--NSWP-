import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MENU_ORDER } from "../src/console.js";
import { createXrInput, drawnLast, HANDS_ORDER } from "../src/input.js";

/**
 * The visitor's own hands are drawn last, and so over the menu a headset shows (input.ts, `drawnLast`). The owner,
 * 2026-11-24: "we need to make sure that the menu is not drawn above the hands in VR", then "ok lets draw the hands
 * last". Whether a pixel of a hand is in fact covered is `trials/hands-over-menu.mjs`, in a made-up headset; what
 * is held here is the order itself, which is what that comes from.
 */
describe("the order of drawing in a headset", () => {
  it("hands come after the menu, and before what darkens the whole view", () => {
    expect(HANDS_ORDER).toBeGreaterThan(MENU_ORDER);
    // The vignette, a fade and what plays over the view (input.ts, play.ts) are from 997 up: those still cover a hand.
    expect(HANDS_ORDER).toBeLessThan(997);
  });

  it("everything under what is drawn of a hand is put in the last pass, and keeps its place in depth", () => {
    const one = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const two = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);
    const inner = new THREE.Group().add(two);
    const root = new THREE.Group().add(one, inner);
    drawnLast(root);
    for (const mesh of [one, two]) {
      expect(mesh.renderOrder).toBe(HANDS_ORDER);
      for (const m of [mesh.material].flat()) {
        // In the pass the menu is drawn in, or it could not come after it.
        expect(m.transparent).toBe(true);
        // And nothing else about it changed: it covers what is behind it, and a wall still hides it.
        expect(m.opacity).toBe(1);
        expect(m.depthTest).toBe(true);
        expect(m.depthWrite).toBe(true);
      }
    }
    // A group has nothing to draw, and is left as it was.
    expect(inner.renderOrder).toBe(0);
  });

  it("the kit's own controller and a tracked hand's joints are drawn so", () => {
    // A headset's three spaces for each hand, as three.js hands them out; no session.
    const spaces = [0, 1].map(() => ({ ray: new THREE.Group(), grip: new THREE.Group(), hand: new THREE.Group() }));
    const xr = { isPresenting: false, getController: (i: number) => spaces[i]!.ray, getControllerGrip: (i: number) => spaces[i]!.grip, getHand: (i: number) => spaces[i]!.hand, addEventListener: () => {}, removeEventListener: () => {}, getSession: () => null };
    const rig = new THREE.Group();
    const camera = new THREE.PerspectiveCamera();
    rig.add(camera);
    const input = createXrInput({ renderer: { xr } as unknown as THREE.WebGLRenderer, scene: new THREE.Scene(), rig, camera });
    try {
      for (const { grip } of spaces) {
        const meshes: THREE.Mesh[] = [];
        grip.traverse((o) => void ((o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh)));
        // The handle, the trigger's light and the squeeze's.
        expect(meshes.length).toBeGreaterThanOrEqual(3);
        for (const mesh of meshes) {
          expect(mesh.renderOrder).toBe(HANDS_ORDER);
          for (const m of [mesh.material].flat()) expect(m.transparent).toBe(true);
        }
      }
    } finally {
      input.dispose();
    }
  });
});
