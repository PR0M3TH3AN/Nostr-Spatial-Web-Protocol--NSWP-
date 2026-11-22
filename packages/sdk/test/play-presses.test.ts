// What is in hand says when its presses come and go (play.ts `does`, item-controls.ts): the bar shows Fire and Reload
// only while the item's logic runs. The world puts them up or takes them down when play says something changed
// (`onChange`), so play must say so each time its logic starts and each time it stops. The box the logic runs in is
// an iframe, which a unit test doesn't have: a stand-in box here, which runs nothing and can be made to stop.
import { buildItem, finalizeEvent, parseItem, type Item } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

// A browser's storage, which keeps that the visitor let this item's logic run.
const kept = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) });
const boxes: { stopped?: (why: string) => void; stop: () => void; told: string[] }[] = [];
vi.mock("../src/item-box.js", () => ({
  runInBox: async (_script: string, on: { stopped?: (why: string) => void }) => {
    const box = { stopped: on.stopped, told: [] as string[], running: true, stop() { box.running = false; }, tell(e: string) { box.told.push(e); } };
    boxes.push(box);
    return box;
  },
}));
const { allowScript, createPlay } = await import("../src/play.js");
const { createControls } = await import("../src/ui/model.js");
const { addItemControls } = await import("../src/item-controls.js");

const H = (c: string) => c.repeat(64);
const blaster = parseItem(
  finalizeEvent(
    buildItem({
      d: "dart-blaster",
      title: "Dart blaster",
      model: { url: `https://items.example/${H("a")}.glb`, sha256: H("a") },
      size: [0.05, 0.18, 0.3],
      behaviors: ["holdable"],
      script: { url: `https://items.example/${H("c")}.js`, sha256: H("c") },
      does: { use: "Fire", second: "Reload" },
      now: 1_800_000_000,
    })!,
    sha256(utf8ToBytes("nswp sdk play presses test maker")),
  ),
)!;

describe("an item's presses, as its logic starts and stops", () => {
  it("are on the bar while its logic runs, and off it once the logic stops by itself", async () => {
    allowScript(H("c"));
    const scene = new THREE.Scene();
    const rig = new THREE.Group();
    const camera = new THREE.PerspectiveCamera();
    rig.add(camera);
    scene.add(rig);
    const items = { known: (c: string): Item | null => (c === blaster.id ? blaster : null), sent: async () => new THREE.Group(), clips: () => [], sound: async () => null, script: async () => "// the blaster's logic" } as unknown as Parameters<typeof createPlay>[0]["items"];
    const controls = createControls({ title: "A world" });
    let itemControls: { refresh(): void } | null = null;
    // As the reference worlds wire it: play says something changed, and the item's presses are looked at again.
    const play = createPlay({ scene, camera, rig, items, rule: () => "allowed", me: () => H("9"), people: () => [], itemsMuted: () => false, tell: () => {}, scripts: true, onChange: () => itemControls?.refresh() });
    itemControls = addItemControls(controls, { play: () => play, holdingHand: () => -1 });
    const offered = () => [controls.has("item-use"), controls.has("item-second")];

    expect(offered()).toEqual([false, false]);
    await play.held(blaster, new THREE.Group());
    expect(play.does).toEqual({ use: "Fire", second: "Reload" });
    expect(offered()).toEqual([true, true]);

    // The logic stopped (it stopped answering, or the box gave up on it): nothing is left to press.
    boxes.at(-1)!.stopped!("it stopped answering");
    expect(play.does).toBeNull();
    expect(offered()).toEqual([false, false]);
  });
});
