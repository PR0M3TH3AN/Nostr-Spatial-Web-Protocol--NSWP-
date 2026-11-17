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
  buildEntryAssertion,
  buildWorldEvent,
  checkDestination,
  decodeArrival,
  decodeNaddr,
  encodeArrival,
  encodeNaddr,
  finalizeEvent,
  getPublicKey,
  parseManifest,
  parsePortal,
  parseWorldEvent,
  verifyEntryAssertion,
  verifyEvent,
  verifyOrigin,
  WORLD_KIND,
  type EventTemplate,
  type NostrEvent,
} from "../packages/core/src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "vectors");
const check = process.argv.includes("--check");

const KEY1 = sha256(utf8ToBytes("nswp test vector key 1"));
const KEY2 = sha256(utf8ToBytes("nswp test vector key 2"));
const PK1 = getPublicKey(KEY1);
const PK2 = getPublicKey(KEY2);
const AUX = new Uint8Array(32);
const T0 = 1794430800;
const sign = (t: EventTemplate, key = KEY1): NostrEvent => finalizeEvent(t, key, AUX);

const testKeys = {
  note: "TEST-ONLY keys derived from public strings: sha256(utf8(label)). Anyone can sign as them. Signatures use 32 zero bytes of BIP-340 aux randomness so they are reproducible.",
  key1: { label: "nswp test vector key 1", secretKey: bytesToHex(KEY1), pubkey: PK1 },
  key2: { label: "nswp test vector key 2", secretKey: bytesToHex(KEY2), pubkey: PK2 },
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

const arrivalVectors = [
  { name: "entry_and_return_airlock", value: encodeArrival({ entry: "main-entrance", airlock: "https://airlock.example/go" }), expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", airlock: "https://airlock.example/go" }, warnings: [] as string[] } },
  { name: "with_assertion", value: encodeArrival({ entry: "main-entrance", assertion: goodAssertion }), expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", assertion: goodAssertion }, warnings: [] } },
  {
    name: "hostile_fields_dropped",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", airlock: "javascript:alert(1)", entry: "../../admin" })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3" }, warnings: ["invalid_entry_point", "url_not_https"] },
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
  "portals.json": { description: "Portals (spec §6.1) and NIP-19 naddr round-trips.", portals: portalVectors, naddr: naddrVectors },
};

mkdirSync(outDir, { recursive: true });
let stale = 0;
for (const [name, body] of Object.entries(files)) {
  const path = join(outDir, name);
  const text = `${JSON.stringify(body, null, 2)}\n`;
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
