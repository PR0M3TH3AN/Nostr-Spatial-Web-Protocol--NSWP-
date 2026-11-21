import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { cleanLightningAddress, cleanListing, cleanTip, finalizeEvent, getPublicKey, listingSeller, readReceipt, readSignerReply, readSignerRequest, RECEIPT_ISSUERS, signerMessage, type NostrEvent, type ReceiptIssuer } from "../src/index.js";

const key = (n: number) => sha256(utf8ToBytes(`nswp receipt test key ${n}`));
const pk = (n: number) => getPublicKey(key(n));
// A selling service for the test: receipts are believed only from a key on a list, so the test names its own.
const SERVICE: ReceiptIssuer = { name: "Test service", service: "https://unlock.example", pubkey: pk(1) };
const ISSUERS = [SERVICE];
const SELLER = pk(2);
const BUYER = pk(3);
const LISTING = `30078:${SELLER}:a-lantern`;
const T = 1_800_000_000;
/** A receipt as BitUnlock makes one: its whole meaning in the content, and one tag, its own name. */
const receipt = (over: Record<string, unknown> = {}, o: { by?: Uint8Array; d?: string; kind?: number } = {}): NostrEvent => {
  const doc = { schemaVersion: 1, protocolVersion: "seller-unlock-service-v1", accessPolicy: "perpetual-v1", status: "active", tenantId: "tenant-1", sellerPubkey: SELLER, productCoordinate: LISTING, buyerPubkey: BUYER, orderId: "order-1", fulfillmentId: "ful-1", claimEpoch: 1, paymentHashes: ["ab".repeat(32)], issuedAt: T, ...over };
  return finalizeEvent({ kind: o.kind ?? 30078, created_at: T, tags: [["d", o.d ?? `bitunlock:entitlement:v1:${String(doc.fulfillmentId)}`]], content: JSON.stringify(doc) }, o.by ?? key(1));
};
const read = (e: unknown, expect: Parameters<typeof readReceipt>[1] = {}) => readReceipt(e, { issuers: ISSUERS, ...expect });

describe("a receipt: who bought what, and until when", () => {
  it("believes BitUnlock, by the key read from its own signed policy, and nobody else out of the box", () => {
    expect(RECEIPT_ISSUERS.map((i) => [i.name, i.service, i.pubkey])).toEqual([["BitUnlock", "https://api.bitunlock.network", "66be61cf5b8d286391f7b1a72ffa7c799ec2dc49eff0830c40df1cc964e6787d"]]);
    // A perfectly good receipt from a service that isn't on the list is not one.
    expect(readReceipt(receipt())).toEqual({ ok: false, why: "unknown-issuer" });
  });

  it("reads one bought for good, and one bought for a time", () => {
    expect(read(receipt(), { listing: LISTING, buyer: BUYER, now: T + 10 })).toEqual({ ok: true, receipt: { issuer: SERVICE, listing: LISTING, buyer: BUYER, seller: SELLER, issuedAt: T, expiresAt: null, fulfillment: "ful-1" } });
    const term = receipt({ accessPolicy: { kind: "term-v1", expiresAt: T + 86400 } });
    expect(read(term, { now: T + 100 })).toMatchObject({ ok: true, receipt: { expiresAt: T + 86400 } });
    // On the second it stops, it has stopped.
    expect(read(term, { now: T + 86400 })).toEqual({ ok: false, why: "run-out" });
    // A renewal names the one before it, and reads the same.
    expect(read(receipt({ accessPolicy: { kind: "term-v1", expiresAt: T + 9, renewalOfFulfillmentId: "ful-0" } }), { now: T })).toMatchObject({ ok: true });
  });

  it("is for one listing and one buyer, and says so when asked about another", () => {
    expect(read(receipt(), { listing: `30078:${SELLER}:something-else` })).toEqual({ ok: false, why: "other-listing" });
    expect(read(receipt(), { buyer: pk(9) })).toEqual({ ok: false, why: "other-buyer" });
    // Asked about neither, it is simply read.
    expect(read(receipt()).ok).toBe(true);
  });

  it("is not one unless it is really signed, in the form this knows, under its own right name", () => {
    const good = receipt();
    expect(read({ ...good, sig: "00".repeat(64) })).toEqual({ ok: false, why: "not-signed" });
    // The words changed after signing.
    expect(read({ ...good, content: good.content.replace(BUYER, pk(9)) })).toEqual({ ok: false, why: "not-signed" });
    for (const [name, bad] of Object.entries({
      "another kind": receipt({}, { kind: 1 }),
      "filed under another receipt's name": receipt({}, { d: "bitunlock:entitlement:v1:ful-2" }),
      "another form": receipt({ schemaVersion: 2 }),
      "another protocol": receipt({ protocolVersion: "something-else" }),
      "not active": receipt({ status: "revoked" }),
      "no listing": receipt({ productCoordinate: "30078:nobody:x" }),
      "a seller who isn't the listing's": receipt({ sellerPubkey: pk(8) }),
      "no buyer": receipt({ buyerPubkey: "someone" }),
      "no name of its own": receipt({ fulfillmentId: "" }),
      "a time before it was signed": receipt({ accessPolicy: { kind: "term-v1", expiresAt: T } }),
      "a policy nobody knows": receipt({ accessPolicy: { kind: "until-i-say" } }),
      "a policy that is a word nobody knows": receipt({ accessPolicy: "forever-v9" }),
    })) expect(read(bad), name).toEqual({ ok: false, why: "not-a-receipt" });
    for (const not of [null, undefined, "receipt", 7, {}, { kind: 30078 }, []]) expect(read(not).ok).toBe(false);
  });

  it("reads something the seller gave away as a receipt like any other", () => {
    // No payment was made, so it names none: it is still the service's word that this key holds this listing.
    expect(read(receipt({ settlementBasis: "voucher", paymentHashes: [] }), { listing: LISTING, buyer: BUYER }).ok).toBe(true);
  });

  it("never changes what it was handed", () => {
    const e = receipt();
    const before = JSON.stringify(e);
    read(e, { listing: LISTING, buyer: BUYER });
    expect(JSON.stringify(e)).toBe(before);
  });

  it("knows a listing's coordinate, and whose it is", () => {
    expect(cleanListing(LISTING)).toBe(LISTING);
    expect(listingSeller(LISTING)).toBe(SELLER);
    expect(cleanListing(`30078:${SELLER}:a name with spaces`)).toBe(`30078:${SELLER}:a name with spaces`);
    // As long a name as the selling service takes, and no longer; and never one that begins with a colon.
    expect(cleanListing(`30078:${SELLER}:${"x".repeat(256)}`)).not.toBe("");
    for (const not of ["", `37300:${SELLER}:a-world`, `30078:${SELLER.toUpperCase()}:x`, `30078:${SELLER}:`, `30078:${SELLER}::x`, `30078:short:x`, `30078:${SELLER}:two\nlines`, `30078:${SELLER}:${"x".repeat(257)}`, 7, null]) {
      expect(cleanListing(not), String(not).slice(0, 40)).toBe("");
      expect(listingSeller(not)).toBe("");
    }
  });

  it("knows a lightning address and an amount for a tip", () => {
    expect(cleanLightningAddress(" Ada@Wallet.Example ")).toBe("ada@wallet.example");
    for (const not of ["", "ada", "ada@", "@wallet.example", "ada@localhost", "ada smith@wallet.example", "ada@wallet.example/pay", "lnurl1dp68gurn8ghj7", "https://wallet.example/ada", 7, null]) expect(cleanLightningAddress(not), String(not)).toBe("");
    expect([cleanTip(1), cleanTip(21), cleanTip(1_000_000)]).toEqual([1, 21, 1_000_000]);
    for (const not of [0, -5, 1.5, 1_000_001, NaN, Infinity, "21", null, undefined]) expect(cleanTip(not), String(not)).toBeNull();
  });

  it("is what a world sends its signer to tip, to buy and to ask, and what it hears back", () => {
    expect(readSignerRequest(signerMessage({ t: "tip", id: "t1", to: BUYER, sats: 21 }))).toEqual({ t: "tip", id: "t1", to: BUYER, sats: 21 });
    // With nobody named, it is for the world itself.
    expect(readSignerRequest(signerMessage({ t: "tip", id: "t1", sats: 21 }))).toEqual({ t: "tip", id: "t1", sats: 21 });
    for (const bad of [{ sats: 0 }, { sats: 1.5 }, { sats: 2_000_000 }, { sats: 21, to: "ada" }]) expect(readSignerRequest({ ...signerMessage({ t: "tip", id: "t1", sats: 1 }), ...bad }), JSON.stringify(bad)).toBeNull();
    expect(readSignerRequest(signerMessage({ t: "buy", id: "b1", listing: LISTING }))).toEqual({ t: "buy", id: "b1", listing: LISTING });
    expect(readSignerRequest(signerMessage({ t: "have", id: "h1", listing: LISTING }))).toEqual({ t: "have", id: "h1", listing: LISTING });
    expect(readSignerRequest(signerMessage({ t: "buy", id: "b1", listing: "a lantern" }))).toBeNull();
    const e = receipt();
    expect(readSignerReply(signerMessage({ t: "bought", id: "b1", receipt: e }))).toEqual({ t: "bought", id: "b1", receipt: e });
    expect(readSignerReply(signerMessage({ t: "bought", id: "b1", receipt: e, delivery: "a key" }))).toEqual({ t: "bought", id: "b1", receipt: e, delivery: "a key" });
    // What a purchase releases is text, and not much of it: more than that is left off, and it is still bought.
    expect(readSignerReply(signerMessage({ t: "bought", id: "b1", receipt: e, delivery: "x".repeat(20_001) }))).toEqual({ t: "bought", id: "b1", receipt: e });
    expect(readSignerReply(signerMessage({ t: "receipt", id: "h1", receipt: e }))).toEqual({ t: "receipt", id: "h1", receipt: e });
    expect(readSignerReply(signerMessage({ t: "none", id: "h1" }))).toEqual({ t: "none", id: "h1" });
    expect(readSignerReply({ ...signerMessage({ t: "none", id: "b1" }), t: "bought", receipt: "yes" })).toBeNull();
  });
});
