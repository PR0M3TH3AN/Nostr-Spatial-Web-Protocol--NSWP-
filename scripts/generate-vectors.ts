/**
 * Generates vectors/*.json.
 *
 * Every vector carries a hand-written expectation. The generator runs the
 * reference implementation (@nswp/core) against each one and refuses to write
 * anything if the two disagree, so the vectors and the library can't drift.
 *
 *   npm run vectors          write vectors/
 *   npm run vectors:check    fail if vectors/ is stale or core disagrees
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  buildAvatarEvent,
  buildEntryAssertion,
  buildListEvent,
  buildRoomPass,
  buildWorldEvent,
  checkDestination,
  decodeArrival,
  decodeLook,
  decodeNaddr,
  encodeArrival,
  encodeNaddr,
  finalizeEvent,
  generatedLook,
  getPublicKey,
  markFor,
  markGrid,
  parseAvatarEvent,
  parseListEvent,
  parseManifest,
  parsePortal,
  parseWorldEvent,
  verifyEntryAssertion,
  verifyEvent,
  verifyOrigin,
  verifyRoomPass,
  CURATION_SET_KIND,
  WORLD_KIND,
  type EventTemplate,
  type NostrEvent,
} from "../packages/core/src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "vectors");
const check = process.argv.includes("--check");

const KEY1 = sha256(utf8ToBytes("nswp test vector key 1"));
const KEY2 = sha256(utf8ToBytes("nswp test vector key 2"));
/** A session key: the throwaway a pass speaks for. */
const KEY3 = sha256(utf8ToBytes("nswp test vector session key"));
const PK3 = getPublicKey(KEY3);
const PK1 = getPublicKey(KEY1);
const PK2 = getPublicKey(KEY2);
const AUX = new Uint8Array(32);
const T0 = 1794430800;
const sign = (t: EventTemplate, key = KEY1): NostrEvent => finalizeEvent(t, key, AUX);

const testKeys = {
  note: "TEST-ONLY keys derived from public strings: sha256(utf8(label)). Anyone can sign as them. Signatures use 32 zero bytes of BIP-340 aux randomness so they are reproducible.",
  key1: { label: "nswp test vector key 1", secretKey: bytesToHex(KEY1), pubkey: PK1 },
  key2: { label: "nswp test vector key 2", secretKey: bytesToHex(KEY2), pubkey: PK2 },
  session: { label: "nswp test vector session key", secretKey: bytesToHex(KEY3), pubkey: PK3 },
};

const failures: string[] = [];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function expectEqual(where: string, got: unknown, want: unknown) {
  if (!same(got, want)) failures.push(`${where}\n  expected ${JSON.stringify(want)}\n  got      ${JSON.stringify(got)}`);
}
const codes = (xs: { code: string }[]) => xs.map((x) => x.code).sort();

// ---------------------------------------------------------------- world events
const baseWorld = {
  d: "example-museum",
  title: "Example Virtual Museum",
  url: "https://museum.example/world",
  summary: "An immersive art gallery with three wings.",
  image: { url: "https://blossom.example/0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0.webp", dimensions: "1920x1080" },
  modes: ["immersive-vr", "inline-3d"],
  capabilities: ["webxr", "spatial-portals", "entry-assertion"],
  comfort: { locomotion: "teleport", intensity: "low", seated: "supported" },
  inputs: ["controllers", "hands"],
  perf: "standalone",
  topics: ["museum", "art"],
  languages: ["en"],
  createdAt: T0,
  description: "Walk through three wings of rotating exhibitions.",
};
const withTags = (f: (tags: string[][]) => string[][]): EventTemplate => {
  const t = buildWorldEvent(baseWorld);
  return { ...t, tags: f(t.tags) };
};

type WorldVector = { name: string; description: string; event: unknown; expect: { valid: boolean; signatureValid: boolean | null; errors: string[]; warnings: string[] } };
const worldCases: Omit<WorldVector, "event"> & { event: unknown }[] = [];
const goodWorld = sign(buildWorldEvent(baseWorld));
const tampered = { ...goodWorld, content: "edited after signing" };
const worldVectors: WorldVector[] = [
  { name: "valid_full", description: "A complete, signed announcement.", event: goodWorld, expect: { valid: true, signatureValid: true, errors: [], warnings: [] } },
  {
    name: "valid_minimal",
    description: "Only the required tags.",
    event: sign({ kind: WORLD_KIND, created_at: T0, content: "", tags: [["d", "tiny"], ["title", "Tiny"], ["r", "https://tiny.example/"], ["alt", "Spatial world listing: Tiny"]] }),
    expect: { valid: true, signatureValid: true, errors: [], warnings: [] },
  },
  { name: "tampered_content", description: "Content changed after signing: the structure is valid but the signature is not.", event: tampered, expect: { valid: true, signatureValid: false, errors: [], warnings: [] } },
  {
    name: "missing_required",
    description: "No d, title, r or alt.",
    event: { kind: WORLD_KIND, created_at: T0, content: "", tags: [["t", "art"]] },
    expect: { valid: false, signatureValid: null, errors: ["missing_tag", "missing_tag", "missing_tag", "missing_tag"], warnings: [] },
  },
  {
    name: "entry_not_https",
    description: "A javascript: entry URL must be rejected.",
    event: withTags((t) => t.map((x) => (x[0] === "r" ? ["r", "javascript:alert(1)"] : x))),
    expect: { valid: false, signatureValid: null, errors: ["url_not_https"], warnings: [] },
  },
  {
    name: "duplicate_r",
    description: "Two entry URLs are ambiguous.",
    event: withTags((t) => [...t, ["r", "https://other.example/"]]),
    expect: { valid: false, signatureValid: null, errors: ["duplicate_tag"], warnings: [] },
  },
  {
    name: "wrong_kind",
    description: "kind 30078 is not a world announcement.",
    event: { ...buildWorldEvent(baseWorld), kind: 30078 },
    expect: { valid: false, signatureValid: null, errors: ["wrong_kind"], warnings: [] },
  },
  {
    name: "unknown_values_are_warnings",
    description: "Unknown modes, capabilities and perf tiers must not break older clients.",
    event: withTags((t) => [...t.filter((x) => x[0] !== "perf"), ["mode", "holodeck"], ["capability", "time-travel"], ["perf", "supercomputer"]]),
    expect: { valid: true, signatureValid: null, errors: [], warnings: ["unknown_value", "unknown_value", "unknown_value"] },
  },
  {
    name: "label_without_namespace",
    description: "An l tag needs its L namespace (NIP-32).",
    event: withTags((t) => t.filter((x) => x[0] !== "L")),
    expect: { valid: true, signatureValid: null, errors: [], warnings: ["label_namespace_missing"] },
  },
  {
    name: "duplicate_comfort_key",
    description: "Two locomotion values contradict each other.",
    event: withTags((t) => [...t, ["comfort", "locomotion", "smooth"]]),
    expect: { valid: false, signatureValid: null, errors: ["duplicate_tag"], warnings: [] },
  },
  {
    name: "preview_valid",
    description: "A pano preview with its hash and dimensions (spec §5.8).",
    event: withTags((t) => [...t, ["preview", "https://blossom.example/pano.webp", "pano", "ab".repeat(32), "4096x2048"]]),
    expect: { valid: true, signatureValid: null, errors: [], warnings: [] },
  },
  {
    name: "preview_without_hash",
    description: "A preview with no hash can't be checked, so it is ignored. The world stays valid.",
    event: withTags((t) => [...t, ["preview", "https://blossom.example/pano.webp", "pano"]]),
    expect: { valid: true, signatureValid: null, errors: [], warnings: ["preview_hash_missing"] },
  },
  {
    name: "preview_over_ceiling",
    description: "A pano larger than 4096x2048 is ignored.",
    event: withTags((t) => [...t, ["preview", "https://blossom.example/pano.webp", "pano", "ab".repeat(32), "8192x4096"]]),
    expect: { valid: true, signatureValid: null, errors: [], warnings: ["preview_too_large"] },
  },
  {
    name: "preview_unknown_type",
    description: "A preview type this version doesn't know is ignored, so newer types don't break older clients.",
    event: withTags((t) => [...t, ["preview", "https://blossom.example/scene.glb", "diorama", "ab".repeat(32)]]),
    expect: { valid: true, signatureValid: null, errors: [], warnings: ["unknown_value"] },
  },
  {
    name: "manifest_not_well_known",
    description: "A manifest elsewhere is allowed but can never verify the publisher.",
    event: withTags((t) => [...t, ["manifest", "https://museum.example/nswp.json"]]),
    expect: { valid: true, signatureValid: null, errors: [], warnings: ["manifest_not_well_known"] },
  },
];
for (const v of worldVectors) {
  const r = parseWorldEvent(v.event);
  expectEqual(`world/${v.name} valid`, r.ok, v.expect.valid);
  expectEqual(`world/${v.name} errors`, r.ok ? [] : codes(r.errors), [...v.expect.errors].sort());
  expectEqual(`world/${v.name} warnings`, codes(r.warnings), [...v.expect.warnings].sort());
  const sigProvided = typeof v.event === "object" && v.event !== null && "sig" in v.event;
  expectEqual(`world/${v.name} signature`, sigProvided ? verifyEvent(v.event) : null, v.expect.signatureValid);
}
void worldCases;

// ------------------------------------------------------------------ manifests
const manifest = (over: Record<string, unknown> = {}) => ({
  schema: "nswp/manifest/0.3",
  publishers: { [PK1]: { worlds: ["example-museum"] } },
  worlds: {
    "example-museum": {
      entry: { url: "https://museum.example/world", modes: ["immersive-vr", "inline-3d"] },
      entry_points: ["main-entrance", "north-wing"],
      capabilities: ["webxr", "spatial-portals"],
      multiplayer: { endpoint: "wss://museum.example/session", auth: "entry-assertion" },
    },
  },
  relays: ["wss://relay.example"],
  ...over,
});
const manifestVectors = [
  { name: "valid", description: "A complete manifest.", manifest: manifest(), expect: { valid: true, errors: [], warnings: [] } },
  { name: "listing_deny", description: "The origin opts out of third-party listing.", manifest: manifest({ listing: "deny" }), expect: { valid: true, errors: [], warnings: [] } },
  { name: "too_large", description: "Bodies over 64 KB are rejected.", manifest: manifest(), byteLength: 70000, expect: { valid: false, errors: ["manifest_too_large"], warnings: [] } },
  { name: "bad_publisher_key", description: "Publisher keys must be lowercase hex.", manifest: manifest({ publishers: { [PK1.toUpperCase()]: { worlds: ["example-museum"] } } }), expect: { valid: false, errors: ["invalid_pubkey"], warnings: [] } },
  { name: "wrong_schema", description: "Not an NSWP manifest.", manifest: manifest({ schema: "something/else" }), expect: { valid: false, errors: ["schema_mismatch"], warnings: [] } },
  {
    name: "insecure_entry",
    description: "World entry URLs must be https.",
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "http://museum.example/world" } } } }),
    expect: { valid: false, errors: ["invalid_entry"], warnings: [] },
  },
  {
    name: "bad_multiplayer_endpoint_is_ignored",
    description: "A non-wss multiplayer endpoint is dropped with a warning.",
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "https://museum.example/world" }, multiplayer: { endpoint: "ws://museum.example/session" } } } }),
    expect: { valid: true, errors: [], warnings: ["invalid_field"] },
  },
];
for (const v of manifestVectors) {
  const r = parseManifest(v.manifest, v.byteLength === undefined ? {} : { byteLength: v.byteLength });
  expectEqual(`manifest/${v.name} valid`, r.ok, v.expect.valid);
  expectEqual(`manifest/${v.name} errors`, r.ok ? [] : codes(r.errors), [...v.expect.errors].sort());
  expectEqual(`manifest/${v.name} warnings`, codes(r.warnings), [...v.expect.warnings].sort());
}

const WK = "https://museum.example/.well-known/nswp.json";
const verificationVectors = [
  { name: "verified", description: "All four rules hold.", event: goodWorld, manifest: manifest(), manifestUrl: WK, expect: { verified: true, failed: [] as string[] } },
  { name: "publisher_not_listed", description: "Signed by a key the origin doesn't list.", event: sign(buildWorldEvent(baseWorld), KEY2), manifest: manifest(), manifestUrl: WK, expect: { verified: false, failed: ["publisher_listed", "world_listed"] } },
  { name: "world_not_listed", description: "The publisher is listed but not for this world ID.", event: goodWorld, manifest: manifest({ publishers: { [PK1]: { worlds: ["another-world"] } } }), manifestUrl: WK, expect: { verified: false, failed: ["world_listed"] } },
  { name: "wrong_origin", description: "Manifest fetched from a different origin than the entry URL.", event: goodWorld, manifest: manifest(), manifestUrl: "https://evil.example/.well-known/nswp.json", expect: { verified: false, failed: ["same_origin"] } },
  { name: "not_well_known_path", description: "Only the well-known path counts.", event: goodWorld, manifest: manifest(), manifestUrl: "https://museum.example/nswp.json", expect: { verified: false, failed: ["same_origin"] } },
  {
    name: "entry_url_mismatch",
    description: "The announcement points somewhere the manifest doesn't.",
    event: goodWorld,
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "https://museum.example/other" } } } }),
    manifestUrl: WK,
    expect: { verified: false, failed: ["entry_url_matches"] },
  },
];
for (const v of verificationVectors) {
  const w = parseWorldEvent(v.event);
  const m = parseManifest(v.manifest);
  if (!w.ok || !m.ok) {
    failures.push(`verification/${v.name}: fixture invalid`);
    continue;
  }
  const res = verifyOrigin(w.value, m.value, v.manifestUrl);
  expectEqual(`verification/${v.name} verified`, res.verified, v.expect.verified);
  expectEqual(`verification/${v.name} failed`, res.checks.filter((c) => !c.ok).map((c) => c.name).sort(), [...v.expect.failed].sort());
}

// --------------------------------------------------------------- destinations
const destinationVectors = [
  { input: "https://museum.example.com/world", expect: { ok: true, registrableDomain: "example.com", hostPrefix: "museum.", warnings: [] as string[] } },
  { input: "https://museum.example/world", expect: { ok: true, registrableDomain: "museum.example", hostPrefix: "", warnings: ["unknown_suffix"] } },
  { input: "https://wing.museum.example.co.uk/world", expect: { ok: true, registrableDomain: "example.co.uk", hostPrefix: "wing.museum.", warnings: [] } },
  { input: "https://nswp-world-a.vercel.app/", expect: { ok: true, registrableDomain: "nswp-world-a.vercel.app", hostPrefix: "", warnings: [] } },
  { input: "https://someone.github.io/world/", expect: { ok: true, registrableDomain: "someone.github.io", hostPrefix: "", warnings: [] } },
  { input: "https://xn--pple-43d.com/", expect: { ok: true, registrableDomain: "xn--pple-43d.com", hostPrefix: "", warnings: ["punycode_hostname"] } },
  { input: "https://203.0.113.9/", expect: { ok: true, registrableDomain: null, hostPrefix: "", warnings: ["ip_address_host"] } },
  { input: "https://museum.example.com:8443/", expect: { ok: true, registrableDomain: "example.com", hostPrefix: "museum.", warnings: ["non_default_port"] } },
  { input: "http://museum.example/", expect: { ok: false, error: "url_not_https" } },
  { input: "javascript:alert(document.cookie)", expect: { ok: false, error: "url_not_https" } },
  { input: "data:text/html,<script>alert(1)</script>", expect: { ok: false, error: "url_not_https" } },
  { input: "file:///etc/passwd", expect: { ok: false, error: "url_not_https" } },
  { input: "https://user:hunter2@museum.example/", expect: { ok: false, error: "url_has_credentials" } },
  { input: "not a url", expect: { ok: false, error: "url_invalid" } },
  { input: "", expect: { ok: false, error: "destination_missing" } },
];
for (const v of destinationVectors) {
  const r = checkDestination(v.input);
  if (v.expect.ok) {
    expectEqual(`destination/${v.input} ok`, r.ok, true);
    if (r.ok) {
      expectEqual(`destination/${v.input} domain`, r.value.registrableDomain, v.expect.registrableDomain);
      expectEqual(`destination/${v.input} prefix`, r.value.hostPrefix, v.expect.hostPrefix);
      expectEqual(`destination/${v.input} warnings`, codes(r.warnings), [...(v.expect.warnings ?? [])].sort());
    }
  } else expectEqual(`destination/${v.input} error`, r.ok ? null : r.error.code, v.expect.error);
}

// ------------------------------------------------------- arrivals + assertions
const ORIGIN = "https://museum.example";
const assertion = (over: { url?: string; createdAt?: number; nonce?: string; ttlSec?: number } = {}) =>
  sign(buildEntryAssertion({ url: over.url ?? `${ORIGIN}/world`, createdAt: over.createdAt ?? T0, nonce: over.nonce ?? "AAECAwQFBgcICQoLDA0ODw", ttlSec: over.ttlSec ?? 60 }));
const goodAssertion = assertion();
const assertionVectors = [
  { name: "valid", description: "Fresh and bound to this origin.", event: goodAssertion, origin: ORIGIN, now: T0 + 5, seen: [] as string[], expect: { valid: true, errors: [] as string[] } },
  { name: "other_origin", description: "Made for a different site.", event: assertion({ url: "https://evil.example/world" }), origin: ORIGIN, now: T0 + 5, seen: [], expect: { valid: false, errors: ["origin_mismatch", "origin_mismatch"] } },
  { name: "expired", description: "Past its expiration.", event: goodAssertion, origin: ORIGIN, now: T0 + 61, seen: [], expect: { valid: false, errors: ["assertion_expired", "assertion_expired"] } },
  { name: "future_dated", description: "created_at more than 10 s ahead.", event: assertion({ createdAt: T0 + 30 }), origin: ORIGIN, now: T0, seen: [], expect: { valid: false, errors: ["created_in_future"] } },
  { name: "replayed", description: "Event ID already used.", event: goodAssertion, origin: ORIGIN, now: T0 + 5, seen: [goodAssertion.id], expect: { valid: false, errors: ["assertion_replayed"] } },
  { name: "short_nonce", description: "Nonce under 16 characters.", event: assertion({ nonce: "abc" }), origin: ORIGIN, now: T0 + 5, seen: [], expect: { valid: false, errors: ["nonce_too_short"] } },
  { name: "tampered", description: "Tag added after signing.", event: { ...goodAssertion, tags: [...goodAssertion.tags, ["nswp:mutes", "shared"]] }, origin: ORIGIN, now: T0 + 5, seen: [], expect: { valid: false, errors: ["bad_signature"] } },
];
for (const v of assertionVectors) {
  const r = verifyEntryAssertion(v.event, { origin: v.origin, now: v.now, seen: new Set(v.seen) });
  expectEqual(`assertion/${v.name} valid`, r.ok, v.expect.valid);
  expectEqual(`assertion/${v.name} errors`, r.ok ? [] : codes(r.errors), [...v.expect.errors].sort());
}

const arrivalPass = sign(buildRoomPass({ session: PK3, origin: "https://museum.example", name: "Alice", createdAt: T0 }));
const arrivalVectors = [
  { name: "entry_and_return_airlock", value: encodeArrival({ entry: "main-entrance", airlock: "https://airlock.example/go" }), expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", airlock: "https://airlock.example/go" }, warnings: [] as string[] } },
  { name: "with_assertion", value: encodeArrival({ entry: "main-entrance", assertion: goodAssertion }), expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", assertion: goodAssertion }, warnings: [] } },
  {
    name: "hostile_fields_dropped",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", airlock: "javascript:alert(1)", entry: "../../admin" })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3" }, warnings: ["invalid_entry_point", "url_not_https"] },
  },
  {
    name: "with_look",
    value: encodeArrival({ entry: "main-entrance", look: '{"s":"guest-7f3a91c2","head":"tall","light":"#47f561"}' }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", look: '{"s":"guest-7f3a91c2","head":"tall","light":"#47f561"}' }, warnings: [] },
  },
  {
    name: "unreadable_look_dropped",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", look: '{"head":"tall"}' })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_look"] },
  },
  {
    name: "with_pass",
    value: encodeArrival({ entry: "main-entrance", pass: arrivalPass, sessionKey: bytesToHex(KEY3) }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", pass: arrivalPass, sessionKey: bytesToHex(KEY3) }, warnings: [] },
  },
  {
    name: "pass_without_its_key_dropped",
    value: encodeArrival({ entry: "main-entrance", pass: arrivalPass }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_pass"] },
  },
  {
    name: "pass_with_another_key_dropped",
    value: encodeArrival({ entry: "main-entrance", pass: arrivalPass, sessionKey: bytesToHex(KEY2) }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_pass"] },
  },
  {
    name: "came_from_a_headset",
    value: encodeArrival({ entry: "main-entrance", immersive: true }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", immersive: true }, warnings: [] },
  },
  {
    name: "immersive_must_be_a_boolean",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", immersive: "yes" })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_immersive"] },
  },
  { name: "not_base64_json", value: "this-is-not-json", expect: { valid: false, decoded: null, warnings: [] } },
];
for (const v of arrivalVectors) {
  const r = decodeArrival(v.value);
  expectEqual(`arrival/${v.name} valid`, r.ok, v.expect.valid);
  if (r.ok) expectEqual(`arrival/${v.name} decoded`, r.value, v.expect.decoded);
  expectEqual(`arrival/${v.name} warnings`, codes(r.warnings), [...v.expect.warnings].sort());
}

// ---------------------------------------------------------- portals and naddr
const museumNaddr = encodeNaddr({ kind: WORLD_KIND, pubkey: PK1, identifier: "example-museum", relays: ["wss://relay.example"] });
const naddrVectors = [
  { pointer: { kind: WORLD_KIND, pubkey: PK1, identifier: "example-museum", relays: ["wss://relay.example"] }, naddr: museumNaddr },
  { pointer: { kind: WORLD_KIND, pubkey: PK2, identifier: "tiny" }, naddr: encodeNaddr({ kind: WORLD_KIND, pubkey: PK2, identifier: "tiny" }) },
];
for (const v of naddrVectors) expectEqual(`naddr/${v.naddr}`, decodeNaddr(v.naddr), v.pointer);

const portalVectors = [
  { name: "naddr_and_url", portal: { schema: "nswp/portal/0.3", label: "Enter the museum", destination: { naddr: museumNaddr, url: "https://museum.example/world", entry_point: "main-entrance" } }, expect: { valid: true, errors: [] as string[] } },
  { name: "url_only", portal: { schema: "nswp/portal/0.3", label: "Somewhere", destination: { url: "https://unlisted.example/" } }, expect: { valid: true, errors: [] } },
  { name: "javascript_url", portal: { schema: "nswp/portal/0.3", label: "Free prize", destination: { url: "javascript:alert(1)" } }, expect: { valid: false, errors: ["url_not_https"] } },
  { name: "no_destination", portal: { schema: "nswp/portal/0.3", label: "Nowhere", destination: {} }, expect: { valid: false, errors: ["missing_field"] } },
];
for (const v of portalVectors) {
  const r = parsePortal(v.portal);
  expectEqual(`portal/${v.name} valid`, r.ok, v.expect.valid);
  expectEqual(`portal/${v.name} errors`, r.ok ? [] : codes(r.errors), [...v.expect.errors].sort());
}

// ----------------------------------------------------------------------- looks
const lookSeeds = [PK1, "0000000000000000000000000000000000000000000000000000000000000000", "guest-7f3a91c2", "g0123456789abcdef01234567", "Alice", "alice"];
const generatedVectors = lookSeeds.map((seed) => ({ seed, look: generatedLook(seed), grid: markGrid(generatedLook(seed).mark).map((row) => row.map((on) => (on ? "#" : ".")).join("")) }));
// The same seed in another case is the same person.
expectEqual("look/case", generatedLook("Alice"), generatedLook("alice"));
const inlineVectors = [
  { name: "seed_only", text: '{"s":"guest-7f3a91c2"}', expect: { valid: true, look: generatedLook("guest-7f3a91c2"), warnings: [] as string[] } },
  { name: "with_choices", text: '{"s":"guest-7f3a91c2","head":"tall","light":"#47F561"}', expect: { valid: true, look: { ...generatedLook("guest-7f3a91c2"), head: "tall", light: "#47f561" }, warnings: [] } },
  { name: "unknown_values_keep_the_generated_part", text: '{"s":"guest-7f3a91c2","head":"dragon","color":"red","tail":"long"}', expect: { valid: true, look: generatedLook("guest-7f3a91c2"), warnings: ["unknown_value", "unknown_value"] } },
  { name: "a_mark_is_never_a_choice", text: '{"s":"guest-7f3a91c2","mark":"7fff"}', expect: { valid: true, look: generatedLook("guest-7f3a91c2"), warnings: [] } },
  { name: "no_seed", text: '{"head":"tall"}', expect: { valid: false, look: null, warnings: [] } },
  { name: "seed_too_short", text: '{"s":"abc"}', expect: { valid: false, look: null, warnings: [] } },
  { name: "not_an_object", text: "[]", expect: { valid: false, look: null, warnings: [] } },
  { name: "too_long", text: `{"s":"guest-7f3a91c2","x":"${"y".repeat(600)}"}`, expect: { valid: false, look: null, warnings: [] } },
];
for (const v of inlineVectors) {
  const r = decodeLook(v.text);
  expectEqual(`look/${v.name} valid`, r.ok, v.expect.valid);
  if (r.ok) {
    expectEqual(`look/${v.name} look`, r.value.look, v.expect.look);
    expectEqual(`look/${v.name} warnings`, codes(r.warnings), [...v.expect.warnings].sort());
  }
}
// An avatar event is read against its author's key: copied tags come out with the copier's mark.
const avatarTags = buildAvatarEvent({ look: { ...generatedLook(PK1), head: "wedge", accessory: "halo" }, createdAt: T0 }).tags;
const avatarVectors = ["0000000000000000000000000000000000000000000000000000000000000001", PK1].map((pubkey) => {
  const r = parseAvatarEvent({ kind: 37301, tags: avatarTags, pubkey });
  if (!r.ok) throw new Error("avatar vector failed to parse");
  return { pubkey, event: { kind: 37301, created_at: T0, tags: avatarTags, content: "" }, expect: { look: r.value.look } };
});
expectEqual("avatar/copied keeps the copier's mark", avatarVectors[0]!.expect.look.mark, markFor(avatarVectors[0]!.pubkey));
expectEqual("avatar/chosen parts survive", [avatarVectors[0]!.expect.look.head, avatarVectors[0]!.expect.look.accessory], ["wedge", "halo"]);

// ----------------------------------------------------------------------- lists
const W1 = `37300:${PK1}:example-museum`;
const W2 = `37300:${PK2}:grove`;
const baseList = { d: "quiet-places", title: "Quiet places", description: "Worlds worth sitting down in.", worlds: [W1, W2], createdAt: T0 };
const listWith = (f: (tags: string[][]) => string[][]): EventTemplate => {
  const t = buildListEvent(baseList);
  return { ...t, tags: f(t.tags) };
};
type ListVector = { name: string; description: string; event: unknown; expect: { valid: boolean; signatureValid: boolean | null; errors: string[]; warnings: string[]; title?: string; worlds?: string[] | { count: number; last: string } } };
const manyWorlds = Array.from({ length: 201 }, (_, i) => `37300:${PK1}:w${i}`);
const listVectors: ListVector[] = [
  { name: "valid", description: "A signed list of two worlds.", event: sign(buildListEvent(baseList)), expect: { valid: true, signatureValid: true, errors: [], warnings: [], title: "Quiet places", worlds: [W1, W2] } },
  { name: "empty", description: "A list with no worlds is a list. It shows nothing.", event: buildListEvent({ ...baseList, worlds: [] }), expect: { valid: true, signatureValid: null, errors: [], warnings: [], title: "Quiet places", worlds: [] } },
  { name: "no_title_uses_d", description: "Without a title, the list goes by its d.", event: listWith((t) => t.filter((x) => x[0] !== "title")), expect: { valid: true, signatureValid: null, errors: [], warnings: [], title: "quiet-places", worlds: [W1, W2] } },
  {
    name: "other_things_are_passed_over",
    description: "A curation set can hold articles, notes and anything else. A reader keeps the worlds, in order, and says nothing about the rest.",
    event: listWith((t) => [...t, ["a", `30023:${PK1}:an-article`], ["e", "0".repeat(64)], ["a", "not a coordinate"], ["a", `37300:${PK1}:`], ["a", `37300:${PK2}:arcade`, "wss://relay.example"]]),
    expect: { valid: true, signatureValid: null, errors: [], warnings: [], title: "Quiet places", worlds: [W1, W2, `37300:${PK2}:arcade`] },
  },
  { name: "a_world_counts_once", description: "A world named twice keeps its first place.", event: listWith((t) => [...t, ["a", W1]]), expect: { valid: true, signatureValid: null, errors: [], warnings: [], title: "Quiet places", worlds: [W1, W2] } },
  {
    name: "too_many_worlds",
    description: "A reader stops at 200 worlds and says so.",
    event: buildListEvent({ ...baseList, worlds: manyWorlds }),
    expect: { valid: true, signatureValid: null, errors: [], warnings: ["too_many_worlds"], title: "Quiet places", worlds: { count: 200, last: manyWorlds[199]! } },
  },
  { name: "long_title_is_cut", description: "A title past 200 characters is cut, not refused.", event: listWith((t) => t.map((x) => (x[0] === "title" ? ["title", "T".repeat(260)] : x))), expect: { valid: true, signatureValid: null, errors: [], warnings: ["value_too_long"], title: "T".repeat(200), worlds: [W1, W2] } },
  { name: "missing_d", description: "No d: the list has no name to follow it by.", event: listWith((t) => t.filter((x) => x[0] !== "d")), expect: { valid: false, signatureValid: null, errors: ["missing_tag"], warnings: [] } },
  { name: "wrong_kind", description: "A follow set (kind 30000) is not a list of worlds.", event: { ...buildListEvent(baseList), kind: 30000 }, expect: { valid: false, signatureValid: null, errors: ["wrong_kind"], warnings: [] } },
];
for (const v of listVectors) {
  const r = parseListEvent(v.event);
  expectEqual(`list/${v.name} valid`, r.ok, v.expect.valid);
  expectEqual(`list/${v.name} errors`, r.ok ? [] : codes(r.errors), [...v.expect.errors].sort());
  expectEqual(`list/${v.name} warnings`, codes(r.warnings), [...v.expect.warnings].sort());
  expectEqual(`list/${v.name} signature`, (v.event as { sig?: string }).sig ? verifyEvent(v.event) : null, v.expect.signatureValid);
  if (r.ok) {
    expectEqual(`list/${v.name} title`, r.value.title, v.expect.title);
    const w = v.expect.worlds;
    if (Array.isArray(w)) expectEqual(`list/${v.name} worlds`, r.value.worlds, w);
    else expectEqual(`list/${v.name} worlds`, { count: r.value.worlds.length, last: r.value.worlds.at(-1) }, w);
  }
}
expectEqual("list/kind", buildListEvent(baseList).kind, CURATION_SET_KIND);
expectEqual("list/coordinate", parseListEvent(sign(buildListEvent(baseList))).ok && (parseListEvent(sign(buildListEvent(baseList))) as { value: { coordinate?: string } }).value.coordinate, `30004:${PK1}:quiet-places`);

// ---------------------------------------------------------------------- passes
const MUSEUM = "https://museum.example";
const goodPass = sign(buildRoomPass({ session: PK3, origin: `${MUSEUM}/world`, name: "Alice", createdAt: T0 }));
const rawPass = (tags: string[][], kind = 27300): NostrEvent => sign({ kind, created_at: T0, tags, content: "" });
const passTags = (over: Record<string, string | null> = {}): string[][] =>
  Object.entries({ "nswp:session": PK3, "nswp:origin": MUSEUM, expiration: String(T0 + 4 * 3600), ...over }).flatMap(([k, v]) => (v === null ? [] : [[k, v]]));
type PassVector = { name: string; description: string; event: unknown; origin: string; now: number; session?: string; expect: { valid: boolean; errors: string[]; warnings: string[]; pubkey?: string; name?: string } };
const passVectors: PassVector[] = [
  { name: "valid", description: "Key 1 says the session key speaks for it at the museum, for four hours.", event: goodPass, origin: MUSEUM, now: T0 + 60, session: PK3, expect: { valid: true, errors: [], warnings: [], pubkey: PK1, name: "Alice" } },
  { name: "valid_without_a_name", description: "A name is optional. Without one a reader shows the key.", event: sign(buildRoomPass({ session: PK3, origin: MUSEUM, createdAt: T0 })), origin: MUSEUM, now: T0 + 60, session: PK3, expect: { valid: true, errors: [], warnings: [], pubkey: PK1, name: "" } },
  {
    name: "name_is_tidied",
    description: "A name with line breaks, a hidden separator and more than 48 characters is tidied, not refused.",
    event: rawPass([...passTags(), ["name", `  Ali\u2028ce\n\n  Smith ${"x".repeat(60)}`]]),
    origin: MUSEUM,
    now: T0 + 60,
    session: PK3,
    expect: { valid: true, errors: [], warnings: ["name_cleaned"], pubkey: PK1, name: `Ali ce Smith ${"x".repeat(35)}` },
  },
  { name: "another_site", description: "A pass made for the museum is worth nothing anywhere else.", event: goodPass, origin: "https://other.example", now: T0 + 60, session: PK3, expect: { valid: false, errors: ["origin_mismatch"], warnings: [] } },
  { name: "another_session_key", description: "A member showing someone else's pass: it names a session key they aren't using.", event: goodPass, origin: MUSEUM, now: T0 + 60, session: PK2, expect: { valid: false, errors: ["session_mismatch"], warnings: [] } },
  { name: "expired", description: "Five hours on.", event: goodPass, origin: MUSEUM, now: T0 + 5 * 3600, session: PK3, expect: { valid: false, errors: ["pass_expired"], warnings: [] } },
  { name: "lives_too_long", description: "Thirteen hours is more than a pass may claim.", event: rawPass(passTags({ expiration: String(T0 + 13 * 3600) })), origin: MUSEUM, now: T0 + 60, session: PK3, expect: { valid: false, errors: ["ttl_too_long"], warnings: [] } },
  { name: "dated_in_the_future", description: "Read ten minutes before it says it was signed.", event: goodPass, origin: MUSEUM, now: T0 - 600, session: PK3, expect: { valid: false, errors: ["created_in_future"], warnings: [] } },
  { name: "changed_after_signing", description: "The name was edited, so the signature no longer holds.", event: { ...goodPass, tags: goodPass.tags.map((t) => (t[0] === "name" ? ["name", "Mallory"] : t)) }, origin: MUSEUM, now: T0 + 60, session: PK3, expect: { valid: false, errors: ["bad_signature"], warnings: [] } },
  { name: "wrong_kind", description: "An entry assertion's kind is not a pass.", event: rawPass(passTags(), 27235), origin: MUSEUM, now: T0 + 60, session: PK3, expect: { valid: false, errors: ["wrong_kind"], warnings: [] } },
  { name: "names_itself", description: "The session key must be a throwaway, never the identity key.", event: rawPass(passTags({ "nswp:session": PK1 })), origin: MUSEUM, now: T0 + 60, expect: { valid: false, errors: ["invalid_session"], warnings: [] } },
  { name: "no_session_key", description: "A pass that speaks for no key.", event: rawPass(passTags({ "nswp:session": null })), origin: MUSEUM, now: T0 + 60, expect: { valid: false, errors: ["missing_tag"], warnings: [] } },
];
for (const v of passVectors) {
  const r = verifyRoomPass(v.event, { origin: v.origin, now: v.now, ...(v.session ? { session: v.session } : {}) });
  expectEqual(`pass/${v.name} valid`, r.ok, v.expect.valid);
  expectEqual(`pass/${v.name} errors`, r.ok ? [] : codes(r.errors), [...v.expect.errors].sort());
  expectEqual(`pass/${v.name} warnings`, codes(r.warnings), [...v.expect.warnings].sort());
  if (r.ok) expectEqual(`pass/${v.name} who`, [r.value.pubkey, r.value.name], [v.expect.pubkey, v.expect.name]);
}

// --------------------------------------------------------------------- output
if (failures.length) {
  console.error(`@nswp/core disagrees with ${failures.length} vector expectation(s):\n\n${failures.join("\n\n")}`);
  process.exit(1);
}

const files: Record<string, unknown> = {
  "world-events.json": { description: "Spatial world announcements (spec §5). `errors` and `warnings` are sorted issue codes; `signatureValid` is null when the vector is unsigned.", testKeys, vectors: worldVectors },
  "manifests.json": { description: "Manifests (spec §7.2) and origin verification (spec §7.3). `failed` lists the verification checks that must fail.", testKeys, manifests: manifestVectors, verification: verificationVectors },
  "destinations.json": { description: "Airlock destination checks (spec §6.2). Registrable domains use the Public Suffix List including its private section.", vectors: destinationVectors },
  "assertions.json": { description: "Entry assertions (spec §4.4). Verify with the given `origin`, `now` and already-`seen` event IDs.", testKeys, vectors: assertionVectors },
  "arrivals.json": { description: "Arrival context: the value of #nswp= (spec §4.4). Hostile fields are dropped with warnings, not fatal.", vectors: arrivalVectors },
  "looks.json": {
    description:
      "Looks (protocol/05-looks.md). `generated`: the look and mark every implementation must work out from a seed; `grid` is the mark as five rows, # lit. `inline`: the short form that travels, with what a reader must make of it. `avatarEvents`: the same tags read under two keys.",
    generated: generatedVectors,
    inline: inlineVectors,
    avatarEvents: avatarVectors,
  },
  "passes.json": {
    description:
      "Passes (protocol/10-identity.md). Verify each `event` as a world at `origin`, at time `now`, for a member using the session key `session` when one is given. `errors` and `warnings` are sorted issue codes. On success, `pubkey` is the identity and `name` what a reader may show.",
    testKeys,
    vectors: passVectors,
  },
  "lists.json": {
    description:
      "Lists of worlds (protocol/08-lists.md): NIP-51 curation sets. `worlds` is what a reader must take from the list, in order; where it is an object, the count and the last world kept. `errors` and `warnings` are sorted issue codes; `signatureValid` is null when the vector is unsigned.",
    testKeys,
    vectors: listVectors,
  },
  "portals.json": { description: "Portals (spec §6.1) and NIP-19 naddr round-trips.", portals: portalVectors, naddr: naddrVectors },
};

mkdirSync(outDir, { recursive: true });
let stale = 0;
for (const [name, body] of Object.entries(files)) {
  const path = join(outDir, name);
  // Invisible characters are written as escapes, so nothing in a vector file is hidden from a reader.
  const text = `${JSON.stringify(body, null, 2)}\n`.replace(/[\u2000-\u206f\ufeff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
  if (check) {
    let current = "";
    try {
      current = readFileSync(path, "utf8");
    } catch {
      /* missing counts as stale */
    }
    if (current !== text) {
      console.error(`stale: vectors/${name}`);
      stale++;
    }
  } else writeFileSync(path, text);
}
if (stale) {
  console.error("Run `npm run vectors` and commit the result.");
  process.exit(1);
}
console.log(check ? "vectors up to date; core agrees with every expectation" : `wrote ${Object.keys(files).length} files to vectors/`);
