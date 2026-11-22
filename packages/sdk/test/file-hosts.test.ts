import { buildItem, FILE_HOST_LIST_KIND, finalizeEvent, getPublicKey, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { addressesFor, fetchByHash, fileHosts, filesAnywhere, forgetFileHosts, keptElsewhere, learnFileHosts, onFileHostsChange, setFilesAnywhere } from "../src/file-hosts.js";
import { createItemStore } from "../src/item-store.js";
import { forgetRelays } from "../src/relay-book.js";
import { arriveWith, currentSettings, resetSettings } from "../src/settings.js";

const VIEWER = sha256(utf8ToBytes("nswp file hosts test viewer"));
const MAKER = sha256(utf8ToBytes("nswp file hosts test maker"));
const viewer = getPublicKey(VIEWER);
const maker = getPublicKey(MAKER);
const bytes = utf8ToBytes("a model, or near enough");
const hash = bytesToHex(sha256(bytes));
const GROVE = "https://grove.bitblocks.network/items/";
let T = 1_800_000_000;
const relays = (kept: NostrEvent[] = []) => ({
  kept,
  asked: 0,
  async query(asked: string[], filter: Filter) {
    this.asked++;
    return {
      events: kept.filter((e) => (!filter.kinds || filter.kinds.includes(e.kind)) && (!filter.authors || filter.authors.includes(e.pubkey)) && (!filter["#d"] || e.tags.some((t) => t[0] === "d" && filter["#d"]!.includes(t[1]!)))),
      relays: Object.fromEntries(asked.map((r) => [r, "eose" as const])),
    };
  },
});
const hostList = (servers: string[], key = VIEWER, at = T++) => finalizeEvent({ kind: FILE_HOST_LIST_KIND, created_at: at, tags: servers.map((s) => ["server", s]), content: "" }, key);
/** A stand-in for the network: what each address holds, and every address asked. */
const network = (holds: Record<string, Uint8Array>) => {
  const asked: string[] = [];
  return { asked, fetchBytes: async (url: string) => (asked.push(url), holds[url] ?? null) };
};

beforeEach(() => {
  resetSettings();
  forgetFileHosts();
  forgetRelays();
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* none here */
  }
});

describe("where someone else's files are fetched from", () => {
  it("asks only the kit's own hosts, by hash, for a guest: never the address an item gives elsewhere", async () => {
    expect(fileHosts()).toEqual([GROVE]);
    const net = network({ "https://tracker.example/x.glb": bytes, [`${GROVE}${hash}.glb`]: bytes });
    expect(await fetchByHash(hash, "https://tracker.example/x.glb", { fetchBytes: net.fetchBytes, viewer: null })).toEqual(bytes);
    expect(net.asked).toEqual([`${GROVE}${hash}.glb`]);
    expect(keptElsewhere("https://tracker.example/x.glb")).toBe(true);
    expect(keptElsewhere(`${GROVE}${hash}.glb`)).toBe(false);
  });

  it("uses the hint where it is inside a listed host, and takes nothing without the hash", async () => {
    const hint = `${GROVE}${hash}.glb`;
    expect(addressesFor(hash, hint)).toEqual([hint]);
    const liar = network({ [hint]: utf8ToBytes("something else") });
    expect(await fetchByHash(hash, hint, { fetchBytes: liar.fetchBytes, viewer: null })).toBeNull();
    const big = network({ [hint]: bytes });
    expect(await fetchByHash(hash, hint, { fetchBytes: big.fetchBytes, viewer: null, most: 4 })).toBeNull();
    expect(await fetchByHash("not a hash", hint, { fetchBytes: big.fetchBytes })).toBeNull();
  });

  it("reads the viewer's own file host list (kind 10063), newest and really theirs, and asks those first", async () => {
    const forged = { ...hostList(["https://forged.example/"], MAKER, T + 100), pubkey: viewer };
    const net = relays([hostList(["https://old.example/"]), hostList(["https://files.example", "http://plain.example/", "https://files.example/", "not a url"]), forged]);
    let told = 0;
    onFileHostsChange(() => told++);
    expect(await learnFileHosts(viewer, { relays: ["wss://one.example"], query: net.query.bind(net) })).toEqual(["https://files.example/"]);
    expect(fileHosts()).toEqual(["https://files.example/", GROVE]);
    expect(told).toBe(1);
    // Once for each key, kept for the visit.
    await learnFileHosts(viewer, { relays: ["wss://one.example"], query: net.query.bind(net) });
    expect(net.asked).toBe(1);
    const files = network({ [`${GROVE}${hash}.ogg`]: bytes });
    expect(await fetchByHash(hash, "https://tracker.example/x.ogg", { fetchBytes: files.fetchBytes })).toEqual(bytes);
    expect(files.asked).toEqual([`https://files.example/${hash}.ogg`, `${GROVE}${hash}.ogg`]);
    // Signed out: only the kit's own again.
    await learnFileHosts(null);
    expect(fileHosts()).toEqual([GROVE]);
  });

  it("is off for loading from anywhere until the visitor turns it on here; only off goes with them", async () => {
    expect(filesAnywhere()).toBe(false);
    expect(currentSettings().filesAnywhere).toBe(false);
    let told = 0;
    onFileHostsChange(() => told++);
    setFilesAnywhere(true);
    expect(told).toBe(1);
    // On is their own press in this place: it isn't sent on to the next one.
    expect(currentSettings().filesAnywhere).toBeUndefined();
    expect(keptElsewhere("https://tracker.example/x.glb")).toBe(false);
    const net = network({ "https://tracker.example/x.glb": bytes });
    expect(await fetchByHash(hash, "https://tracker.example/x.glb", { fetchBytes: net.fetchBytes, viewer: null })).toEqual(bytes);
    expect(net.asked).toEqual(["https://tracker.example/x.glb"]);
    // Arriving with it off turns it off, and that is kept.
    forgetFileHosts();
    resetSettings();
    arriveWith({ filesAnywhere: false });
    expect(filesAnywhere()).toBe(false);
    forgetFileHosts();
    expect(filesAnywhere()).toBe(false);
  });

  it("is never turned on by a link: any world can write one", async () => {
    const stored = new Map<string, string>();
    const real = globalThis.localStorage;
    const memory = { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v), removeItem: (k: string) => void stored.delete(k), clear: () => stored.clear() };
    Object.defineProperty(globalThis, "localStorage", { value: memory, configurable: true });
    try {
      arriveWith({ filesAnywhere: true });
      expect(filesAnywhere()).toBe(false);
      expect(stored.size).toBe(0);
      expect(currentSettings().filesAnywhere).toBe(false);
      const net = network({ "https://tracker.example/x.glb": bytes });
      expect(await fetchByHash(hash, "https://tracker.example/x.glb", { fetchBytes: net.fetchBytes, viewer: null })).toBeNull();
      expect(net.asked.some((u) => u.startsWith("https://tracker.example/"))).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: real, configurable: true });
    }
  });
});

describe("an item kept somewhere the visitor doesn't load files from", () => {
  const item = () =>
    finalizeEvent(buildItem({ d: "lantern", title: "Lantern", model: { url: "https://tracker.example/lantern.glb", sha256: hash }, size: [0.2, 0.4, 0.2], now: T })!, MAKER);

  it("isn't fetched from there, is drawn as its marker, and its card can say why", async () => {
    const net = relays([item()]);
    const files = network({ "https://tracker.example/lantern.glb": bytes });
    const store = createItemStore({ relays: ["wss://one.example"], query: net.query.bind(net), fetchBytes: files.fetchBytes, viewer: () => null });
    const described = (await store.describe(`37303:${maker}:lantern`))!;
    expect(await store.modelBytes({ model: described.model, size: described.size })).toBeNull();
    expect(files.asked).toEqual([`${GROVE}${hash}.glb`]);
    expect(store.elsewhere(described)).toBe(true);
    // Once the visitor says files may come from anywhere, it is asked for afresh, from where it is kept.
    setFilesAnywhere(true);
    expect(store.elsewhere(described)).toBe(false);
    // Not a model at all, so it isn't handed on: but it was asked for at its own address this time.
    await store.modelBytes({ model: described.model, size: described.size });
    expect(files.asked.at(-1)).toBe("https://tracker.example/lantern.glb");
  });
});
