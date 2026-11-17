import * as THREE from "three";
import { encodeNaddr, WORLD_KIND } from "@nswp/core";
import sites from "../../sites.json";
import { startWorld } from "../../shared/world.js";

const b = sites.worlds["world-b"];

void startWorld({
  name: "World A: The Gallery",
  tagline: "NSWP reference world · test build",
  palette: { sky: 0x0d1b2a, ground: 0x1b263b, accent: 0x4cc9f0, fog: 0x0d1b2a, text: "#e0fbfc" },
  airlock: sites.airlock,
  entryPoints: {
    "main-entrance": { position: [0, 0, 4], yaw: 0 },
    balcony: { position: [3, 0, -1], yaw: Math.PI / 2 },
  },
  portal: {
    label: "To World B: The Grove",
    naddr: encodeNaddr({ kind: WORLD_KIND, pubkey: sites.publisher, identifier: b.d, relays: sites.relays.slice(0, 2) }),
    url: b.url,
    entryPoint: "main-entrance",
    position: [0, 0, -3],
  },
  decorate(scene, accent) {
    // Plinths with slowly turning sculptures.
    const shapes = [new THREE.IcosahedronGeometry(0.35), new THREE.TorusKnotGeometry(0.25, 0.08, 96, 12), new THREE.OctahedronGeometry(0.35)];
    const pieces: THREE.Mesh[] = [];
    [-3.2, 3.2].forEach((x, side) =>
      [-1, 1.5].forEach((z, row) => {
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), new THREE.MeshStandardMaterial({ color: 0xe0e1dd, roughness: 0.6 }));
        plinth.position.set(x, 0.5, z);
        const art = new THREE.Mesh(shapes[(side + row) % shapes.length]!, new THREE.MeshStandardMaterial({ color: accent, metalness: 0.6, roughness: 0.25 }));
        art.position.set(x, 1.45, z);
        scene.add(plinth, art);
        pieces.push(art);
      }),
    );
    for (const x of [-5, 5]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 12), new THREE.MeshStandardMaterial({ color: 0x415a77 }));
      wall.position.set(x, 2, 0);
      scene.add(wall);
    }
    return (t) => pieces.forEach((p, i) => (p.rotation.y = t * (0.3 + i * 0.1)));
  },
});
