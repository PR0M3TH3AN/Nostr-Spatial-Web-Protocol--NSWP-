import { finalizeEvent, learnRelays, pickRelays, RELAY_DISCOVERY_KIND, RELAY_PICK, relayScore, type Filter, type NostrEvent, type RelayNotes } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { askWell, forgetRelays, learnFrom, publishBacked, queryBacked, relayBackup, relaysWell, sendWell } from "../src/relay-book.js";

const A = "wss://a.example";
const B = "wss://b.example";
const C = "wss://c.example";
const U1 = "wss://usual-one.example";
const U2 = "wss://usual-two.example";
const U3 = "wss://usual-three.example";
const usual = [U1, U2, U3];
const t = 1_800_000_000_000;
const after = (notes: RelayNotes, results: Record<string, string>, times = 1) => {
  for (let i = 0; i < times; i++) notes = learnRelays(notes, results, t);
  return notes;
};

describe("which relays are working", () => {
  it("knows nothing of a relay it hasn't tried, and learns from each answer", () => {
    expect(relayScore(undefined, t)).toBe(0.5);
    const good = after({}, { [A]: "ok" }, 4);
    const bad = after({}, { [A]: "timeout" }, 4);
    expect(relayScore(good[A], t)).toBeGreaterThan(0.8);
    expect(relayScore(bad[A], t)).toBeLessThan(RELAY_PICK.working);
    // An answer to a question counts as an answer; a refusal doesn't.
    expect(relayScore(after({}, { [A]: "eose" })[A], t)).toBeGreaterThan(0.5);
    expect(relayScore(after({}, { [A]: "blocked: not on the list" })[A], t)).toBeLessThan(0.5);
  });

  it("lets lately count for more, and gives a relay another chance after a week", () => {
    // Long down, and then up again: a few answers bring it back.
    let notes = after({}, { [A]: "timeout" }, 30);
    notes = after(notes, { [A]: "ok" }, 8);
    expect(relayScore(notes[A], t)).toBeGreaterThan(0.5);
    const down = after({}, { [A]: "timeout" }, 10);
    expect(relayScore(down[A], t + RELAY_PICK.staleMs + 1)).toBe(0.5);
    // Only so many are remembered, and nothing that isn't a relay's address.
    const many = learnRelays({}, Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`wss://r${i}.example`, "ok"])), t);
    expect(Object.keys(many)).toHaveLength(RELAY_PICK.kept);
    expect(Object.keys(learnRelays({}, { "http://not-a-relay.example": "ok", nonsense: "ok" }, t))).toEqual([]);
  });
});

describe("where something of a person's is sent", () => {
  it("is their own relays, all of them, when they are answering", () => {
    const notes = after({}, { [A]: "ok", [B]: "ok", [C]: "ok" }, 3);
    expect(pickRelays({ own: [A, B, C], usual, notes, now: t })).toEqual({ relays: [A, B, C], own: 3, added: [] });
  });

  it("puts the ones that have been answering first, and still uses the rest", () => {
    let notes = after({}, { [A]: "timeout", [B]: "ok", [C]: "ok" }, 5);
    notes = after(notes, { [C]: "ok" }, 3);
    const picked = pickRelays({ own: [A, B, C], usual, notes, now: t });
    expect(picked.relays.slice(0, 3)).toEqual([C, B, A]);
    // Two of theirs are up, so one of the usual ones is added to make three that are.
    expect(picked.added).toHaveLength(1);
    expect(picked.own).toBe(3);
  });

  it("adds the best of the usual relays when too few of their own are up", () => {
    const notes = after(after({}, { [A]: "timeout" }, 6), { [U2]: "ok", [U1]: "timeout" }, 6);
    const picked = pickRelays({ own: [A], usual, notes, now: t });
    expect(picked.relays[0]).toBe(A);
    // The one that has been answering first, then one nothing is known of; the one known to be down is left out.
    expect(picked.added).toEqual([U2, U3]);
  });

  it("is the usual relays, best first, for someone who has published no list", () => {
    const notes = after({}, { [U3]: "ok", [U1]: "timeout" }, 6);
    const picked = pickRelays({ own: [], usual, notes, now: t });
    expect(picked.own).toBe(0);
    expect(picked.relays.slice(0, 2)).toEqual([U3, U2]);
  });

  it("never drops a person's own relay for being down: it is where they said to look", () => {
    const notes = after({}, { [A]: "timeout", [B]: "timeout" }, 10);
    expect(pickRelays({ own: [A, B], usual, notes, now: t }).relays.slice(0, 2).sort()).toEqual([A, B]);
  });
});

describe("sending well", () => {
  const event = { id: "e".repeat(64) } as NostrEvent;
  beforeEach(() => forgetRelays());

  it("remembers who took it, and leans on them next time", async () => {
    const up = new Set([B, U2]);
    const publish = async (to: string[]) => ({ relays: Object.fromEntries(to.map((r) => [r, up.has(r) ? "ok" : "timeout"])) });
    for (let i = 0; i < 4; i++) await sendWell(event, { own: [A, B], usual, publish: publish as never, now: () => t });
    expect(relaysWell({ own: [A, B], usual }, t).relays[0]).toBe(B);
    expect(relaysWell({ own: [], usual }, t).relays[0]).toBe(U2);
  });

  it("tries the rest of the usual relays once when nothing took it", async () => {
    const tried: string[][] = [];
    const publish = async (to: string[]) => {
      tried.push(to);
      return { relays: Object.fromEntries(to.map((r) => [r, r === U3 ? "ok" : "timeout"])) };
    };
    // What is known: the first two usual relays have been answering, the third hasn't been tried.
    learnFrom({ [U1]: "ok", [U2]: "ok" }, t);
    learnFrom({ [U1]: "ok", [U2]: "ok" }, t);
    const sent = await sendWell(event, { own: [A], usual, publish: publish as never, now: () => t });
    expect(tried).toHaveLength(2);
    expect(tried[1]).toEqual([U3]);
    expect(sent).toMatchObject({ took: 1, own: 1 });
    expect(sent.relays).toContain(U3);
  });

  it("says plainly when nothing took it anywhere", async () => {
    const publish = async (to: string[]) => ({ relays: Object.fromEntries(to.map((r) => [r, "timeout"])) });
    expect((await sendWell(event, { own: [], usual, publish: publish as never, now: () => t })).took).toBe(0);
  });
});

describe("a backup from relay monitors (NIP-66)", () => {
  beforeEach(() => forgetRelays());
  const key = (n: number) => sha256(utf8ToBytes(`nswp relay-book monitor ${n}`));
  const NOW = 1_800_000_000_000;
  const finding = (by: number, url: string) => finalizeEvent({ kind: RELAY_DISCOVERY_KIND, created_at: NOW / 1000 - 600, tags: [["d", url], ["n", "clearnet"], ["R", "!auth"], ["R", "!payment"], ["rtt-open", "150"]], content: "" }, key(by));
  const monitors = [finding(1, "wss://spare.example"), finding(2, "wss://spare.example"), finding(1, "wss://lonely.example")];
  const note = finalizeEvent({ kind: 1, created_at: NOW / 1000, tags: [], content: "Hello." }, key(9));
  /** Relays where the named ones are down, and the rest keep what they are sent. Monitors' notes are on the discovery relays. */
  const net = (down: string[]) => {
    const n = {
      kept: [] as { relay: string; event: NostrEvent }[],
      asked: [] as string[][],
      query: async (relays: string[], filter: Filter) => {
        n.asked.push(relays);
        const up = relays.filter((r) => !down.includes(r));
        const events = filter.kinds?.includes(RELAY_DISCOVERY_KIND) ? monitors : n.kept.filter((k) => up.includes(k.relay) && (!filter.kinds || filter.kinds.includes(k.event.kind))).map((k) => k.event);
        return { events: up.length ? events : [], relays: Object.fromEntries(relays.map((r) => [r, down.includes(r) ? "timeout" : "eose"])) };
      },
      publish: async (relays: string[], event: NostrEvent) => {
        for (const r of relays) if (!down.includes(r)) n.kept.push({ relay: r, event });
        return { relays: Object.fromEntries(relays.map((r) => [r, down.includes(r) ? "timeout" : "ok"])) };
      },
    };
    return n;
  };
  const USUAL = ["wss://usual-a.example", "wss://usual-b.example"];
  const OWN = ["wss://mine.example"];

  it("is not asked for while anything the person chose is working", async () => {
    const n = net(["wss://mine.example"]);
    const sent = await sendWell(note, { own: OWN, usual: USUAL, publish: n.publish, query: n.query, now: () => NOW });
    expect(sent.took).toBeGreaterThan(0);
    expect(n.asked).toEqual([]);
  });

  it("takes what is sent when everything they chose is down: a relay two monitors found, never one found by one", async () => {
    const n = net([...OWN, ...USUAL]);
    const sent = await sendWell(note, { own: OWN, usual: USUAL, publish: n.publish, query: n.query, now: () => NOW });
    expect(sent.took).toBe(1);
    expect(n.kept.map((k) => k.relay)).toEqual(["wss://spare.example"]);
    expect(sent.relays).toContain("wss://spare.example");
    expect(sent.relays).not.toContain("wss://lonely.example");
    // And what was sent there is found there, the same way.
    const got = await askWell({ kinds: [1] }, { own: OWN, usual: USUAL, query: n.query, now: () => NOW });
    expect(got.events.map((e) => e.id)).toEqual([note.id]);
    // The monitors were asked once: what they said is kept.
    expect(n.asked.filter((r) => r.includes("wss://relay.nostr.watch")).length).toBe(1);
  });

  it("is never used for a wrapped private message", async () => {
    const n = net([...OWN, ...USUAL]);
    const wrap = finalizeEvent({ kind: 1059, created_at: NOW / 1000, tags: [["p", "a".repeat(64)]], content: "sealed" }, key(8));
    const sent = await publishBacked(USUAL, wrap, { publish: n.publish, query: n.query, now: () => NOW });
    expect(Object.keys(sent.relays)).toEqual(USUAL);
    expect(n.kept).toEqual([]);
  });

  it("never stands in for relays that were never named", async () => {
    const n = net([]);
    // Sent to nobody: it goes to nobody, monitors or no monitors.
    const sent = await publishBacked([], note, { publish: n.publish, query: n.query, now: () => NOW });
    expect(sent.relays).toEqual({});
    expect(n.kept).toEqual([]);
    expect((await queryBacked([], { kinds: [1] }, 1000, { query: n.query, now: () => NOW })).events).toEqual([]);
    expect(n.asked.filter((r) => r.includes("wss://relay.nostr.watch"))).toEqual([]);
  });

  it("reaches nothing from a script or a test that didn't hand in what does the sending", async () => {
    // No browser here, and nothing injected: the real network must not be touched. If it were, this would take
    // seconds and might send; it returns at once, with nothing sent.
    const began = Date.now();
    const sent = await publishBacked(["wss://nobody-at-all.invalid"], note, { publish: undefined, now: () => NOW }).catch(() => ({ relays: {} as Record<string, string> }));
    expect(Object.values(sent.relays).filter((said) => said === "ok")).toEqual([]);
    expect(Object.keys(sent.relays).every((r) => r === "wss://nobody-at-all.invalid")).toBe(true);
    expect(Date.now() - began).toBeLessThan(15000);
  });

  it("can be turned off, and changes nothing where there are no monitors to ask", async () => {
    const n = net([...OWN, ...USUAL]);
    relayBackup(false);
    expect((await sendWell(note, { own: OWN, usual: USUAL, publish: n.publish, query: n.query, now: () => NOW })).took).toBe(0);
    expect(n.asked).toEqual([]);
    relayBackup(true);
    const silent = { ...n, query: async (relays: string[]) => ({ events: [], relays: Object.fromEntries(relays.map((r) => [r, "timeout"])) }) };
    expect((await sendWell(note, { own: OWN, usual: USUAL, publish: n.publish, query: silent.query, now: () => NOW })).took).toBe(0);
    expect((await queryBacked(USUAL, { kinds: [1] }, 1000, { query: silent.query, now: () => NOW })).events).toEqual([]);
  });
});
