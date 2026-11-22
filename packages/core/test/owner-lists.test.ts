import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { accessFor, cleanRoot, finalizeEvent, getPublicKey, isListSubject, KEEPERS_MOST, listD, OWNER_LIST_LIMITS, ownerListTemplate, parseManifest, readOwnerList, resolveOwnerList, worldSubject } from "../src/index.js";

const root = join(import.meta.dirname, "../../..");
const key = (n: number) => sha256(utf8ToBytes(`nswp owner list test key ${n}`));
const pk = (n: number) => getPublicKey(key(n));
const OWNER = pk(1);
const KEEPER = pk(2);
const STRANGER = pk(3);
const ANA = "a".repeat(64);
const BEN = "b".repeat(64);
const NOW = 1_800_000_000;
const HOME = worldSubject(OWNER, "home");
const list = (o: { scope?: "user-allow" | "user-deny"; subject?: string; people?: string[]; by?: Uint8Array; at?: number; content?: string; tags?: (t: string[][]) => string[][] } = {}) => {
  const t = ownerListTemplate({ scope: o.scope ?? "user-deny", subject: o.subject ?? HOME, people: o.people ?? [BEN], createdAt: o.at ?? NOW - 60 })!;
  return finalizeEvent({ ...t, content: o.content ?? "", tags: (o.tags ?? ((x) => x))(t.tags) }, o.by ?? key(1));
};

describe("a world owner's list: read the way BitGate's document says", () => {
  it("agrees with every one of BitGate's own examples, copied from its repository unchanged", () => {
    const raw = readFileSync(join(root, "vectors/governance-lists.json"));
    // The file is BitGate's, byte for byte (the generator holds the commit this hash is of).
    expect(Buffer.from(sha256(raw)).toString("hex")).toBe("a29211c8ec46d51a5b88bf1dafd338d6c5caf776896c91b8aa93cd655600d372");
    const v = JSON.parse(raw.toString("utf8")) as { now: number; decode: { name: string; event: unknown; reader?: { root?: string | string[] }; expect: Record<string, unknown> }[]; resolve: { name: string; query: { scope: "user-allow" | "user-deny"; subject: string; namespace?: string; root?: string | string[] }; events: unknown[]; expect: unknown }[] };
    for (const c of v.decode) {
      const got = readOwnerList(c.event, { now: v.now, ...(c.reader?.root !== undefined ? { root: c.reader.root } : {}) });
      if (typeof c.expect.entryCount === "number") expect(got.ok && [got.entries.length, got.skipped], c.name).toEqual([c.expect.entryCount, c.expect.skipped]);
      else expect(got, c.name).toEqual(c.expect);
    }
    for (const c of v.resolve) expect(resolveOwnerList(c.events, { ...c.query, now: v.now }), c.name).toEqual(c.expect);
  });

  it("reads a block list signed by the world's own key, and names nobody twice", () => {
    expect(readOwnerList(list({ people: [BEN, ANA, BEN] }), { now: NOW })).toEqual({ ok: true, scope: "user-deny", subject: HOME, signer: OWNER, entries: [ANA, BEN], skipped: 0 });
  });

  it("counts only the root's signature: by default the world's own key, and where keepers are given, those and only those", () => {
    // Signed by someone else under the same name.
    expect(readOwnerList(list({ by: key(3) }), { now: NOW })).toEqual({ ok: false, reason: "wrong_signer" });
    // Signed by a keeper: refused by default, read where the keeper is given.
    expect(readOwnerList(list({ by: key(2) }), { now: NOW })).toEqual({ ok: false, reason: "wrong_signer" });
    expect(readOwnerList(list({ by: key(2) }), { now: NOW, root: [KEEPER] })).toMatchObject({ ok: true, signer: KEEPER });
    // A given root replaces the default: the world's own key no longer counts unless it is in it.
    expect(readOwnerList(list(), { now: NOW, root: [KEEPER] })).toEqual({ ok: false, reason: "wrong_signer" });
    expect(readOwnerList(list(), { now: NOW, root: [KEEPER, OWNER] })).toMatchObject({ ok: true });
    // A root that isn't one is no root.
    for (const bad of [[], ["x"], [OWNER, KEEPER, ANA, BEN, STRANGER], OWNER.toUpperCase()]) expect(readOwnerList(list(), { now: NOW, root: bad as string[] }), JSON.stringify(bad).slice(0, 30)).toEqual({ ok: false, reason: "wrong_signer" });
    expect(cleanRoot(OWNER)).toEqual([OWNER]);
    expect(cleanRoot([OWNER, OWNER])).toEqual([OWNER]);
  });

  it("refuses one changed after it was signed, one dated more than ten minutes ahead, and one with hidden content", () => {
    const real = list();
    expect(readOwnerList({ ...real, tags: [...real.tags, ["p", ANA]] }, { now: NOW })).toEqual({ ok: false, reason: "bad_signature" });
    expect(readOwnerList(list({ at: NOW + OWNER_LIST_LIMITS.ahead }), { now: NOW })).toMatchObject({ ok: true });
    expect(readOwnerList(list({ at: NOW + OWNER_LIST_LIMITS.ahead + 1 }), { now: NOW })).toEqual({ ok: false, reason: "from_the_future" });
    expect(readOwnerList(list({ content: "hidden" }), { now: NOW })).toEqual({ ok: false, reason: "content_not_empty" });
  });

  it("keeps a list for one world from standing in for another's", () => {
    const other = list({ subject: worldSubject(OWNER, "other") });
    expect(resolveOwnerList([other], { scope: "user-deny", subject: HOME, now: NOW })).toEqual({ ok: false, reason: "not_found", futureDated: [] });
    // A block list is not an allow list.
    expect(resolveOwnerList([list()], { scope: "user-allow", subject: HOME, now: NOW })).toEqual({ ok: false, reason: "not_found", futureDated: [] });
  });

  it("takes the newest copy, never an older one, and says when one was dated ahead", () => {
    const old = list({ people: [ANA], at: NOW - 600 });
    const newer = list({ people: [BEN], at: NOW - 60 });
    const ahead = list({ people: [], at: NOW + 3600 });
    expect(resolveOwnerList([newer, old], { scope: "user-deny", subject: HOME, now: NOW })).toMatchObject({ ok: true, entries: [BEN] });
    expect(resolveOwnerList([old, newer, ahead], { scope: "user-deny", subject: HOME, now: NOW })).toEqual({ ok: true, scope: "user-deny", subject: HOME, signer: OWNER, entries: [BEN], skipped: 0, futureDated: [ahead.id] });
    // The newest refused makes the list unreadable: the older copy is not used in its place.
    const broken = list({ at: NOW - 10, content: "x" });
    expect(resolveOwnerList([old, broken], { scope: "user-deny", subject: HOME, now: NOW })).toEqual({ ok: false, reason: "content_not_empty", futureDated: [] });
  });

  it("reads a world's name with colons and spaces in it as the name, character for character", () => {
    const odd = worldSubject(OWNER, "home:garden / café");
    expect(isListSubject(odd)).toBe(true);
    expect(listD("user-deny", odd)).toBe(`nswp:governance:user-deny:v1:37300:${OWNER}:home:garden / café`);
    expect(readOwnerList(list({ subject: odd }), { now: NOW })).toMatchObject({ ok: true, subject: odd });
    for (const bad of [`37300:${OWNER}:`, `37300:${OWNER}:a\nb`, `037300:${OWNER}:x`, `65536:${OWNER}:x`, `37300:${OWNER.toUpperCase()}:x`, `37300:${OWNER}:${"x".repeat(513)}`]) expect(isListSubject(bad), bad.slice(0, 20)).toBe(false);
  });

  it("writes at most five hundred people, and only keys, as the kit's own writers must", () => {
    expect(OWNER_LIST_LIMITS).toEqual({ read: 2000, write: 500, ahead: 600, root: 4 });
    const many = Array.from({ length: 501 }, (_, i) => i.toString(16).padStart(64, "0"));
    expect(ownerListTemplate({ scope: "user-deny", subject: HOME, people: many.slice(0, 500), createdAt: NOW })).not.toBeNull();
    expect(ownerListTemplate({ scope: "user-deny", subject: HOME, people: many, createdAt: NOW })).toBeNull();
    expect(ownerListTemplate({ scope: "user-deny", subject: HOME, people: ["npub1x"], createdAt: NOW })).toBeNull();
    expect(ownerListTemplate({ scope: "user-deny", subject: "home", people: [], createdAt: NOW })).toBeNull();
    // What it writes is what the reader takes, with nothing it doesn't need.
    expect(ownerListTemplate({ scope: "user-allow", subject: HOME, people: [ANA], createdAt: NOW })!.tags).toEqual([["d", listD("user-allow", HOME)], ["v", "1"], ["scope", "user-allow"], ["subject", HOME], ["p", ANA]]);
  });
});

describe("a manifest's words for a world's lists", () => {
  const manifest = (more: Record<string, unknown>) => ({ schema: "nswp/manifest/0.3", publishers: { [OWNER]: { worlds: ["home"] } }, worlds: { home: { entry: { url: "https://home.example/" }, ...more } } });
  const rules = (more: Record<string, unknown>) => {
    const r = parseManifest(manifest(more));
    const a = r.ok ? accessFor(r.value, "https://home.example/") : null;
    return { keepers: a?.keepers ?? null, namedOnly: a?.namedOnly ?? null, warnings: r.warnings.map((w) => w.code).sort() };
  };

  it("names no keepers and no rule where it says nothing: a world as it always was", () => {
    expect(rules({})).toEqual({ keepers: null, namedOnly: false, warnings: [] });
  });

  it("takes keepers as keys, four at most, and named_only only as exactly true", () => {
    expect(rules({ keepers: [KEEPER], named_only: true })).toEqual({ keepers: [KEEPER], namedOnly: true, warnings: [] });
    expect(KEEPERS_MOST).toBe(4);
    for (const said of ["yes", 1, "true", null]) expect(rules({ named_only: said }).namedOnly, String(said)).toBe(false);
    expect(rules({ named_only: false })).toEqual({ keepers: null, namedOnly: false, warnings: [] });
    expect(rules({ keepers: KEEPER })).toEqual({ keepers: null, namedOnly: false, warnings: ["invalid_keeper"] });
    expect(rules({ keepers: [] })).toEqual({ keepers: null, namedOnly: false, warnings: [] });
  });

  it("is never refused by the schema where the core takes it with a warning", () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(JSON.parse(readFileSync(join(root, "schemas/manifest.schema.json"), "utf8")));
    for (const more of [{ keepers: "x" }, { keepers: [5] }, { named_only: "yes" }, { access: "paid" }, { access: [5] }]) {
      expect(parseManifest(manifest(more)).ok, JSON.stringify(more)).toBe(true);
      expect(validate(manifest(more)), JSON.stringify(more)).toBe(true);
    }
  });
});
