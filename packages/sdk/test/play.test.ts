// Items in play (play.ts): things sent out, where they stick, who they reach, and what a person may say of them.
import { buildHit, buildItem, buildShot, finalizeEvent, getPublicKey, parseItem, type Item } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Items } from "../src/items.js";
import { createPlay, type PlayPerson } from "../src/play.js";

const H = (c: string) => c.repeat(64);
const MAKER = sha256(utf8ToBytes("nswp sdk play test maker"));
const blaster = parseItem(
  finalizeEvent(
    buildItem({
      d: "dart-blaster",
      title: "Dart blaster",
      model: { url: `https://items.example/${H("a")}.glb`, sha256: H("a") },
      size: [0.05, 0.18, 0.3],
      behaviors: ["holdable"],
      sends: [{ name: "dart", model: { url: `https://items.example/${H("b")}.glb`, sha256: H("b") }, size: [0.02, 0.02, 0.09], trail: 0.2 }],
      tints: [{ slot: "dart", label: "Darts", color: "#35f0e0" }],
      effects: [{ of: "dart", state: "health", take: 1 }],
      does: { use: "Fire", second: "Reload" },
      now: 1_800_000_000,
    })!,
    MAKER,
  ),
)!;
const ADA = H("1");
const BO = H("2");

/** A bare place: a floor, a wall across the way at z = -6, the visitor standing at the middle, and two other people. */
const place = (o: { rule?: string; mutes?: string[]; deferred?: boolean } = {}) => {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 60), new THREE.MeshBasicMaterial());
  floor.position.y = -0.1;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 0.4), new THREE.MeshBasicMaterial());
  wall.position.set(0, 3, -6);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40), new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
  scene.add(floor, wall, sky);
  const rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera();
  camera.position.y = 1.6;
  rig.add(camera);
  scene.add(rig);
  scene.updateMatrixWorld(true);
  const person = (pubkey: string, x: number, z: number): PlayPerson => {
    const body = new THREE.Group();
    body.position.set(x, 1.1, z);
    body.userData.nswpNoHit = true;
    scene.add(body);
    return { pubkey, head: new THREE.Vector3(x, 1.6, z), body, over: body, holding: blaster.id, held: null };
  };
  const people = [person(ADA, 0, 5), person(BO, 4, 0)];
  const told: string[] = [];
  const items = { known: (c: string): Item | null => (c === blaster.id ? blaster : null), sent: async () => new THREE.Group(), clips: () => [], sound: async () => null, script: async () => null } as unknown as Items;
  const play = createPlay({ scene, camera, rig, items, rule: () => o.rule ?? "allowed", me: () => H("9"), people: () => people, itemsMuted: (k) => !!o.mutes?.includes(k), tell: (said) => void told.push(said), ...(o.deferred ? { deferred: true } : {}) });
  /** Let so much time pass, a frame at a time. */
  const pass = async (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) {
      vi.advanceTimersByTime(50);
      scene.updateMatrixWorld(true);
      play.update(0.05);
    }
    await Promise.resolve();
  };
  /** Somebody says they sent a dart out, and it has a moment to be made. */
  const hears = async (from: string, said: string | null) => {
    play.heard(from, said!);
    await vi.advanceTimersByTimeAsync(0);
  };
  return { play, told, pass, hears, scene, wall, floor, people };
};
const shot = (id: number, from: [number, number, number], velocity: [number, number, number], stick = 3) => buildShot({ id, name: "dart", from, velocity, stick });

beforeEach(() => void vi.useFakeTimers({ toFake: ["performance", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => void vi.useRealTimers());

describe("a thing sent out", () => {
  it("sticks to whatever shape of the world it meets, lets go after its time, drops and is gone", async () => {
    const p = place();
    // Bo, at (4, 0), sends one at the wall from head height.
    await p.hears(BO, shot(1, [4, 1.5, 0], [0, 2, -14]));
    await p.pass(0.2);
    expect(p.play.info().flying).toBe(1);
    await p.pass(0.6);
    const stuck = p.play.info().things[0]!;
    expect([stuck.state, stuck.on]).toEqual(["stuck", "world"]);
    // On the near face of the wall, and no further.
    expect(stuck.at[2]).toBeCloseTo(-5.8, 1);
    await p.pass(2);
    expect(p.play.info().stuck).toBe(1);
    await p.pass(1.4);
    expect(p.play.info().stuck).toBe(0);
    await p.pass(3);
    expect(p.play.info().things).toEqual([]);
  });

  it("leaves a streak of light along its arc, which draws itself in once it has stopped", async () => {
    const p = place();
    const trails = () => p.scene.children.filter((c) => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).material instanceof THREE.MeshBasicMaterial && ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).blending === THREE.AdditiveBlending) as THREE.Mesh[];
    await p.hears(BO, shot(1, [4, 1.5, 0], [0, 2, -14]));
    await p.pass(0.25);
    expect(trails().length).toBe(1);
    const trail = trails()[0]!;
    expect(trail.visible).toBe(true);
    // It is not a thing to hit, and it runs back from where the dart is now along where it has been.
    expect(trail.userData.nswpNoHit).toBe(true);
    const at = trail.geometry.getAttribute("position");
    expect(at.getZ(0)).toBeLessThan(at.getZ(at.count - 1));
    // In the colour whoever sent it chose, or the one its maker gave: here, the maker's.
    expect((trail.userData.base as THREE.Color).getHexString()).toBe("35f0e0");
    // It stuck after a little under half a second: a fifth of a second later the streak is gone, and the dart is not.
    await p.pass(0.6);
    expect(trails().length).toBe(0);
    expect(p.play.info().stuck).toBe(1);
  });

  it("falls as it flies: aimed level it lands short of the wall, on the floor", async () => {
    const p = place();
    await p.hears(BO, shot(1, [4, 1.5, 0], [0, 0, -6]));
    await p.pass(1.2);
    const landed = p.play.info().things[0]!;
    expect(landed.state).toBe("stuck");
    expect(landed.at[1]).toBeCloseTo(0, 1);
    expect(landed.at[2]).toBeGreaterThan(-4.5);
  });

  it("passes through what isn't a thing to hit: a sky drawn from the inside", async () => {
    const p = place();
    // Straight up from Bo: only the sky is there, and it isn't solid.
    await p.hears(BO, shot(1, [4, 1.5, 0], [0, 38, 0]));
    await p.pass(1);
    expect(p.play.info().flying).toBe(1);
  });

  it("is taken only from where its sender is, only if their item sends it out, and only so many at once", async () => {
    const p = place();
    await p.hears(BO, shot(1, [0, 1.5, 20], [0, 0, -10]));
    await p.hears(BO, buildShot({ id: 2, name: "rocket", from: [4, 1.5, 0], velocity: [0, 0, -10], stick: 3 }));
    await p.hears(H("7"), shot(3, [4, 1.5, 0], [0, 0, -10]));
    expect(p.play.info().things).toEqual([]);
    // Thirty at once from one person: a burst is let through, and the rest are dropped unseen.
    const q = place();
    for (let i = 10; i < 40; i++) await q.hears(BO, shot(i, [4, 1.5, 0], [0, 2, -14]));
    expect(q.play.info().things.length).toBe(8);
  });
});

describe("in a world drawn by another engine", () => {
  it("looks for nothing itself: it says where each thing went, and stops it where that engine says it met something", async () => {
    const p = place({ deferred: true });
    await p.hears(BO, shot(1, [4, 1.5, 0], [0, 2, -14]));
    await p.pass(0.3);
    const first = p.play.snapshot();
    expect(first.things.length).toBe(1);
    const flying = first.things[0]!;
    expect(flying.state).toBe("flying");
    // A step to test, from where it was to where it is, and the model to draw it with.
    expect(flying.test!.b[2]).toBeLessThan(flying.test!.a[2]);
    expect(flying.model).toBe(H("b"));
    expect(flying.size).toEqual([0.02, 0.02, 0.09]);
    // The wall is there in this test's scene, and it is flown straight through: the shapes are the other engine's to know.
    await p.pass(0.6);
    expect(p.play.snapshot().things[0]!.state).toBe("flying");
    // That engine says a step met something, part of the way along it.
    const asked = p.play.snapshot().things[0]!.test!;
    p.play.met(flying.key, asked.step, 0.5, [4, 2.2, -9], "Wall/Mesh");
    await p.pass(0.1);
    const stuck = p.play.snapshot().things[0]!;
    expect([stuck.state, stuck.on, stuck.ref]).toEqual(["stuck", "world", "Wall/Mesh"]);
    expect(stuck.at).toEqual([4, 2.2, -9]);
    expect(stuck.test).toBeNull();
    // An answer about a step it never took, or about nothing, changes nothing.
    p.play.met(flying.key, 999, 0.5, [0, 0, 0]);
    p.play.met("nobody:7", 1, 0.5, [0, 0, 0]);
    expect(p.play.snapshot().things[0]!.at).toEqual([4, 2.2, -9]);
  });

  it("gives its streak of light as points along its middle, and asks where the floor is once it lets go", async () => {
    const p = place({ deferred: true });
    await p.hears(BO, shot(1, [4, 1.5, 0], [0, 2, -14]));
    await p.pass(0.25);
    const trail = p.play.snapshot().trails[0]!;
    expect(trail.color).toBe("#35f0e0");
    expect(trail.points.length).toBeGreaterThan(8);
    // Bright at the thing, nothing at the far end, and running back the way it came.
    expect(trail.points[0]![3]).toBeGreaterThan(0.5);
    expect(trail.points.at(-1)![3]).toBeLessThan(0.05);
    expect(trail.points[0]![2]).toBeLessThan(trail.points.at(-1)![2]);
    const key = p.play.snapshot().things[0]!.key;
    p.play.met(key, p.play.snapshot().things[0]!.test!.step, 1, [4, 2, -5]);
    await p.pass(0.1);
    await p.pass(3.2);
    const falling = p.play.snapshot().things[0]!;
    expect([falling.state, falling.down]).toEqual(["falling", true]);
    p.play.floored(key, 0.5);
    expect(p.play.snapshot().things[0]!.down).toBe(false);
    await p.pass(1.5);
    // It came to rest on the floor that engine named, not the one this test's scene has.
    expect(p.play.snapshot().things).toEqual([]);
  });

  it("says how the visitor is, as numbers, for that engine to show in its own way", async () => {
    const p = place({ deferred: true });
    await p.hears(ADA, shot(1, [0, 1.4, 4.6], [0, 1, -14]));
    await p.pass(0.6);
    const own = p.play.snapshot().own;
    expect(own.health).toMatchObject({ value: 4, full: 5, down: false });
    expect(own.health.shown).toBeGreaterThan(0.5);
    expect(own.red).toBeGreaterThan(0);
  });
});

describe("a thing that reaches someone", () => {
  it("is decided by the person it reached: this visitor says so, and loses one of five", async () => {
    const p = place();
    // Ada, at (0, 5), sends one straight at the visitor, who stands at the middle.
    await p.hears(ADA, shot(1, [0, 1.4, 4.6], [0, 1, -14]));
    await p.pass(0.6);
    expect(p.play.info().taken).toBe(1);
    expect(p.play.health).toEqual({ value: 4, full: 5 });
    expect(p.told[0]).toMatch(new RegExp(`^hit:${ADA},1,`));
    expect(p.told[1]).toBe("st:health,4,5");
    // After a rest it is back, and they say that too.
    await p.pass(7);
    expect(p.play.health.value).toBe(5);
    expect(p.told.at(-1)).toBe("st:health,5,5");
  });

  it("comes back one at a time after a rest, and all at once a little while after there was none left", async () => {
    const p = place();
    const at = (id: number) => p.hears(ADA, shot(id, [0, 1.4, 4.6], [0, 1, -14]));
    await at(1);
    await p.pass(0.5);
    await at(2);
    await p.pass(0.5);
    expect(p.play.health.value).toBe(3);
    // Nothing for four seconds; then one comes back after each second more.
    await p.pass(3.3);
    expect(p.play.health.value).toBe(3);
    await p.pass(1.8);
    expect(p.play.health.value).toBe(4);
    await p.pass(1.1);
    expect(p.play.health.value).toBe(5);
    // All five: nothing left, said to the room. While it is so, nothing more reaches them. Then it is all back.
    for (let id = 10; id < 15; id++) {
      await at(id);
      await p.pass(0.5);
    }
    expect(p.play.health.value).toBe(0);
    expect(p.told).toContain("st:health,0,5");
    const taken = p.told.filter((t) => t.startsWith("st:")).length;
    await at(20);
    await p.pass(0.5);
    expect(p.play.health.value).toBe(0);
    expect(p.told.filter((t) => t.startsWith("st:")).length).toBe(taken);
    await p.pass(2.4);
    expect(p.play.health.value).toBe(5);
    expect(p.told.at(-1)).toBe("st:health,5,5");
  });

  it("can't reach someone who has muted its sender's items, where items are only allowed", async () => {
    const p = place({ mutes: [ADA] });
    await p.hears(ADA, shot(1, [0, 1.4, 4.6], [0, 1, -14]));
    await p.pass(0.8);
    expect(p.play.info().taken).toBe(0);
    expect(p.told).toEqual([]);
    // And nothing of theirs is drawn at all.
    expect(p.play.info().things).toEqual([]);
  });

  it("reaches everyone where items are the game: there, nobody is out of their reach", async () => {
    const p = place({ rule: "play", mutes: [ADA] });
    await p.hears(ADA, shot(1, [0, 1.4, 4.6], [0, 1, -14]));
    await p.pass(0.8);
    expect(p.play.info().taken).toBe(1);
  });

  it("does nothing at all in a place with no items", async () => {
    const p = place({ rule: "none" });
    await p.hears(ADA, shot(1, [0, 1.4, 4.6], [0, 1, -14]));
    await p.pass(0.8);
    expect(p.play.info().things).toEqual([]);
    expect(p.told).toEqual([]);
  });

  it("looks stuck to someone else at once, and drops off if they never say it reached them", async () => {
    const p = place();
    // Ada, at (0, 5), sends one at Bo, at (4, 0).
    const to = new THREE.Vector3(4, 1.3, 0).sub(new THREE.Vector3(0.4, 1.4, 4.5)).normalize().multiplyScalar(14);
    await p.hears(ADA, shot(1, [0.4, 1.4, 4.5], [to.x, to.y + 1.2, to.z]));
    await p.pass(0.5);
    expect(p.play.info().things[0]).toMatchObject({ state: "stuck", on: BO });
    await p.pass(0.6);
    expect(p.play.info().stuck).toBe(0);
  });

  it("stays on them once they say so, and they can say so only of a thing that really flew, once", async () => {
    const p = place();
    const to = new THREE.Vector3(4, 1.3, 0).sub(new THREE.Vector3(0.4, 1.4, 4.5)).normalize().multiplyScalar(14);
    await p.hears(ADA, shot(1, [0.4, 1.4, 4.5], [to.x, to.y + 1.2, to.z]));
    await p.pass(0.5);
    await p.hears(BO, buildHit({ by: ADA, id: 1, at: [0, 1.2, 0.2] }));
    await p.pass(1.5);
    expect(p.play.info().things[0]).toMatchObject({ state: "stuck", on: BO });
    // Of a thing nobody sent, nothing.
    await p.hears(BO, buildHit({ by: ADA, id: 99, at: [0, 1.2, 0.2] }));
    expect(p.play.info().things.length).toBe(1);
    expect(p.play.info().landed).toBe(0);
  });
});
