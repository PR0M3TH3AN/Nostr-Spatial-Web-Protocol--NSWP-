/**
 * Destination checks for the Airlock and the SDK (spec §6.2).
 *
 * The Airlock rejects anything that is not an https URL before doing anything
 * else with it, and shows the registrable domain prominently so lookalike
 * hosts stand out. Hostnames are shown in their raw (punycode) form.
 */
import { parse as parseHost } from "tldts";
import { LIMITS } from "./constants.js";
import type { Issue } from "./result.js";

export interface DestinationInfo {
  /** Normalized href. */
  url: string;
  origin: string;
  hostname: string;
  /** e.g. `example.co.uk`; null for IP addresses and unknown suffixes. */
  registrableDomain: string | null;
  /** Everything left of the registrable domain, e.g. `museum.` — shown de-emphasised. */
  hostPrefix: string;
}

export type DestinationCheck =
  | { ok: true; value: DestinationInfo; warnings: Issue[] }
  | { ok: false; error: Issue; warnings: Issue[] };

export interface DestinationOptions {
  /** Allow http://localhost, 127.0.0.1 and [::1] for local development. Default false. */
  allowLocalhost?: boolean;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function checkDestination(input: string, opts: DestinationOptions = {}): DestinationCheck {
  const warnings: Issue[] = [];
  const fail = (code: string, message: string): DestinationCheck => ({
    ok: false,
    error: { code, path: "destination", message },
    warnings,
  });
  if (typeof input !== "string" || input.trim() === "") return fail("destination_missing", "No destination given.");
  const raw = input.trim();
  if (raw.length > LIMITS.maxUrlLength) return fail("url_too_long", "The destination URL is too long.");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return fail("url_invalid", "The destination is not a valid URL.");
  }
  const local = LOCAL_HOSTS.has(u.hostname) || u.hostname.endsWith(".localhost");
  if (u.protocol !== "https:" && !(opts.allowLocalhost && local && u.protocol === "http:")) {
    return fail("url_not_https", `Only https destinations are allowed (got ${u.protocol.replace(":", "")}).`);
  }
  if (u.username || u.password) return fail("url_has_credentials", "Destinations must not contain a username or password.");

  // Private suffixes (vercel.app, github.io, …) matter: every site under them is
  // owned by someone different, so each must count as its own domain.
  const host = parseHost(u.hostname, { allowPrivateDomains: true });
  const hostname = u.hostname;
  let registrableDomain = host.isIp ? null : host.domain;
  if (host.isIp) warnings.push({ code: "ip_address_host", path: "destination", message: "The destination is a raw IP address." });
  else if (!host.isIcann && !host.isPrivate && !local) {
    warnings.push({ code: "unknown_suffix", path: "destination", message: `"${host.publicSuffix ?? hostname}" is not a known public suffix.` });
  }
  if (local) registrableDomain = hostname;
  if (hostname.split(".").some((label) => label.startsWith("xn--"))) {
    warnings.push({
      code: "punycode_hostname",
      path: "destination",
      message: "The hostname uses non-Latin characters (shown in raw form). Check it is the site you expect.",
    });
  }
  if (u.port) warnings.push({ code: "non_default_port", path: "destination", message: `The destination uses port ${u.port}.` });

  const hostPrefix = registrableDomain && hostname !== registrableDomain ? hostname.slice(0, hostname.length - registrableDomain.length) : "";
  return {
    ok: true,
    value: { url: u.href, origin: u.origin, hostname, registrableDomain, hostPrefix },
    warnings,
  };
}

export function isHttpsUrl(v: unknown): v is string {
  if (typeof v !== "string" || v.length > LIMITS.maxUrlLength) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export function isWssUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "wss:";
  } catch {
    return false;
  }
}

/** Normalized href for comparisons, or null if not a URL. */
export function normalizeUrl(v: string): string | null {
  try {
    return new URL(v).href;
  } catch {
    return null;
  }
}
