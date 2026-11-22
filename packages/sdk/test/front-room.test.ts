import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalizeEvent, getPublicKey, ownerListTemplate, RECEIPT_ISSUERS, worldSubject, type Filter, type NostrEvent, type QueryResult, type Receipt } from "@nswp/core";

/**
 * The front room of a paid world (protocol/10-identity.md, "The front room"). The signer is a stand-in that
 * answers what the test tells it to: the gate must check everything itself, whatever a signer hands it. The selling
 * service is a stand-in too: the kit believes a receipt only from a key on its list, which nothing can add to, so
 * the check itself is stood in for (the real one, told of the test's key). Nothing real is signed, asked or paid.
 */
vi.mock("@nswp/core", async (original) => {
  const core = await original<typeof import("@nswp/core")>();
  const { sha256: hash } = await import("@noble/hashes/sha2.js");
  const { utf8ToBytes: bytes } = await import("@noble/hashes/utils.js");
  const issuers = [{ name: "Test service", service: "https://unlock.example", pubkey: core.getPublicKey(hash(bytes("nswp gate test key 1"))) }];
  return { ...core, readReceipt: (event: unknown, expect: Parameters<typeof core.readReceipt>[1] = {}) => core.readReceipt(event, { ...expect, issuers }) };
});
const { addGateControls, createPaidGate, GATE_TIMES } = await import("../src/front-room.js");
const { forgetRelays, relayBackup } = await import("../src/relay-book.js");
const { createControls } = await import("../src/ui/model.js");
type GateSigner = import("../src/front-room.js").GateSigner;

const key = (n: number) => sha256(utf8ToBytes(`nswp gate test key ${n}`));
const pk = (n: number) => getPublicKey(key(n));
const service = key(1);
const SELLER = pk(2);
const ME = pk(3);
const OTHER = pk(4);
const HOUR = `30078:${SELLER}:an hour pass`;
const GOOD = `30078:${SELLER}:for-good`;
const WORLD = "https://world.example/";
const T0 = 1_800_000_000_000;
let clock = T0;
const sec = () => Math.floor(clock / 1000);
/** Let the clock and every timer move on together. */
const pass = async (ms: number) => {
  clock += ms;
  await vi.advanceTimersByTimeAsync(ms);
};

const receipt = (over: Record<string, unknown> = {}, by: Uint8Array = service): NostrEvent => {
  const doc = { schemaVersion: 1, protocolVersion: "seller-unlock-service-v1", accessPolicy: "perpetual-v1", status: "active", tenantId: "t", sellerPubkey: SELLER, productCoordinate: HOUR, buyerPubkey: ME, orderId: "o", fulfillmentId: "f1", claimEpoch: 1, paymentHashes: ["ab".repeat(32)], issuedAt: sec() - 10, ...over };
  return finalizeEvent({ kind: 30078, created_at: sec() - 10, tags: [["d", `bitunlock:entitlement:v1:${String(doc.fulfillmentId)}`]], content: JSON.stringify(doc) }, by);
};
const timed = (seconds: number, over: Record<string, unknown> = {}) => receipt({ accessPolicy: { kind: "term-v1", expiresAt: sec() + seconds }, ...over });
/** A listing as it is registered: it names the one service the kit believes, by its address and key. */
const listing = (name = "an hour pass", o: { price?: string; by?: Uint8Array; more?: string[][]; at?: number } = {}): NostrEvent =>
  finalizeEvent(
    {
      kind: 30078,
      created_at: o.at ?? sec() - 500,
      content: JSON.stringify({ title: name === "an hour pass" ? "An hour here" : "Here, for good" }),
      tags: [["d", name], ["price", o.price ?? "500", "SAT"], ["status", "active"], ["br:delivery", "seller-unlock-service-v1"], ["br:unlock-service", RECEIPT_ISSUERS[0]!.service], ["br:unlock-service-pubkey", RECEIPT_ISSUERS[0]!.pubkey], ["nswp:for", `37300:${SELLER}:a-world`], ...(name === "an hour pass" ? [["nswp:term", "3600"]] : []), ...(o.more ?? [])],
    },
    o.by ?? key(2),
  );
const manifest = (access: unknown = [HOUR], publishers: Record<string, { worlds: string[] }> = { [SELLER]: { worlds: ["a-world"] } }) => ({ schema: "nswp/manifest/0.3", publishers, worlds: { "a-world": { entry: { url: WORLD }, ...(access === null ? {} : { access }) } }, relays: ["wss://relay.example"] });

/** A stand-in signer: signed in as `ME` unless told otherwise, holding what the test gives it. */
function standIn(o: { state?: "none" | "locked" | "unlocked"; pubkey?: string | null } = {}) {
  const watchers = new Set<() => void>();
  const s = {
    state: o.state ?? "unlocked",
    pubkey: o.pubkey === undefined ? ME : o.pubkey,
    host: "signin.example",
    holds: {} as Record<string, NostrEvent | null>,
    sells: null as NostrEvent | null,
    have: vi.fn(async (l: string) => (s.holds[l] ? ({ event: s.holds[l] } as unknown as Receipt & { event: NostrEvent }) : null)),
    buy: vi.fn(async (_l: string) => (s.sells ? ({ event: s.sells, delivery: null } as unknown as Receipt & { event: NostrEvent; delivery: string | null }) : null)),
    onChange: (fn: () => void) => (watchers.add(fn), () => void watchers.delete(fn)),
    whenAnswered: async () => {},
    change(next: { state?: "none" | "locked" | "unlocked"; pubkey?: string | null }) {
      Object.assign(s, next);
      for (const fn of [...watchers]) fn();
    },
  };
  return s;
}
type StandIn = ReturnType<typeof standIn>;

let relayHolds: NostrEvent[] = [];
let relaysUp = true;
const query = vi.fn(async (relays: string[], filter: Filter): Promise<QueryResult> => {
  if (!relaysUp) return { events: [], relays: Object.fromEntries(relays.map((r) => [r, "error: down"])) };
  const events = relayHolds.filter((e) => (filter.kinds ?? [e.kind]).includes(e.kind) && (filter["#d"] ?? []).some((d) => e.tags.some((t) => t[0] === "d" && t[1] === d)));
  return { events, relays: Object.fromEntries(relays.map((r) => [r, "eose"])) };
});
/** What the selling service answers when asked whether a receipt still stands. */
let serviceSays: "stands" | "taken-back" | "unknown" = "stands";
const status = vi.fn(async (_r: Receipt) => serviceSays);
let file: () => Promise<unknown>;

const make = (signer: StandIn | null, more: Partial<Parameters<typeof createPaidGate>[0]> = {}) => createPaidGate({ signer: () => signer as unknown as GateSigner | null, url: WORLD, manifest: () => file(), query, status, now: () => clock, ...more });
/** A gate that has had the moment it takes to read its file, ask relays and ask the signer. */
const settled = async (signer: StandIn | null, more: Partial<Parameters<typeof createPaidGate>[0]> = {}) => {
  const gate = make(signer, more);
  await pass(0);
  await pass(0);
  return gate;
};
/** The visitor's console, with a sign-in row to press and everything said kept. */
const consoleFor = (gate: ReturnType<typeof make>, o: { presenting?: boolean } = {}) => {
  const controls = createControls({ title: "A world" });
  const said: string[] = [];
  controls.onSay((text) => said.push(text));
  const signIn = vi.fn(() => true);
  controls.add({ id: "home", section: "travel", label: "Go home", hotbar: true, act: () => {} });
  const rows = addGateControls(controls, gate, { presenting: () => !!o.presenting, signIn });
  const travel = () => controls.view().sections.find((s) => s.id === "travel")?.items ?? [];
  return { controls, said, signIn, rows, travel, labels: () => travel().map((i) => i.label) };
};

const kept = new Map<string, string>();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  clock = T0;
  kept.clear();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
  forgetRelays();
  relayBackup(false);
  relayHolds = [listing(), listing("for-good", { price: "2100" })];
  relaysUp = true;
  query.mockClear();
  status.mockClear();
  serviceSays = "stands";
  file = async () => manifest();
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("a world with nothing for sale", () => {
  it("is free, and nothing is read from a relay or asked of anyone", async () => {
    file = async () => manifest(null);
    const signer = standIn();
    const gate = await settled(signer);
    expect([gate.state, gate.open, gate.why, gate.offers]).toEqual(["free", true, "", []]);
    expect(query).not.toHaveBeenCalled();
    expect(signer.have).not.toHaveBeenCalled();
    const c = consoleFor(gate);
    expect(c.labels()).toEqual(["Go home"]);
    expect(c.said).toEqual([]);
    // Nothing later changes that: no timer is left running.
    await pass(GATE_TIMES.look * 3000);
    expect(signer.have).not.toHaveBeenCalled();
  });

  it("is free at once when it says so outright, without even its own file being read", () => {
    const read = vi.fn(async () => manifest());
    const gate = make(standIn(), { listings: [], manifest: read });
    expect([gate.state, gate.open]).toEqual(["free", true]);
    expect(read).not.toHaveBeenCalled();
  });
});

describe("a paid world's gate", () => {
  it("is shut until it knows, and shut for someone who holds nothing: with what is for sale, its price and how long it lasts", async () => {
    const signer = standIn();
    const gate = make(signer);
    expect([gate.state, gate.open]).toEqual(["checking", false]);
    await pass(0);
    await pass(0);
    expect([gate.state, gate.open, gate.reason]).toEqual(["shut", false, "nothing-held"]);
    expect(gate.offers).toEqual([{ listing: HOUR, name: "An hour here", sats: 500, term: 3600, words: "500 sats, for 1 hour" }]);
    expect(gate.why).toBe("Past here is for people who have bought it: An hour here, 500 sats, for 1 hour.");
    expect(signer.have).toHaveBeenCalledWith(HOUR);
    // The listing was asked of the world's own relays and the usual ones, by its seller and its name.
    expect(query.mock.calls[0]![1]).toEqual({ kinds: [30078], authors: [SELLER], "#d": ["an hour pass"] });
    expect(query.mock.calls[0]![0]).toContain("wss://relay.example");
  });

  it("is open for someone who holds a receipt, and says nothing", async () => {
    const signer = standIn();
    signer.holds[HOUR] = receipt();
    const gate = await settled(signer);
    expect([gate.state, gate.open, gate.why, gate.until]).toEqual(["open", true, "", null]);
    const c = consoleFor(gate);
    expect(c.said).toEqual([]);
    expect(c.labels()).toEqual(["Go home"]);
  });

  it("opens on nothing but a receipt it believes itself: not another listing's, not another buyer's, not one run out, not one from a service it doesn't know", async () => {
    for (const [what, wrong] of [
      ["another listing", receipt({ productCoordinate: GOOD })],
      ["another buyer", receipt({ buyerPubkey: OTHER })],
      ["run out", receipt({ issuedAt: sec() - 7200, accessPolicy: { kind: "term-v1", expiresAt: sec() - 1 } })],
      ["an unknown issuer", receipt({}, key(9))],
      ["a seller that isn't the listing's", receipt({ sellerPubkey: OTHER })],
      ["not a receipt at all", { bought: true } as unknown as NostrEvent],
      ["a receipt changed after it was signed", { ...receipt(), content: receipt({ buyerPubkey: ME, fulfillmentId: "f1" }).content.replace("perpetual-v1", "perpetual-v2") }],
    ] as const) {
      const signer = standIn();
      signer.holds[HOUR] = wrong;
      const gate = await settled(signer);
      expect([what, gate.state, gate.open]).toEqual([what, "shut", false]);
      gate.dispose();
    }
  });

  it("opens only for a listing this world names: a good receipt for something else of the seller's opens nothing", async () => {
    const signer = standIn();
    // The signer answers the wrong question with a perfectly good receipt for another listing.
    signer.holds[HOUR] = receipt({ productCoordinate: GOOD });
    const gate = await settled(signer);
    expect(gate.open).toBe(false);
  });

  it("is the world's own to sell: a listing its site doesn't let its key sell shuts the gate, and offers nothing", async () => {
    // The manifest names a listing sold by a key that isn't a publisher of this world.
    file = async () => manifest([`30078:${OTHER}:an hour pass`]);
    const signer = standIn();
    signer.holds[`30078:${OTHER}:an hour pass`] = receipt({ productCoordinate: `30078:${OTHER}:an hour pass`, sellerPubkey: OTHER });
    const gate = await settled(signer);
    expect([gate.state, gate.reason, gate.offers]).toEqual(["shut", "not-own", []]);
    expect(gate.why).toContain("isn't its own to sell");
    expect(signer.have).not.toHaveBeenCalled();
    expect(await gate.buy(`30078:${OTHER}:an hour pass`)).toBe(false);
    expect(consoleFor(gate).labels()).toEqual(["Go home"]);
    // The same where the world's code names it outright.
    const outright = await settled(standIn(), { listings: [`30078:${OTHER}:an hour pass`] });
    expect([outright.state, outright.reason]).toEqual(["shut", "not-own"]);
  });

  it("stays shut, and says so, while its own file can't be read; and reads it again", async () => {
    let down = true;
    file = async () => {
      if (down) throw new Error("offline");
      return manifest();
    };
    const gate = await settled(standIn());
    expect([gate.state, gate.reason]).toEqual(["shut", "no-manifest"]);
    expect(gate.why).toContain("couldn't read its own list");
    down = false;
    await pass(15_000);
    await pass(0);
    expect([gate.state, gate.reason]).toEqual(["shut", "nothing-held"]);
    // A file that isn't a manifest is no better than none.
    file = async () => ({ access: [HOUR] });
    expect((await settled(standIn())).reason).toBe("no-manifest");
  });
});

describe("what is shown for sale", () => {
  const unread = (gate: ReturnType<typeof make>) => (gate.info().unread as Record<string, string>)[HOUR];

  it("is only the seller's own signed listing: one signed by someone else is not shown", async () => {
    // A stranger publishes a note under the same name. It is not the listing, whatever a relay hands back.
    relayHolds = [listing("an hour pass", { by: key(4), price: "500" })];
    const gate = await settled(standIn());
    expect([gate.offers, unread(gate)]).toEqual([[], "not-found"]);
    // And one that carries the seller's key and a signature that doesn't hold.
    const real = listing();
    relayHolds = [{ ...real, tags: real.tags.map((t) => (t[0] === "price" ? ["price", "600", "SAT"] : t)) }];
    const forged = await settled(standIn());
    expect([forged.offers, unread(forged)]).toEqual([[], "not-signed"]);
    expect(forged.why).toContain("isn't signed by this world's own key");
  });

  it("is nothing under 500 sats", async () => {
    relayHolds = [listing("an hour pass", { price: "499" })];
    const gate = await settled(standIn());
    expect([gate.state, gate.offers, unread(gate)]).toEqual(["shut", [], "too-cheap"]);
    expect(gate.why).toContain("under 500 sats");
    // Nothing that wasn't read and shown can be bought from here.
    const signer = standIn();
    const again = await settled(signer);
    expect(await again.buy(HOUR)).toBe(false);
    expect(signer.buy).not.toHaveBeenCalled();
  });

  it("is not a listing sold through a service the kit can't take a receipt from, one that is withdrawn, one with shares, or one for somewhere else", async () => {
    for (const [why, made] of [
      ["unknown-service", listing("an hour pass", { more: [] }).tags && finalizeEvent({ kind: 30078, created_at: sec(), content: "", tags: listing().tags.map((t) => (t[0] === "br:unlock-service" ? [t[0], "https://elsewhere.example"] : t)) }, key(2))],
      ["not-for-sale", finalizeEvent({ kind: 30078, created_at: sec(), content: "", tags: listing().tags.map((t) => (t[0] === "status" ? ["status", "withdrawn"] : t)) }, key(2))],
      ["shared", listing("an hour pass", { more: [["nswp:share", SELLER, "9000"], ["nswp:share", OTHER, "1000"]] })],
      ["not-for-here", finalizeEvent({ kind: 30078, created_at: sec(), content: "", tags: listing().tags.map((t) => (t[0] === "nswp:for" ? [t[0], `37300:${SELLER}:another-world`] : t)) }, key(2))],
    ] as const) {
      relayHolds = [made];
      const gate = await settled(standIn());
      expect([gate.offers, unread(gate)]).toEqual([[], why]);
      gate.dispose();
    }
  });

  it("is the newest the seller signed under that name", async () => {
    relayHolds = [listing("an hour pass", { price: "500", at: sec() - 900 }), listing("an hour pass", { price: "900", at: sec() - 100 })];
    expect((await settled(standIn())).offers[0]!.sats).toBe(900);
  });

  it("is asked for again when no relay answered, and a receipt still opens the gate meanwhile", async () => {
    relaysUp = false;
    const signer = standIn();
    const gate = await settled(signer);
    expect([gate.state, gate.offers, unread(gate)]).toEqual(["shut", [], "no-relay"]);
    expect(gate.why).toContain("no relay answered");
    relaysUp = true;
    await pass(20_000);
    await pass(0);
    expect(gate.offers.map((o) => o.name)).toEqual(["An hour here"]);
    // Someone who paid isn't kept out because a relay is down: the receipt names its listing itself.
    relaysUp = false;
    const holder = standIn();
    holder.holds[HOUR] = receipt();
    expect((await settled(holder)).open).toBe(true);
  });
});

describe("the one control", () => {
  it("names what is for sale and calls buy at the visitor's press; a receipt that holds up opens the gate", async () => {
    const signer = standIn();
    const gate = await settled(signer);
    const c = consoleFor(gate);
    expect(c.labels()).toEqual(["Go home", "Buy An hour here: 500 sats, for 1 hour"]);
    expect(c.said).toEqual(["Past here is for people who have bought it: An hour here, 500 sats, for 1 hour."]);
    // Nothing was asked for before the press.
    expect(signer.buy).not.toHaveBeenCalled();
    signer.sells = timed(3600);
    expect(c.controls.run("gate-buy")).toBe(true);
    await pass(0);
    await pass(0);
    expect(signer.buy).toHaveBeenCalledExactlyOnceWith(HOUR);
    expect([gate.state, gate.open, gate.until]).toEqual(["open", true, sec() + 3600]);
    expect(c.said[1]).toBe("signin.example is asking: An hour here, 500 sats, for 1 hour. Say yes there, and the way opens.");
    expect(c.said[2]).toMatch(/^Bought: An hour here\. The way is open until /);
    // Open, the control is gone.
    expect(c.labels()).toEqual(["Go home"]);
  });

  it("keeps its place: ahead of what a world adds after it, so it is the first thing in the tab after the way home", async () => {
    const c = consoleFor(await settled(standIn()));
    c.controls.add({ id: "door-0", section: "travel", label: "A door", act: () => {} });
    expect(c.labels()).toEqual(["Go home", "Buy An hour here: 500 sats, for 1 hour", "A door"]);
  });

  it("says nothing of a price before it has been read", async () => {
    // Relays take their time: the visitor is known to hold nothing before what is for sale is known.
    let answer: () => void = () => {};
    const slow = vi.fn((relays: string[], filter: Filter) => new Promise<QueryResult>((done) => (answer = () => void query(relays, filter).then(done))));
    const gate = await settled(standIn(), { query: slow });
    const c = consoleFor(gate);
    expect([gate.state, gate.read, c.said]).toEqual(["shut", false, []]);
    answer();
    await pass(0);
    await pass(0);
    expect(c.said).toEqual(["Past here is for people who have bought it: An hour here, 500 sats, for 1 hour."]);
    // And it is said once: a later look changes nothing.
    await pass(GATE_TIMES.look * 1000);
    expect(c.said).toHaveLength(1);
  });

  it("comes after the things every place has: the way home keeps the first key", async () => {
    const c = consoleFor(await settled(standIn()));
    expect(c.controls.view().hotbar.map((i) => [i.id, i.key])).toEqual([["home", "1"], ["gate-buy", "2"]]);
  });

  it("does not believe the word 'bought': a purchase that comes back with no receipt, or the wrong one, opens nothing", async () => {
    for (const back of [null, receipt({ buyerPubkey: OTHER }), receipt({ productCoordinate: GOOD }), receipt({}, key(9)), { paid: true } as unknown as NostrEvent]) {
      const signer = standIn();
      signer.sells = back;
      const gate = await settled(signer);
      const c = consoleFor(gate);
      c.controls.run("gate-buy");
      await pass(0);
      await pass(0);
      expect([gate.state, gate.open]).toEqual(["shut", false]);
      expect(c.said.at(-1)).toBe("That didn't finish, and the way is still shut. If you did pay, press Buy again: it finds what you paid for and charges nothing more.");
      gate.dispose();
    }
  });

  it("offers sign-in first to someone who isn't signed in, and asks nobody to buy", async () => {
    const signer = standIn({ state: "locked", pubkey: null });
    const gate = await settled(signer);
    expect([gate.state, gate.reason, gate.signedIn]).toEqual(["shut", "signed-out", false]);
    const c = consoleFor(gate);
    expect(c.labels()).toEqual(["Go home", "Sign in to buy An hour here: 500 sats, for 1 hour"]);
    expect(c.said[0]).toBe("Past here is for people who have bought it: An hour here, 500 sats, for 1 hour. Sign in to buy, or to show what you already hold.");
    c.controls.run("gate-buy");
    await pass(0);
    expect(c.signIn).toHaveBeenCalledOnce();
    expect(signer.buy).not.toHaveBeenCalled();
    expect(signer.have).not.toHaveBeenCalled();
    // Signed in, and holding a receipt: the gate opens with nothing more pressed.
    signer.holds[HOUR] = receipt();
    signer.change({ state: "unlocked", pubkey: ME });
    await pass(0);
    await pass(0);
    expect(gate.open).toBe(true);
    // Signed in, holding nothing: the same row now buys.
    const other = standIn({ state: "locked", pubkey: null });
    const second = await settled(other);
    const c2 = consoleFor(second);
    other.change({ state: "unlocked", pubkey: ME });
    await pass(0);
    await pass(0);
    expect([second.reason, c2.labels()[1]]).toEqual(["nothing-held", "Buy An hour here: 500 sats, for 1 hour"]);
  });

  it("notices a sign-in address that is named a moment after the gate began", async () => {
    // A world that starts its gate before it has said where signing in is done: nobody to ask, at first.
    let named: StandIn | null = null;
    const gate = createPaidGate({ signer: () => named as unknown as GateSigner | null, url: WORLD, manifest: () => file(), query, status, now: () => clock });
    await pass(0);
    await pass(0);
    expect([gate.state, gate.reason]).toEqual(["shut", "no-signer"]);
    named = standIn({ state: "locked", pubkey: null });
    await pass(3000);
    expect([gate.state, gate.reason]).toEqual(["shut", "signed-out"]);
    // And from then on it is listened to: signing in, holding a receipt, opens the gate with no wait.
    named.holds[HOUR] = receipt();
    named.change({ state: "unlocked", pubkey: ME });
    await pass(0);
    await pass(0);
    expect(gate.open).toBe(true);
    gate.dispose();
  });

  it("says so where there is no sign-in address at all, and offers nothing to press", async () => {
    const gate = await settled(null);
    expect([gate.state, gate.reason]).toEqual(["shut", "no-signer"]);
    expect(gate.why).toContain("this world was given none for you");
    expect(consoleFor(gate).labels()).toEqual(["Go home"]);
  });

  it("in a headset, tells the visitor to step out, and asks nothing of their sign-in address", async () => {
    const signer = standIn();
    signer.sells = receipt();
    const gate = await settled(signer);
    const c = consoleFor(gate, { presenting: true });
    c.controls.run("gate-buy");
    await pass(0);
    expect(c.said.at(-1)).toBe("signin.example has to ask you this itself, which can't be seen from in here. Step out of the headset and press this again.");
    expect(signer.buy).not.toHaveBeenCalled();
    expect(gate.open).toBe(false);
  });

  it("gives each thing for sale a row of its own", async () => {
    file = async () => manifest([HOUR, GOOD]);
    const signer = standIn();
    const gate = await settled(signer);
    const c = consoleFor(gate);
    expect(c.labels()).toEqual(["Go home", "Buy An hour here: 500 sats, for 1 hour", "Buy Here, for good: 2100 sats, once"]);
    expect(c.said[0]).toBe("Past here is for people who have bought it: An hour here, 500 sats, for 1 hour; or Here, for good, 2100 sats, once.");
    signer.sells = receipt({ productCoordinate: GOOD, fulfillmentId: "f2" });
    c.controls.run("gate-buy-2");
    await pass(0);
    await pass(0);
    expect(signer.buy).toHaveBeenCalledExactlyOnceWith(GOOD);
    expect(gate.open).toBe(true);
    expect(c.said.at(-1)).toBe("Bought: Here, for good. The way is open for good.");
  });

  it("asks again when what it costs couldn't be read", async () => {
    relaysUp = false;
    const gate = await settled(standIn());
    const c = consoleFor(gate);
    expect(c.labels()).toEqual(["Go home", "Ask again what this costs"]);
    relaysUp = true;
    c.controls.run("gate-buy");
    await pass(0);
    await pass(0);
    expect(c.labels()).toEqual(["Go home", "Buy An hour here: 500 sats, for 1 hour"]);
  });
});

describe("a world owner's block list", () => {
  const KEEPER = pk(5);
  /** A world that keeps lists (its manifest names keepers), and sells nothing unless told. */
  const keeps = (more: Record<string, unknown> = {}, keepers: string[] = [KEEPER]) => ({ ...manifest(null), worlds: { "a-world": { entry: { url: WORLD }, keepers, ...more } } });
  const blockList = (people: string[], o: { by?: Uint8Array; at?: number; content?: string } = {}) => {
    const t = ownerListTemplate({ scope: "user-deny", subject: worldSubject(SELLER, "a-world"), people, createdAt: o.at ?? sec() - 30 })!;
    return finalizeEvent({ ...t, content: o.content ?? "" }, o.by ?? key(5));
  };

  it("stops a signed-in visitor the owner blocked, says so plainly, and offers nothing to press", async () => {
    file = async () => keeps();
    relayHolds = [blockList([ME])];
    const gate = await settled(standIn());
    expect([gate.state, gate.open, gate.reason, gate.lists, gate.ownerBlocked]).toEqual(["shut", false, "blocked", "read", [ME]]);
    expect(gate.why).toBe("The owner of this world has asked you not to come in.");
    const c = consoleFor(gate);
    expect(c.labels()).toEqual(["Go home"]);
    expect(c.said).toEqual(["The owner of this world has asked you not to come in."]);
  });

  it("lets everyone else in, guests included, in a world that sells nothing", async () => {
    file = async () => keeps();
    relayHolds = [blockList([OTHER])];
    expect([(await settled(standIn())).state, (await settled(standIn({ state: "locked", pubkey: null }))).state, (await settled(null)).state]).toEqual(["open", "open", "open"]);
    // Said plainly in the protocol: a block stops a name. Signed out, the person blocked is a guest, and walks in.
    relayHolds = [blockList([ME], { at: sec() - 10 })];
    const signer = standIn({ state: "locked", pubkey: null });
    const gate = await settled(signer);
    expect(gate.open).toBe(true);
    signer.change({ state: "unlocked", pubkey: ME });
    await pass(0);
    expect([gate.state, gate.reason]).toEqual(["shut", "blocked"]);
  });

  it("beats a receipt: someone blocked is kept out of a paid world whatever they hold", async () => {
    file = async () => keeps({ access: [HOUR] });
    relayHolds = [listing(), blockList([ME])];
    const signer = standIn();
    signer.holds[HOUR] = receipt();
    signer.sells = receipt();
    const gate = await settled(signer);
    expect([gate.state, gate.reason]).toEqual(["shut", "blocked"]);
    expect(await gate.buy(HOUR)).toBe(false);
    expect(signer.buy).not.toHaveBeenCalled();
  });

  it("never keeps a keeper out of their own world", async () => {
    file = async () => keeps();
    relayHolds = [blockList([KEEPER, ME])];
    const keeper = standIn({ pubkey: KEEPER });
    expect((await settled(keeper)).open).toBe(true);
  });

  it("counts only a keeper's list: one signed by anyone else, the world's own key included, is not the owner's word", async () => {
    file = async () => keeps();
    relayHolds = [blockList([ME], { by: key(9) }), blockList([ME], { by: key(2) })];
    const gate = await settled(standIn());
    expect([gate.state, gate.lists, gate.ownerBlocked]).toEqual(["open", "not-found", []]);
    // Where the manifest names the world's own key among the keepers, its list counts.
    file = async () => keeps({}, [KEEPER, SELLER]);
    expect((await settled(standIn())).reason).toBe("blocked");
  });

  it("reads no list in a world that names no keepers: nothing asked, nobody blocked", async () => {
    file = async () => manifest(null);
    relayHolds = [blockList([ME])];
    const gate = await settled(standIn());
    expect([gate.state, gate.lists]).toEqual(["free", "none"]);
    expect(query).not.toHaveBeenCalled();
  });

  it("stops nobody when no relay answers and nothing is remembered, says so, and asks again soon", async () => {
    file = async () => keeps();
    relayHolds = [blockList([ME])];
    relaysUp = false;
    const gate = await settled(standIn());
    expect([gate.state, gate.lists, gate.ownerBlocked]).toEqual(["open", "unanswered", []]);
    // The relay comes back: asked again within twenty seconds, not at the next five-minute look.
    relaysUp = true;
    await pass(20_000);
    await pass(0);
    expect([gate.state, gate.reason, gate.lists]).toEqual(["shut", "blocked", "read"]);
  });

  it("keeps the newest list it has seen: an older copy from a relay doesn't unblock anyone", async () => {
    file = async () => keeps();
    relayHolds = [blockList([ME], { at: sec() - 30 })];
    expect((await settled(standIn())).reason).toBe("blocked");
    // Later, a relay hands over the list from before the block. The remembered newer one stands.
    relayHolds = [blockList([], { at: sec() - 3000 })];
    expect((await settled(standIn())).reason).toBe("blocked");
    // And with no relay answering at all, the remembered copy is what stands.
    relaysUp = false;
    const offline = await settled(standIn());
    expect([offline.reason, offline.lists]).toEqual(["blocked", "unanswered"]);
  });

  it("takes a newer list as the owner's change: unblocking someone lets them in at the next look", async () => {
    file = async () => keeps();
    relayHolds = [blockList([ME], { at: sec() - 300 })];
    const gate = await settled(standIn());
    expect(gate.reason).toBe("blocked");
    relayHolds = [blockList([], { at: sec() - 10 })];
    await pass(GATE_TIMES.look * 1000);
    await pass(0);
    expect([gate.state, gate.ownerBlocked]).toEqual(["open", []]);
  });

  it("stops nobody on a list whose newest copy is refused, and says it is unreadable", async () => {
    file = async () => keeps();
    relayHolds = [blockList([ME], { at: sec() - 300 }), blockList([], { at: sec() - 10, content: "hidden" })];
    const gate = await settled(standIn());
    expect([gate.state, gate.lists, gate.ownerBlocked]).toEqual(["open", "unreadable", []]);
  });

  it("leaves out a list dated far ahead: a fast clock can't pin a block in place", async () => {
    file = async () => keeps();
    relayHolds = [blockList([ME], { at: sec() + 3600 })];
    const gate = await settled(standIn());
    expect([gate.state, gate.ownerBlocked]).toEqual(["open", []]);
  });

  it("says whether the world's rooms show only named people, from its manifest", async () => {
    file = async () => keeps({ named_only: true });
    expect((await settled(standIn())).namedOnly).toBe(true);
    file = async () => keeps();
    expect((await settled(standIn())).namedOnly).toBe(false);
  });
});

describe("a pass for a time", () => {
  it("closes the gate when it runs out with the visitor inside: a notice, a couple of minutes, then shut, with no page loaded again", async () => {
    const signer = standIn();
    signer.holds[HOUR] = timed(60);
    const gate = await settled(signer);
    const c = consoleFor(gate);
    const seen: string[] = [];
    gate.onChange(() => seen.push(gate.state));
    expect([gate.state, gate.until]).toEqual(["open", sec() + 60]);
    // The signer no longer hands over a receipt that has run out.
    signer.holds[HOUR] = null;
    await pass(59_000);
    expect(gate.state).toBe("open");
    await pass(1000);
    await pass(0);
    expect([gate.state, gate.open, gate.reason]).toEqual(["ending", true, "run-out"]);
    expect(c.said).toEqual(["Your time here has run out. This part closes in two minutes. Buy again to stay."]);
    expect(c.labels()).toEqual(["Go home", "Buy An hour here: 500 sats, for 1 hour"]);
    await pass((GATE_TIMES.grace - 1) * 1000);
    expect(gate.open).toBe(true);
    await pass(1000);
    expect([gate.state, gate.open, gate.reason]).toEqual(["shut", false, "run-out"]);
    expect(c.said.at(-1)).toBe("Your time here has run out. Past here is for people who have bought it: An hour here, 500 sats, for 1 hour.");
    expect(seen).toContain("ending");
  });

  it("stays open through its end when it was bought again", async () => {
    const signer = standIn();
    signer.holds[HOUR] = timed(60);
    const gate = await settled(signer);
    // Bought again elsewhere before the end: the signer now holds the one that runs on.
    signer.holds[HOUR] = timed(3660, { fulfillmentId: "f2" });
    await pass(60_000);
    await pass(0);
    expect([gate.state, gate.until]).toEqual(["open", sec() + 3600]);
    // And bought again in the last two minutes: open once more.
    const late = standIn();
    late.holds[HOUR] = timed(60);
    const second = await settled(late);
    late.holds[HOUR] = null;
    await pass(60_000);
    await pass(0);
    expect(second.state).toBe("ending");
    late.sells = timed(3600, { fulfillmentId: "f3" });
    expect(await second.buy()).toBe(true);
    expect(second.state).toBe("open");
    await pass(GATE_TIMES.grace * 1000);
    expect(second.state).toBe("open");
  });

  it("is not open on arrival once it has run out, with no couple of minutes: those are for someone inside", async () => {
    const signer = standIn();
    signer.holds[HOUR] = receipt({ issuedAt: sec() - 7200, accessPolicy: { kind: "term-v1", expiresAt: sec() - 60 } });
    const gate = await settled(signer);
    expect([gate.state, gate.reason]).toEqual(["shut", "nothing-held"]);
  });

  it("keeps what it holds when the signer later says 'none': a pass is not lost to a signer's forgetting", async () => {
    const signer = standIn();
    signer.holds[HOUR] = timed(7200);
    const gate = await settled(signer);
    signer.holds[HOUR] = null;
    await pass(GATE_TIMES.look * 1000);
    await pass(0);
    expect(gate.open).toBe(true);
  });
});

describe("who it is open for", () => {
  it("shuts at once when the visitor signs out, or someone else signs in", async () => {
    const signer = standIn();
    signer.holds[HOUR] = receipt();
    const gate = await settled(signer);
    expect(gate.open).toBe(true);
    signer.change({ state: "locked", pubkey: null });
    await pass(0);
    expect([gate.state, gate.reason]).toEqual(["shut", "signed-out"]);
    // Someone else, on the same device: the first one's receipt is not theirs.
    signer.change({ state: "unlocked", pubkey: OTHER });
    await pass(0);
    await pass(0);
    expect([gate.state, gate.reason]).toEqual(["shut", "nothing-held"]);
  });
});

describe("a receipt taken back since it was signed", () => {
  it("shuts the gate when the service that signed it says so", async () => {
    serviceSays = "taken-back";
    const signer = standIn();
    signer.holds[HOUR] = receipt();
    const gate = await settled(signer);
    const c = consoleFor(gate);
    expect([gate.state, gate.reason]).toEqual(["shut", "taken-back"]);
    expect(gate.why).toContain("was taken back by the service that sold it");
    expect(status).toHaveBeenCalledOnce();
    // It is not believed again on this page, however often it is handed over.
    await pass(GATE_TIMES.look * 1000);
    await pass(0);
    expect(gate.open).toBe(false);
    expect(c.labels()[1]).toBe("Buy An hour here: 500 sats, for 1 hour");
  });

  it("asks the service that signed it by the receipt's own name, and sends nothing else: no key, nothing of the world or the visitor", async () => {
    const calls: { url: string; init: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: Record<string, unknown> = {}) => {
      calls.push({ url: String(url), init });
      return { ok: true, json: async () => ({ fulfillmentId: "a b/c", revokedAt: null }) };
    });
    try {
      const signer = standIn();
      signer.holds[HOUR] = receipt({ fulfillmentId: "a b/c" });
      // No stand-in for the asking this time: the kit's own.
      const gate = createPaidGate({ signer: () => signer as unknown as GateSigner, url: WORLD, manifest: () => file(), query, now: () => clock });
      await pass(0);
      await pass(0);
      expect(gate.open).toBe(true);
      expect(calls.map((c) => c.url)).toEqual(["https://unlock.example/entitlements/a%20b%2Fc/status"]);
      const { signal, ...sent } = calls[0]!.init;
      expect(sent).toEqual({ credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" });
      // Nowhere in what was sent: the visitor's key, the seller's, the listing, or this world's address.
      const all = JSON.stringify(calls);
      for (const not of [ME, SELLER, "an hour pass", "world.example"]) expect(all).not.toContain(not);
      // "Taken back" is believed from that answer, and from nothing else in it.
      vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ revokedAt: 1_800_000_100 }) }));
      await pass(GATE_TIMES.look * 1000);
      await pass(0);
      expect([gate.state, gate.reason]).toEqual(["shut", "taken-back"]);
    } finally {
      vi.unstubAllGlobals();
      (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
    }
  });

  it("is asked about no oftener than every few minutes", async () => {
    const signer = standIn();
    signer.holds[HOUR] = receipt();
    const gate = await settled(signer);
    expect(gate.open).toBe(true);
    expect(status).toHaveBeenCalledTimes(1);
    signer.change({});
    signer.change({});
    await pass(60_000);
    expect(status).toHaveBeenCalledTimes(1);
    await pass(GATE_TIMES.look * 1000);
    await pass(0);
    expect(status).toHaveBeenCalledTimes(2);
  });

  it("with the service out of reach: good for a day from when it was last found good, and shut after", async () => {
    serviceSays = "unknown";
    // Signed within the day: it was good when it was signed.
    const fresh = standIn();
    fresh.holds[HOUR] = receipt();
    expect((await settled(fresh)).open).toBe(true);
    // Signed long ago and never found good on this device: shut until the service answers.
    const old = standIn();
    old.holds[HOUR] = receipt({ issuedAt: sec() - 3 * 86_400, fulfillmentId: "old" });
    const gate = await settled(old);
    expect([gate.state, gate.reason]).toEqual(["shut", "unchecked"]);
    expect(gate.why).toContain("couldn't be asked whether it still stands");
    // Signed long ago and found good two hours ago: still good.
    kept.set("nswp:receipts:good", JSON.stringify({ seen: clock - 2 * 3600_000 }));
    const seen = standIn();
    seen.holds[HOUR] = receipt({ issuedAt: sec() - 3 * 86_400, fulfillmentId: "seen" });
    const open = await settled(seen);
    expect(open.open).toBe(true);
    // A day on with the service still out of reach, it shuts where it stands.
    clock += GATE_TIMES.goodFor * 1000;
    await pass(GATE_TIMES.look * 1000);
    await pass(0);
    expect([open.state, open.reason]).toEqual(["shut", "unchecked"]);
    // And opens again when the service answers.
    serviceSays = "stands";
    await pass(GATE_TIMES.look * 1000);
    await pass(0);
    expect(open.open).toBe(true);
  });
});
