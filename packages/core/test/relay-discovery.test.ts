import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { DISCOVERY, finalizeEvent, getPublicKey, pickDiscovered, readRelayFinding, RELAY_DISCOVERY_KIND, type NostrEvent } from "../src/index.js";

const monitor = (n: number) => sha256(utf8ToBytes(`nswp relay monitor ${n}`));
const NOW = 1_800_000_000;
const found = (by: number, url: string, tags: string[][] = [], at = NOW - 3600): NostrEvent => finalizeEvent({ kind: RELAY_DISCOVERY_KIND, created_at: at, tags: [["d", url], ["n", "clearnet"], ...tags], content: "" }, monitor(by));
const OPEN = [["R", "!auth"], ["R", "!payment"], ["rtt-open", "200"]];

describe("what a relay monitor found", () => {
  it("is read as what it said of one relay, and nothing it didn't say", () => {
    const f = readRelayFinding(found(1, "wss://good.example/", [["R", "!auth"], ["R", "payment"], ["rtt-open", "234"], ["k", "!1059"], ["k", "1"]]))!;
    expect(f).toMatchObject({ url: "wss://good.example", monitor: getPublicKey(monitor(1)), auth: false, payment: true, restricted: null, pow: null, rttOpen: 234, rttWrite: null, refuses: [1059] });
  });

  it("is nothing for a relay a browser wouldn't dial", () => {
    expect(readRelayFinding(found(1, "ws://plain.example"))).toBeNull();
    expect(readRelayFinding(found(1, "wss://10.0.0.1"))).toBeNull();
    expect(readRelayFinding(finalizeEvent({ kind: RELAY_DISCOVERY_KIND, created_at: NOW, tags: [["d", "wss://hidden.example"], ["n", "tor"]], content: "" }, monitor(1)))).toBeNull();
    expect(readRelayFinding({ ...found(1, "wss://good.example"), kind: 1 })).toBeNull();
  });
});

describe("a backup chosen from what monitors found", () => {
  it("takes a relay only where two monitors found it working", () => {
    const picked = pickDiscovered([found(1, "wss://both.example", OPEN), found(2, "wss://both.example", OPEN), found(1, "wss://one.example", OPEN)], { now: NOW });
    expect(picked.open).toEqual(["wss://both.example"]);
  });

  it("never believes one monitor however often it says so", () => {
    const loud = Array.from({ length: 20 }, (_, i) => found(1, "wss://mine.example", OPEN, NOW - i));
    expect(pickDiscovered(loud, { now: NOW }).open).toEqual([]);
  });

  it("leaves out a relay that asks for proof, payment or work, or keeps writing to a few, if any monitor says so", () => {
    const two = (url: string, tags: string[][]) => [found(1, url, OPEN), found(2, url, tags)];
    const picked = pickDiscovered([...two("wss://auth.example", [["R", "auth"]]), ...two("wss://paid.example", [["R", "payment"]]), ...two("wss://pow.example", [["R", "pow"]]), ...two("wss://few.example", [["R", "writes"]]), ...two("wss://fine.example", OPEN)], { now: NOW });
    expect(picked.open).toEqual(["wss://fine.example"]);
    // The ones closed to a stranger are named, for leaving out of somewhere a stranger must reach.
    expect(picked.closed).toEqual(["wss://auth.example", "wss://paid.example"]);
  });

  it("goes by each monitor's newest word, and only a recent one", () => {
    const was = found(2, "wss://changed.example", [["R", "auth"]], NOW - 7200);
    const now = found(2, "wss://changed.example", OPEN, NOW - 60);
    expect(pickDiscovered([found(1, "wss://changed.example", OPEN), was, now], { now: NOW }).open).toEqual(["wss://changed.example"]);
    const stale = [found(1, "wss://old.example", OPEN, NOW - DISCOVERY.freshSec - 10), found(2, "wss://old.example", OPEN, NOW - DISCOVERY.freshSec - 10)];
    expect(pickDiscovered(stale, { now: NOW }).open).toEqual([]);
    const tomorrow = [found(1, "wss://soon.example", OPEN, NOW + 86400), found(2, "wss://soon.example", OPEN, NOW + 86400)];
    expect(pickDiscovered(tomorrow, { now: NOW }).open).toEqual([]);
  });

  it("puts first the ones more monitors are sure of, then the quicker", () => {
    const relay = (url: string, monitors: number, ms: string, sure = true) => Array.from({ length: monitors }, (_, i) => found(i + 1, url, sure ? [["R", "!auth"], ["R", "!payment"], ["rtt-open", ms]] : [["rtt-open", ms]]));
    const picked = pickDiscovered([...relay("wss://slowish.example", 3, "900"), ...relay("wss://quick.example", 3, "120"), ...relay("wss://silent.example", 3, "50", false), ...relay("wss://two.example", 2, "60"), ...relay("wss://crawl.example", 3, "9000")], { now: NOW });
    expect(picked.open).toEqual(["wss://quick.example", "wss://slowish.example", "wss://two.example", "wss://silent.example"]);
  });

  it("prefers a relay a monitor wrote to, among those as sure", () => {
    const relay = (url: string, extra: string[][]) => [found(1, url, [...OPEN, ...extra]), found(2, url, [...OPEN, ...extra])];
    expect(pickDiscovered([...relay("wss://read-only-checked.example", [["rtt-open", "50"]]), ...relay("wss://written-to.example", [["rtt-write", "300"]])], { now: NOW }).open[0]).toBe("wss://written-to.example");
  });

  it("leaves out what was already tried, a relay that refuses the kind, and all but a few", () => {
    const relay = (url: string, tags: string[][] = OPEN) => [found(1, url, tags), found(2, url, tags)];
    const many = Array.from({ length: 10 }, (_, i) => relay(`wss://r${i}.example`)).flat();
    expect(pickDiscovered(many, { now: NOW }).open.length).toBe(DISCOVERY.most);
    expect(pickDiscovered(many, { now: NOW, not: ["wss://r0.example"], most: 20 }).open).not.toContain("wss://r0.example");
    expect(pickDiscovered([...relay("wss://nowraps.example", [...OPEN, ["k", "!1059"]]), ...relay("wss://wraps.example")], { now: NOW, kind: 1059 }).open).toEqual(["wss://wraps.example"]);
  });

  it("is empty with nothing to go on", () => {
    expect(pickDiscovered([], { now: NOW })).toEqual({ open: [], closed: [] });
  });
});
