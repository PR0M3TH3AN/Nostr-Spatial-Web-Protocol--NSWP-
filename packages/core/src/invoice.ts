/**
 * A Lightning invoice, as far as a world needs to read one (protocol/10-identity.md, "Asking the person"): that
 * it is one, and whether a payment's proof is really the proof of this invoice.
 *
 * A world that asks its visitor to pay an invoice is told "paid", sometimes with a preimage. The preimage is the
 * proof: its SHA-256 is the payment hash written in the invoice. A world can check that with nothing but the
 * invoice it made, which is what this is for. It reads nothing else from the invoice: the amount and where it
 * goes are shown to the visitor by their own sign-in address, not by the world.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { bech32 } from "@scure/base";

/** No invoice is longer than this. */
export const INVOICE_LIMIT = 2000;

/** A Lightning invoice as it may be passed on: the bolt11 form, lower case, and no longer than one could be. "" for anything else. */
export function cleanInvoice(input: unknown): string {
  if (typeof input !== "string") return "";
  const invoice = input.trim().toLowerCase().replace(/^lightning:/, "");
  return invoice.length <= INVOICE_LIMIT && /^ln(bc|tb|tbs|bcrt)[0-9a-z]+$/.test(invoice) ? invoice : "";
}

/** In an invoice's words: when it was made (7 words), then its fields, then its signature (104 words). */
const TIMESTAMP_WORDS = 7;
const SIGNATURE_WORDS = 104;
/** The field that holds the payment hash ("p"), and how long it always is: 52 words, 256 bits and four to spare. */
const PAYMENT_HASH = 1;
const PAYMENT_HASH_WORDS = 52;

/** The payment hash an invoice names, in hex, or null if it can't be read (not an invoice, a bad checksum, none in it). */
export function invoicePaymentHash(invoice: unknown): string | null {
  const clean = cleanInvoice(invoice);
  if (!clean) return null;
  let words: number[];
  try {
    // The checksum is checked here: an invoice with one letter wrong is no invoice.
    words = bech32.decode(clean as `${string}1${string}`, INVOICE_LIMIT).words;
  } catch {
    return null;
  }
  const end = words.length - SIGNATURE_WORDS;
  let at = TIMESTAMP_WORDS;
  while (at + 3 <= end) {
    const length = words[at + 1]! * 32 + words[at + 2]!;
    const data = words.slice(at + 3, at + 3 + length);
    if (at + 3 + length > end) return null;
    if (words[at] === PAYMENT_HASH && length === PAYMENT_HASH_WORDS) {
      const bytes = bech32.fromWordsUnsafe(data);
      return bytes && bytes.length === 32 ? bytesToHex(bytes) : null;
    }
    at += 3 + length;
  }
  return null;
}

/** Whether `preimage` (64 hex characters) is the proof that this invoice was paid: its SHA-256 is the invoice's payment hash. */
export function provesPayment(invoice: unknown, preimage: unknown): boolean {
  if (typeof preimage !== "string" || !/^[0-9a-f]{64}$/.test(preimage)) return false;
  const hash = invoicePaymentHash(invoice);
  return !!hash && bytesToHex(sha256(hexToBytes(preimage))) === hash;
}
