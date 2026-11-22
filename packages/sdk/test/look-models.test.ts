import { AVATAR_KIND, finalizeEvent, getPublicKey, LOOK_BUDGET, readGlb, readLookModel, withoutRequired, glbJson, encodeNaddr, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as THREE from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { forgetFileHosts, setFilesAnywhere } from "../src/file-hosts.js";
import { createLookModels, forgetModelsSwitch, lookBudget, ownLookNote, setShowsModels, showsModels } from "../src/look-models.js";
import { forgetRelays } from "../src/relay-book.js";
import { arriveWith, currentSettings, resetSettings } from "../src/settings.js";
import { tinyVrm } from "./tiny-vrm.js";

const GROVE = "https://grove.bitblocks.network/items/";
const KEY = sha256(utf8ToBytes("nswp look models test key"));
const me = getPublicKey(KEY);
const vrm = tinyVrm();
const sha = bytesToHex(sha256(vrm));
const network = (holds: Record<string, Uint8Array>) => {
  const asked: string[] = [];
  return { asked, fetchBytes: async (url: string) => (asked.push(url), holds[url] ?? null) };
};
const model = (o: Partial<{ url: string; sha256: string; height: number; format: "vrm" | "glb" }> = {}) => ({ url: `${GROVE}${sha}.vrm`, format: "vrm" as const, sha256: sha, height: 1.7, ...o });

beforeEach(() => {
  resetSettings();
  forgetFileHosts();
  forgetModelsSwitch();
  forgetRelays();
});

describe("a tiny VRM, made in code", () => {
  it("is read within a look's budget, with its joints and morphs counted", () => {
    const read = readGlb(vrm, LOOK_BUDGET);
    expect(read.ok).toBe(true);
    expect(read.ok && [read.count.joints, read.count.morphs]).toEqual([2, 2]);
  });
  it("is refused when it requires spring bones", () => {
    expect(readGlb(tinyVrm({ springBones: true }), LOOK_BUDGET)).toEqual({ ok: false, why: "needs-more" });
  });
  it("is handed to an engine with nothing on its required list, and nothing else changed", () => {
    const plain = withoutRequired(vrm)!;
    const json = glbJson(plain)!;
    expect(json.extensionsRequired).toBeUndefined();
    expect(json.extensionsUsed).toEqual(["VRMC_vrm"]);
    expect(readGlb(plain).ok).toBe(true);
    expect(withoutRequired(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("people's own models, fetched and fitted", () => {
  it("is fetched by hash from a listed host, fitted to its height, feet on the floor, facing -z", async () => {
    const net = network({ [`${GROVE}${sha}.vrm`]: vrm });
    const looks = createLookModels({ fetchBytes: net.fetchBytes, viewer: () => null });
    const drawn = (await looks.object(model({ height: 2.2 })))!;
    expect(drawn).not.toBeNull();
    drawn.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(drawn);
    expect(box.max.y - box.min.y).toBeCloseTo(2.2, 2);
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(drawn.userData.lookHeight).toBe(2.2);
    // glTF faces +z; the kit draws everyone facing -z.
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(drawn.children[0]!.quaternion);
    expect(forward.z).toBeCloseTo(-1, 5);
    // The file says nothing of metal, which in a glTF means all metal: drawn as plain, or it would be black here.
    const metals: number[] = [];
    drawn.traverse((o) => void ((o as THREE.Mesh).isMesh && metals.push(((o as THREE.Mesh).material as THREE.MeshStandardMaterial).metalness)));
    expect(metals).toEqual([0]);
    // A second wearer of the same file gets a copy of their own, the file fetched once.
    expect(await looks.object(model({ height: 1 }))).not.toBe(drawn);
    expect(net.asked.length).toBe(1);
    expect(looks.why(model())).toBeNull();
  });

  it("leaves a VRM 0.x facing the way it is written", async () => {
    const old = tinyVrm({ vrm0: true });
    const s = bytesToHex(sha256(old));
    const looks = createLookModels({ fetchBytes: network({ [`${GROVE}${s}.vrm`]: old }).fetchBytes, viewer: () => null });
    const drawn = (await looks.object(model({ sha256: s, url: `${GROVE}${s}.vrm` })))!;
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(drawn.children[0]!.quaternion).z).toBeCloseTo(1, 5);
  });

  it("isn't fetched from a host off the viewer's list, and says why", async () => {
    const net = network({ "https://tracker.example/me.vrm": vrm });
    const looks = createLookModels({ fetchBytes: net.fetchBytes, viewer: () => null });
    expect(await looks.object(model({ url: "https://tracker.example/me.vrm" }))).toBeNull();
    expect(net.asked.some((u) => u.startsWith("https://tracker.example/"))).toBe(false);
    expect(looks.why(model())).toBe("elsewhere");
    setFilesAnywhere(true);
    expect(await looks.object(model({ url: "https://tracker.example/me.vrm" }))).not.toBeNull();
  });

  it("is refused over a world's lower budget, or when it requires spring bones", async () => {
    const springy = tinyVrm({ springBones: true });
    const s = bytesToHex(sha256(springy));
    const looks = createLookModels({ fetchBytes: network({ [`${GROVE}${sha}.vrm`]: vrm, [`${GROVE}${s}.vrm`]: springy }).fetchBytes, viewer: () => null });
    expect(await looks.object(model(), lookBudget({ maxTriangles: 4 }))).toBeNull();
    expect(looks.why(model())).toBe("refused");
    expect(await looks.object(model({ sha256: s, url: `${GROVE}${s}.vrm` }))).toBeNull();
    expect(lookBudget({ maxFileSizeMb: 50, maxTriangles: 1e9 })).toEqual({ ...LOOK_BUDGET });
    expect(lookBudget({ maxFileSizeMb: 0.5 }).bytes).toBe(500_000);
  });
});

describe("seeing people's own models", () => {
  it("is on until the visitor turns it off, and that travels", () => {
    expect(showsModels()).toBe(true);
    setShowsModels(false);
    expect(currentSettings().models).toBe(false);
    forgetModelsSwitch();
    resetSettings();
    arriveWith({ models: false });
    expect(showsModels()).toBe(false);
  });
});

describe("the visitor's own look note", () => {
  const note = (o: { key?: Uint8Array; d?: string } = {}) => finalizeEvent({ kind: AVATAR_KIND, created_at: 1_800_000_000, tags: [["d", o.d ?? "default"], ["model", `${GROVE}${sha}.vrm`, "vrm", sha]], content: "" }, o.key ?? KEY);
  const relays = (kept: NostrEvent[]) => async (asked: string[], f: Filter) => ({ events: kept.filter((e) => f.kinds!.includes(e.kind) && f.authors!.includes(e.pubkey) && e.tags.some((t) => t[0] === "d" && f["#d"]!.includes(t[1]!))), relays: Object.fromEntries(asked.map((r) => [r, "eose" as const])) });
  it("is the one their arrival named, by their own key", async () => {
    const naddr = encodeNaddr({ kind: AVATAR_KIND, pubkey: me, identifier: "default" });
    const got = await ownLookNote({ naddr, author: me, relays: ["wss://one.example"], query: relays([note()]) });
    expect(got && readLookModel(got)?.sha256).toBe(sha);
    // Named for someone else, or with nobody signed in: none.
    expect(await ownLookNote({ naddr, author: getPublicKey(sha256(utf8ToBytes("other"))), query: relays([note()]) })).toBeNull();
    expect(await ownLookNote({ naddr, author: null, query: relays([note()]) })).toBeNull();
    expect(await ownLookNote({ naddr: null, author: me, query: relays([note()]) })).toBeNull();
  });
});
