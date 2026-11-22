import { BAG_KIND, bagIn, buildItem, changeBag, finalizeEvent, getPublicKey, type Filter, type NostrEvent } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBag, type BagHand } from "../src/bag.js";
import { addBagControls, itemIn } from "../src/bagging.js";
import { createItems, fitToSize, forgetItemsSwitch, ITEM_BUDGET, setShowsItems, showsItems, withinBudget } from "../src/items.js";
import { scriptAllowed } from "../src/play.js";
import { arriveWith, currentSettings, resetSettings } from "../src/settings.js";
import { forgetRelays } from "../src/relay-book.js";
import type { Controls, UiAction } from "../src/ui/model.js";

const KEY = sha256(utf8ToBytes("nswp sdk bag test key"));
const MAKER = sha256(utf8ToBytes("nswp sdk bag test maker"));
const me = getPublicKey(KEY);
const maker = getPublicKey(MAKER);
const LANTERN = `37303:${maker}:brass-lantern`;
const BOOK = `37303:${maker}:old-book`;
let T = 1_800_000_000_000;
const clock = () => (T += 1000);
const relays = () => {
  const net = {
    kept: [] as NostrEvent[],
    down: false,
    full: false,
    query: async (asked: string[], filter: Filter) => ({
      events: net.down ? [] : net.kept.filter((e) => (!filter.kinds || filter.kinds.includes(e.kind)) && (!filter.authors || filter.authors.includes(e.pubkey)) && (!filter["#d"] || e.tags.some((t) => t[0] === "d" && filter["#d"]!.includes(t[1]!)))),
      relays: Object.fromEntries(asked.map((r) => [r, net.down ? "timeout" : "eose"])),
    }),
    publish: async (to: string[], event: NostrEvent) => {
      const took = !net.down && !net.full;
      if (took) net.kept.push(event);
      return { relays: Object.fromEntries(to.map((r) => [r, took ? "ok" : "timeout"])) };
    },
  };
  return net;
};
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const hand = () => {
  const h = { allowed: true, signed: 0, ready: () => h.allowed, sign: async (bag: Parameters<BagHand["sign"]>[0]) => (h.signed++, finalizeEvent(bag, KEY)) };
  return h;
};
const bagEvent = (items: string[], at = T / 1000 - 100) => finalizeEvent({ kind: BAG_KIND, created_at: at, tags: [["d", "bag"], ...items.map((i) => ["a", i])], content: "" }, KEY);
const set = (o: { had?: NostrEvent; readOnly?: boolean } = {}) => {
  const net = relays();
  if (o.had) net.kept.push(o.had);
  const h = hand();
  const bag = createBag({ me: () => me, ...(o.readOnly ? {} : { hand: h }), relays: ["wss://one.example"], storage: memory(), now: clock, query: net.query, publish: net.publish });
  return { bag, net, h };
};

beforeEach(() => forgetRelays());

describe("a visitor's bag", () => {
  it("is read from their own newest, and can be looked through anywhere", async () => {
    const { bag } = set({ had: bagEvent([LANTERN, BOOK]), readOnly: true });
    expect(bag.items()).toBeNull();
    expect(await bag.load()).toEqual([LANTERN, BOOK]);
    expect(bag.canChange()).toBe(false);
    expect((await bag.add(BOOK)).why).toBe("read-only");
  });

  it("has an item put in and taken out, keeping the rest", async () => {
    const { bag, net } = set({ had: bagEvent([LANTERN]) });
    expect(await bag.add(BOOK, "Old book")).toEqual({ ok: true, said: "Old book is in your bag. Anyone can see what is in it." });
    expect(bagIn(net.kept.at(-1)!)).toEqual([LANTERN, BOOK]);
    expect((await bag.remove(LANTERN, "Brass lantern")).said).toBe("Brass lantern is out of your bag.");
    expect(bagIn(net.kept.at(-1)!)).toEqual([BOOK]);
    expect((await bag.add(BOOK)).why).toBe("already");
  });

  it("changes nothing when no relay could be reached, and starts a first bag only on a second press", async () => {
    const down = set({ had: bagEvent([LANTERN]) });
    down.net.down = true;
    expect((await down.bag.add(BOOK)).why).toBe("unreachable");
    expect(down.h.signed).toBe(0);
    const none = set();
    expect((await none.bag.add(LANTERN)).why).toBe("no-bag");
    expect(none.h.signed).toBe(0);
    expect((await none.bag.add(LANTERN)).ok).toBe(true);
    expect(bagIn(none.net.kept.at(-1)!)).toEqual([LANTERN]);
  });

  it("isn't taken from a hand that gives back another bag, and is kept when no relay took it", async () => {
    const wrong = set({ had: bagEvent([LANTERN]) });
    wrong.h.sign = async () => finalizeEvent(changeBag(bagEvent([]), { add: BOOK, now: T / 1000 + 50 })!, KEY);
    expect((await wrong.bag.add(BOOK)).why).toBe("refused");
    const full = set({ had: bagEvent([LANTERN]) });
    full.net.full = true;
    expect((await full.bag.add(BOOK)).why).toBe("not-sent");
    expect(full.bag.items()).toEqual([LANTERN, BOOK]);
  });
});

describe("an item's address, copied or typed", () => {
  it("is found as a coordinate among other words, and is nothing when it isn't an item", () => {
    expect(itemIn(`Take this: ${LANTERN} thanks`)).toBe(LANTERN);
    for (const bad of ["", "hello", `37300:${maker}:a-world`, `37303:${maker}:Not A Name`, 5]) expect(itemIn(bad), String(bad)).toBe("");
  });
});

describe("the switch for all items", () => {
  it("is on until they turn it off, and goes with them to the next world", () => {
    arriveWith({});
    forgetItemsSwitch();
    expect(showsItems()).toBe(true);
    setShowsItems(false);
    expect(showsItems()).toBe(false);
    expect(currentSettings().items).toBe(false);
    setShowsItems(true);
    expect(currentSettings().items).toBe(true);
  });

  it("starts as they left it in the world they came from", () => {
    arriveWith({ items: false });
    forgetItemsSwitch();
    expect(showsItems()).toBe(false);
    arriveWith({});
    forgetItemsSwitch();
  });
});

describe("the Bag tab", () => {
  /** A menu that only keeps what it is given, to press by name. */
  const menu = () => {
    const actions = new Map<string, UiAction>();
    const said: string[] = [];
    const controls = { add: (...xs: UiAction[]) => xs.forEach((x) => actions.set(x.id, x)), remove: (id: string) => void actions.delete(id), addSection: () => {}, say: (t: string) => void said.push(t) } as unknown as Controls;
    return { controls, actions, said, press: (id: string) => actions.get(id)?.act?.() };
  };
  const tab = async (rule: string) => {
    const { bag } = set({ had: bagEvent([LANTERN]), readOnly: true });
    const m = menu();
    let held = "";
    const items = { known: () => null, describe: async () => null } as unknown as Parameters<typeof addBagControls>[1]["items"];
    const bagging = addBagControls(m.controls, { bag, items, me: () => me, rule: () => rule, holding: () => held, hold: async (item) => ((held = item), { ok: true, said: item ? "Held." : "Put away." }) });
    await bag.load();
    bagging.refresh();
    m.press(`bag-${maker.slice(0, 8)}-brass-lantern`);
    return { ...m, held: () => held };
  };

  it("offers to hold a thing only in a place that draws what is held", async () => {
    const allowed = await tab("allowed");
    expect(allowed.actions.has("bag-hold")).toBe(true);
    await allowed.press("bag-hold");
    expect(allowed.held()).toBe(LANTERN);

    const none = await tab("none");
    expect(none.actions.has(`bag-${maker.slice(0, 8)}-brass-lantern`)).toBe(true);
    expect(none.actions.has("bag-hold")).toBe(false);
  });

  describe("what was in their hand goes through a door with them", () => {
    const SCRIPT = "c".repeat(64);
    /** They arrive, as a link says they left: and the tab is made as a world makes it. */
    const arrive = async (came: unknown, o: { rule?: string; inBag?: string[]; script?: string } = {}) => {
      arriveWith(came === undefined ? {} : { holding: came });
      const { bag } = set({ had: bagEvent(o.inBag ?? [LANTERN]), readOnly: true });
      const m = menu();
      let held = "";
      let tints: Record<string, string> | undefined;
      const thing = (id: string) => ({ id, title: "Brass lantern", tints: [], ...(o.script ? { script: { sha256: o.script } } : {}) });
      const items = { known: (id: string) => thing(id), describe: async (id: string) => thing(id) } as unknown as Parameters<typeof addBagControls>[1]["items"];
      const bagging = addBagControls(m.controls, { bag, items, me: () => me, rule: () => o.rule ?? "allowed", holding: () => held, hold: async (item, t) => ((held = item), (tints = t), { ok: true, said: item ? "Held." : "Put away." }) });
      await bag.load();
      bagging.refresh();
      await new Promise((ok) => setTimeout(ok, 20));
      return { ...m, held: () => held, tints: () => tints, leaving: () => currentSettings().holding };
    };
    const forget = () => {
      arriveWith({});
      resetSettings();
      try {
        localStorage.removeItem("nswp:item-scripts");
      } catch {
        /* none kept */
      }
    };

    it("is in their hand again where they arrive, in their colours, and goes on from there", async () => {
      const there = await arrive({ item: LANTERN, tints: { accent: "#8b5cf6" } });
      expect(there.held()).toBe(LANTERN);
      expect(there.tints()).toEqual({ accent: "#8b5cf6" });
      expect(there.said.join(" ")).toContain("still in your hand");
      expect(there.leaving()).toMatchObject({ item: LANTERN });
      forget();
    });

    it("is not taken in hand for a link that names a thing they don't have: anyone can write a link", async () => {
      const there = await arrive({ item: BOOK });
      expect(there.held()).toBe("");
      expect(there.said).toEqual([]);
      forget();
    });

    it("goes on through a place with no items, and is not taken in hand there", async () => {
      const there = await arrive({ item: LANTERN }, { rule: "none" });
      expect(there.held()).toBe("");
      // Nothing was put away by their hand, so the next world is still told what they carried.
      expect(there.leaving()).toEqual({ item: LANTERN });
      forget();
    });

    it("is not taken out again once they have put it away themselves", async () => {
      const there = await arrive({ item: LANTERN });
      await there.press("bag-away");
      expect(there.held()).toBe("");
      expect(there.leaving()).toBe("");
      forget();
    });

    it("lets its own logic run unasked only for the very script the link names", async () => {
      // Somewhere to keep what they have let run, as a browser has.
      const kept = new Map<string, string>();
      vi.stubGlobal("localStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) });
      const same = await arrive({ item: LANTERN, script: SCRIPT }, { script: SCRIPT });
      expect(same.held()).toBe(LANTERN);
      expect(scriptAllowed(SCRIPT)).toBe(true);
      forget();
      const changed = await arrive({ item: LANTERN, script: SCRIPT }, { script: "d".repeat(64) });
      expect(changed.held()).toBe(LANTERN);
      expect(scriptAllowed("d".repeat(64))).toBe(false);
      forget();
      vi.unstubAllGlobals();
    });

    it("arriving with nothing said takes nothing in hand", async () => {
      const there = await arrive(undefined);
      expect(there.held()).toBe("");
      expect(there.leaving()).toBeUndefined();
      forget();
    });
  });

  it("offers a few things to take, at a place that can change the bag, and takes one on a press", async () => {
    const { bag, h } = set({ had: bagEvent([LANTERN]) });
    const m = menu();
    const items = { known: () => null, describe: async () => null } as unknown as Parameters<typeof addBagControls>[1]["items"];
    const bagging = addBagControls(m.controls, { bag, items, me: () => me, rule: () => "none", holding: () => "", hold: async () => ({ ok: false, said: "" }), offered: () => [LANTERN, BOOK, "not an item"] });
    await bag.load();
    bagging.refresh();
    // The lantern is already theirs: only the book is offered.
    expect(m.actions.has(`bag-offer-${maker.slice(0, 8)}-old-book`)).toBe(true);
    expect(m.actions.has(`bag-offer-${maker.slice(0, 8)}-brass-lantern`)).toBe(false);
    // What is theirs carries the bag in its corner; what is offered is faint, says it isn't theirs, and is no less pressable.
    const theirs = m.actions.get(`bag-${maker.slice(0, 8)}-brass-lantern`)!;
    const offeredTile = m.actions.get(`bag-offer-${maker.slice(0, 8)}-old-book`)!;
    expect([theirs.mark, theirs.faint?.() ?? false]).toEqual(["bag", false]);
    expect([offeredTile.mark ?? null, offeredTile.faint?.()]).toEqual([null, true]);
    expect(typeof offeredTile.label === "function" ? offeredTile.label() : offeredTile.label).toMatch(/, offered here, not in your bag$/);
    expect(typeof offeredTile.act).toBe("function");
    m.press(`bag-offer-${maker.slice(0, 8)}-old-book`);
    expect(m.actions.has("bag-take")).toBe(true);
    m.press("bag-take");
    await new Promise((done) => setTimeout(done, 20));
    expect(h.signed).toBe(1);
    expect(bag.items()).toEqual([LANTERN, BOOK]);
  });

  it("changes nothing from a world: a bag is changed at its owner's home", async () => {
    const t = await tab("allowed");
    expect(t.actions.has("bag-add")).toBe(false);
    expect(t.actions.has("bag-remove")).toBe(false);
    // And nothing is offered where nothing could be taken.
    const { bag } = set({ had: bagEvent([LANTERN]), readOnly: true });
    const m = menu();
    const items = { known: () => null, describe: async () => null } as unknown as Parameters<typeof addBagControls>[1]["items"];
    addBagControls(m.controls, { bag, items, me: () => me, rule: () => "allowed", holding: () => "", hold: async () => ({ ok: true, said: "" }), offered: () => [BOOK] });
    await bag.load();
    expect([...m.actions.keys()].some((id) => id.startsWith("bag-offer-"))).toBe(false);
  });
});

describe("fetching an item", () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const hash = Array.from(sha256(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
  const described = (o: { sha256?: string } = {}) => finalizeEvent(buildItem({ d: "brass-lantern", title: "Brass lantern", model: { url: "https://items.example/a.glb", sha256: o.sha256 ?? hash }, size: [0.2, 0.4, 0.2], behaviors: ["holdable"], now: T / 1000 })!, MAKER);

  it("takes a description only from the maker its coordinate names, really signed", async () => {
    const net = relays();
    net.kept.push(described());
    const items = createItems({ relays: ["wss://one.example"], query: net.query, now: clock });
    expect((await items.describe(LANTERN))?.title).toBe("Brass lantern");
    expect(items.known(LANTERN)?.id).toBe(LANTERN);
    expect(await items.describe(`37303:${me}:brass-lantern`)).toBeNull();
    expect(await items.describe("not an item")).toBeNull();
    const forged = relays();
    forged.kept.push({ ...finalizeEvent(buildItem({ d: "brass-lantern", title: "Forged", model: { url: "https://items.example/a.glb", sha256: hash }, size: [0.2, 0.4, 0.2], now: T / 1000 })!, KEY), pubkey: maker });
    expect(await createItems({ relays: ["wss://one.example"], query: forged.query, now: clock }).describe(LANTERN)).toBeNull();
  });

  it("draws a plain marker of the item's size where its file is missing or isn't what was promised", async () => {
    const net = relays();
    net.kept.push(described({ sha256: "f".repeat(64) }));
    const fetched: string[] = [];
    const items = createItems({ relays: ["wss://one.example"], query: net.query, now: clock, fetchBytes: async (url) => (fetched.push(url), bytes) });
    const item = (await items.describe(LANTERN))!;
    const drawn = await items.model(item);
    // Its own address is somewhere this visitor doesn't load files from: it is asked for by its hash from the kit's own file host instead.
    expect(fetched).toEqual([`https://grove.bitblocks.network/items/${"f".repeat(64)}.glb`]);
    // Not the file's own shape: a box of the size its description gives, standing on its floor.
    const box = new THREE.Box3().setFromObject(drawn);
    expect(box.getSize(new THREE.Vector3()).toArray().map((n) => Math.round(n * 100) / 100)).toEqual([0.2, 0.4, 0.2]);
    expect(box.min.y).toBeCloseTo(0, 3);
    const none = createItems({ relays: ["wss://one.example"], query: net.query, now: clock, fetchBytes: async () => null });
    expect((await none.model(item)).children.length).toBe(1);
  });

  it("counts what a model holds, and fits one into the box its description gives", () => {
    const small = new THREE.Group();
    small.add(new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshBasicMaterial()));
    expect(withinBudget(small)).toBe(true);
    const fitted = fitToSize(small, [0.2, 0.4, 0.2]);
    const box = new THREE.Box3().setFromObject(fitted);
    expect(box.getSize(new THREE.Vector3()).toArray().map((n) => Math.round(n * 100) / 100)).toEqual([0.2, 0.4, 0.2]);
    expect(box.min.y).toBeCloseTo(0, 3);
    const heavy = new THREE.Group();
    heavy.add(new THREE.Mesh(new THREE.SphereGeometry(1, 200, 200), new THREE.MeshBasicMaterial()));
    expect(withinBudget(heavy)).toBe(false);
    const crowded = new THREE.Group();
    for (let i = 0; i <= ITEM_BUDGET.meshes; i++) crowded.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    expect(withinBudget(crowded)).toBe(false);
    expect(withinBudget(new THREE.Group())).toBe(false);
  });
});

describe("the Bag tab, as it is laid out", () => {
  const menu = () => {
    const actions = new Map<string, UiAction>();
    const said: string[] = [];
    const controls = { add: (...xs: UiAction[]) => xs.forEach((x) => actions.set(x.id, x)), remove: (id: string) => void actions.delete(id), addSection: () => {}, say: (t: string) => void said.push(t), theme: { motion: true } } as unknown as Controls;
    return { controls, actions, said, order: () => [...actions.keys()], press: (id: string) => actions.get(id)?.act?.() };
  };
  const tile = `bag-${maker.slice(0, 8)}-brass-lantern`;
  const tab = async (rule: string, hold: (item: string) => Promise<{ ok: boolean; said: string }>) => {
    const { bag } = set({ had: bagEvent([LANTERN, BOOK]), readOnly: true });
    const m = menu();
    const items = { known: () => null, describe: async () => null } as unknown as Parameters<typeof addBagControls>[1]["items"];
    const bagging = addBagControls(m.controls, { bag, items, me: () => me, rule: () => rule, holding: () => "", hold, place: () => "The Gallery" });
    await bag.load();
    bagging.refresh();
    return m;
  };

  it("shows what they have as things side by side, and keeps its housekeeping for last", async () => {
    const m = await tab("allowed", async () => ({ ok: true, said: "Held." }));
    expect(m.actions.get(tile)?.kind).toBe("tile");
    const order = m.order();
    expect(order.indexOf(tile)).toBeLessThan(order.indexOf("bag-items"));
    expect(order.indexOf(tile)).toBeLessThan(order.indexOf("bag-look"));
  });

  it("puts taking a thing in hand first, straight under the thing chosen: ahead of everything else", async () => {
    const m = await tab("allowed", async () => ({ ok: true, said: "Held." }));
    m.press(tile);
    expect(m.order()[0]).toBe("bag-hold");
    expect(m.actions.get("bag-hold")?.tone).toBe("primary");
  });

  it("says where a thing can't be held, and why, in the place the button would be", async () => {
    const m = await tab("none", async () => ({ ok: false, said: "" }));
    m.press(tile);
    expect(m.order()[0]).toBe("bag-nohold");
    expect(String(m.actions.get("bag-nohold")?.label)).toBe("Can't be held here: The Gallery doesn't have items");
    expect(m.actions.has("bag-hold")).toBe(false);
  });

  it("says on the button itself that a second press lets an item's own logic run, and forgets that for another thing", async () => {
    let asked = 0;
    const m = await tab("allowed", async () => (asked++ === 0 ? { ok: false, said: "It runs shut away on your device. Press Hold again to let it." } : { ok: true, said: "Held." }));
    m.press(tile);
    expect(m.actions.get("bag-hold")?.label).toBe("Hold brass-lantern");
    await m.press("bag-hold");
    expect(m.actions.get("bag-hold")?.label).toBe("Let it run, and hold brass-lantern");
    // Another thing chosen: its button is the plain one again.
    m.press(`bag-${maker.slice(0, 8)}-old-book`);
    expect(m.actions.get("bag-hold")?.label).toBe("Hold old-book");
  });

  it("has no picture where there is nothing to draw one with, and says a thing's name all the same", async () => {
    const m = await tab("allowed", async () => ({ ok: true, said: "" }));
    expect(m.actions.get(tile)?.picture?.()).toBeNull();
    expect((m.actions.get(tile)?.label as () => string)()).toBe("brass-lantern");
  });
});
