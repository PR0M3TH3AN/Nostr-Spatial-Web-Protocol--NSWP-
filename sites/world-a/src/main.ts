import * as THREE from "three";
import { encodeNaddr, WORLD_KIND } from "@nswp/core";
import previews from "../../previews/index.json";
import sites from "../../sites.json";
import { startWorld } from "../../shared/world.js";

const b = sites.worlds["world-b"];

void startWorld({
  name: "World A: The Gallery",
  tagline: "NSWP reference world · test build",
  palette: { sky: 0x03060c, ground: 0x040912, accent: 0x4cc9f0, fog: 0x03060c, text: "#e0fbfc" },
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
    preview: (previews as Record<string, { sha256: string } | undefined>)["world-b"],
  },
  decorate(scene, accent, blocks) {
    // A gallery: two walls, and plinths with sculptures drawn in line, slowly turning.
    const shapes = [new THREE.IcosahedronGeometry(0.38), new THREE.TorusKnotGeometry(0.26, 0.08, 64, 8), new THREE.OctahedronGeometry(0.4), new THREE.DodecahedronGeometry(0.36)];
    const line = new THREE.LineBasicMaterial({ color: accent });
    const core = new THREE.MeshBasicMaterial({ color: 0x06101c });
    const pieces: THREE.Object3D[] = [];
    [-3.2, 3.2].forEach((x, side) =>
      [-1, 1.5].forEach((z, row) => {
        blocks.at([x, 0, z]);
        blocks.box([0.6, 1, 0.6], [0, 0.5, 0]);
        blocks.box([0.7, 0.1, 0.7], [0, 1.05, 0], { color: accent, lit: true, bare: true });
        const shape = shapes[side * 2 + row]!;
        const art = new THREE.Group();
        art.add(new THREE.Mesh(shape, core), new THREE.LineSegments(new THREE.WireframeGeometry(shape), line));
        art.position.set(x, 1.62, z);
        scene.add(art);
        pieces.push(art);
      }),
    );
    blocks.at([0, 0, 0]);
    for (const x of [-5, 5]) blocks.box([0.2, 4, 12], [x, 2, 0], { color: 0x07111f });
    return (t) => pieces.forEach((p, i) => (p.rotation.y = t * (0.3 + i * 0.1)));
  },
});
