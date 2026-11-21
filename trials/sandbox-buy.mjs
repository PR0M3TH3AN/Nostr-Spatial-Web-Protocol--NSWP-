// A whole pretend purchase against BitUnlock's sandbox on this machine, by script, with throwaway keys and pretend
// sats: a seller signs up and registers a timed listing for a world, a buyer is quoted, pays one part and is refused,
// pays the other and is handed a receipt, and the kit's own check reads that receipt. Then the same buyer buys again
// and the time runs on. Nothing here leaves this machine: the listing goes to the stand-in relay and to the sandbox.
// Run with NODE_EXTRA_CA_CERTS pointing at this machine's own certificate.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/pure.js`);
const nip44 = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/nip44.js`);
const { default: WebSocket } = await import(`${NSWP}/node_modules/ws/wrapper.mjs`);
const { readReceipt, cleanListing, listingSeller, RECEIPT_ISSUERS } = await import(`${NSWP}/packages/core/dist/index.js`);
const { createHash, randomUUID } = await import("node:crypto");

const AT = process.env.SANDBOX ?? `https://${HOST}:4312`;
const RELAY = process.env.RELAY ?? "ws://127.0.0.1:4313";
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
const key = (n) => `${n}_${randomUUID().replaceAll("-", "")}`.slice(0, 60);
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const b64url = (s) => Buffer.from(s, "utf8").toString("base64url");

/** A call signed as someone (NIP-98): the exact address, the method, and the body's hash. */
async function signed(secret, method, path, body, headers = {}) {
  const url = new URL(`${AT}${path}`).toString();
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const tags = [["u", url], ["method", method], ["bitunlock:nonce", randomUUID()]];
  if (raw !== undefined || method !== "GET") tags.push(["payload", createHash("sha256").update(raw ?? "").digest("hex")]);
  const auth = finalizeEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), content: "", tags }, secret);
  const res = await fetch(url, { method, headers: { authorization: `Nostr ${b64(JSON.stringify(auth))}`, origin: `https://${HOST}:4311`, ...(raw === undefined ? {} : { "content-type": "application/json" }), ...headers }, body: raw });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}
const plain = async (method, path, headers = {}, body) => { const res = await fetch(`${AT}${path}`, { method, headers: { origin: `https://${HOST}:4311`, ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); let json = null; try { json = await res.json(); } catch { /* none */ } return { status: res.status, json }; };
const toRelay = (event) => new Promise((res, rej) => { const ws = new WebSocket(RELAY); ws.on("open", () => ws.send(JSON.stringify(["EVENT", event]))); ws.on("message", (m) => { const j = JSON.parse(String(m)); if (j[0] === "OK") { ws.close(); res(j[2]); } }); ws.on("error", rej); setTimeout(() => rej(new Error("relay timeout")), 4000); });

const health = (await plain("GET", "/health")).json;
const SERVICE = health.servicePubkey;
const POLICY = `30078:${SERVICE}:bitunlock:service-policy:v1`;
want("0 it is the sandbox, and not the live service's key", [health.sandbox, SERVICE !== RECEIPT_ISSUERS[0].pubkey], [true, true]);
const policy = (await plain("GET", "/policy")).json;
r.policyAdapters = policy?.document?.paymentAdapters ?? policy?.policy?.document?.paymentAdapters ?? Object.keys(policy ?? {});
const ISSUERS = [{ name: "BitUnlock sandbox (this machine)", service: AT, pubkey: SERVICE }];

const seller = generateSecretKey();
const buyer = generateSecretKey();
const stranger = generateSecretKey();
const SELLER = getPublicKey(seller);
const BUYER = getPublicKey(buyer);
const TERM = 3600;

// The seller signs up.
const tenant = await signed(seller, "POST", "/v1/tenants", { acceptedPolicyCoordinate: POLICY, feeCap: { maximumFeeBps: 100, maximumMinimumSats: 10, maximumFeeSats: 5000 }, idempotencyKey: key("tenant") });
want("1 the seller is ready with no wallet", [tenant.status < 300, tenant.json?.status ?? tenant.json?.state ?? tenant.json], [true, "ready"]);

// A listing for a world, for an hour, at the least price. And one a sat too cheap.
const listing = (name, price, more = []) => finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), content: JSON.stringify({ title: "TEST: an hour in a test world", summary: "A test listing on one machine. Not for sale." }), tags: [["d", name], ["price", String(price), "SAT"], ["status", "active"], ["br:delivery", "seller-unlock-service-v1"], ["br:delivery-mode", "static"], ["br:unlock-service", AT], ["br:unlock-service-pubkey", SERVICE], ["br:unlock-policy", POLICY], ["br:claim-epoch", "1"], ["nswp:for", `37300:${SELLER}:test-world`], ["nswp:term", String(TERM)], ...more] }, seller);
const conversation = nip44.getConversationKey(seller, SERVICE);
const register = (event, extra = {}) => signed(seller, "POST", "/v1/products", { productCoordinate: `30078:${SELLER}:${event.tags[0][1]}`, policyCoordinate: POLICY, claimEpoch: 1, payloadType: "claim-url", sellerCiphertext: nip44.encrypt("https://world.example/pass", conversation), accessTermSeconds: TERM, idempotencyKey: key("product"), ...extra }, { "x-bitunlock-sandbox-listing": b64url(JSON.stringify(event)) });

const cheap = await register(listing("nswp-test:too cheap", 499));
want("2 a world listing under 500 sats is refused", [cheap.status, cheap.json?.error?.code], [422, "product_event_invalid"]);
r.cheapSays = cheap.json?.error?.message;
const pass = listing("nswp-test:hour pass", 500);
const LISTING = `30078:${SELLER}:nswp-test:hour pass`;
r.listing = LISTING;
{ const { mkdirSync, writeFileSync } = await import("node:fs"); mkdirSync(SHOTS, { recursive: true }); writeFileSync(`${SHOTS}/sandbox-listing.json`, JSON.stringify({ listing: LISTING, sandbox: AT }, null, 1)); }
want("3 the kit takes the listing's name (a space in it), and reads its seller", [cleanListing(LISTING) === LISTING, listingSeller(LISTING) === SELLER], [true, true]);
want("3b the stand-in relay keeps the listing", await toRelay(pass), true);
const product = await register(pass);
want("4 the listing is registered, and its time runs on without being asked", [product.status < 300, product.json?.termRenewal], [true, "run-on"]);
if (product.status >= 300) r.productSays = product.json;

// A buyer, with pretend sats.
const session = (await plain("POST", "/sandbox/v1/sessions", {}, { ttlSeconds: 3600 })).json;
const scoped = { "x-bitunlock-sandbox-session": session.sessionId };
const settle = (hash) => plain("POST", `/sandbox/v1/payments/${hash}/settle`, { authorization: `Bearer ${session.token}`, ...scoped });

async function buy(label) {
  const quoteKey = key("quote");
  const quote = await signed(buyer, "POST", "/v1/quotes", { productCoordinate: LISTING, buyerPubkey: BUYER, idempotencyKey: quoteKey }, scoped);
  const plan = quote.json?.paymentPlan ?? quote.json;
  const legs = plan?.legs ?? [];
  want(`${label} quoted: two parts, summing to the price, BitUnlock's the fee`, [quote.status, legs.map((l) => `${l.role}:${l.amountSats}`).sort(), legs.every((l) => l.adapter === "mock" && /^bitunlock-mock:1:[0-9a-f]{64}$/.test(l.paymentRequest))], [201, ["bitunlock:10", "seller:490"], true]);
  const again = await signed(buyer, "POST", "/v1/quotes", { productCoordinate: LISTING, buyerPubkey: BUYER, idempotencyKey: quoteKey }, scoped);
  want(`${label} asking again with the same key is the same order`, (again.json?.paymentPlan ?? again.json)?.orderId === plan.orderId, true);
  // The small part first, as BitLogin is asked to: with only it paid, nothing is handed over.
  const fee = legs.find((l) => l.role === "bitunlock");
  const main = legs.find((l) => l.role === "seller");
  want(`${label} BitUnlock's part settles`, (await settle(fee.paymentHash)).status, 200);
  const early = await signed(buyer, "POST", `/v1/orders/${plan.orderId}/unlock`, { idempotencyKey: key("unlock") }, scoped);
  const half = await signed(buyer, "POST", `/v1/orders/${plan.orderId}/refresh`, { idempotencyKey: key("refresh") }, scoped);
  r[`${label} refresh says`] = { status: half.status, keys: Object.keys(half.json ?? {}), state: half.json?.state, error: half.json?.error };
  const seen = await signed(buyer, "GET", `/v1/orders/${plan.orderId}`, undefined, scoped);
  r[`${label} order says`] = { status: seen.status, keys: Object.keys(seen.json ?? {}), state: seen.json?.state, legs: (seen.json?.paymentPlan?.legs ?? seen.json?.legs ?? []).map((l) => `${l.role}:${l.status}`) };
  want(`${label} half paid: no receipt, and the order says so, part by part`, [early.status, early.json?.error?.code, seen.json?.state, r[`${label} order says`].legs.sort()], [409, "payment_incomplete", "partially_paid", ["bitunlock:settled", "seller:pending"]]);
  want(`${label} the seller's part settles`, (await settle(main.paymentHash)).status, 200);
  const other = await signed(stranger, "POST", `/v1/orders/${plan.orderId}/unlock`, { idempotencyKey: key("unlock") }, scoped);
  want(`${label} somebody else can't take it`, other.status >= 400, true);
  const unlocked = await signed(buyer, "POST", `/v1/orders/${plan.orderId}/unlock`, { idempotencyKey: key("unlock") }, scoped);
  const receipt = unlocked.json?.fulfillmentEvent;
  want(`${label} paid in full: a receipt`, [unlocked.status, !!receipt && verifyEvent(receipt), receipt?.pubkey === SERVICE], [200, true, true]);
  if (unlocked.status !== 200) r[`${label} unlock says`] = unlocked.json;
  if (quote.status !== 201) r[`${label} quote says`] = quote.json;
  return receipt;
}

const first = await buy("5");
const now = Math.floor(Date.now() / 1000);
const read = readReceipt(first, { listing: LISTING, buyer: BUYER, now, issuers: ISSUERS });
want("6 the kit reads it, told to believe the sandbox", [read.ok, read.ok && read.receipt.seller === SELLER, read.ok && read.receipt.expiresAt - read.receipt.issuedAt], [true, true, TERM]);
want("6b the kit as shipped does not believe it", readReceipt(first, { listing: LISTING, buyer: BUYER, now }), { ok: false, why: "unknown-issuer" });
want("6c not for another listing, another buyer, or once run out", [readReceipt(first, { listing: `30078:${SELLER}:other`, issuers: ISSUERS }).why, readReceipt(first, { buyer: getPublicKey(stranger), issuers: ISSUERS }).why, readReceipt(first, { now: now + TERM + 60, issuers: ISSUERS }).why], ["other-listing", "other-buyer", "run-out"]);
const fulfillment = read.ok ? read.receipt.fulfillment : "";
const status = await plain("GET", `/entitlements/${fulfillment}/status`);
r.statusSays = status.json;
want("7 anyone may ask whether it was taken back", status.status, 200);

// Bought again before it has run out: the time runs on from the first one's end.
const second = await buy("8");
const read2 = readReceipt(second ?? null, { listing: LISTING, buyer: BUYER, now, issuers: ISSUERS });
const doc2 = second ? JSON.parse(second.content) : {};
want("9 the renewal runs on from the first one's end, and names it", [read2.ok, read2.ok && read.ok && read2.receipt.expiresAt === read.receipt.expiresAt + TERM, doc2.accessPolicy?.renewalOfFulfillmentId === fulfillment], [true, true, true]);
const owned = await signed(buyer, "GET", "/v1/access-entitlements");
const list = owned.json?.entitlements ?? [];
want("10 the buyer's receipts can be asked for again: both, each good", [owned.status, list.length, list.every((x) => readReceipt(x.event, { listing: LISTING, buyer: BUYER, now, issuers: ISSUERS }).ok)], [200, 2, true]);
const none = await signed(stranger, "GET", "/v1/access-entitlements");
want("10b and somebody else has none", [none.status, (none.json?.entitlements ?? []).length], [200, 0]);

console.log(JSON.stringify(r, null, 1));
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
