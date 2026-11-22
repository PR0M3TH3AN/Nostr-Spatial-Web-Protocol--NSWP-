/**
 * The Gallery: six sculptures made in code, turning on their plinths.
 * It exists to be looked at, and to show what the modelling kit can make.
 */
import * as THREE from "three";
import { addBench, addCrystal, addGyro, addHelix, addKnot, addLamp, addPlinth, addSpiral, addWall, MeshBuilder } from "nswp-sdk/home";
import { needsGate, startWorld } from "../../shared/world.js";
import world from "../world.json";

const works: [string, string, (b: MeshBuilder) => void][] = [
  ["Trefoil", "One ribbon swept round the simplest knot there is.", (b) => addKnot(b, 0.78, 2, 3)],
  ["Gyre", "Three hoops, each tipped a different way, round a point of light.", (b) => addGyro(b, 0.78)],
  ["Cinquefoil", "The same ribbon, taken five times through the middle.", (b) => addKnot(b, 0.82, 2, 5)],
  ["Shards", "Seven crystals turned on a lathe and leaned apart.", (b) => addCrystal(b, 0.8, 3, [0, -0.4, 0])],
  ["Stair", "Seventeen square frames, each turned a little further than the last.", (b) => addSpiral(b, 0.85)],
  ["Twine", "Two ribbons rising round each other, tied with bars of light.", (b) => addHelix(b, 0.9)],
];

void startWorld({
  site: "gallery",
  title: "The Gallery",
  purpose: "Six sculptures, each a few lines of code turned into a shape. Walk round them: their colour moves as you do.",
  palette: { ground: 0x040912, accent: 0x4cc9f0, text: "#e0fbfc" },
  entryPoints: {
    "main-entrance": { position: [0, 0, 5], yaw: 0, places: [{ position: [-1.2, 0, 5], yaw: 0 }, { position: [1.2, 0, 5], yaw: 0 }, { position: [-2.4, 0, 5], yaw: 0 }, { position: [2.4, 0, 5], yaw: 0 }, { position: [0, 0, 6.2], yaw: 0 }, { position: [-1.2, 0, 6.2], yaw: 0 }, { position: [1.2, 0, 6.2], yaw: 0 }] },
    balcony: { position: [3, 0, -1], yaw: 90, places: [{ position: [3, 0, 0.2], yaw: 90 }, { position: [3, 0, -2.2], yaw: 90 }, { position: [3, 0, 1.4], yaw: 90 }, { position: [3, 0, -3.4], yaw: 90 }, { position: [4.2, 0, -1], yaw: 90 }, { position: [4.2, 0, 0.2], yaw: 90 }, { position: [4.2, 0, -2.2], yaw: 90 }] },
  },
  doors: [
    { to: "grove", label: "The Grove", position: [-1.7, 0, -8.4] },
    { to: "workshop", label: "The Workshop", position: [1.7, 0, -8.4] },
  ],
  // Where a gate would stand if this world were paid or kept lists: past the first two pieces, which anyone may walk
  // round. It is neither: its world.json names nothing it is entered by, no keepers and no rule for its rooms, so
  // `on` is false and there is no gate at all.
  gate: { on: needsGate(world as Record<string, unknown>), past: (_x, z) => z < 0, veil: { position: [0, 0, 0], width: 10.4, height: 4 } },
  build(kit) {
    const room = kit.builder;
    // Two long walls, open at both ends, with the pieces down each side.
    addWall(room.at([-5.2, 0, -1.5], 90), 16, 4);
    addWall(room.at([5.2, 0, -1.5], -90), 16, 4);
    addBench(room.at([-4.4, 0, 4.4], 90), kit.soft);
    addBench(room.at([4.4, 0, 4.4], -90), kit.soft);
    for (const x of [-4.4, 4.4]) {
      addLamp(room.at([x, 0, -8.6]));
      kit.halo([x, 1.64, -8.6]);
    }
    // The sculptures are made of something else: a metal whose colour moves as you walk round it.
    const metal = kit.alloy({ gloss: 1, sheen: 0.6 });
    const pieces = works.map(([title, how, make], i) => {
      const x = i < 3 ? -3.2 : 3.2;
      const z = 2 - (i % 3) * 3.5;
      addPlinth(room.at([x, 0, z]));
      const piece = new MeshBuilder().at();
      piece.tone = new THREE.Color(0x1b2733);
      make(piece);
      const art = piece.build(metal);
      art.position.set(x, 1.66, z);
      kit.scene.add(art);
      kit.sign(title, how, [x * 0.66, 0.6, z + 0.5], 1.15);
      return art;
    });
    return {
      canStand: (x, z) => Math.abs(x) < 4.75 && z > -9.6 && z < 9,
      update(t) {
        pieces.forEach((p, i) => {
          p.rotation.y = t * (0.2 + i * 0.045);
          p.position.y = 1.66 + Math.sin(t * 0.6 + i * 1.7) * 0.03;
        });
      },
    };
  },
});
