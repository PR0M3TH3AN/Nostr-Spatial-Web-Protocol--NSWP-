import { describe, expect, it } from "vitest";
import * as nt44 from "nostr-tools/nip44";
import {
  buildHello,
  buildSignal,
  finalizeEvent,
  getConversationKey,
  getPublicKey,
  guestColor,
  nip44Decrypt,
  nip44Encrypt,
  openSignal,
  packPose,
  POSE_BYTES,
  ROOM_SIGNAL_KIND,
  roomTopic,
  shouldInitiate,
  spawnOffset,
  unpackPose,
} from "../src/index.js";
import { T0, TEST_KEY_1, TEST_KEY_2 } from "./helpers.js";

const PK1 = getPublicKey(TEST_KEY_1);
const PK2 = getPublicKey(TEST_KEY_2);

describe("NIP-44 v2", () => {
  const messages = ["a", "hello", "x".repeat(33), "ü–世界 🌍".repeat(40), "s".repeat(4000), "z".repeat(65535)];

  it("derives the same conversation key as nostr-tools, in both directions", () => {
    const ours = getConversationKey(TEST_KEY_1, PK2);
    expect(Buffer.from(ours).toString("hex")).toBe(Buffer.from(nt44.v2.utils.getConversationKey(TEST_KEY_1, PK2)).toString("hex"));
    expect(Buffer.from(getConversationKey(TEST_KEY_2, PK1)).toString("hex")).toBe(Buffer.from(ours).toString("hex"));
  });

  it("produces byte-identical ciphertext to nostr-tools for a fixed nonce", () => {
    const key = getConversationKey(TEST_KEY_1, PK2);
    const nonce = new Uint8Array(32).fill(7);
    for (const m of messages) expect(nip44Encrypt(m, key, nonce)).toBe(nt44.v2.encrypt(m, key, nonce));
  });

  it("decrypts what nostr-tools encrypts, and the reverse", () => {
    const key = getConversationKey(TEST_KEY_1, PK2);
    for (const m of messages) {
      expect(nip44Decrypt(nt44.v2.encrypt(m, key), key)).toBe(m);
      expect(nt44.v2.decrypt(nip44Encrypt(m, key), key)).toBe(m);
    }
  });

  it("rejects tampering, the wrong key and bad lengths", () => {
    const key = getConversationKey(TEST_KEY_1, PK2);
    const payload = nip44Encrypt("secret", key);
    const flipped = payload.slice(0, 60) + (payload[60] === "A" ? "B" : "A") + payload.slice(61);
    expect(() => nip44Decrypt(flipped, key)).toThrow();
    expect(() => nip44Decrypt(payload, getConversationKey(TEST_KEY_1, PK1))).toThrow();
    expect(() => nip44Encrypt("", key)).toThrow();
    expect(() => nip44Encrypt("x".repeat(65536), key)).toThrow();
    expect(() => nip44Decrypt("#notbase64", key)).toThrow();
  });
});

describe("room handshake", () => {
  const topic = roomTopic("https://world.example/", "lobby");

  it("derives topics that differ by world and by room name", () => {
    expect(topic).toMatch(/^[0-9a-f]{64}$/);
    expect(roomTopic("https://world.example/#x=1", "lobby")).toBe(topic);
    expect(roomTopic("https://world.example/", "other")).not.toBe(topic);
    expect(roomTopic("https://other.example/", "lobby")).not.toBe(topic);
  });

  it("opens a hello from someone else and ignores its own", () => {
    const hello = buildHello(topic, TEST_KEY_1, T0);
    expect(hello.kind).toBe(ROOM_SIGNAL_KIND);
    expect(openSignal(hello, TEST_KEY_2, topic, T0)?.message).toEqual({ t: "hello", v: 1 });
    expect(openSignal(hello, TEST_KEY_1, topic, T0)).toBeNull();
  });

  it("encrypts an offer so only the addressee can read it", () => {
    const offer = buildSignal(topic, TEST_KEY_1, PK2, { t: "offer", sdp: "v=0\r\nsecret-candidates" }, T0);
    expect(offer.content).not.toContain("secret-candidates");
    const opened = openSignal(offer, TEST_KEY_2, topic, T0);
    expect(opened?.from).toBe(PK1);
    expect(opened?.message).toEqual({ t: "offer", sdp: "v=0\r\nsecret-candidates" });
    const third = new Uint8Array(32).fill(9);
    expect(openSignal(offer, third, topic, T0)).toBeNull();
  });

  it("ignores the wrong topic, stale messages, tampering and malformed bodies", () => {
    const offer = buildSignal(topic, TEST_KEY_1, PK2, { t: "answer", sdp: "v=0" }, T0);
    expect(openSignal(offer, TEST_KEY_2, roomTopic("https://world.example/", "other"), T0)).toBeNull();
    expect(openSignal(offer, TEST_KEY_2, topic, T0 + 120)).toBeNull();
    expect(openSignal({ ...offer, content: offer.content.replace(/.$/, (c) => (c === "A" ? "B" : "A")) }, TEST_KEY_2, topic, T0)).toBeNull();
    const junk = finalizeEvent({ kind: ROOM_SIGNAL_KIND, created_at: T0, tags: [["x", topic]], content: JSON.stringify({ t: "offer", sdp: "public offer" }) }, TEST_KEY_1);
    expect(openSignal(junk, TEST_KEY_2, topic, T0)).toBeNull(); // an offer must be addressed and encrypted
    const huge = buildSignal(topic, TEST_KEY_1, PK2, { t: "offer", sdp: "x".repeat(20001) }, T0);
    expect(openSignal(huge, TEST_KEY_2, topic, T0)).toBeNull();
  });

  it("picks exactly one initiator per pair", () => {
    expect(shouldInitiate(PK1, PK2)).toBe(!shouldInitiate(PK2, PK1));
  });

  it("gives stable guest colours and spawn offsets", () => {
    expect(guestColor(PK1)).toBe(guestColor(PK1));
    expect(guestColor(PK1)).toBeGreaterThanOrEqual(0);
    expect(guestColor(PK1)).toBeLessThanOrEqual(0xffffff);
    const o = spawnOffset(PK1, 2);
    expect(Math.hypot(o.x, o.z)).toBeCloseTo(2, 5);
  });
});

describe("pose packets", () => {
  const head = { position: [1, 1.6, -2] as [number, number, number], quaternion: [0, 0.7071, 0, 0.7071] as [number, number, number, number] };
  const hand = { position: [0.3, 1.2, -2.2] as [number, number, number], quaternion: [0, 0, 0, 1] as [number, number, number, number] };

  it("round-trips head only, and head with hands", () => {
    const a = unpackPose(packPose({ head }));
    expect(a?.left).toBeUndefined();
    expect(a?.head.position[1]).toBeCloseTo(1.6, 5);
    const b = unpackPose(packPose({ head, right: hand }));
    expect(b?.left).toBeUndefined();
    expect(b?.right?.position[0]).toBeCloseTo(0.3, 5);
    expect(packPose({ head }).byteLength).toBe(POSE_BYTES);
  });

  it("rejects wrong sizes and hostile values", () => {
    expect(unpackPose(new ArrayBuffer(10))).toBeNull();
    const bad = new Float32Array(packPose({ head }));
    bad[0] = Number.NaN;
    expect(unpackPose(bad.buffer)).toBeNull();
    bad[0] = 1e9;
    expect(unpackPose(bad.buffer)).toBeNull();
  });
});
