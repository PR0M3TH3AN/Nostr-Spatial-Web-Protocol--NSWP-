/**
 * The Grove: a ring of seats round a hearth, under lantern trees.
 * It exists for sitting down and talking with whoever else is here.
 */
import { addBench, addCrystal, addLamp, addTree } from "nswp-sdk/home";
import { startWorld } from "../../shared/world.js";

const HEARTH: [number, number] = [0, -2];

void startWorld({
  site: "grove",
  title: "The Grove",
  // What people carry is drawn here: the one thing each holds (protocol/17-items.md). It is what this world's
  // announcement says, and the build checks that the two agree.
  items: "allowed",
  purpose: "Somewhere to sit and talk. Joined, you see and hear whoever else is here, and they see you. Not joined, nobody does.",
  palette: { ground: 0x0d0804, accent: 0xffb703, text: "#fff3d6" },
  entryPoints: {
    "main-entrance": { position: [0, 0, 5], yaw: 0, places: [{ position: [-1.2, 0, 5], yaw: 0 }, { position: [1.2, 0, 5], yaw: 0 }, { position: [-2.4, 0, 5], yaw: 0 }, { position: [2.4, 0, 5], yaw: 0 }, { position: [0, 0, 6.2], yaw: 0 }, { position: [-1.2, 0, 6.2], yaw: 0 }, { position: [1.2, 0, 6.2], yaw: 0 }] },
    clearing: { position: [-4, 0, -2], yaw: -90, places: [{ position: [-4, 0, -3.2], yaw: -90 }, { position: [-4, 0, -0.8], yaw: -90 }, { position: [-4, 0, -4.4], yaw: -90 }, { position: [-4, 0, 0.4], yaw: -90 }, { position: [-5.2, 0, -2], yaw: -90 }, { position: [-5.2, 0, -3.2], yaw: -90 }, { position: [-5.2, 0, -0.8], yaw: -90 }] },
  },
  doors: [
    { to: "gallery", label: "The Gallery", position: [-3.2, 0, -9] },
    { to: "observatory", label: "The Observatory", position: [3.2, 0, -9] },
  ],
  middle: HEARTH,
  reach: 15,
  build(kit) {
    const grove = kit.builder;
    const leaf = grove.tone.clone().lerp(kit.accent, 0.035);
    const [hx, hz] = HEARTH;
    // The hearth: a low round step with crystals growing from it, the brightest thing here.
    grove.at([hx, 0, hz]);
    grove.lathe([[1.5, 0], [1.5, 0.1], [1.3, 0.14], [1.3, 0.24], [1.15, 0.28], [0.0005, 0.28]], [0, 0, 0], 12, (row) => (row === 1 || row === 3 ? { glow: 0.7 } : { shade: 1.1 }));
    addCrystal(grove, 1.5, 6, [hx, 0.28, hz], 15);
    // Its light: a flame of the same stuff among the crystals.
    grove.at([hx, 0, hz]);
    for (const [x, z, tall] of [[0.34, 0.2, 1.0], [-0.3, 0.26, 0.8], [0.02, -0.38, 0.9]] as const) grove.lathe([[0.0005, 0.28], [0.13, 0.28 + tall * 0.3], [0.0005, 0.28 + tall]], [x, 0, z], 5, () => ({ glow: 1 }));
    kit.halo([hx, 1.1, hz], 4.2);
    kit.halo([hx, 0.4, hz], 2.4);
    // Five seats in a ring, all facing the hearth, with the side towards the way in left open.
    for (const turn of [65, 125, 180, 235, 295]) {
      const a = (turn * Math.PI) / 180;
      addBench(grove.at([hx + Math.sin(a) * 3.6, 0, hz + Math.cos(a) * 3.6], turn + 180), kit.soft);
    }
    for (const [x, z] of [[-2.4, 3.2], [2.4, 3.2], [-5.4, -6.4], [5.4, -6.4]] as const) {
      addLamp(grove.at([x, 0, z]));
      kit.halo([x, 1.64, z]);
    }
    // Lantern trees: a ring round the clearing, more of them thinning out behind, none in a doorway.
    const clear = (x: number, z: number) => Math.hypot(x, z - 5) > 3 && Math.hypot(x + 3.2, z + 9) > 2.6 && Math.hypot(x - 3.2, z + 9) > 2.6;
    const tree = (i: number, angle: number, out: number) => {
      const [x, z] = [hx + Math.cos(angle) * out, hz + Math.sin(angle) * out];
      if (!clear(x, z)) return;
      grove.at([x, 0, z], (i * 37) % 360, 0.9 + (i % 5) * 0.09);
      addTree(grove, leaf, i + 1, 2.1 + (i % 4) * 0.35);
    };
    for (let i = 0; i < 16; i++) tree(i, (i / 16) * Math.PI * 2 + 0.2, 8.6 + (i % 3) * 0.9);
    for (let i = 0; i < 26; i++) tree(16 + i, (i / 26) * Math.PI * 2, 14 + ((i * 7) % 5) * 2.3);
    addCrystal(grove, 0.7, 9, [-6.2, 0, 1.4], 140);
    addCrystal(grove, 0.55, 2, [6.4, 0, -0.6], 250);
  },
});
