import { describe, expect, it } from "vitest";
import {
  cleanSlot,
  finalizeEvent,
  fitsInSave,
  getConversationKey,
  getPublicKey,
  looksLikeSave,
  NEVER_KINDS,
  openSave,
  readSignerReply,
  readSignerRequest,
  SAVE_KIND,
  SAVE_LIMITS,
  saveAddress,
  sealSave,
  signClass,
  signerMessage,
  verifyEvent,
} from "../src/index.js";
import { TEST_KEY_1, TEST_KEY_2 } from "./helpers.js";

const ARCADE = "https://arcade.example";
const OTHER = "https://other.example";
const me = getPublicKey(TEST_KEY_1);
const mine = getConversationKey(TEST_KEY_1, me);
const theirs = getConversationKey(TEST_KEY_2, getPublicKey(TEST_KEY_2));
const keep = (world: string, slot: string, data: string, now = 1_800_000_000) => finalizeEvent(sealSave({ conversationKey: mine, world, slot, data, now })!, TEST_KEY_1);

describe("a save", () => {
  it("is kept and opened again by the world it is for", () => {
    const e = keep(ARCADE, "main", '{"level":3}');
    expect(e.kind).toBe(SAVE_KIND);
    expect(verifyEvent(e)).toBe(true);
    expect(openSave(e, { conversationKey: mine, pubkey: me, world: ARCADE })).toEqual({ slot: "main", data: '{"level":3}', at: 1_800_000_000 });
  });

  it("says nothing on its face about the world or what is in it", () => {
    const e = keep(ARCADE, "main", "the lantern is in the well");
    const all = JSON.stringify(e);
    expect(all).not.toContain("arcade");
    expect(all).not.toContain("lantern");
    expect(all).not.toContain("main");
    expect(e.tags.map((t) => t[0])).toEqual(["d", "alt"]);
  });

  it("is never opened for another world, whatever that world hands over", () => {
    const e = keep(ARCADE, "main", "mine");
    expect(openSave(e, { conversationKey: mine, pubkey: me, world: OTHER })).toBeNull();
    // Nor one moved to the address of the asking world's own slot.
    const moved = finalizeEvent({ ...sealSave({ conversationKey: mine, world: ARCADE, slot: "main", data: "mine", now: 1 })!, tags: [["d", saveAddress(mine, OTHER, "main")]] }, TEST_KEY_1);
    expect(openSave(moved, { conversationKey: mine, pubkey: me, world: OTHER })).toBeNull();
    // Nor one kept at an address that isn't its own slot's.
    const astray = finalizeEvent({ ...sealSave({ conversationKey: mine, world: ARCADE, slot: "main", data: "mine", now: 1 })!, tags: [["d", saveAddress(mine, ARCADE, "second")]] }, TEST_KEY_1);
    expect(openSave(astray, { conversationKey: mine, pubkey: me, world: ARCADE })).toBeNull();
  });

  it("is never opened if it is somebody else's, or not a save", () => {
    const stranger = finalizeEvent(sealSave({ conversationKey: theirs, world: ARCADE, slot: "main", data: "x", now: 1 })!, TEST_KEY_2);
    expect(openSave(stranger, { conversationKey: mine, pubkey: me, world: ARCADE })).toBeNull();
    const note = finalizeEvent({ kind: 1, created_at: 1, tags: [], content: keep(ARCADE, "main", "x").content }, TEST_KEY_1);
    expect(openSave(note, { conversationKey: mine, pubkey: me, world: ARCADE })).toBeNull();
    expect(openSave(null, { conversationKey: mine, pubkey: me, world: ARCADE })).toBeNull();
    expect(openSave({ ...keep(ARCADE, "main", "x"), content: "not encrypted" }, { conversationKey: mine, pubkey: me, world: ARCADE })).toBeNull();
  });

  it("has an address only its owner can work out, different for each world, slot and person", () => {
    const a = saveAddress(mine, ARCADE, "main");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(saveAddress(mine, ARCADE, "main")).toBe(a);
    expect(saveAddress(mine, `${ARCADE}/some/page?x=1`, "main")).toBe(a);
    expect(new Set([a, saveAddress(mine, ARCADE, "second"), saveAddress(mine, OTHER, "main"), saveAddress(theirs, ARCADE, "main")]).size).toBe(4);
    expect(saveAddress(mine, "not an address", "main")).toBe("");
    expect(saveAddress(mine, ARCADE, "Main Slot")).toBe("");
  });

  it("keeps to its limits", () => {
    expect(cleanSlot("main")).toBe("main");
    expect(cleanSlot("run-2")).toBe("run-2");
    for (const bad of ["", "Main", "-x", "a b", "a/b", "x".repeat(33), 3, null]) expect(cleanSlot(bad)).toBe("");
    expect(fitsInSave("x".repeat(SAVE_LIMITS.dataBytes))).toBe(true);
    expect(fitsInSave("x".repeat(SAVE_LIMITS.dataBytes + 1))).toBe(false);
    // The limit is in bytes: these are three each.
    expect(fitsInSave("€".repeat(Math.floor(SAVE_LIMITS.dataBytes / 3) + 1))).toBe(false);
    expect(fitsInSave(42)).toBe(false);
    expect(sealSave({ conversationKey: mine, world: ARCADE, slot: "main", data: "x".repeat(SAVE_LIMITS.dataBytes + 1), now: 1 })).toBeNull();
    expect(sealSave({ conversationKey: mine, world: ARCADE, slot: "Bad Slot", data: "x", now: 1 })).toBeNull();
    expect(sealSave({ conversationKey: mine, world: "nowhere", slot: "main", data: "x", now: 1 })).toBeNull();
    // The most a save may hold still fits in one note a relay will take.
    expect(JSON.stringify(keep(ARCADE, "main", "x".repeat(SAVE_LIMITS.dataBytes))).length).toBeLessThan(60_000);
    // An empty save is still a save: it is how a world clears a slot.
    expect(sealSave({ conversationKey: mine, world: ARCADE, slot: "main", data: "", now: 1 })).not.toBeNull();
  });

  it("is something a world can recognise without being able to read", () => {
    const e = keep(ARCADE, "main", "x");
    expect(looksLikeSave(e, me)).toBe(true);
    expect(looksLikeSave(e, getPublicKey(TEST_KEY_2))).toBe(false);
    expect(looksLikeSave({ ...e, kind: 1 }, me)).toBe(false);
    expect(looksLikeSave(null, me)).toBe(false);
  });

  it("is a kind a world can't have signed as an ordinary note", () => {
    // A world asks with `save`, and the signer writes the note: `sign` with this kind is refused like any other.
    expect(signClass(SAVE_KIND)).not.toBe("ordinary");
    // And application data stays out of a world's reach, as it was.
    expect(NEVER_KINDS).toContain(30078);
  });
});

describe("what a world and the signer say about saves", () => {
  it("reads a world's three questions, and nothing malformed", () => {
    expect(readSignerRequest(signerMessage({ t: "save", id: "s1", slot: "main", data: "x" }))).toEqual({ t: "save", id: "s1", slot: "main", data: "x" });
    expect(readSignerRequest(signerMessage({ t: "find", id: "f1", slot: "main" }))).toEqual({ t: "find", id: "f1", slot: "main" });
    const e = keep(ARCADE, "main", "x");
    expect(readSignerRequest(signerMessage({ t: "open", id: "o1", event: e }))).toEqual({ t: "open", id: "o1", event: e });
    expect(readSignerRequest(signerMessage({ t: "save", id: "s1", slot: "Bad Slot", data: "x" }))).toBeNull();
    expect(readSignerRequest(signerMessage({ t: "save", id: "s1", slot: "main", data: "x".repeat(SAVE_LIMITS.dataBytes + 1) }))).toBeNull();
    expect(readSignerRequest({ ...signerMessage({ t: "save", id: "s1", slot: "main", data: "x" }), data: 7 })).toBeNull();
    expect(readSignerRequest(signerMessage({ t: "find", id: "f1", slot: "../other" }))).toBeNull();
  });

  it("reads the signer's answers", () => {
    const d = saveAddress(mine, ARCADE, "main");
    expect(readSignerReply(signerMessage({ t: "found", id: "f1", d }))).toEqual({ t: "found", id: "f1", d });
    expect(readSignerReply({ ...signerMessage({ t: "found", id: "f1", d }), d: "somewhere" })).toBeNull();
    expect(readSignerReply(signerMessage({ t: "opened", id: "o1", slot: "main", data: "x", at: 5 }))).toEqual({ t: "opened", id: "o1", slot: "main", data: "x", at: 5 });
    expect(readSignerReply({ ...signerMessage({ t: "opened", id: "o1", slot: "main", data: "x", at: 5 }), data: { not: "text" } })).toBeNull();
  });
});
