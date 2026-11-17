import * as THREE from "three";
import { encodeNaddr, WORLD_KIND } from "@nswp/core";
import sites from "../../sites.json";
import { startWorld } from "../../shared/world.js";

const a = sites.worlds["world-a"];

void startWorld({
  name: "World B: The Grove",
  tagline: "NSWP reference world · test build",
  palette: { sky: 0x2b1a0f, ground: 0x3a2a14, accent: 0xffb703, fog: 0x2b1a0f, text: "#fff3d6" },
  airlock: sites.airlock,
  entryPoints: {
    "main-entrance": { position: [0, 0, 4], yaw: 0 },
    clearing: { position: [-3, 0, 0], yaw: -Math.PI / 2 },
  },
  portal: {
    label: "To World A: The Gallery",
    naddr: encodeNaddr({ kind: WORLD_KIND, pubkey: sites.publisher, identifier: a.d, relays: sites.relays.slice(0, 2) }),
    url: a.url,
    entryPoint: "main-entrance",
    position: [0, 0, -3],
  },
  decorate(scene, accent) {
    // A ring of glowing trees with floating motes.
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.35, roughness: 0.8 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 7 + (i % 3);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2, 8), trunkMat);
      trunk.position.set(Math.cos(a) * r, 1, Math.sin(a) * r);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 10), leafMat);
      crown.position.set(trunk.position.x, 2.8, trunk.position.z);
      scene.add(trunk, crown);
    }
    const motes = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(Array.from({ length: 600 }, (_, i) => (i % 3 === 1 ? Math.random() * 4 : (Math.random() - 0.5) * 16)), 3),
      ),
      new THREE.PointsMaterial({ color: accent, size: 0.05 }),
    );
    scene.add(motes);
    return (t) => {
      motes.rotation.y = t * 0.03;
      motes.position.y = Math.sin(t * 0.5) * 0.1;
    };
  },
});
