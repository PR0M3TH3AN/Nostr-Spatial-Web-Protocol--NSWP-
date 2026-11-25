import { buildItem, finalizeEvent, parseItem } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { mayHold } from "../src/hold.js";

/**
 * Items for guests (protocol/17-items.md, "Guests"). The owner, 2026-11-25: a guest should "have access to a bag with
 * the free items that the worlds allow". A guest account holds what both the world (`"guest_items": false` keeps
 * them out) and the item's maker (`["guests", "no"]`) let it; anyone else is as before.
 */
const KEY = sha256(utf8ToBytes("nswp hold guests test maker"));
const H = "a".repeat(64);
const item = (guests?: boolean) => parseItem(finalizeEvent(buildItem({ d: "lantern", title: "Lantern", model: { url: `https://items.example/${H}.glb`, sha256: H }, size: [0.2, 0.3, 0.2], behaviors: ["holdable"], fits: ["hand-right"], ...(guests === undefined ? {} : { guests }), now: 1_800_000_000 })!, KEY));
const hold = (described: ReturnType<typeof item>, o: { guest?: boolean; guestItems?: boolean }) => mayHold(described, { rule: "allowed", scripts: false, asked: { sha: "" }, ...o });

describe("what a guest may hold", () => {
  it("is what anyone may, where the world and the item's maker say nothing", () => {
    expect(hold(item(), { guest: true, guestItems: true })).toEqual({ ok: true });
  });

  it("is nothing in a world whose items guests may not use", () => {
    expect(hold(item(), { guest: true, guestItems: false })).toEqual({ ok: false, said: "Guests can't use items in this world. Secure your account to use them here." });
  });

  it("isn't an item its maker keeps from guests, wherever they are", () => {
    expect(item(false)?.guests).toBe(false);
    expect(hold(item(false), { guest: true, guestItems: true })).toEqual({ ok: false, said: "Lantern isn't for guests. Secure your account to use it." });
  });

  it("changes nothing for an account", () => {
    expect(hold(item(false), { guest: false, guestItems: false })).toEqual({ ok: true });
    expect(hold(item(false), {})).toEqual({ ok: true });
  });
});
