// A whole pretend purchase WITH SHARES against BitUnlock's sandbox on this machine, by script, with throwaway keys and
// pretend sats. Shares are switched on in that sandbox only: nowhere real pays one. A seller lists something whose
// price is divided between themselves, a maker and "the client"; the maker and a client register to be paid; a buyer
// is quoted with a client and without; and every payment the service asks for is held to what the KIT's own rule
// (`readShares`, `splitPrice`) says the listing comes to. Nothing here leaves this machine.
// Run with NODE_EXTRA_CA_CERTS pointing at this machine's own certificate.
import { ROOT as NSWP, HOST, SHOTS } from "./lib.mjs";
const { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/pure.js`);
const nip44 = await import(`${NSWP}/node_modules/nostr-tools/lib/esm/nip44.js`);
const { default: WebSocket } = await import(`${NSWP}/node_modules/ws/wrapper.mjs`);
const { readReceipt, readShares, splitPrice, SHARE_LIMITS } = await import(`${NSWP}/packages/core/dist/index.js`);
const { createHash, randomUUID } = await import("node:crypto");

const AT = process.env.SANDBOX ?? `https://${HOST}:4312`;
const RELAY = process.env.RELAY ?? "ws://127.0.0.1:4313";
const r = {};
const bad = [];
const want = (name, got, expected) => { r[name] = got; if (JSON.stringify(got) !== JSON.stringify(expected)) bad.push(`${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(expected)}`); };
const key = (n) => `${n}_${randomUUID().replaceAll("-", "")}`.slice(0, 60);
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const b64url = (s) => Buffer.from(s, "utf8").toString("base64url");
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
const ISSUERS = [{ name: "BitUnlock sandbox (this machine)", service: AT, pubkey: SERVICE }];
want("0 it is the sandbox", health.sandbox, true);

const [seller, maker, client, stranger, buyer, buyer2] = [0, 1, 2, 3, 4, 5].map(() => generateSecretKey());
const SELLER = getPublicKey(seller), MAKER = getPublicKey(maker), CLIENT = getPublicKey(client), STRANGER = getPublicKey(stranger), BUYER = getPublicKey(buyer), BUYER2 = getPublicKey(buyer2);
const who = (k) => (k === SELLER ? "seller" : k === MAKER ? "maker" : k === CLIENT ? "client" : k === STRANGER ? "stranger" : k);
const PRICE = 2100;

const tenant = await signed(seller, "POST", "/v1/tenants", { acceptedPolicyCoordinate: POLICY, feeCap: { maximumFeeBps: 100, maximumMinimumSats: 10, maximumFeeSats: 5000 }, idempotencyKey: key("tenant") });
want("1 the seller is ready", tenant.json?.status, "ready");

// The listing: 85% to the seller ("world"), 10% to a maker, 5% to whichever client brought the buyer.
const shareTags = [["nswp:share", SELLER, "8500", "world"], ["nswp:share", MAKER, "1000", "maker"], ["nswp:share", "client", "500"]];
const listing = (name, price, tags) => finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), content: JSON.stringify({ title: "TEST: a thing with shares", summary: "A test listing on one machine. Not for sale." }), tags: [["d", name], ["price", String(price), "SAT"], ["status", "active"], ["br:delivery", "seller-unlock-service-v1"], ["br:delivery-mode", "static"], ["br:unlock-service", AT], ["br:unlock-service-pubkey", SERVICE], ["br:unlock-policy", POLICY], ["br:claim-epoch", "1"], ["nswp:for", `37303:${SELLER}:test-item`], ...tags] }, seller);
const conversation = nip44.getConversationKey(seller, SERVICE);
const register = (event) => signed(seller, "POST", "/v1/products", { productCoordinate: `30078:${SELLER}:${event.tags[0][1]}`, policyCoordinate: POLICY, claimEpoch: 1, payloadType: "claim-url", sellerCiphertext: nip44.encrypt("https://world.example/thing", conversation), idempotencyKey: key("product") }, { "x-bitunlock-sandbox-listing": b64url(JSON.stringify(event)) });

// What the kit says of the listing, before anyone is asked.
const read = readShares(listing("nswp-test:shared thing", PRICE, shareTags).tags, SELLER);
want("2 the kit reads three shares", read.ok && read.shares.map((s) => [who(s.to), s.parts, s.label]), [["seller", 8500, "world"], ["maker", 1000, "maker"], ["client", 500, "client"]]);

// Nobody has agreed to be paid yet: the listing can't be registered, and the refusal says who.
const early = await register(listing("nswp-test:shared thing", PRICE, shareTags));
want("3 a share for someone who hasn't registered to be paid is refused", [early.status, early.json?.error?.code, (early.json?.error?.message ?? "").includes(MAKER.slice(0, 8))], [422, "product_event_invalid", true]);
r.earlySays = early.json?.error?.message;

// The maker and a client each say where they are paid. Signed by their own key: that is their agreement.
const payee = (secret, name) => signed(secret, "POST", "/v1/payees", { lightningAddress: `${name}@example.test` });
want("4 the maker and the client register to be paid", [(await payee(maker, "maker")).status, (await payee(client, "client")).status], [201, 201]);
const mine = await signed(maker, "GET", "/v1/payees");
want("4b each sees their own record, and only their own", [mine.status, mine.json?.payeePubkey === MAKER, mine.json?.status, (await signed(stranger, "GET", "/v1/payees")).status], [200, true, "ready", 404]);

// Rules the kit and the service must agree on, at registration.
const wrong = async (name, tags) => { const res = await register(listing(name, PRICE, tags)); return [res.status, readShares(tags, SELLER).ok ? "kit: ok" : `kit: ${readShares(tags, SELLER).why}`]; };
want("5 parts that don't add up: refused by both", await wrong("nswp-test:not whole", [["nswp:share", SELLER, "8500"], ["nswp:share", MAKER, "1000"]]), [422, "kit: not-whole"]);
want("5b the seller left out: refused by both", await wrong("nswp-test:no seller", [["nswp:share", MAKER, "9500"], ["nswp:share", "client", "500"]]), [422, "kit: no-seller"]);
const tooSmall = await register(listing("nswp-test:too small", 150, shareTags));
want("5c a price where the client's 5% is 7 sats: refused by both", [tooSmall.status, splitPrice(150, read.shares, SELLER, { client: CLIENT, charge: 10 }).why], [422, "too-small"]);

const good = listing("nswp-test:shared thing", PRICE, shareTags);
const LISTING = `30078:${SELLER}:nswp-test:shared thing`;
r.listing = LISTING;
await toRelay(good);
const product = await register(good);
want("6 now it is registered, and says its shares back", [product.status < 300, (product.json?.shares ?? []).map((s) => [who(s.to), s.parts, s.label])], [true, [["seller", 8500, "world"], ["maker", 1000, "maker"], ["client", 500, "client"]]]);
if (product.status >= 300) r.productSays = product.json;

const session = (await plain("POST", "/sandbox/v1/sessions", {}, { ttlSeconds: 3600 })).json;
const scoped = { "x-bitunlock-sandbox-session": session.sessionId };
const settle = (hash) => plain("POST", `/sandbox/v1/payments/${hash}/settle`, { authorization: `Bearer ${session.token}`, ...scoped });
const legsOf = (plan) => (plan?.legs ?? []).map((l) => [l.role === "share" ? who(l.recipientPubkey) : l.role, l.amountSats]);

/** One purchase: quoted, held to the kit's split, paid in the paying order with nothing handed over early. */
async function buy(label, who_, secret, clientKey) {
  const quote = await signed(secret, "POST", "/v1/quotes", { productCoordinate: LISTING, buyerPubkey: who_, idempotencyKey: key("quote"), ...(clientKey ? { clientPubkey: clientKey } : {}) }, scoped);
  const plan = quote.json?.paymentPlan ?? quote.json;
  if (quote.status !== 201) { r[`${label} quote says`] = quote.json; return null; }
  const fee = plan.legs.find((l) => l.role === "bitunlock")?.amountSats ?? 0;
  // The kit's own answer, with the client where the service could pay one.
  const kit = splitPrice(PRICE, read.shares, SELLER, { ...(clientKey ? { client: clientKey } : {}), charge: fee });
  const kitNoClient = splitPrice(PRICE, read.shares, SELLER, { charge: fee });
  const asKit = (s) => (s.ok ? s.parts.map((p) => [p.seller ? "seller" : who(p.to), p.sats]) : s.why);
  // The service's legs, less its own, in the kit's order: shares as given (smallest first), the seller last.
  const service = [...plan.legs.filter((l) => l.role === "share").map((l) => [who(l.recipientPubkey), l.amountSats]), ["seller", plan.legs.find((l) => l.role === "seller").amountSats]];
  r[`${label} legs`] = legsOf(plan);
  r[`${label} kit`] = asKit(kit);
  return { plan, fee, service, kit: asKit(kit), kitNoClient: asKit(kitNoClient), words: plan.legs.filter((l) => l.role === "share").map((l) => [who(l.recipientPubkey), l.label]) };
}
async function payAll(label, secret, plan) {
  // The paying order: the service's own leg, then shares smallest first, then the seller.
  const order = [...plan.legs.filter((l) => l.role === "bitunlock"), ...plan.legs.filter((l) => l.role === "share"), ...plan.legs.filter((l) => l.role === "seller")];
  const early = [];
  for (const [i, leg] of order.entries()) {
    if ((await settle(leg.paymentHash)).status !== 200) bad.push(`${label}: leg ${leg.role} would not settle`);
    if (i < order.length - 1) early.push((await signed(secret, "POST", `/v1/orders/${plan.orderId}/unlock`, { idempotencyKey: key("unlock") }, scoped)).status);
  }
  const unlocked = await signed(secret, "POST", `/v1/orders/${plan.orderId}/unlock`, { idempotencyKey: key("unlock") }, scoped);
  return { early, unlocked };
}

// With a client that can be paid.
const a = await buy("7", BUYER, buyer, CLIENT);
want("7 quoted with a client: the service's payments are the kit's split, to the sat", a && [a.service, a.fee], a && [a.kit, 21]);
want("7b in sats: client 105, maker 210, seller 1764, and the service's 21", a?.service, [["client", 105], ["maker", 210], ["seller", 1764]]);
want("7c each share carries the seller's word for it", a?.words, [["client", "client"], ["maker", "maker"]]);
want("7d and the breakdown adds up", a && [a.plan.feeSnapshot?.allocation?.sharesSats, a.plan.legs.reduce((s, l) => s + l.amountSats, 0), a.plan.legs.length <= SHARE_LIMITS.most + 1], [315, PRICE, true]);
if (a) {
  const paid = await payAll("7", buyer, a.plan);
  const receipt = paid.unlocked.json?.fulfillmentEvent;
  want("8 nothing is handed over until the last payment; then a receipt the kit believes", [paid.early, paid.unlocked.status, !!receipt && verifyEvent(receipt) && readReceipt(receipt, { listing: LISTING, buyer: BUYER, issuers: ISSUERS }).ok], [[409, 409, 409], 200, true]);
  r.hashes = receipt ? JSON.parse(receipt.content).paymentHashes?.length ?? null : null;
}

// With nobody having brought the buyer: the client's share is the seller's.
const b = await buy("9", BUYER2, buyer2, null);
want("9 quoted with no client: the kit's split again, the client's part gone to the seller", b && [b.service, b.plan.feeSnapshot?.allocation?.sharesSats], b && [b.kitNoClient, 210]);
want("9b in sats: maker 210, seller 1869", b?.service, [["maker", 210], ["seller", 1869]]);

// A client the service can't pay (never registered): the same as no client. One of the two right plans.
const c = await buy("10", BUYER2, buyer2, STRANGER);
want("10 a client who never registered to be paid: the plan with no client, and no other", c?.service, c?.kitNoClient);

// With KEEP=1 the listing is left as it is, everyone still registered, for another program to buy from.
if (process.env.KEEP) {
  r.kept = { listing: LISTING, seller: SELLER, maker: MAKER, client: CLIENT, price: PRICE };
  { const { mkdirSync, writeFileSync } = await import("node:fs"); mkdirSync(SHOTS, { recursive: true }); writeFileSync(`${SHOTS}/sandbox-shares-listing.json`, JSON.stringify(r.kept, null, 1)); }
} else {
// The maker takes their agreement back: no new sale, said plainly, and never paid whole to the seller.
const gone = await signed(maker, "DELETE", "/v1/payees");
const refused = await signed(buyer2, "POST", "/v1/quotes", { productCoordinate: LISTING, buyerPubkey: BUYER2, idempotencyKey: key("quote") }, scoped);
want("11 the maker withdraws: a new quote is refused", [gone.status, gone.json?.status, refused.status, refused.json?.error?.code], [200, "withdrawn", 409, "shares_unavailable"]);
r.refusedSays = refused.json?.error?.message;
}

console.log(JSON.stringify(r, null, 1));
if (bad.length) { console.error("\nFAILED\n" + bad.join("\n")); process.exit(1); }
console.log("\nall as wanted");
