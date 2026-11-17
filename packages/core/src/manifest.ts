/** World manifests at /.well-known/nswp.json and origin verification (spec §7). */
import { LIMITS, MODES, SCHEMAS, WELL_KNOWN_PATH } from "./constants.js";
import { isHttpsUrl, isWssUrl, normalizeUrl } from "./destination.js";
import { isHex64 } from "./event.js";
import { Collector, isPlainObject, NswpError, type Issue, type Result } from "./result.js";
import type { World } from "./world.js";

export interface ManifestWorld {
  entry: { url: string; modes: string[] };
  entryPoints: string[];
  capabilities: string[];
  avatar?: { formats: string[]; maxFileSizeMb?: number; maxTriangles?: number };
  multiplayer?: { endpoint: string; auth?: string };
  budgets?: { initialDownloadMb?: number };
  airlock?: string;
}

export interface Manifest {
  schema: string;
  listing: "allow" | "deny";
  publishers: Record<string, { worlds: string[] }>;
  worlds: Record<string, ManifestWorld>;
  relays: string[];
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
      worlds[id] = w;
    }
  }

  const relays: string[] = [];
  if (input.relays !== undefined) {
    if (!stringArray(input.relays)) c.warn("invalid_field", "relays", "relays must be an array of wss URLs.");
    else for (const r of input.relays) isWssUrl(r) ? relays.push(r) : c.warn("invalid_relay", "relays", `Ignoring relay "${r}" (not wss).`);
  }

  return c.result({ schema: typeof schema === "string" ? schema : SCHEMAS.manifest, listing, publishers, worlds, relays });
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
