/**
 * The Tour: five stops along a path, each teaching one thing.
 * It exists for someone's first minute on the spatial web.
 */
import * as THREE from "three";
import { addArchFrame, addLamp, createAlloy, MeshBuilder } from "nswp-sdk/home";
import { startWorld } from "../../shared/world.js";

const stops: [string, string][] = [
  ["1 of 5: Looking", "Drag to look around. In a headset, just look."],
  ["2 of 5: Moving", "Walk with W, A, S, D. Or point at the floor and select, and you step there. Step to the next ring."],
  ["3 of 5: Doors", "Every way out of a place is an arch like the one on your left. The sign above it says where it leads."],
  ["4 of 5: Before you go", "Going through a door first shows a plain page with the real address. Nothing loads from the other place until you agree."],
  ["5 of 5: Home", "The menu always has a way back to the room you came from. Your headset's own button always gets you out, too."],
];
const at = (i: number) => 1 - i * 4.2; // how far along the path each stop is

void startWorld({
  site: "tour",
  title: "The Tour",
  purpose: "Five stops that teach looking, moving, doors and the way home. Follow the rings.",
  palette: { ground: 0x070b05, accent: 0xb6f24a, text: "#f1fbdc" },
  entryPoints: { "main-entrance": { position: [0, 0, 5], yaw: 0 } },
  doors: [
    { to: "gallery", label: "The Gallery", position: [-2, 0, -20.6], rotation: 0 },
    { to: "arcade", label: "The Arcade", position: [2, 0, -20.6], rotation: 0 },
  ],
  middle: [0, -8],
  reach: 30,
  build(kit) {
    const path = kit.builder;
    path.at();
    // The path: two lines of light, and a ring to stand in at every stop.
    for (const x of [-1.5, 1.5]) path.line([x, 0.012, 7], [x, 0.012, -19.5], 0.05, [0, 1, 0], { glow: 0.8 });
    stops.forEach(([heading, text], i) => {
      const z = at(i);
      path.lathe([[1.05, 0.014], [0.9, 0.014]], [0, 0, z], 32, () => ({ glow: 0.45 }));
      kit.sign(heading, text, [2.7, 1.7, z - 0.4], 2.2);
      for (const x of [-3.9, 3.9]) {
        addLamp(path.at([x, 0, z + 2.1]));
        kit.halo([x, 1.64, z + 2.1], 1.2);
      }
      path.at();
    });
    // A doorway's frame on its own, for the stop about doors. It leads nowhere: the real ones are at the end.
    addArchFrame(path.at([-2.9, 0, at(2) - 0.3], 35));

    // What lights up when a stop is reached: a marker over its ring.
    const marker = new MeshBuilder().at();
    marker.lathe([[0.0005, -0.22], [0.16, 0], [0.0005, 0.22]], [0, 0, 0], 4, () => ({ glow: 1 }));
    const shape = marker.geometry();
    const light = createAlloy(kit.accent);
    const reached = stops.map(() => false);
    const markers = stops.map((_, i) => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(shape, light), kit.halo([0, 0, 0], 1.6));
      group.position.set(0, 2.9, at(i));
      group.visible = false;
      kit.scene.add(group);
      return group;
    });
    return {
      canStand: (x, z) => Math.abs(x) < 4.6 && z < 8 && z > -21.4,
      update(t) {
        light.tick(t);
        stops.forEach((_, i) => {
          markers[i]!.rotation.y = t * 1.2;
          if (reached[i] || Math.hypot(kit.head.x, kit.head.z - at(i)) > 1.05) return;
          reached[i] = true;
          markers[i]!.visible = true;
          const done = reached.filter(Boolean).length;
          kit.note("stops", done);
          kit.controls.say(done === stops.length ? "That's all five. The doors ahead lead on." : `${done} of ${stops.length} done.`);
        });
      },
    };
  },
});
