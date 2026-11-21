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
import { readShares, splitPrice, type Share } from "../packages/core/src/shares.js";
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
  audienceOf,
  buildBridgeGrant,
  buildWorldGrant,
  verifyWorldGrant,
  verifyBridgeGrant,
  grantCode,
  bridgeTopic,
  CURATION_SET_KIND,
  WORLD_KIND,
  BAG_KIND,
  bagIn,
  buildHit,
  buildShot,
  cleanAsk,
  parseDid,
  parseHit,
  parseShot,
  parseState,
  PLAY_LIMITS,
  shotAt,
  struck,
  changeBag,
  buildItem,
  parseItem,
  achievementForWorld,
  achievementsIn,
  parseAchievement,
  buildRating,
  parseRating,
  parseScore,
  rankScores,
  scoreForWorld,
  tallyRatings,
  getConversationKey,
  openSave,
  saveAddress,
  sealSave,
  buildMessage,
  changeFollows,
  followForWorld,
  followsIn,
  sealMessage,
  nip44Encrypt,
  openWrap,
  sealTemplate,
  wrapSeal,
  FOLLOWS_KIND,
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

type WorldVector = { name: string; description: string; event: unknown; expect: { valid: boolean; signatureValid: boolean | null; errors: string[]; warnings: string[]; audience?: string; category?: string | null; items?: string | null } };
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
  // Who a world is for. `audience` in `expect` is how a careful reader takes its word: see `audienceOf`.
  { name: "for_kids", description: "Made for children, as its maker says.", event: sign(buildWorldEvent({ ...baseWorld, audience: "kids" })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], audience: "kids" } },
  { name: "not_for_kids", description: "Not made for children, and nothing an adult would need warning about.", event: sign(buildWorldEvent({ ...baseWorld, audience: "general" })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], audience: "general" } },
  { name: "adult", description: "An adult world. It is built with the content warning other clients already read.", event: sign(buildWorldEvent({ ...baseWorld, audience: "adult" })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], audience: "adult" } },
  { name: "adult_without_a_warning", description: "Says adult and carries no content warning: read as adult, with a note to its maker.", event: withTags((t) => [...t, ["audience", "adult"]]), expect: { valid: true, signatureValid: null, errors: [], warnings: ["adult_without_warning"], audience: "adult" } },
  { name: "warned_and_not_rated", description: "A content warning, and nothing about who it is for. A careful reader takes it as adult: a warning is not a promise that it suits everyone.", event: sign(buildWorldEvent({ ...baseWorld, contentWarning: "flashing lights" })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], audience: "adult" } },
  { name: "warned_and_for_everyone", description: "A content warning from a maker who also says who it is for: their word stands, and the warning is shown.", event: sign(buildWorldEvent({ ...baseWorld, contentWarning: "flashing lights", audience: "general" })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], audience: "general" } },
  { name: "not_rated", description: "Says nothing about who it is for.", event: goodWorld, expect: { valid: true, signatureValid: true, errors: [], warnings: [], audience: "unrated" } },
  { name: "an_audience_nobody_knows", description: "An audience that isn't one of the three is treated as not stated.", event: withTags((t) => [...t, ["audience", "teens"]]), expect: { valid: true, signatureValid: null, errors: [], warnings: ["unknown_audience"], audience: "unrated" } },
  { name: "for_kids_with_a_warning", description: "For kids, with a content warning. One of the two is wrong; the maker is told, and their word about the audience stands.", event: withTags((t) => [...t, ["audience", "kids"], ["content-warning", "loud"]]), expect: { valid: true, signatureValid: null, errors: [], warnings: ["kids_with_warning"], audience: "kids" } },
  // What kind of place a world is. `category` in `expect` is what a reader takes from it; null is "didn't say".
  { name: "a_game", description: "Says what kind of place it is, from the closed list.", event: sign(buildWorldEvent({ ...baseWorld, category: "game" })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], category: "game" } },
  { name: "a_category_nobody_knows", description: "A category that isn't on the list is treated as not stated.", event: withTags((t) => [...t, ["category", "casino"]]), expect: { valid: true, signatureValid: null, errors: [], warnings: ["unknown_category"], category: null } },
  // What a world does with the things visitors carry. `items` in `expect` is what a reader takes from it; null is a world that said nothing, where items are allowed.
  { name: "items_are_the_game", description: "Says items are part of play: a door and the Airlock say so before a visitor goes in.", event: sign(buildWorldEvent({ ...baseWorld, items: "play" })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], items: "play" } },
  { name: "items_turned_off", description: "Says it has no items. A world that says nothing has them, so this is how one turns them off.", event: sign(buildWorldEvent({ ...baseWorld, items: "none" })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], items: "none" } },
  { name: "an_items_rule_nobody_knows", description: "A rule for items that isn't on the list is treated as none: never as the ordinary rule, which is allowed.", event: withTags((t) => [...t, ["items", "anything-goes"]]), expect: { valid: true, signatureValid: null, errors: [], warnings: ["unknown_items_rule"], items: "none" } },
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
  if (v.expect.audience !== undefined && r.ok) expectEqual(`world/${v.name} audience`, audienceOf(r.value), v.expect.audience);
  if (v.expect.category !== undefined && r.ok) expectEqual(`world/${v.name} category`, r.value.category ?? null, v.expect.category);
  if (v.expect.items !== undefined && r.ok) expectEqual(`world/${v.name} items`, r.value.items ?? null, v.expect.items);
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
    name: "brought_home",
    value: encodeArrival({ entry: "main-entrance", airlock: "https://portal.bitblocks.network/go/", home: true }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", airlock: "https://portal.bitblocks.network/go/", home: true }, warnings: [] },
  },
  {
    name: "home_must_be_a_boolean",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", home: "mine" })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_home"] },
  },
  {
    name: "moving_the_intense_way",
    value: encodeArrival({ entry: "main-entrance", moving: "intense" }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", moving: "intense" }, warnings: [] },
  },
  {
    name: "with_settings_that_travel",
    value: encodeArrival({ entry: "main-entrance", settings: { sound: { off: false, effects: 0.7, music: 0, voices: 1, hum: true }, text: 1.15, motion: false, wrist: "right", turn: 45, hand: "right", narrow: true, full: true } }),
    expect: {
      valid: true,
      decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", settings: { sound: { off: false, effects: 0.7, music: 0, voices: 1, hum: true }, text: 1.15, motion: false, wrist: "right", turn: 45, hand: "right", narrow: true, full: true } },
      warnings: [],
    },
  },
  {
    name: "settings_keep_what_is_known_and_in_range",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", settings: { sound: { music: 7, effects: -2, voices: "loud", bass: 1 }, text: 9, wrist: "ankle", turn: 60, full: "yes", theme: "dark" } })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", settings: { sound: { effects: 0, music: 1 }, text: 1.5 } }, warnings: [] },
  },
  {
    name: "settings_with_nothing_readable_are_ignored",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", settings: { theme: "dark" } })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_settings"] },
  },
  {
    name: "on_a_touch_screen",
    value: encodeArrival({ entry: "main-entrance", form: "touch" }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", form: "touch" }, warnings: [] },
  },
  {
    name: "at_a_desk_and_moving_the_intense_way",
    value: encodeArrival({ entry: "main-entrance", form: "desk", moving: "intense" }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", moving: "intense", form: "desk" }, warnings: [] },
  },
  {
    name: "a_form_nobody_knows_is_ignored",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", form: "hologram" })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_form"] },
  },
  {
    name: "moving_the_casual_way_is_the_same_as_saying_nothing",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", moving: "casual" })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: [] },
  },
  {
    name: "a_way_of_moving_nobody_knows_is_ignored",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", moving: "flying" })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_moving"] },
  },
  {
    name: "blocked_people_come_along",
    value: encodeArrival({ entry: "main-entrance", blocked: ["abababababababababababababababababababababababababababababababab", "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd"] }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", blocked: ["abababababababababababababababababababababababababababababababab", "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd"] }, warnings: [] },
  },
  {
    name: "a_block_list_with_anything_but_keys_is_ignored_whole",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", blocked: ["abababababababababababababababababababababababababababababababab", "everyone"] })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_blocked"] },
  },
  {
    name: "a_block_list_too_long_is_ignored_whole",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", blocked: Array.from({ length: 65 }, (_, i) => i.toString(16).padStart(64, "0")) })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_blocked"] },
  },
  {
    name: "joined_with_the_microphone_on",
    value: encodeArrival({ entry: "main-entrance", joined: true, mic: true }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", joined: true, mic: true }, warnings: [] },
  },
  {
    name: "joined_alone",
    value: encodeArrival({ entry: "main-entrance", joined: true }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", joined: true }, warnings: [] },
  },
  {
    name: "a_microphone_without_joined_is_ignored",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", mic: true })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_mic"] },
  },
  {
    name: "joined_must_be_a_boolean",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", joined: "yes", mic: true })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance" }, warnings: ["invalid_joined", "invalid_mic"] },
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
type PassVector = { name: string; description: string; event: unknown; origin: string; now: number; session?: string; expect: { valid: boolean; errors: string[]; warnings: string[]; pubkey?: string; name?: string; picture?: string; about?: string } };
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
  {
    name: "with_a_picture",
    description: "A picture is where the visitor's own profile keeps theirs: an https address, signed with everything else.",
    event: sign(buildRoomPass({ session: PK3, origin: MUSEUM, name: "Alice", picture: "https://pictures.example/alice.webp", createdAt: T0 })),
    origin: MUSEUM,
    now: T0 + 60,
    session: PK3,
    expect: { valid: true, errors: [], warnings: [], pubkey: PK1, name: "Alice", picture: "https://pictures.example/alice.webp" },
  },
  {
    name: "a_picture_that_cannot_be_fetched_is_ignored",
    description: "Anything but an https address is no picture at all. The pass still stands.",
    event: rawPass([...passTags(), ["name", "Alice"], ["picture", "javascript:alert(1)"]]),
    origin: MUSEUM,
    now: T0 + 60,
    session: PK3,
    expect: { valid: true, errors: [], warnings: ["picture_ignored"], pubkey: PK1, name: "Alice", picture: "" },
  },
  {
    name: "with_a_few_words_about_them",
    description: "What they wrote about themselves in their profile: their own words, signed with everything else.",
    event: sign(buildRoomPass({ session: PK3, origin: MUSEUM, name: "Alice", about: "Keeper of the east wing. Ask me about the clocks.", createdAt: T0 })),
    origin: MUSEUM,
    now: T0 + 60,
    session: PK3,
    expect: { valid: true, errors: [], warnings: [], pubkey: PK1, name: "Alice", about: "Keeper of the east wing. Ask me about the clocks." },
  },
  {
    name: "what_they_wrote_is_tidied",
    description: "Line breaks, something that would reverse the text, and more than 280 characters: tidied and cut short, not refused.",
    event: rawPass([...passTags(), ["name", "Alice"], ["about", `Hello\n\nthere ${String.fromCodePoint(0x202e)}friend ${"y".repeat(400)}`]]),
    origin: MUSEUM,
    now: T0 + 60,
    session: PK3,
    expect: { valid: true, errors: [], warnings: ["about_cleaned"], pubkey: PK1, name: "Alice", about: `Hello there friend ${"y".repeat(261)}` },
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
  if (r.ok && v.expect.picture !== undefined) expectEqual(`pass/${v.name} picture`, r.value.picture, v.expect.picture);
  if (r.ok && v.expect.about !== undefined) expectEqual(`pass/${v.name} about`, r.value.about, v.expect.about);
}

// ---------------------------------------------------------------------- grants
// Key 1 owns a Bridge whose key is key 2; the session key is the throwaway.
const goodGrant = sign(buildBridgeGrant({ session: PK3, bridge: PK2, createdAt: T0 }));
const rawGrant = (tags: string[][], kind = 27302, key = KEY1): NostrEvent => sign({ kind, created_at: T0, tags, content: "" }, key);
const grantTags = (over: Record<string, string | null> = {}): string[][] =>
  Object.entries({ "nswp:session": PK3, "nswp:bridge": PK2, expiration: String(T0 + 300), ...over }).flatMap(([k, v]) => (v === null ? [] : [[k, v]]));
type GrantVector = { name: string; description: string; event: unknown; owner: string; bridge: string; session: string; now: number; seen?: string[]; expect: { valid: boolean; errors: string[]; code?: string } };
const grantAt = { owner: PK1, bridge: PK2, session: PK3, now: T0 + 30 };
const grantVectors: GrantVector[] = [
  { name: "valid", description: "Key 1 says the session key may open a terminal on its Bridge (key 2), for five minutes.", event: goodGrant, ...grantAt, expect: { valid: true, errors: [], code: grantCode(goodGrant.id) } },
  { name: "not_the_owner", description: "Signed correctly, by somebody who isn't this Bridge's owner. This is the second key that is refused.", event: rawGrant(grantTags({ "nswp:session": PK3 }), 27302, KEY2), ...grantAt, bridge: PK2, expect: { valid: false, errors: ["not_owner"] } },
  { name: "another_bridge", description: "A grant for a different computer.", event: rawGrant(grantTags({ "nswp:bridge": PK1.replace(/^../, "ff") })), ...grantAt, expect: { valid: false, errors: ["bridge_mismatch"] } },
  { name: "another_session_key", description: "Sent by a key the grant doesn't name: someone replaying a grant they overheard.", event: goodGrant, ...grantAt, session: PK1.replace(/^../, "ee"), expect: { valid: false, errors: ["session_mismatch"] } },
  { name: "expired", description: "Six minutes on.", event: goodGrant, ...grantAt, now: T0 + 360, expect: { valid: false, errors: ["grant_expired"] } },
  { name: "lives_too_long", description: "An hour is more than a grant may claim.", event: rawGrant(grantTags({ expiration: String(T0 + 3600) })), ...grantAt, expect: { valid: false, errors: ["ttl_too_long"] } },
  { name: "dated_in_the_future", description: "Read ten minutes before it says it was signed.", event: goodGrant, ...grantAt, now: T0 - 600, expect: { valid: false, errors: ["created_in_future"] } },
  { name: "used_before", description: "The same grant, a second time.", event: goodGrant, ...grantAt, seen: [goodGrant.id], expect: { valid: false, errors: ["grant_reused"] } },
  { name: "changed_after_signing", description: "The Bridge's key was swapped, so the signature no longer holds.", event: { ...goodGrant, tags: goodGrant.tags.map((t) => (t[0] === "nswp:bridge" ? ["nswp:bridge", PK1] : t)) }, ...grantAt, expect: { valid: false, errors: ["bad_signature"] } },
  { name: "a_pass_is_not_a_grant", description: "The pass a world is handed, signed by the owner for this very session key. It opens nothing.", event: sign(buildRoomPass({ session: PK3, origin: "https://museum.example", createdAt: T0, ttlSec: 300 })), ...grantAt, expect: { valid: false, errors: ["missing_tag", "names_a_site", "wrong_kind"] } },
  { name: "names_a_site", description: "A grant's kind and tags with a site added: something made to pass as both.", event: rawGrant([...grantTags(), ["nswp:origin", "https://museum.example"]]), ...grantAt, expect: { valid: false, errors: ["names_a_site"] } },
  { name: "names_the_owner", description: "The session key must be a throwaway, never the owner's key.", event: rawGrant(grantTags({ "nswp:session": PK1 })), ...grantAt, session: PK1, expect: { valid: false, errors: ["invalid_session"] } },
  { name: "no_bridge", description: "A grant that names no computer.", event: rawGrant(grantTags({ "nswp:bridge": null })), ...grantAt, expect: { valid: false, errors: ["missing_tag"] } },
];
for (const v of grantVectors) {
  const r = verifyBridgeGrant(v.event, { owner: v.owner, bridge: v.bridge, session: v.session, now: v.now, ...(v.seen ? { seen: new Set(v.seen) } : {}) });
  expectEqual(`grant/${v.name} valid`, r.ok, v.expect.valid);
  expectEqual(`grant/${v.name} errors`, r.ok ? [] : codes(r.errors), [...v.expect.errors].sort());
}
// And the other way: a grant is worth nothing to a world.
expectEqual("grant/as a pass", verifyRoomPass(goodGrant, { origin: "https://museum.example", session: PK3, now: T0 + 30 }).ok, false);
const grantTopic = { bridge: PK2, topic: bridgeTopic(PK2) };

// A world of the owner's own: key 1 is building the world at WORLD, and told its Bridge (key 2) so.
const WORLD = "https://my-world.example";
const DEV = "http://127.0.0.1:5173";
const goodWorldGrant = sign(buildWorldGrant({ session: PK3, bridge: PK2, world: `${WORLD}/rooms/one?x=1`, createdAt: T0 }));
const rawWorldGrant = (tags: string[][], kind = 27303, key = KEY1): NostrEvent => sign({ kind, created_at: T0, tags, content: "" }, key);
const worldTags = (over: Record<string, string | null> = {}): string[][] =>
  Object.entries({ "nswp:session": PK3, "nswp:bridge": PK2, "nswp:world": WORLD, expiration: String(T0 + 8 * 3600), ...over }).flatMap(([k, v]) => (v === null ? [] : [[k, v]]));
type WorldGrantVector = { name: string; description: string; event: unknown; owner: string; bridge: string; session: string; worlds: string[]; now: number; expect: { valid: boolean; errors: string[]; world?: string } };
const worldAt = { owner: PK1, bridge: PK2, session: PK3, worlds: [WORLD, DEV], now: T0 + 30 };
const worldGrantVectors: WorldGrantVector[] = [
  { name: "valid", description: "Key 1 says the session key may open terminals on its Bridge from the world it is building, for eight hours. The world is named by its origin, whatever page was given.", event: goodWorldGrant, ...worldAt, expect: { valid: true, errors: [], world: WORLD } },
  { name: "valid_again", description: "The same grant, an hour on: it is good until it expires, so a refresh doesn't end the work.", event: goodWorldGrant, ...worldAt, now: T0 + 3600, expect: { valid: true, errors: [], world: WORLD } },
  { name: "valid_on_this_computer", description: "A world still being built, served from the owner's own machine.", event: sign(buildWorldGrant({ session: PK3, bridge: PK2, world: DEV, createdAt: T0 })), ...worldAt, expect: { valid: true, errors: [], world: DEV } },
  { name: "a_world_it_was_not_told_about", description: "Signed by the owner, for a world this Bridge was never started with. The owner's signature is not enough: the computer has to have been told too.", event: goodWorldGrant, ...worldAt, worlds: [DEV], expect: { valid: false, errors: ["world_not_allowed"] } },
  { name: "told_about_no_worlds", description: "A Bridge started without any world honours none.", event: goodWorldGrant, ...worldAt, worlds: [], expect: { valid: false, errors: ["world_not_allowed"] } },
  { name: "not_the_owner", description: "Somebody else's key, for a world the Bridge does know.", event: rawWorldGrant(worldTags(), 27303, KEY2), ...worldAt, expect: { valid: false, errors: ["not_owner"] } },
  { name: "another_session_key", description: "Sent by a key the grant doesn't name.", event: goodWorldGrant, ...worldAt, session: PK1.replace(/^../, "ee"), expect: { valid: false, errors: ["session_mismatch"] } },
  { name: "expired", description: "Nine hours on.", event: goodWorldGrant, ...worldAt, now: T0 + 9 * 3600, expect: { valid: false, errors: ["grant_expired"] } },
  { name: "lives_too_long", description: "A day is more than a world grant may claim.", event: rawWorldGrant(worldTags({ expiration: String(T0 + 24 * 3600) })), ...worldAt, expect: { valid: false, errors: ["ttl_too_long"] } },
  { name: "not_an_origin", description: "The world is named by its origin and nothing more.", event: rawWorldGrant(worldTags({ "nswp:world": `${WORLD}/rooms` })), ...worldAt, expect: { valid: false, errors: ["invalid_world"] } },
  { name: "a_plain_site", description: "An unencrypted site that isn't this computer can't be a world to bring a terminal to.", event: rawWorldGrant(worldTags({ "nswp:world": "http://my-world.example" })), ...worldAt, worlds: ["http://my-world.example"], expect: { valid: false, errors: ["invalid_world"] } },
  { name: "a_home_grant_is_not_a_world_grant", description: "The five-minute grant a home uses, sent as if it were one of these.", event: goodGrant, ...worldAt, expect: { valid: false, errors: ["missing_tag", "wrong_kind"] } },
  { name: "a_pass_is_not_a_world_grant", description: "The pass a world is handed when its visitor goes by name.", event: sign(buildRoomPass({ session: PK3, origin: WORLD, createdAt: T0 })), ...worldAt, expect: { valid: false, errors: ["missing_tag", "missing_tag", "names_a_site", "wrong_kind"] } },
];
for (const v of worldGrantVectors) {
  const r = verifyWorldGrant(v.event, { owner: v.owner, bridge: v.bridge, session: v.session, worlds: v.worlds, now: v.now });
  expectEqual(`world-grant/${v.name} valid`, r.ok, v.expect.valid);
  expectEqual(`world-grant/${v.name} errors`, r.ok ? [] : codes(r.errors), [...v.expect.errors].sort());
  if (r.ok) expectEqual(`world-grant/${v.name} world`, r.value.world, v.expect.world);
}
// And each way round: a world grant opens nothing as a home's grant, and is worth nothing as a pass.
expectEqual("world-grant/as a home grant", verifyBridgeGrant(goodWorldGrant, { owner: PK1, bridge: PK2, session: PK3, now: T0 + 30 }).ok, false);
expectEqual("world-grant/as a pass", verifyRoomPass(goodWorldGrant, { origin: WORLD, session: PK3, now: T0 + 30 }).ok, false);

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
  "grants.json": {
    description:
      "Bridge grants (browser/bridge.md; not part of the protocol a world implements). Verify each `event` as the Bridge with key `bridge`, owned by `owner`, sent by `session`, at time `now`, having already used the grants in `seen`. `errors` are sorted issue codes. `code` is the four digits both ends show. `topic` is where that Bridge listens.",
    testKeys,
    topic: grantTopic,
    vectors: grantVectors,
    worlds: {
      description: "World grants (kind 27303): for a world the owner is building. Verify each as the Bridge with key `bridge`, owned by `owner`, sent by `session`, started knowing the worlds in `worlds`. Unlike the grants above, one is good until it expires.",
      vectors: worldGrantVectors,
    },
  },
  "lists.json": {
    description:
      "Lists of worlds (protocol/08-lists.md): NIP-51 curation sets. `worlds` is what a reader must take from the list, in order; where it is an object, the count and the last world kept. `errors` and `warnings` are sorted issue codes; `signatureValid` is null when the vector is unsigned.",
    testKeys,
    vectors: listVectors,
  },
  "portals.json": { description: "Portals (spec §6.1) and NIP-19 naddr round-trips.", portals: portalVectors, naddr: naddrVectors },
};

// ---- Saves (protocol/12-saves.md). A signer's whole side: work out an address, seal a save, and open one only for
// the world it belongs to.
{
  const ARCADE = "https://arcade.example";
  const OTHER = "https://other.example";
  const me = getPublicKey(KEY1);
  const K = getConversationKey(KEY1, me);
  const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  const NONCE = sha256(utf8ToBytes("nswp test vector save nonce"));
  const seal = (world: string, slot: string, data: string, tags?: string[][]) => {
    const made = sealSave({ conversationKey: K, world, slot, data, now: T0, nonce: NONCE })!;
    return sign(tags ? { ...made, tags } : made);
  };
  const opens = (name: string, description: string, event: NostrEvent, world: string, pubkey = me) => {
    const got = openSave(event, { conversationKey: K, pubkey, world });
    return { name, description, event, askedBy: world, expect: got };
  };
  const good = seal(ARCADE, "main", '{"level":3}');
  const address = [
    { world: ARCADE, slot: "main", d: saveAddress(K, ARCADE, "main") },
    { world: `${ARCADE}/play/?level=3`, slot: "main", d: saveAddress(K, `${ARCADE}/play/?level=3`, "main"), note: "Only the origin counts: the same address as the line above." },
    { world: ARCADE, slot: "run-2", d: saveAddress(K, ARCADE, "run-2") },
    { world: OTHER, slot: "main", d: saveAddress(K, OTHER, "main") },
    { world: ARCADE, slot: "Not A Slot", d: saveAddress(K, ARCADE, "Not A Slot"), note: "Not a slot's name: no address." },
  ];
  const vectors = [
    opens("its_own_world", "Opened for the world it was saved from.", good, ARCADE),
    opens("another_world_asks", "The same save, handed over by another world: refused.", good, OTHER),
    opens("moved_to_another_worlds_address", "A real save put at the address of the asking world's own slot: what is inside still says whose it is. Refused.", seal(ARCADE, "main", "x", [["d", saveAddress(K, OTHER, "main")]]), OTHER),
    opens("kept_at_the_wrong_slot", "At the address of another slot of the same world: refused.", seal(ARCADE, "main", "x", [["d", saveAddress(K, ARCADE, "run-2")]]), ARCADE),
    opens("somebody_elses", "A save by another key: refused.", sign(sealSave({ conversationKey: getConversationKey(KEY2, getPublicKey(KEY2)), world: ARCADE, slot: "main", data: "x", now: T0, nonce: NONCE })!, KEY2), ARCADE),
    opens("not_a_save", "The same words in a note of another kind: refused.", sign({ kind: 1, created_at: T0, tags: [], content: good.content }), ARCADE),
    opens("cleared", "An empty save: opened, and empty. This is how a slot is cleared.", seal(ARCADE, "main", ""), ARCADE),
  ];
  // What the core must make of them: one opens, one opens empty, and every other is refused.
  expectEqual("saves/its_own_world", vectors[0]!.expect, { slot: "main", data: '{"level":3}', at: T0 });
  expectEqual("saves/cleared", vectors.at(-1)!.expect, { slot: "main", data: "", at: T0 });
  for (const v of vectors.slice(1, -1)) expectEqual(`saves/${v.name}`, v.expect, null);
  expectEqual("saves/address is the origin's", address[1]!.d, address[0]!.d);
  expectEqual("saves/no address for a bad slot", address[4]!.d, "");
  expectEqual("saves/addresses differ", new Set(address.slice(0, 4).map((a) => a.d)).size, 3);
  files["saves.json"] = {
    description:
      "Saves (protocol/12-saves.md). `key1`'s NIP-44 conversation key with itself is `conversationKey`. `addresses` gives the `d` for a world and a slot (\"\" where there is none). `sealed` is a save made with the fixed `nonce`, so it can be reproduced exactly. In `opening`, `expect` is what a signer answers when the world `askedBy` hands it `event`: the slot, the data and the time, or null for a refusal. Signatures are checked separately.",
    testKeys,
    conversationKey: hex(K),
    nonce: hex(NONCE),
    addresses: address,
    sealed: { world: ARCADE, slot: "main", data: '{"level":3}', now: T0, event: good },
    opening: vectors,
  };
}

// ---- Ratings (protocol/13-ratings.md): what a reader takes from each, and what a tally comes to.
{
  const WORLD = `${WORLD_KIND}:${PK2}:arcade`;
  const URL_ = "https://arcade.example/";
  const rate = (key: Uint8Array, stars: number, o: { now?: number; words?: string; extra?: string[][]; world?: string } = {}) => {
    const made = buildRating({ world: o.world ?? WORLD, stars, words: o.words, now: o.now ?? T0 })!;
    return sign({ ...made, tags: [...made.tags, ...(o.extra ?? [])] }, key);
  };
  const a = rate(KEY1, 4, { words: "Caught all twelve." });
  const aLater = rate(KEY1, 5, { now: T0 + 60 });
  const b = rate(KEY3, 3);
  const fromInside = rate(KEY3, 5, { now: T0 + 120, extra: [["bitlogin:site", "https://arcade.example"]] });
  const itsMaker = rate(KEY2, 5);
  const badStars = { ...a, tags: a.tags.map((t) => (t[0] === "rating" ? ["rating", "9"] : t)) };
  const twoWorlds = { ...a, tags: a.tags.map((t) => (t[0] === "a" ? ["a", `${WORLD_KIND}:${PK2}:grove`] : t)) };
  const reading = [
    { name: "four_stars", description: "A rating with a few words.", event: a },
    { name: "asked_for_by_the_world", description: "A signer marked the site that asked: the world it rates. Read, with that noted; a tally leaves it out.", event: fromInside },
    { name: "nine_stars", description: "Stars outside one to five: not a rating.", event: badStars },
    { name: "about_another_world", description: "Kept at one world's address and about another: not a rating.", event: twoWorlds },
  ].map((v) => ({ ...v, expect: parseRating(v.event as NostrEvent) }));
  const tally = (name: string, description: string, events: NostrEvent[], counted: string[], me: string | null) => {
    const t = tallyRatings(events, { world: WORLD, counted, me, worldUrl: URL_ });
    return { name, description, events: events.map((e) => e.id), counted, me, expect: { count: t.count, average: t.average, mine: t.mine } };
  };
  const all = [a, aLater, b, fromInside, itsMaker];
  const tallies = [
    tally("two_people", "Each person's newest. The one the world asked for itself is left out, so the third key's earlier rating stands.", all, [PK1, PK3], null),
    tally("nobody_counted", "The same ratings, and nobody the reader counts: nothing.", all, [], null),
    tally("the_visitor_always_counts", "Nobody else counted, and the visitor is the first key.", all, [], PK1),
    tally("its_own_maker", "The world's publisher is counted by the reader, and still not for its own world.", all, [PK2], null),
  ];
  expectEqual("ratings/two_people", tallies[0]!.expect, { count: 2, average: 4, mine: 0 });
  expectEqual("ratings/nobody_counted", tallies[1]!.expect, { count: 0, average: 0, mine: 0 });
  expectEqual("ratings/the_visitor", tallies[2]!.expect, { count: 1, average: 5, mine: 5 });
  expectEqual("ratings/its_own_maker", tallies[3]!.expect, { count: 0, average: 0, mine: 0 });
  expectEqual("ratings/nine_stars", reading[2]!.expect, null);
  expectEqual("ratings/about_another_world", reading[3]!.expect, null);
  files["ratings.json"] = {
    description:
      "Ratings (protocol/13-ratings.md, kind 37305). `reading`: what a reader takes from one event, or null where it isn't a rating. `tallies`: the events are named by id from `events`; `counted` is who the reader counts, `me` is the visitor, and the world's address is `worldUrl`. `expect` is the tally: how many, their average to one place, and the visitor's own. Signatures are checked as part of a tally.",
    testKeys,
    world: WORLD,
    worldUrl: URL_,
    events: all,
    reading,
    tallies,
  };
}

// ---- People and messages (protocol/14-people-and-messages.md): a follow list changed without losing any of it,
// and a private message through its three layers, with what a reader must drop.
{
  const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  const ONCE = sha256(utf8ToBytes("nswp test vector throwaway key"));
  const N1 = sha256(utf8ToBytes("nswp test vector message nonce 1"));
  const N2 = sha256(utf8ToBytes("nswp test vector message nonce 2"));
  const CY = "c".repeat(64);
  const had = sign({ kind: FOLLOWS_KIND, created_at: T0, tags: [["p", PK2, "wss://relay.example", "Second"], ["t", "worlds"], ["p", CY]], content: '{"wss://old.example":{"read":true,"write":true}}' });
  const change = (name: string, description: string, list: NostrEvent | null, c: { add?: string; remove?: string; now: number; fromNothing?: boolean }) => {
    const next = changeFollows(list, c);
    return { name, description, list: list?.id ?? null, change: c, expect: next, follows: next ? followsIn(next) : null };
  };
  const follows = [
    change("follow", "One line added at the end. Every other tag, and the content, as it was.", had, { add: PK3, now: T0 + 60 }),
    change("unfollow", "Every line naming that person taken out, and nothing else.", had, { remove: PK2, now: T0 + 60 }),
    change("never_older", "Asked for at a time before the list it replaces: written one second after it.", had, { add: PK3, now: T0 - 500 }),
    change("already_followed", "Nothing to change: nothing to sign.", had, { add: CY, now: T0 + 60 }),
    change("oneself", "Nobody follows themselves here.", had, { add: PK1, now: T0 + 60 }),
    change("no_list_found", "No list was found, which is not the same as following nobody: refused.", null, { add: PK2, now: T0 + 60 }),
    change("a_first_list", "The person has said they follow nobody yet: a first list.", null, { add: PK2, now: T0 + 60, fromNothing: true }),
  ];
  expectEqual("people/follow", follows[0]!.expect?.tags, [...had.tags, ["p", PK3]]);
  expectEqual("people/follow_content", follows[0]!.expect?.content, had.content);
  expectEqual("people/unfollow", follows[1]!.follows, [CY]);
  expectEqual("people/never_older", follows[2]!.expect?.created_at, T0 + 1);
  expectEqual("people/already_followed", follows[3]!.expect, null);
  expectEqual("people/oneself", follows[4]!.expect, null);
  expectEqual("people/no_list_found", follows[5]!.expect, null);
  expectEqual("people/a_first_list", follows[6]!.follows, [PK2]);

  // The first key writes to the second. The seal is what the writer's signer makes; the wrap is the client's.
  const sealed = (written: unknown, from: Uint8Array, to: string) => sign(sealTemplate(nip44Encrypt(JSON.stringify(written), getConversationKey(from, to), N1), T0), from);
  const wrapped = (seal: NostrEvent, to: string) => wrapSeal(seal, to, { now: T0, secretKey: ONCE, nonce: N2, random: 0.25, auxRand: AUX })!;
  const written = buildMessage({ from: PK1, to: PK2, text: "See you at the Arcade?\nI'll be by the door.", now: T0 })!;
  const good = wrapped(sealed(written, KEY1, PK2), PK2);
  const mine = wrapped(sealed(written, KEY1, PK1), PK1);
  const forged = buildMessage({ from: PK1, to: PK2, text: "Send me your key.", now: T0 })!;
  const passedOff = wrapped(sealed(forged, KEY3, PK2), PK2);
  const toSomeoneElse = wrapped(sealed(buildMessage({ from: PK1, to: PK3, text: "For the third key.", now: T0 })!, KEY1, PK2), PK2);
  const taggedSeal = sign({ kind: 13, created_at: T0, tags: [["p", PK2]], content: nip44Encrypt(JSON.stringify(written), getConversationKey(KEY1, PK2), N1) });
  const withTaggedSeal = sign({ kind: 1059, created_at: T0, tags: [["p", PK2]], content: nip44Encrypt(JSON.stringify(taggedSeal), getConversationKey(ONCE, PK2), N2) }, ONCE);
  const aNote = { ...written, kind: 1 };
  const notAMessage = wrapped(sealed(aNote, KEY1, PK2), PK2);
  const open = (name: string, description: string, wrap: NostrEvent, readerKey: Uint8Array, reader: string) => ({ name, description, wrap, reader, expect: openWrap(wrap, readerKey) });
  const messages = [
    open("to_its_reader", "The second key opens a message from the first.", good, KEY2, "key2"),
    open("its_writers_copy", "The same message, sealed and wrapped for its writer, who reads back what they sent.", mine, KEY1, "key1"),
    open("not_for_this_reader", "The session key is handed the second key's wrap: it can't be opened.", good, KEY3, "session"),
    open("passed_off", "Says it is from the first key, sealed by the session key: dropped.", passedOff, KEY2, "key2"),
    open("to_someone_else", "A real message from the first key to the session key, sealed and wrapped for the second: dropped.", toSomeoneElse, KEY2, "key2"),
    open("a_seal_with_tags", "A seal carries no tags. One that does is not a seal.", withTaggedSeal, KEY2, "key2"),
    open("not_a_message", "What was sealed is a note, not a message: dropped.", notAMessage, KEY2, "key2"),
  ];
  expectEqual("people/to_its_reader", messages[0]!.expect, { id: written.id, from: PK1, to: [PK2], text: "See you at the Arcade?\nI'll be by the door.", at: T0 });
  expectEqual("people/its_writers_copy", messages[1]!.expect, messages[0]!.expect);
  for (const m of messages.slice(2)) expectEqual(`people/${m.name}`, m.expect, null);
  expectEqual("people/wrap_by_throwaway", good.pubkey, getPublicKey(ONCE));
  expectEqual("people/wrap_moved_back", good.created_at, T0 - 12 * 3600);
  // A world that was let follow for its visitor hands the signer their list and one change.
  const older = sign({ kind: FOLLOWS_KIND, created_at: T0 - 3600, tags: [["p", CY]], content: "" });
  const someoneElses = sign({ kind: FOLLOWS_KIND, created_at: T0, tags: [["p", CY]], content: "" }, KEY2);
  const madeUp = { ...had, tags: [["p", CY]] };
  const forWorld = (name: string, description: string, o: { list: NostrEvent | null; add?: string; remove?: string; seen?: number }) => ({
    name,
    description,
    ...o,
    expect: followForWorld({ ...o, pubkey: PK1, now: T0 + 60 }),
  });
  const fromAWorld = [
    forWorld("their_own_list", "The first key's own list and one change: signed.", { list: had, add: PK3 }),
    forWorld("a_list_the_world_made", "The same list with its lines changed by the world: the signature no longer holds. Refused.", { list: madeUp as NostrEvent, add: PK3 }),
    forWorld("someone_elses_list", "A real list, by another key. Refused.", { list: someoneElses, add: PK3 }),
    forWorld("older_than_seen", "A real list of theirs, older than one the signer has seen. Refused.", { list: older, add: PK3, seen: T0 }),
    forWorld("none_once_one_was_seen", "The world says they have no list; the signer has seen one. Refused.", { list: null, add: PK3, seen: T0 }),
    forWorld("a_first_list", "The world says they have no list, and the signer has seen none: a first list.", { list: null, add: PK3 }),
  ];
  expectEqual("people/world_own", fromAWorld[0]!.expect?.tags, [...had.tags, ["p", PK3]]);
  for (const v of fromAWorld.slice(1, 5)) expectEqual(`people/world_${v.name}`, v.expect, null);
  expectEqual("people/world_first", fromAWorld[5]!.expect?.tags, [["p", PK3]]);
  // What a signer hands a world that asked for a message to be sent: the message, and a seal for each of the two.
  const forAWorld = sealMessage({ secretKey: KEY1, to: PK2, text: "Sent from a world.", now: T0, nonces: [N1, N2], auxRand: AUX })!;
  expectEqual("people/sealed_reader", openWrap(wrapSeal(forAWorld.seals[0], PK2, { now: T0, secretKey: ONCE, nonce: N2, random: 0, auxRand: AUX })!, KEY2)?.text, "Sent from a world.");
  expectEqual("people/sealed_writer", openWrap(wrapSeal(forAWorld.seals[1], PK1, { now: T0, secretKey: ONCE, nonce: N2, random: 0, auxRand: AUX })!, KEY1)?.to, [PK2]);
  files["people.json"] = {
    description:
      "People and messages (protocol/14-people-and-messages.md; NIP-02 and NIP-17). `follows`: `list` is the follow list a change starts from (`followList`, or null where none was found), `change` is what was asked, `expect` is the list to be signed, or null where nothing is signed, and `follows` is who it names. `fromAWorld`: what a signer does when a world it was let asks for one change (`followForWorld`): `list` is what the world handed over, `seen` the time of the newest list the signer has seen, and `expect` the list it signs for the first key, or null where it refuses. `sealedForAWorld`: what `sealMessage` gives for the first key writing to the second, with those nonces: the message as written, a seal the second key can open and one the first can. `messages`: `wrap` is a kind 1059 event and `reader` names the test key that tries to open it; `expect` is the message, or null where a reader must drop it. The wraps here are signed by a fixed throwaway key with fixed nonces so that they are reproducible: a real one uses a new key each time.",
    testKeys: { ...testKeys, throwaway: { label: "nswp test vector throwaway key", secretKey: hex(ONCE), pubkey: getPublicKey(ONCE) } },
    followList: had,
    follows,
    fromAWorld,
    written,
    messages,
    sealedForAWorld: { to: PK2, text: "Sent from a world.", now: T0, nonces: [hex(N1), hex(N2)], expect: forAWorld },
  };
}

// ---- Scores (protocol/15-scores.md): what a signer signs for a world, what a reader takes from each, and a board.
{
  const WORLD = `${WORLD_KIND}:${PK2}:arcade`;
  const ORIGIN = "https://arcade.example";
  const post = (key: Uint8Array, score: number, o: { now?: number; origin?: string; board?: string } = {}) => sign(scoreForWorld({ world: WORLD, board: o.board ?? "lantern-run", score, title: "Lantern Run", format: "time", origin: o.origin ?? ORIGIN, now: o.now ?? T0 })!, key);
  const a = post(KEY1, 42_500);
  const aBetter = post(KEY1, 41_000, { now: T0 + 60 });
  const b = post(KEY3, 39_500);
  const elsewhere = post(KEY2, 1, { origin: "https://another.example" });
  const otherBoard = post(KEY2, 5, { board: "another" });
  const badD = { ...a, tags: a.tags.map((t) => (t[0] === "d" ? ["d", `${WORLD}/another`] : t)) };
  const reading = [
    { name: "a_score", description: "A score as a signer makes it for a world: marked with the site that asked.", event: a },
    { name: "kept_somewhere_else", description: "Its `d` says another board than its `board` tag: not a score.", event: badD },
  ].map((v) => ({ ...v, expect: parseScore(v.event as NostrEvent) }));
  const all = [a, aBetter, b, elsewhere, otherBoard];
  const board = (name: string, description: string, o: { counted: string[]; me: string | null; order: "high" | "low" }) => {
    const r = rankScores(all, { world: WORLD, board: "lantern-run", worldUrl: `${ORIGIN}/`, ...o });
    return { name, description, ...o, expect: { known: r.known.map((s) => [s.by, s.score, s.rank]), others: r.others.map((s) => [s.by, s.score, s.rank]), count: r.count } };
  };
  const boards = [
    board("less_is_better", "Each person's newest. The one asked for at another site, and the one on another board, are not on it.", { counted: [], me: null, order: "low" }),
    board("someone_they_know", "The first key is someone the reader follows: listed apart, with their place among everyone.", { counted: [PK1], me: null, order: "low" }),
    board("more_is_better", "The same scores on a board where more is better.", { counted: [], me: null, order: "high" }),
  ];
  expectEqual("scores/less_is_better", boards[0]!.expect, { known: [], others: [[PK3, 39_500, 1], [PK1, 41_000, 2]], count: 2 });
  expectEqual("scores/someone_they_know", boards[1]!.expect, { known: [[PK1, 41_000, 2]], others: [[PK3, 39_500, 1]], count: 2 });
  expectEqual("scores/more_is_better", boards[2]!.expect.others, [[PK1, 41_000, 1], [PK3, 39_500, 2]]);
  expectEqual("scores/kept_somewhere_else", reading[1]!.expect, null);
  files["scores.json"] = {
    description:
      "Scores (protocol/15-scores.md, kind 37306). `signed`: what `scoreForWorld` gives a signer to sign, for the world at `origin`, where the world said what the board is called and that it counts a time; `signedPlain`: where it said neither. `reading`: what a reader takes from one event, or null where it isn't a score. `boards`: every event in `events` is handed to `rankScores` for board `lantern-run` of `world` at `worldUrl`; `counted` is who the reader has reason to know, and `expect` lists [who, score, place among everyone] for the known and for the others.",
    testKeys,
    world: WORLD,
    worldUrl: `${ORIGIN}/`,
    signed: { board: "lantern-run", score: 42_500, title: "Lantern Run", format: "time", origin: ORIGIN, now: T0, expect: scoreForWorld({ world: WORLD, board: "lantern-run", score: 42_500, title: "Lantern Run", format: "time", origin: ORIGIN, now: T0 }) },
    signedPlain: { board: "main", score: 7, origin: ORIGIN, now: T0, expect: scoreForWorld({ world: WORLD, board: "main", score: 7, origin: ORIGIN, now: T0 }) },
    events: all,
    reading,
    boards,
  };
}

// ---- Achievements (protocol/16-achievements.md): what a signer signs for a world, and who holds what.
{
  const WORLD = `${WORLD_KIND}:${PK2}:arcade`;
  const ORIGIN = "https://arcade.example";
  const hold = (key: Uint8Array, id: string, o: { now?: number; origin?: string; title?: string } = {}) => sign(achievementForWorld({ world: WORLD, id, title: o.title ?? "All twelve", origin: o.origin ?? ORIGIN, now: o.now ?? T0 })!, key);
  const a = hold(KEY1, "all-twelve");
  const b = hold(KEY3, "all-twelve");
  const first = hold(KEY3, "first-lantern", { title: "First light" });
  const elsewhere = hold(KEY2, "all-twelve", { origin: "https://another.example" });
  const badD = { ...a, tags: a.tags.map((t) => (t[0] === "d" ? ["d", `${WORLD}/another`] : t)) };
  const reading = [
    { name: "an_achievement", description: "As a signer makes it for a world: marked with the site that asked.", event: a },
    { name: "kept_somewhere_else", description: "Its `d` says another achievement than its tag: not one.", event: badD },
  ].map((v) => ({ ...v, expect: parseAchievement(v.event as NostrEvent) }));
  const all = [a, b, first, elsewhere];
  const got = achievementsIn(all, { world: WORLD, worldUrl: `${ORIGIN}/`, counted: [PK3], me: PK1 });
  const holders = [...got.byId.values()].sort((x, y) => (x.id < y.id ? -1 : 1));
  expectEqual("achievements/holders", holders, [
    { id: "all-twelve", holders: 2, known: [PK3], mine: true },
    { id: "first-lantern", holders: 1, known: [PK3], mine: false },
  ]);
  expectEqual("achievements/kept_somewhere_else", reading[1]!.expect, null);
  files["achievements.json"] = {
    description:
      "Achievements (protocol/16-achievements.md, kind 37307). `signed`: what `achievementForWorld` gives a signer to sign, for the world at `origin`. `reading`: what a reader takes from one event, or null where it isn't one. `holders`: every event in `events` is handed to `achievementsIn` for `world` at `worldUrl`, with `counted` as who the reader has reason to know and `me` as the reader; the one asked for at another site is not counted.",
    testKeys,
    world: WORLD,
    worldUrl: `${ORIGIN}/`,
    signed: { id: "all-twelve", title: "All twelve", origin: ORIGIN, now: T0, expect: achievementForWorld({ world: WORLD, id: "all-twelve", title: "All twelve", origin: ORIGIN, now: T0 }) },
    events: all,
    reading,
    counted: [PK3],
    me: PK1,
    holders,
  };
}

// ---- Items (protocol/17-items.md): a description as its maker signs it, and what a reader takes from one.
{
  const H = (c: string) => c.repeat(64);
  const lantern = {
    d: "brass-lantern",
    title: "Brass lantern",
    summary: "A lantern that swings as you walk.",
    model: { url: `https://items.example/${H("a")}.glb`, sha256: H("a") },
    thumb: { url: `https://items.example/${H("b")}.webp`, sha256: H("b") },
    size: [0.18, 0.42, 0.18] as [number, number, number],
    colliders: [{ shape: "box" as const, centre: [0, 0.21, 0] as [number, number, number], size: [0.18, 0.42, 0.18] as [number, number, number] }],
    clips: { idle: "Swing", use: "Flare" },
    behaviors: ["holdable" as const],
    fits: ["place" as const, "hand-left" as const, "hand-right" as const],
    script: { url: `https://items.example/${H("c")}.js`, sha256: H("c") },
    license: "CC-BY-4.0",
  };
  const full = sign(buildItem({ ...lantern, now: T0 })!);
  const plain = sign(buildItem({ d: "chair", title: "Chair", model: lantern.model, size: [0.5, 0.9, 0.5], behaviors: ["sittable"], fits: ["place"], now: T0 })!);
  const noModel = { ...full, tags: full.tags.filter((t) => t[0] !== "model") };
  const plainHttp = { ...full, tags: full.tags.map((t) => (t[0] === "model" ? ["model", "http://items.example/a.glb", "glb", H("a")] : t)) };
  const tooBig = { ...full, tags: full.tags.map((t) => (t[0] === "size" ? ["size", "0.2 9 0.2"] : t)) };
  const unknowns = { ...full, tags: [...full.tags, ["behavior", "explodes"], ["collider", "blob", "0 0 0", "1"]] };
  const reading = [
    { name: "a_lantern", description: "A description with everything: a model, a picture, a hit box, animations, where it fits, and a script.", event: full },
    { name: "a_chair", description: "The least a description can be, and what it can be.", event: plain },
    { name: "things_nobody_knows", description: "A behaviour and a shape that aren't on the lists are left out; the item is still an item.", event: unknowns },
    { name: "no_model", description: "Names no model: not an item.", event: noModel },
    { name: "a_model_over_plain_http", description: "A file that isn't an https address: not an item.", event: plainHttp },
    { name: "too_big", description: "A side longer than four metres: not an item.", event: tooBig },
  ].map((v) => ({ ...v, expect: parseItem(v.event as NostrEvent) }));
  expectEqual("items/a_lantern", reading[0]!.expect?.id, `37303:${PK1}:brass-lantern`);
  expectEqual("items/a_lantern_script", reading[0]!.expect?.script, lantern.script);
  expectEqual("items/a_chair", [reading[1]!.expect?.behaviors, reading[1]!.expect?.script], [["sittable"], null]);
  expectEqual("items/things_nobody_knows", [reading[2]!.expect?.behaviors, reading[2]!.expect?.colliders.length], [["holdable"], 1]);
  for (const v of reading.slice(3)) expectEqual(`items/${v.name}`, v.expect, null);
  // A bag (kind 37308): what is read from one, and what a change to one gives its owner to sign.
  const LANTERN = `37303:${PK1}:brass-lantern`;
  const BOOK = `37303:${PK1}:old-book`;
  const had = { kind: BAG_KIND, created_at: T0, tags: [["d", "bag"], ["a", LANTERN], ["t", "kept"], ["a", "37300:" + PK1 + ":not-an-item"], ["bitlogin:site", "https://somewhere.example"], ["alt", "A bag: the items this person has"]], content: "" };
  const bagReading = { description: "Only items are read from it, each once, in order.", event: had, expect: bagIn(had) };
  expectEqual("bag/reading", bagReading.expect, [LANTERN]);
  const changing = [
    { name: "put_one_in", description: "Everything else is kept; a signer's own mark on the last one isn't carried along; the time moves on.", newest: had, change: { add: BOOK, now: T0 } },
    { name: "take_one_out", description: "Only that item goes.", newest: had, change: { remove: LANTERN, now: T0 + 50 } },
    { name: "already_there", description: "Nothing to sign.", newest: had, change: { add: LANTERN, now: T0 + 50 } },
    { name: "not_an_item", description: "A coordinate of another kind: nothing to sign.", newest: had, change: { add: "37300:" + PK1 + ":a-world", now: T0 + 50 } },
    { name: "no_bag_found", description: "No bag could be found, and the person hasn't said they have none: nothing to sign.", newest: null, change: { add: BOOK, now: T0 } },
    { name: "a_first_bag", description: "The person has said they have none: a first one.", newest: null, change: { add: BOOK, now: T0, fromNothing: true } },
  ].map((v) => ({ ...v, expect: changeBag(v.newest, v.change) }));
  expectEqual("bag/put_one_in", [bagIn(changing[0]!.expect), changing[0]!.expect?.created_at, changing[0]!.expect?.tags.some((t) => t[0] === "bitlogin:site"), changing[0]!.expect?.tags.some((t) => t[0] === "t")], [[LANTERN, BOOK], T0 + 1, false, true]);
  expectEqual("bag/take_one_out", bagIn(changing[1]!.expect), []);
  for (const v of changing.slice(2, 5)) expectEqual(`bag/${v.name}`, v.expect, null);
  expectEqual("bag/a_first_bag", bagIn(changing[5]!.expect), [BOOK]);
  // Items in play: what is said in a room, the arc, and what a script may ask for.
  const shotSaid = buildShot({ id: 7, name: "dart", from: [1, 1.4, -2], velocity: [0, 3, -12], stick: 3 })!;
  const play = {
    said: [
      { name: "a_thing_sent_out", text: shotSaid },
      { name: "too_fast", description: "Slowed to the fastest anything may go, and stuck no longer than anything may.", text: "shot:1,dart,0,1,0,0,0,-900,99" },
      { name: "going_nowhere", text: "shot:1,dart,0,1,0,0,0,0,3" },
      { name: "a_name_that_isnt_one", text: "shot:1,DART,0,1,0,0,0,-9,3" },
      { name: "a_hit", text: buildHit({ by: PK1, id: 7, at: [0.1, 1.2, -0.05] })! },
      { name: "a_hit_nowhere_on_a_person", text: `hit:${PK1},7,0,99,0` },
      { name: "a_sound", text: "did:sound,fire" },
      { name: "an_animation", text: "did:clip,reload" },
      { name: "a_sound_that_is_a_path", text: "did:sound,../etc" },
      { name: "health", text: "st:health,3,5" },
      { name: "more_than_full", text: "st:health,6,5" },
    ].map((v) => ({ ...v, expect: { shot: parseShot(v.text), hit: parseHit(v.text), did: parseDid(v.text), state: parseState(v.text) } })),
    arc: [0, 0.25, 0.5, 1].map((t) => ({ shot: shotSaid, t, expect: shotAt(parseShot(shotSaid)!, t).map((n) => Math.round(n * 1e6) / 1e6) })),
    asks: (
      [
        ["play", ["fire"]],
        ["send", ["dart", { speed: 14, stick: 3 }]],
        ["send", ["dart", { speed: 9999, stick: 9999 }]],
        ["show", ["5 / 5 <b>"]],
        ["fetch", ["https://items.example/"]],
        ["play", ["../x"]],
      ] as const
    ).map(([name, args]) => ({ name, args, expect: cleanAsk(name, args) })),
    health: [[5, 1], [1, 3], [5, 99]].map(([value, by]) => ({ value, by, expect: struck(value!, by!) })),
  };
  expectEqual("play/a_thing_sent_out", play.said[0]!.expect.shot?.velocity, [0, 3, -12]);
  expectEqual("play/too_fast", [Math.round(Math.hypot(...play.said[1]!.expect.shot!.velocity)), play.said[1]!.expect.shot!.stick], [PLAY_LIMITS.speed, PLAY_LIMITS.stick]);
  for (const i of [2, 3]) expectEqual(`play/${play.said[i]!.name}`, play.said[i]!.expect.shot, null);
  expectEqual("play/a_hit", play.said[4]!.expect.hit?.id, 7);
  expectEqual("play/a_hit_nowhere", play.said[5]!.expect.hit, null);
  expectEqual("play/a_sound_that_is_a_path", play.said[8]!.expect.did, null);
  expectEqual("play/more_than_full", play.said[10]!.expect.state, null);
  expectEqual("play/asks", play.asks.map((a) => a.expect?.ask ?? null), ["play", "send", "send", "show", null, null]);
  files["items.json"] = {
    description:
      "Items (protocol/17-items.md, kinds 37303 and 37308). `reading`: what a reader takes from one event (`parseItem`), or null where it isn't an item. A reader checks the signature besides, and checks every file against the hash it is named with before using it. `bag.reading`: the items read from a bag (`bagIn`). `bag.changing`: what `changeBag` gives its owner to sign, from the newest bag found and one change, or null where there is nothing to sign. `play.said`: what each thing said in a room is read as (`parseShot`, `parseHit`, `parseDid`, `parseState`), null where it isn't one. `play.arc`: where a thing is `t` seconds after it was sent out (`shotAt`). `play.asks`: what a script's ask is taken as (`cleanAsk`), or null. `play.health`: what is left after a thing takes `by` (`struck`).",
    testKeys,
    reading,
    bag: { reading: bagReading, changing },
    play,
  };
}

// ---- Shares (docs/plans/paying-for-things.md, section 8): how a listing divides its price. Written down and not
// in force: nothing pays a share yet. These are what the service that sells, the sign-in address that pays, and the
// kit must all agree on before anything does.
{
  const SELLER = PK1;
  const MAKER = PK2;
  const CLIENT = PK3;
  const tag = (to: string, parts: string, label?: string) => ["nswp:share", to, parts, ...(label === undefined ? [] : [label])];
  const reading = [
    { name: "none", description: "A listing with no share at all: the seller is paid everything.", tags: [["d", "a-lantern"], ["price", "500", "SAT"]] as string[][] },
    { name: "seller_maker_client", description: "Three shares, adding up to the whole.", tags: [tag(SELLER, "8500", "world"), tag(MAKER, "1000", "maker"), tag("client", "500")] },
    { name: "words_left_out", description: "A share with no word is called by what it is: seller, client, or share.", tags: [tag(SELLER, "9000"), tag(MAKER, "500"), tag("client", "500")] },
    { name: "not_whole", description: "Parts that don't add up to ten thousand: no shares at all, and nothing is made to fit.", tags: [tag(SELLER, "8500"), tag(MAKER, "1000")] },
    { name: "seller_left_out", description: "The seller must be among them.", tags: [tag(MAKER, "9500"), tag("client", "500")] },
    { name: "someone_twice", description: "Nobody is named twice.", tags: [tag(SELLER, "8000"), tag(MAKER, "1000"), tag(MAKER, "1000")] },
    { name: "two_clients", description: "Nor the client.", tags: [tag(SELLER, "9000"), tag("client", "500"), tag("client", "500")] },
    { name: "parts_not_digits", description: "Parts are whole numbers in digits, with no leading zero.", tags: [tag(SELLER, "09500"), tag(MAKER, "500")] },
    { name: "parts_with_a_point", description: "No fractions.", tags: [tag(SELLER, "9500.5"), tag(MAKER, "499.5")] },
    { name: "not_a_key", description: "Who is a key, or the word client.", tags: [tag(SELLER, "9500"), tag("alice@example.com", "500")] },
    { name: "a_word_too_long", description: "A word of at most 32 characters.", tags: [tag(SELLER, "9500"), tag(MAKER, "500", "x".repeat(33))] },
    { name: "a_hidden_mark_in_a_word", description: "Nothing unseen in a word.", tags: [tag(SELLER, "9500"), tag(MAKER, "500", "maker\u202e")] },
    { name: "too_many", description: "Six at most.", tags: [tag(SELLER, "4000"), ...[1, 2, 3, 4, 5, 6].map((n) => tag(bytesToHex(sha256(utf8ToBytes(`share ${n}`))), "1000"))] },
    { name: "an_extra_piece", description: "A share is three pieces or four, and no more.", tags: [tag(SELLER, "9500"), [...tag(MAKER, "500", "maker"), "more"]] },
  ].map((v) => ({ ...v, seller: SELLER, expect: readShares(v.tags, SELLER) }));
  const three: Share[] = [{ to: SELLER, parts: 8500, label: "world" }, { to: MAKER, parts: 1000, label: "maker" }, { to: "client", parts: 500, label: "client" }];
  const split = (name: string, description: string, price: number, shares: Share[], o: { client?: string; charge?: number } = {}) => ({ name, description, price, shares, seller: SELLER, ...o, expect: splitPrice(price, shares, SELLER, o) });
  const splitting = [
    split("no_shares", "No shares: the seller is paid the price, less the service's charge.", 500, [], { charge: 10 }),
    split("three_with_a_client", "A client brought the buyer: three payments, smallest first, the seller last. The charge comes out of the seller's part only.", 2100, three, { client: CLIENT, charge: 21 }),
    split("three_and_no_client", "Nobody brought the buyer: the client's share is the seller's.", 2100, three, { charge: 21 }),
    split("the_client_is_the_seller", "A seller who is their own client is paid once.", 2100, three, { client: SELLER, charge: 21 }),
    split("the_client_is_the_maker", "A client who is also named in the listing is one person, paid once.", 2100, three, { client: MAKER, charge: 21 }),
    split("rounded_down", "Each other part is rounded down to a whole sat, and what is left over is the seller's.", 999, three, { client: CLIENT, charge: 10 }),
    split("a_part_too_small", "At 150 sats the client's 5% is 7 sats, under the least a payment may be: this can't be sold with shares.", 150, three, { client: CLIENT, charge: 10 }),
    split("the_same_and_no_client", "The same listing sells where nobody brought the buyer, since that part is then the seller's.", 150, three, { charge: 10 }),
    split("the_charge_eats_the_seller", "A seller whose part doesn't cover the service's charge and the least payment: refused.", 200, [{ to: SELLER, parts: 1000, label: "seller" }, { to: MAKER, parts: 9000, label: "maker" }], { charge: 15 }),
    split("two_the_same", "Two parts of the same size go in the order of their keys, so everyone computes one order.", 1000, [{ to: SELLER, parts: 8000, label: "seller" }, { to: MAKER, parts: 1000, label: "maker" }, { to: CLIENT, parts: 1000, label: "host" }], { charge: 10 }),
  ];
  const by = (name: string) => splitting.find((v) => v.name === name)!.expect;
  expectEqual("shares/three_with_a_client", by("three_with_a_client"), { ok: true, parts: [{ to: CLIENT, sats: 105, label: "client", seller: false }, { to: MAKER, sats: 210, label: "maker", seller: false }, { to: SELLER, sats: 1764, label: "world", seller: true }] });
  expectEqual("shares/three_and_no_client", by("three_and_no_client"), { ok: true, parts: [{ to: MAKER, sats: 210, label: "maker", seller: false }, { to: SELLER, sats: 1869, label: "world", seller: true }] });
  expectEqual("shares/rounded_down", by("rounded_down"), { ok: true, parts: [{ to: CLIENT, sats: 49, label: "client", seller: false }, { to: MAKER, sats: 99, label: "maker", seller: false }, { to: SELLER, sats: 841, label: "world", seller: true }] });
  expectEqual("shares/a_part_too_small", by("a_part_too_small"), { ok: false, why: "too-small" });
  expectEqual("shares/no_shares", by("no_shares"), { ok: true, parts: [{ to: SELLER, sats: 490, label: "seller", seller: true }] });
  expectEqual("shares/not_whole", reading.find((v) => v.name === "not_whole")!.expect, { ok: false, why: "not-whole" });
  expectEqual("shares/none", reading.find((v) => v.name === "none")!.expect, { ok: true, shares: [] });
  for (const v of splitting) if (v.expect.ok) expectEqual(`shares/${v.name} adds up`, v.expect.parts.reduce((sum, p) => sum + p.sats, 0), v.price - (v.charge ?? 0));
  files["shares.json"] = {
    description:
      "Shares (docs/plans/paying-for-things.md, section 8; protocol/10-identity.md, \"Shares\"). WRITTEN DOWN AND NOT IN FORCE: nothing pays a share yet. `reading`: what a listing's tags give for a listing sold by `seller` (`readShares`): its shares, none, or why it has none it can be sold with. `splitting`: what a `price` in sats comes to for those `shares`, where `client` is the key of the client that brought the buyer (left out where none did) and `charge` is what the selling service takes, in sats, out of the seller's part (`splitPrice`): the payments in the order they are made, smallest first and the seller last, or why it can't be sold this way. The parts of every split add up to the price less the charge.",
    testKeys,
    limits: { most: 6, whole: 10000, least: 10, label: 32 },
    reading,
    splitting,
  };
}

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
