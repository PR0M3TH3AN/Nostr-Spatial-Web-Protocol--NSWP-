import * as THREE from "three";
import { encodeNaddr, WORLD_KIND } from "@nswp/core";
import { addBench, addCrystal, addGyro, addKnot, addLamp, addPlinth, addSpiral, addWall, createHalo, MeshBuilder } from "nswp-sdk/home";
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
  decorate(scene, kit) {
    // A gallery: two long walls, and between them four sculptures on plinths, slowly turning.
    const room = kit.builder;
    addWall(room.at([-5.2, 0, 0], 90), 12, 4);
    addWall(room.at([5.2, 0, 0], -90), 12, 4);
    addBench(room.at([-4.5, 0, 3.4], 90), kit.soft);
    addBench(room.at([4.5, 0, 3.4], -90), kit.soft);
    for (const x of [-4.4, 4.4]) {
      addLamp(room.at([x, 0, -5]));
      const halo = createHalo(kit.accent, 1.5);
      halo.position.set(x, 1.64, -5);
      scene.add(halo);
    }
    // The sculptures are made of something else: a metal whose colour moves as you walk round it.
    const metal = kit.alloy({ gloss: 1, sheen: 0.6 });
    const works = [addKnot, addGyro, (m: MeshBuilder) => addCrystal(m, 0.8, 3, [0, -0.4, 0]), addSpiral];
    const pieces: THREE.Object3D[] = [];
    [-3.2, 3.2].forEach((x, side) =>
      [-1, 1.5].forEach((z, row) => {
        addPlinth(room.at([x, 0, z]));
        const piece = new MeshBuilder().at();
        piece.tone = new THREE.Color(0x1b2733);
        works[side * 2 + row]!(piece);
        const art = piece.build(metal);
        art.position.set(x, 1.62, z);
        scene.add(art);
        pieces.push(art);
      }),
    );
    return (t) =>
      pieces.forEach((p, i) => {
        p.rotation.y = t * (0.22 + i * 0.06);
        p.position.y = 1.62 + Math.sin(t * 0.6 + i * 1.7) * 0.03;
      });
  },
});
