import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildWayUrl,
  wayWithoutDestination,
  audienceOf,
  CATEGORIES,
  categoryWords,
  arrivalParam,
  buildAirlockUrl,
  buildArrivalUrl,
  buildEntryAssertion,
  buildWorldEvent,
  checkDestination,
  checkPreviewBytes,
  previewOnWorldOrigin,
  decodeArrival,
  decodeNaddr,
  encodeNaddr,
  fetchManifest,
  finalizeEvent,
  getPublicKey,
  latestAddressable,
  parseAirlockFragment,
  parseManifest,
  parsePortal,
  parseWorldEvent,
  stripArrivalParam,
  verifyEntryAssertion,
  verifyEvent,
  verifyOrigin,
  WORLD_KIND,
  type World,
} from "../src/index.js";
import { T0, TEST_KEY_1, TEST_KEY_2, ZERO_AUX } from "./helpers.js";

const PK1 = getPublicKey(TEST_KEY_1);
const PK2 = getPublicKey(TEST_KEY_2);

const museum = () =>
  buildWorldEvent({
    d: "example-museum",
    title: "Example Virtual Museum",
    url: "https://museum.example/world",
    summary: "An immersive art gallery.",
    modes: ["immersive-vr", "inline-3d"],
    capabilities: ["webxr", "spatial-portals"],
    comfort: { locomotion: "teleport", intensity: "low", seated: "supported" },
    inputs: ["controllers", "hands"],
    perf: "standalone",
    topics: ["Museum", "art"],
    languages: ["en"],
    createdAt: T0,
    description: "Three wings.",
  });

const manifestFor = (pubkey: string, url = "https://museum.example/world") => ({
  schema: "nswp/manifest/0.3",
  publishers: { [pubkey]: { worlds: ["example-museum"] } },
  worlds: { "example-museum": { entry: { url, modes: ["immersive-vr"] }, entry_points: ["main-entrance"] } },
});

describe("events", () => {
  it("signs and verifies, and rejects tampering", () => {
    const e = finalizeEvent(museum(), TEST_KEY_1, ZERO_AUX);
    expect(verifyEvent(e)).toBe(true);
    expect(verifyEvent({ ...e, content: "changed" })).toBe(false);
    expect(verifyEvent({ ...e, sig: e.sig.replace(/^./, e.sig[0] === "0" ? "1" : "0") })).toBe(false);
    expect(verifyEvent({ ...e, pubkey: PK2 })).toBe(false);
  });

  it("produces reproducible signatures with fixed aux randomness", () => {
    expect(finalizeEvent(museum(), TEST_KEY_1, ZERO_AUX).sig).toBe(finalizeEvent(museum(), TEST_KEY_1, ZERO_AUX).sig);
  });

  it("keeps only the newest addressable event", () => {
    const old = finalizeEvent({ ...museum(), created_at: T0 - 10 }, TEST_KEY_1, ZERO_AUX);
    const neu = finalizeEvent(museum(), TEST_KEY_1, ZERO_AUX);
    expect(latestAddressable([neu, old])).toEqual([neu]);
  });
});

describe("naddr", () => {
  it("round-trips with relay hints", () => {
    const p = { kind: WORLD_KIND, pubkey: PK1, identifier: "example-museum", relays: ["wss://relay.example"] };
    expect(decodeNaddr(encodeNaddr(p))).toEqual(p);
  });
  it("rejects other bech32 types", () => {
    expect(() => decodeNaddr("npub1xyz")).toThrow();
  });
});

describe("world announcements", () => {
  it("parses a valid announcement", () => {
    const e = finalizeEvent(museum(), TEST_KEY_1, ZERO_AUX);
    const r = parseWorldEvent(e, { requireSigned: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
    expect(r.value.coordinate).toBe(`${WORLD_KIND}:${PK1}:example-museum`);
    expect(r.value.topics).toEqual(["museum", "art"]);
    expect(r.value.comfort).toEqual({ locomotion: "teleport", intensity: "low", seated: "supported" });
    expect(r.value.languages).toEqual(["en"]);
    expect(r.value.status).toBe("live");
  });

  it("requires d, title, r and alt", () => {
    const r = parseWorldEvent({ kind: WORLD_KIND, created_at: T0, content: "", tags: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => `${e.code}:${e.path}`).sort()).toEqual(
      ["missing_tag:tags.alt", "missing_tag:tags.d", "missing_tag:tags.r", "missing_tag:tags.title"].sort(),
    );
  });

  it("rejects non-https entry URLs", () => {
    const t = museum();
    t.tags = t.tags.map((x) => (x[0] === "r" ? ["r", "javascript:alert(1)"] : x));
    const r = parseWorldEvent(t);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("url_not_https");
  });

  it("warns, not fails, on unknown values (forward compatible)", () => {
    const t = museum();
    t.tags.push(["mode", "holodeck"], ["capability", "teleport-anywhere"]);
    const r = parseWorldEvent(t);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(["unknown_value", "unknown_value"]);
  });

  it("warns when an l label has no L namespace", () => {
    const t = museum();
    t.tags = t.tags.filter((x) => x[0] !== "L");
    const r = parseWorldEvent(t);
    expect(r.warnings.map((w) => w.code)).toContain("label_namespace_missing");
  });

  it("rejects a wrong kind and duplicate d", () => {
    const t = museum();
    t.kind = 30078;
    t.tags.push(["d", "other"]);
    const r = parseWorldEvent(t);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code).sort()).toEqual(["duplicate_tag", "wrong_kind"]);
  });
});

describe("manifests and origin verification", () => {
  const world = (): World => {
    const r = parseWorldEvent(finalizeEvent(museum(), TEST_KEY_1, ZERO_AUX));
    if (!r.ok) throw new Error("fixture invalid");
    return r.value;
  };
  const wk = "https://museum.example/.well-known/nswp.json";

  it("verifies when all four rules hold", () => {
    const m = parseManifest(manifestFor(PK1));
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(verifyOrigin(world(), m.value, wk).verified).toBe(true);
  });

  it("fails each rule independently", () => {
    const m = parseManifest(manifestFor(PK2));
    if (!m.ok) throw new Error();
    const v = verifyOrigin(world(), m.value, wk);
    expect(v.verified).toBe(false);
    expect(v.checks.find((c) => c.name === "publisher_listed")?.ok).toBe(false);

    const m2 = parseManifest(manifestFor(PK1));
    if (!m2.ok) throw new Error();
    expect(verifyOrigin(world(), m2.value, "https://evil.example/.well-known/nswp.json").checks[0]?.ok).toBe(false);
    expect(verifyOrigin(world(), m2.value, "https://museum.example/nswp.json").checks[0]?.ok).toBe(false);

    const m3 = parseManifest(manifestFor(PK1, "https://museum.example/other"));
    if (!m3.ok) throw new Error();
    expect(verifyOrigin(world(), m3.value, wk).checks.find((c) => c.name === "entry_url_matches")?.ok).toBe(false);
  });

  it("rejects oversized and malformed manifests", () => {
    expect(parseManifest(manifestFor(PK1), { byteLength: 70000 }).ok).toBe(false);
    expect(parseManifest({ schema: "nswp/manifest/0.3", publishers: { NOTHEX: { worlds: [] } }, worlds: {} }).ok).toBe(false);
    expect(parseManifest({ schema: "other", publishers: {}, worlds: {} }).ok).toBe(false);
  });

  it("fetchManifest refuses redirects, reports CORS, and never throws", async () => {
    const calls: RequestInit[] = [];
    const ok: typeof fetch = async (_u, init) => {
      calls.push(init ?? {});
      return new Response(JSON.stringify(manifestFor(PK1)), { headers: { "access-control-allow-origin": "https://x.example" } });
    };
    const r = await fetchManifest("https://museum.example/world", ok);
    expect(calls[0]?.redirect).toBe("error");
    expect(r.manifest).toBeDefined();
    expect(r.warnings.map((w) => w.code)).toContain("cors_restricted");

    const failing: typeof fetch = async () => {
      throw new TypeError("network");
    };
    const f = await fetchManifest("https://museum.example/", failing);
    expect(f.issues[0]?.code).toBe("manifest_unreachable");
    const notFound: typeof fetch = async () => new Response("nope", { status: 404 });
    expect((await fetchManifest("https://museum.example/", notFound)).issues[0]?.code).toBe("manifest_not_found");
  });
});

describe("destinations (Airlock)", () => {
  it("accepts https and splits the registrable domain", () => {
    const r = checkDestination("https://wing.museum.example.co.uk/world");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.registrableDomain).toBe("example.co.uk");
      expect(r.value.hostPrefix).toBe("wing.museum.");
    }
  });

  it("treats each vercel.app / github.io site as its own domain", () => {
    const r = checkDestination("https://nswp-world-a.vercel.app/");
    expect(r.ok && r.value.registrableDomain).toBe("nswp-world-a.vercel.app");
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "http://museum.example/", "file:///etc/passwd", "ftp://x.example", "not a url", ""])(
    "rejects %s",
    (u) => expect(checkDestination(u).ok).toBe(false),
  );

  it("rejects credentials in URLs", () => {
    const r = checkDestination("https://user:pass@museum.example/");
    expect(!r.ok && r.error.code).toBe("url_has_credentials");
  });

  it("flags punycode, IPs and odd ports", () => {
    const codes = (u: string) => checkDestination(u).warnings.map((w) => w.code);
    expect(codes("https://аpple.com/")).toContain("punycode_hostname");
    expect(codes("https://203.0.113.9/")).toContain("ip_address_host");
    expect(codes("https://museum.example:8443/")).toContain("non_default_port");
  });

  it("allows localhost only when asked", () => {
    expect(checkDestination("http://localhost:5173/").ok).toBe(false);
    expect(checkDestination("http://localhost:5173/", { allowLocalhost: true }).ok).toBe(true);
  });
});

describe("portals and Airlock fragments", () => {
  const naddr = encodeNaddr({ kind: WORLD_KIND, pubkey: PK1, identifier: "example-museum" });

  it("parses a portal", () => {
    const r = parsePortal({ schema: "nswp/portal/0.3", label: "Go", destination: { naddr, url: "https://museum.example/world", entry_point: "main" } });
    expect(r.ok).toBe(true);
  });

  it("rejects a portal to a non-https URL", () => {
    expect(parsePortal({ schema: "nswp/portal/0.3", label: "Go", destination: { url: "javascript:alert(1)" } }).ok).toBe(false);
  });

  it("round-trips the Airlock fragment", () => {
    const url = buildAirlockUrl("https://airlock.example/go", { naddr, url: "https://museum.example/world?x=1&y=2", entryPoint: "north-wing" });
    expect(url).not.toContain("?to=");
    const req = parseAirlockFragment(new URL(url).hash);
    expect(req?.naddr?.identifier).toBe("example-museum");
    expect(req?.url).toBe("https://museum.example/world?x=1&y=2");
    expect(req?.entryPoint).toBe("north-wing");
  });

  it("returns null with no destination", () => {
    expect(parseAirlockFragment("#")).toBeNull();
  });
});

describe("arrival context", () => {
  it("round-trips and keeps an existing fragment", () => {
    const url = buildArrivalUrl("https://museum.example/world#room=2", { entry: "main-entrance", airlock: "https://airlock.example/go" });
    const hash = new URL(url).hash;
    expect(hash.startsWith("#room=2&nswp=")).toBe(true);
    const r = decodeArrival(arrivalParam(hash)!);
    expect(r.ok && r.value).toEqual({ v: "nswp/arrival/0.3", entry: "main-entrance", airlock: "https://airlock.example/go" });
    expect(stripArrivalParam(hash)).toBe("#room=2");
    expect(stripArrivalParam("#nswp=abc")).toBe("");
  });

  it("drops a non-https return Airlock and bad entry points", () => {
    const r = decodeArrival(
      Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", airlock: "javascript:x", entry: "../../etc" })).toString("base64url"),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.airlock).toBeUndefined();
      expect(r.value.entry).toBeUndefined();
      expect(r.warnings.map((w) => w.code).sort()).toEqual(["invalid_entry_point", "url_not_https"]);
    }
  });

  it("rejects garbage", () => {
    expect(decodeArrival("%%%").ok).toBe(false);
    expect(decodeArrival("x".repeat(20000)).ok).toBe(false);
  });
});

describe("entry assertions", () => {
  const origin = "https://museum.example";
  const make = (over: { url?: string; createdAt?: number; ttlSec?: number; nonce?: string } = {}) =>
    finalizeEvent(
      buildEntryAssertion({ url: over.url ?? `${origin}/world`, createdAt: over.createdAt ?? T0, ttlSec: over.ttlSec ?? 60, nonce: over.nonce ?? "0123456789abcdefABCD" }),
      TEST_KEY_1,
      ZERO_AUX,
    );

  it("accepts a fresh, origin-bound assertion", () => {
    const r = verifyEntryAssertion(make(), { origin, now: T0 + 5 });
    expect(r.ok && r.value.pubkey).toBe(PK1);
  });

  it("rejects the wrong origin", () => {
    const r = verifyEntryAssertion(make({ url: "https://evil.example/world" }), { origin, now: T0 + 5 });
    expect(!r.ok && r.errors.map((e) => e.code)).toContain("origin_mismatch");
  });

  it("rejects expiry, future dating, replay and short nonces", () => {
    const codes = (r: ReturnType<typeof verifyEntryAssertion>) => (r.ok ? [] : r.errors.map((e) => e.code));
    expect(codes(verifyEntryAssertion(make(), { origin, now: T0 + 61 }))).toContain("assertion_expired");
    expect(codes(verifyEntryAssertion(make({ createdAt: T0 + 100 }), { origin, now: T0 }))).toContain("created_in_future");
    const e = make();
    expect(codes(verifyEntryAssertion(e, { origin, now: T0 + 1, seen: new Set([e.id]) }))).toContain("assertion_replayed");
    expect(codes(verifyEntryAssertion(make({ nonce: "short" }), { origin, now: T0 + 1 }))).toContain("nonce_too_short");
  });

  it("caps the lifetime at 60 seconds", () => {
    const tags = buildEntryAssertion({ url: `${origin}/`, createdAt: T0, ttlSec: 3600 }).tags;
    expect(tags.find((t) => t[0] === "expiration")?.[1]).toBe(String(T0 + 60));
  });

  it("rejects a tampered assertion", () => {
    const e = make();
    const r = verifyEntryAssertion({ ...e, tags: [...e.tags, ["nswp:mutes", "shared"]] }, { origin, now: T0 + 1 });
    expect(!r.ok && r.errors[0]?.code).toBe("bad_signature");
  });
});

describe("previews (spec §5.8)", () => {
  const hash = "ab".repeat(32);
  const withPreview = (...preview: string[][]) => {
    const t = museum();
    t.tags.push(...preview);
    return parseWorldEvent(t);
  };

  it("reads a pano and a flat preview and round-trips through buildWorldEvent", () => {
    const built = buildWorldEvent({
      d: "x",
      title: "X",
      url: "https://x.example/",
      previews: [
        { url: "https://blossom.example/a.webp", type: "pano", sha256: hash, width: 4096, height: 2048 },
        { url: "https://blossom.example/b.webp", type: "flat", sha256: hash },
      ],
      createdAt: T0,
    });
    const r = parseWorldEvent(built);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
    expect(r.value.previews).toEqual([
      { url: "https://blossom.example/a.webp", type: "pano", sha256: hash, width: 4096, height: 2048 },
      { url: "https://blossom.example/b.webp", type: "flat", sha256: hash },
    ]);
  });

  it("drops a bad preview with a warning and keeps the world valid", () => {
    const cases: [string[], string][] = [
      [["preview", "https://b.example/a.webp", "pano"], "preview_hash_missing"],
      [["preview", "https://b.example/a.webp", "pano", "NOTHEX"], "preview_hash_missing"],
      [["preview", "http://b.example/a.webp", "pano", hash], "url_not_https"],
      [["preview", "https://b.example/a.webp", "hologram", hash], "unknown_value"],
      [["preview", "https://b.example/a.webp", "pano", hash, "8192x4096"], "preview_too_large"],
      [["preview", "https://b.example/a.webp", "pano", hash, "2048x2048"], "preview_not_panorama"],
      [["preview", "https://b.example/a.webp", "flat", hash, "wide"], "preview_dimensions_invalid"],
    ];
    for (const [tag, code] of cases) {
      const r = withPreview(tag);
      expect(r.ok, code).toBe(true);
      if (r.ok) expect(r.value.previews, code).toEqual([]);
      expect(r.warnings.map((w) => w.code), code).toEqual([code]);
    }
  });

  it("keeps only the first preview of each type", () => {
    const r = withPreview(["preview", "https://b.example/1.webp", "pano", hash], ["preview", "https://b.example/2.webp", "pano", hash]);
    expect(r.ok && r.value.previews.map((p) => p.url)).toEqual(["https://b.example/1.webp"]);
    expect(r.warnings.map((w) => w.code)).toEqual(["duplicate_tag"]);
  });

  it("checks fetched bytes against the hash and the size ceiling", () => {
    const bytes = new TextEncoder().encode("not really an image");
    const real = "5bd6045b14f5cc06a8ab08f0f9ea76d0a8eb53a30a1d5cb5e2ed5a0a1b1dbe0a";
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(checkPreviewBytes({ url: "https://b.example/a", type: "flat", sha256: sha }, bytes)).toEqual({ ok: true });
    expect(checkPreviewBytes({ url: "https://b.example/a", type: "flat", sha256: real }, bytes)).toMatchObject({ ok: false, code: "preview_hash_mismatch" });
    expect(checkPreviewBytes({ url: "https://b.example/a", type: "flat", sha256: sha }, new Uint8Array(600 * 1024))).toMatchObject({ ok: false, code: "preview_too_large" });
  });

  it("knows when a preview lives on the world's own site", () => {
    const world = { url: "https://museum.example/world" };
    expect(previewOnWorldOrigin(world, { url: "https://museum.example/p.webp", type: "pano", sha256: hash })).toBe(true);
    expect(previewOnWorldOrigin(world, { url: "https://blossom.example/p.webp", type: "pano", sha256: hash })).toBe(false);
  });
});

describe("a way with no destination", () => {
  it("is home, or the visitor's doors, and may say they came from a headset", () => {
    expect(wayWithoutDestination("")).toEqual({ immersive: false, doors: false });
    expect(wayWithoutDestination("#")).toEqual({ immersive: false, doors: false });
    expect(wayWithoutDestination("#xr=1")).toEqual({ immersive: true, doors: false });
    expect(wayWithoutDestination("#doors=1")).toEqual({ immersive: false, doors: true });
    expect(wayWithoutDestination("#doors=1&xr=1")).toEqual({ immersive: true, doors: true });
    expect(wayWithoutDestination("#xr=1&doors=1")).toEqual({ immersive: true, doors: true });
  });

  it("is nothing else: anything more in the address is a crossing or a mistake", () => {
    for (const hash of ["#to=https://museum.example/", "#doors=1&to=https://museum.example/", "#doors=yes", "#xr=2", "#home=1", "#doors=1&x"]) expect(wayWithoutDestination(hash), hash).toBeNull();
  });

  it("is built the way it is read", () => {
    const airlock = "https://portal.bitblocks.network/go/";
    expect(buildWayUrl(airlock)).toBe(airlock);
    expect(buildWayUrl(airlock, { immersive: true })).toBe(`${airlock}#xr=1`);
    expect(buildWayUrl(airlock, { doors: true, immersive: true })).toBe(`${airlock}#doors=1&xr=1`);
    for (const o of [{}, { doors: true }, { immersive: true }, { doors: true, immersive: true }]) expect(wayWithoutDestination(new URL(buildWayUrl(airlock, o)).hash)).toEqual({ immersive: !!o.immersive, doors: !!o.doors });
    // An Airlock's own fragment is replaced, never added to.
    expect(buildWayUrl(`${airlock}#to=https://elsewhere.example`, { doors: true })).toBe(`${airlock}#doors=1`);
  });
});

describe("who a world is for", () => {
  const base = { d: "w", title: "W", url: "https://w.example/" };
  const read = (w: Parameters<typeof buildWorldEvent>[0]) => {
    const r = parseWorldEvent(buildWorldEvent(w));
    if (!r.ok) throw new Error("should parse");
    return r.value;
  };

  it("is the maker's word, carried in the announcement", () => {
    expect(read({ ...base, audience: "kids" }).audience).toBe("kids");
    expect(read({ ...base, audience: "general" }).audience).toBe("general");
    expect(read(base).audience).toBeUndefined();
  });

  it("says what kind of place it is, from a closed list", () => {
    expect(read({ ...base, category: "game" }).category).toBe("game");
    expect(read(base).category).toBeUndefined();
    const odd = buildWorldEvent(base);
    odd.tags.push(["category", "casino"]);
    const r = parseWorldEvent(odd);
    expect(r.ok && r.value.category).toBeUndefined();
    expect(r.warnings.map((w) => w.code)).toContain("unknown_category");
    expect(categoryWords("game")).toBe("A game");
    expect(categoryWords("casino")).toBeNull();
    expect(CATEGORIES.every((c) => categoryWords(c))).toBe(true);
  });

  it("gives an adult world the warning other clients already read", () => {
    const adult = read({ ...base, audience: "adult" });
    expect(adult.audience).toBe("adult");
    expect(adult.contentWarning).toBe("adult");
    // A maker's own reason is kept.
    expect(read({ ...base, audience: "adult", contentWarning: "nudity" }).contentWarning).toBe("nudity");
  });

  it("is read with care: a warning with no audience is taken as adult", () => {
    expect(audienceOf(read({ ...base, audience: "kids" }))).toBe("kids");
    expect(audienceOf(read({ ...base, audience: "general", contentWarning: "flashing lights" }))).toBe("general");
    expect(audienceOf(read({ ...base, contentWarning: "flashing lights" }))).toBe("adult");
    expect(audienceOf(read({ ...base, contentWarning: true }))).toBe("adult");
    expect(audienceOf(read(base))).toBe("unrated");
  });
});
