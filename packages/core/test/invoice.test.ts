import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { bech32 } from "@scure/base";
import { describe, expect, it } from "vitest";
import { cleanInvoice, invoicePaymentHash, provesPayment, readSignerReply, readSignerRequest, signerMessage } from "../src/index.js";

/** An invoice made here, as BOLT 11 lays one out: when, then fields (a kind, a length, the data), then a signature. */
const field = (kind: number, data: number[]): number[] => [kind, data.length >> 5, data.length & 31, ...data];
const makeInvoice = (o: { hash?: Uint8Array; before?: number[][]; prefix?: string } = {}): string => {
  const words = [
    ...new Array<number>(7).fill(3),
    ...(o.before ?? []).flat(),
    ...(o.hash ? field(1, bech32.toWords(o.hash)) : []),
    // A description, and something a reader doesn't know: both are stepped over.
    ...field(13, bech32.toWords(new TextEncoder().encode("a ticket"))),
    ...field(30, [1, 2, 3]),
    ...new Array<number>(104).fill(9),
  ];
  return bech32.encode(o.prefix ?? "lnbc400n", words, 2000);
};
const preimage = "1a".repeat(32);
const hash = sha256(hexToBytes(preimage));

describe("a Lightning invoice, as far as a world reads one", () => {
  it("knows an invoice from anything else, and tidies one", () => {
    const invoice = makeInvoice({ hash });
    expect(cleanInvoice(invoice)).toBe(invoice);
    expect(cleanInvoice(`  LIGHTNING:${invoice.toUpperCase()} `)).toBe(invoice);
    for (const prefix of ["lntb1u", "lntbs1u", "lnbcrt1u"]) expect(cleanInvoice(makeInvoice({ hash, prefix }))).not.toBe("");
    for (const not of ["", "lnurl1dp68gurn8ghj7", "bitcoin:bc1qxyz", "https://example.com/pay", `${invoice} and more`, `lnbc${"q".repeat(2000)}`, 7, null, undefined, {}]) expect(cleanInvoice(not), String(not).slice(0, 30)).toBe("");
  });

  it("reads the payment hash, wherever it is among the fields", () => {
    expect(invoicePaymentHash(makeInvoice({ hash }))).toBe(bytesToHex(hash));
    // After other fields, one of them long (a 1023-word field is the longest there can be).
    expect(invoicePaymentHash(makeInvoice({ hash, before: [field(13, new Array<number>(300).fill(4)), field(6, [0, 1])] }))).toBe(bytesToHex(hash));
    // In upper case, as a QR code has it.
    expect(invoicePaymentHash(makeInvoice({ hash }).toUpperCase())).toBe(bytesToHex(hash));
  });

  it("reads the examples in the Lightning specification (BOLT 11) as it says they read", () => {
    const SPEC_HASH = "0001020304050607080900010203040506070809000102030405060708090102";
    for (const example of [
      "lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql",
      "lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w",
    ]) expect(invoicePaymentHash(example)).toBe(SPEC_HASH);
  });

  it("reads none from what has none, is damaged, or runs off its end", () => {
    expect(invoicePaymentHash(makeInvoice())).toBeNull();
    const invoice = makeInvoice({ hash });
    // One letter wrong: the checksum says so.
    const at = invoice.length - 20;
    expect(invoicePaymentHash(`${invoice.slice(0, at)}${invoice[at] === "q" ? "p" : "q"}${invoice.slice(at + 1)}`)).toBeNull();
    // A field that claims to be longer than the invoice.
    expect(invoicePaymentHash(bech32.encode("lnbc1u", [...new Array<number>(7).fill(3), 13, 31, 31, 1, 2, 3, ...new Array<number>(104).fill(9)], 2000))).toBeNull();
    // A "p" of the wrong length is not a payment hash.
    expect(invoicePaymentHash(bech32.encode("lnbc1u", [...new Array<number>(7).fill(3), ...field(1, new Array<number>(10).fill(1)), ...new Array<number>(104).fill(9)], 2000))).toBeNull();
    for (const not of ["", "lnbc1", "not an invoice", null]) expect(invoicePaymentHash(not)).toBeNull();
  });

  it("takes a preimage as proof only of the invoice whose hash it is", () => {
    const invoice = makeInvoice({ hash });
    expect(provesPayment(invoice, preimage)).toBe(true);
    expect(provesPayment(invoice, "22".repeat(32))).toBe(false);
    expect(provesPayment(makeInvoice({ hash: sha256(hexToBytes("22".repeat(32))) }), preimage)).toBe(false);
    expect(provesPayment(makeInvoice(), preimage)).toBe(false);
    for (const not of ["", "11".repeat(31), preimage.toUpperCase(), `${preimage}00`, 7, null, undefined]) expect(provesPayment(invoice, not), String(not).slice(0, 20)).toBe(false);
  });

  it("is what a world sends its signer to be paid, and what it hears back", () => {
    const invoice = makeInvoice({ hash });
    expect(readSignerRequest(signerMessage({ t: "pay", id: "y1", invoice }))).toEqual({ t: "pay", id: "y1", invoice });
    expect(readSignerRequest(signerMessage({ t: "pay", id: "y1", invoice: `lightning:${invoice.toUpperCase()}` }))).toEqual({ t: "pay", id: "y1", invoice });
    expect(readSignerRequest(signerMessage({ t: "pay", id: "y1", invoice: "https://example.com/pay" }))).toBeNull();
    expect(readSignerReply(signerMessage({ t: "paid", id: "y1", preimage }))).toEqual({ t: "paid", id: "y1", preimage });
    // Paid with no proof (some wallets are given none), and a proof that isn't one is left out.
    expect(readSignerReply(signerMessage({ t: "paid", id: "y1" }))).toEqual({ t: "paid", id: "y1" });
    expect(readSignerReply(signerMessage({ t: "paid", id: "y1", preimage: "not a preimage" }))).toEqual({ t: "paid", id: "y1" });
  });
});
