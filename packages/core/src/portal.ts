/** Portal objects and Airlock fragments (spec §6.1–§6.3). */
import { SCHEMAS, WORLD_KIND } from "./constants.js";
import { checkDestination } from "./destination.js";
import { decodeNaddr, type AddressPointer } from "./nip19.js";
import { Collector, isPlainObject, type Result } from "./result.js";

export interface PortalDestination {
  naddr?: string;
  url?: string;
  entryPoint?: string;
}

export interface Portal {
  schema: string;
  label: string;
  destination: PortalDestination;
  transition?: { preferredStyle?: string };
}

const ENTRY_POINT = /^[A-Za-z0-9._-]{1,128}$/;

export function parsePortal(input: unknown): Result<Portal> {
  const c = new Collector();
  if (!isPlainObject(input)) {
    c.error("not_an_object", "", "A portal must be a JSON object.");
    return c.result(null as never);
  }
  if (typeof input.schema !== "string" || !input.schema.startsWith("nswp/portal/")) c.error("schema_mismatch", "schema", `schema must be "${SCHEMAS.portal}".`);
  if (typeof input.label !== "string" || input.label.trim() === "") c.error("missing_field", "label", "A portal needs a label.");
  const dest: PortalDestination = {};
  const d = input.destination;
  if (!isPlainObject(d)) c.error("missing_field", "destination", "A portal needs a destination.");
  else {
    if (d.naddr !== undefined) {
      try {
        const p = decodeNaddr(String(d.naddr));
        if (p.kind !== WORLD_KIND) c.warn("unexpected_kind", "destination.naddr", `naddr points at kind ${p.kind}, not a world (${WORLD_KIND}).`);
        dest.naddr = String(d.naddr);
      } catch {
        c.error("naddr_invalid", "destination.naddr", "destination.naddr is not a valid naddr.");
      }
    }
    if (d.url !== undefined) {
      const chk = checkDestination(String(d.url));
      if (chk.ok) dest.url = chk.value.url;
      else c.error(chk.error.code, "destination.url", chk.error.message);
    }
    if (dest.naddr === undefined && dest.url === undefined && c.errors.length === 0) {
      c.error("missing_field", "destination", "destination needs an naddr or a url.");
    }
    if (d.entry_point !== undefined) {
      if (typeof d.entry_point === "string" && ENTRY_POINT.test(d.entry_point)) dest.entryPoint = d.entry_point;
      else c.warn("invalid_entry_point", "destination.entry_point", "Ignoring an invalid entry point.");
    }
  }
  const portal: Portal = { schema: String(input.schema ?? SCHEMAS.portal), label: String(input.label ?? ""), destination: dest };
  if (isPlainObject(input.transition) && typeof input.transition.preferred_style === "string") {
    portal.transition = { preferredStyle: input.transition.preferred_style };
  }
  return c.result(portal);
}

/** `<airlock>#to=<naddr or url>&entry=<id>` (spec §6.2: destinations travel in the fragment). */
export function buildAirlockUrl(airlock: string, dest: PortalDestination): string {
  const u = new URL(airlock);
  const to = dest.naddr ?? dest.url;
  if (!to) throw new Error("buildAirlockUrl: destination needs an naddr or a url");
  const parts = [`to=${encodeURIComponent(to)}`];
  if (dest.naddr && dest.url) parts.push(`url=${encodeURIComponent(dest.url)}`);
  if (dest.entryPoint) parts.push(`entry=${encodeURIComponent(dest.entryPoint)}`);
  u.hash = parts.join("&");
  return u.href;
}

export interface AirlockRequest {
  /** The raw `to` value. */
  to: string;
  naddr?: AddressPointer & { raw: string };
  url?: string;
  entryPoint?: string;
}

/** Parse an Airlock fragment. Returns null when there is no destination. */
export function parseAirlockFragment(hash: string): AirlockRequest | null {
  const params = new Map<string, string>();
  for (const part of hash.replace(/^#/, "").split("&")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    try {
      params.set(part.slice(0, i), decodeURIComponent(part.slice(i + 1)));
    } catch {
      /* skip malformed */
    }
  }
  const to = params.get("to");
  if (!to) return null;
  const req: AirlockRequest = { to };
  if (to.startsWith("naddr1")) {
    try {
      req.naddr = { ...decodeNaddr(to), raw: to };
    } catch {
      /* left undefined: caller reports it */
    }
    const url = params.get("url");
    if (url) req.url = url;
  } else req.url = to;
  const entry = params.get("entry");
  if (entry && ENTRY_POINT.test(entry)) req.entryPoint = entry;
  return req;
}
