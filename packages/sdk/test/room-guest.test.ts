import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalizeEvent, getPublicKey, guestName as coreGuestName } from "@nswp/core";

/**
 * A guest account in a room (protocol/10-identity.md, "A guest"): its pass says `["nswp:guest", "1"]`, and names
 * nobody. The owner, 2026-11-25: "a guest should be the same guest in every world". Proven by its pass, so drawn by
 * its own key, blockable by it, and called by core's `guestName` of that key, the same in every world. WebRTC is
 * stood in for: what is tested is the session's own reading of a member's pass.
 */
const WORLD = "https://world.example/";
const key = (n: number) => sha256(utf8ToBytes(`nswp room guest test key ${n}`));
let RoomSession: typeof import("../src/room.js").RoomSession;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.stubGlobal("location", { origin: "https://world.example", pathname: "/" });
  vi.stubGlobal("RTCPeerConnection", class { connectionState = "connected"; signalingState = "stable"; onconnectionstatechange = null; close() {} getTransceivers() { return []; } });
  ({ RoomSession } = await import("../src/room.js"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A pass for session `session`, signed by identity `id`, with these extra tags. */
const pass = (session: string, id: number, extra: string[][]) =>
  JSON.stringify(finalizeEvent({ kind: 27300, created_at: Math.floor(Date.now() / 1000), tags: [["nswp:session", session], ["nswp:origin", "https://world.example"], ["expiration", String(Math.floor(Date.now() / 1000) + 3600)], ...extra], content: "" }, key(id)));

function room() {
  const s = new RoomSession({ world: WORLD, relays: [] });
  const inside = s as unknown as { createPeer(pubkey: string): { member: import("../src/room.js").Member }; wirePoseChannel(peer: unknown, ch: unknown): void; checkPass(peer: unknown, text: string): void; expire(now: number): void };
  const arrive = (n: number) => {
    const session = getPublicKey(key(100 + n));
    const peer = inside.createPeer(session);
    const ch: Record<string, unknown> = { readyState: "open", send() {} };
    inside.wirePoseChannel(peer, ch);
    (ch.onopen as () => void)();
    return { peer, session, show: (id: number, extra: string[][]) => inside.checkPass(peer, pass(session, id, extra)) };
  };
  return { s, inside, arrive };
}

describe("a guest account in a room", () => {
  it("is proven by its pass, named as a guest by its own key, and marked a guest account", () => {
    const r = room();
    const them = r.arrive(1);
    them.show(1, [["nswp:guest", "1"]]);
    const m = them.peer.member;
    expect(m.guest).toBe(false);
    expect(m.identity).toBe(getPublicKey(key(1)));
    expect(m.guestAccount).toBe(true);
    // The same name in every world: core's guestName of the guest's own key, not of this visit's session key.
    expect(m.name).toBe(coreGuestName(getPublicKey(key(1))));
    expect(m.name).not.toBe(coreGuestName(them.session));
  });

  it("is told apart from an account, which keeps its own name and isn't marked", () => {
    const r = room();
    const them = r.arrive(2);
    them.show(2, [["name", "Alice"]]);
    expect([them.peer.member.name, them.peer.member.guestAccount]).toEqual(["Alice", undefined]);
  });

  it("is a guest of this visit only again once its pass runs out", () => {
    const r = room();
    const them = r.arrive(3);
    them.show(3, [["nswp:guest", "1"]]);
    r.inside.expire(Math.floor(Date.now() / 1000) + 7200);
    expect([them.peer.member.guest, them.peer.member.guestAccount, them.peer.member.identity]).toEqual([true, undefined, undefined]);
  });
});

describe("guestName", () => {
  it("is in the kit's main entry, for a page that names people itself", async () => {
    const { guestName } = await import("../src/index.js");
    expect(guestName("abcd".padEnd(64, "0"))).toBe(coreGuestName("abcd".padEnd(64, "0")));
  });
});

describe("a world that takes no guests", () => {
  it("lets a guest account go from its rooms, and keeps an account", () => {
    const s = new RoomSession({ world: WORLD, relays: [], guests: false });
    const inside = s as unknown as { createPeer(pubkey: string): { member: import("../src/room.js").Member }; wirePoseChannel(peer: unknown, ch: unknown): void; checkPass(peer: unknown, text: string): void; turnedAway: Set<string> };
    const arrive = (n: number, extra: string[][]) => {
      const session = getPublicKey(key(200 + n));
      const peer = inside.createPeer(session);
      const ch: Record<string, unknown> = { readyState: "open", send() {} };
      inside.wirePoseChannel(peer, ch);
      (ch.onopen as () => void)();
      inside.checkPass(peer, pass(session, n, extra));
      return session;
    };
    const guest = arrive(1, [["nswp:guest", "1"]]);
    const account = arrive(2, [["name", "Alice"]]);
    expect(inside.turnedAway.has(guest)).toBe(true);
    expect(s.members.map((m) => m.pubkey)).toEqual([account]);
  });

  it("lets everyone in where it says nothing", () => {
    const s = new RoomSession({ world: WORLD, relays: [] });
    const inside = s as unknown as { createPeer(pubkey: string): { member: import("../src/room.js").Member }; wirePoseChannel(peer: unknown, ch: unknown): void; checkPass(peer: unknown, text: string): void };
    const session = getPublicKey(key(301));
    const peer = inside.createPeer(session);
    const ch: Record<string, unknown> = { readyState: "open", send() {} };
    inside.wirePoseChannel(peer, ch);
    (ch.onopen as () => void)();
    inside.checkPass(peer, pass(session, 9, [["nswp:guest", "1"]]));
    expect(s.members.map((m) => m.pubkey)).toEqual([session]);
  });
});
