/**
 * The chamber: the small round room a visitor leaves from and arrives in.
 *
 * Going from one world to another means leaving one website for another, and
 * a browser shows flat pages in between: the Airlock, then the new world's
 * own page. Nothing a world draws can change that. What it can do is make the
 * two ends of the trip the same place. Walls rise round the visitor as they
 * leave; they arrive standing in the same room, and its doors open onto the
 * new world once that world is ready. Whatever was loading is behind the doors.
 *
 * **It is scenery, and proves nothing.** The world a visitor is in draws it,
 * so a dishonest world could draw it any way it liked. The check on where a
 * door really leads is the Airlock, which is the visitor's own page and which
 * no world can draw. So the chamber never asks for anything, never says
 * "verified", and has nothing in it to press (protocol/02-doors.md).
 *
 *   const crossing = createCrossing({ scene, camera, accent });
 *   crossing.arrive({ title, ready: worldLoaded, hold: () => waitingToEnterVr });
 *   await crossing.leave({ title: "The Grove", address: "grove.example" }); portal.go(...);
 *   // each frame: crossing.update(t, dt)
 */
import * as THREE from "three";
import { createAlloy, type Alloy } from "./alloy.js";
import { MeshBuilder } from "./mesh.js";

const R = 1.8; // from the middle to the wall
const H = 2.8;
const BAYS = 10; // the wall, in flat panels; the first is the doorway
const DOOR_W = 1.04;
const DOOR_H = 2.2;

export interface Chamber {
  group: THREE.Group;
  /** How far the doors are open: 0 shut, 1 open. */
  door: number;
  /** How much of the room is there: 0 nothing, 1 all of it. The walls rise from the floor. */
  presence: number;
  /** What the sign over the doors says. The first line is the larger. */
  say(lines: string[]): void;
  tick(t: number): void;
  dispose(): void;
}

function signTexture(lines: string[], color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 384;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "rgba(6,9,14,0.92)";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const rows = lines.filter(Boolean).slice(0, 3);
  rows.forEach((line, i) => {
    g.font = i === 0 ? "bold 84px system-ui, sans-serif" : "52px system-ui, sans-serif";
    g.globalAlpha = i === 0 ? 1 : 0.82;
    const y = rows.length === 1 ? 192 : rows.length === 2 ? 138 + i * 118 : 92 + i * 100;
    g.fillText(line, 512, y, 944);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The room itself, standing at its group's origin with its doors towards -Z. */
export function createChamber(accent: THREE.ColorRepresentation, opts: { textColor?: string } = {}): Chamber {
  const light = new THREE.Color(accent);
  const metal: Alloy = createAlloy(light, { gloss: 0.5, speed: 0.9 });
  const builder = () => {
    const b = new MeshBuilder().at();
    b.tone = new THREE.Color(0x141b24);
    b.light = light.clone();
    return b;
  };
  const reach = R + 0.06;
  const bay = 2 * reach * Math.tan(Math.PI / BAYS) + 0.02;

  // The floor: a disc with a ring let into it. It stays when the walls go, a moment longer.
  const floorShape = builder();
  floorShape.lathe([[R + 0.2, 0.012], [R * 0.78, 0.03], [R * 0.74, 0.03], [R * 0.7, 0.03], [0.34, 0.03], [0.3, 0.03], [0.0005, 0.03]], [0, 0, 0], 30, (row) => (row === 1 || row === 4 ? { glow: 0.85 } : { shade: 0.8 }));
  const floor = floorShape.build(metal);

  // The wall: flat panels in a ring, each with two lines of light that run its height.
  const wallShape = builder();
  for (let i = 1; i < BAYS; i++) {
    const a = (i * 2 * Math.PI) / BAYS; // 0 is the doorway, at -Z
    wallShape.at([Math.sin(a) * reach, 0, -Math.cos(a) * reach], -THREE.MathUtils.radToDeg(a));
    wallShape.box([bay, H, 0.12], [0, H / 2, 0], { bevel: 0.02, shade: i % 2 ? 1 : 0.86, panel: { margin: 0.12, depth: 0.02, faces: "z+ z-" } });
    for (const x of [-bay * 0.26, bay * 0.26]) for (const z of [0.062, -0.062]) wallShape.line([x, 0.3, z], [x, H - 0.3, z], 0.03, [0, 0, Math.sign(z)], { flow: i });
  }
  // The doorway's surround: two jambs, and a head with the sign on it.
  wallShape.at([0, 0, -reach]);
  for (const side of [-1, 1]) wallShape.box([(bay - DOOR_W) / 2, H, 0.16], [(side * (bay + DOOR_W)) / 4, H / 2, 0], { bevel: 0.02 });
  wallShape.box([DOOR_W, H - DOOR_H, 0.16], [0, DOOR_H + (H - DOOR_H) / 2, 0], { bevel: 0.02 });
  wallShape.line([-DOOR_W / 2, DOOR_H - 0.012, 0.082], [DOOR_W / 2, DOOR_H - 0.012, 0.082], 0.024, [0, 0, 1]);
  const walls = wallShape.build(metal);

  // The lid, seen from below: a ring of light in a dark cap.
  const lidShape = builder();
  lidShape.lathe([[0.0005, 0], [R * 0.5, 0], [R * 0.56, -0.05], [R * 0.62, 0], [R + 0.2, 0]], [0, 0, 0], 30, (row) => (row === 1 || row === 2 ? { glow: 0.9 } : { shade: 0.7 }));
  const lid = lidShape.build(metal);

  // Two leaves that draw back into the jambs. Each is made with its outer edge at its own origin.
  const leaves = [-1, 1].map((side) => {
    const b = builder();
    b.box([DOOR_W / 2, DOOR_H, 0.05], [(-side * DOOR_W) / 4, DOOR_H / 2, 0], { bevel: 0.012, panel: { margin: 0.07, depth: 0.012, glow: 0.35, faces: "z+ z-" } });
    b.line([(-side * DOOR_W) / 2 + side * 0.012, 0.1, 0.027], [(-side * DOOR_W) / 2 + side * 0.012, DOOR_H - 0.1, 0.027], 0.02, [0, 0, 1]);
    const leaf = b.build(metal);
    leaf.position.set((side * DOOR_W) / 2, 0, -reach);
    return leaf;
  });

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W * 0.94, DOOR_W * 0.94 * (384 / 1024)), new THREE.MeshBasicMaterial({ transparent: true }));
  sign.position.set(0, DOOR_H + (H - DOOR_H) / 2, -reach + 0.085);

  const rising = new THREE.Group(); // everything that comes up out of the floor
  rising.add(walls, ...leaves, sign);
  const group = new THREE.Group();
  group.add(floor, rising, lid);

  let door = 0;
  let presence = 1;
  const apply = () => {
    const up = presence * presence * (3 - 2 * presence);
    rising.scale.y = Math.max(0.001, up);
    rising.visible = presence > 0.002;
    floor.scale.setScalar(Math.max(0.001, Math.min(1, presence * 1.6)));
    floor.visible = presence > 0.002;
    // The lid waits overhead and comes down as the walls reach it. It never passes through anyone.
    lid.position.y = H + (1 - up) * 3.5;
    lid.visible = presence > 0.5;
    const open = door * door * (3 - 2 * door);
    for (const leaf of leaves) leaf.scale.x = Math.max(0.02, 1 - open);
  };
  apply();

  return {
    group,
    get door() {
      return door;
    },
    set door(v) {
      door = Math.min(1, Math.max(0, v));
      apply();
    },
    get presence() {
      return presence;
    },
    set presence(v) {
      presence = Math.min(1, Math.max(0, v));
      apply();
    },
    say(lines) {
      const material = sign.material as THREE.MeshBasicMaterial;
      material.map?.dispose();
      material.map = signTexture(lines, opts.textColor ?? "#eef5fb");
      material.needsUpdate = true;
    },
    tick(t) {
      metal.tick(t);
    },
    dispose() {
      group.removeFromParent();
      for (const mesh of [floor, walls, lid, ...leaves]) mesh.geometry.dispose();
      metal.dispose();
      sign.geometry.dispose();
      (sign.material as THREE.MeshBasicMaterial).map?.dispose();
      (sign.material as THREE.Material).dispose();
    },
  };
}

// ------------------------------------------------------------------ crossing

export interface CrossingOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  accent: THREE.ColorRepresentation;
  textColor?: string;
  /** Whether things may move. Someone who asked for less motion gets the room without its rising and sinking. */
  motion?: () => boolean;
}

export interface ArriveOptions {
  /** This world's name, for the sign. */
  title: string;
  /** This world's own address, for the line under it. */
  address?: string;
  /** Settles when the world is ready to be seen. The doors stay shut until then. */
  ready?: Promise<unknown>;
  /** Keep the doors shut while this is true: until the visitor has put the headset view back on, say. */
  hold?: () => boolean;
}

export type CrossingState = "none" | "arriving" | "opening" | "leaving" | "shut";

export interface Crossing {
  readonly state: CrossingState;
  /** Begin the visit inside the room. It opens when the world is ready, and then goes. */
  arrive(opts: ArriveOptions): void;
  /**
   * Bring the room up round the visitor, with where they are going over the
   * doors. Resolves when it is shut: leave then. The address shown is this
   * world's word for it; the visitor's Airlock shows the real one next.
   */
  leave(opts: { title: string; address?: string }): Promise<void>;
  /** May the visitor's head be here? While the room is shut round them, only inside it. */
  allows(x: number, z: number): boolean;
  update(t: number, dt: number): void;
  dispose(): void;
}

const RISE = 0.45; // seconds for the walls to come up
const OPEN = 0.9; // and for the doors to draw back
const SINK = 1.1;
const DWELL = 0.7; // the least a visitor stands in the shut room on arriving, so it is seen to open

export function createCrossing(o: CrossingOptions): Crossing {
  let chamber: Chamber | null = null;
  let state: CrossingState = "none";
  let since = 0; // seconds in this state
  let ready = true;
  let hold: (() => boolean) | undefined;
  let shut: (() => void) | null = null;
  const moves = () => o.motion?.() ?? true;
  const at = new THREE.Vector3();
  const facing = new THREE.Vector3();

  /** Stand the room round the visitor, with its doors the way they are looking. */
  const place = (): Chamber => {
    chamber?.dispose();
    const made = createChamber(o.accent, o.textColor ? { textColor: o.textColor } : {});
    o.camera.getWorldPosition(at);
    o.camera.getWorldDirection(facing);
    made.group.position.set(at.x, 0, at.z);
    made.group.rotation.y = Math.atan2(-facing.x, -facing.z);
    o.scene.add(made.group);
    chamber = made;
    return made;
  };
  const enter = (next: CrossingState) => {
    state = next;
    since = 0;
  };

  return {
    get state() {
      return state;
    },
    arrive(a) {
      const c = place();
      c.presence = 1;
      c.door = 0;
      c.say([a.title, a.address ?? "", "The doors open when it's ready"]);
      ready = !a.ready;
      void a.ready?.then(
        () => (ready = true),
        () => (ready = true),
      );
      hold = a.hold;
      enter("arriving");
    },
    leave(l) {
      const c = place();
      c.door = 0;
      c.presence = moves() ? 0 : 1;
      c.say([`To ${l.title}`, l.address ?? "", "Your Airlock checks the address next"]);
      enter("leaving");
      return new Promise<void>((resolve) => {
        shut = resolve;
        // Never keep anyone waiting on a drawing: if frames stop coming, they still leave.
        setTimeout(resolve, 1500);
      });
    },
    allows(x, z) {
      if (!chamber || (state !== "arriving" && state !== "shut" && state !== "leaving")) return true;
      return Math.hypot(x - chamber.group.position.x, z - chamber.group.position.z) <= R - 0.35;
    },
    update(t, dt) {
      if (!chamber || state === "none") return;
      since += dt;
      chamber.tick(t);
      if (state === "leaving") {
        chamber.presence = moves() ? Math.min(1, since / RISE) : 1;
        if (since >= (moves() ? RISE + 0.2 : 0.2)) {
          enter("shut");
          shut?.();
          shut = null;
        }
      } else if (state === "arriving") {
        if (ready && since >= DWELL && !hold?.()) enter("opening");
      } else if (state === "opening") {
        if (!moves()) {
          chamber.dispose();
          chamber = null;
          return void enter("none");
        }
        chamber.door = Math.min(1, since / OPEN);
        // Once the doors are back, the room sinks away and leaves the visitor standing in the world.
        const sinking = (since - OPEN - 0.25) / SINK;
        if (sinking > 0) chamber.presence = 1 - Math.min(1, sinking);
        if (sinking >= 1) {
          chamber.dispose();
          chamber = null;
          enter("none");
        }
      }
    },
    dispose() {
      chamber?.dispose();
      chamber = null;
      state = "none";
    },
  };
}
