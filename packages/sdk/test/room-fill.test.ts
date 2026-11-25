import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { buildHello, buildSignal, getPublicKey, lobbyName, openSignal, ROOM_LIMITS, roomTopic } from "@nswp/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lobbies that fill one at a time (docs/backlog/rooms-that-fill-and-always-connect.md, part 3). The owner,
 * 2026-11-25: "Are the lobbies working correctly where we join everyone into the same room so long as there are
 * spots avalable?" A ninth visitor joined and silently saw nobody. Now a full lobby says so, once, and the newcomer
 * goes on to the next. Nothing is reached: the sockets are stand-ins that keep what is sent, and the connections are
 * stand-ins too. What is tested is the session's own rule.
 */
const WORLD = "https://world.example/";
const key = (n: number) => sha256(utf8ToBytes(`nswp room fill test key ${n}`));

let RoomSession: typeof import("../src/room.js").RoomSession;
let sent: unknown[][] = [];
beforeEach(async () => {
  sent = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(1_800_000_000_000);
  vi.stubGlobal("location", { origin: "https://world.example", pathname: "/" });
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
  vi.stubGlobal("WebSocket", Object.assign(class {
    readyState = 1;
    onopen: (() => void) | null = null;
    constructor() {}
    send(frame: string) { sent.push(JSON.parse(frame)); }
    close() {}
  }, { OPEN: 1 }));
  vi.stubGlobal("RTCPeerConnection", class {
    connectionState = "connecting";
    signalingState = "stable";
    onconnectionstatechange: (() => void) | null = null;
    close() {}
    getTransceivers() { return []; }
  });
  ({ RoomSession } = await import("../src/room.js"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Inside = { key: Uint8Array; peers: Map<string, { open: boolean; member: { pubkey: string } }>; createPeer(pubkey: string): { open: boolean }; onEvent(raw: unknown): Promise<void>; offerTo(pubkey: string): Promise<void>; joinedAtOf: Map<string, number> };
const now = () => Math.floor(Date.now() / 1000);
/** A room of `name`, its sockets stood up, and `others` already connected in it. */
function room(o: { name?: string; others?: string[] } = {}) {
  const s = new RoomSession({ world: WORLD, relays: ["wss://relay.example"], ...(o.name ? { name: o.name } : {}) });
  const inside = s as unknown as Inside;
  inside.offerTo = async () => {};
  s.start();
  for (const pubkey of o.others ?? []) inside.createPeer(pubkey).open = true;
  return { s, inside };
}
/** What this session said to `to` alone (not its hellos to everyone), read as `to` would read it. */
const saidTo = (topic: string, toKey: Uint8Array) =>
  sent
    .filter((f) => f[0] === "EVENT" && (f[1] as { tags: string[][] }).tags.some((t) => t[0] === "p" && t[1] === getPublicKey(toKey)))
    .map((f) => openSignal(f[1], toKey, topic))
    .filter(Boolean)
    .map((x) => x!.message.t);
/** Keys that sort above any session key, so this visitor is the lowest of them. */
const high = (n: number) => `${"f".repeat(60)}${n.toString(16).padStart(4, "0")}`;

describe("the lobby rule", () => {
  it("is \"lobby\", then \"lobby-2\" and on, to 32", () => {
    expect(ROOM_LIMITS.lobbies).toBe(32);
    expect([1, 2, 3, 32].map(lobbyName)).toEqual(["lobby", "lobby-2", "lobby-3", "lobby-32"]);
    for (const n of [0, 33, 1.5, -1, NaN]) expect(lobbyName(n)).toBeNull();
  });
});

describe("a full lobby", () => {
  it("tells someone joining that it is full, once, from the member with the lowest key", async () => {
    const r = room({ others: [1, 2, 3, 4, 5, 6, 7].map(high) });
    const joiner = key(9);
    sent = [];
    await r.inside.onEvent(buildHello(r.s.topic, joiner, now(), { first: true }));
    expect(saidTo(r.s.topic, joiner)).toEqual(["full"]);
    // With a hello of its own first, so the newcomer has heard who told them.
    const events = sent.filter((f) => f[0] === "EVENT").map((f) => f[1] as { content: string; tags: string[][] });
    expect(events.map((e) => (e.tags.some((t) => t[0] === "p") ? "to one" : JSON.parse(e.content).t))).toEqual(["hello", "to one"]);
    // A hello that isn't a joining one (every 20 seconds) isn't answered.
    sent = [];
    await r.inside.onEvent(buildHello(r.s.topic, key(10), now() - 1));
    expect(saidTo(r.s.topic, key(10))).toEqual([]);
  });

  it("is said by nobody else in it: one answer, not seven", async () => {
    const r = room({ others: ["0".repeat(64), ...[2, 3, 4, 5, 6, 7].map(high)] });
    const joiner = key(9);
    sent = [];
    await r.inside.onEvent(buildHello(r.s.topic, joiner, now(), { first: true }));
    expect(saidTo(r.s.topic, joiner)).toEqual([]);
  });

  it("keeps who joined first: someone here who joined after the newcomer is the one sent on", async () => {
    const r = room({ others: [1, 2, 3, 4, 5, 6].map(high) });
    const early = key(11);
    // A key that sorts above this visitor's own (made fresh each visit), so this visitor is still the one who answers.
    let n = 12;
    while (getPublicKey(key(n)) < r.s.self.pubkey) n++;
    const late = key(n);
    const lateKey = getPublicKey(late);
    // The late one is here already (a quicker relay), though their joining hello was signed after the newcomer's.
    r.inside.createPeer(lateKey).open = true;
    r.inside.joinedAtOf.set(lateKey, now());
    sent = [];
    await r.inside.onEvent(buildHello(r.s.topic, early, now() - 1, { first: true }));
    expect(saidTo(r.s.topic, late)).toEqual(["full"]);
    expect(r.inside.peers.has(lateKey)).toBe(false);
    expect(saidTo(r.s.topic, early)).not.toContain("full");
  });
});

describe("someone told a lobby is full", () => {
  it("goes on to the next, on the same relays, as someone just joining it", async () => {
    const r = room({ others: [high(1)] });
    const statuses: string[] = [];
    r.s.on("status", (st) => statuses.push(st));
    const member = key(20);
    await r.inside.onEvent(buildHello(r.s.topic, member, now()));
    sent = [];
    await r.inside.onEvent(buildSignal(r.s.topic, member, getPublicKey(r.inside.key), { t: "full" }));
    expect(r.s.name).toBe("lobby-2");
    expect(r.s.topic).toBe(roomTopic(WORLD, "lobby-2"));
    expect(r.inside.peers.size).toBe(0);
    // Goodbye to whoever was here, then the same subscription for the next lobby, and a joining hello there.
    const req = sent.find((f) => f[0] === "REQ") as [string, string, { "#x": string[] }];
    expect(req[1]).toBe("room");
    expect(req[2]["#x"]).toEqual([roomTopic(WORLD, "lobby-2")]);
    const hello = sent.filter((f) => f[0] === "EVENT").map((f) => f[1] as { content: string; tags: string[][] }).find((e) => e.content.includes('"hello"'));
    expect(JSON.parse(hello!.content)).toEqual({ t: "hello", v: 1, first: true });
    expect(hello!.tags).toEqual([["x", roomTopic(WORLD, "lobby-2")]]);
    expect(statuses.length).toBeGreaterThan(0);
  });

  it("stays in a room by name, and at the last lobby", async () => {
    const told = async (r: ReturnType<typeof room>, by: Uint8Array) => {
      await r.inside.onEvent(buildHello(r.s.topic, by, now()));
      await r.inside.onEvent(buildSignal(r.s.topic, by, getPublicKey(r.inside.key), { t: "full" }));
    };
    const named = room({ name: "our-party" });
    await told(named, key(21));
    expect(named.s.name).toBe("our-party");
    const last = room({ name: "lobby" });
    for (let n = 2; n <= 32; n++) await told(last, key(100 + n));
    expect(last.s.name).toBe("lobby-32");
    await told(last, key(200));
    expect(last.s.name).toBe("lobby-32");
  });
});

describe("a full, taken only while it may be", () => {
  it("is ignored by someone settled in a lobby, whoever sends it: a stranger or a member", async () => {
    const r = room({ others: [high(1)] });
    vi.setSystemTime(Date.now() + 16_000);
    const member = key(30);
    await r.inside.onEvent(buildHello(r.s.topic, member, now()));
    await r.inside.onEvent(buildSignal(r.s.topic, member, getPublicKey(r.inside.key), { t: "full" }));
    await r.inside.onEvent(buildSignal(r.s.topic, key(31), getPublicKey(r.inside.key), { t: "full" }));
    expect(r.s.name).toBe("lobby");
    expect(r.inside.peers.size).toBe(1);
  });

  it("is taken from someone not yet heard only once their hello comes, and only while it still may be", async () => {
    const r = room();
    const member = key(32);
    await r.inside.onEvent(buildSignal(r.s.topic, member, getPublicKey(r.inside.key), { t: "full" }));
    expect(r.s.name).toBe("lobby");
    await r.inside.onEvent(buildHello(r.s.topic, member, now()));
    expect(r.s.name).toBe("lobby-2");
    // In the next lobby, a "full" whose sender's hello comes too late is not taken.
    const other = key(33);
    await r.inside.onEvent(buildSignal(r.s.topic, other, getPublicKey(r.inside.key), { t: "full" }));
    vi.setSystemTime(Date.now() + 16_000);
    await r.inside.onEvent(buildHello(r.s.topic, other, now()));
    expect(r.s.name).toBe("lobby-2");
  });

  it("is never taken from a stranger never heard", async () => {
    const r = room();
    await r.inside.onEvent(buildSignal(r.s.topic, key(34), getPublicKey(r.inside.key), { t: "full" }));
    vi.setSystemTime(Date.now() + 20_000);
    expect(r.s.name).toBe("lobby");
  });
});

