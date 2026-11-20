import { buildMessageRelays, finalizeEvent, getPublicKey, openWrap, sealMessage, WRAP_KIND, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createMessages, type MessageHand } from "../src/messages.js";
import { forgetRelays } from "../src/relay-book.js";

const key = (n: number) => sha256(utf8ToBytes(`nswp messages test key ${n}`));
const ANN = key(1);
const BO = key(2);
const CY = key(3);
const ann = getPublicKey(ANN);
const bo = getPublicKey(BO);
const cy = getPublicKey(CY);
let T = 1_800_000_000_000;
const clock = () => (T += 1000);

/** Relays that keep what they are sent and answer by kind, author and who it is for. */
const relays = () => {
  const net = {
    kept: [] as NostrEvent[],
    down: false,
    sentTo: [] as string[][],
    query: async (asked: string[], filter: Filter) => ({
      events: net.down ? [] : net.kept.filter((e) => (!filter.kinds || filter.kinds.includes(e.kind)) && (!filter.authors || filter.authors.includes(e.pubkey)) && (!filter["#p"] || e.tags.some((t) => t[0] === "p" && filter["#p"]!.includes(t[1]!)))),
      relays: Object.fromEntries(asked.map((r) => [r, net.down ? "timeout" : "eose"])),
    }),
    publish: async (to: string[], event: NostrEvent) => {
      net.sentTo.push(to);
      if (!net.down && !net.kept.some((e) => e.id === event.id)) net.kept.push(event);
      return { relays: Object.fromEntries(to.map((r) => [r, net.down ? "timeout" : "ok"])) };
    },
  };
  return net;
};
/** A hand as a visitor's signer is, for a place they have let handle their messages. */
const hand = (secretKey: Uint8Array) => {
  const h = {
    who: getPublicKey(secretKey) as string | null,
    allowed: true,
    opened: 0,
    pubkey: () => h.who,
    ready: () => h.allowed,
    seal: async (to: string, text: string) => sealMessage({ secretKey, to, text, now: T / 1000 }),
    open: async (wrap: NostrEvent) => {
      h.opened++;
      return openWrap(wrap, secretKey);
    },
    reach: async (list: readonly string[]) => finalizeEvent(buildMessageRelays(list, T / 1000)!, secretKey),
  };
  return h as typeof h & MessageHand;
};
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const person = (secretKey: Uint8Array, net: ReturnType<typeof relays>, known: string[] = []) => {
  const h = hand(secretKey);
  const messages = createMessages({ hand: h, relays: ["wss://usual.example"], known: (k) => known.includes(k), storage: memory(), now: clock, query: net.query, publish: net.publish });
  return { h, messages };
};
const inboxOf = (net: ReturnType<typeof relays>, secretKey: Uint8Array, at: string) => net.kept.push(finalizeEvent(buildMessageRelays([at], T / 1000)!, secretKey));

beforeEach(() => forgetRelays());

describe("private messages", () => {
  it("can't reach someone who hasn't said where, until they say", async () => {
    const net = relays();
    const a = person(ANN, net);
    await a.messages.load();
    expect(a.messages.state()).toBe("no-inbox");
    expect((await a.messages.send(bo, "Hello.")).ok).toBe(false);
    const done = await a.messages.setUp();
    expect(done.ok).toBe(true);
    expect(a.messages.state()).toBe("ready");
    expect(a.messages.inbox()).toEqual(["wss://usual.example"]);
    // Bo has said nowhere: nothing is sent, and it says so.
    const sent = await a.messages.send(bo, "Hello.", "Bo");
    expect(sent).toEqual({ ok: false, said: "Bo hasn't said where private messages reach them, so one can't be sent. Nothing was sent." });
    expect(net.kept.filter((e) => e.kind === WRAP_KIND)).toEqual([]);
  });

  it("go from one person to another, and each reads the conversation", async () => {
    const net = relays();
    inboxOf(net, ANN, "wss://ann.example");
    inboxOf(net, BO, "wss://bo.example");
    const a = person(ANN, net, [bo]);
    const b = person(BO, net);
    await a.messages.load();
    await b.messages.load();
    expect((await a.messages.send(bo, "See you at the Arcade?\\nBy the door.")).ok).toBe(true);
    // Sent where Bo reads, and a copy where Ann does.
    expect(net.sentTo).toEqual([["wss://bo.example"], ["wss://ann.example"]]);
    expect(a.messages.thread(bo).map((m) => m.text)).toEqual(["See you at the Arcade?\\nBy the door."]);
    const heard: string[] = [];
    b.messages.onNew((m) => heard.push(m.text));
    await b.messages.load(true);
    // Bo doesn't follow Ann and hasn't written to her: it waits apart, and isn't counted.
    expect(b.messages.conversations()).toMatchObject([{ with: ann, unread: 1, known: false }]);
    expect(b.messages.unread()).toBe(0);
    expect(heard.length).toBe(1);
    expect((await b.messages.send(ann, "Yes. Six?")).ok).toBe(true);
    expect(b.messages.conversations()[0]!.known).toBe(true);
    b.messages.seen(ann);
    expect(b.messages.conversations()[0]!.unread).toBe(0);
    await a.messages.load(true);
    expect(a.messages.thread(bo).map((m) => [m.from === ann ? "Ann" : "Bo", m.text])).toEqual([["Ann", "See you at the Arcade?\\nBy the door."], ["Bo", "Yes. Six?"]]);
    expect(a.messages.unread()).toBe(1);
    // A relay holds wraps by keys used once: neither name, and none of the words.
    const wraps = net.kept.filter((e) => e.kind === WRAP_KIND);
    expect(wraps.length).toBe(4);
    expect(new Set(wraps.map((e) => e.pubkey)).size).toBe(4);
    for (const w of wraps) {
      expect([ann, bo]).not.toContain(w.pubkey);
      expect(w.content).not.toContain("Arcade");
    }
  });

  it("opens each wrap once, and reads back its own on another device", async () => {
    const net = relays();
    inboxOf(net, ANN, "wss://ann.example");
    inboxOf(net, BO, "wss://bo.example");
    const a = person(ANN, net);
    await a.messages.load();
    await a.messages.send(bo, "One.");
    await a.messages.send(bo, "Two.");
    await a.messages.load(true);
    await a.messages.load(true);
    // Its own copies were never handed back to be opened here.
    expect(a.h.opened).toBe(0);
    const elsewhere = person(ANN, net);
    await elsewhere.messages.load();
    expect(elsewhere.messages.thread(bo).map((m) => m.text)).toEqual(["One.", "Two."]);
    expect(elsewhere.h.opened).toBe(2);
    await elsewhere.messages.load(true);
    expect(elsewhere.h.opened).toBe(2);
  });

  it("show nothing of a message that isn't really for them, and nothing to a place that wasn't let", async () => {
    const net = relays();
    inboxOf(net, ANN, "wss://ann.example");
    inboxOf(net, BO, "wss://bo.example");
    const c = person(CY, net);
    inboxOf(net, CY, "wss://cy.example");
    await c.messages.load();
    await c.messages.send(bo, "For Bo.");
    const a = person(ANN, net);
    await a.messages.load();
    expect(a.messages.conversations()).toEqual([]);
    const b = person(BO, net);
    b.h.allowed = false;
    await b.messages.load();
    expect(b.messages.state()).toBe("off");
    expect(b.h.opened).toBe(0);
    expect((await b.messages.send(cy, "Hello.")).ok).toBe(false);
  });

  it("say so when no relay can be reached", async () => {
    const net = relays();
    inboxOf(net, ANN, "wss://ann.example");
    const a = person(ANN, net);
    net.down = true;
    await a.messages.load();
    expect(a.messages.state()).toBe("unreachable");
  });
});
