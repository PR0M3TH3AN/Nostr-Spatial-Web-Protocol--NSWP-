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
import { LEAST_PRICE_SATS, readListing, termWords } from "../packages/core/src/listing.js";
import { changeOwnerList, listD, OWNER_LIST_LIMITS, ownerListTemplate, readOwnerList, resolveOwnerList, worldSubject, type ListScope, type OwnerListChange } from "../packages/core/src/owner-lists.js";
import { createHash } from "node:crypto";
import { cleanMenuSettings, cleanMenuWorld, LEAVE_MS, MENU_CARD_PICTURE, MENU_FILE_KINDS, MENU_KEYS, MENU_MAKING_MS, MENU_SAVE_MS, MENU_SAVE_TYPES, MENU_SHOW_KEEP_MS, MENU_SIGN_IN, MENU_LIMITS, MENU_REPORTED, MENU_VERSION, MENU_VISITOR_TABS, MENU_WAIT_MS, MENU_WORLD_TABS, menuBytes, menuVersionOf, readMenuWordDown, readMenuWordUp, reportedSettings, type MenuReadOptions } from "../packages/core/src/menu.js";
import { accessFor } from "../packages/core/src/manifest.js";
import { LOOK_BUDGET, LOOK_HEIGHT, lookHeight, readLookModel } from "../packages/core/src/look-model.js";
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
  resolveList,
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
  lobbyName,
  ROOM_LIMITS,
  ROOM_RELAYS,
  roomTopic,
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

type WorldVector = { name: string; description: string; event: unknown; expect: { valid: boolean; signatureValid: boolean | null; errors: string[]; warnings: string[]; audience?: string; category?: string | null; items?: string | null; access?: string[]; byInvitation?: boolean } };
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
  // What a world is entered by, where it is paid. `access` in `expect` is the listings a reader takes from it; none is a free world.
  { name: "paid_by_two_listings", description: "A paid world names the listings it is entered by: here a day and for good, both sold by the key that signs the announcement.", event: sign(buildWorldEvent({ ...baseWorld, access: [`30078:${PK1}:museum day pass`, `30078:${PK1}:museum-for-good`] })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], access: [`30078:${PK1}:museum day pass`, `30078:${PK1}:museum-for-good`] } },
  { name: "free_says_nothing", description: "A world that names no listing is free, as every world was before.", event: goodWorld, expect: { valid: true, signatureValid: true, errors: [], warnings: [], access: [] } },
  { name: "priced_by_someone_else", description: "A listing sold by another key is left out: nobody puts a price on a world that isn't theirs. With none left, the world is free.", event: sign(buildWorldEvent({ ...baseWorld, access: `30078:${PK2}:museum day pass` })), expect: { valid: true, signatureValid: true, errors: [], warnings: ["access_not_own"], access: [] } },
  { name: "access_that_is_no_listing", description: "An access tag that isn't a listing's coordinate is left out.", event: withTags((t) => [...t, ["a", `37303:${PK1}:a-lantern`, "", "access"]]), expect: { valid: true, signatureValid: null, errors: [], warnings: ["invalid_coordinate"], access: [] } },
  { name: "one_listing_named_twice", description: "The same listing twice is one listing.", event: withTags((t) => [...t, ["a", `30078:${PK1}:museum-for-good`, "", "access"], ["a", `30078:${PK1}:museum-for-good`, "", "access"]]), expect: { valid: true, signatureValid: null, errors: [], warnings: [], access: [`30078:${PK1}:museum-for-good`] } },
  // Whether a world is by invitation, as its announcement says it for a door. `byInvitation` in `expect` is what a reader takes from it.
  { name: "by_invitation", description: "Says it is by invitation: one tag, with nothing after it. A door shows it.", event: sign(buildWorldEvent({ ...baseWorld, byInvitation: true })), expect: { valid: true, signatureValid: true, errors: [], warnings: [], byInvitation: true } },
  { name: "by_invitation_with_a_value", description: "The tag takes no value: what follows is ignored with a warning, and the tag still says it.", event: withTags((t) => [...t, ["by-invitation", "friends only"]]), expect: { valid: true, signatureValid: null, errors: [], warnings: ["ignored_value"], byInvitation: true } },
  { name: "not_by_invitation", description: "Says nothing of it: a door doesn't say it is by invitation.", event: goodWorld, expect: { valid: true, signatureValid: true, errors: [], warnings: [], byInvitation: false } },
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
    name: "says_what_it_offers",
    description: "Saves, scores, achievements and tips are capabilities a world may say: a door shows them (NSWP-01, \"What a world offers\").",
    event: withTags((t) => [...t, ["capability", "saves"], ["capability", "scores"], ["capability", "achievements"], ["capability", "tips"]]),
    expect: { valid: true, signatureValid: null, errors: [], warnings: [] },
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
  if (v.expect.access !== undefined && r.ok) expectEqual(`world/${v.name} access`, r.value.access ?? [], v.expect.access);
  if (v.expect.byInvitation !== undefined && r.ok) expectEqual(`world/${v.name} byInvitation`, r.value.byInvitation === true, v.expect.byInvitation);
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
  // What a world is entered by, where it is paid. `access` in `expect` is what `accessFor` gives for the world's address.
  {
    name: "paid_world",
    description: "A paid world names its listings, each sold by a key the file lets announce that world.",
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "https://museum.example/world" }, access: [`30078:${PK1}:museum day pass`, `30078:${PK1}:museum-for-good`] } } }),
    expect: { valid: true, errors: [], warnings: [], access: [`30078:${PK1}:museum day pass`, `30078:${PK1}:museum-for-good`] },
  },
  {
    name: "priced_by_someone_else",
    description: "A listing sold by a key that isn't a publisher of that world is left out, and so is anything that isn't a listing. With none left, the world is free.",
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "https://museum.example/world" }, access: [`30078:${PK2}:museum day pass`, "paid", `37303:${PK1}:a-lantern`] } } }),
    expect: { valid: true, errors: [], warnings: ["access_not_own", "invalid_listing", "invalid_listing"], access: [] },
  },
  { name: "free_world", description: "A world that names no listing is free.", manifest: manifest(), expect: { valid: true, errors: [], warnings: [], access: [] } },
  // Whose lists count for a world, and whether its rooms show only named people (protocol/10-identity.md, "A world's own lists"). `rules` in `expect` is `keepers` and `namedOnly` as `accessFor` gives them.
  {
    name: "keepers_and_named_only",
    description: "A world names the keys whose lists count for it, and says its rooms show only people whose pass checks out.",
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "https://museum.example/world" }, keepers: [PK2, PK1], named_only: true } } }),
    expect: { valid: true, errors: [], warnings: [], access: [], rules: { keepers: [PK2, PK1], namedOnly: true, byInvitation: false } },
  },
  {
    name: "by_invitation",
    description: "A world that is by invitation: only people a keeper's allow list names may go in. With no keepers named, its publishers' lists count.",
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "https://museum.example/world" }, by_invitation: true } } }),
    expect: { valid: true, errors: [], warnings: [], access: [], rules: { keepers: null, namedOnly: false, byInvitation: true } },
  },
  {
    name: "by_invitation_not_true",
    description: "Only exactly true makes a world by invitation: anything else is ignored with a warning.",
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "https://museum.example/world" }, by_invitation: "yes" } } }),
    expect: { valid: true, errors: [], warnings: ["invalid_field"], access: [], rules: { keepers: null, namedOnly: false, byInvitation: false } },
  },
  {
    name: "keepers_that_are_not_keys",
    description: "Anything in keepers that isn't a 64-character lowercase hex key is left out, and only exactly true turns named_only on.",
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "https://museum.example/world" }, keepers: [PK1, PK1.toUpperCase(), "npub1example"], named_only: "yes" } } }),
    expect: { valid: true, errors: [], warnings: ["invalid_field", "invalid_keeper"], access: [], rules: { keepers: [PK1], namedOnly: false, byInvitation: false } },
  },
  {
    name: "too_many_keepers",
    description: "Four keepers at most: the rest are ignored.",
    manifest: manifest({ worlds: { "example-museum": { entry: { url: "https://museum.example/world" }, keepers: ["1", "2", "3", "4", "5"].map((n) => n.repeat(64)) } } }),
    expect: { valid: true, errors: [], warnings: ["too_many_keepers"], access: [], rules: { keepers: ["1", "2", "3", "4"].map((n) => n.repeat(64)), namedOnly: false, byInvitation: false } },
  },
  { name: "no_rules", description: "A world that says neither keeps no list, and its rooms are as they always were.", manifest: manifest(), expect: { valid: true, errors: [], warnings: [], access: [], rules: { keepers: null, namedOnly: false, byInvitation: false } } },
] as { name: string; description: string; manifest: unknown; byteLength?: number; expect: { valid: boolean; errors: string[]; warnings: string[]; access?: string[]; rules?: { keepers: string[] | null; namedOnly: boolean; byInvitation: boolean } } }[];
for (const v of manifestVectors) {
  const r = parseManifest(v.manifest, v.byteLength === undefined ? {} : { byteLength: v.byteLength });
  if (v.expect.access !== undefined && r.ok) expectEqual(`manifest/${v.name} access`, accessFor(r.value, "https://museum.example/world")?.listings ?? null, v.expect.access);
  if (v.expect.rules !== undefined && r.ok) {
    const got = accessFor(r.value, "https://museum.example/world");
    expectEqual(`manifest/${v.name} rules`, got ? { keepers: got.keepers, namedOnly: got.namedOnly, byInvitation: got.byInvitation } : null, v.expect.rules);
  }
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
    name: "how_they_move_in_a_headset_is_said_both_ways",
    value: encodeArrival({ entry: "main-entrance", settings: { headset: "casual", intense: false } }),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", settings: { intense: false, headset: "casual" } }, warnings: [] },
  },
  {
    name: "a_way_of_moving_in_a_headset_nobody_knows_is_left_out",
    value: Buffer.from(JSON.stringify({ v: "nswp/arrival/0.3", entry: "main-entrance", settings: { headset: "smooth", turn: 45 } })).toString("base64url"),
    expect: { valid: true, decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", settings: { turn: 45 } }, warnings: [] },
  },
  {
    name: "with_settings_that_travel",
    value: encodeArrival({ entry: "main-entrance", settings: { sound: { off: false, effects: 0.7, music: 0, voices: 1, hum: true }, text: 1.15, motion: false, wrist: "right", turn: 45, hand: "right", narrow: true, fade: false, full: true } }),
    expect: {
      valid: true,
      decoded: { v: "nswp/arrival/0.3", entry: "main-entrance", settings: { sound: { off: false, effects: 0.7, music: 0, voices: 1, hum: true }, text: 1.15, motion: false, wrist: "right", turn: 45, hand: "right", narrow: true, fade: false, full: true } },
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
// The model tier: what a look note's `model` names, and how tall it is drawn, within the kit's limits and a world's.
const LOOK_SHA = "c".repeat(64);
const modelNote = (tags: string[][]) => ({ kind: 37301, tags: [["d", "default"], ...tags] });
const lookModelVectors = [
  { name: "vrm_with_height_and_picture", note: modelNote([["model", "https://files.example/look.vrm", "vrm", LOOK_SHA], ["height", "1.92"], ["thumb", "https://files.example/look.webp", LOOK_SHA]]) },
  { name: "glb_too_tall_held_to_the_most", note: modelNote([["model", "https://files.example/look.glb", "glb", LOOK_SHA], ["height", "3.4"]]) },
  { name: "no_height_is_standard", note: modelNote([["model", "https://files.example/look.vrm", "vrm", LOOK_SHA]]) },
  { name: "a_thumb_without_a_hash_is_dropped", note: modelNote([["model", "https://files.example/look.vrm", "vrm", LOOK_SHA], ["thumb", "https://files.example/look.webp"]]) },
  { name: "simple_look_has_no_model", note: modelNote([["simple", "head", "tall"]]) },
  { name: "plain_http_is_refused", note: modelNote([["model", "http://files.example/look.vrm", "vrm", LOOK_SHA]]) },
  { name: "unknown_format_is_refused", note: modelNote([["model", "https://files.example/look.fbx", "fbx", LOOK_SHA]]) },
  { name: "no_hash_is_refused", note: modelNote([["model", "https://files.example/look.vrm", "vrm"]]) },
].map((v) => ({ ...v, expect: readLookModel(v.note) }));
expectEqual("look-model/too tall", lookModelVectors[1]!.expect?.height, LOOK_HEIGHT.most);
expectEqual("look-model/simple", lookModelVectors[4]!.expect, null);
const lookHeightVectors = [
  { asked: "1.72", world: null, expect: 0 },
  { asked: "0.3", world: null, expect: 0 },
  { asked: "9", world: null, expect: 0 },
  { asked: "tall", world: null, expect: 0 },
  { asked: "2.4", world: [1.5, 2], expect: 0 },
  { asked: "1.1", world: [1.5, 2], expect: 0 },
  { asked: "2.4", world: [0.1, 9], expect: 0 },
  { asked: "2.4", world: [3, 4], expect: 0 },
].map((v) => ({ ...v, expect: lookHeight(v.asked, (v.world ?? undefined) as [number, number] | undefined) }));

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
// Choosing a list from the copies relays gave (protocol/08-lists.md, "Following one"): the newest from the
// curator's key, after leaving out any dated more than 600 seconds ahead of the reader's clock.
const LIST_NOW = T0 + 86400;
const LIST_AT = `30004:${PK1}:quiet-places`;
const copyAt = (createdAt: number, key = KEY1, title = "Quiet places") => sign(buildListEvent({ ...baseList, title, createdAt }), key);
const listToday = copyAt(LIST_NOW - 100);
const listAhead600 = copyAt(LIST_NOW + 600, KEY1, "Quiet places, ten minutes ahead");
const listAhead601 = copyAt(LIST_NOW + 601, KEY1, "Quiet places, a second too far ahead");
const listNextYear = copyAt(LIST_NOW + 365 * 86400, KEY1, "Quiet places, from next year");
const listYesterday = copyAt(LIST_NOW - 86400, KEY1, "Quiet places, yesterday");
const listOtherKey = copyAt(LIST_NOW, KEY2, "Quiet places, by someone else");
const tiedA = copyAt(LIST_NOW - 50, KEY1, "Tied, one");
const tiedB = copyAt(LIST_NOW - 50, KEY1, "Tied, two");
const tiedFirst = tiedA.id < tiedB.id ? tiedA : tiedB;
const forged = { ...copyAt(LIST_NOW - 10, KEY1, "Quiet places, altered"), tags: [["d", "quiet-places"], ["title", "Altered after signing"]] };
// Signed with two d tags, the first of them the list's own: a reader that takes the first d would choose it.
const twoNames = (() => {
  const t = buildListEvent({ ...baseList, title: "Quiet places, under two names", createdAt: LIST_NOW - 5 });
  const at = t.tags.findIndex((x) => x[0] === "d");
  return sign({ ...t, tags: [...t.tags.slice(0, at + 1), ["d", "loud-places"], ...t.tags.slice(at + 1)] });
})();
type ListChoiceVector = { name: string; description: string; coordinate: string; now: number; events: unknown[]; expect: { chosen: string | null; title?: string; futureDated: string[] } };
const listChoiceVectors: ListChoiceVector[] = [
  { name: "exactly_600_seconds_ahead_is_read", description: "A copy dated exactly 600 seconds ahead of the reader's clock is chosen.", coordinate: LIST_AT, now: LIST_NOW, events: [listToday, listAhead600], expect: { chosen: listAhead600.id, title: "Quiet places, ten minutes ahead", futureDated: [] } },
  { name: "601_seconds_ahead_is_left_out", description: "A copy dated 601 seconds ahead is left out before choosing, and said; the copy before it stands.", coordinate: LIST_AT, now: LIST_NOW, events: [listToday, listAhead601], expect: { chosen: listToday.id, title: "Quiet places", futureDated: [listAhead601.id] } },
  { name: "only_a_future_copy", description: "With nothing but a copy dated too far ahead, there is no list yet, and the reader says why.", coordinate: LIST_AT, now: LIST_NOW, events: [listAhead601], expect: { chosen: null, futureDated: [listAhead601.id] } },
  { name: "a_future_copy_beside_a_current_one", description: "A copy signed with a clock a year fast leaves the honest current copy standing.", coordinate: LIST_AT, now: LIST_NOW, events: [listNextYear, listYesterday, listToday], expect: { chosen: listToday.id, title: "Quiet places", futureDated: [listNextYear.id] } },
  { name: "another_key_is_not_the_list", description: "A newer copy under the same d from another key is passed over: the coordinate fixes the key.", coordinate: LIST_AT, now: LIST_NOW, events: [listToday, listOtherKey], expect: { chosen: listToday.id, title: "Quiet places", futureDated: [] } },
  { name: "a_bad_signature_is_passed_over", description: "A newer copy whose signature doesn't check is passed over.", coordinate: LIST_AT, now: LIST_NOW, events: [listYesterday, forged], expect: { chosen: listYesterday.id, title: "Quiet places, yesterday", futureDated: [] } },
  { name: "two_d_tags_are_passed_over", description: "A newer, signed copy with two d tags (the first of them the list's) is passed over: a copy must have exactly one. The older copy stands.", coordinate: LIST_AT, now: LIST_NOW, events: [listYesterday, twoNames], expect: { chosen: listYesterday.id, title: "Quiet places, yesterday", futureDated: [] } },
  { name: "a_tie_goes_to_the_smallest_id", description: "Two copies with the same created_at: the one with the smaller id (NIP-01).", coordinate: LIST_AT, now: LIST_NOW, events: [tiedA, tiedB], expect: { chosen: tiedFirst.id, title: tiedFirst === tiedA ? "Tied, one" : "Tied, two", futureDated: [] } },
];
for (const v of listChoiceVectors) {
  const r = resolveList(v.events, { coordinate: v.coordinate, now: v.now });
  expectEqual(`list-choice/${v.name} chosen`, r.id, v.expect.chosen);
  expectEqual(`list-choice/${v.name} futureDated`, r.futureDated, v.expect.futureDated);
  if (v.expect.title !== undefined) expectEqual(`list-choice/${v.name} title`, r.list?.title, v.expect.title);
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
  {
    name: "a_guest",
    description: "A guest account's pass: its sign-in address made the key, not yet secured. It names nobody; a reader calls them \"Guest\" and four digits of the key.",
    event: rawPass([...passTags(), ["nswp:guest", "1"]]),
    origin: MUSEUM,
    now: T0 + 60,
    session: PK3,
    expect: { valid: true, errors: [], warnings: [], pubkey: PK1, name: "", guest: true },
  },
  {
    name: "not_a_guest",
    description: "Anything but \"1\" says nothing: an account's pass, as one with no such tag.",
    event: rawPass([...passTags(), ["name", "Alice"], ["nswp:guest", "yes"]]),
    origin: MUSEUM,
    now: T0 + 60,
    session: PK3,
    expect: { valid: true, errors: [], warnings: [], pubkey: PK1, name: "Alice", guest: false },
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
  if (r.ok && v.expect.guest !== undefined) expectEqual(`pass/${v.name} guest`, r.value.guest, v.expect.guest);
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

// ---------------------------------------------------------------------- writing a world owner's list
// What a writer of an owner's list (protocol/10-identity.md, "A world's own lists") makes from one change: the kit's
// own `nswp sign-world-list`, BitLogin's guest list, the owner's screen. Each case is checked by signing what is
// expected with key 1 (the world's publisher, so the subject's own key) and reading it back with `readOwnerList`.
const OWNER_NOW = T0 + 7 * 86400;
const person = (n: number) => getPublicKey(sha256(utf8ToBytes(`nswp owner list writing person ${n}`)));
const [ANA, BEN, CY, DEE] = [1, 2, 3, 4].map(person) as [string, string, string, string];
const ARENA = worldSubject(PK1, "the-arena");
type Change = { op: "add" | "remove"; person: string };
type WritingVector = {
  name: string;
  description: string;
  scope: ListScope;
  subject: string;
  before: { people: string[]; createdAt: number } | null;
  change: Change;
  now: number;
  expect: { refused: "too_many_people" } | { d: string; event: { kind: number; created_at: number; content: string; tags: string[][] }; signed: NostrEvent; readBack: { scope: ListScope; subject: string; entries: string[] } };
};
/** What one change makes, by the rules this file states: newer than the list it changes, people each once, in key order. */
const writeChange = (scope: ListScope, subject: string, before: WritingVector["before"], change: Change, now: number): WritingVector["expect"] => {
  // The list there was, signed as its keeper would have, and the core's own writer of one change (`changeOwnerList`):
  // so this file and the kit's writer can't drift apart.
  const beforeEvent = before ? sign(ownerListTemplate({ scope, subject, people: before.people, createdAt: before.createdAt })!) : null;
  const named: OwnerListChange = scope === "user-allow" ? (change.op === "add" ? "allow" : "unallow") : change.op === "add" ? "block" : "unblock";
  const event = changeOwnerList(beforeEvent, { subject, change: named, key: change.person, now });
  if (!event) return { refused: "too_many_people" };
  const signed = sign(event);
  const back = readOwnerList(signed, { now });
  return { d: listD(scope, subject), event, signed, readBack: back.ok ? { scope: back.scope, subject: back.subject, entries: [...back.entries] } : (back as never) };
};
const writing = (v: Omit<WritingVector, "expect">): WritingVector => ({ ...v, expect: writeChange(v.scope, v.subject, v.before, v.change, v.now) });
const fiveHundred = Array.from({ length: OWNER_LIST_LIMITS.write }, (_, i) => person(100 + i));
const writingVectors: WritingVector[] = [
  writing({ name: "a_first_list_from_none", description: "No list yet: allowing one person makes the first allow list, dated now.", scope: "user-allow", subject: ARENA, before: null, change: { op: "add", person: ANA }, now: OWNER_NOW }),
  writing({ name: "allow", description: "One more person on an allow list: every one already on it stays, and the new one takes their place in key order.", scope: "user-allow", subject: ARENA, before: { people: [ANA, CY], createdAt: OWNER_NOW - 3600 }, change: { op: "add", person: BEN }, now: OWNER_NOW }),
  writing({ name: "unallow", description: "One person taken off an allow list: the rest stay.", scope: "user-allow", subject: ARENA, before: { people: [ANA, BEN, CY], createdAt: OWNER_NOW - 3600 }, change: { op: "remove", person: BEN }, now: OWNER_NOW }),
  writing({ name: "block", description: "One more person on a block list.", scope: "user-deny", subject: ARENA, before: { people: [DEE], createdAt: OWNER_NOW - 3600 }, change: { op: "add", person: CY }, now: OWNER_NOW }),
  writing({ name: "unblock_the_last", description: "The last person taken off a block list: a list with nobody on it is still written and published, so the old one stops being read.", scope: "user-deny", subject: ARENA, before: { people: [CY], createdAt: OWNER_NOW - 3600 }, change: { op: "remove", person: CY }, now: OWNER_NOW }),
  writing({ name: "the_writers_clock_is_behind", description: "The list being changed is dated a little after the writer's clock (within the reader's ten minutes): the new one is dated a second after it, or relays would keep the old one.", scope: "user-allow", subject: ARENA, before: { people: [ANA], createdAt: OWNER_NOW + 120 }, change: { op: "add", person: DEE }, now: OWNER_NOW }),
  writing({ name: "a_world_d_with_colons", description: "A world whose d has colons in it: the subject and the list's d keep them all, and the reader takes everything after the key as the world's name.", scope: "user-allow", subject: worldSubject(PK1, "arena:north:2"), before: null, change: { op: "add", person: ANA }, now: OWNER_NOW }),
  writing({ name: "the_500_limit", description: "A list of 500 people, the most a writer puts in one, and one more: refused, and nothing is written. (A reader takes up to 2,000.)", scope: "user-deny", subject: ARENA, before: { people: fiveHundred, createdAt: OWNER_NOW - 3600 }, change: { op: "add", person: ANA }, now: OWNER_NOW }),
];
// What each case must come to, said here as well as computed above, so a change to the kit's writer is seen.
const peopleOf = (v: WritingVector) => ("event" in v.expect ? v.expect.event.tags.filter((t) => t[0] === "p").map((t) => t[1]) : null);
const sorted = (a: string[]) => [...a].sort();
expectEqual("owner-list-writing/how many", writingVectors.length, 8);
expectEqual("owner-list-writing/a_first_list_from_none people", peopleOf(writingVectors[0]!), [ANA]);
expectEqual("owner-list-writing/allow people", peopleOf(writingVectors[1]!), sorted([ANA, BEN, CY]));
expectEqual("owner-list-writing/unallow people", peopleOf(writingVectors[2]!), sorted([ANA, CY]));
expectEqual("owner-list-writing/block people", peopleOf(writingVectors[3]!), sorted([CY, DEE]));
expectEqual("owner-list-writing/unblock_the_last people", peopleOf(writingVectors[4]!), []);
expectEqual("owner-list-writing/the_writers_clock_is_behind created_at", "event" in writingVectors[5]!.expect ? writingVectors[5]!.expect.event.created_at : null, OWNER_NOW + 121);
expectEqual("owner-list-writing/a_world_d_with_colons d", "event" in writingVectors[6]!.expect ? writingVectors[6]!.expect.d : null, `nswp:governance:user-allow:v1:37300:${PK1}:arena:north:2`);
expectEqual("owner-list-writing/the_500_limit", writingVectors[7]!.expect, { refused: "too_many_people" });
for (const v of writingVectors) {
  if (!("event" in v.expect)) continue;
  const e = v.expect.event;
  expectEqual(`owner-list-writing/${v.name} shape`, { kind: e.kind, content: e.content, head: e.tags.slice(0, 4) }, { kind: 30078, content: "", head: [["d", v.expect.d], ["v", "1"], ["scope", v.scope], ["subject", v.subject]] });
  expectEqual(`owner-list-writing/${v.name} read back`, v.expect.readBack.entries, peopleOf(v));
}

const files: Record<string, unknown> = {
  "world-events.json": { description: "Spatial world announcements (spec §5). `errors` and `warnings` are sorted issue codes; `signatureValid` is null when the vector is unsigned.", testKeys, vectors: worldVectors },
  "manifests.json": { description: "Manifests (spec §7.2) and origin verification (spec §7.3). `failed` lists the verification checks that must fail.", testKeys, manifests: manifestVectors, verification: verificationVectors },
  "destinations.json": { description: "Airlock destination checks (spec §6.2). Registrable domains use the Public Suffix List including its private section.", vectors: destinationVectors },
  "assertions.json": { description: "Entry assertions (spec §4.4). Verify with the given `origin`, `now` and already-`seen` event IDs.", testKeys, vectors: assertionVectors },
  "arrivals.json": { description: "Arrival context: the value of #nswp= (spec §4.4). Hostile fields are dropped with warnings, not fatal.", vectors: arrivalVectors },
  "looks.json": {
    description:
      "Looks (protocol/05-looks.md). `generated`: the look and mark every implementation must work out from a seed; `grid` is the mark as five rows, # lit. `inline`: the short form that travels, with what a reader must make of it. `avatarEvents`: the same tags read under two keys. `budget` and `heightLimits`: what a look's own model is held to. `models`: what a look note's `model` names (`expect` null: no model may be worn). `heights`: how tall a model is drawn, from what was asked and a world's `avatar.height` (null: none given).",
    generated: generatedVectors,
    inline: inlineVectors,
    avatarEvents: avatarVectors,
    budget: LOOK_BUDGET,
    heightLimits: LOOK_HEIGHT,
    models: lookModelVectors,
    heights: lookHeightVectors,
  },
  "passes.json": {
    description:
      "Passes (protocol/10-identity.md). Verify each `event` as a world at `origin`, at time `now`, for a member using the session key `session` when one is given. `errors` and `warnings` are sorted issue codes. On success, `pubkey` is the identity and `name` what a reader may show; `guest`, where given, whether the pass is a guest account's (`[\"nswp:guest\", \"1\"]`).",
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
  "owner-list-writing.json": {
    description:
      "Writing a world owner's list (protocol/10-identity.md, \"A world's own lists\"; BitGate's shape, as `governance-lists.json` reads it): what a writer makes from one change on the list it has (`before`, or null for none) at the writer's clock `now`. The rules: `add` puts the person on and `remove` takes them off; every other person stays; the `p` tags are each person once, in order of their keys; the tags come in the order given (`d`, `v`, `scope`, `subject`, then the `p`s); `content` is empty; `created_at` is `now`, or one second after `before.createdAt` where that is not earlier, so the new list replaces the old; more than 500 people is refused, and nothing is written. `signed` is `event` signed with key 1, the world's publisher; `readBack` is what `readOwnerList` gives for it.",
    testKeys,
    vectors: writingVectors,
  },
  "lists.json": {
    description:
      "Lists of worlds (protocol/08-lists.md): NIP-51 curation sets. `worlds` is what a reader must take from the list, in order; where it is an object, the count and the last world kept. `errors` and `warnings` are sorted issue codes; `signatureValid` is null when the vector is unsigned.",
    testKeys,
    vectors: listVectors,
    choosing: {
      description:
        "Choosing a list from the copies relays gave for its coordinate: those of kind 30004 signed by its key, with exactly one d tag, its d, and a good signature. A copy dated more than 600 seconds after `now` is left out before choosing and named in `futureDated`; the newest of the rest is `chosen` (its id), a tie going to the smallest id; null for none.",
      vectors: listChoiceVectors,
    },
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
    { name: "four", description: "Four at most, the seller among them: this many is allowed.", tags: [tag(SELLER, "7000"), ...[1, 2, 3].map((n) => tag(bytesToHex(sha256(utf8ToBytes(`share ${n}`))), "1000"))] },
    { name: "too_many", description: "And one more is too many.", tags: [tag(SELLER, "6000"), ...[1, 2, 3, 4].map((n) => tag(bytesToHex(sha256(utf8ToBytes(`share ${n}`))), "1000"))] },
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
  expectEqual("shares/four", (reading.find((v) => v.name === "four")!.expect as { ok: boolean }).ok, true);
  expectEqual("shares/too_many", reading.find((v) => v.name === "too_many")!.expect, { ok: false, why: "too-many" });
  for (const v of splitting) if (v.expect.ok) expectEqual(`shares/${v.name} adds up`, v.expect.parts.reduce((sum, p) => sum + p.sats, 0), v.price - (v.charge ?? 0));
  files["shares.json"] = {
    description:
      "Shares (docs/plans/paying-for-things.md, section 8; protocol/10-identity.md, \"Shares\"). WRITTEN DOWN AND NOT IN FORCE: nothing pays a share yet. `reading`: what a listing's tags give for a listing sold by `seller` (`readShares`): its shares, none, or why it has none it can be sold with. `splitting`: what a `price` in sats comes to for those `shares`, where `client` is the key of the client that brought the buyer and can be paid (left out where none did, or where the selling service can't pay it: so one listing and one client have two right answers, with and without) and `charge` is what the selling service takes, in sats, out of the seller's part (`splitPrice`): the payments in the order they are made, smallest first and the seller last, or why it can't be sold this way. The parts of every split add up to the price less the charge.",
    testKeys,
    limits: { most: 4, whole: 10000, least: 10, label: 32 },
    reading,
    splitting,
  };
}

// ---- Listings (docs/plans/paying-for-things.md, section 4; protocol/10-identity.md, "A listing"): a thing for sale,
// as its seller signed it, read so that its name, its price and how long it lasts can be shown before anyone pays.
{
  const SELLER = PK1;
  // A selling service for these examples: a listing is taken only where it names one whose receipts are believed.
  const issuers = [{ name: "Test service", service: "https://unlock.example", pubkey: PK3 }];
  const tagsOf = (name: string, price: string, more: string[][] = []): string[][] => [["d", name], ["price", price, "SAT"], ["status", "active"], ["br:delivery", "seller-unlock-service-v1"], ["br:delivery-mode", "static"], ["br:unlock-service", issuers[0]!.service], ["br:unlock-service-pubkey", issuers[0]!.pubkey], ["br:claim-epoch", "1"], ["nswp:for", `37300:${SELLER}:example-museum`], ...more];
  const made = (name: string, price: string, more: string[][] = [], o: { key?: Uint8Array; content?: string; tags?: (t: string[][]) => string[][] } = {}): NostrEvent =>
    sign({ kind: 30078, created_at: T0, content: o.content ?? JSON.stringify({ title: "A day in the museum", summary: "An example listing. Not for sale." }), tags: (o.tags ?? ((t) => t))(tagsOf(name, price, more)) }, o.key ?? KEY1);
  const DAY = `30078:${SELLER}:museum day pass`;
  const GOOD = `30078:${SELLER}:museum-for-good`;
  const day = made("museum day pass", "500", [["nswp:term", "86400"]]);
  const listing = (name: string, description: string, event: unknown, coordinate: string) => ({ name, description, coordinate, event, expect: readListing(event, coordinate, { issuers }) });
  const reading = [
    listing("for_a_day", "For a day, at the least price. Its name is the seller's own, from the words inside.", day, DAY),
    listing("for_good", "No term said: bought for good. With no words inside, it is called by the name it is filed under.", made("museum-for-good", "2100", [], { content: "" }), GOOD),
    listing("named_by_a_tag", "A `title` tag is the name, before the words inside.", made("museum-for-good", "2100", [["title", "The museum, for good"]]), GOOD),
    listing("signed_by_someone_else", "The coordinate names one seller and another key signed this: nobody prices what isn't theirs.", made("museum day pass", "500", [["nswp:term", "86400"]], { key: KEY2 }), DAY),
    listing("changed_after_signing", "The price was changed after it was signed.", { ...day, tags: day.tags.map((t) => (t[0] === "price" ? ["price", "5", "SAT"] : t)) }, DAY),
    listing("another_listing", "A real listing of the same seller's, and not the one asked for.", day, GOOD),
    listing("under_the_least_price", "499 sats: nothing is shown for sale under 500.", made("museum day pass", "499", [["nswp:term", "86400"]]), DAY),
    listing("not_for_sale_now", "Withdrawn by its seller.", made("museum day pass", "500", [], { tags: (t) => t.map((x) => (x[0] === "status" ? ["status", "withdrawn"] : x)) }), DAY),
    listing("a_service_nobody_knows", "Sold through a service whose receipts are not believed: a purchase there would end in a receipt nothing could take.", made("museum day pass", "500", [], { tags: (t) => t.map((x) => (x[0] === "br:unlock-service-pubkey" ? [x[0], PK2] : x)) }), DAY),
    listing("a_term_that_does_not_read", "A term that isn't whole seconds is never taken as \"for good\".", made("museum day pass", "500", [["nswp:term", "a day"]]), DAY),
    listing("two_prices", "Two prices: neither is believed.", made("museum day pass", "500", [["price", "900", "SAT"]]), DAY),
    listing("with_shares", "Its price is divided between several people. Shares are written down and not in force, so it is not shown for sale.", made("museum day pass", "500", [["nswp:share", SELLER, "9000"], ["nswp:share", PK2, "1000"]]), DAY),
  ];
  const by = (name: string) => reading.find((v) => v.name === name)!.expect;
  expectEqual("listings/for_a_day", by("for_a_day"), { ok: true, listing: { coordinate: DAY, seller: SELLER, name: "A day in the museum", sats: 500, term: 86400, for: `37300:${SELLER}:example-museum`, issuer: issuers[0] } });
  expectEqual("listings/for_good", by("for_good"), { ok: true, listing: { coordinate: GOOD, seller: SELLER, name: "museum-for-good", sats: 2100, term: null, for: `37300:${SELLER}:example-museum`, issuer: issuers[0] } });
  expectEqual("listings/named_by_a_tag", (by("named_by_a_tag") as { listing?: { name: string } }).listing?.name, "The museum, for good");
  for (const [name, why] of [["signed_by_someone_else", "other-seller"], ["changed_after_signing", "not-signed"], ["another_listing", "other-listing"], ["under_the_least_price", "too-cheap"], ["not_for_sale_now", "not-for-sale"], ["a_service_nobody_knows", "unknown-service"], ["a_term_that_does_not_read", "not-a-listing"], ["two_prices", "not-a-listing"], ["with_shares", "shared"]] as const) expectEqual(`listings/${name}`, by(name), { ok: false, why });
  // The kit as shipped believes one service, and these examples name another.
  expectEqual("listings/as shipped", readListing(day, DAY), { ok: false, why: "unknown-service" });
  const words = [null, 60, 3600, 5400, 86400, 2_592_000, 45].map((term) => ({ term, expect: termWords(term) }));
  expectEqual("listings/words", words.map((w) => w.expect), ["once", "for 1 minute", "for 1 hour", "for 90 minutes", "for 1 day", "for 30 days", "for 45 seconds"]);
  files["listings.json"] = {
    description:
      "Listings (protocol/10-identity.md, \"A listing\"): a thing for sale, as its seller signed it. `reading`: what `readListing` makes of each `event` when asked for `coordinate`, believing the services in `issuers` (the kit as shipped believes BitUnlock alone, and reads these as `unknown-service`): the listing, or the first reason it is not shown for sale. `words`: how long a `term` in seconds lasts, as it is put after a price (`termWords`); null is something bought for good.",
    testKeys,
    issuers,
    least: LEAST_PRICE_SATS,
    reading,
    words,
  };
}

// ---- A world owner's own lists (protocol/10-identity.md, "A world's own lists"). The shape is BitGate's, and so are
// the examples: `vectors/governance-lists.json` is its file, copied byte for byte, never written here. It is checked
// to be that file, and the core is run against every case in it, so a change on either side is seen.
{
  const BITGATE = { repository: "PR0M3TH3AN/bitgate", commit: "8b98ed9181f0042546d76c3198deedfd6b1eb0b6", path: "vectors/governance-lists/scoped-lists.json", sha256: "a29211c8ec46d51a5b88bf1dafd338d6c5caf776896c91b8aa93cd655600d372" };
  const raw = readFileSync(join(outDir, "governance-lists.json"));
  const hash = createHash("sha256").update(raw).digest("hex");
  if (hash !== BITGATE.sha256) failures.push(`vectors/governance-lists.json is not BitGate's file at ${BITGATE.commit.slice(0, 7)} (sha256 ${hash}, wanted ${BITGATE.sha256}). Copy it again from ${BITGATE.repository}, ${BITGATE.path}, and change the commit and hash here only together.`);
  const v = JSON.parse(raw.toString("utf8")) as { now: number; decode: { name: string; event: unknown; reader?: { root?: string | string[] }; expect: Record<string, unknown> }[]; resolve: { name: string; query: { namespace?: string; scope: "user-allow" | "user-deny"; subject: string; root?: string | string[] }; events: unknown[]; expect: unknown }[] };
  for (const c of v.decode) {
    const got = readOwnerList(c.event, { now: v.now, ...(c.reader?.root !== undefined ? { root: c.reader.root } : {}) });
    // One case gives how many entries there are in place of all 2,000 of them.
    if (typeof c.expect.entryCount === "number") expectEqual(`governance-lists/decode ${c.name}`, got.ok ? { signer: got.signer, entryCount: got.entries.length, skipped: got.skipped } : got, { signer: c.expect.signer, entryCount: c.expect.entryCount, skipped: c.expect.skipped });
    else expectEqual(`governance-lists/decode ${c.name}`, got, c.expect);
  }
  for (const c of v.resolve) expectEqual(`governance-lists/resolve ${c.name}`, resolveOwnerList(c.events, { ...c.query, now: v.now }), c.expect);
  expectEqual("governance-lists/how many", [v.decode.length, v.resolve.length], [43, 12]);
}

// ---- The client has the menu (protocol/02-doors.md): the words between a framed world and the page above it.
{
  const STATE = { room: { has: false, joined: false, mic: null, count: 0 }, headset: { supported: false, presenting: false }, named: false, signIn: "none", holding: "", items: "allowed", hum: false };
  const bare = (over: Record<string, unknown> = {}) => ({ title: "", level: "full", keys: true, state: STATE, target: [], loading: null, sections: [], ...over });
  const row = (id: string, more: Record<string, unknown> = {}) => ({ id, label: `Row ${id}`, ...more });
  const kept = (id: string, more: Record<string, unknown> = {}) => ({ id, label: `Row ${id}`, kind: "button", ...more });

  const describing: { name: string; why: string; opts?: MenuReadOptions; world: unknown; expect: unknown }[] = [
    {
      name: "a_whole_description",
      why: "Everything a world may say, kept as said.",
      world: {
        title: "The Gallery",
        level: "quiet",
        corner: "top-right",
        keys: true,
        state: { room: { has: true, joined: true, mic: false, count: 3 }, headset: { supported: true, presenting: false }, named: true, signIn: "ready", holding: "37303:" + "ab".repeat(32) + ":lantern", items: "play", hum: true },
        target: ["A painting", "Oil on board, 1911"],
        loading: { fraction: 0.4, words: "The east wing" },
        sections: [
          { id: "room", note: "Three people are here.", rows: [row("room-leave", { short: "Leave", icon: "room", on: true, tone: "warn", bar: true }), row("room-link", { kind: "copy", copy: "https://gallery.example/#room=east" })] },
          { id: "shop", label: "The shop", icon: "save", rows: [row("shop-red", { kind: "swatch", color: "#aa2211" }), row("shop-print", { kind: "tile", mark: "check", faint: true }), row("shop-open", { kind: "line", on: false })] },
        ],
      },
      expect: {
        title: "The Gallery",
        level: "quiet",
        keys: true,
        state: { room: { has: true, joined: true, mic: false, count: 3 }, headset: { supported: true, presenting: false }, named: true, signIn: "ready", holding: "37303:" + "ab".repeat(32) + ":lantern", items: "play", hum: true },
        target: ["A painting", "Oil on board, 1911"],
        loading: { fraction: 0.4, words: "The east wing" },
        sections: [
          { id: "room", rows: [kept("room-leave", { short: "Leave", icon: "room", on: true, tone: "warn", bar: true }), kept("room-link", { kind: "copy", copy: "https://gallery.example/#room=east" })], note: "Three people are here." },
          { id: "shop", rows: [kept("shop-red", { kind: "swatch", color: "#aa2211" }), kept("shop-print", { kind: "tile", mark: "check", faint: true }), kept("shop-open", { kind: "line", on: false })], label: "The shop", icon: "save" },
        ],
        corner: "top-right",
      },
    },
    { name: "nothing_said", why: "An empty description is a world with no name and no tabs.", world: {}, expect: bare() },
    { name: "not_a_description", why: "Text, a list or nothing is no description.", world: ["room"], expect: null },
    {
      name: "the_visitors_own_tabs",
      why: "A world never fills the visitor's own tabs: each is left out whole.",
      world: { sections: MENU_VISITOR_TABS.map((id) => ({ id, rows: [row(`${id}-x`)] })) },
      expect: bare(),
    },
    {
      name: "a_tab_the_client_still_takes",
      why: "A client that doesn't yet run Following itself takes it from a world (`also`), and a row may be typed into there.",
      opts: { also: ["following"] },
      world: { sections: [{ id: "following", rows: [row("follow-key", { kind: "field" })] }, { id: "messages", rows: [row("m")] }] },
      expect: bare({ sections: [{ id: "following", rows: [kept("follow-key", { kind: "field" })] }] }),
    },
    {
      name: "the_clients_own_page",
      why: "A page of the client's own origin may fill any tab, and add more than two of its own.",
      opts: { own: true },
      world: { sections: [{ id: "bag", rows: [row("bag-add", { kind: "field" })] }, { id: "desk", label: "Desk", rows: [] }, { id: "shelf", label: "Shelf", rows: [] }, { id: "door", label: "Door", rows: [] }] },
      expect: bare({ sections: [{ id: "bag", rows: [kept("bag-add", { kind: "field" })] }, { id: "desk", rows: [], label: "Desk" }, { id: "shelf", rows: [], label: "Shelf" }, { id: "door", rows: [], label: "Door" }] }),
    },
    {
      name: "sound_and_help",
      why: "Sound and Help are filled by both. A world adds what is its own to them (the piece it is playing; a note about itself), which a client draws below its own rows, under the world's name. Nothing typed goes to a world from either: a `field` row there is left out.",
      world: {
        sections: [
          { id: "sound", rows: [row("sound-piece", { label: "Playing here: Nocturne. Next of 2", icon: "note" }), row("sound-name", { kind: "field" })] },
          { id: "help", note: "Six sculptures, each a few lines of code turned into a shape.", rows: [row("help-ask", { kind: "field" })] },
        ],
      },
      expect: bare({ sections: [{ id: "sound", rows: [{ id: "sound-piece", label: "Playing here: Nocturne. Next of 2", kind: "button", icon: "note" }] }, { id: "help", rows: [], note: "Six sculptures, each a few lines of code turned into a shape." }] }),
    },
    {
      name: "moving",
      why: "Moving is filled by both. How the visitor moves is the client's to switch; a world adds what it does for them, such as a jump, which a client draws below its own rows under the world's name. Nothing typed goes to a world from Moving.",
      world: { sections: [{ id: "moving", rows: [row("jump", { short: "Jump", icon: "step", bar: true }), row("moving-name", { kind: "field" })] }] },
      expect: bare({ sections: [{ id: "moving", rows: [kept("jump", { short: "Jump", icon: "step", bar: true })] }] }),
    },
    {
      name: "a_help_note_too_long",
      why: "A world's words in Help are a note of at most the limit. One that is over is left out, never cut to fit.",
      world: { sections: [{ id: "help", note: "x".repeat(MENU_LIMITS.note + 1), rows: [row("fresh")] }] },
      expect: bare({ sections: [{ id: "help", rows: [kept("fresh")] }] }),
    },
    {
      name: "three_tabs_of_its_own",
      why: "A world may add two tabs. The third is left out, and so is one with no name.",
      world: { sections: [{ id: "nameless", rows: [] }, { id: "one", label: "One", rows: [] }, { id: "two", label: "Two", rows: [] }, { id: "three", label: "Three", rows: [] }] },
      expect: bare({ sections: [{ id: "one", rows: [], label: "One" }, { id: "two", rows: [], label: "Two" }] }),
    },
    {
      name: "the_clients_names_stand",
      why: "A tab every place has is named by the client: a world's name and icon for it are not taken. A tab said twice is the first.",
      world: { sections: [{ id: "room", label: "Your wallet", icon: "wallet", rows: [row("a")] }, { id: "room", rows: [row("b")] }, { id: "Room", rows: [] }, { id: "a-name-that-is-too-long", label: "x", rows: [] }] },
      expect: bare({ sections: [{ id: "room", rows: [kept("a")] }] }),
    },
    {
      name: "where_a_row_may_be_typed_into",
      why: "A `field` row stands only in the keeper's tab and in a world's own tabs. Elsewhere it is left out.",
      world: { sections: [{ id: "room", rows: [row("say", { kind: "field" })] }, { id: "guests", rows: [row("guests-key", { kind: "field", bar: true })] }, { id: "shop", label: "Shop", rows: [row("shop-code", { kind: "field" })] }] },
      expect: bare({ sections: [{ id: "room", rows: [] }, { id: "guests", rows: [kept("guests-key", { kind: "field" })] }, { id: "shop", rows: [kept("shop-code", { kind: "field" })], label: "Shop" }] }),
    },
    {
      name: "where_a_file_may_be_asked_for",
      why: "A `file` row stands only in Panels and in a world's own tabs, and names the kinds of file it takes from the ones there are (`image`, `video`). A kind that isn't one of those is not taken; a row that names none of them is left out. It is never on the bar: where the file goes is written under it.",
      world: {
        sections: [
          { id: "room", rows: [row("room-file", { kind: "file", accept: ["image"] })] },
          { id: "panels", rows: [row("panel-file", { kind: "file", accept: ["video", "audio", "*", "image"], bar: true }), row("panel-sound", { kind: "file", accept: ["audio"] }), row("panel-any", { kind: "file" }), row("panel-all", { kind: "file", accept: "image" })] },
          { id: "shop", label: "Shop", rows: [row("shop-film", { kind: "file", accept: ["video"] })] },
        ],
      },
      expect: bare({ sections: [{ id: "room", rows: [] }, { id: "panels", rows: [kept("panel-file", { kind: "file", accept: ["image", "video"] })] }, { id: "shop", rows: [kept("shop-film", { kind: "file", accept: ["video"] })], label: "Shop" }] }),
    },
    {
      name: "a_row_that_saves",
      why: "A `save` row is a button whose press may be answered by the world handing a picture or a clip up. It stands wherever a button does, the bar too.",
      world: { sections: [{ id: "camera", rows: [row("camera-picture", { kind: "save", bar: true }), row("camera-clip", { kind: "save", on: true, tone: "warn" })] }] },
      expect: bare({ sections: [{ id: "camera", rows: [kept("camera-picture", { kind: "save", bar: true }), kept("camera-clip", { kind: "save", on: true, tone: "warn" })] }] }),
    },
    {
      name: "rows_left_out",
      why: "A row is left out, never mended: with no id or label, a label over the limit, a kind this doesn't know, a `copy` with no text, a swatch with no colour, an id already said, or an id that begins `card:` (which is how the picture of a tab's card is addressed, and never a row).",
      world: {
        sections: [
          {
            id: "view",
            rows: [
              { label: "No id" },
              { id: "no-label" },
              row("long", { label: "x".repeat(MENU_LIMITS.label + 1) }),
              row("just", { label: "x".repeat(MENU_LIMITS.label) }),
              row("new-kind", { kind: "slider" }),
              row("copy-nothing", { kind: "copy" }),
              row("copy-much", { kind: "copy", copy: "y".repeat(MENU_LIMITS.copy + 1) }),
              row("swatch-none", { kind: "swatch", color: "red" }),
              row("just"),
              row("an id"),
              row("card:people"),
              row("fine", { short: "z".repeat(MENU_LIMITS.label + 1), icon: "Not An Icon", tone: "loud", color: "url(x)", on: "yes", faint: 1, bar: "true" }),
            ],
          },
        ],
      },
      expect: bare({ sections: [{ id: "view", rows: [{ id: "just", label: "x".repeat(MENU_LIMITS.label), kind: "button" }, kept("fine")] }] }),
    },
    {
      name: "words_are_text",
      why: "Markup is shown as the letters sent. Anything unseen in a line (a control character, a mark that turns text round) becomes a space, and a line read is trimmed.",
      world: { title: "  <b>Free</b>\u202e sats\u0007 ", target: ["\u200bA\tdoor\n"], sections: [{ id: "room", rows: [{ id: "r", label: "<img src=x onerror=alert(1)>" }] }] },
      expect: bare({ title: "<b>Free</b> sats", target: ["A door"], sections: [{ id: "room", rows: [{ id: "r", label: "<img src=x onerror=alert(1)>", kind: "button" }] }] }),
    },
    {
      name: "text_to_copy_is_whole_or_not_at_all",
      why: "Text to copy is kept exactly as written, lines and all, and refused if anything in it is unseen.",
      world: { sections: [{ id: "room", rows: [row("two-lines", { kind: "copy", copy: "one\ntwo" }), row("hidden", { kind: "copy", copy: "npub1\u200babc" })] }] },
      expect: bare({ sections: [{ id: "room", rows: [kept("two-lines", { kind: "copy", copy: "one\ntwo" })] }] }),
    },
    {
      name: "a_card",
      why: "A card's words are text; the rows it names are that tab's own. Its `proven` mark is dropped: a world's say-so is not the client's to vouch for.",
      world: { sections: [{ id: "people", card: { title: "Ana", tag: "By name", proven: true, sub: "npub1ana…", copy: "npub1ana", text: "Keeper of clocks.", color: "#336699", now: ["Recording", 5], acts: ["mute", "elsewhere"] }, rows: [row("mute")] }, { id: "room", card: { tag: "no title" }, rows: [] }] },
      expect: bare({ sections: [{ id: "people", rows: [kept("mute")], card: { title: "Ana", tag: "By name", sub: "npub1ana…", copy: "npub1ana", text: "Keeper of clocks.", color: "#336699", now: ["Recording"], acts: ["mute"] } }, { id: "room", rows: [] }] }),
    },
    {
      name: "a_card_from_the_clients_own_page",
      why: "The proven mark is kept only from a page of the client's own origin, which checked the name itself.",
      opts: { own: true },
      world: { sections: [{ id: "people", card: { title: "Ana", tag: "By name", proven: true }, rows: [] }] },
      expect: bare({ sections: [{ id: "people", rows: [], card: { title: "Ana", tag: "By name", proven: true } }] }),
    },
    {
      name: "state_as_it_can_be",
      why: "What isn't said is not so. With no room nobody is joined; with no headset no session runs; a rule for items this doesn't know is none; and where signing in stands is one of four words, never a world's own sentence.",
      world: { level: "loud", corner: "middle", keys: false, state: { room: { has: false, joined: true, mic: true, count: 4 }, headset: { presenting: true }, named: "yes", signIn: "Sign in at evil.example", holding: 5, items: "everything" }, loading: { fraction: 7, words: 3 }, target: [5, "about nothing"] },
      expect: bare({ keys: false, state: { ...STATE, items: "none" }, loading: { fraction: 1, words: "" } }),
    },
    {
      name: "pictures_need_a_check",
      why: "A picture is kept only by a caller that checks it (its kind and size, in a browser). Here there is none.",
      world: { sections: [{ id: "camera", rows: [row("shot", { kind: "tile", picture: "https://tracker.example/pixel.png" })] }] },
      expect: bare({ sections: [{ id: "camera", rows: [kept("shot", { kind: "tile" })] }] }),
    },
  ];
  for (const c of describing) expectEqual(`menu-words/describing ${c.name}`, cleanMenuWorld(c.world, c.opts), c.expect);

  // The limits on how much, where writing each case out would be thousands of lines: what is sent is said in words.
  const many = (n: number, at = "r") => Array.from({ length: n }, (_, i) => row(`${at}${i}`));
  const tabs = ["travel", "room", "people", "camera", "panels", "view", "scores", "achievements", "guests"];
  const counting = [
    { name: "rows_in_one_tab", sent: `one tab of ${MENU_LIMITS.rows + 5} rows`, world: { sections: [{ id: "room", rows: many(MENU_LIMITS.rows + 5) }] } },
    { name: "rows_in_all", sent: `nine tabs of 30 rows each (270)`, world: { sections: tabs.map((id) => ({ id, rows: many(30, id) })) } },
    { name: "tabs", sent: `fourteen tabs: nine every place has, three of the visitor's own, then two of the world's`, world: { sections: [...tabs, "bag", "you", "look", "one", "two"].map((id) => ({ id, label: id, rows: [] })) } },
    { name: "too_big", sent: `two hundred rows, each with ${MENU_LIMITS.copy} characters to copy`, world: { sections: tabs.map((id) => ({ id, rows: many(30, id).map((r) => ({ ...r, kind: "copy", copy: "c".repeat(MENU_LIMITS.copy) })) })) } },
  ].map((c) => {
    const got = cleanMenuWorld(c.world);
    return { name: c.name, sent: c.sent, expect: got ? { tabs: got.sections.map((s) => s.id), rows: got.sections.map((s) => s.rows.length), bytes: menuBytes(got) } : null };
  });
  expectEqual("menu-words/counting rows_in_one_tab", counting[0]!.expect && counting[0]!.expect.rows, [MENU_LIMITS.rows]);
  expectEqual("menu-words/counting rows_in_all", counting[1]!.expect && counting[1]!.expect.rows, [30, 30, 30, 30, 30, 30, 20, 0, 0]);
  expectEqual("menu-words/counting tabs", counting[2]!.expect && counting[2]!.expect.tabs, tabs);
  expectEqual("menu-words/counting too_big", counting[3]!.expect, null);

  const down: { name: string; word: unknown; expect: unknown }[] = [
    { name: "has", word: { nswp: "menu", has: true, v: 1, settings: { text: 1.2, motion: false, pins: ["room"], filesAnywhere: true, admin: true } }, expect: { what: "has", has: true, v: 1, settings: { text: 1.2, motion: false, pins: ["room"] } } },
    { name: "has_a_newer_version", word: { nswp: "menu", has: true, v: 7, settings: {} }, expect: { what: "has", has: true, v: MENU_VERSION, settings: {} } },
    { name: "has_no_version", word: { nswp: "menu", has: true, settings: {} }, expect: null },
    { name: "has_no_longer", word: { nswp: "menu", has: false }, expect: { what: "has", has: false } },
    { name: "settings", word: { nswp: "menu", settings: { sound: { music: 0.25 }, turn: 45 } }, expect: { what: "settings", settings: { sound: { music: 0.25 }, turn: 45 } } },
    { name: "settings_cant_turn_files_from_anywhere_on", word: { nswp: "menu", settings: { filesAnywhere: true, text: 1.1 } }, expect: { what: "settings", settings: { text: 1.1 } } },
    { name: "settings_can_turn_files_from_anywhere_off", word: { nswp: "menu", settings: { filesAnywhere: false } }, expect: { what: "settings", settings: { filesAnywhere: false } } },
    { name: "press", word: { nswp: "menu", press: "room-join" }, expect: { what: "press", press: "room-join" } },
    { name: "press_with_what_was_typed", word: { nswp: "menu", press: "guests-key", field: " npub1ana\n" }, expect: { what: "press", press: "guests-key", field: " npub1ana\n" } },
    { name: "press_with_too_much_typed", word: { nswp: "menu", press: "guests-key", field: "k".repeat(MENU_LIMITS.field + 1) }, expect: null },
    { name: "press_with_something_unseen_typed", word: { nswp: "menu", press: "guests-key", field: "npub1\u200bana" }, expect: null },
    { name: "press_nothing", word: { nswp: "menu", press: "" }, expect: null },
    { name: "press_with_words_for_a_file", word: { nswp: "menu", press: "panel-file", file: "a picture" }, expect: null },
    { name: "press_with_a_description_of_a_file", word: { nswp: "menu", press: "panel-file", file: { size: 70, type: "image/png", name: "dot.png" } }, expect: null },
    { name: "press_that_carries_something_to_save", word: { nswp: "menu", press: "camera-picture", save: "a picture" }, expect: null },
    { name: "open", word: { nswp: "menu", open: true }, expect: { what: "open", open: true } },
    { name: "closed", word: { nswp: "menu", open: false }, expect: { what: "open", open: false } },
    { name: "go_home", word: { nswp: "menu", go: "home" }, expect: { what: "go", go: "home" } },
    { name: "go_elsewhere", word: { nswp: "menu", go: "https://elsewhere.example/" }, expect: null },
    { name: "sign_out", word: { nswp: "menu", sign: "out" }, expect: { what: "sign", sign: "out" } },
    { name: "sign_in_is_no_word", word: { nswp: "menu", sign: "in" }, expect: null },
    { name: "sign_out_carries_nothing", word: { nswp: "menu", sign: "out", as: "npub1ana" }, expect: { what: "sign", sign: "out" } },
    { name: "own_music_playing", word: { nswp: "menu", playing: true }, expect: { what: "playing", playing: true } },
    { name: "own_music_stopped", word: { nswp: "menu", playing: false }, expect: { what: "playing", playing: false } },
    { name: "own_music_carries_nothing_else", word: { nswp: "menu", playing: true, song: "Night drive", at: 31, volume: 0.4 }, expect: { what: "playing", playing: true } },
    { name: "own_music_said_wrongly", word: { nswp: "menu", playing: "Night drive" }, expect: null },
    { name: "a_word_with_making_in_it_is_a_worlds", word: { nswp: "menu", playing: true, making: "camera-picture" }, expect: null },
    { name: "covers_a_bar_and_the_marks", word: { nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0 } }, expect: { what: "covers", covers: { top: 48, bottom: 64, left: 0, right: 0 } } },
    { name: "covers_nothing", word: { nswp: "menu", covers: { top: 0, bottom: 0, left: 0, right: 0 } }, expect: { what: "covers", covers: { top: 0, bottom: 0, left: 0, right: 0 } } },
    { name: "covers_a_bar_at_a_side", word: { nswp: "menu", covers: { top: 0, bottom: 0, left: 72, right: 0 } }, expect: { what: "covers", covers: { top: 0, bottom: 0, left: 72, right: 0 } } },
    { name: "covers_with_the_sheet_up", word: { nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0, sheet: { x: 160, y: 120, width: 780, height: 440 } } }, expect: { what: "covers", covers: { top: 48, bottom: 64, left: 0, right: 0, sheet: { x: 160, y: 120, width: 780, height: 440 } } } },
    { name: "covers_with_a_sheet_of_no_size", word: { nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0, sheet: { x: 160, y: 120, width: 0, height: 440 } } }, expect: { what: "covers", covers: { top: 48, bottom: 64, left: 0, right: 0 } } },
    { name: "covers_carries_nothing_else", word: { nswp: "menu", covers: { top: 48, bottom: 64, left: 0, right: 0, scale: 2, sheet: { x: 0, y: 0, width: 10, height: 10, tab: "bag" } } }, expect: { what: "covers", covers: { top: 48, bottom: 64, left: 0, right: 0, sheet: { x: 0, y: 0, width: 10, height: 10 } } } },
    { name: "covers_at_the_limit", word: { nswp: "menu", covers: { top: MENU_LIMITS.covers, bottom: 0, left: 0, right: MENU_LIMITS.covers } }, expect: { what: "covers", covers: { top: MENU_LIMITS.covers, bottom: 0, left: 0, right: MENU_LIMITS.covers } } },
    { name: "covers_over_the_limit", word: { nswp: "menu", covers: { top: MENU_LIMITS.covers + 1, bottom: 0, left: 0, right: 0 } }, expect: null },
    { name: "covers_less_than_nothing", word: { nswp: "menu", covers: { top: 48, bottom: -1, left: 0, right: 0 } }, expect: null },
    { name: "covers_part_of_a_pixel", word: { nswp: "menu", covers: { top: 48.5, bottom: 64, left: 0, right: 0 } }, expect: null },
    { name: "covers_with_an_edge_left_out", word: { nswp: "menu", covers: { top: 48, bottom: 64 } }, expect: null },
    { name: "covers_said_in_words", word: { nswp: "menu", covers: { top: "48px", bottom: 64, left: 0, right: 0 } }, expect: null },
    { name: "covers_with_a_sheet_over_the_limit", word: { nswp: "menu", covers: { top: 0, bottom: 0, left: 0, right: 0, sheet: { x: 0, y: 0, width: MENU_LIMITS.covers + 1, height: 10 } } }, expect: null },
    { name: "covers_with_a_sheet_that_is_no_box", word: { nswp: "menu", covers: { top: 0, bottom: 0, left: 0, right: 0, sheet: true } }, expect: null },
    { name: "covers_said_wrongly", word: { nswp: "menu", covers: 64 }, expect: null },
    { name: "a_word_with_covers_in_it_is_a_clients", word: { nswp: "menu", covers: { top: 0, bottom: 0, left: 0, right: 0 }, say: "Hello" }, expect: null },
    { name: "a_word_with_show_in_it_is_a_worlds", word: { nswp: "menu", open: true, show: "figure" }, expect: null },
    { name: "another_topic", word: { nswp: "screen", holds: true, filled: false }, expect: null },
    { name: "not_a_word", word: "menu", expect: null },
    { name: "a_worlds_word", word: { nswp: "menu", settings: { turn: 90 }, say: "Hello" }, expect: null },
  ];
  for (const c of down) expectEqual(`menu-words/down ${c.name}`, readMenuWordDown(c.word), c.expect);

  const up: { name: string; word: unknown; expect: unknown }[] = [
    { name: "world", word: { nswp: "menu", world: { title: "The Grove" } }, expect: { what: "world", world: bare({ title: "The Grove" }) } },
    { name: "world_that_is_no_description", word: { nswp: "menu", world: "The Grove" }, expect: null },
    { name: "key_summon", word: { nswp: "menu", key: "summon" }, expect: { what: "key", key: "summon" } },
    { name: "key_escape", word: { nswp: "menu", key: "escape" }, expect: { what: "key", key: "escape" } },
    { name: "key_digit", word: { nswp: "menu", key: "3" }, expect: { what: "key", key: "3" } },
    { name: "key_any_other", word: { nswp: "menu", key: "a" }, expect: null },
    { name: "key_zero", word: { nswp: "menu", key: "0" }, expect: null },
    { name: "key_as_a_number", word: { nswp: "menu", key: 3 }, expect: null },
    { name: "say", word: { nswp: "menu", say: "Saved\nto your bag." }, expect: { what: "say", say: "Saved to your bag." } },
    { name: "say_too_much", word: { nswp: "menu", say: "s".repeat(MENU_LIMITS.say + 1) }, expect: null },
    {
      name: "settings_reported",
      word: { nswp: "menu", settings: { turn: 90, hand: "left", sound: { voices: 0.5 }, pins: ["room", "bag"], filesAnywhere: true, pictures: true, models: true, chat: true, items: true, holding: { item: "37303:" + "ab".repeat(32) + ":lantern" }, full: true } },
      expect: { what: "settings", settings: { turn: 90, hand: "left", sound: { voices: 0.5 }, pins: ["room", "bag"] } },
    },
    { name: "picture_with_no_check", word: { nswp: "menu", picture: "a bitmap", id: "shot" }, expect: null },
    { name: "save_with_words_for_a_picture", word: { nswp: "menu", save: "a picture", id: "camera-picture" }, expect: null },
    { name: "save_with_a_description_of_a_picture", word: { nswp: "menu", save: { size: 2561, type: "image/jpeg" }, id: "camera-picture" }, expect: null },
    { name: "save_that_carries_a_file_down", word: { nswp: "menu", save: "a picture", id: "camera-picture", file: "a picture" }, expect: null },
    { name: "a_world_that_says_playing", word: { nswp: "menu", playing: true }, expect: null },
    { name: "a_world_that_says_playing_beside_its_own_words", word: { nswp: "menu", say: "Hello", playing: true }, expect: null },
    { name: "making_what_was_pressed_for", word: { nswp: "menu", making: "camera-picture" }, expect: { what: "making", id: "camera-picture" } },
    { name: "making_for_no_row", word: { nswp: "menu", making: "" }, expect: null },
    { name: "making_with_a_row_that_is_no_id", word: { nswp: "menu", making: "a row" }, expect: null },
    { name: "a_key_with_covers_in_it_is_a_clients", word: { nswp: "menu", key: "summon", covers: { top: 0, bottom: 0, left: 0, right: 0 } }, expect: null },
    { name: "show_a_tab", word: { nswp: "menu", show: "figure" }, expect: { what: "show", show: "figure" } },
    { name: "show_a_tab_of_the_worlds_own", word: { nswp: "menu", show: "shop" }, expect: { what: "show", show: "shop" } },
    { name: "show_a_tab_no_client_has", word: { nswp: "menu", show: "no-such-tab" }, expect: { what: "show", show: "no-such-tab" } },
    { name: "show_with_no_tab_named", word: { nswp: "menu", show: "" }, expect: { what: "show" } },
    { name: "show_that_is_no_id", word: { nswp: "menu", show: "your look" }, expect: { what: "show" } },
    { name: "show_that_is_not_words", word: { nswp: "menu", show: true }, expect: { what: "show" } },
    { name: "show_with_something_unseen_in_it", word: { nswp: "menu", show: "fig\u200bure" }, expect: { what: "show" } },
    { name: "a_show_with_open_in_it_is_a_clients", word: { nswp: "menu", show: "figure", open: true }, expect: null },
    { name: "show_carries_nothing_but_the_id", word: { nswp: "menu", show: "figure", row: "big", again: 5, hold: true }, expect: { what: "show", show: "figure" } },
    { name: "show_is_not_the_summons", word: { nswp: "menu", key: "summon", show: "figure" }, expect: { what: "key", key: "summon" } },
    { name: "a_clients_word", word: { nswp: "menu", has: true, v: 1, settings: {} }, expect: null },
  ];
  for (const c of up) expectEqual(`menu-words/up ${c.name}`, readMenuWordUp(c.word), c.expect);

  const here = [
    { name: "speaks_them", here: { nswp: "here", at: "/", menu: 1 }, expect: 1 },
    { name: "speaks_a_newer_version", here: { nswp: "here", at: "/", menu: 4 }, expect: MENU_VERSION },
    { name: "says_nothing_of_it", here: { nswp: "here", at: "/" }, expect: 0 },
    { name: "says_it_wrongly", here: { nswp: "here", at: "/", menu: "1" }, expect: 0 },
  ];
  for (const c of here) expectEqual(`menu-words/here ${c.name}`, menuVersionOf(c.here), c.expect);
  expectEqual("menu-words/nothing above a world turns files from anywhere on", [cleanMenuSettings({ filesAnywhere: true }), cleanMenuSettings({ filesAnywhere: "yes" }), cleanMenuSettings({ filesAnywhere: false })], [{}, {}, { filesAnywhere: false }]);
  expectEqual("menu-words/reported nothing private", reportedSettings({ filesAnywhere: false, pictures: false, models: false, chat: false, items: false, holding: "", full: true, intense: true }), { intense: true });

  files["menu-words.json"] = {
    description:
      "The client has the menu (protocol/02-doors.md, \"The client has the menu\"): the words between a world in a frame and the page above it that draws the visitor's console. `describing`: what a client keeps of each `world` a framed page sends as `{ nswp: \"menu\", world }` (`opts.own`: the page is of the client's own origin; `opts.also`: visitor's tabs this client still takes from a world), or null. `counting`: the limits on how much, with what was sent said in words and what was kept as counts. `down`: what a world makes of each word from the page above. `up`: what a client makes of each word from the page in its frame. `here`: the version spoken with a world, from its `here`: the lower of the two, or 0. The rules: a client's settings are cleaned as a link's are, so `filesAnywhere: true` is dropped from them (that switch is turned on only by the visitor's own press on the world's own row) and `false` is taken; one word says one thing, and a word with anything in it that only the other side says is not read; a client may tell a world to sign the visitor out (`sign: \"out\"`), which carries nothing and can only take away, and there is no word for signing in; `state.signIn` is one of `signIn`, a fact the client words its own row from; nothing is run and every word is text; what is unknown, over a limit or not the world's to say is left out, never cut to fit or mended; in a tab both fill (`tabs.world` has them all; Sound, Help and Moving among them) a client draws its own rows first and the world's below, under the world's name; a line has anything unseen made a space and its ends trimmed; text to copy and text typed are carried whole or not at all; characters are counted as code points, and bytes as the UTF-8 of the JSON without pictures. `cardPicture` is what comes before a tab's id where a picture is for the card at that tab's head, and no row's id may begin with it. No picture is in these examples: JSON has none, and a reader with no check for them keeps none. A press may carry a file the visitor chose (`file`), and a world may hand a picture or a clip up to be saved (`save`); a file is not something this page can hold, so only what is refused for not being one is here, and the rest is in the core's tests.",
    version: MENU_VERSION,
    limits: MENU_LIMITS,
    waits: { MENU_WAIT_MS, LEAVE_MS, MENU_SAVE_MS, MENU_MAKING_MS, MENU_SHOW_KEEP_MS },
    fileKinds: MENU_FILE_KINDS,
    saveTypes: MENU_SAVE_TYPES,
    tabs: { visitor: MENU_VISITOR_TABS, world: MENU_WORLD_TABS },
    keys: MENU_KEYS,
    cardPicture: MENU_CARD_PICTURE,
    signIn: MENU_SIGN_IN,
    reported: MENU_REPORTED,
    describing,
    counting,
    down,
    up,
    here,
  };
}

// Every expectation above is checked here, last, so that none can be added below a check and never be looked at.
// (Until 2026-11-23 the only check stood partway up this file: everything after it could disagree and still be written.)
if (failures.length) {
  console.error(`@nswp/core disagrees with ${failures.length} vector expectation(s):\n\n${failures.join("\n\n")}`);
  process.exit(1);
}

// ---- Rooms (protocol/06-rooms.md): the lobbies a world's default room fills, one at a time, and where they meet.
{
  const world = "https://grove.example/";
  const lobbies = [1, 2, 3, 32].map((n) => ({ n, name: lobbyName(n), topic: roomTopic(world, lobbyName(n)!) }));
  expectEqual("rooms/lobby names", lobbies.map((l) => l.name), ["lobby", "lobby-2", "lobby-3", "lobby-32"]);
  expectEqual("rooms/no lobby past the last", [0, 33].map(lobbyName), [null, null]);
  files["rooms.json"] = {
    description:
      "Rooms (protocol/06-rooms.md). `lobbies`: the names a world's default room fills one at a time, \"lobby\" then \"lobby-2\" and on, at most `lobbiesMost`, each with its topic for the world at `world` (the SHA-256 of \"nswp/room/spike-1\", the world's origin and path, and the name, on three lines). `noLobby`: numbers that name none. `full`: what a member of a full room sends someone joining it, before it is encrypted to them as any message to one member is. `relays`: where the kit's rooms meet when a world names none.",
    world,
    lobbiesMost: ROOM_LIMITS.lobbies,
    lobbies,
    noLobby: [0, 33],
    full: { t: "full" },
    relays: [...ROOM_RELAYS],
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
