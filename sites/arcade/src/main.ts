/**
 * The Arcade: twelve lanterns drift over a field, and a clock runs while you
 * catch them. It exists to be played, and to show that a world can be a game.
 */
import * as THREE from "three";
import { addBench, addCrystal, addGyro, addLamp, MeshBuilder } from "nswp-sdk/home";
import { worldSaves, worldSigner } from "nswp-sdk/three";
import { startWorld } from "../../shared/world.js";

const COUNT = 12;
const BEST = "arcade:best";
const FIELD: [number, number] = [0, -9];

/**
 * The fastest run, in seconds, or 0. It is this world's save (`worldSaves`): kept on this device for anyone, and
 * with their account for a visitor who is signed in here, so it is there on their next device.
 */
let fastest = 0;
const best = (): number => fastest;
/**
 * Their best is also their score on this world's board (protocol/15-scores.md): kept on the device by the kit, and
 * posted only if they say to, from the Scores tab. Set once the world is built.
 */
let onBoard: ((seconds: number) => void) | null = null;
const saves = worldSaves();
/** Take up a time from somewhere else if it is faster than the one in hand. True if it was. */
function takeBest(seconds: unknown): boolean {
  if (typeof seconds !== "number" || !(seconds > 0) || (fastest && seconds >= fastest)) return false;
  fastest = seconds;
  onBoard?.(seconds);
  return true;
}
try {
  // What this world kept before it had saves: a number of its own on this device.
  takeBest(Number(localStorage.getItem(BEST)));
} catch {
  /* a private window */
}

void startWorld({
  site: "arcade",
  title: "The Arcade",
  // One board: the fastest run. A time is counted in thousandths of a second, and less is better.
  boards: [{ id: "lantern-run", title: "Lantern Run", order: "low", format: "time" }],
  // What this world marks. The last isn't named until someone has done it.
  achievements: [
    { id: "first-lantern", title: "First light", about: "Catch a lantern" },
    { id: "all-twelve", title: "All twelve", about: "Catch every lantern in one run" },
    { id: "under-a-minute", title: "Under a minute", about: "Catch all twelve in less than sixty seconds" },
    { id: "under-thirty", title: "Lamplighter", about: "Catch all twelve in less than thirty seconds", hidden: true },
  ],
  purpose: "Twelve lanterns are loose on the field. Walk into each one to catch it. The clock starts with your first.",
  palette: { ground: 0x0c0510, accent: 0xff5fa2, text: "#ffe6f1" },
  entryPoints: { "main-entrance": { position: [0, 0, 5], yaw: 0 } },
  doors: [
    { to: "tour", label: "The Tour", position: [-4.2, 0, -2.2], rotation: 40 },
    { to: "grove", label: "The Grove", position: [4.2, 0, -2.2], rotation: -40 },
  ],
  middle: FIELD,
  reach: 15.5,
  welcome: [0, 3.9, -4.5],
  quiet: true,
  build(kit) {
    // A time on the board is counted in thousandths of a second.
    onBoard = (seconds) => void kit.scores?.record("lantern-run", Math.round(seconds * 1000));
    if (fastest) onBoard(fastest);
    const field = kit.builder;
    const [fx, fz] = FIELD;
    // The edge of the field: a line of light, and a pylon every thirty degrees.
    field.at([fx, 0, fz]);
    field.lathe([[16.2, 0.014], [16, 0.014]], [0, 0, 0], 72, () => ({ glow: 0.7 }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      field.lathe([[0.3, 0], [0.3, 0.08], [0.12, 0.16], [0.09, 2.2], [0.2, 2.26], [0.2, 2.34], [0.0005, 2.6]], [Math.sin(a) * 16.6, 0, Math.cos(a) * 16.6], 6, (row) => (row === 4 ? { glow: 0.9 } : { shade: 1 + (row % 2) * 0.2 }));
    }
    addBench(field.at([-3.2, 0, 6.6], 150), kit.soft);
    addBench(field.at([3.2, 0, 6.6], -150), kit.soft);
    for (const [x, z] of [[-6.4, 0.4], [6.4, 0.4]] as const) {
      addLamp(field.at([x, 0, z]));
      kit.halo([x, 1.64, z]);
    }
    addCrystal(field, 1.2, 4, [-9, 0, -17], 30);
    addCrystal(field, 0.9, 7, [10, 0, -5], 200);
    addCrystal(field, 0.7, 2, [3, 0, -21], 90);

    // The lanterns: a point of light inside three turning hoops. One shape, drawn twelve times.
    const lantern = new MeshBuilder().at();
    lantern.tone = new THREE.Color(0x2a1b26);
    addGyro(lantern, 0.5);
    const shape = lantern.geometry();
    const shine = kit.alloy({ gloss: 1, sheen: 0.5 });
    const lights = Array.from({ length: COUNT }, (_, i) => {
      const angle = (i / COUNT) * Math.PI * 2;
      const out = 3.6 + (i % 4) * 1.9;
      const group = new THREE.Group();
      group.add(new THREE.Mesh(shape, shine), kit.halo([0, 0, 0], 1.1));
      kit.scene.add(group);
      kit.note(`lantern${i}`, [Math.round((fx + Math.sin(angle) * out) * 10) / 10, Math.round((fz - Math.cos(angle) * out) * 10) / 10]);
      return { group, home: new THREE.Vector3(fx + Math.sin(angle) * out, 1.25, fz - Math.cos(angle) * out), phase: i * 1.7, caught: false };
    });

    let caught = 0;
    let startedAt = -1;
    let now = 0;
    // The scoreboard, where a visitor arrives. It is about one visitor, so it stays out of the preview.
    let board = kit.sign("Lantern Run", "", [0, 0, 0]);
    const show = (heading: string, text: string) => {
      kit.scene.remove(board);
      board.material.map?.dispose();
      board.material.dispose();
      board = kit.sign(heading, text, [0, 2.45, -4.5], 3.2);
      kit.note("board", `${heading}: ${text}`);
      kit.note("caught", caught);
    };
    const record = () => (best() ? `Your best: ${best().toFixed(1)} s.` : "No best time yet.");

    const reset = () => {
      caught = 0;
      startedAt = -1;
      for (const l of lights) {
        l.caught = false;
        l.group.visible = true;
      }
      show("Lantern Run", `0 of ${COUNT}. ${record()}`);
    };
    reset();
    // Their save, from this device or their account, whichever is the faster: asked for now, and again when they
    // sign in here. A faster time in hand than their account has is kept there.
    const readSave = async () => {
      const saved = await saves.load().catch(() => null);
      let theirs = 0;
      try {
        theirs = Number((JSON.parse(saved?.data ?? "{}") as { best?: unknown }).best) || 0;
      } catch {
        /* not this world's shape: ignored */
      }
      const had = fastest;
      if (takeBest(theirs) && caught === 0) show("Lantern Run", `0 of ${COUNT}. ${record()}`);
      else if (had && (!theirs || had < theirs)) void saves.save(JSON.stringify({ best: had }));
      kit.note("best", fastest);
    };
    void readSave();
    worldSigner().onChange(() => void readSave());
    kit.controls.addSection({ id: "play", label: "Play", icon: "turn", note: "Walk into a lantern to catch it. Your best time is kept on this device, and with your account when you are signed in here." });
    kit.controls.add({ id: "again", section: "play", icon: "turn", label: "Start the run again", short: "Again", act: reset });

    return {
      update(t) {
        now = t;
        for (const l of lights) {
          if (l.caught) continue;
          l.group.rotation.set(t * 0.4 + l.phase, t * 0.7 + l.phase, 0);
          l.group.position.set(l.home.x + Math.sin(t * 0.5 + l.phase) * 1.4, l.home.y + Math.sin(t * 0.9 + l.phase) * 0.25, l.home.z + Math.cos(t * 0.4 + l.phase) * 1.4);
          // Close enough, measured along the ground so height doesn't matter.
          if (Math.hypot(l.group.position.x - kit.head.x, l.group.position.z - kit.head.z) > 0.8) continue;
          l.caught = true;
          l.group.visible = false;
          if (startedAt < 0) startedAt = now;
          caught++;
          if (caught === 1) kit.achievements?.earn("first-lantern");
          kit.note("last", [Math.round(l.group.position.x * 10) / 10, Math.round(l.group.position.z * 10) / 10]);
          if (caught < COUNT) {
            show("Lantern Run", `${caught} of ${COUNT}. ${record()}`);
            continue;
          }
          const took = now - startedAt;
          kit.achievements?.earn("all-twelve");
          if (took < 60) kit.achievements?.earn("under-a-minute");
          if (took < 30) kit.achievements?.earn("under-thirty");
          const was = best();
          const better = takeBest(took);
          show(better ? "A new best" : "All twelve", `${took.toFixed(1)} seconds. ${was && !better ? `Your best is ${was.toFixed(1)} s. ` : ""}Open the menu and choose "Start the run again" for another go.`);
          // Kept at once on this device, and with their account if they are signed in here. The board says where.
          if (better) {
            kit.note("best", fastest);
            void saves.save(JSON.stringify({ best: took })).then((r) => {
              kit.note("saved", r.kept);
              if (caught === COUNT) show("A new best", `${took.toFixed(1)} seconds. ${r.said} Open the menu and choose "Start the run again" for another go.`);
            });
          }
        }
      },
      get hideFromPreview() {
        return [board];
      },
    };
  },
});
