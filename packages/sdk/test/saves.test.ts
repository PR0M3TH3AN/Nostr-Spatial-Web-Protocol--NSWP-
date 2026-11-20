import { finalizeEvent, getConversationKey, getPublicKey, openSave, saveAddress, sealSave, SAVE_KIND, verifyEvent, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { createSaves } from "../src/saves.js";
import type { WorldSigner } from "../src/signer.js";

const KEY = sha256(utf8ToBytes("nswp test vector key 1"));
const me = getPublicKey(KEY);
const mine = getConversationKey(KEY, me);

/** A signer as a visitor's own client would be, for one world: it does what protocol/12-saves.md says and no more. */
const signerFor = (world: string, clock: () => number) => {
  const s = {
    state: "unlocked" as "unlocked" | "locked",
    pubkey: me as string | null,
    refuse: false,
    save: async (slot: string, data: string) => {
      if (s.state !== "unlocked" || s.refuse) return null;
      const made = sealSave({ conversationKey: mine, world, slot, data, now: clock() / 1000 });
      return made ? finalizeEvent(made, KEY) : null;
    },
    find: async (slot: string) => (s.state === "unlocked" ? saveAddress(mine, world, slot) || null : null),
    open: async (event: NostrEvent) => (s.state === "unlocked" && verifyEvent(event) ? openSave(event, { conversationKey: mine, pubkey: me, world }) : null),
  };
  return s;
};
/** Relays that keep what they are sent and answer by kind, author and `d`. */
const relays = () => {
  const kept: NostrEvent[] = [];
  return {
    kept,
    down: false,
    query: async function (this: { down: boolean }, _relays: string[], filter: Filter) {
      const d = filter["#d"];
      return { events: kept.filter((e) => (!filter.kinds || filter.kinds.includes(e.kind)) && (!filter.authors || filter.authors.includes(e.pubkey)) && (!d || e.tags.some((t) => t[0] === "d" && d.includes(t[1]!)))), relays: {} };
    },
    publish: async function (this: { down: boolean }, to: string[], event: NostrEvent) {
      if (net.down) return { relays: Object.fromEntries(to.map((r) => [r, "timeout"])) };
      kept.push(event);
      return { relays: Object.fromEntries(to.map((r) => [r, "ok"])) };
    },
  };
};
let net = relays();
const device = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const setup = (world = "https://arcade.example") => {
  net = relays();
  let t = 1_800_000_000_000;
  const clock = () => (t += 1000);
  const signer = signerFor(world, clock);
  const storage = device();
  const make = (o: { signer?: ReturnType<typeof signerFor> | null; storage?: ReturnType<typeof device> } = {}) =>
    createSaves({ signer: (o.signer === undefined ? signer : o.signer) as unknown as WorldSigner | null, storage: o.storage ?? storage, now: clock, query: net.query as never, publish: net.publish as never, relays: ["wss://one.example", "wss://two.example"] });
  return { signer, storage, make, clock };
};

describe("saves", () => {
  it("keeps a guest's save on the device, and says so", async () => {
    const { make } = setup();
    const saves = make({ signer: null });
    expect(await saves.load()).toBeNull();
    expect(await saves.save("level 2")).toMatchObject({ kept: "device" });
    expect(await saves.load()).toMatchObject({ data: "level 2", from: "device" });
    expect(net.kept).toHaveLength(0);
  });

  it("keeps a signed-in visitor's save with their account, where another device finds it", async () => {
    const { make } = setup();
    expect(await make().save("level 3")).toEqual({ kept: "account", said: "Saved to your account." });
    expect(net.kept).toHaveLength(1);
    expect(net.kept[0]!.kind).toBe(SAVE_KIND);
    expect(JSON.stringify(net.kept[0])).not.toContain("level 3");
    // Another device: nothing kept there, the same account.
    expect(await make({ storage: device() }).load()).toMatchObject({ data: "level 3", from: "account" });
  });

  it("gives the newer of the device's and the account's", async () => {
    const { make, signer } = setup();
    const here = make();
    await here.save("old, from here");
    const elsewhere = make({ storage: device() });
    await elsewhere.save("newer, from another device");
    expect(await here.load()).toMatchObject({ data: "newer, from another device", from: "account" });
    // Offline, and saved here since: this device's is the newer.
    net.down = true;
    expect(await here.save("newest, offline")).toMatchObject({ kept: "device" });
    expect(await here.load()).toMatchObject({ data: "newest, offline", from: "device" });
    // Back in reach: the next load takes it up into their account.
    net.down = false;
    await here.load();
    await new Promise((done) => setTimeout(done, 20));
    expect(await make({ storage: device() }).load()).toMatchObject({ data: "newest, offline", from: "account" });
    void signer;
  });

  it("takes up what a guest saved once they sign in", async () => {
    const { make, storage } = setup();
    await make({ signer: null }).save("as a guest");
    const saves = make({ storage });
    // Loading it is enough: the world doesn't have to save again for it to follow them. Loading twice in one
    // moment has it signed once.
    const [first] = await Promise.all([saves.load(), saves.load()]);
    expect(first).toMatchObject({ data: "as a guest", from: "device" });
    await new Promise((done) => setTimeout(done, 20));
    expect(net.kept).toHaveLength(1);
    expect(await make({ storage: device() }).load()).toMatchObject({ data: "as a guest", from: "account" });
    // And it is taken up once: loading again sends nothing more.
    await saves.load();
    await new Promise((done) => setTimeout(done, 20));
    expect(net.kept).toHaveLength(1);
  });

  it("keeps slots apart, and clears one", async () => {
    const { make } = setup();
    const saves = make();
    await saves.save("one", "run-1");
    await saves.save("two", "run-2");
    expect((await saves.load("run-1"))?.data).toBe("one");
    expect((await saves.load("run-2"))?.data).toBe("two");
    expect(await saves.load()).toBeNull();
    await saves.clear("run-1");
    expect(await saves.load("run-1")).toBeNull();
    expect(await make({ storage: device() }).load("run-1")).toBeNull();
    expect((await make({ storage: device() }).load("run-2"))?.data).toBe("two");
  });

  it("never hands one world another world's save", async () => {
    const a = setup("https://arcade.example");
    await a.make().save("the arcade's");
    const kept = [...net.kept];
    // Another world, the same person, the same relays: it finds nothing at its own address, and can't open the arcade's.
    const other = signerFor("https://other.example", a.clock);
    const b = createSaves({ signer: other as unknown as WorldSigner, storage: device(), now: a.clock, query: net.query as never, publish: net.publish as never, relays: ["wss://one.example"] });
    expect(await b.load()).toBeNull();
    expect(await other.open(kept[0]!)).toBeNull();
  });

  it("falls back to the device when the sign-in says no, and refuses what won't fit", async () => {
    const { make, signer } = setup();
    signer.refuse = true;
    expect(await make().save("x")).toMatchObject({ kept: "device" });
    expect(await make().save("x".repeat(40_000))).toMatchObject({ kept: "nowhere" });
    expect(await make().save("x", "Not A Slot")).toMatchObject({ kept: "nowhere" });
    expect(await make().load("Not A Slot")).toBeNull();
  });
});
