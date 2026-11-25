/** World manifests at /.well-known/nswp.json and origin verification (spec §7). */
import { LIMITS, MODES, parseKitVersion, SCHEMAS, WELL_KNOWN_PATH, WORLD_KIND } from "./constants.js";
import { isHttpsUrl, isWssUrl, normalizeUrl } from "./destination.js";
import { isHex64 } from "./event.js";
import { encodeNaddr } from "./nip19.js";
import { ACCESS_MOST } from "./listing.js";
import { OWNER_LIST_LIMITS } from "./owner-lists.js";

/** The most keys whose lists count for one world. */
export const KEEPERS_MOST = OWNER_LIST_LIMITS.root;
import { cleanListing, listingSeller } from "./receipt.js";
import { Collector, isPlainObject, NswpError, type Issue, type Result } from "./result.js";
import type { World } from "./world.js";

/** Above this many megabytes, a world's first download is a lot to ask (spec §10.1, "Budgets": "initial world download warned above 50 MB"). */
export const DOWNLOAD_WARN_MB = 50;

/**
 * How big a world says its first download is, for an Airlock to say before the visitor crosses
 * (protocol/02-doors.md, "What an Airlock does"): `mb`, the words to show, and `heavy` above `DOWNLOAD_WARN_MB`.
 * It is the world's own claim, from its manifest's `budgets.initial_download_mb`, and nothing here checks it: the
 * words say so. Null where the world says nothing, or something that isn't a size.
 */
export function worldDownload(world: Pick<ManifestWorld, "budgets"> | null | undefined): { mb: number; words: string; heavy: boolean } | null {
  const mb = world?.budgets?.initialDownloadMb;
  if (typeof mb !== "number" || !Number.isFinite(mb) || mb < 0) return null;
  const size = mb < 1 ? "less than 1 MB" : mb < 10 ? `about ${Math.round(mb * 10) / 10} MB` : mb < 1000 ? `about ${Math.round(mb)} MB` : `about ${Math.round(mb / 100) / 10} GB`;
  const heavy = mb > DOWNLOAD_WARN_MB;
  return { mb, words: `The world says ${size} to download${heavy ? ": a lot on a phone's data" : ""}`, heavy };
}

export interface ManifestWorld {
  entry: { url: string; modes: string[] };
  entryPoints: string[];
  capabilities: string[];
  /**
   * What it draws of people's looks (protocol/05-looks.md, "A model of your own"): the model formats it draws
   * (`vrm`, `glb`; none, and everyone is drawn as their simple look), how heavy and how tall it lets one be, and
   * `dress: "own"` where it dresses everyone itself and draws nobody's look.
   */
  avatar?: { formats: string[]; maxFileSizeMb?: number; maxTriangles?: number; height?: [number, number]; dress?: "own" };
  multiplayer?: { endpoint: string; auth?: string };
  budgets?: { initialDownloadMb?: number };
  airlock?: string;
  /**
   * The listings this world is entered by, where it is paid (protocol/01-worlds.md, "A paid world"): each one a
   * listing's coordinate whose seller is a key this file names as a publisher of this world. Left out, it is free.
   */
  access?: string[];
  /**
   * Whose lists count for this world (protocol/10-identity.md, "A world's own lists"): at most four keys. Left out,
   * the world's publishers in this file; but a world that writes neither this nor a word that needs a list reads no
   * list at all.
   */
  keepers?: string[];
  /** In this world's rooms a visitor's kit shows and hears only people whose pass checks out: no guests. */
  namedOnly?: boolean;
  /**
   * Whether guest accounts may come in (protocol/10-identity.md, "A guest"). Left out, they may: only `false` is ever
   * kept. Where false, someone whose pass is a guest account's is not shown, heard or answered in its rooms.
   */
  guests?: false;
  /** Only people a keeper's allow list names (and the keepers) may go in; its rooms show only them. */
  byInvitation?: boolean;
}

export interface Manifest {
  schema: string;
  listing: "allow" | "deny";
  publishers: Record<string, { worlds: string[] }>;
  worlds: Record<string, ManifestWorld>;
  relays: string[];
  /** The version of the kit the site was built with, when it says. Its own word, and only ever something to tell someone. */
  kit?: string;
}

const stringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const ENTRY_POINT = /^[A-Za-z0-9._-]{1,128}$/;

export function wellKnownUrl(urlOrOrigin: string): string {
  return new URL(WELL_KNOWN_PATH, new URL(urlOrOrigin).origin).href;
}

/** Validate a parsed manifest. Pass `byteLength` when you have the raw body. */
export function parseManifest(input: unknown, opts: { byteLength?: number } = {}): Result<Manifest> {
  const c = new Collector();
  if (opts.byteLength !== undefined && opts.byteLength > LIMITS.manifestBytes) {
    c.error("manifest_too_large", "", `Manifests are limited to ${LIMITS.manifestBytes} bytes.`);
  }
  if (!isPlainObject(input)) {
    c.error("not_an_object", "", "The manifest must be a JSON object.");
    return c.result(null as never);
  }
  const schema = input.schema;
  if (typeof schema !== "string" || !schema.startsWith("nswp/manifest/")) {
    c.error("schema_mismatch", "schema", `schema must be "${SCHEMAS.manifest}".`);
  } else if (schema !== SCHEMAS.manifest) {
    c.warn("schema_version", "schema", `Manifest declares ${schema}; this library implements ${SCHEMAS.manifest}.`);
  }

  let listing: Manifest["listing"] = "allow";
  if (input.listing !== undefined) {
    if (input.listing === "allow" || input.listing === "deny") listing = input.listing;
    else c.warn("unknown_value", "listing", 'listing must be "allow" or "deny"; treating as "allow".');
  }

  const publishers: Manifest["publishers"] = {};
  if (!isPlainObject(input.publishers)) {
    c.error("missing_field", "publishers", "publishers must be an object keyed by hex pubkey.");
  } else {
    for (const [pk, v] of Object.entries(input.publishers)) {
      if (!isHex64(pk)) {
        c.error("invalid_pubkey", `publishers.${pk}`, "Publisher keys must be 64 lowercase hex characters.");
        continue;
      }
      if (!isPlainObject(v) || !stringArray(v.worlds)) {
        c.error("invalid_field", `publishers.${pk}.worlds`, "Each publisher needs a worlds array of world IDs.");
        continue;
      }
      publishers[pk] = { worlds: v.worlds };
    }
  }

  const worlds: Manifest["worlds"] = {};
  if (!isPlainObject(input.worlds)) {
    c.error("missing_field", "worlds", "worlds must be an object keyed by world ID.");
  } else {
    for (const [id, raw] of Object.entries(input.worlds)) {
      const p = `worlds.${id}`;
      if (!isPlainObject(raw) || !isPlainObject(raw.entry) || !isHttpsUrl(raw.entry.url)) {
        c.error("invalid_entry", `${p}.entry.url`, "Each world needs entry.url as an https URL.");
        continue;
      }
      const modes = stringArray(raw.entry.modes) ? raw.entry.modes : [];
      for (const m of modes) if (!(MODES as readonly string[]).includes(m)) c.warn("unknown_value", `${p}.entry.modes`, `Unknown mode "${m}".`);
      const w: ManifestWorld = {
        entry: { url: normalizeUrl(raw.entry.url as string)!, modes },
        entryPoints: [],
        capabilities: stringArray(raw.capabilities) ? raw.capabilities : [],
      };
      if (raw.entry_points !== undefined) {
        if (!stringArray(raw.entry_points)) c.warn("invalid_field", `${p}.entry_points`, "entry_points must be an array of strings.");
        else {
          for (const ep of raw.entry_points) {
            if (ENTRY_POINT.test(ep)) w.entryPoints.push(ep);
            else c.warn("invalid_entry_point", `${p}.entry_points`, `Entry point "${ep}" may only use letters, digits, ".", "_" and "-".`);
          }
        }
      }
      if (isPlainObject(raw.avatar)) {
        const a = raw.avatar;
        w.avatar = { formats: stringArray(a.formats) ? a.formats : [] };
        if (typeof a.max_file_size_mb === "number") w.avatar.maxFileSizeMb = a.max_file_size_mb;
        if (typeof a.max_triangles === "number") w.avatar.maxTriangles = a.max_triangles;
        if (Array.isArray(a.height) && a.height.length === 2 && a.height.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0) && (a.height[0] as number) <= (a.height[1] as number)) w.avatar.height = [a.height[0] as number, a.height[1] as number];
        else if (a.height !== undefined) c.warn("invalid_field", `${p}.avatar.height`, "avatar.height must be [least, most] in metres; ignored.");
        if (a.dress === "own") w.avatar.dress = "own";
        else if (a.dress !== undefined) c.warn("invalid_field", `${p}.avatar.dress`, 'avatar.dress may only be "own"; ignored.');
      }
      if (raw.multiplayer !== undefined) {
        if (isPlainObject(raw.multiplayer) && isWssUrl(raw.multiplayer.endpoint)) {
          w.multiplayer = { endpoint: raw.multiplayer.endpoint as string };
          if (typeof raw.multiplayer.auth === "string") w.multiplayer.auth = raw.multiplayer.auth;
        } else c.warn("invalid_field", `${p}.multiplayer.endpoint`, "multiplayer.endpoint must be a wss URL; ignored.");
      }
      if (isPlainObject(raw.budgets) && typeof raw.budgets.initial_download_mb === "number") {
        w.budgets = { initialDownloadMb: raw.budgets.initial_download_mb };
      }
      if (raw.airlock !== undefined) {
        if (isHttpsUrl(raw.airlock)) w.airlock = raw.airlock;
        else c.warn("url_not_https", `${p}.airlock`, "airlock must be an https URL; ignored.");
      }
      if (raw.access !== undefined) {
        if (!stringArray(raw.access)) c.warn("invalid_field", `${p}.access`, "access must be an array of listing coordinates; ignored.");
        else {
          const access: string[] = [];
          for (const said of raw.access) {
            const listing = cleanListing(said);
            if (!listing) c.warn("invalid_listing", `${p}.access`, "Ignoring an access entry that is not a listing's coordinate (30078:<pubkey>:<name>).");
            // Nobody puts a price on a world that isn't theirs: its seller is a key this file lets announce it.
            else if (!publishers[listingSeller(listing)]?.worlds.includes(id)) c.warn("access_not_own", `${p}.access`, "Ignoring an access listing sold by a key that isn't a publisher of this world.");
            else if (access.includes(listing)) continue;
            else if (access.length >= ACCESS_MOST) c.warn("too_many_listings", `${p}.access`, `Only the first ${ACCESS_MOST} access listings are used.`);
            else access.push(listing);
          }
          if (access.length) w.access = access;
        }
      }
      if (raw.keepers !== undefined) {
        const said = Array.isArray(raw.keepers) ? raw.keepers : [];
        const keepers = [...new Set(said.filter(isHex64))];
        if (!Array.isArray(raw.keepers) || keepers.length !== said.length) c.warn("invalid_keeper", `${p}.keepers`, "keepers must be a list of 64 lowercase hex keys; anything else is left out.");
        if (keepers.length > KEEPERS_MOST) c.warn("too_many_keepers", `${p}.keepers`, `Only the first ${KEEPERS_MOST} keepers are used.`);
        if (keepers.length) w.keepers = keepers.slice(0, KEEPERS_MOST);
      }
      if (raw.by_invitation !== undefined) {
        // Only exactly `true`: this is the word that shuts a world, and one that can't be read never quietly does.
        if (raw.by_invitation === true) w.byInvitation = true;
        else if (raw.by_invitation !== false) c.warn("invalid_field", `${p}.by_invitation`, "by_invitation must be true or false; ignored.");
      }
      if (raw.guests !== undefined) {
        // Only exactly `false` keeps guests out: a word that can't be read never quietly shuts anyone out.
        if (raw.guests === false) w.guests = false;
        else if (raw.guests !== true) c.warn("invalid_field", `${p}.guests`, "guests must be true or false; ignored.");
      }
      if (raw.named_only !== undefined) {
        // Only exactly `true` turns it on: a word that can't be read is never quietly taken as a rule, either way.
        if (raw.named_only === true) w.namedOnly = true;
        else if (raw.named_only !== false) c.warn("invalid_field", `${p}.named_only`, "named_only must be true or false; ignored.");
      }
      worlds[id] = w;
    }
  }

  const relays: string[] = [];
  if (input.relays !== undefined) {
    if (!stringArray(input.relays)) c.warn("invalid_field", "relays", "relays must be an array of wss URLs.");
    else for (const r of input.relays) isWssUrl(r) ? relays.push(r) : c.warn("invalid_relay", "relays", `Ignoring relay "${r}" (not wss).`);
  }

  let kit: string | undefined;
  if (input.kit !== undefined) {
    if (parseKitVersion(input.kit)) kit = input.kit as string;
    else c.warn("invalid_field", "kit", "kit must be a version such as \"0.21.0\"; ignoring it.");
  }

  return c.result({ schema: typeof schema === "string" ? schema : SCHEMAS.manifest, listing, publishers, worlds, relays, ...(kit ? { kit } : {}) });
}

export interface VerificationCheck {
  name: "same_origin" | "publisher_listed" | "world_listed" | "entry_url_matches";
  ok: boolean;
  message: string;
}

export interface Verification {
  verified: boolean;
  checks: VerificationCheck[];
}

/**
 * Is this announcement verified for its origin? All four rules in spec §7.3
 * must hold. `manifestUrl` is where the manifest was actually fetched from.
 */
export function verifyOrigin(world: World, manifest: Manifest, manifestUrl: string): Verification {
  const checks: VerificationCheck[] = [];
  let entryOrigin: string | null = null;
  try {
    entryOrigin = new URL(world.url).origin;
  } catch {
    /* handled below */
  }
  const fetchedFrom = (() => {
    try {
      return new URL(manifestUrl);
    } catch {
      return null;
    }
  })();
  const sameOrigin = !!entryOrigin && !!fetchedFrom && fetchedFrom.origin === entryOrigin && fetchedFrom.pathname === WELL_KNOWN_PATH;
  checks.push({
    name: "same_origin",
    ok: sameOrigin,
    message: sameOrigin ? `Manifest fetched from ${entryOrigin}${WELL_KNOWN_PATH}.` : "The manifest was not fetched from the world's own well-known path.",
  });
  const pub = world.pubkey ? manifest.publishers[world.pubkey] : undefined;
  checks.push({
    name: "publisher_listed",
    ok: !!pub,
    message: pub ? "The origin lists this publisher key." : "The origin does not list this publisher key.",
  });
  const listed = !!pub && pub.worlds.includes(world.d);
  checks.push({
    name: "world_listed",
    ok: listed,
    message: listed ? `World "${world.d}" is listed for this publisher.` : `World "${world.d}" is not listed for this publisher.`,
  });
  const mw = manifest.worlds[world.d];
  const urlMatch = !!mw && normalizeUrl(mw.entry.url) === normalizeUrl(world.url);
  checks.push({
    name: "entry_url_matches",
    ok: urlMatch,
    message: urlMatch ? "Entry URL matches the manifest." : "The announcement's entry URL differs from the manifest's.",
  });
  return { verified: checks.every((ch) => ch.ok), checks };
}

/**
 * The door to a world as its own site names it: the announcement its manifest
 * lists for this address, and the address. A world uses it to send a visitor
 * back to itself through their own client, which checks it like any other
 * door. With no announcement for the address, or more than one publisher
 * claiming it, the door is the address alone.
 */
export function doorFor(manifest: Manifest, url: string): { naddr?: string; url: string } {
  const here = normalizeUrl(url);
  const d = Object.keys(manifest.worlds).find((id) => normalizeUrl(manifest.worlds[id]!.entry.url) === here);
  const publishers = d === undefined ? [] : Object.keys(manifest.publishers).filter((key) => manifest.publishers[key]!.worlds.includes(d));
  if (d === undefined || publishers.length !== 1) return { url };
  return { naddr: encodeNaddr({ kind: WORLD_KIND, pubkey: publishers[0]!, identifier: d, relays: manifest.relays.slice(0, 2) }), url };
}

/**
 * What the world at an address is entered by, as its own site says: the listings its manifest names for it, and the
 * keys that may sell it (its publishers). A world its manifest names no listing for is free: `listings` is empty.
 * Null where the manifest lists no world at that address at all, so nothing can be said of it.
 */
export function accessFor(manifest: Manifest, url: string): { d: string; listings: string[]; sellers: string[]; keepers: string[] | null; namedOnly: boolean; byInvitation: boolean; guests: boolean } | null {
  const here = normalizeUrl(url);
  const d = Object.keys(manifest.worlds).find((id) => normalizeUrl(manifest.worlds[id]!.entry.url) === here);
  if (d === undefined) return null;
  const sellers = Object.keys(manifest.publishers).filter((key) => manifest.publishers[key]!.worlds.includes(d));
  const w = manifest.worlds[d]!;
  return { d, listings: [...(w.access ?? [])], sellers, keepers: w.keepers ? [...w.keepers] : null, namedOnly: w.namedOnly === true, byInvitation: w.byInvitation === true, guests: w.guests !== false };
}

export interface FetchManifestResult {
  url: string;
  manifest?: Manifest;
  issues: Issue[];
  warnings: Issue[];
  /** Only knowable outside a browser (in a browser a missing header makes the fetch fail). */
  corsHeader?: string | null;
}

/**
 * Fetch and validate an origin's manifest following spec §7.1: HTTPS only,
 * no redirects, size limit. Never throws for HTTP problems; they become issues.
 */
export async function fetchManifest(urlOrOrigin: string, fetchImpl: typeof fetch = fetch, timeoutMs = 8000): Promise<FetchManifestResult> {
  const url = wellKnownUrl(urlOrOrigin);
  const issues: Issue[] = [];
  const issue = (code: string, message: string) => issues.push({ code, path: "manifest", message });
  if (!url.startsWith("https://")) {
    issue("url_not_https", "Manifests are only fetched over https.");
    return { url, issues, warnings: [] };
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { redirect: "error", signal: ctl.signal, headers: { accept: "application/json" }, credentials: "omit" });
    const corsHeader = res.headers.get("access-control-allow-origin");
    if (!res.ok) {
      issue(res.status === 404 ? "manifest_not_found" : "manifest_http_error", `The manifest request returned HTTP ${res.status}.`);
      return { url, issues, warnings: [], corsHeader };
    }
    if (res.type === "opaqueredirect" || res.redirected) {
      issue("manifest_redirected", "The manifest URL redirected; redirects are not followed.");
      return { url, issues, warnings: [], corsHeader };
    }
    const text = await res.text();
    const byteLength = new TextEncoder().encode(text).length;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      issue("manifest_not_json", "The manifest is not valid JSON.");
      return { url, issues, warnings: [], corsHeader };
    }
    const parsed = parseManifest(json, { byteLength });
    if (!parsed.ok) return { url, issues: [...issues, ...parsed.errors], warnings: parsed.warnings, corsHeader };
    const warnings = [...parsed.warnings];
    if (corsHeader !== null && corsHeader !== "*") {
      warnings.push({ code: "cors_restricted", path: "manifest", message: `Access-Control-Allow-Origin is "${corsHeader}"; it should be "*".` });
    }
    return { url, manifest: parsed.value, issues, warnings, corsHeader };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    issue(
      aborted ? "manifest_timeout" : "manifest_unreachable",
      aborted
        ? "The manifest request timed out."
        : "The manifest could not be fetched (offline, redirected, or missing Access-Control-Allow-Origin: *).",
    );
    return { url, issues, warnings: [] };
  } finally {
    clearTimeout(timer);
  }
}

export function assertManifest(input: unknown): Manifest {
  const r = parseManifest(input);
  if (!r.ok) throw new NswpError("manifest_invalid", r.errors.map((e) => e.message).join(" "), { details: { errors: r.errors } });
  return r.value;
}
