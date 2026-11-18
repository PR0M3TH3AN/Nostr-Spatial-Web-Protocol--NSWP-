/** What an owner brings to a world they are building (bring.ts). */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { buildWorldGrant, finalizeEvent, getPublicKey, packBrought } from "@nswp/core";
import { dropBrought, somethingBrought, takeBrought } from "../src/bring.js";

const OWNER = sha256(utf8ToBytes("bring test owner"));
const SESSION = sha256(utf8ToBytes("bring test session"));
const BRIDGE = getPublicKey(sha256(utf8ToBytes("bring test bridge")));
const WORLD = "https://my-world.example";
const T = 1_800_000_000;
const text = (world = WORLD, immersive = true) =>
  packBrought({ grant: finalizeEvent(buildWorldGrant({ session: getPublicKey(SESSION), bridge: BRIDGE, world, createdAt: T }), OWNER), sessionKey: bytesToHex(SESSION), bridge: BRIDGE, name: "Desk", relays: [], immersive });

/** A page at an address, with a tab's storage, as far as this file needs one. */
function page(href: string) {
  const u = new URL(href);
  const kept = new Map<string, string>();
  const loc = { origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash };
  Object.assign(globalThis, {
    location: loc,
    history: { state: null, replaceState: (_s: unknown, _t: string, to: string) => void (loc.hash = to.includes("#") ? to.slice(to.indexOf("#")) : "") },
    sessionStorage: { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) },
  });
  return { loc, kept };
}
const g = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
beforeEach(() => (saved = { location: g.location, history: g.history, sessionStorage: g.sessionStorage }));
afterEach(() => Object.assign(globalThis, saved));

describe("what was brought", () => {
  it("is taken from the address, which is cleaned at once, and kept for the tab", () => {
    const { loc, kept } = page(`${WORLD}/#nswp-bring=${text()}&other=1`);
    expect(somethingBrought()).toBe(true);
    const first = takeBrought(T + 5)!;
    expect(first).toMatchObject({ bridge: BRIDGE, name: "Desk", fresh: true, immersive: true });
    expect(loc.hash).toBe("#other=1"); // the key is out of the address; anything else there is left alone
    expect([...kept.keys()]).toEqual(["nswp:brought"]);
    // A refresh: still here, and not an arrival, so nothing about a headset is claimed.
    const again = takeBrought(T + 60)!;
    expect(again).toMatchObject({ bridge: BRIDGE, fresh: false, immersive: false });
  });

  it("is nothing when there is nothing, when it was made for another world, or when it has run out", () => {
    page(`${WORLD}/`);
    expect(somethingBrought()).toBe(false);
    expect(takeBrought(T + 5)).toBeNull();
    const other = page(`https://someone-elses.example/#nswp-bring=${text()}`);
    expect(takeBrought(T + 5)).toBeNull();
    expect(other.kept.size).toBe(0);
    expect(other.loc.hash).toBe(""); // taken out of the address all the same
    const late = page(`${WORLD}/#nswp-bring=${text()}`);
    expect(takeBrought(T + 5)).not.toBeNull();
    expect(takeBrought(T + 9 * 3600)).toBeNull();
    expect(late.kept.size).toBe(0); // and forgotten once it is no good
  });

  it("can be let go of", () => {
    const { kept } = page(`${WORLD}/#nswp-bring=${text()}`);
    takeBrought(T + 5);
    dropBrought();
    expect(kept.size).toBe(0);
    expect(somethingBrought()).toBe(false);
  });
});
