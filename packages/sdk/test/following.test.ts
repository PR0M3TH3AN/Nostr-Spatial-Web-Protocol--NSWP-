import { encodeNpub, finalizeEvent, getPublicKey, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { keyIn } from "../src/following.js";
import { createProfiles, readProfile } from "../src/profiles.js";
import { forgetRelays } from "../src/relay-book.js";

const KEY = sha256(utf8ToBytes("nswp test vector key 1"));
const OTHER = sha256(utf8ToBytes("nswp test vector key 2"));
const ann = getPublicKey(KEY);
const bo = getPublicKey(OTHER);

beforeEach(() => forgetRelays());

describe("a key someone copied or typed", () => {
  it("is found as an npub or as hex, alone or among other words", () => {
    expect(keyIn(encodeNpub(ann))).toBe(ann);
    expect(keyIn(`nostr:${encodeNpub(ann)}`)).toBe(ann);
    expect(keyIn(`  Follow me: ${encodeNpub(ann)} thanks`)).toBe(ann);
    expect(keyIn(ann)).toBe(ann);
    expect(keyIn(ann.toUpperCase())).toBe(ann);
  });

  it("is nothing when it isn't a key", () => {
    for (const bad of ["", "hello", "npub1tooshort", encodeNpub(ann).slice(0, -1) + "b", "f".repeat(64), 5, null]) expect(keyIn(bad), String(bad)).toBeNull();
  });
});

describe("what people say of themselves", () => {
  const profile = (key: Uint8Array, content: unknown, at = 1_800_000_000) => finalizeEvent({ kind: 0, created_at: at, tags: [], content: typeof content === "string" ? content : JSON.stringify(content) }, key);

  it("is read as a name, a picture and a few plain words", () => {
    expect(readProfile(profile(KEY, { display_name: "  Ann  ", name: "ann_42", picture: "https://pics.example/a.png", about: "Keeper of <b>clocks</b>.\nAsk me." }))).toEqual({ name: "Ann", picture: "https://pics.example/a.png", about: "Keeper of <b>clocks</b>. Ask me.", at: 1_800_000_000 });
    expect(readProfile(profile(KEY, { name: "ann_42", picture: "javascript:alert(1)" }))).toMatchObject({ name: "ann_42", picture: "" });
    expect(readProfile(profile(KEY, "not json"))).toMatchObject({ name: "", picture: "", about: "" });
    expect(readProfile(profile(KEY, [1, 2]))).toMatchObject({ name: "" });
  });

  it("is asked for once, kept, and the newest believed", async () => {
    let t = 1_800_000_000_000;
    const kept = [profile(KEY, { name: "Old Ann" }, 100), profile(KEY, { name: "Ann" }, 200), profile(OTHER, { name: "Bo" }, 100)];
    const asked: string[][] = [];
    const query = async (relays: string[], filter: Filter) => {
      asked.push(filter.authors ?? []);
      return { events: kept.filter((e: NostrEvent) => filter.authors?.includes(e.pubkey)), relays: Object.fromEntries(relays.map((r) => [r, "eose"])) };
    };
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    const profiles = createProfiles({ relays: ["wss://one.example"], storage, now: () => t, query });
    let told = 0;
    profiles.onChange(() => told++);
    expect(profiles.get(ann)).toBeNull();
    await profiles.fetch([ann, bo, "c".repeat(64), "not a key"]);
    expect(profiles.get(ann)?.name).toBe("Ann");
    expect(profiles.get(bo)?.name).toBe("Bo");
    expect(profiles.get("c".repeat(64))?.name).toBe("");
    expect(told).toBe(1);
    // Not asked again the same day: not even for the one with no profile.
    await profiles.fetch([ann, bo, "c".repeat(64)]);
    expect(asked.length).toBe(1);
    // Another page's copy reads what was kept.
    expect(createProfiles({ storage, now: () => t, query }).get(ann)?.name).toBe("Ann");
    t += 25 * 3600 * 1000;
    await profiles.fetch([ann]);
    expect(asked.length).toBe(2);
  });

  it("takes nothing from a profile that isn't really theirs", async () => {
    const forged = { ...profile(OTHER, { name: "Ann" }), pubkey: ann };
    const profiles = createProfiles({ storage: null, query: async (relays) => ({ events: [forged], relays: Object.fromEntries(relays.map((r) => [r, "eose"])) }) });
    await profiles.fetch([ann]);
    expect(profiles.get(ann)?.name).toBe("");
  });
});
