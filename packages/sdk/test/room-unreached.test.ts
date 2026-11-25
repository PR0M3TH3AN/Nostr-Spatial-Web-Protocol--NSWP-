import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Said when two people can't connect (docs/backlog/rooms-that-fill-and-always-connect.md, part 2). The owner,
 * 2026-11-25: two of his computers were both "in a room" in the Grove, alone, and nothing said why: they had found
 * each other and never connected. A first try that doesn't open is made again, afresh, by the one who offers; a
 * second that fails is said (`unreached`). A room is WebRTC, which a unit test doesn't have: the connections are
 * stand-ins that never open unless told, and what is tested is the session's own timing and rule.
 */
const WORLD = "https://world.example/";
const LATER = "f".repeat(64); // sorts after any session key: this visitor makes the offer
const EARLIER = "0".repeat(64); // sorts before: they make it

let RoomSession: typeof import("../src/room.js").RoomSession;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.stubGlobal("location", { origin: "https://world.example", pathname: "/" });
  vi.stubGlobal("RTCPeerConnection", class {
    connectionState = "connecting";
    signalingState = "stable";
    ontrack: ((e: unknown) => void) | null = null;
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

type Peer = { pc: { connectionState: string; onconnectionstatechange: (() => void) | null }; open: boolean; attempt: number };
function room() {
  const s = new RoomSession({ world: WORLD, relays: [] });
  const inside = s as unknown as { peers: Map<string, Peer>; createPeer(pubkey: string): Peer; offerTo(pubkey: string): Promise<void>; sweep(): void; wirePoseChannel(peer: unknown, ch: unknown): void };
  // An offer here only stands a connection up: what is sent to relays isn't what is tested.
  const offers: string[] = [];
  inside.offerTo = async (pubkey: string) => {
    offers.push(pubkey);
    inside.createPeer(pubkey);
  };
  const unreached: string[] = [];
  s.on("unreached", (pubkey) => unreached.push(pubkey));
  const members: string[] = [];
  s.on("member", (m) => members.push(m.pubkey));
  /** Let `ms` pass, as the session's own two-second sweep sees it. */
  const pass = (ms: number) => {
    for (let t = 0; t < ms; t += 1000) {
      vi.setSystemTime(Date.now() + 1000);
      inside.sweep();
    }
  };
  return { s, inside, offers, unreached, members, pass };
}

describe("a connection to someone that doesn't open", () => {
  it("is tried once more, afresh, at 15 seconds, by the one who offers; then said, once that fails", () => {
    const r = room();
    void r.inside.offerTo(LATER);
    r.pass(14_000);
    expect(r.offers).toEqual([LATER]);
    r.pass(2000);
    // The first try given up at 15 s and made again at once: a second offer, a second try.
    expect(r.offers).toEqual([LATER, LATER]);
    expect(r.inside.peers.get(LATER)?.attempt).toBe(2);
    expect(r.unreached).toEqual([]);
    // The second gets the whole 25 seconds, and is then said.
    r.pass(24_000);
    expect(r.unreached).toEqual([]);
    r.pass(2000);
    expect(r.unreached).toEqual([LATER]);
    expect(r.inside.peers.has(LATER)).toBe(false);
  });

  it("is tried again at once when it fails outright, not only when it runs out of time", () => {
    const r = room();
    void r.inside.offerTo(LATER);
    const first = r.inside.peers.get(LATER)!;
    first.pc.connectionState = "failed";
    first.pc.onconnectionstatechange?.();
    expect(r.offers).toEqual([LATER, LATER]);
    const second = r.inside.peers.get(LATER)!;
    second.pc.connectionState = "failed";
    second.pc.onconnectionstatechange?.();
    expect(r.unreached).toEqual([LATER]);
    expect(r.offers).toHaveLength(2);
  });

  it("isn't offered again by the one who answers: they wait for the new offer, and say it when a later try fails", () => {
    const r = room();
    // They make the offers; this visitor answers.
    r.inside.createPeer(EARLIER);
    r.pass(26_000);
    expect(r.offers).toEqual([]);
    expect(r.unreached).toEqual([]);
    // Their fresh offer comes, and fails too: now it is said.
    r.inside.createPeer(EARLIER);
    r.pass(26_000);
    expect(r.unreached).toEqual([EARLIER]);
  });

  it("starts counting again once they have connected", () => {
    const r = room();
    void r.inside.offerTo(LATER);
    r.pass(16_000);
    const second = r.inside.peers.get(LATER)!;
    const ch: Record<string, unknown> = { readyState: "open", send() {} };
    r.inside.wirePoseChannel(second, ch);
    (ch.onopen as () => void)();
    expect(r.members).toEqual([LATER]);
    // Gone later, and found again: a first try, with its own second chance.
    r.inside.peers.delete(LATER);
    void r.inside.offerTo(LATER);
    expect(r.inside.peers.get(LATER)?.attempt).toBe(1);
  });
});
