import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hexToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { changeOwnerList, finalizeEvent, isOwnerListAsked, ownerListTemplate, readOwnerList, scopeOfChange, type ListScope, type NostrEvent, type OwnerListChange } from "../src/index.js";

/**
 * One change to a world owner's list, as the kit writes it and as it checks what a sign-in address sends back
 * (protocol/10-identity.md, "Writing one, from one change"; the owner's screen, docs/plans/a-world-by-invitation.md §4).
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const file = JSON.parse(readFileSync(join(root, "vectors/owner-list-writing.json"), "utf8")) as {
  testKeys: { key1: { secretKey: string; pubkey: string }; key2: { secretKey: string; pubkey: string } };
  vectors: { name: string; scope: ListScope; subject: string; before: { people: string[]; createdAt: number } | null; change: { op: "add" | "remove"; person: string }; now: number; expect: { refused?: string; event?: unknown } }[];
};
const KEY1 = hexToBytes(file.testKeys.key1.secretKey);
const KEY2 = hexToBytes(file.testKeys.key2.secretKey);
const KEEPER = file.testKeys.key1.pubkey;
const named = (scope: ListScope, op: "add" | "remove"): OwnerListChange => (scope === "user-allow" ? (op === "add" ? "allow" : "unallow") : op === "add" ? "block" : "unblock");
const signedList = (scope: ListScope, subject: string, people: string[], createdAt: number, key = KEY1) => finalizeEvent(ownerListTemplate({ scope, subject, people, createdAt })!, key);

describe("changeOwnerList", () => {
  for (const v of file.vectors) {
    it(`writes the vectors' ${v.name}`, () => {
      const before = v.before ? signedList(v.scope, v.subject, v.before.people, v.before.createdAt) : null;
      const made = changeOwnerList(before, { subject: v.subject, change: named(v.scope, v.change.op), key: v.change.person, now: v.now });
      if (v.expect.refused) expect(made).toBeNull();
      else expect(made).toEqual(v.expect.event);
    });
  }

  it("letting in and taking off are the guest list's; blocking and unblocking the block list's", () => {
    expect((["allow", "unallow", "block", "unblock"] as const).map(scopeOfChange)).toEqual(["user-allow", "user-allow", "user-deny", "user-deny"]);
  });

  it("won't change a list that is another world's, or the other list", () => {
    const v = file.vectors[1]!;
    const guests = signedList("user-allow", v.subject, [v.change.person], v.now - 60);
    expect(changeOwnerList(guests, { subject: v.subject, change: "block", key: KEEPER, now: v.now })).toBeNull();
    expect(changeOwnerList(guests, { subject: v.subject.replace(/:[^:]*$/, ":another-world"), change: "allow", key: KEEPER, now: v.now })).toBeNull();
    expect(changeOwnerList(guests, { subject: v.subject, change: "allow", key: "npub1x", now: v.now })).toBeNull();
  });
});

describe("isOwnerListAsked: what comes back is exactly that list with that one change", () => {
  const v = file.vectors[1]!; // allow, on a list of two
  const before = signedList(v.scope, v.subject, v.before!.people, v.before!.createdAt);
  const ask = { list: before, subject: v.subject, change: "allow" as const, key: v.change.person, pubkey: KEEPER };
  const right = finalizeEvent(changeOwnerList(before, { subject: v.subject, change: "allow", key: v.change.person, now: v.now })!, KEY1);
  const resign = (t: { kind: number; created_at: number; content: string; tags: string[][] }, key = KEY1) => finalizeEvent(t, key);

  it("takes the list as asked, and as a reader reads it", () => {
    expect(isOwnerListAsked(right, ask)).toBe(true);
    expect(readOwnerList(right, { now: v.now })).toMatchObject({ ok: true, entries: [...v.before!.people, v.change.person].sort() });
  });

  it("takes it with a client tag or a site's mark, which change nothing a reader reads", () => {
    const t = { kind: right.kind, created_at: right.created_at, content: "", tags: [...right.tags, ["client", "bitlogin"], ["bitlogin:site", "https://world.example"]] };
    expect(isOwnerListAsked(resign(t), ask)).toBe(true);
  });

  it("refuses one person more, one fewer, or another in their place", () => {
    const extra = { kind: right.kind, created_at: right.created_at, content: "", tags: [...right.tags, ["p", "f".repeat(64)]] };
    expect(isOwnerListAsked(resign(extra), ask)).toBe(false);
    const fewer = { kind: right.kind, created_at: right.created_at, content: "", tags: right.tags.filter((t) => t[1] !== v.before!.people[0]) };
    expect(isOwnerListAsked(resign(fewer), ask)).toBe(false);
  });

  it("refuses another signer, a list dated no later than the one changed, content, or a signature that doesn't check", () => {
    const t = { kind: right.kind, created_at: right.created_at, content: "", tags: right.tags };
    expect(isOwnerListAsked(resign(t, KEY2), ask)).toBe(false);
    expect(isOwnerListAsked(resign({ ...t, created_at: before.created_at }), ask)).toBe(false);
    expect(isOwnerListAsked(resign({ ...t, content: "hello" }), ask)).toBe(false);
    expect(isOwnerListAsked({ ...right, tags: [...right.tags, ["p", "e".repeat(64)]] } as NostrEvent, ask)).toBe(false);
    expect(isOwnerListAsked(right, { ...ask, pubkey: null })).toBe(false);
  });

  it("starts a first list only from none", () => {
    const first = finalizeEvent(changeOwnerList(null, { subject: v.subject, change: "allow", key: v.change.person, now: v.now })!, KEY1);
    expect(isOwnerListAsked(first, { ...ask, list: null })).toBe(true);
    // What comes back as a first list is not the change asked of a list that exists.
    expect(isOwnerListAsked(first, ask)).toBe(false);
  });
});
