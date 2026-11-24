import { describe, expect, it } from "vitest";
import { cleanRelayUrl, finalizeEvent, getPublicKey, readRelayList, RELAY_PICK, writeRelaysFor } from "../src/index.js";

const KEY = new Uint8Array(32).fill(7);
const ME = getPublicKey(KEY);
const list = (tags: string[][], at = 1000, key = KEY) => finalizeEvent({ kind: 10002, created_at: at, tags, content: "" }, key);

describe("a relay's address (NIP-65)", () => {
  it("is a wss address on the open web, and nothing else", () => {
    expect(cleanRelayUrl("wss://relay.example/")).toBe("wss://relay.example");
    expect(cleanRelayUrl(" wss://relay.example/nostr ")).toBe("wss://relay.example/nostr");
    for (const not of ["ws://relay.example", "https://relay.example", "wss://localhost", "wss://printer", "wss://192.168.1.4", "wss://[::1]", "wss://box.local", "wss://user:pw@relay.example", "relay.example", "", null, 5, `wss://relay.example/${"x".repeat(300)}`]) {
      expect(cleanRelayUrl(not)).toBe("");
    }
  });
});

describe("someone's own relay list (NIP-65)", () => {
  it("is their newest list: where they write and where they read", () => {
    const old = list([["r", "wss://old.example"]], 500);
    const now = list([["r", "wss://both.example"], ["r", "wss://w.example/", "write"], ["r", "wss://r.example", "read"], ["r", "wss://both.example"], ["r", "ws://plain.example"], ["p", "ignored"]], 1000);
    expect(readRelayList([old, now], ME)).toEqual({ write: ["wss://both.example", "wss://w.example"], read: ["wss://both.example", "wss://r.example"] });
  });

  it("is nobody else's, and null when they have published none", () => {
    const theirs = list([["r", "wss://theirs.example"]], 2000, new Uint8Array(32).fill(9));
    expect(readRelayList([theirs], ME)).toBeNull();
    expect(readRelayList([], ME)).toBeNull();
  });

  it("is cut to RELAY_PICK.listed of each: enough to find a note on any of a long list's relays", () => {
    const many = list(Array.from({ length: 30 }, (_, i) => ["r", `wss://r${i}.example`]));
    expect(readRelayList([many], ME)!.write).toHaveLength(RELAY_PICK.listed);
    expect(RELAY_PICK.listed).toBe(24);
  });
});

describe("where a note is sent", () => {
  const usual = ["wss://a.example", "wss://b.example", "wss://c.example", "wss://d.example", "wss://e.example"];
  it("is the writer's own relays, when they have enough", () => {
    expect(writeRelaysFor({ write: ["wss://mine1.example", "wss://mine2.example"], read: [] }, usual)).toEqual({ relays: ["wss://mine1.example", "wss://mine2.example"], own: 2 });
  });
  it("is filled out from the usual ones when their list is thin, and is the usual ones when they have none", () => {
    expect(writeRelaysFor({ write: ["wss://mine1.example"], read: [] }, usual)).toEqual({ relays: ["wss://mine1.example", "wss://a.example", "wss://b.example", "wss://c.example"], own: 1 });
    expect(writeRelaysFor(null, usual)).toEqual({ relays: usual.slice(0, 4), own: 0 });
    expect(writeRelaysFor({ write: [], read: ["wss://r.example"] }, usual).own).toBe(0);
  });
  it("is never more than six of their own", () => {
    expect(writeRelaysFor({ write: Array.from({ length: 8 }, (_, i) => `wss://m${i}.example`), read: [] }, usual).relays).toHaveLength(6);
  });
});
