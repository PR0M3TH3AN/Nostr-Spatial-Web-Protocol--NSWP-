/** Passes (protocol/10-identity.md). The vectors cover reading one; these cover making one and the small rules beside it. */
import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { buildAirlockUrl, buildRoomPass, claimsKey, cleanName, decodeArrival, encodeArrival, encodeNpub, finalizeEvent, fragmentSaysImmersive, getPublicKey, parseAirlockFragment, PASS_LIMITS, shortNpub, verifyRoomPass } from "../src/index.js";

const ME = sha256(utf8ToBytes("pass test identity"));
const SESSION = sha256(utf8ToBytes("pass test session"));
const session = getPublicKey(SESSION);
const T = 1_800_000_000;
const SITE = "https://world.example";

describe("making a pass", () => {
  it("is good at the world's origin, whatever page was named", () => {
    const pass = finalizeEvent(buildRoomPass({ session, origin: `${SITE}/rooms/blue?x=1#y`, name: "Ada", createdAt: T }), ME);
    expect(pass.tags).toContainEqual(["nswp:origin", SITE]);
    const r = verifyRoomPass(pass, { origin: `${SITE}/somewhere/else`, session, now: T + 1 });
    expect(r.ok && r.value).toMatchObject({ pubkey: getPublicKey(ME), session, name: "Ada", expiresAt: T + PASS_LIMITS.defaultTtlSec });
  });

  it("never lives longer than twelve hours, or shorter than a minute", () => {
    const exp = (ttlSec: number) => Number(buildRoomPass({ session, origin: SITE, createdAt: T, ttlSec }).tags.find((t) => t[0] === "expiration")![1]) - T;
    expect(exp(99 * 3600)).toBe(PASS_LIMITS.maxTtlSec);
    expect(exp(0)).toBe(60);
    expect(exp(1800)).toBe(1800);
  });

  it("leaves the name out when nothing is left of it", () => {
    expect(buildRoomPass({ session, origin: SITE, name: " \n\t ", createdAt: T }).tags.some((t) => t[0] === "name")).toBe(false);
  });

  it("is not believed without a session key to match, when one is asked for", () => {
    const pass = finalizeEvent(buildRoomPass({ session, origin: SITE, createdAt: T }), ME);
    expect(verifyRoomPass(pass, { origin: SITE, now: T + 1 }).ok).toBe(true); // a world reading its own arrival
    expect(verifyRoomPass(pass, { origin: SITE, session: getPublicKey(ME), now: T + 1 }).ok).toBe(false);
    expect(verifyRoomPass({ ...pass, sig: "0".repeat(128) }, { origin: SITE, session, now: T + 1 }).ok).toBe(false);
    expect(verifyRoomPass("not an event", { origin: SITE }).ok).toBe(false);
  });
});

describe("names", () => {
  it("are one tidy line", () => {
    expect(cleanName("  Ada   Lovelace \n")).toBe("Ada Lovelace");
    expect(cleanName("A\u0000d\u200ba\u202e")).toBe("A d a");
    expect(cleanName("\u200b\u200b")).toBe("");
    expect([...cleanName("é".repeat(80))].length).toBe(PASS_LIMITS.nameChars);
    expect([...cleanName("🙂".repeat(80))].length).toBe(PASS_LIMITS.nameChars); // counted as people see them, not as bytes
  });

  it("writes a key the way people write one", () => {
    // The example from NIP-19.
    expect(encodeNpub("3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d")).toBe("npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6");
    expect(shortNpub("3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d")).toBe("npub180cvv\u2026h6w6");
  });
});

describe("a seed that is a key", () => {
  it("is a claim to that key, and nothing else is", () => {
    expect(claimsKey(getPublicKey(ME))).toBe(true);
    expect(claimsKey(getPublicKey(ME).toUpperCase())).toBe(true);
    expect(claimsKey("g0123456789abcdef01234567")).toBe(false);
    expect(claimsKey("guest-7f3a91c2")).toBe(false);
  });
});

describe("a pass in the arrival context", () => {
  const pass = finalizeEvent(buildRoomPass({ session, origin: SITE, name: "Ada", createdAt: T }), ME);

  it("travels with the session key it names", () => {
    const r = decodeArrival(encodeArrival({ pass, sessionKey: bytesToHex(SESSION) }));
    expect(r.ok && r.value.pass?.id).toBe(pass.id);
    expect(r.ok && r.value.sessionKey).toBe(bytesToHex(SESSION));
  });

  it("is dropped, with the key, when the two don't belong together", () => {
    for (const bad of [{ pass }, { sessionKey: bytesToHex(SESSION) }, { pass, sessionKey: bytesToHex(ME) }, { pass, sessionKey: "zz" }, { pass: { kind: 27300 }, sessionKey: bytesToHex(SESSION) }]) {
      const r = decodeArrival(Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "front", ...bad })).toString("base64url"));
      expect(r.ok && r.value, JSON.stringify(Object.keys(bad))).toEqual({ v: "nswp/arrival/0.3", entry: "front" });
      expect(r.warnings.map((w) => w.code)).toEqual(["invalid_pass"]);
    }
  });
});

describe("leaving a headset session to cross", () => {
  it("is said to the Airlock in the door's address, and only when true", () => {
    const door = { url: "https://world.example/" };
    const from = buildAirlockUrl("https://lobby.example/go/", door, { immersive: true });
    expect(from).toBe("https://lobby.example/go/#to=https%3A%2F%2Fworld.example%2F&xr=1");
    expect(parseAirlockFragment(new URL(from).hash)).toMatchObject({ url: "https://world.example/", immersive: true });
    const flat = buildAirlockUrl("https://lobby.example/go/", door);
    expect(flat).not.toContain("xr=");
    expect(parseAirlockFragment(new URL(flat).hash)?.immersive).toBeUndefined();
    expect(parseAirlockFragment("#to=https%3A%2F%2Fworld.example%2F&xr=yes")?.immersive).toBeUndefined();
  });

  it("is carried home too, where there is no destination", () => {
    expect(fragmentSaysImmersive("#xr=1")).toBe(true);
    expect(fragmentSaysImmersive("#to=x&xr=1")).toBe(true);
    expect(fragmentSaysImmersive("#to=xr=1")).toBe(false);
    expect(fragmentSaysImmersive("")).toBe(false);
  });

  it("reaches the world as one true-or-absent fact", () => {
    const r = decodeArrival(encodeArrival({ immersive: true }));
    expect(r.ok && r.value.immersive).toBe(true);
    const off = decodeArrival(Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", immersive: false })).toString("base64url"));
    expect(off.ok && off.value).toEqual({ v: "nswp/arrival/0.3" });
    expect(off.warnings).toEqual([]);
  });
});
