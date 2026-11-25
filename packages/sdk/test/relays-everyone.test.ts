// The other readers and senders of a visitor's own notes, on the relay book's rules (#531 did the Bag): their
// follows, their scores, their own look. On stand-in relays that answer by address, late, or not at all. Each of
// these failed on kit 0.89.0. Nothing here reaches a real relay: every asking and sending is the stand-in's.
import { AVATAR_KIND, encodeNaddr, finalizeEvent, followForWorld, FOLLOWS_KIND, followsIn, getPublicKey, RELAY_LIST_KIND, SCORE_KIND, scoreForWorld, type Board, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { ownLookNote } from "../src/look-models.js";
import { createPeople, type FollowHand } from "../src/people.js";
import { forgetRelays } from "../src/relay-book.js";
import { createScores } from "../src/scores.js";

const KEY = sha256(utf8ToBytes("nswp sdk relays-everyone test key"));
const me = getPublicKey(KEY);
const ann = "a".repeat(64);
const USUAL = ["wss://usual-1.example", "wss://usual-2.example", "wss://usual-3.example", "wss://usual-4.example"];
const own = (n: number) => Array.from({ length: n }, (_, i) => `wss://own-${i + 1}.example`);
let T = 1_800_000_000_000;
const clock = () => (T += 1000);

interface Relay {
  kept: NostrEvent[];
  late?: number;
  down?: boolean;
}
const matches = (e: NostrEvent, f: Filter) =>
  (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)) && (!f["#d"] || e.tags.some((t) => t[0] === "d" && f["#d"]!.includes(t[1]!))) && (!f["#a"] || e.tags.some((t) => t[0] === "a" && f["#a"]!.includes(t[1]!)));
/** Stand-in relays by address: each answers by what it keeps, and runs out of time where it is slower than the wait. */
const net = (relays: Record<string, Relay>) => {
  const n = {
    relays,
    sent: [] as { url: string; id: string }[],
    query: async (urls: string[], filter: Filter, ms = 4000) => {
      const events: NostrEvent[] = [];
      const said: Record<string, string> = {};
      for (const url of urls) {
        const r = relays[url];
        if (!r || r.down || (r.late ?? 0) > ms) said[url] = "timeout";
        else {
          events.push(...r.kept.filter((e) => matches(e, filter)));
          said[url] = "eose";
        }
      }
      return { events, relays: said };
    },
    publish: async (urls: string[], event: NostrEvent) => {
      const said: Record<string, string> = {};
      for (const url of urls) {
        n.sent.push({ url, id: event.id });
        const r = relays[url];
        if (!r || r.down) said[url] = "timeout";
        else {
          if (!r.kept.some((e) => e.id === event.id)) r.kept.push(event);
          said[url] = "ok";
        }
      }
      return { relays: said };
    },
    has: (url: string, id: string) => !!relays[url]?.kept.some((e) => e.id === id),
  };
  return n;
};
const all = (urls: string[], over: Record<string, Partial<Relay>> = {}): Record<string, Relay> => Object.fromEntries(urls.map((u) => [u, { kept: [], ...over[u] } as Relay]));
const listNote = (relays: string[]) => finalizeEvent({ kind: RELAY_LIST_KIND, created_at: T / 1000 - 1000, tags: relays.map((r) => ["r", r]), content: "" }, KEY);
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

beforeEach(() => forgetRelays());

describe("who a visitor follows", () => {
  it("is found on the twentieth of twenty-three relays of theirs, asked in waves", async () => {
    const mine = own(23);
    const list = finalizeEvent({ kind: FOLLOWS_KIND, created_at: T / 1000 - 100, tags: [["p", ann]], content: "" }, KEY);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine)] }, [mine[19]!]: { kept: [list] } }));
    const hand = {
      pubkey: () => me,
      ready: () => true,
      change: async (had: NostrEvent | null, change: { add: string } | { remove: string }) => {
        const made = followForWorld({ list: had, ...change, pubkey: me, now: clock() / 1000 });
        return made ? finalizeEvent(made, KEY) : null;
      },
    } as unknown as FollowHand;
    const people = createPeople({ hand, relays: USUAL, storage: memory(), now: clock, query: n.query, publish: n.publish });
    expect(await people.load()).toEqual(followsIn(list));
    // And it is put back on the relays of theirs that answered without it.
    await new Promise((r) => setTimeout(r, 0));
    expect(mine.filter((u) => n.has(u, list.id)).length).toBeGreaterThan(1);
  });
});

describe("a visitor's score, sent", () => {
  const BOARDS: Board[] = [{ id: "lantern-run", title: "Lantern Run", order: "low", format: "time" }];
  const ORIGIN = "https://arcade.example";
  const WORLD = `37300:${"9".repeat(64)}:arcade`;
  it("reaches their own relays where their relay list comes at three seconds", async () => {
    const mine = own(4);
    const n = net(all([...USUAL, ...mine], Object.fromEntries(USUAL.map((u) => [u, { kept: [listNote(mine)], late: 3000 }]))));
    const scores = createScores({
      world: WORLD,
      worldUrl: `${ORIGIN}/`,
      boards: BOARDS,
      hand: { pubkey: () => me, sign: async (world, board, score, said) => finalizeEvent(scoreForWorld({ world, board, score, ...said, origin: ORIGIN, now: T / 1000 })!, KEY) },
      relays: USUAL,
      storage: memory(),
      now: clock,
      query: n.query,
      publish: n.publish,
    });
    expect(scores.record("lantern-run", 41_200)).toBe(true);
    const posted = await scores.post("lantern-run");
    expect(posted, posted.said).toMatchObject({ ok: true });
    const sent = n.sent.find((s) => n.relays[s.url]!.kept.some((e) => e.id === s.id && e.kind === SCORE_KIND))!;
    expect(mine.filter((u) => n.has(u, sent.id)).length).toBeGreaterThanOrEqual(3);
  });
});

describe("a visitor's own look", () => {
  it("is found on their own relays, not only on the usual ones and the address's hints", async () => {
    const mine = own(3);
    const look = finalizeEvent({ kind: AVATAR_KIND, created_at: T / 1000 - 100, tags: [["d", "default"]], content: "" }, KEY);
    const n = net(all([...USUAL, ...mine], { [USUAL[0]!]: { kept: [listNote(mine)] }, [mine[2]!]: { kept: [look] } }));
    const naddr = encodeNaddr({ kind: AVATAR_KIND, pubkey: me, identifier: "default" });
    const got = await ownLookNote({ naddr, author: me, relays: USUAL, query: n.query, now: clock });
    expect(got?.id).toBe(look.id);
  });
});
