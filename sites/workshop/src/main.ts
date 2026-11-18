/**
 * The Workshop: every part these worlds are built from, set out with its name.
 * It exists for anyone who wants to build a world of their own.
 */
import * as THREE from "three";
import {
  addArchFrame, addBench, addLamp, addPlant, addPlinth, addTable, addTree, addWall,
  loopFrames, mouldingPaint, mouldingProfile, MeshBuilder,
} from "nswp-sdk/home";
import { startWorld } from "../../shared/world.js";


type Exhibit = [name: string, about: string, make: (b: MeshBuilder, soft: THREE.Color) => void, glow?: [number, number]];

// Down the left: the ready-made parts. Down the right: the four ways of making a shape.
const parts: Exhibit[] = [
  ["addBench", "A seat with a slatted back.", (b, soft) => addBench(b, soft)],
  ["addTable", "A top on four turned legs, with a line of light let in.", (b, soft) => addTable(b, soft)],
  ["addLamp", "A lantern on a post. Its glow is drawn, not lit.", (b) => addLamp(b), [0, 1.64]],
  ["addPlant", "A planter and a spray of folded blades.", (b, soft) => addPlant(b, soft, 3)],
  ["addPlinth", "Something to stand a thing on.", (b) => addPlinth(b)],
];
const ways: Exhibit[] = [
  ["box", "A block with its edges cut and a panel pressed into each side.", (b) => b.box([0.8, 0.8, 0.8], [0, 0.5, 0], { bevel: 0.06, panel: { margin: 0.14, depth: 0.05, glow: 0.5 } })],
  ["lathe", "An outline turned about the vertical. Twelve sides here.", (b) => b.lathe([[0.2, 0.1], [0.42, 0.3], [0.44, 0.52], [0.2, 0.9], [0.16, 1.1], [0.26, 1.24], [0.24, 1.3]], [0, 0, 0], 12, (row) => (row === 4 ? { glow: 0.8 } : { shade: 0.9 + (row % 2) * 0.25 }))],
  ["sweep", "An outline carried along a path. The doorway's moulding, round a hoop.", (b) => b.sweep(mouldingProfile(0.06, 0.08, 0.018, 0.014, 0.014), loopFrames((u) => [Math.cos(u * Math.PI * 2) * 0.5, 0.72 + Math.sin(u * Math.PI * 2) * 0.5, 0], 48), mouldingPaint, { loop: true })],
  ["line", "A strip of light lying on a surface.", (b) => {
    b.box([1, 0.9, 0.12], [0, 0.6, 0], { bevel: 0.02 });
    for (let i = 0; i < 5; i++) b.line([-0.4, 0.3 + i * 0.15, 0.061], [-0.4 + 0.16 * (i + 1), 0.3 + i * 0.15, 0.061], 0.03, [0, 0, 1]);
  }],
  ["glow, shade, flow", "What a face is painted with: how much it is a light, how deep it sits, and the way a pulse travels along it.", (b) => {
    for (let i = 0; i < 5; i++) b.box([0.16, 0.3 + i * 0.16, 0.16], [-0.4 + i * 0.2, (0.3 + i * 0.16) / 2 + 0.1, 0], { bevel: 0.015, glow: i * 0.25, flow: i });
  }],
];

void startWorld({
  site: "workshop",
  title: "The Workshop",
  purpose: "Everything in these places is a shape written in code. Here are the parts, each with its name. A world of your own starts at the Starter Home.",
  palette: { ground: 0x0d0704, accent: 0xff8a3d, text: "#ffeede" },
  entryPoints: { "main-entrance": { position: [0, 0, 5], yaw: 0 } },
  doors: [
    { to: "starter", label: "The Starter Home", position: [-1.9, 0, -17], rotation: 0 },
    { to: "gallery", label: "The Gallery", position: [1.9, 0, -17], rotation: 0 },
  ],
  middle: [0, -6],
  reach: 26,
  build(kit) {
    const shop = kit.builder;
    /** A low stand under each exhibit, lit at its rim. */
    const stand = (x: number, z: number, wide = 1) => {
      shop.at([x, 0, z]);
      shop.lathe([[wide, 0], [wide, 0.06], [wide - 0.06, 0.1]], [0, 0, 0], 8, (row) => (row === 1 ? { glow: 0.6 } : {}), { turn: Math.PI / 8 });
      shop.lathe([[wide - 0.06, 0.1], [0.0005, 0.1]], [0, 0, 0], 8, () => ({ shade: 0.8 }), { turn: Math.PI / 8 });
    };
    const show = (list: Exhibit[], x: number) =>
      list.forEach(([name, about, make, glow], i) => {
        const z = 2 - i * 3.2;
        stand(x, z, 1.05);
        // Each part faces the aisle.
        shop.at([x, 0.1, z], x < 0 ? 90 : -90);
        make(shop, kit.soft);
        if (glow) kit.halo([x + glow[0], 0.1 + glow[1], z], 1.3);
        kit.sign(name, about, [x * 0.5, 0.62, z + 0.75], 1.3);
      });
    show(parts, -4);
    show(ways, 4);
    // At the far end, the big ones: a doorway's frame with nothing in it, a tree, and a wall behind the two real doors.
    stand(-6.6, -14.2, 1.5);
    addArchFrame(shop.at([-6.6, 0.1, -14.2], 40));
    kit.sign("addArchFrame", "The frame every doorway stands in. This one is empty: the real doors are to your right.", [-5.2, 0.62, -12.6], 1.3);
    stand(6.6, -14.2, 1.2);
    shop.at([6.6, 0.1, -14.2], 20);
    addTree(shop, shop.tone.clone().lerp(kit.accent, 0.035), 5, 2.4);
    kit.sign("addTree", "A trunk and tiers of leaves, each edged with light.", [5.2, 0.62, -12.6], 1.3);
    addWall(shop.at([0, 0, -18.4]), 10, 3.4);
    kit.sign("addWall", "A run of wall, any length and height, in bays between posts.", [0, 0.62, -15.4], 1.3);
    // By the way in: three things to pick up, for anyone with a controller's grip or tracked fingers.
    addTable(shop.at([2.3, 0, 3.4], 90), kit.soft);
    kit.sign("Pick these up", "In a headset, squeeze a controller's grip on one, or pinch it with your fingers. Point and squeeze to take one from where you stand. Let go, and it goes home.", [2.3, 1.75, 3.4], 1.5);
    const pieces: [name: string, at: number, make: (b: MeshBuilder) => void][] = [
      ["a block", -0.36, (b) => b.box([0.12, 0.12, 0.12], [0, 0, 0], { bevel: 0.014, panel: { margin: 0.022, depth: 0.008, glow: 0.7 } })],
      ["a spindle", 0, (b) => b.lathe([[0.0005, -0.09], [0.05, -0.05], [0.022, 0], [0.05, 0.05], [0.0005, 0.09]], [0, 0, 0], 6, (row) => (row === 2 ? { glow: 0.9 } : { shade: 0.9 + (row % 2) * 0.25 }))],
      ["a ring", 0.36, (b) => b.sweep(mouldingProfile(0.02, 0.026, 0.006, 0.005, 0.005), loopFrames((u) => [Math.cos(u * Math.PI * 2) * 0.07, Math.sin(u * Math.PI * 2) * 0.07, 0], 24), mouldingPaint, { loop: true })],
    ];
    for (const [name, at, make] of pieces) {
      const b = new MeshBuilder().at();
      b.tone = kit.soft.clone();
      b.light = kit.accent.clone();
      make(b);
      const piece = b.build(kit.alloy({ gloss: 0.75 }));
      piece.name = name;
      piece.position.set(2.3, 0.86, 3.4 + at);
      kit.scene.add(piece);
      kit.grabbable(piece, { release: "return" });
    }
    return { canStand: (x, z) => Math.abs(x) < 8.4 && z < 8 && z > -17.9 && !(Math.abs(x - 2.3) < 0.55 && Math.abs(z - 3.4) < 0.8) };
  },
});
