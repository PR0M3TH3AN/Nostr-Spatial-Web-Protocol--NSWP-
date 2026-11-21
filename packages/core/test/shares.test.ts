import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { cleanShareLabel, getPublicKey, readShares, SHARE_LIMITS, splitPrice, type Share } from "../src/index.js";

const pk = (n: number) => getPublicKey(sha256(utf8ToBytes(`nswp shares test key ${n}`)));
const SELLER = pk(1);
const MAKER = pk(2);
const CLIENT = pk(3);
const tag = (to: string, parts: string, label?: string) => ["nswp:share", to, parts, ...(label === undefined ? [] : [label])];
const THREE: Share[] = [
  { to: SELLER, parts: 8500, label: "world" },
  { to: MAKER, parts: 1000, label: "maker" },
  { to: "client", parts: 500, label: "client" },
];
const sats = (r: ReturnType<typeof splitPrice>) => (r.ok ? r.parts.map((p) => [p.to === SELLER ? "seller" : p.to === MAKER ? "maker" : p.to === CLIENT ? "client" : p.to, p.sats]) : r.why);

describe("shares: what a listing says of who its price is divided between", () => {
  it("a listing with none has none, and its seller is paid everything", () => {
    expect(readShares([["d", "a-lantern"], ["price", "500", "SAT"]], SELLER)).toEqual({ ok: true, shares: [] });
    expect(readShares([], SELLER)).toEqual({ ok: true, shares: [] });
  });

  it("reads who, how much and what for", () => {
    expect(readShares([["d", "x"], tag(SELLER, "8500", "world"), tag(MAKER, "1000", "maker"), tag("client", "500")], SELLER)).toEqual({ ok: true, shares: THREE });
  });

  it("calls a share with no word by what it is", () => {
    const r = readShares([tag(SELLER, "9000"), tag(MAKER, "500"), tag("client", "500")], SELLER);
    expect(r.ok && r.shares.map((s) => s.label)).toEqual(["seller", "share", "client"]);
  });

  it("has them all right or has none: nothing is dropped or made to fit", () => {
    const why = (tags: unknown[]) => { const r = readShares(tags, SELLER); return r.ok ? "ok" : r.why; };
    expect(why([tag(SELLER, "8500"), tag(MAKER, "1000")])).toBe("not-whole");
    expect(why([tag(SELLER, "9000"), tag(MAKER, "1001")])).toBe("not-whole");
    expect(why([tag(MAKER, "9500"), tag("client", "500")])).toBe("no-seller");
    expect(why([tag(SELLER, "8000"), tag(MAKER, "1000"), tag(MAKER, "1000")])).toBe("twice");
    expect(why([tag(SELLER, "9000"), tag("client", "500"), tag("client", "500")])).toBe("twice");
    expect(why([tag(SELLER, "6000"), ...[4, 5, 6, 7].map((n) => tag(pk(n), "1000"))])).toBe("too-many");
    // Four is the most: the seller and three others.
    expect(why([tag(SELLER, "7000"), ...[4, 5, 6].map((n) => tag(pk(n), "1000"))])).toBe("ok");
    for (const parts of ["0", "09500", "9500.5", "-1", "1e3", "10001", "", " 500", "500 "]) expect(why([tag(SELLER, "9500"), tag(MAKER, parts)]), parts).toBe("not-a-share");
    for (const to of ["alice@example.com", "CLIENT", SELLER.toUpperCase(), "", `npub1${"q".repeat(58)}`]) expect(why([tag(SELLER, "9500"), tag(to, "500")]), to).toBe("not-a-share");
    expect(why([tag(SELLER, "9500"), ["nswp:share", MAKER]])).toBe("not-a-share");
    expect(why([tag(SELLER, "9500"), [...tag(MAKER, "500", "maker"), "more"]])).toBe("not-a-share");
    expect(why([tag(SELLER, "9500"), ["nswp:share", MAKER, 500]])).toBe("not-a-share");
    expect(readShares("nswp:share", SELLER)).toEqual({ ok: false, why: "not-a-share" });
    // A listing with shares and no seller to speak of.
    expect(readShares([tag(SELLER, "10000")], "nobody")).toEqual({ ok: false, why: "no-seller" });
  });

  it("takes a word a buyer can read, and nothing they can't", () => {
    expect(cleanShareLabel("  the maker ")).toBe("the maker");
    expect(cleanShareLabel("x".repeat(SHARE_LIMITS.label))).toBe("x".repeat(SHARE_LIMITS.label));
    for (const bad of ["", "   ", "x".repeat(SHARE_LIMITS.label + 1), "two\nlines", `maker${String.fromCodePoint(0x202e)}`, `ma${String.fromCodePoint(0x200b)}ker`, "tab\there", 5, null]) expect(cleanShareLabel(bad), JSON.stringify(bad)).toBe("");
    const r = readShares([tag(SELLER, "9500"), tag(MAKER, "500", `maker${String.fromCodePoint(0x202e)}`)], SELLER);
    expect(r).toEqual({ ok: false, why: "not-a-share" });
  });
});

describe("shares: what a price comes to", () => {
  it("pays a seller with no shares the price, less the service's charge", () => {
    expect(splitPrice(500, [], SELLER, { charge: 10 })).toEqual({ ok: true, parts: [{ to: SELLER, sats: 490, label: "seller", seller: true }] });
    expect(sats(splitPrice(500, [], SELLER))).toEqual([["seller", 500]]);
  });

  it("pays the smallest first and the seller last, and takes the charge from the seller only", () => {
    expect(splitPrice(2100, THREE, SELLER, { client: CLIENT, charge: 21 })).toEqual({
      ok: true,
      parts: [
        { to: CLIENT, sats: 105, label: "client", seller: false },
        { to: MAKER, sats: 210, label: "maker", seller: false },
        { to: SELLER, sats: 1764, label: "world", seller: true },
      ],
    });
  });

  it("gives the client's share to the seller where no client brought the buyer", () => {
    expect(sats(splitPrice(2100, THREE, SELLER, { charge: 21 }))).toEqual([["maker", 210], ["seller", 1869]]);
    expect(sats(splitPrice(2100, THREE, SELLER, { client: SELLER, charge: 21 }))).toEqual([["maker", 210], ["seller", 1869]]);
    expect(sats(splitPrice(2100, THREE, SELLER, { client: "not a key", charge: 21 }))).toEqual([["maker", 210], ["seller", 1869]]);
  });

  it("pays someone once who is both named and the client", () => {
    expect(sats(splitPrice(2100, THREE, SELLER, { client: MAKER, charge: 21 }))).toEqual([["maker", 315], ["seller", 1764]]);
  });

  it("rounds each other part down, and the seller has what is left", () => {
    expect(sats(splitPrice(999, THREE, SELLER, { client: CLIENT, charge: 10 }))).toEqual([["client", 49], ["maker", 99], ["seller", 841]]);
  });

  it("always adds up to the price less the charge", () => {
    for (const price of [500, 501, 777, 1000, 2100, 21_000, 1_000_003]) {
      for (const charge of [0, 10, 21, 210]) {
        for (const client of [undefined, CLIENT, MAKER]) {
          const r = splitPrice(price, THREE, SELLER, { ...(client ? { client } : {}), charge });
          if (r.ok) expect(r.parts.reduce((sum, p) => sum + p.sats, 0), `${price} ${charge}`).toBe(price - charge);
        }
      }
    }
  });

  it("refuses where any one payment would be too small to be worth sending", () => {
    // 5% of 150 is 7 sats.
    expect(splitPrice(150, THREE, SELLER, { client: CLIENT, charge: 10 })).toEqual({ ok: false, why: "too-small" });
    // With nobody to pay it to, that part is the seller's, and it sells.
    expect(sats(splitPrice(150, THREE, SELLER, { charge: 10 }))).toEqual([["maker", 15], ["seller", 125]]);
    // A seller whose part doesn't cover the charge.
    const mostly: Share[] = [{ to: SELLER, parts: 1000, label: "seller" }, { to: MAKER, parts: 9000, label: "maker" }];
    expect(splitPrice(200, mostly, SELLER, { charge: 15 })).toEqual({ ok: false, why: "too-small" });
    expect(splitPrice(5, [], SELLER)).toEqual({ ok: false, why: "too-small" });
  });

  it("puts two parts of one size in the order of their keys", () => {
    const even: Share[] = [{ to: SELLER, parts: 8000, label: "seller" }, { to: MAKER, parts: 1000, label: "maker" }, { to: CLIENT, parts: 1000, label: "host" }];
    const r = splitPrice(1000, even, SELLER, { charge: 10 });
    const [first, second] = [MAKER, CLIENT].sort();
    expect(r.ok && r.parts.map((p) => p.to)).toEqual([first, second, SELLER]);
  });

  it("takes nothing that isn't a price, a charge or a seller", () => {
    for (const price of [0, -5, 1.5, Number.NaN, Infinity, "500", null, Number.MAX_SAFE_INTEGER]) expect(splitPrice(price, [], SELLER), String(price)).toEqual({ ok: false, why: "not-a-price" });
    for (const charge of [-1, 0.5, Number.NaN]) expect(splitPrice(500, [], SELLER, { charge })).toEqual({ ok: false, why: "not-a-price" });
    expect(splitPrice(500, [], "nobody")).toEqual({ ok: false, why: "no-seller" });
    expect(splitPrice(500, [{ to: MAKER, parts: 10_000, label: "maker" }], SELLER)).toEqual({ ok: false, why: "no-seller" });
  });
});
