import * as THREE from "three";
import { encodeNaddr, WORLD_KIND } from "@nswp/core";
import previews from "../../previews/index.json";
import sites from "../../sites.json";
import { startWorld } from "../../shared/world.js";

const a = sites.worlds["world-a"];

void startWorld({
  name: "World B: The Grove",
  tagline: "NSWP reference world · test build",
  palette: { sky: 0x0a0603, ground: 0x0d0804, accent: 0xffb703, fog: 0x0a0603, text: "#fff3d6" },
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
    preview: (previews as Record<string, { sha256: string } | undefined>)["world-a"],
  },
  decorate(scene, accent, blocks) {
    // A grove: a ring of trees built from blocks, each with a lit crown, and motes drifting between them.
    const leaf = new THREE.Color(0x1a1206).lerp(accent, 0.3);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 7 + (i % 3);
      blocks.at([Math.round(Math.cos(a) * r * 2) / 2, 0, Math.round(Math.sin(a) * r * 2) / 2], (i * 37) % 90);
      const tall = 1.6 + (i % 4) * 0.2;
      blocks.box([0.3, tall, 0.3], [0, tall / 2, 0], { color: 0x1a1108 });
      blocks.box([1.4, 0.6, 1.4], [0, tall + 0.3, 0], { color: leaf });
      blocks.box([1.0, 0.6, 1.0], [0, tall + 0.9, 0], { color: leaf });
      blocks.box([0.5, 0.5, 0.5], [0, tall + 1.45, 0], { color: accent, lit: true });
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
