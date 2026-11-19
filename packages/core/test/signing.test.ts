import { describe, expect, it } from "vitest";
import {
  cleanOrigin,
  createSignGate,
  finalizeEvent,
  handoffMessage,
  isWhatWasAsked,
  NEVER_KINDS,
  prepareForWorld,
  readHandoffMessage,
  readSignerReply,
  readSignerRequest,
  SIGN_LIMITS,
  signClass,
  signerAddresses,
  signerAt,
  buildArrivalUrl,
  decodeArrival,
  arrivalParam,
  signerMessage,
  WORLD_TAG,
} from "../src/index.js";
import { TEST_KEY_1 } from "./helpers.js";

const WORLD = "https://museum.example";

describe("which notes a world may have signed", () => {
  it("is a note and a reaction, once the visitor has said yes", () => {
    expect(signClass(1)).toBe("ordinary");
    expect(signClass(7)).toBe("ordinary");
  });

  it("is never what proves who they are, reads their messages, moves their money or is their client's own", () => {
    for (const kind of [4, 13, 14, 1059, 13194, 22242, 23194, 24133, 27235, 27300, 27301, 30078]) expect(signClass(kind), String(kind)).toBe("never");
    for (const kind of NEVER_KINDS) expect(signClass(kind)).toBe("never");
    for (const not of [-1, 1.5, 70000, "1", null, undefined, NaN]) expect(signClass(not)).toBe("never");
  });

  it("is with their say each time for what rewrites what they have: a profile, who they follow, a relay list, a deletion", () => {
    for (const kind of [0, 3, 5, 6, 10002, 30023, 9734, 9735, 31922]) expect(signClass(kind), String(kind)).toBe("careful");
  });
});

describe("a note as it is signed for a world", () => {
  it("is marked with the world that asked, and dated by the signer", () => {
    const ready = prepareForWorld({ kind: 1, content: "Hello from the east wing", tags: [["t", "museum"]], created_at: 5, pubkey: "x" }, `${WORLD}/hall?x=1`, 1_794_430_800.9);
    expect(ready).toEqual({ kind: 1, created_at: 1_794_430_800, content: "Hello from the east wing", tags: [["t", "museum"], [WORLD_TAG, WORLD]] });
  });

  it("drops a mark of the world's own making", () => {
    const ready = prepareForWorld({ kind: 1, content: "hi", tags: [[WORLD_TAG, "https://somewhere-trusted.example"], ["t", "a"]] }, WORLD, 10);
    expect(ready!.tags).toEqual([["t", "a"], [WORLD_TAG, WORLD]]);
  });

  it("is nothing for a kind that isn't ordinary, whatever the rest says", () => {
    for (const kind of [0, 3, 4, 5, 10002, 27300, 30078, 9734]) expect(prepareForWorld({ kind, content: "", tags: [] }, WORLD, 10), String(kind)).toBeNull();
  });

  it("is nothing for anything misshapen or too large", () => {
    const ok = { kind: 1, content: "hi", tags: [] as unknown[] };
    expect(prepareForWorld(ok, WORLD, 10)).not.toBeNull();
    expect(prepareForWorld({ ...ok, content: "x".repeat(SIGN_LIMITS.contentChars + 1) }, WORLD, 10)).toBeNull();
    expect(prepareForWorld({ ...ok, content: 7 }, WORLD, 10)).toBeNull();
    expect(prepareForWorld({ ...ok, tags: "t" }, WORLD, 10)).toBeNull();
    expect(prepareForWorld({ ...ok, tags: [["t", 7]] }, WORLD, 10)).toBeNull();
    expect(prepareForWorld({ ...ok, tags: [[]] }, WORLD, 10)).toBeNull();
    expect(prepareForWorld({ ...ok, tags: [["t", "x".repeat(SIGN_LIMITS.tagChars + 1)]] }, WORLD, 10)).toBeNull();
    expect(prepareForWorld({ ...ok, tags: Array.from({ length: SIGN_LIMITS.tags + 1 }, () => ["t", "a"]) }, WORLD, 10)).toBeNull();
    expect(prepareForWorld(ok, "javascript:alert(1)", 10)).toBeNull();
    expect(prepareForWorld(ok, "", 10)).toBeNull();
    expect(prepareForWorld(null, WORLD, 10)).toBeNull();
  });

  it("can be told from a note that wasn't the one asked for", () => {
    const asked = { kind: 1, content: "hi", tags: [["t", "a"]] };
    const signed = finalizeEvent(prepareForWorld(asked, WORLD, 10)!, TEST_KEY_1);
    expect(isWhatWasAsked(asked, signed)).toBe(true);
    expect(isWhatWasAsked({ ...asked, content: "hi!" }, signed)).toBe(false);
    expect(isWhatWasAsked({ ...asked, kind: 7 }, signed)).toBe(false);
    expect(isWhatWasAsked({ ...asked, tags: [] }, signed)).toBe(false);
  });
});

describe("how much is signed for one world", () => {
  it("is a few in a minute and no more", () => {
    const gate = createSignGate();
    for (let i = 0; i < SIGN_LIMITS.burst; i++) expect(gate.take(i * 100)).toBe(true);
    expect(gate.take(1000)).toBe(false);
    expect(gate.take(SIGN_LIMITS.perMs + 700)).toBe(true);
  });

  it("is so many in an hour and no more", () => {
    const gate = createSignGate();
    let signed = 0;
    for (let t = 0; t < 3_600_000; t += 11_000) if (gate.take(t)) signed++;
    expect(signed).toBe(SIGN_LIMITS.hourly);
    expect(gate.take(3_599_999)).toBe(false);
    expect(gate.take(3_600_000 + 12_000)).toBe(true);
  });
});

describe("where a client's signer is", () => {
  it("is beside its Airlock", () => {
    expect(signerAddresses("https://client.example/go/")).toEqual({ origin: "https://client.example", signer: "https://client.example/signer/", window: "https://client.example/connect/" });
    expect(signerAddresses("https://client.example/app/go/#to=x")).toMatchObject({ signer: "https://client.example/app/signer/", window: "https://client.example/app/connect/" });
  });

  it("is nowhere for an Airlock that isn't an https address, or for none", () => {
    for (const not of ["http://client.example/go/", "javascript:alert(1)", "", null, undefined, "nonsense"]) expect(signerAddresses(not)).toBeNull();
  });
});

describe("a place, as it may be named", () => {
  it("is an origin and nothing more", () => {
    expect(cleanOrigin("https://museum.example/hall?x=1#y")).toBe("https://museum.example");
    expect(cleanOrigin("http://localhost:4303/")).toBe("http://localhost:4303");
    for (const not of ["javascript:alert(1)", "data:text/html,x", "null", "", 7, null, "file:///etc/passwd", `https://${"a".repeat(400)}.example`]) expect(cleanOrigin(not)).toBe("");
  });
});

describe("how fast a world may have notes signed", () => {
  it("is the pace of a person: three a minute, twenty an hour", () => {
    expect(SIGN_LIMITS.burst).toBe(3);
    expect(SIGN_LIMITS.perMs).toBe(60_000);
    expect(SIGN_LIMITS.hourly).toBe(20);
  });

  it("counts a pass apart from notes, so signing in doesn't use up a post", () => {
    expect(SIGN_LIMITS.passBurst).toBe(2);
    expect(SIGN_LIMITS.passHourly).toBe(10);
  });
});

describe("what a world and the signer say to each other", () => {
  it("is read back as it was sent", () => {
    expect(readSignerRequest(signerMessage({ t: "state", id: "a1" }))).toEqual({ t: "state", id: "a1" });
    const ask = { t: "sign" as const, id: "a2", event: { kind: 1, content: "hi", tags: [] } };
    expect(readSignerRequest(signerMessage(ask))).toEqual(ask);
    expect(readSignerReply(signerMessage({ t: "ready" }))).toEqual({ t: "ready" });
    expect(readSignerReply(signerMessage({ t: "refused", id: "a2" }))).toEqual({ t: "refused", id: "a2" });
    const pubkey = "ab".repeat(32);
    expect(readSignerReply(signerMessage({ t: "state", id: "a1", unlocked: true, pubkey, name: "  Alice\n", until: 99 }))).toEqual({ t: "state", id: "a1", unlocked: true, pubkey, name: "Alice", until: 99 });
  });

  it("asks for a pass with a session key and nothing else", () => {
    const session = "cd".repeat(32);
    expect(readSignerRequest(signerMessage({ t: "pass", id: "p1", session }))).toEqual({ t: "pass", id: "p1", session });
    // Whatever else a world writes beside it is not read: the signer writes the rest of a pass.
    expect(readSignerRequest({ ...signerMessage({ t: "pass", id: "p1", session }), name: "Somebody else", origin: "https://other.example" })).toEqual({ t: "pass", id: "p1", session });
    for (const not of ["", "CD".repeat(32), "cd".repeat(31), 5, undefined]) expect(readSignerRequest({ nswp: "nswp-signer", v: 1, t: "pass", id: "p1", session: not })).toBeNull();
  });

  it("reads who the signer says they are, cleaned as a pass's words are", () => {
    const pubkey = "ab".repeat(32);
    const said = readSignerReply(signerMessage({ t: "state", id: "a1", unlocked: true, pubkey, name: "Alice", picture: "https://pics.example/a.png", about: "  Builds\nworlds.  " }));
    expect(said).toEqual({ t: "state", id: "a1", unlocked: true, pubkey, name: "Alice", picture: "https://pics.example/a.png", about: "Builds worlds." });
    // Only an https address is a picture, and a locked signer says nothing of anybody.
    expect(readSignerReply(signerMessage({ t: "state", unlocked: true, pubkey, picture: "http://pics.example/a.png" }))).toEqual({ t: "state", unlocked: true, pubkey });
    expect(readSignerReply({ nswp: "nswp-signer", v: 1, t: "state", unlocked: false, picture: "https://pics.example/a.png", about: "words" })).toEqual({ t: "state", unlocked: false });
  });

  it("never reads a signer as unlocked without saying whose key it holds", () => {
    expect(readSignerReply(signerMessage({ t: "state", unlocked: true }))).toEqual({ t: "state", unlocked: false });
    expect(readSignerReply(signerMessage({ t: "state", unlocked: true, pubkey: "not-a-key" }))).toEqual({ t: "state", unlocked: false });
  });

  it("reads nothing else", () => {
    for (const not of [null, "state", {}, { t: "state", id: "a" }, { nswp: "nswp-signer", v: 2, t: "state", id: "a" }, { nswp: "other", v: 1, t: "state", id: "a" }, signerMessage({ t: "state", id: "has spaces" }), signerMessage({ t: "sign", id: "a" } as never)]) {
      expect(readSignerRequest(not)).toBeNull();
    }
    expect(readSignerReply({ nswp: "nswp-signer", v: 1, t: "signed", id: "a" })).toBeNull();
    expect(readSignerReply({ nswp: "nswp-signer", v: 1, t: "state" })).toBeNull();
  });
});

describe("what the client's window and its signer say to each other", () => {
  const key = "cd".repeat(32);
  it("is read back as it was sent", () => {
    expect(readHandoffMessage(handoffMessage({ t: "hello", nonce: "n1" }))).toEqual({ t: "hello", nonce: "n1" });
    expect(readHandoffMessage(handoffMessage({ t: "frame", nonce: "n1", world: `${WORLD}/x`, recipient: key }))).toEqual({ t: "frame", nonce: "n1", world: WORLD, recipient: key });
    const grant = { t: "grant" as const, nonce: "n1", world: WORLD, sealed: { senderPublicKey: key, payload: "ciphertext" }, name: "Alice" };
    expect(readHandoffMessage(handoffMessage(grant))).toEqual(grant);
    expect(readHandoffMessage(handoffMessage({ t: "done", nonce: "n1", ok: true }))).toEqual({ t: "done", nonce: "n1", ok: true });
  });

  it("reads nothing misshapen", () => {
    expect(readHandoffMessage(handoffMessage({ t: "frame", nonce: "n1", world: "javascript:x", recipient: key }))).toBeNull();
    expect(readHandoffMessage(handoffMessage({ t: "frame", nonce: "n1", world: WORLD, recipient: "short" }))).toBeNull();
    expect(readHandoffMessage(handoffMessage({ t: "grant", nonce: "n1", world: WORLD, sealed: { senderPublicKey: "x", payload: "y" } }))).toBeNull();
    expect(readHandoffMessage(handoffMessage({ t: "grant", nonce: "n1", world: WORLD, sealed: { senderPublicKey: key, payload: "y".repeat(4001) } }))).toBeNull();
    expect(readHandoffMessage({ ...handoffMessage({ t: "hello", nonce: "n1" }), nswp: "nswp-signer" })).toBeNull();
    expect(readHandoffMessage(signerMessage({ t: "state", id: "a" }))).toBeNull();
  });
});

describe("a signer the client names in the arrival", () => {
  it("is at signer/ and connect/ under the address given", () => {
    expect(signerAt("https://bitlogin.network/")).toEqual({ origin: "https://bitlogin.network", signer: "https://bitlogin.network/signer/", window: "https://bitlogin.network/connect/" });
    expect(signerAt("https://bitlogin.network")).toMatchObject({ signer: "https://bitlogin.network/signer/" });
    expect(signerAt("https://sign.example/id?x=1#y")).toMatchObject({ signer: "https://sign.example/id/signer/", window: "https://sign.example/id/connect/" });
  });

  it("is nowhere for anything but an https address", () => {
    for (const not of ["http://sign.example/", "javascript:alert(1)", "https://user:pw@sign.example/", "", null, undefined, "nonsense", `https://sign.example/${"a".repeat(400)}`]) expect(signerAt(not)).toBeNull();
  });

  it("travels in an arrival, and anything else in its place is dropped", () => {
    const made = buildArrivalUrl("https://museum.example/", { airlock: "https://client.example/go/", signer: "https://bitlogin.network/" });
    const read = decodeArrival(arrivalParam(new URL(made).hash)!);
    expect(read.ok && read.value.signer).toBe("https://bitlogin.network/");
    for (const bad of ["http://plain.example/", "javascript:alert(1)", 7, `https://x.example/${"a".repeat(400)}`]) {
      const forged = Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", airlock: "https://client.example/go/", signer: bad })).toString("base64url");
      const r = decodeArrival(forged);
      expect(r.ok && r.value.signer).toBeUndefined();
      expect(r.ok && r.value.airlock).toBe("https://client.example/go/");
    }
  });
});
