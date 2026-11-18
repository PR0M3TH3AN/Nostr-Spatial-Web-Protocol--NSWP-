import { encodeNaddr, WORLD_KIND } from "@nswp/core";
import { addBench, addCrystal, addLamp, addTree, createHalo } from "nswp-sdk/home";
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
  decorate(scene, kit) {
    // A grove: a clearing ringed with lantern trees, more of them thinning out behind, and somewhere to sit.
    const grove = kit.builder;
    const leaf = kit.builder.tone.clone().lerp(kit.accent, 0.035);
    const tree = (i: number, angle: number, out: number) => {
      grove.at([Math.cos(angle) * out, 0, Math.sin(angle) * out], (i * 37) % 360, 0.9 + (i % 5) * 0.09);
      addTree(grove, leaf, i + 1, 2.1 + (i % 4) * 0.35);
    };
    for (let i = 0; i < 14; i++) tree(i, (i / 14) * Math.PI * 2 + 0.22, 7.4 + (i % 3) * 0.9);
    for (let i = 0; i < 22; i++) tree(14 + i, (i / 22) * Math.PI * 2, 12.5 + ((i * 7) % 5) * 2.1);
    // Stones that have grown crystals, either side of the way through.
    addCrystal(grove, 0.9, 5, [-2.6, 0, -4.2], 20);
    addCrystal(grove, 0.6, 9, [2.9, 0, -3.6], 140);
    addCrystal(grove, 0.5, 2, [-4.4, 0, 2.2], 250);
    addBench(grove.at([-3.6, 0, -0.4], 70), kit.soft);
    addBench(grove.at([3.6, 0, 0.6], -75), kit.soft);
    for (const [x, z] of [[-1.9, 2.2], [1.9, 2.2], [-1.9, -1.4], [1.9, -1.4]] as const) {
      addLamp(grove.at([x, 0, z]));
      const halo = createHalo(kit.accent, 1.5);
      halo.position.set(x, 1.64, z);
      scene.add(halo);
    }
    return () => {};
  },
});
