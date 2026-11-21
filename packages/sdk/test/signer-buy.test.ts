import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalizeEvent, getPublicKey, RECEIPT_ISSUERS, signerMessage, type NostrEvent } from "@nswp/core";

/**
 * Buying, and asking what is held (protocol/10-identity.md, "Buying, and receipts"). The signer is a stand-in that
 * keeps what it was sent and is made to answer. The selling service is a stand-in too: the kit believes a receipt
 * only from a key on its list, so for these tests the list is given this test's own key. Nothing real is signed.
 */
const SIGN_IN = "https://signin.example";
const WORLD = "https://world.example";
const key = (n: number) => sha256(utf8ToBytes(`nswp buying test key ${n}`));
const service = key(1);
const me = getPublicKey(key(2));
const seller = getPublicKey(key(3));
const LISTING = `30078:${seller}:a-lantern`;
const T = Math.floor(Date.now() / 1000) - 100;
const receipt = (over: Record<string, unknown> = {}, by: Uint8Array = service): NostrEvent => {
  const doc = { schemaVersion: 1, protocolVersion: "seller-unlock-service-v1", accessPolicy: "perpetual-v1", status: "active", tenantId: "t", sellerPubkey: seller, productCoordinate: LISTING, buyerPubkey: me, orderId: "o", fulfillmentId: "f", claimEpoch: 1, paymentHashes: ["ab".repeat(32)], issuedAt: T, ...over };
  return finalizeEvent({ kind: 30078, created_at: T, tags: [["d", `bitunlock:entitlement:v1:${String(doc.fulfillmentId)}`]], content: JSON.stringify(doc) }, by);
};

type Signer = import("../src/signer.js").WorldSigner;
let hear: (e: { source: unknown; origin: string; data: unknown }) => void = () => {};
let frameWindow: { postMessage: ReturnType<typeof vi.fn> };
let opened: ReturnType<typeof vi.fn>;
let signer: Signer;
const sentTo = () => frameWindow.postMessage.mock.calls.map((c) => c[0] as { t: string; id: string; listing?: string });
const last = (t: string) => sentTo().filter((m) => m.t === t).at(-1)!;
const say = (reply: Parameters<typeof signerMessage>[0]) => hear({ source: frameWindow, origin: SIGN_IN, data: signerMessage(reply) });

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
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
  // The one selling service these tests believe is their own. The kit's list can't be changed (it is frozen, and a
  // world has no way to name an issuer), so the check itself is stood in for: the real one, told of the test's key.
  vi.doMock("@nswp/core", async (original) => {
    const core = await original<typeof import("@nswp/core")>();
    const issuers = [{ name: "Test service", service: "https://unlock.example", pubkey: getPublicKey(service) }];
    return { ...core, readReceipt: (event: unknown, expect: Parameters<typeof core.readReceipt>[1] = {}) => core.readReceipt(event, { ...expect, issuers }) };
  });
  const { createWorldSigner } = await import("../src/signer.js");
  signer = createWorldSigner({ at: { signer: `${SIGN_IN}/signer/`, window: `${SIGN_IN}/connect/` } } as Parameters<typeof createWorldSigner>[0]);
  await vi.advanceTimersByTimeAsync(0);
  say({ t: "ready" });
  say({ t: "state", unlocked: true, pubkey: me, name: "Test Person" });
  frameWindow.postMessage.mockClear();
});
afterEach(() => {
  vi.doUnmock("@nswp/core");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("buying a listing, and asking what is held", () => {
  it("can't have its list of selling services changed by whoever is using it", () => {
    expect(Object.isFrozen(RECEIPT_ISSUERS)).toBe(true);
    expect(() => (RECEIPT_ISSUERS as unknown as unknown[]).push({ name: "x", service: "https://x.example", pubkey: getPublicKey(service) })).toThrow();
  });

  it("asks them to buy: the page is shown at 'asking', and what comes back is a receipt that is checked", async () => {
    const bought = signer.buy(LISTING);
    const sent = last("buy");
    expect(sent.listing).toBe(LISTING);
    expect(opened).not.toHaveBeenCalled();
    say({ t: "asking", id: sent.id });
    expect(opened).toHaveBeenCalledTimes(1);
    const e = receipt();
    say({ t: "bought", id: sent.id, receipt: e, delivery: "a key for a sealed world" });
    expect(await bought).toMatchObject({ listing: LISTING, buyer: me, seller, expiresAt: null, fulfillment: "f", event: e, delivery: "a key for a sealed world" });
    // Nothing released: said as nothing.
    const plain = signer.buy(LISTING);
    say({ t: "asking", id: last("buy").id });
    say({ t: "bought", id: last("buy").id, receipt: e });
    expect((await plain)?.delivery).toBeNull();
  });

  it("does not believe the word 'bought': only a receipt for this listing, theirs, from a service it knows", async () => {
    for (const wrong of [
      receipt({ buyerPubkey: getPublicKey(key(9)) }),
      receipt({ productCoordinate: `30078:${seller}:something-else` }),
      receipt({}, key(8)),
      receipt({ accessPolicy: { kind: "term-v1", expiresAt: T + 1 } }),
      { ...receipt(), sig: "00".repeat(64) },
    ]) {
      const bought = signer.buy(LISTING);
      say({ t: "asking", id: last("buy").id });
      say({ t: "bought", id: last("buy").id, receipt: wrong as NostrEvent });
      expect(await bought).toBeNull();
    }
    // They said no.
    const no = signer.buy(LISTING);
    say({ t: "asking", id: last("buy").id });
    say({ t: "refused", id: last("buy").id });
    expect(await no).toBeNull();
  });

  it("asks what is held with no page and no question, and checks that too", async () => {
    const held = signer.have(LISTING);
    const sent = last("have");
    expect(sent.listing).toBe(LISTING);
    const e = receipt({ accessPolicy: { kind: "term-v1", expiresAt: T + 86_400 } });
    say({ t: "receipt", id: sent.id, receipt: e });
    expect(await held).toMatchObject({ listing: LISTING, buyer: me, expiresAt: T + 86_400, event: e });
    expect(opened).not.toHaveBeenCalled();
    // None, said plainly; and a receipt that isn't theirs is none too.
    const none = signer.have(LISTING);
    say({ t: "none", id: last("have").id });
    expect(await none).toBeNull();
    const notTheirs = signer.have(LISTING);
    say({ t: "receipt", id: last("have").id, receipt: receipt({ buyerPubkey: getPublicKey(key(9)) }) });
    expect(await notTheirs).toBeNull();
    // A signer that doesn't know the question says nothing: none, after a few seconds.
    const silent = signer.have(LISTING);
    await vi.advanceTimersByTimeAsync(8100);
    expect(await silent).toBeNull();
  });

  it("asks for nothing that isn't a listing, or while nobody is signed in here", async () => {
    for (const not of ["", "a lantern", `37300:${seller}:a-world`]) {
      expect(await signer.buy(not)).toBeNull();
      expect(await signer.have(not)).toBeNull();
    }
    say({ t: "state", unlocked: false });
    expect(await signer.buy(LISTING)).toBeNull();
    expect(await signer.have(LISTING)).toBeNull();
    expect(sentTo().filter((m) => m.t === "buy" || m.t === "have")).toEqual([]);
  });
});
