/**
 * The Library: eight short notes on the walls about how the open spatial web
 * is put together. It exists so the ideas can be read where they are used.
 */
import { addBench, addLamp, addPlant, addTable, addWall } from "nswp-sdk/home";
import { startWorld } from "../../shared/world.js";

const notes: [string, string][] = [
  ["A world is a website", "Whoever runs the site runs the world. There is no platform in between, and nobody to ask before you open one."],
  ["A door is a link", "Anyone can put a door to anywhere. The place it leads to doesn't have to agree, or even know."],
  ["The page between", "Leaving a place always goes through a plain page that shows the real address. A door can't lie about where it leads."],
  ["Signed, not hosted", "A world says it exists with a signed note on public relays. Lists of worlds are signed notes too. There is no index to be taken off."],
  ["Verified means the site agrees", "A world shows as verified when the site itself names the key that announced it. Anything else is only a claim."],
  ["Your room is yours", "The doors you save stay on your own device. Nothing about you is published unless you publish it."],
  ["Looking is private", "Seeing a door in the lobby doesn't contact the place behind it. The picture in the doorway comes from the lobby's own copy."],
  ["Meeting is a choice", "In any world, other people see you only after you press Join. Until then you are alone, whoever else is there."],
];

void startWorld({
  site: "library",
  title: "The Library",
  purpose: "Eight short notes on why the open spatial web is built the way it is. Read them in any order.",
  palette: { ground: 0x05080e, accent: 0xa9c7ff, text: "#eaf1ff" },
  entryPoints: { "main-entrance": { position: [0, 0, 5], yaw: 0 } },
  doors: [
    { to: "tour", label: "The Tour", position: [-1.9, 0, -12.2], rotation: 0 },
    { to: "observatory", label: "The Observatory", position: [1.9, 0, -12.2], rotation: 0 },
  ],
  middle: [0, -3],
  reach: 20,
  welcome: [0, 3.1, -1.2],
  build(kit) {
    const hall = kit.builder;
    // A long hall: the notes hang down both walls, with somewhere to sit and read in the middle.
    addWall(hall.at([-5.6, 0, -3.5], 90), 18, 4.2);
    addWall(hall.at([5.6, 0, -3.5], -90), 18, 4.2);
    notes.forEach(([heading, text], i) => {
      const side = i % 2 ? 1 : -1;
      const z = 1.4 - Math.floor(i / 2) * 4;
      kit.sign(heading, text, [side * 4.6, 1.75, z], 2.3);
      // A small light under each note.
      hall.at([side * 5.2, 0, z], side < 0 ? 90 : -90);
      hall.box([1.6, 0.05, 0.14], [0, 0.82, 0.1], { bevel: 0.015, shade: 1.2 });
      hall.line([-0.7, 0.848, 0.1], [0.7, 0.848, 0.1], 0.04, [0, 1, 0], { glow: 0.9 });
    });
    for (const z of [0.9, -7.5]) {
      addTable(hall.at([0, 0, z], 90), kit.soft);
      addBench(hall.at([-1.15, 0, z], 90), kit.soft);
      addBench(hall.at([1.15, 0, z], -90), kit.soft);
    }
    for (const [x, z] of [[-4.9, 5.2], [4.9, 5.2], [-4.9, -12.1], [4.9, -12.1]] as const) {
      addLamp(hall.at([x, 0, z]));
      kit.halo([x, 1.64, z]);
    }
    addPlant(hall.at([0, 0, -3.3]), kit.soft, 4);
    return { canStand: (x, z) => Math.abs(x) < 5.1 && z < 9 && z > -13 };
  },
});
