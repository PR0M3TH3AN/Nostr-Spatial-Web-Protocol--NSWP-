/**
 * The Observatory: a terrace under the ringed world, with an orrery turning
 * at its middle. It exists for looking up.
 */
import * as THREE from "three";
import { addBench, addGyro, addLamp, addWall, MeshBuilder } from "nswp-sdk/home";
import { startWorld } from "../../shared/world.js";

const MIDDLE: [number, number] = [0, -3];

void startWorld({
  site: "observatory",
  title: "The Observatory",
  purpose: "A terrace for looking at the sky. The world overhead is ruled with the same grid as the ground you are standing on.",
  palette: { ground: 0x06050f, accent: 0x9b8cff, text: "#ebe8ff" },
  entryPoints: { "main-entrance": { position: [0, 0, 5], yaw: 0 } },
  doors: [
    { to: "grove", label: "The Grove", position: [-6.2, 0, -8.6] },
    { to: "library", label: "The Library", position: [6.2, 0, -8.6] },
  ],
  middle: MIDDLE,
  reach: 8.9,
  // The ringed world, large and straight ahead, a little to the left: it is what this place is about.
  environment: { planet: { turn: -14, height: 29, size: 1.8 }, seed: 41 },
  build(kit) {
    const terrace = kit.builder;
    const [mx, mz] = MIDDLE;
    // Rings on the floor, like the lines on a chart.
    terrace.at([mx, 0, mz]);
    for (const [r, glow] of [[3.4, 0.55], [6.2, 0.4], [9.05, 0.7]] as const) terrace.lathe([[r + 0.06, 0.014], [r, 0.014]], [0, 0, 0], 72, () => ({ glow }));
    // A low wall all the way round, open towards the way in, with a lamp where each stretch meets the next.
    for (let k = 1; k < 10; k++) {
      const a = (k * 36 * Math.PI) / 180;
      addWall(terrace.at([mx + Math.sin(a) * 9.5, 0, mz + Math.cos(a) * 9.5], k * 36 + 180), 5.5, 1.05);
    }
    for (let k = 0; k < 10; k++) {
      const a = ((k * 36 + 18) * Math.PI) / 180;
      const [x, z] = [mx + Math.sin(a) * 9.9, mz + Math.cos(a) * 9.9];
      addLamp(terrace.at([x, 0, z]));
      kit.halo([x, 1.64, z], 1.1);
    }
    // Seats facing the sky.
    addBench(terrace.at([-2.6, 0, 1.6], 172), kit.soft);
    addBench(terrace.at([2.6, 0, 1.6], -172), kit.soft);
    kit.sign("The lines between the stars", "They are drawn like a map of a network. Each point is a relay, and each light moving along a line is a message on its way.", [3.4, 1.5, -0.2], 2);

    // The orrery: a stand, three great hoops turning round a light, and three small bodies in orbit.
    terrace.at([mx, 0, mz]);
    terrace.lathe([[1.5, 0], [1.5, 0.12], [1.15, 0.16], [1.15, 0.3], [0.6, 0.38], [0.2, 1.05], [0.32, 1.12], [0.32, 1.2], [0.0005, 1.24]], [0, 0, 0], 8, (row) => (row === 1 || row === 6 ? { glow: 0.8 } : { shade: 1 + (row % 2) * 0.2 }));
    const metal = kit.alloy({ gloss: 1, sheen: 0.55 });
    const hoops = new MeshBuilder().at();
    hoops.tone = new THREE.Color(0x1d1b33);
    addGyro(hoops, 2.7);
    const orrery = hoops.build(metal);
    orrery.position.set(mx, 2.75, mz);
    kit.scene.add(orrery);
    kit.halo([mx, 2.75, mz], 2.6);
    const body = new MeshBuilder().at();
    body.tone = new THREE.Color(0x1d1b33);
    body.lathe([[0.0005, -0.16], [0.13, -0.05], [0.13, 0.05], [0.0005, 0.16]], [0, 0, 0], 6, (row) => (row === 1 ? { glow: 0.6 } : {}));
    const shape = body.geometry();
    const bodies = [2.1, 2.7, 3.3].map((out, i) => {
      const mesh = new THREE.Mesh(shape, metal);
      kit.scene.add(mesh);
      return { mesh, out, speed: 0.34 - i * 0.08, tilt: 0.25 + i * 0.2 };
    });
    return {
      update(t) {
        orrery.rotation.set(t * 0.07, t * 0.11, 0);
        for (const b of bodies) {
          const a = t * b.speed + b.out;
          b.mesh.position.set(mx + Math.cos(a) * b.out, 2.75 + Math.sin(a) * b.out * Math.sin(b.tilt), mz + Math.sin(a) * b.out * Math.cos(b.tilt));
          b.mesh.rotation.y = t;
        }
      },
    };
  },
});
