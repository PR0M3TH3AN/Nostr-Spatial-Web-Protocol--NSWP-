/** Spatial World Announcements (spec §5). */
import {
  CAPABILITIES,
  COMFORT,
  INPUTS,
  LIMITS,
  MODES,
  PERF_TIERS,
  STATUSES,
  WELL_KNOWN_PATH,
  WORLD_KIND,
} from "./constants.js";
import { isHttpsUrl, normalizeUrl } from "./destination.js";
import { getTags, hasEventShape, isHex64, nowSeconds, type EventTemplate } from "./event.js";
import { coordinate, parseCoordinate } from "./nip19.js";
import { Collector, type Result } from "./result.js";

export interface WorldComfort {
  locomotion?: string;
  intensity?: string;
  seated?: string;
}

export interface WorldInput {
  d: string;
  title: string;
  url: string;
  summary?: string;
  description?: string;
  image?: { url: string; dimensions?: string };
  modes?: string[];
  capabilities?: string[];
  comfort?: WorldComfort;
  inputs?: string[];
  perf?: string;
  topics?: string[];
  /** ISO-639-1 codes. */
  languages?: string[];
  /** `true` for a warning with no reason. */
  contentWarning?: string | true;
  status?: string;
  /** Only when the manifest is not at the well-known path (it then can't verify). */
  manifest?: string;
  coCreators?: string[];
  /** Coordinate of an access product, e.g. a BitUnlock product (`30078:<pubkey>:<d>`). */
  access?: string;
  createdAt?: number;
}

export interface World {
  /** `37300:<pubkey>:<d>` when the event has a pubkey. */
  coordinate?: string;
  pubkey?: string;
  d: string;
  title: string;
  url: string;
  summary?: string;
  description: string;
  image?: { url: string; dimensions?: string };
  modes: string[];
  capabilities: string[];
  comfort: WorldComfort;
  inputs: string[];
  perf?: string;
  topics: string[];
  languages: string[];
  contentWarning?: string;
  status: string;
  manifest?: string;
  coCreators: string[];
  access?: string;
  createdAt: number;
}

/** Build an unsigned world announcement, tag-first (spec §5.2). */
export function buildWorldEvent(w: WorldInput): EventTemplate {
  const tags: string[][] = [
    ["d", w.d],
    ["title", w.title],
  ];
  if (w.summary) tags.push(["summary", w.summary]);
  tags.push(["r", w.url]);
  if (w.image) tags.push(w.image.dimensions ? ["image", w.image.url, w.image.dimensions] : ["image", w.image.url]);
  for (const m of w.modes ?? []) tags.push(["mode", m]);
  for (const c of w.capabilities ?? []) tags.push(["capability", c]);
  for (const key of ["locomotion", "intensity", "seated"] as const) {
    const v = w.comfort?.[key];
    if (v) tags.push(["comfort", key, v]);
  }
  for (const i of w.inputs ?? []) tags.push(["input", i]);
  if (w.perf) tags.push(["perf", w.perf]);
  for (const t of w.topics ?? []) tags.push(["t", t.toLowerCase()]);
  if (w.languages?.length) {
    tags.push(["L", "ISO-639-1"]);
    for (const l of w.languages) tags.push(["l", l, "ISO-639-1"]);
  }
  if (w.contentWarning !== undefined) tags.push(w.contentWarning === true ? ["content-warning"] : ["content-warning", w.contentWarning]);
  if (w.status) tags.push(["status", w.status]);
  if (w.manifest) tags.push(["manifest", w.manifest]);
  for (const p of w.coCreators ?? []) tags.push(["p", p, "", "co-creator"]);
  if (w.access) tags.push(["a", w.access, "", "access"]);
  tags.push(["alt", `Spatial world listing: ${w.title}`]);
  return { kind: WORLD_KIND, created_at: w.createdAt ?? nowSeconds(), tags, content: w.description ?? "" };
}

function single(c: Collector, tags: string[][], name: string, required: boolean): string | undefined {
  const found = tags.filter((t) => t[0] === name);
  if (found.length === 0) {
    if (required) c.error("missing_tag", `tags.${name}`, `Required tag "${name}" is missing.`);
    return undefined;
  }
  if (found.length > 1) c.error("duplicate_tag", `tags.${name}`, `Tag "${name}" must appear once, found ${found.length}.`);
  const v = found[0]![1];
  if (v === undefined || v === "") {
    c.error("empty_tag", `tags.${name}`, `Tag "${name}" has no value.`);
    return undefined;
  }
  return v;
}

function enumValues(c: Collector, tags: string[][], name: string, allowed: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of getTags({ tags }, name)) {
    const v = t[1];
    if (!v) continue;
    if (!allowed.includes(v)) c.warn("unknown_value", `tags.${name}`, `Unknown ${name} "${v}" (ignored by clients that don't know it).`);
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export interface ParseWorldOptions {
  /** Require `id`, `pubkey` and `sig` fields (signature itself is checked by `verifyEvent`). */
  requireSigned?: boolean;
}

/** Validate a world announcement and return its structured form. */
export function parseWorldEvent(input: unknown, opts: ParseWorldOptions = {}): Result<World> {
  const c = new Collector();
  if (typeof input !== "object" || input === null) {
    c.error("not_an_event", "", "Expected a Nostr event object.");
    return c.result(null as never);
  }
  const e = input as Partial<EventTemplate> & { pubkey?: unknown };
  if (e.kind !== WORLD_KIND) c.error("wrong_kind", "kind", `Expected kind ${WORLD_KIND}, got ${String(e.kind)}.`);
  if (!Array.isArray(e.tags) || !e.tags.every((t) => Array.isArray(t) && t.every((x) => typeof x === "string"))) {
    c.error("invalid_tags", "tags", "tags must be an array of string arrays.");
    return c.result(null as never);
  }
  if (typeof e.content !== "string") c.error("invalid_content", "content", "content must be a string.");
  if (!Number.isInteger(e.created_at)) c.error("invalid_created_at", "created_at", "created_at must be an integer.");
  if (opts.requireSigned && !hasEventShape(input)) c.error("not_signed", "", "Expected a signed event with id, pubkey and sig.");
  const pubkey = isHex64(e.pubkey) ? e.pubkey : undefined;
  if (e.pubkey !== undefined && !pubkey) c.error("invalid_pubkey", "pubkey", "pubkey must be 64 lowercase hex characters.");
  const tags = e.tags;

  const d = single(c, tags, "d", true);
  if (d && d.length > LIMITS.maxIdLength) c.error("value_too_long", "tags.d", `d must be at most ${LIMITS.maxIdLength} characters.`);
  const title = single(c, tags, "title", true);
  if (title && title.length > LIMITS.maxTitleLength) c.warn("value_too_long", "tags.title", "title is unusually long.");
  const url = single(c, tags, "r", true);
  if (url && !isHttpsUrl(url)) c.error("url_not_https", "tags.r", "The entry URL (r) must be an https URL.");
  single(c, tags, "alt", true);
  const summary = single(c, tags, "summary", false);

  let image: World["image"];
  const imageTags = getTags({ tags }, "image");
  if (imageTags.length > 1) c.warn("duplicate_tag", "tags.image", "Only the first image tag is used.");
  if (imageTags[0]?.[1]) {
    if (isHttpsUrl(imageTags[0][1])) image = imageTags[0][2] ? { url: imageTags[0][1], dimensions: imageTags[0][2] } : { url: imageTags[0][1] };
    else c.warn("url_not_https", "tags.image", "The preview image must be an https URL; ignored.");
  }

  const modes = enumValues(c, tags, "mode", MODES);
  const capabilities = enumValues(c, tags, "capability", CAPABILITIES);
  const inputs = enumValues(c, tags, "input", INPUTS);

  const comfort: WorldComfort = {};
  for (const t of getTags({ tags }, "comfort")) {
    const [, key, value] = t;
    if (!key || !value) {
      c.warn("malformed_tag", "tags.comfort", "comfort tags need a key and a value.");
      continue;
    }
    if (!(key in COMFORT)) {
      c.warn("unknown_value", "tags.comfort", `Unknown comfort key "${key}".`);
      continue;
    }
    const k = key as keyof typeof COMFORT;
    if (comfort[k] !== undefined) {
      c.error("duplicate_tag", `tags.comfort.${k}`, `comfort ${k} must appear once.`);
      continue;
    }
    if (!(COMFORT[k] as readonly string[]).includes(value)) c.warn("unknown_value", `tags.comfort.${k}`, `Unknown ${k} value "${value}".`);
    comfort[k] = value;
  }

  const perf = single(c, tags, "perf", false);
  if (perf && !(PERF_TIERS as readonly string[]).includes(perf)) c.warn("unknown_value", "tags.perf", `Unknown perf tier "${perf}".`);

  const status = single(c, tags, "status", false) ?? "live";
  if (!(STATUSES as readonly string[]).includes(status)) c.warn("unknown_value", "tags.status", `Unknown status "${status}".`);

  const topics = [...new Set(getTags({ tags }, "t").map((t) => (t[1] ?? "").toLowerCase()).filter(Boolean))];

  const namespaces = new Set(getTags({ tags }, "L").map((t) => t[1]));
  const languages: string[] = [];
  for (const t of getTags({ tags }, "l")) {
    const [, value, ns] = t;
    if (!value) continue;
    if (!ns || !namespaces.has(ns)) c.warn("label_namespace_missing", "tags.l", `Label "${value}" has no matching L namespace tag (NIP-32).`);
    if (ns === "ISO-639-1") languages.push(value);
  }

  const cw = getTags({ tags }, "content-warning")[0];
  const contentWarning = cw ? (cw[1] ?? "") : undefined;

  const manifest = single(c, tags, "manifest", false);
  if (manifest) {
    if (!isHttpsUrl(manifest)) c.warn("url_not_https", "tags.manifest", "The manifest tag must be an https URL; ignored.");
    else if (new URL(manifest).pathname !== WELL_KNOWN_PATH) {
      c.warn("manifest_not_well_known", "tags.manifest", "Only a manifest at /.well-known/nswp.json can verify the publisher.");
    }
  }

  const coCreators: string[] = [];
  for (const t of getTags({ tags }, "p")) {
    if (isHex64(t[1])) coCreators.push(t[1]);
    else c.warn("invalid_pubkey", "tags.p", "Ignoring a p tag that is not a 64-character hex pubkey.");
  }

  let access: string | undefined;
  for (const t of getTags({ tags }, "a")) {
    if (t[3] !== "access") continue;
    if (t[1] && parseCoordinate(t[1])) access = t[1];
    else c.warn("invalid_coordinate", "tags.a", "Ignoring an access tag that is not an event coordinate.");
  }

  const world: World = {
    d: d ?? "",
    title: title ?? "",
    url: url ? (normalizeUrl(url) ?? url) : "",
    description: typeof e.content === "string" ? e.content : "",
    modes,
    capabilities,
    comfort,
    inputs,
    topics,
    languages,
    status,
    coCreators,
    createdAt: Number.isInteger(e.created_at) ? (e.created_at as number) : 0,
  };
  if (pubkey) {
    world.pubkey = pubkey;
    if (d) world.coordinate = coordinate({ kind: WORLD_KIND, pubkey, identifier: d });
  }
  if (summary) world.summary = summary;
  if (image) world.image = image;
  if (perf) world.perf = perf;
  if (contentWarning !== undefined) world.contentWarning = contentWarning;
  if (manifest) world.manifest = manifest;
  if (access) world.access = access;
  return c.result(world);
}
