import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVATAR_KIND, buildRoomPass, finalizeEvent, getPublicKey, LOOK_NOTE_LIMIT } from "@nswp/core";

/**
 * A member's own model, handed over in a room (NSWP-06, the `avatar` message): their signed look note, believed only
 * once their pass names the key that signed it. As in room-rules.test.ts, a session is stood up with stand-ins for
 * the other members' connections and handed what a channel would.
 */
const WORLD = "https://world.example/";
const key = (n: number) => sha256(utf8ToBytes(`nswp room avatar test key ${n}`));
const SHA = "d".repeat(64);
type Member = import("../src/room.js").Member;
let RoomSession: typeof import("../src/room.js").RoomSession;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.stubGlobal("location", { origin: "https://world.example", pathname: "/" });
  vi.stubGlobal("RTCPeerConnection", class {
    connectionState = "connected";
    signalingState = "stable";
    close() {}
    getTransceivers() { return []; }
  });
  ({ RoomSession } = await import("../src/room.js"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const note = (by: number, extra: string[][] = []) => finalizeEvent({ kind: AVATAR_KIND, created_at: 1_800_000_000, tags: [["d", "default"], ["model", `https://files.example/${SHA}.vrm`, "vrm", SHA], ["height", "2.1"], ...extra], content: "" }, key(by));
const pass = (session: string, by: number) => finalizeEvent(buildRoomPass({ session, origin: WORLD, createdAt: Math.floor(Date.now() / 1000) }), key(by));

function room(opts: Record<string, unknown> = {}) {
  const s = new RoomSession({ world: WORLD, relays: [], ...opts });
  const looks: Member[] = [];
  s.on("look", (m: Member) => looks.push({ ...m }));
  const internals = s as unknown as { createPeer(pubkey: string): { member: Member }; wirePoseChannel(peer: unknown, ch: unknown): void; checkPass(peer: unknown, text: string): void };
  const arrive = (n: number) => {
    const pubkey = getPublicKey(key(100 + n));
    const peer = internals.createPeer(pubkey);
    const ch: Record<string, unknown> = { readyState: "open", send() {} };
    internals.wirePoseChannel(peer, ch);
    (ch.onopen as () => void)();
    const say = (text: string) => (ch.onmessage as (e: { data: string }) => void)({ data: text });
    return { member: peer.member, avatar: (by: number) => say(`avatar:${JSON.stringify(note(by))}`), say, pass: (by: number) => internals.checkPass(peer, JSON.stringify(pass(pubkey, by))) };
  };
  return { s, looks, arrive };
}

describe("a member's own model, in a room", () => {
  it("counts once their pass names the key that signed their look note, whichever comes first", () => {
    const r = room();
    const ada = r.arrive(1);
    ada.avatar(1);
    // A guest so far: their note isn't believed of anyone yet.
    expect(ada.member.model).toBeUndefined();
    ada.pass(1);
    expect(ada.member.model).toEqual({ url: `https://files.example/${SHA}.vrm`, format: "vrm", sha256: SHA, height: 2.1 });
    expect(r.looks.at(-1)?.model?.sha256).toBe(SHA);
    const ben = r.arrive(2);
    ben.pass(2);
    ben.avatar(2);
    expect(ben.member.model?.sha256).toBe(SHA);
  });

  it("is never someone else's: a note signed by another key, a forged one, or one too large, counts for nothing", () => {
    const r = room();
    const cara = r.arrive(3);
    cara.pass(3);
    cara.avatar(4);
    expect(cara.member.model).toBeUndefined();
    const forged = { ...note(3), tags: [["d", "default"], ["model", "https://files.example/x.vrm", "vrm", "e".repeat(64)]] };
    cara.say(`avatar:${JSON.stringify(forged)}`);
    expect(cara.member.model).toBeUndefined();
    cara.say(`avatar:${JSON.stringify(note(3, [["alt", "x".repeat(LOOK_NOTE_LIMIT)]]))}`);
    expect(cara.member.model).toBeUndefined();
    cara.say("avatar:not json");
    expect(cara.member.model).toBeUndefined();
  });

  it("is handed to each member only by someone who came by name, with a note of their own", () => {
    const sessionKey = key(200);
    const session = getPublicKey(sessionKey);
    const mine = room({ identity: { pass: pass(session, 5), sessionKey: bytesToHex(sessionKey) }, avatar: note(5) });
    expect(mine.s.self.model?.sha256).toBe(SHA);
    const sent: string[] = [];
    const internals = mine.s as unknown as { introduce(ch: unknown): void };
    internals.introduce({ readyState: "open", send: (t: string) => sent.push(t) });
    expect(sent.some((t) => t.startsWith("avatar:"))).toBe(true);
    // Someone else's note, with their own pass: not sent.
    const other = room({ identity: { pass: pass(session, 5), sessionKey: bytesToHex(sessionKey) }, avatar: note(6) });
    expect(other.s.self.model).toBeUndefined();
    // A guest: not sent.
    const guest = room({ avatar: note(5) });
    expect(guest.s.self.model).toBeUndefined();
  });
});
