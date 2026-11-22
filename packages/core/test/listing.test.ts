import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { ACCESS_MOST, accessFor, buildWorldEvent, cleanAccess, cleanListing, cleanListingName, paidWorldReaches, finalizeEvent, getPublicKey, LEAST_PRICE_SATS, parseManifest, parseWorldEvent, priceWords, readListing, RECEIPT_ISSUERS, termWords, type NostrEvent, type ReceiptIssuer } from "../src/index.js";

const root = join(import.meta.dirname, "../../..");
const key = (n: number) => sha256(utf8ToBytes(`nswp listing test key ${n}`));
const pk = (n: number) => getPublicKey(key(n));
const SERVICE: ReceiptIssuer = { name: "Test service", service: "https://unlock.example", pubkey: pk(1) };
const ISSUERS = [SERVICE];
const SELLER = pk(2);
const OTHER = pk(3);
const PASS = `30078:${SELLER}:a day pass`;
const T = 1_800_000_000;
/** A listing as BitUnlock registers one, with the tags that say what it means in a world. */
const listing = (o: { name?: string; price?: string; by?: Uint8Array; content?: string; more?: string[][]; change?: (tags: string[][]) => string[][] } = {}): NostrEvent => {
  const tags = [["d", o.name ?? "a day pass"], ["price", o.price ?? "500", "SAT"], ["status", "active"], ["br:delivery", "seller-unlock-service-v1"], ["br:delivery-mode", "static"], ["br:unlock-service", SERVICE.service], ["br:unlock-service-pubkey", SERVICE.pubkey], ["br:claim-epoch", "1"], ["nswp:for", `37300:${SELLER}:a-world`], ...(o.more ?? [])];
  return finalizeEvent({ kind: 30078, created_at: T, content: o.content ?? JSON.stringify({ title: "A day here" }), tags: (o.change ?? ((t) => t))(tags) }, o.by ?? key(2));
};
const read = (e: unknown, coordinate = PASS) => readListing(e, coordinate, { issuers: ISSUERS });
const why = (e: unknown, coordinate = PASS) => {
  const r = read(e, coordinate);
  return r.ok ? "ok" : r.why;
};

describe("a listing: what is for sale, for how much, and for how long", () => {
  it("reads one sold for a time, and one sold for good", () => {
    expect(read(listing({ more: [["nswp:term", "86400"]] }))).toEqual({ ok: true, listing: { coordinate: PASS, seller: SELLER, name: "A day here", sats: 500, term: 86400, for: `37300:${SELLER}:a-world`, issuer: SERVICE } });
    expect(read(listing())).toMatchObject({ ok: true, listing: { term: null } });
  });

  it("is only the seller's to sign: one signed by anyone else is not the listing", () => {
    // Another key signs a note under the same name. Its own coordinate would be its own; asked for as the seller's, it is refused.
    expect(why(listing({ by: key(3) }))).toBe("other-seller");
    // And one whose signature doesn't hold: its price changed after it was signed.
    const real = listing();
    expect(why({ ...real, tags: real.tags.map((t) => (t[0] === "price" ? ["price", "1", "SAT"] : t)) })).toBe("not-signed");
    expect(why({ ...real, sig: "00".repeat(64) })).toBe("not-signed");
  });

  it("is the one asked for, and no other of the same seller's", () => {
    expect(why(listing(), `30078:${SELLER}:a year pass`)).toBe("other-listing");
    // Two names: neither is believed.
    expect(why(listing({ more: [["d", "a year pass"]] }))).toBe("other-listing");
  });

  it("shows nothing for sale under the least price", () => {
    expect(LEAST_PRICE_SATS).toBe(500);
    expect(why(listing({ price: "499" }))).toBe("too-cheap");
    expect(why(listing({ price: "1" }))).toBe("too-cheap");
    expect(why(listing({ price: "500" }))).toBe("ok");
  });

  it("needs one price in whole sats, and a term that reads", () => {
    for (const price of ["0", "05", "500.5", "-500", "", "five hundred", "1".repeat(13)]) expect(why(listing({ price })), price).toBe("not-a-listing");
    expect(why(listing({ change: (t) => t.map((x) => (x[0] === "price" ? ["price", "500", "USD"] : x)) }))).toBe("not-a-listing");
    expect(why(listing({ more: [["price", "900", "SAT"]] }))).toBe("not-a-listing");
    expect(why(listing({ change: (t) => t.filter((x) => x[0] !== "price") }))).toBe("not-a-listing");
    // A term that doesn't read is never taken as "for good".
    for (const term of [["nswp:term", "0"], ["nswp:term", "a day"], ["nswp:term", "86400", "more"], ["nswp:term"], ["nswp:term", "1.5"]]) expect(why(listing({ more: [term] })), term.join(" ")).toBe("not-a-listing");
    expect(why(listing({ more: [["nswp:term", "60"], ["nswp:term", "120"]] }))).toBe("not-a-listing");
  });

  it("is for sale only while it says so, through a service whose receipts are believed", () => {
    expect(why(listing({ change: (t) => t.map((x) => (x[0] === "status" ? ["status", "withdrawn"] : x)) }))).toBe("not-for-sale");
    expect(why(listing({ change: (t) => t.filter((x) => x[0] !== "br:delivery") }))).toBe("not-for-sale");
    // The right address with another key, and the right key at another address: neither is the service.
    expect(why(listing({ change: (t) => t.map((x) => (x[0] === "br:unlock-service-pubkey" ? [x[0], OTHER] : x)) }))).toBe("unknown-service");
    expect(why(listing({ change: (t) => t.map((x) => (x[0] === "br:unlock-service" ? [x[0], "https://elsewhere.example"] : x)) }))).toBe("unknown-service");
    // As shipped, the kit believes BitUnlock alone: a listing that names the test's own service is not shown.
    expect(readListing(listing(), PASS)).toEqual({ ok: false, why: "unknown-service" });
    const live = RECEIPT_ISSUERS[0]!;
    const sold = listing({ change: (t) => t.map((x) => (x[0] === "br:unlock-service" ? [x[0], live.service] : x[0] === "br:unlock-service-pubkey" ? [x[0], live.pubkey] : x)) });
    expect(readListing(sold, PASS)).toMatchObject({ ok: true, listing: { issuer: live } });
  });

  it("is not shown for sale while its price is divided: shares are not in force", () => {
    expect(why(listing({ more: [["nswp:share", SELLER, "9000"], ["nswp:share", OTHER, "1000"]] }))).toBe("shared");
  });

  it("is refused for anything that isn't a listing at all", () => {
    for (const not of [null, undefined, "", 7, [], {}, { ...listing(), kind: 1 }, { ...listing(), tags: "d" }, { ...listing(), tags: [["d", 5]] }, { ...listing(), content: 5 }]) expect(why(not)).toBe("not-a-listing");
    expect(why(listing(), "30078:nobody:x")).toBe("not-a-listing");
    expect(why(listing(), `37303:${SELLER}:a day pass`)).toBe("not-a-listing");
  });

  it("never changes what it is handed", () => {
    const e = listing();
    const before = JSON.stringify(e);
    read(e);
    expect(JSON.stringify(e)).toBe(before);
  });

  it("takes its name from the seller's own words, as plain text on one line", () => {
    expect(read(listing({ more: [["title", "From the tag"]] }))).toMatchObject({ listing: { name: "From the tag" } });
    expect(read(listing({ content: JSON.stringify({ name: "From the name" }) }))).toMatchObject({ listing: { name: "From the name" } });
    // No words inside, or none that read: the name it is filed under.
    for (const content of ["", "not json", "[]", JSON.stringify({ title: 5 })]) expect(read(listing({ content })), content).toMatchObject({ listing: { name: "a day pass" } });
    // Nothing a reader can't see: no line break, no control character, none of the marks that hide or reorder text.
    expect(cleanListingName(`A\n pass${String.fromCodePoint(0x202e)} here${String.fromCodePoint(0x200b)}`)).toBe("A pass here");
    expect(cleanListingName("  spaced  ")).toBe("spaced");
    expect(cleanListingName("x".repeat(200))).toHaveLength(80);
    expect(cleanListingName(5)).toBe("");
  });

  it("says what it is for only where that is a world or an item", () => {
    expect(read(listing({ change: (t) => t.map((x) => (x[0] === "nswp:for" ? [x[0], "anything at all"] : x)) }))).toMatchObject({ listing: { for: "" } });
  });

  it("puts how long it lasts in words", () => {
    expect([null, 60, 3600, 5400, 86400, 2_592_000, 45, 1].map(termWords)).toEqual(["once", "for 1 minute", "for 1 hour", "for 90 minutes", "for 1 day", "for 30 days", "for 45 seconds", "for 1 second"]);
    expect([0, -5, 1.5, Number.NaN].map(termWords)).toEqual(["once", "once", "once", "once"]);
    expect(priceWords({ sats: 500, term: 86400 })).toBe("500 sats, for 1 day");
    expect(priceWords({ sats: 2100, term: null })).toBe("2100 sats, once");
  });

  it("agrees with every example in vectors/listings.json", () => {
    const file = JSON.parse(readFileSync(join(root, "vectors/listings.json"), "utf8")) as { issuers: ReceiptIssuer[]; reading: { name: string; coordinate: string; event: unknown; expect: unknown }[]; words: { term: number | null; expect: string }[] };
    expect(file.reading.length).toBeGreaterThan(8);
    for (const v of file.reading) expect(readListing(v.event, v.coordinate, { issuers: file.issuers }), v.name).toEqual(v.expect);
    for (const w of file.words) expect(termWords(w.term)).toBe(w.expect);
  });
});

describe("access: what a paid world says it is entered by", () => {
  const A = `30078:${SELLER}:a day pass`;
  const B = `30078:${SELLER}:for-good`;
  const theirs = `30078:${OTHER}:a day pass`;
  const world = { d: "a-world", title: "A world", url: "https://world.example/" };
  const sign = (access: string | string[] | undefined, by = key(2)) => finalizeEvent(buildWorldEvent({ ...world, ...(access === undefined ? {} : { access }), createdAt: T }), by);

  it("a world that names nothing is free, with nothing to warn of", () => {
    const r = parseWorldEvent(sign(undefined));
    expect(r.ok && r.value.access).toBeUndefined();
    expect(r.warnings).toEqual([]);
  });

  it("an announcement names its listings, each sold by the key that signed it", () => {
    const r = parseWorldEvent(sign([A, B]));
    expect(r.ok && r.value.access).toEqual([A, B]);
    expect(r.warnings).toEqual([]);
    // One, as a word and not a list, is the same.
    const one = parseWorldEvent(sign(A));
    expect(one.ok && one.value.access).toEqual([A]);
  });

  it("a listing sold by another key is left out of an announcement, and the world stays valid", () => {
    const r = parseWorldEvent(sign([theirs, A]));
    expect(r.ok && r.value.access).toEqual([A]);
    expect(r.warnings.map((w) => w.code)).toEqual(["access_not_own"]);
    const none = parseWorldEvent(sign(theirs));
    expect(none.ok && none.value.access).toBeUndefined();
  });

  it("keeps a few listings and no more", () => {
    const many = Array.from({ length: ACCESS_MOST + 2 }, (_, i) => `30078:${SELLER}:pass-${i}`);
    const r = parseWorldEvent(sign(many));
    expect(r.ok && r.value.access).toEqual(many.slice(0, ACCESS_MOST));
    expect(r.warnings.map((w) => w.code)).toEqual(["too_many_listings", "too_many_listings"]);
    expect(cleanAccess(many)).toEqual(many.slice(0, ACCESS_MOST));
  });

  const manifest = (access: unknown, publishers: Record<string, { worlds: string[] }> = { [SELLER]: { worlds: ["a-world"] } }) => ({ schema: "nswp/manifest/0.3", publishers, worlds: { "a-world": { entry: { url: "https://world.example/" }, ...(access === undefined ? {} : { access }) } } });

  it("a manifest names them too, each sold by a key it lets announce that world", () => {
    const r = parseManifest(manifest([A, B]));
    expect(r.ok && accessFor(r.value, "https://world.example/")).toEqual({ d: "a-world", listings: [A, B], sellers: [SELLER], keepers: null, namedOnly: false, byInvitation: false });
    expect(r.warnings).toEqual([]);
    const free = parseManifest(manifest(undefined));
    expect(free.ok && accessFor(free.value, "https://world.example/")).toEqual({ d: "a-world", listings: [], sellers: [SELLER], keepers: null, namedOnly: false, byInvitation: false });
    expect(free.warnings).toEqual([]);
    // An address the file lists no world at: nothing can be said of it.
    expect(r.ok && accessFor(r.value, "https://world.example/other")).toBeNull();
  });

  it("a manifest leaves out what isn't its own world's to sell, or isn't a listing", () => {
    const r = parseManifest(manifest([theirs, "paid", A, A]));
    expect(r.ok && accessFor(r.value, "https://world.example/")?.listings).toEqual([A]);
    expect(r.warnings.map((w) => w.code).sort()).toEqual(["access_not_own", "invalid_listing"]);
    // A publisher of another world on the same site may not sell this one.
    const other = parseManifest(manifest([theirs], { [SELLER]: { worlds: ["a-world"] }, [OTHER]: { worlds: ["another"] } }));
    expect(other.ok && accessFor(other.value, "https://world.example/")?.listings).toEqual([]);
    for (const not of ["paid", 5, { listing: A }, [5]]) {
      const bad = parseManifest(manifest(not));
      expect(bad.ok && accessFor(bad.value, "https://world.example/")?.listings, JSON.stringify(not)).toEqual([]);
      expect(bad.warnings.map((w) => w.code)).toEqual(["invalid_field"]);
    }
  });

  it("cleans a list of listings: each once, only listings, only the sellers named", () => {
    expect(cleanAccess([A, A, B, "paid", null, theirs])).toEqual([A, B, theirs]);
    expect(cleanAccess([A, theirs], [SELLER])).toEqual([A]);
    expect(cleanAccess(A)).toEqual([A]);
    expect(cleanAccess(undefined)).toEqual([]);
    expect(cleanAccess([A], [])).toEqual([]);
  });

  it("lets only a paid world's page reach the selling service, by name: a free world's rules are as they were", () => {
    // What is added to a world's `connect-src` for being paid: the one service, by its address, and nothing wider.
    expect(paidWorldReaches([A])).toEqual(["https://api.bitunlock.network"]);
    expect(paidWorldReaches([A, B])).toEqual(["https://api.bitunlock.network"]);
    // Nothing for a world that names nothing, or names nothing that is a listing.
    for (const free of [undefined, null, [], "", "paid", ["paid"], [`37303:${SELLER}:a-lantern`], {}]) expect(paidWorldReaches(free), JSON.stringify(free)).toEqual([]);
    // The site build asks this, and writes no rule of its own for it.
    const build = readFileSync(join(root, "scripts/build-sites.mjs"), "utf8");
    expect(build).toContain(`["connect-src 'self' wss:", ...paidWorldReaches(accessOf(world))].join(" ")`);
    expect(build).not.toContain("api.bitunlock.network");
  });

  it("reads a listing's coordinate by the one rule for it, wherever one is read", () => {
    // One line: a carriage return ends a line as a line feed does. Refused everywhere a coordinate is taken.
    const twoLines = `30078:${SELLER}:a day\rpass`;
    expect(cleanListing(twoLines)).toBe("");
    expect(cleanAccess([twoLines, A])).toEqual([A]);
    expect(readListing(listing({ name: "a day\rpass" }), twoLines, { issuers: ISSUERS })).toEqual({ ok: false, why: "not-a-listing" });
    const world = parseWorldEvent(sign([twoLines]));
    expect(world.ok && world.value.access).toBeUndefined();
    const file = parseManifest(manifest([twoLines]));
    expect(file.ok && accessFor(file.value, "https://world.example/")?.listings).toEqual([]);
    // And no other file writes the pattern again.
    for (const f of ["listing.ts", "world.ts", "manifest.ts"]) expect(readFileSync(join(root, "packages/core/src", f), "utf8"), f).not.toMatch(/\^30078:/);
    expect(readFileSync(join(root, "packages/sdk/src/front-room.ts"), "utf8")).not.toMatch(/\^30078:/);
  });

  it("no reference world is paid, keeps lists or closes its rooms to guests: none of this repository's worlds says so", () => {
    const files = [...readdirSync(join(root, "sites"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(root, "sites", d.name, "world.json")), join(root, "engines/godot/world.json")];
    let looked = 0;
    for (const file of files) {
      let text: string;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      looked++;
      const said = JSON.parse(text) as Record<string, unknown> & { world?: Record<string, unknown> };
      expect(said.access ?? said.world?.access, file).toBeUndefined();
      // Nor does any keep lists or close its rooms to guests: that too is its owner's word (protocol/10-identity.md, "A world's own lists").
      for (const word of ["keepers", "named_only", "by_invitation"]) expect(said[word] ?? said.world?.[word], `${file}: ${word}`).toBeUndefined();
    }
    expect(looked).toBeGreaterThanOrEqual(8);
  });
});
