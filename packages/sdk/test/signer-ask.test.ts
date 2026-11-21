import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bech32 } from "@scure/base";
import { hexToBytes } from "@noble/hashes/utils.js";
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

  it("asks them to pay an invoice this world made, and says whether what came back proves it", async () => {
    const preimage = "1a".repeat(32);
    const hashWords = bech32.toWords(sha256(hexToBytes(preimage)));
    const invoice = bech32.encode("lnbc400n", [...new Array<number>(7).fill(3), 1, hashWords.length >> 5, hashWords.length & 31, ...hashWords, ...new Array<number>(104).fill(9)], 2000);
    // Paid, with the proof: the invoice's own.
    const proven = signer.pay(`lightning:${invoice.toUpperCase()}`);
    const sent = last("pay") as { t: string; id: string; invoice?: string };
    expect(sent.invoice).toBe(invoice);
    expect(opened).not.toHaveBeenCalled();
    say({ t: "asking", id: sent.id });
    expect(opened).toHaveBeenCalledTimes(1);
    say({ t: "paid", id: sent.id, preimage });
    expect(await proven).toEqual({ preimage, proven: true });
    // Paid, with a proof that is some other payment's: handed on, and said not to prove this one.
    const wrong = signer.pay(invoice);
    say({ t: "asking", id: last("pay").id });
    say({ t: "paid", id: last("pay").id, preimage: "2b".repeat(32) });
    expect(await wrong).toEqual({ preimage: "2b".repeat(32), proven: false });
    // Paid, on the sign-in address's word alone: some wallets are given no proof.
    const bare = signer.pay(invoice);
    say({ t: "asking", id: last("pay").id });
    say({ t: "paid", id: last("pay").id });
    expect(await bare).toEqual({ preimage: null, proven: false });
    // Not paid.
    const no = signer.pay(invoice);
    say({ t: "asking", id: last("pay").id });
    say({ t: "refused", id: last("pay").id });
    expect(await no).toBeNull();
    // And nothing is asked for what isn't an invoice.
    const before = sentTo().filter((m) => m.t === "pay").length;
    expect(await signer.pay("https://example.com/pay")).toBeNull();
    expect(sentTo().filter((m) => m.t === "pay").length).toBe(before);
  });

  it("offers them a file to keep, and passes on where it is kept only for a public file that is really these bytes", async () => {
    const bytes = new TextEncoder().encode("a drawing, as bytes");
    const url = `https://files.example/${Array.from(sha256(bytes), (b) => b.toString(16).padStart(2, "0")).join("")}`;
    type Sent = { t: string; id: string; name?: string; type?: string; bytes?: Uint8Array; private?: boolean };
    // Private unless the world says otherwise; the name tidied before it is sent.
    const kept = signer.saveFile({ name: "drawings/mine.png", type: "image/png", bytes });
    const sent = last("file-save") as Sent;
    expect([sent.name, sent.type, sent.private, sent.bytes]).toEqual(["drawings mine.png", "image/png", true, bytes]);
    expect(opened).not.toHaveBeenCalled();
    say({ t: "asking", id: sent.id });
    expect(opened).toHaveBeenCalledTimes(1);
    say({ t: "file-saved", id: sent.id, name: "renamed by them.png", size: bytes.length, private: true });
    expect(await kept).toEqual({ name: "renamed by them.png", size: bytes.length, private: true, url: null });
    // Kept public, at an address that names these bytes.
    const open = signer.saveFile({ name: "mine.png", bytes, private: false });
    expect((last("file-save") as Sent).type).toBe("application/octet-stream");
    say({ t: "asking", id: last("file-save").id });
    say({ t: "file-saved", id: last("file-save").id, name: "mine.png", size: bytes.length, private: false, url });
    expect(await open).toEqual({ name: "mine.png", size: bytes.length, private: false, url });
    // Kept public, at an address that names something else: saved, and the address is not passed on.
    const odd = signer.saveFile({ name: "mine.png", bytes, private: false });
    say({ t: "asking", id: last("file-save").id });
    say({ t: "file-saved", id: last("file-save").id, name: "mine.png", size: bytes.length, private: false, url: `https://files.example/${"ab".repeat(32)}` });
    expect(await odd).toEqual({ name: "mine.png", size: bytes.length, private: false, url: null });
    // Not saved; and nothing is offered that isn't a file.
    const no = signer.saveFile({ name: "mine.png", bytes });
    say({ t: "asking", id: last("file-save").id });
    say({ t: "refused", id: last("file-save").id });
    expect(await no).toBeNull();
    const before = sentTo().filter((m) => m.t === "file-save").length;
    expect(await signer.saveFile({ name: "..", bytes })).toBeNull();
    expect(await signer.saveFile({ name: "empty.txt", bytes: new Uint8Array(0) })).toBeNull();
    expect(sentTo().filter((m) => m.t === "file-save").length).toBe(before);
  });

  it("asks them to hand over one of their files, and takes it as a name, a type and bytes", async () => {
    const bytes = new TextEncoder().encode("one of their own files");
    const url = `https://files.example/${Array.from(sha256(bytes), (b) => b.toString(16).padStart(2, "0")).join("")}.txt`;
    const picked = signer.pickFile();
    const sent = last("file-pick");
    say({ t: "asking", id: sent.id });
    expect(opened).toHaveBeenCalledTimes(1);
    say({ t: "file", id: sent.id, name: "notes/../mine.txt", type: "TEXT/PLAIN", bytes, url });
    expect(await picked).toEqual({ name: "notes .. mine.txt", type: "text/plain", bytes, url });
    // A private file comes with no address; one whose address names other bytes has it left off.
    const lone = signer.pickFile();
    say({ t: "asking", id: last("file-pick").id });
    say({ t: "file", id: last("file-pick").id, name: "mine.txt", type: "text/plain", bytes, url: `https://files.example/${"ab".repeat(32)}` });
    expect(await lone).toEqual({ name: "mine.txt", type: "text/plain", bytes, url: null });
    // They chose nothing.
    const none = signer.pickFile();
    say({ t: "asking", id: last("file-pick").id });
    say({ t: "refused", id: last("file-pick").id });
    expect(await none).toBeNull();
    // Nothing is asked while nobody is signed in here.
    say({ t: "state", unlocked: false });
    expect(await signer.pickFile()).toBeNull();
    expect(await signer.saveFile({ name: "mine.txt", bytes })).toBeNull();
  });

  it("asks them to tip a person, or this world, and hears only whether it went", async () => {
    type Sent = { t: string; id: string; to?: string; sats?: number };
    const person = "ab".repeat(32);
    const toPerson = signer.tip({ to: person, sats: 21 });
    const sent = last("tip") as Sent;
    expect([sent.to, sent.sats]).toEqual([person, 21]);
    expect(opened).not.toHaveBeenCalled();
    say({ t: "asking", id: sent.id });
    expect(opened).toHaveBeenCalledTimes(1);
    say({ t: "paid", id: sent.id });
    expect(await toPerson).toBe(true);
    // With nobody named it is for this world, and the world names no address: their sign-in address finds it.
    const toWorld = signer.tip({ sats: 100 });
    expect(Object.keys(last("tip")).sort()).toEqual(["id", "nswp", "sats", "t", "v"]);
    say({ t: "asking", id: last("tip").id });
    say({ t: "refused", id: last("tip").id });
    expect(await toWorld).toBe(false);
    // Nothing is asked that isn't a whole amount within the limits, or isn't for a key.
    const before = sentTo().filter((m) => m.t === "tip").length;
    for (const bad of [{ sats: 0 }, { sats: 1.5 }, { sats: 2_000_000 }, { sats: 21, to: "ada" }]) expect(await signer.tip(bad)).toBe(false);
    expect(sentTo().filter((m) => m.t === "tip").length).toBe(before);
  });
});
