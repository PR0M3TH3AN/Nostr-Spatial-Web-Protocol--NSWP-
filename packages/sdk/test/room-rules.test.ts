import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRoomPass, finalizeEvent, getPublicKey } from "@nswp/core";

/**
 * A world's own rules in its rooms (protocol/06-rooms.md, "A world's own rules"; protocol/10-identity.md, "A world's
 * own lists"): the owner's block list, and a room that shows only named people. A room is WebRTC between browsers,
 * which a unit test doesn't have, so these stand a session up with stand-ins for the other members' connections and
 * hand it what a member's channel would: that it opened, their pass, the line their voice comes on. What is tested
 * is the session's own rule on each, which is all that decides who is shown and heard.
 */
const WORLD = "https://world.example/";
const key = (n: number) => sha256(utf8ToBytes(`nswp room rules test key ${n}`));
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
type Session = import("../src/room.js").RoomSession;
type Member = import("../src/room.js").Member;

let RoomSession: typeof import("../src/room.js").RoomSession;
let NAMED_WAIT_MS: number;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.stubGlobal("location", { origin: "https://world.example", pathname: "/" });
  // A stand-in for each member's connection: what the session asks of one, and nothing more.
  vi.stubGlobal("RTCPeerConnection", class {
    connectionState = "connected";
    signalingState = "stable";
    ontrack: ((e: unknown) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    close() {}
    getTransceivers() { return []; }
  });
  ({ RoomSession, NAMED_WAIT_MS } = await import("../src/room.js"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A session, and a way to have someone arrive in it, show a pass, and send a voice. */
function room(opts: { ownerBlocked?: string[]; namedOnly?: boolean; blocked?: string[]; invited?: string[] } = {}) {
  const s = new RoomSession({ world: WORLD, relays: [], ...opts }) as Session & Record<string, unknown>;
  const seen = { member: [] as string[], leave: [] as string[], audio: [] as string[], identity: [] as string[] };
  s.on("member", (m: Member) => seen.member.push(m.pubkey));
  s.on("leave", (m: Member) => seen.leave.push(m.pubkey));
  s.on("audio", (m: Member) => seen.audio.push(m.pubkey));
  s.on("identity", (m: Member) => seen.identity.push(m.pubkey));
  const internals = s as unknown as { peers: Map<string, unknown>; createPeer(pubkey: string): { pc: unknown; open: boolean; member: Member }; wirePoseChannel(peer: unknown, ch: unknown): void; checkPass(peer: unknown, text: string): void; sweep(): void; turnedAway: Set<string> };
  /** Someone joins with a session key of their own; their channel opens. */
  const arrive = (n: number) => {
    const session = key(100 + n);
    const pubkey = getPublicKey(session);
    const peer = internals.createPeer(pubkey);
    const ch: Record<string, unknown> = { readyState: "open", send() {} };
    internals.wirePoseChannel(peer, ch);
    (ch.onopen as () => void)();
    return {
      pubkey,
      /** They show a pass for the identity key `id`. */
      pass: (id: number) => internals.checkPass(peer, JSON.stringify(finalizeEvent(buildRoomPass({ session: pubkey, origin: WORLD, createdAt: Math.floor(Date.now() / 1000) }), key(id)))),
      /** Their voice arrives. */
      voice: () => (internals as unknown as { emit(e: string, m: Member, s: unknown): void }).emit("audio", peer.member, { id: `voice of ${n}` }),
    };
  };
  return { s, seen, arrive, internals, members: () => s.members.map((m) => m.pubkey) };
}

describe("the world owner's block list, in a room", () => {
  it("lets go of someone the moment their pass names a key the owner keeps out, and answers them no more", () => {
    const BLOCKED = getPublicKey(key(1));
    const r = room({ ownerBlocked: [BLOCKED] });
    const them = r.arrive(1);
    expect(r.members()).toEqual([them.pubkey]);
    them.pass(1);
    expect(r.members()).toEqual([]);
    expect(r.seen.leave).toEqual([them.pubkey]);
    expect(r.internals.turnedAway.has(them.pubkey)).toBe(true);
    // The owner's list is not the visitor's own: nothing of it is among their blocks, kept or carried on.
    expect(r.s.isBlocked(BLOCKED)).toBe(false);
    expect(r.s.isBlocked(them.pubkey)).toBe(false);
  });

  it("lets everyone else stay", () => {
    const r = room({ ownerBlocked: [getPublicKey(key(1))] });
    const them = r.arrive(2);
    them.pass(2);
    expect(r.members()).toEqual([them.pubkey]);
    expect(r.seen.leave).toEqual([]);
  });

  it("takes a change while people are here: someone newly on the list is let go at once", () => {
    const r = room();
    const them = r.arrive(3);
    them.pass(3);
    expect(r.members()).toEqual([them.pubkey]);
    r.s.setOwnerBlocked([getPublicKey(key(3))]);
    expect(r.members()).toEqual([]);
    expect(r.seen.leave).toEqual([them.pubkey]);
  });

  it("can't stop a guest, who has no name to stop: that is what named_only is for", () => {
    const r = room({ ownerBlocked: [getPublicKey(key(4))] });
    const guest = r.arrive(4);
    expect(r.members()).toEqual([guest.pubkey]);
  });
});

describe("a room in a world by invitation", () => {
  it("shows only people whose pass names someone invited, and lets anyone else go", () => {
    const invited = [getPublicKey(key(11))];
    const r = room({ invited });
    expect(r.s.namedOnly).toBe(true);
    const them = r.arrive(11);
    const other = r.arrive(12);
    them.voice();
    other.voice();
    expect(r.members()).toEqual([]);
    them.pass(11);
    other.pass(12);
    expect([r.members(), r.seen.member, r.seen.audio]).toEqual([[them.pubkey], [them.pubkey], [them.pubkey]]);
    expect(r.internals.turnedAway.has(other.pubkey)).toBe(true);
  });

  it("lets go of someone no longer invited when the list changes", () => {
    const r = room({ invited: [getPublicKey(key(13))] });
    const them = r.arrive(13);
    them.pass(13);
    expect(r.members()).toEqual([them.pubkey]);
    r.s.setInvited([]);
    expect([r.members(), r.seen.leave]).toEqual([[], [them.pubkey]]);
  });
});

describe("a room that shows only named people", () => {
  it("shows nothing of a member until their pass checks out, then that they are here and their voice", () => {
    const r = room({ namedOnly: true });
    const them = r.arrive(5);
    them.voice();
    expect([r.members(), r.seen.member, r.seen.audio]).toEqual([[], [], []]);
    them.pass(5);
    expect([r.members(), r.seen.member, r.seen.audio, r.seen.identity]).toEqual([[them.pubkey], [them.pubkey], [them.pubkey], [them.pubkey]]);
  });

  it("lets go of a member who shows no pass in time, unseen and unheard throughout", () => {
    const r = room({ namedOnly: true });
    const guest = r.arrive(6);
    guest.voice();
    vi.advanceTimersByTime(NAMED_WAIT_MS - 1000);
    r.internals.sweep();
    expect(r.internals.peers.has(guest.pubkey)).toBe(true);
    vi.advanceTimersByTime(2000);
    r.internals.sweep();
    expect(r.internals.peers.has(guest.pubkey)).toBe(false);
    expect(r.internals.turnedAway.has(guest.pubkey)).toBe(true);
    // Never shown, so never said to have left.
    expect([r.seen.member, r.seen.leave, r.seen.audio]).toEqual([[], [], []]);
  });

  it("still lets go of a named member the owner keeps out", () => {
    const r = room({ namedOnly: true, ownerBlocked: [getPublicKey(key(7))] });
    const them = r.arrive(7);
    them.pass(7);
    expect([r.members(), r.seen.member]).toEqual([[], []]);
  });

  it("is off unless the world says so: a guest is shown at once, as always", () => {
    const r = room();
    const guest = r.arrive(8);
    expect([r.members(), r.seen.member, r.s.namedOnly]).toEqual([[guest.pubkey], [guest.pubkey], false]);
    expect(hex(key(8)).length).toBe(64);
  });
});
