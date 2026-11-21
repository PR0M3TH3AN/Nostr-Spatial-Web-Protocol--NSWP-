// The starter items in sites/items (protocol/17-items.md): what is signed there must be what is served.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseItem, parseWorldEvent, verifyEvent, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createItems, ITEM_BUDGET } from "../src/items.js";

const sites = join(__dirname, "..", "..", "..", "sites");
const config = JSON.parse(readFileSync(join(sites, "sites.json"), "utf8")) as { publisher: string; keepsItems: string; worlds: Record<string, { url: string; items?: string }> };
const inputs = JSON.parse(readFileSync(join(sites, "items", "items.json"), "utf8")) as { d: string; model: { url: string; sha256: string } }[];
const signed = readdirSync(join(sites, "items"))
  .filter((f) => f.endsWith(".event.json"))
  .map((f) => JSON.parse(readFileSync(join(sites, "items", f), "utf8")) as NostrEvent);

describe("the starter items", () => {
  it("are each really signed by the reference publisher, and are what make-items.mjs last wrote", () => {
    expect(signed.length).toBe(inputs.length);
    for (const event of signed) {
      expect(verifyEvent(event)).toBe(true);
      expect(event.pubkey).toBe(config.publisher);
      const item = parseItem(event)!;
      const input = inputs.find((i) => i.d === item.d)!;
      expect(item.model).toEqual(input.model);
      expect(item.use).toBe("anyone");
      // Only the blaster does anything of its own. The rest are shapes, and nothing of theirs runs.
      expect(item.script === null).toBe(item.d !== "dart-blaster");
    }
  });

  it("each name a model the world that keeps them serves, whose bytes have the hash signed", () => {
    const host = `${config.worlds[config.keepsItems]!.url}items/`;
    for (const event of signed) {
      const item = parseItem(event)!;
      expect(item.model.url).toBe(`${host}${item.model.sha256}.glb`);
      const bytes = readFileSync(join(sites, "items", "models", `${item.model.sha256}.glb`));
      expect(bytesToHex(sha256(bytes))).toBe(item.model.sha256);
      expect(bytes.length).toBeLessThanOrEqual(ITEM_BUDGET.bytes);
    }
  });

  it("serve every other file an item names, each with the hash signed: a script, its sounds, what it sends out", () => {
    const host = `${config.worlds[config.keepsItems]!.url}items/`;
    let checked = 0;
    for (const event of signed) {
      const item = parseItem(event)!;
      const named: [{ url: string; sha256: string }, string][] = [...(item.script ? [[item.script, "js"] as [typeof item.model, string]] : []), ...Object.values(item.sounds).map((s) => [s, "ogg"] as [typeof item.model, string]), ...item.sends.map((s) => [s.model, "glb"] as [typeof item.model, string])];
      for (const [file, ext] of named) {
        expect(file.url).toBe(`${host}${file.sha256}.${ext}`);
        expect(bytesToHex(sha256(readFileSync(join(sites, "items", "models", `${file.sha256}.${ext}`))))).toBe(file.sha256);
        checked++;
      }
      // What a thing it sends out sounds like is one of its own sounds, and what it asks of a person is on the list.
      for (const send of item.sends) for (const moment of ["lands", "drops", "strikes", "tells"] as const) if (send[moment]) expect(item.sounds[send[moment]!], `${item.d} ${moment}`).toBeTruthy();
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("keep the blaster's sounds as the owner picked them: each file beside the models is one in sites/items/sounds", () => {
    const blaster = signed.map((e) => parseItem(e)!).find((i) => i.d === "dart-blaster");
    if (!blaster) return;
    for (const [name, file] of Object.entries(blaster.sounds)) expect(bytesToHex(sha256(readFileSync(join(sites, "items", "sounds", `${name}.ogg`)))), name).toBe(file.sha256);
    // Its script is asked about before it runs, and says only what the description lets it: Fire and Reload.
    expect(blaster.does).toEqual({ use: "Fire", second: "Reload" });
    // Its sight is on it: above its middle, toward its front, and it asks for no more than a toy's zoom.
    expect(blaster.aim!.at[1]).toBeGreaterThan(blaster.size[1] * 0.6);
    expect(blaster.aim!.at[2]).toBeLessThan(0);
    expect(blaster.aim!.zoom).toBeGreaterThanOrEqual(0.45);
    expect(blaster.effects).toEqual([{ of: "dart", state: "health", take: 1 }]);
  });

  it("draw the blaster in its holder's colours, and only theirs: another copy keeps its maker's", async () => {
    const blaster = signed.map((e) => parseItem(e)!).find((i) => i.d === "dart-blaster");
    if (!blaster) return;
    const items = createItems({ relays: [], fetchBytes: async (url) => new Uint8Array(readFileSync(join(sites, "items", "models", url.split("/").pop()!))) });
    const colours = (root: THREE.Object3D, slot: string) => {
      const found = new Set<string>();
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        for (const m of mesh.isMesh ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []) if (m.userData.nswpTint === slot) found.add((m as THREE.MeshStandardMaterial).color.getHexString());
      });
      return [...found];
    };
    const mine = await items.model(blaster, { accent: "#8b5cf6", dart: "#46d95a", barrel: "#000000" });
    const theirs = await items.model(blaster);
    expect(colours(mine, "accent")).toEqual(["8b5cf6"]);
    expect(colours(mine, "dart")).toEqual(["46d95a"]);
    expect(colours(theirs, "accent")).toEqual(["f2691c"]);
    // A dart it sends out is the holder's colour too, and what isn't a tint is never touched.
    expect(colours(await items.sent(blaster, "dart", { dart: "#46d95a" }), "dart")).toEqual(["46d95a"]);
    expect(blaster.tints.map((t) => t.slot)).toEqual(["accent", "dart"]);
    expect(blaster.sends[0]!.trail).toBeGreaterThan(0);
  });

  it("are asked for again when a file didn't come: a bad moment on the network isn't for the rest of the visit", async () => {
    const blaster = signed.map((e) => parseItem(e)!).find((i) => i.d === "dart-blaster");
    if (!blaster) return;
    const real = new Uint8Array(readFileSync(join(sites, "items", "models", `${blaster.model.sha256}.glb`)));
    const onlyAFrame = (root: THREE.Object3D) => {
      let solid = 0;
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).every((m) => (m as THREE.MeshBasicMaterial).wireframe === true)) solid++;
      });
      return solid === 0;
    };
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      // Nothing came the first time. The plain marker is drawn, and the file isn't fetched over and over meanwhile.
      let asked = 0;
      const items = createItems({ relays: [], fetchBytes: async () => (++asked === 1 ? null : real) });
      expect(onlyAFrame(await items.model(blaster))).toBe(true);
      expect(onlyAFrame(await items.model(blaster))).toBe(true);
      expect(asked).toBe(1);
      // A little later it is asked for again, and the thing itself is drawn.
      await vi.advanceTimersByTimeAsync(5000);
      expect(onlyAFrame(await items.model(blaster))).toBe(false);
      expect(asked).toBe(2);
      // A file that came and isn't what its description promised is refused for good: asking again gets the same file.
      let wrong = 0;
      const lied = createItems({ relays: [], fetchBytes: async () => (wrong++, new Uint8Array([1, 2, 3])) });
      expect(onlyAFrame(await lied.model(blaster))).toBe(true);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(onlyAFrame(await lied.model(blaster))).toBe(true);
      expect(wrong).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("are each drawn as themselves by the kit, not as a marker", async () => {
    for (const event of signed) {
      const item = parseItem(event)!;
      const items = createItems({ relays: [], fetchBytes: async () => new Uint8Array(readFileSync(join(sites, "items", "models", `${item.model.sha256}.glb`))) });
      const model = await items.model(item);
      // A marker is one wireframe box. The item itself is solid, of several parts.
      const meshes: THREE.Mesh[] = [];
      model.traverse((o) => void ((o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh)));
      expect(meshes.length, item.d).toBeGreaterThan(1);
      expect(meshes.some((m) => (m.material as THREE.MeshBasicMaterial).wireframe), item.d).toBe(false);
      // And it fills the box its description gives, to the millimetre.
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      expect(Math.max(Math.abs(size.x - item.size[0]), Math.abs(size.y - item.size[1]), Math.abs(size.z - item.size[2])), item.d).toBeLessThan(0.002);
    }
  });

  it("are kept by a world whose own announcement says it draws what people carry", () => {
    const grove = parseWorldEvent(JSON.parse(readFileSync(join(sites, "announcements", `${config.keepsItems}.event.json`), "utf8")), { requireSigned: true });
    expect(grove.ok && grove.value.items).toBe("allowed");
    expect(config.worlds[config.keepsItems]!.items).toBe("allowed");
  });
});
