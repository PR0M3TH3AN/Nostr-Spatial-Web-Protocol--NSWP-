/** Passes (protocol/10-identity.md). The vectors cover reading one; these cover making one and the small rules beside it. */
import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { buildAirlockUrl, buildRoomPass, buildWayUrl, wayWithoutDestination, claimsKey, cleanName, decodeArrival, decodeNpub, isPublicKey, encodeArrival, encodeNpub, finalizeEvent, fragmentSaysImmersive, getPublicKey, parseAirlockFragment, PASS_LIMITS, shortNpub, verifyRoomPass } from "../src/index.js";

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

  it("reads one back, and refuses what only looks like one", () => {
    const key = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
    expect(decodeNpub(encodeNpub(key))).toBe(key);
    expect(decodeNpub(`  ${key.toUpperCase()} `)).toBe(key);
    expect(isPublicKey(key)).toBe(true);
    // The right length and letters, and no key at all: nothing on the curve has this x.
    const none = "cd".repeat(32);
    expect(isPublicKey(none)).toBe(false);
    expect(() => decodeNpub(none)).toThrow(/not a public key/);
    expect(() => decodeNpub(encodeNpub(none))).toThrow(/not a public key/);
    for (const bad of ["", "npub1", "npub1nonsense", key.slice(1), "nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5"]) expect(() => decodeNpub(bad), bad).toThrow();
    expect(isPublicKey(42)).toBe(false);
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

  it("carries joined and the microphone in a door's link, and the microphone only with joined", () => {
    const door = { url: "https://world.example/" };
    const both = buildAirlockUrl("https://lobby.example/go/", door, { immersive: true, joined: true, mic: true });
    expect(both).toBe("https://lobby.example/go/#to=https%3A%2F%2Fworld.example%2F&xr=1&joined=1&mic=1");
    expect(parseAirlockFragment(new URL(both).hash)).toMatchObject({ immersive: true, joined: true, mic: true });
    expect(buildAirlockUrl("https://lobby.example/go/", door, { mic: true })).toBe("https://lobby.example/go/#to=https%3A%2F%2Fworld.example%2F");
    const r = parseAirlockFragment("#to=https%3A%2F%2Fworld.example%2F&mic=1");
    expect(r?.joined).toBeUndefined();
    expect(r?.mic).toBeUndefined();
    expect(parseAirlockFragment("#to=https%3A%2F%2Fworld.example%2F&joined=yes&mic=1")?.joined).toBeUndefined();
    expect(wayWithoutDestination("#joined=1&mic=1")).toEqual({ immersive: false, doors: false, joined: true, mic: true });
    expect(wayWithoutDestination("#mic=1")).toEqual({ immersive: false, doors: false });
    expect(buildWayUrl("https://lobby.example/go/", { doors: true, joined: true, mic: true })).toBe("https://lobby.example/go/#doors=1&joined=1&mic=1");
  });

  it("carries who was blocked on a link, as keys and nothing else", () => {
    const a = "ab".repeat(32);
    const b = "cd".repeat(32);
    const door = { url: "https://world.example/" };
    const link = buildAirlockUrl("https://lobby.example/go/", door, { blocked: [a, b, a, "not a key", "AB".repeat(32)] });
    expect(link).toBe(`https://lobby.example/go/#to=https%3A%2F%2Fworld.example%2F&blocked=${a},${b}`);
    expect(parseAirlockFragment(new URL(link).hash)?.blocked).toEqual([a, b]);
    expect(buildAirlockUrl("https://lobby.example/go/", door, { blocked: [] })).toBe("https://lobby.example/go/#to=https%3A%2F%2Fworld.example%2F");
    expect(parseAirlockFragment("#to=https%3A%2F%2Fworld.example%2F&blocked=everyone")?.blocked).toBeUndefined();
    expect(parseAirlockFragment(`#to=https%3A%2F%2Fworld.example%2F&blocked=${Array.from({ length: 40 }, (_, i) => i.toString(16).padStart(64, "0")).join(",")}`)?.blocked).toHaveLength(16);
    // A way home may carry it too, and is still a way home.
    expect(wayWithoutDestination(`#joined=1&blocked=${a}`)).toEqual({ immersive: false, doors: false, joined: true, blocked: [a] });
    expect(wayWithoutDestination("#blocked=<script>")).toBeNull();
    expect(buildWayUrl("https://lobby.example/go/", { doors: true, blocked: [b] })).toBe(`https://lobby.example/go/#doors=1&blocked=${b}`);
  });

  it("carries the form a visitor is in through a door, and never on the way home", () => {
    const door = { url: "https://world.example/" };
    const link = buildAirlockUrl("https://lobby.example/go/", door, { form: "touch", immersive: true });
    expect(link).toBe("https://lobby.example/go/#to=https%3A%2F%2Fworld.example%2F&xr=1&form=touch");
    expect(parseAirlockFragment(new URL(link).hash)).toMatchObject({ form: "touch", immersive: true });
    expect(parseAirlockFragment("#to=https%3A%2F%2Fworld.example%2F&form=desk")?.form).toBe("desk");
    // A form nobody knows is no form at all, and so is one that isn't lower case.
    for (const odd of ["hologram", "Touch", "", "1"]) expect(parseAirlockFragment(`#to=https%3A%2F%2Fworld.example%2F&form=${odd}`)?.form).toBeUndefined();
    expect(buildAirlockUrl("https://lobby.example/go/", door, { form: "hologram" as never })).toBe("https://lobby.example/go/#to=https%3A%2F%2Fworld.example%2F");
    // The way home says nothing of it: a visitor's own client knows their device, and an older one still reads the link.
    expect(buildWayUrl("https://lobby.example/go/", { form: "touch", immersive: true })).toBe("https://lobby.example/go/#xr=1");
    // In an arrival it is kept as said, and anything else is ignored with a warning.
    const arrived = decodeArrival(encodeArrival({ entry: "main-entrance", form: "desk" }));
    expect(arrived.ok && arrived.value.form).toBe("desk");
    const odd = decodeArrival(Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", form: "hologram" })).toString("base64url"));
    expect(odd.ok && odd.value.form).toBeUndefined();
    expect(odd.warnings.map((w) => w.code)).toContain("invalid_form");
  });

  it("carries the intense way of moving on a link and in an arrival, as a preference", () => {
    const door = { url: "https://world.example/" };
    const link = buildAirlockUrl("https://lobby.example/go/", door, { moving: "intense", joined: true });
    expect(link).toBe("https://lobby.example/go/#to=https%3A%2F%2Fworld.example%2F&moving=intense&joined=1");
    expect(parseAirlockFragment(new URL(link).hash)).toMatchObject({ moving: "intense", joined: true });
    expect(parseAirlockFragment("#to=https%3A%2F%2Fworld.example%2F&moving=flying")?.moving).toBeUndefined();
    expect(parseAirlockFragment("#to=https%3A%2F%2Fworld.example%2F&moving=casual")?.moving).toBeUndefined();
    expect(wayWithoutDestination("#moving=intense")).toEqual({ immersive: false, doors: false, moving: "intense" });
    expect(wayWithoutDestination("#moving=flying")).toBeNull();
    expect(buildWayUrl("https://lobby.example/go/", { doors: true, moving: "intense" })).toBe("https://lobby.example/go/#doors=1&moving=intense");
    const r = decodeArrival(encodeArrival({ moving: "intense" }));
    expect(r.ok && r.value.moving).toBe("intense");
  });

  it("reads a visitor's block list in an arrival, whole or not at all", () => {
    const a = "ab".repeat(32);
    const r = decodeArrival(encodeArrival({ blocked: [a] }));
    expect(r.ok && r.value.blocked).toEqual([a]);
    const bad = decodeArrival(Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", blocked: [a, 7] })).toString("base64url"));
    expect(bad.ok && bad.value.blocked).toBeUndefined();
    expect(bad.ok && bad.warnings.map((w) => w.code)).toEqual(["invalid_blocked"]);
  });

  it("reads joined in an arrival, and a microphone only beside it", () => {
    const r = decodeArrival(encodeArrival({ joined: true, mic: true }));
    expect(r.ok && r.value.joined && r.value.mic).toBe(true);
    const alone = decodeArrival(Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", mic: true })).toString("base64url"));
    expect(alone.ok && alone.value.mic).toBeUndefined();
    expect(alone.ok && alone.warnings.map((w) => w.code)).toEqual(["invalid_mic"]);
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

describe("a picture on a pass", () => {
  it("is an https address and nothing else", async () => {
    const { cleanPicture, PASS_LIMITS: L } = await import("../src/index.js");
    expect(cleanPicture("https://pictures.example/a.webp")).toBe("https://pictures.example/a.webp");
    for (const bad of ["http://pictures.example/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "https://user:pw@pictures.example/a.png", "https://localhost/a.png", "//pictures.example/a.png", "", 7, null, `https://pictures.example/${"a".repeat(L.pictureChars)}`]) expect(cleanPicture(bad), String(bad).slice(0, 40)).toBe("");
  });
  it("is signed with the rest of the pass, and read back only when the pass checks out", async () => {
    const { cleanPicture } = await import("../src/index.js");
    void cleanPicture;
    const secret = new Uint8Array(32).fill(7);
    const session = getPublicKey(new Uint8Array(32).fill(9));
    const pass = finalizeEvent(buildRoomPass({ session, origin: "https://museum.example", name: "Alice", picture: "https://pictures.example/alice.webp" }), secret);
    const checked = verifyRoomPass(pass, { origin: "https://museum.example", session });
    expect(checked.ok && checked.value.picture).toBe("https://pictures.example/alice.webp");
    // Changed after signing: the pass, picture and all, is worth nothing.
    const forged = { ...pass, tags: pass.tags.map((t) => (t[0] === "picture" ? ["picture", "https://evil.example/x.png"] : t)) };
    expect(verifyRoomPass(forged, { origin: "https://museum.example", session }).ok).toBe(false);
    // And one that isn't an https address is simply left out.
    expect(buildRoomPass({ session, origin: "https://museum.example", picture: "http://plain.example/a.png" }).tags.some((t) => t[0] === "picture")).toBe(false);
  });
});

describe("a few words about themselves on a pass", () => {
  it("is their own, signed with the rest, and plain text by the time it is read", async () => {
    const { cleanAbout } = await import("../src/index.js");
    const secret = new Uint8Array(32).fill(7);
    const session = getPublicKey(new Uint8Array(32).fill(9));
    const origin = "https://museum.example";
    const pass = finalizeEvent(buildRoomPass({ session, origin, name: "Alice", about: "  Keeper of the east wing.\nAsk me about the clocks.  " }), secret);
    const checked = verifyRoomPass(pass, { origin, session });
    expect(checked.ok && checked.value.about).toBe("Keeper of the east wing. Ask me about the clocks.");
    // Changed after signing: the whole pass is worth nothing.
    const forged = { ...pass, tags: pass.tags.map((t) => (t[0] === "about" ? ["about", "An official of this museum."] : t)) };
    expect(verifyRoomPass(forged, { origin, session }).ok).toBe(false);
    // Nothing to say is left out, and so is anything that isn't words.
    expect(buildRoomPass({ session, origin, about: "   " }).tags.some((t) => t[0] === "about")).toBe(false);
    expect(buildRoomPass({ session, origin, about: 7 as never }).tags.some((t) => t[0] === "about")).toBe(false);
    expect(verifyRoomPass(finalizeEvent(buildRoomPass({ session, origin }), secret), { origin, session })).toMatchObject({ ok: true, value: { about: "" } });
    // Long, or with something that would reverse it: cut short and tidied, by whoever reads it as well.
    const sly = `nice ${String.fromCodePoint(0x202e)}person ${"z".repeat(600)}`;
    expect([...cleanAbout(sly)]).toHaveLength(PASS_LIMITS.aboutChars);
    expect(cleanAbout(sly).startsWith("nice person zzz")).toBe(true);
    const raw = finalizeEvent({ kind: 27300, created_at: pass.created_at, tags: [...pass.tags.filter((t) => t[0] !== "about"), ["about", sly]], content: "" }, secret);
    const read = verifyRoomPass(raw, { origin, session });
    expect(read.ok && [...read.value.about]).toHaveLength(PASS_LIMITS.aboutChars);
    expect(read.warnings.map((w) => w.code)).toContain("about_cleaned");
  });
});
