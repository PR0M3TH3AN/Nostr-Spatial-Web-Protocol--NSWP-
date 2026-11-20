import { describe, expect, it } from "vitest";
import {
  buildMessage,
  buildMessageRelays,
  cleanMessage,
  finalizeEvent,
  getConversationKey,
  getPublicKey,
  looksLikeWrap,
  MESSAGE_KIND,
  MESSAGE_LIMITS,
  MESSAGE_RELAYS_KIND,
  nip44Decrypt,
  nip44Encrypt,
  openWrap,
  readMessage,
  readMessageRelays,
  readSeal,
  SEAL_KIND,
  sealTemplate,
  signClass,
  WRAP_KIND,
  wrapSeal,
  writtenWith,
  type NostrEvent,
} from "../src/index.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { TEST_KEY_1, TEST_KEY_2 } from "./helpers.js";

const TEST_KEY_3 = sha256(utf8ToBytes("nswp message test key 3"));

const ann = getPublicKey(TEST_KEY_1);
const bo = getPublicKey(TEST_KEY_2);
const cy = getPublicKey(TEST_KEY_3);
const T = 1_800_000_000;

/** What a sender's signer does: seal the written message to the reader, and sign the seal. */
const seal = (written: unknown, from: Uint8Array, to: string, now = T): NostrEvent => finalizeEvent(sealTemplate(nip44Encrypt(JSON.stringify(written), getConversationKey(from, to)), now), from);
const send = (text: string, from: Uint8Array, to: string) => {
  const written = buildMessage({ from: getPublicKey(from), to, text, now: T })!;
  return { written, wrap: wrapSeal(seal(written, from, to), to, { now: T })! };
};

describe("a private message", () => {
  it("reaches the person it is for, and says who wrote it", () => {
    const { written, wrap } = send("See you at the Arcade?\nI'll be by the door.", TEST_KEY_1, bo);
    expect(wrap.kind).toBe(WRAP_KIND);
    expect(openWrap(wrap, TEST_KEY_2)).toEqual({ id: written.id, from: ann, to: [bo], text: "See you at the Arcade?\nI'll be by the door.", at: T });
  });

  it("is open to nobody else", () => {
    const { wrap } = send("Just for Bo.", TEST_KEY_1, bo);
    expect(openWrap(wrap, TEST_KEY_3)).toBeNull();
    // Even told it is theirs: the wrap is sealed to Bo's key.
    expect(openWrap({ ...wrap, tags: [["p", cy]] }, TEST_KEY_3)).toBeNull();
  });

  it("tells a relay who it is for, and nothing of who sent it, what it says or exactly when", () => {
    const { wrap } = send("Just for Bo.", TEST_KEY_1, bo);
    expect(wrap.pubkey).not.toBe(ann);
    expect(wrap.tags).toEqual([["p", bo]]);
    expect(JSON.stringify(wrap)).not.toContain(ann);
    expect(wrap.content).not.toContain("Just for Bo");
    expect(wrap.created_at).toBeLessThanOrEqual(T);
    expect(wrap.created_at).toBeGreaterThan(T - MESSAGE_LIMITS.backdateSec - 1);
    // A key made for the one message: another message, another key.
    expect(send("Again.", TEST_KEY_1, bo).wrap.pubkey).not.toBe(wrap.pubkey);
  });

  it("has a copy its writer can read back, wrapped for themselves", () => {
    const written = buildMessage({ from: ann, to: bo, text: "Kept for me too.", now: T })!;
    const mine = wrapSeal(seal(written, TEST_KEY_1, ann), ann, { now: T })!;
    const read = openWrap(mine, TEST_KEY_1)!;
    expect(read).toMatchObject({ from: ann, to: [bo], text: "Kept for me too." });
    expect(writtenWith(read, ann)).toBe(bo);
  });

  it("is dropped when it says it is from someone other than whoever sealed it", () => {
    // Cy writes a message that says it is from Ann, and seals it as themselves.
    const forged = buildMessage({ from: ann, to: bo, text: "Send me your key.", now: T })!;
    const wrap = wrapSeal(seal(forged, TEST_KEY_3, bo), bo, { now: T })!;
    expect(openWrap(wrap, TEST_KEY_2)).toBeNull();
  });

  it("is dropped when the reader is neither its writer nor someone it is to", () => {
    // A real message from Ann to Cy, wrapped again for Bo by someone who got hold of the seal's text.
    const written = buildMessage({ from: ann, to: cy, text: "For Cy.", now: T })!;
    expect(openWrap(wrapSeal(seal(written, TEST_KEY_1, bo), bo, { now: T })!, TEST_KEY_2)).toBeNull();
  });

  it("is dropped when the seal isn't a seal", () => {
    const written = buildMessage({ from: ann, to: bo, text: "Hello.", now: T })!;
    const good = seal(written, TEST_KEY_1, bo);
    const tagged = finalizeEvent({ ...sealTemplate(good.content, T), tags: [["p", bo]] }, TEST_KEY_1);
    expect(wrapSeal(tagged, bo, { now: T })).toBeNull();
    expect(readSeal(JSON.stringify(tagged))).toBeNull();
    expect(readSeal(JSON.stringify({ ...good, sig: "0".repeat(128) }))).toBeNull();
    expect(readSeal(JSON.stringify({ ...good, kind: 1 }))).toBeNull();
    expect(readSeal("not json")).toBeNull();
    expect(readSeal(JSON.stringify(good))?.id).toBe(good.id);
  });

  it("is only ever a written message with words in it", () => {
    const s = { pubkey: ann };
    const ok = { kind: MESSAGE_KIND, pubkey: ann, created_at: T, tags: [["p", bo]], content: "Hello." };
    expect(readMessage(JSON.stringify(ok), s, bo)?.text).toBe("Hello.");
    for (const bad of [{ ...ok, kind: 1 }, { ...ok, kind: 15 }, { ...ok, content: "   " }, { ...ok, content: 5 }, { ...ok, tags: [] }, { ...ok, tags: [["p", "nobody"]] }, { ...ok, tags: "p" }, { ...ok, created_at: "now" }]) {
      expect(readMessage(JSON.stringify(bad), s, bo), JSON.stringify(bad)).toBeNull();
    }
    expect(readMessage("[]", s, bo)).toBeNull();
    expect(readMessage("null", s, bo)).toBeNull();
  });

  it("takes its id from what it says, never from what it claims", () => {
    const written = buildMessage({ from: ann, to: bo, text: "Hello.", now: T })!;
    const lying = { ...written, id: "f".repeat(64) };
    expect(readMessage(JSON.stringify(lying), { pubkey: ann }, bo)?.id).toBe(written.id);
  });

  it("is not written to oneself, to nobody, or with nothing to say", () => {
    expect(buildMessage({ from: ann, to: ann, text: "Hello.", now: T })).toBeNull();
    expect(buildMessage({ from: ann, to: "nobody", text: "Hello.", now: T })).toBeNull();
    expect(buildMessage({ from: ann, to: bo, text: " \n ", now: T })).toBeNull();
  });

  it("says which conversation it belongs to", () => {
    expect(writtenWith({ from: ann, to: [bo] }, bo)).toBe(ann);
    expect(writtenWith({ from: ann, to: [bo] }, ann)).toBe(bo);
    expect(writtenWith({ from: ann, to: [bo, cy] }, bo)).toBe("");
  });

  it("looks like a wrap only when it is one, for this reader", () => {
    const { wrap } = send("Hello.", TEST_KEY_1, bo);
    expect(looksLikeWrap(wrap, bo)).toBe(true);
    expect(looksLikeWrap(wrap, cy)).toBe(false);
    expect(looksLikeWrap({ ...wrap, kind: 1 }, bo)).toBe(false);
    expect(looksLikeWrap({ ...wrap, content: wrap.content + "A" }, bo)).toBe(false);
  });

  it("can be made the same twice, for the vectors", () => {
    const written = buildMessage({ from: ann, to: bo, text: "Hello.", now: T })!;
    const fixed = { now: T, secretKey: TEST_KEY_3, nonce: new Uint8Array(32).fill(7), random: 0.5 };
    const s = finalizeEvent(sealTemplate(nip44Encrypt(JSON.stringify(written), getConversationKey(TEST_KEY_1, bo), new Uint8Array(32).fill(9)), T), TEST_KEY_1, new Uint8Array(32));
    const a = wrapSeal(s, bo, fixed)!;
    expect(a.pubkey).toBe(cy);
    expect(a.created_at).toBe(T - MESSAGE_LIMITS.backdateSec / 2);
    expect(wrapSeal(s, bo, fixed)!.content).toBe(a.content);
    expect(JSON.parse(nip44Decrypt(a.content, getConversationKey(TEST_KEY_2, cy)))).toEqual(s);
  });
});

describe("a message's words", () => {
  it("are plain text with their lines kept", () => {
    expect(cleanMessage("  one\r\n two \n\n\n\n three\t!  ")).toBe("one\ntwo\n\nthree !");
    expect(cleanMessage("a‮b​c")).toBe("a b c");
    expect(cleanMessage(5)).toBe("");
    expect([...cleanMessage("x".repeat(5000))].length).toBe(MESSAGE_LIMITS.chars);
  });
});

describe("where someone's messages reach them", () => {
  const relays = (tags: string[][], at = T) => finalizeEvent({ kind: MESSAGE_RELAYS_KIND, created_at: at, tags, content: "" }, TEST_KEY_1);

  it("is the few relays their newest list names", () => {
    const old = relays([["relay", "wss://old.example"]]);
    const newer = relays([["relay", "wss://a.example/"], ["relay", "ws://plain.example"], ["r", "wss://not-this-tag.example"], ["relay", "wss://a.example"], ["relay", "wss://b.example"]], T + 1);
    expect(readMessageRelays([old, newer], ann)).toEqual(["wss://a.example", "wss://b.example"]);
    expect(readMessageRelays([old, newer], bo)).toEqual([]);
  });

  it("is written as a list of them", () => {
    expect(buildMessageRelays(["wss://a.example", "nonsense", "wss://a.example"], T)).toEqual({ kind: MESSAGE_RELAYS_KIND, created_at: T, tags: [["relay", "wss://a.example"]], content: "" });
    expect(buildMessageRelays([], T)).toBeNull();
  });
});

describe("a world", () => {
  it("never has any of it signed for it", () => {
    for (const kind of [MESSAGE_KIND, SEAL_KIND, WRAP_KIND]) expect(signClass(kind)).toBe("never");
    expect(signClass(MESSAGE_RELAYS_KIND)).toBe("careful");
  });
});
