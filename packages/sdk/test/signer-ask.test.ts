import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanWalletUri, finalizeEvent, getPublicKey, PROPOSE_KINDS, readSignerReply, readSignerRequest, signerMessage, WORLD_TAG, type NostrEvent } from "@nswp/core";

/**
 * Asking the person (protocol/10-identity.md): a note of a careful kind, and a wallet, put to the visitor on the
 * sign-in address's own page. The signer here is a stand-in: a frame that keeps what it was sent, and is made to
 * answer.
 */
const SIGN_IN = "https://signin.example";
const WORLD = "https://world.example";
const key = sha256(utf8ToBytes("nswp ask-the-person test key"));
const other = sha256(utf8ToBytes("nswp ask-the-person someone else"));
const me = getPublicKey(key);
const WALLET = `nostr+walletconnect://${"ab".repeat(32)}?relay=wss%3A%2F%2Frelay.example&secret=${"cd".repeat(32)}`;

type Signer = import("../src/signer.js").WorldSigner;
let hear: (e: { source: unknown; origin: string; data: unknown }) => void = () => {};
let frameWindow: { postMessage: ReturnType<typeof vi.fn> };
let opened: ReturnType<typeof vi.fn>;
let signer: Signer;

const sentTo = () => frameWindow.postMessage.mock.calls.map((c) => c[0] as { t: string; id: string; event?: unknown });
const last = (t: string) => sentTo().filter((m) => m.t === t).at(-1)!;
const say = (reply: Parameters<typeof signerMessage>[0]) => hear({ source: frameWindow, origin: SIGN_IN, data: signerMessage(reply) });
const signedFor = (asked: { kind: number; content: string; tags: string[][] }, o: { by?: Uint8Array; origin?: string; content?: string } = {}): NostrEvent =>
  finalizeEvent({ kind: asked.kind, content: o.content ?? asked.content, tags: [...asked.tags, [WORLD_TAG, o.origin ?? WORLD]], created_at: 1_800_000_000 }, o.by ?? key);

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  frameWindow = { postMessage: vi.fn() };
  opened = vi.fn(() => ({}));
  const frame = { contentWindow: frameWindow, style: {}, setAttribute: () => {}, addEventListener: () => {}, remove: () => {} };
  const self = { open: opened } as unknown as Window & { parent: unknown };
  self.parent = self;
  vi.stubGlobal("window", self);
  vi.stubGlobal("document", { createElement: () => frame, body: { append: () => {} } });
  vi.stubGlobal("location", { origin: WORLD, search: "", pathname: "/" });
  vi.stubGlobal("addEventListener", (type: string, fn: typeof hear) => {
    if (type === "message") hear = fn;
  });
  const { createWorldSigner } = await import("../src/signer.js");
  signer = createWorldSigner({ at: { signer: `${SIGN_IN}/signer/`, window: `${SIGN_IN}/connect/` } } as Parameters<typeof createWorldSigner>[0]);
  await vi.advanceTimersByTimeAsync(0);
  say({ t: "ready" });
  say({ t: "state", unlocked: true, pubkey: me, name: "Test Person" });
  frameWindow.postMessage.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("asking the person: careful kinds, and a wallet", () => {
  it("names the kinds that may be put to them, and reads the words for it", () => {
    expect([...PROPOSE_KINDS]).toEqual([0, 5, 10002]);
    for (const kind of PROPOSE_KINDS) expect(readSignerRequest(signerMessage({ t: "propose", id: "r1", event: { kind, content: "", tags: [] } }))?.t, String(kind)).toBe("propose");
    // Not who they follow, not a note (that is `sign`), not a never-kind, not anything unnamed.
    for (const kind of [1, 3, 4, 7, 1059, 30078, 27235, 9999]) expect(readSignerRequest(signerMessage({ t: "propose", id: "r1", event: { kind, content: "", tags: [] } })), String(kind)).toBeNull();
    expect(readSignerRequest(signerMessage({ t: "wallet", id: "v1" }))).toEqual({ t: "wallet", id: "v1" });
    expect(readSignerReply(signerMessage({ t: "asking", id: "r1" }))).toEqual({ t: "asking", id: "r1" });
    expect(readSignerReply(signerMessage({ t: "wallet", id: "v1", uri: WALLET }))).toEqual({ t: "wallet", id: "v1", uri: WALLET });
    for (const not of ["", "https://example.com", "nostr+walletconnect://short?relay=x", `javascript:${WALLET}`, `${WALLET} and more`, "x".repeat(3000), 7, null]) expect(cleanWalletUri(not), String(not).slice(0, 40)).toBe("");
  });

  it("puts a careful note to them: the page is shown at 'asking', and what comes back is checked", async () => {
    const asked = { kind: 5, content: "posted by mistake", tags: [["e", "ab".repeat(32)]] };
    const answer = signer.propose(asked);
    const sent = last("propose");
    expect(sent.event).toEqual(asked);
    // Nothing is shown until the signer says the person is to be asked.
    expect(opened).not.toHaveBeenCalled();
    say({ t: "asking", id: sent.id });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened.mock.calls[0]![0]).toBe(`${SIGN_IN}/connect/`);
    // Said twice, the page is shown once.
    say({ t: "asking", id: sent.id });
    expect(opened).toHaveBeenCalledTimes(1);
    const signed = signedFor(asked);
    say({ t: "signed", id: sent.id, event: signed });
    expect(await answer).toEqual(signed);
  });

  it("takes nothing but exactly what was put to them, signed by who is signed in here, marked for this world", async () => {
    const asked = { kind: 0, content: JSON.stringify({ name: "Test Person" }), tags: [] as string[][] };
    for (const wrong of [signedFor(asked, { by: other }), signedFor(asked, { origin: "https://elsewhere.example" }), signedFor(asked, { content: JSON.stringify({ name: "Somebody Else" }) }), { ...signedFor(asked), sig: "00".repeat(64) }]) {
      const answer = signer.propose(asked);
      const sent = last("propose");
      say({ t: "asking", id: sent.id });
      say({ t: "signed", id: sent.id, event: wrong });
      expect(await answer).toBeNull();
    }
  });

  it("is null when they say no, when the signer doesn't do this, and when they take too long", async () => {
    const asked = { kind: 10002, content: "", tags: [["r", "wss://relay.example"]] };
    const no = signer.propose(asked);
    say({ t: "asking", id: last("propose").id });
    say({ t: "refused", id: last("propose").id });
    expect(await no).toBeNull();
    // A signer that says nothing to it: given up on in a few seconds, and no page is shown.
    opened.mockClear();
    const silent = signer.propose(asked);
    await vi.advanceTimersByTimeAsync(8100);
    expect(await silent).toBeNull();
    expect(opened).not.toHaveBeenCalled();
    // Asked, and left unanswered: as long as the sign-in address keeps the question, and no longer.
    const slow = signer.propose(asked);
    let done = false;
    void slow.then(() => (done = true));
    say({ t: "asking", id: last("propose").id });
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(await slow).toBeNull();
  });

  it("asks for nothing it may not: another kind, or while nobody is signed in here", async () => {
    expect(await signer.propose({ kind: 3, content: "", tags: [] })).toBeNull();
    expect(await signer.propose({ kind: 1, content: "hello", tags: [] })).toBeNull();
    say({ t: "state", unlocked: false });
    expect(await signer.propose({ kind: 5, content: "", tags: [] })).toBeNull();
    expect(await signer.wallet()).toBeNull();
    expect(sentTo().filter((m) => m.t === "propose" || m.t === "wallet")).toEqual([]);
  });

  it("keeps one question at a time: a new one ends the one before", async () => {
    const first = signer.propose({ kind: 5, content: "", tags: [["e", "ab".repeat(32)]] });
    const second = signer.wallet();
    expect(await first).toBeNull();
    say({ t: "asking", id: last("wallet").id });
    say({ t: "wallet", id: last("wallet").id, uri: WALLET });
    expect(await second).toBe(WALLET);
  });

  it("hands a world a wallet connection only as one, and only at their yes", async () => {
    const answer = signer.wallet();
    const sent = last("wallet");
    say({ t: "asking", id: sent.id });
    expect(opened).toHaveBeenCalledTimes(1);
    // Something that isn't a connection is nothing at all (the reply isn't even read as one).
    say({ t: "wallet", id: sent.id, uri: "https://example.com/not-a-wallet" } as Parameters<typeof signerMessage>[0]);
    say({ t: "wallet", id: sent.id, uri: WALLET });
    expect(await answer).toBe(WALLET);
  });
});
