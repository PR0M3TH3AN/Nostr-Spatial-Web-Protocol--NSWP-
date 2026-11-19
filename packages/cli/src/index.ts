#!/usr/bin/env node
/**
 * nswp — check and author NSWP worlds.
 *
 *   nswp check <url> [--relays wss://a,wss://b] [--json]
 *   nswp validate <file.json>
 *   nswp keygen <key-file>
 *   nswp sign-world <world-input.json> --key-file <path> [--out <file>]
 *   nswp sign-list <list-input.json> --key-file <path> [--out <file>]
 *   nswp worlds [--relays ...] [--verify] [--not-on <list-event.json>] [--json]
 *   nswp publish <event.json> [--relays ...]
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { hexToBytes } from "@noble/hashes/utils.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  buildListEvent,
  buildWorldEvent,
  checkDestination,
  coordinate,
  CURATION_SET_KIND,
  decodeNaddr,
  DEFAULT_RELAYS,
  encodeNaddr,
  fetchManifest,
  finalizeEvent,
  getPublicKey,
  hasEventShape,
  latestAddressable,
  parseListEvent,
  parseManifest,
  parsePortal,
  parseWorldEvent,
  publishEvent,
  queryRelays,
  VERSION,
  verifyEvent,
  verifyOrigin,
  WORLD_KIND,
  type Issue,
  type ListInput,
  type WorldInput,
  kitAge,
  KIT_VERSION,
} from "@nswp/core";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--") && !["json", "verify"].includes(argv[i - 1]!.slice(2))));

const tty = process.stdout.isTTY;
const paint = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = paint("32");
const red = paint("31");
const yellow = paint("33");
const dim = paint("2");
const bold = paint("1");
const OK = green("✔");
const BAD = red("✖");
const WARN = yellow("!");

function printIssues(errors: Issue[], warnings: Issue[], indent = "  ") {
  for (const e of errors) console.log(`${indent}${BAD} ${e.message} ${dim(`[${e.code}]`)}`);
  for (const w of warnings) console.log(`${indent}${WARN} ${w.message} ${dim(`[${w.code}]`)}`);
}

function relaysArg(): string[] {
  const r = flag("relays");
  return r ? r.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_RELAYS;
}

async function check(url: string): Promise<number> {
  const json = has("json");
  const report: Record<string, unknown> = { url };
  const out = (s = "") => {
    if (!json) console.log(s);
  };

  const dest = checkDestination(url);
  if (!dest.ok) {
    if (json) console.log(JSON.stringify({ url, error: dest.error }, null, 2));
    else console.log(`${BAD} ${dest.error.message} ${dim(`[${dest.error.code}]`)}`);
    return 1;
  }
  const d = dest.value;
  report.destination = d;
  out(bold(`Destination  ${dim(d.hostPrefix)}${d.registrableDomain ?? d.hostname}`));
  out(dim(`             ${d.url}`));
  printIssues([], dest.warnings);

  let failed = false;
  try {
    const res = await fetch(d.url, { redirect: "manual" });
    report.entryStatus = res.status;
    if (res.status >= 300 && res.status < 400) out(`  ${WARN} Entry URL redirects (HTTP ${res.status}) to ${res.headers.get("location") ?? "?"}.`);
    else if (!res.ok) {
      out(`  ${BAD} Entry URL returned HTTP ${res.status}.`);
      failed = true;
    } else out(`  ${OK} Entry URL responds (HTTP ${res.status}).`);
  } catch {
    out(`  ${BAD} Entry URL is unreachable.`);
    failed = true;
  }

  out();
  out(bold("Manifest"));
  const m = await fetchManifest(d.url);
  report.manifest = { url: m.url, corsHeader: m.corsHeader ?? null, issues: m.issues, warnings: m.warnings };
  out(dim(`  ${m.url}`));
  if (m.manifest) {
    out(`  ${OK} Valid manifest (${Object.keys(m.manifest.worlds).length} world(s), ${Object.keys(m.manifest.publishers).length} publisher(s)).`);
    if (m.corsHeader === "*") out(`  ${OK} Access-Control-Allow-Origin: *`);
    else if (m.corsHeader == null) {
      out(`  ${BAD} Missing Access-Control-Allow-Origin: * (browser clients can't read it).`);
      failed = true;
    }
    if (m.manifest.listing === "deny") out(`  ${WARN} listing: deny — this origin opts out of third-party listings.`);
    // Which kit the site was built with, beside the one this tool is. Never a fault: an older kit still works.
    const age = kitAge(m.manifest.kit);
    report.kit = { site: m.manifest.kit ?? null, tool: KIT_VERSION, age };
    if (age === "unknown") out(`  ${WARN} The manifest doesn't say which kit the site was built with ("kit"). A visitor's client can't tell how old its controls are.`);
    else if (age === "older") out(`  ${WARN} Built with kit ${m.manifest.kit}; this tool is ${KIT_VERSION}. It still works. Update it to get what has been added since.`);
    else out(`  ${OK} Built with kit ${m.manifest.kit}.`);
  }
  // No manifest is normal for a site that hasn't adopted NSWP: it can be
  // listed, just never verified. Anything else wrong with a manifest is a fault.
  const noManifest = !m.manifest && m.issues.length > 0 && m.issues.every((i) => i.code === "manifest_not_found");
  if (noManifest) out(`  ${WARN} No manifest at the well-known path, so nothing here can be verified.`);
  else {
    if (!m.manifest) failed = true;
    printIssues(m.issues, m.warnings);
  }

  out();
  out(bold("Announcements"));
  const relays = [...new Set([...relaysArg(), ...(m.manifest?.relays ?? [])])];
  const byR = await queryRelays(relays, { kinds: [WORLD_KIND], "#r": [d.url] });
  const fromManifest = m.manifest
    ? await queryRelays(relays, { kinds: [WORLD_KIND], authors: Object.keys(m.manifest.publishers), "#d": Object.keys(m.manifest.worlds) })
    : { events: [], relays: {} };
  const events = latestAddressable([...byR.events, ...fromManifest.events]);
  report.relays = byR.relays;
  out(dim(`  relays: ${Object.entries(byR.relays).map(([r, s]) => `${r.replace("wss://", "")} ${s}`).join(", ")}`));
  const found: unknown[] = [];
  if (events.length === 0) out(`  ${WARN} No announcements found on these relays. The world can still be listed by URL, but not shown as verified.`);
  let anyVerified = false;
  for (const e of events) {
    const w = parseWorldEvent(e);
    if (!w.ok) {
      out(`  ${BAD} ${e.id.slice(0, 12)}… invalid announcement`);
      printIssues(w.errors, w.warnings, "      ");
      found.push({ id: e.id, valid: false, errors: w.errors });
      continue;
    }
    const v = m.manifest ? verifyOrigin(w.value, m.manifest, m.url) : null;
    if (v?.verified) anyVerified = true;
    out(`  ${v?.verified ? OK : WARN} ${bold(w.value.title)} ${dim(`by ${e.pubkey.slice(0, 12)}…  d=${w.value.d}`)}`);
    out(`      ${v?.verified ? green("verified for this origin") : yellow("listed, not verified")}`);
    if (v && !v.verified) for (const c of v.checks.filter((x) => !x.ok)) out(`      ${BAD} ${c.message}`);
    printIssues([], w.warnings, "      ");
    out(dim(`      ${encodeNaddr({ kind: WORLD_KIND, pubkey: e.pubkey, identifier: w.value.d, relays: relays.slice(0, 2) })}`));
    found.push({ id: e.id, pubkey: e.pubkey, d: w.value.d, valid: true, verified: v?.verified ?? false, checks: v?.checks ?? [] });
  }
  report.announcements = found;
  report.verified = anyVerified;
  out();
  if (json) console.log(JSON.stringify(report, null, 2));
  else out(failed ? red("Problems found.") : anyVerified ? green("Verified world.") : yellow("Reachable, but not verified."));
  return failed ? 1 : 0;
}

function validateFile(path: string): number {
  const data = JSON.parse(readFileSync(path, "utf8"));
  let kind = "unknown";
  let r: { ok: boolean; errors?: Issue[]; warnings: Issue[] };
  if (typeof data?.kind === "number") {
    kind = data.kind === CURATION_SET_KIND ? "list (kind 30004)" : `event (kind ${data.kind})`;
    r = data.kind === CURATION_SET_KIND ? parseListEvent(data) : parseWorldEvent(data);
    if (hasEventShape(data)) console.log(verifyEvent(data) ? `${OK} signature valid` : `${BAD} signature INVALID`);
  } else if (typeof data?.schema === "string" && data.schema.startsWith("nswp/manifest/")) {
    kind = "manifest";
    r = parseManifest(data, { byteLength: readFileSync(path).length });
  } else if (typeof data?.schema === "string" && data.schema.startsWith("nswp/portal/")) {
    kind = "portal";
    r = parsePortal(data);
  } else {
    console.log(`${BAD} Not a world event, list, manifest or portal.`);
    return 1;
  }
  console.log(`${r.ok ? OK : BAD} ${kind} ${r.ok ? "is valid" : "is invalid"}`);
  printIssues(r.ok ? [] : (r.errors ?? []), r.warnings);
  return r.ok ? 0 : 1;
}

function readKey(path: string): Uint8Array {
  const hex = readFileSync(path, "utf8").trim();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`${path} must contain a 64-character hex secret key`);
  return hexToBytes(hex);
}

function keygen(path: string): number {
  if (existsSync(path)) {
    console.log(`${BAD} ${path} already exists; refusing to overwrite.`);
    return 1;
  }
  const sk = schnorr.utils.randomSecretKey();
  writeFileSync(path, `${bytesToHex(sk)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  console.log(`${OK} Wrote secret key to ${path} (mode 600). Keep it out of git.`);
  console.log(`  pubkey ${getPublicKey(sk)}`);
  return 0;
}

function signWorld(inputPath: string): number {
  const keyFile = flag("key-file");
  if (!keyFile) {
    console.log(`${BAD} --key-file is required`);
    return 1;
  }
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as WorldInput;
  const event = finalizeEvent(buildWorldEvent(input), readKey(keyFile));
  const r = parseWorldEvent(event, { requireSigned: true });
  if (!r.ok) {
    printIssues(r.errors, r.warnings);
    return 1;
  }
  const text = `${JSON.stringify(event, null, 2)}\n`;
  const outPath = flag("out");
  if (outPath) {
    writeFileSync(outPath, text);
    console.log(`${OK} Signed ${input.d} → ${outPath}`);
  } else process.stdout.write(text);
  printIssues([], r.warnings);
  return 0;
}

/** A world named any of the ways people write one down: a coordinate, or an naddr. */
function worldCoordinate(s: string): string {
  if (s.startsWith("naddr1")) {
    const p = decodeNaddr(s);
    if (p.kind !== WORLD_KIND) throw new Error(`${s.slice(0, 24)}… is not a world (kind ${p.kind})`);
    return coordinate(p);
  }
  return s;
}

function signList(inputPath: string): number {
  const keyFile = flag("key-file");
  if (!keyFile) {
    console.log(`${BAD} --key-file is required`);
    return 1;
  }
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as ListInput;
  if (typeof input.d !== "string" || typeof input.title !== "string" || !Array.isArray(input.worlds)) {
    console.log(`${BAD} A list needs "d", "title" and "worlds" (an array of world addresses).`);
    return 1;
  }
  const worlds = input.worlds.map(worldCoordinate);
  const event = finalizeEvent(buildListEvent({ ...input, worlds }), readKey(keyFile));
  const r = parseListEvent(event, { requireSigned: true });
  if (!r.ok) {
    printIssues(r.errors, r.warnings);
    return 1;
  }
  if (r.value.worlds.length !== new Set(worlds).size) {
    console.log(`${BAD} ${new Set(worlds).size - r.value.worlds.length} of the worlds are not world addresses (37300:<pubkey>:<d>, or an naddr).`);
    return 1;
  }
  const text = `${JSON.stringify(event, null, 2)}\n`;
  const outPath = flag("out");
  if (outPath) {
    writeFileSync(outPath, text);
    console.log(`${OK} Signed "${r.value.title}" (${r.value.worlds.length} world${r.value.worlds.length === 1 ? "" : "s"}) → ${outPath}`);
    console.log(`  Once published, this is the address people follow it by:`);
    console.log(`  ${encodeNaddr({ kind: CURATION_SET_KIND, pubkey: event.pubkey, identifier: input.d, relays: relaysArg().slice(0, 2) })}`);
  } else process.stdout.write(text);
  printIssues([], r.warnings);
  return 0;
}

/** Every world announced on the relays, newest first: what a curator reads to find something to list. */
async function worlds(): Promise<number> {
  const json = has("json");
  const relays = relaysArg();
  const skip = new Set<string>();
  const notOn = flag("not-on");
  if (notOn) {
    // A list event, or a file that holds one under "set" (BitPortal's bundled starter set).
    const file = JSON.parse(readFileSync(notOn, "utf8"));
    const l = parseListEvent(file?.set ?? file);
    if (!l.ok) {
      printIssues(l.errors, l.warnings);
      return 1;
    }
    for (const w of l.value.worlds) skip.add(w);
  }
  const res = await queryRelays(relays, { kinds: [WORLD_KIND], limit: 500 }, 6000);
  const rows: Record<string, unknown>[] = [];
  const events = latestAddressable(res.events).sort((a, b) => b.created_at - a.created_at);
  for (const e of events) {
    const w = parseWorldEvent(e);
    if (!w.ok || !w.value.coordinate || skip.has(w.value.coordinate) || w.value.status === "retired") continue;
    let verified: boolean | null = null;
    if (has("verify")) {
      const m = await fetchManifest(w.value.url);
      verified = m.manifest ? verifyOrigin(w.value, m.manifest, m.url).verified : false;
    }
    const naddr = encodeNaddr({ kind: WORLD_KIND, pubkey: e.pubkey, identifier: w.value.d, relays: relays.slice(0, 2) });
    rows.push({ coordinate: w.value.coordinate, title: w.value.title, url: w.value.url, announced: new Date(e.created_at * 1000).toISOString().slice(0, 10), verified, naddr });
    if (!json) {
      const mark = verified === null ? " " : verified ? OK : WARN;
      console.log(`${mark} ${bold(w.value.title)} ${dim(w.value.url)}`);
      console.log(dim(`    ${new Date(e.created_at * 1000).toISOString().slice(0, 10)}  ${verified === null ? "" : verified ? "verified  " : "not verified  "}${w.value.coordinate}`));
    }
  }
  if (json) console.log(JSON.stringify({ relays: res.relays, worlds: rows }, null, 2));
  else console.log(`\n${rows.length} world${rows.length === 1 ? "" : "s"}${notOn ? " not on that list" : ""}. ${has("verify") ? "" : dim("Add --verify to check each site vouches for its announcement.")}`);
  return 0;
}

async function publish(path: string): Promise<number> {
  const event = JSON.parse(readFileSync(path, "utf8"));
  if (!verifyEvent(event)) {
    console.log(`${BAD} ${path} is not a validly signed event.`);
    return 1;
  }
  const res = await publishEvent(relaysArg(), event);
  let ok = 0;
  for (const [relay, s] of Object.entries(res.relays)) {
    console.log(`  ${s === "ok" ? OK : BAD} ${relay} ${dim(s)}`);
    if (s === "ok") ok++;
  }
  return ok > 0 ? 0 : 1;
}

async function main(): Promise<number> {
  const [cmd, arg] = positional;
  switch (cmd) {
    case "check":
      if (arg) return check(arg);
      break;
    case "validate":
      if (arg) return validateFile(arg);
      break;
    case "keygen":
      if (arg) return keygen(arg);
      break;
    case "sign-world":
      if (arg) return signWorld(arg);
      break;
    case "sign-list":
      if (arg) return signList(arg);
      break;
    case "worlds":
      return worlds();
    case "publish":
      if (arg) return publish(arg);
      break;
    case "version":
    case undefined:
      if (has("version") || cmd === "version") {
        console.log(VERSION);
        return 0;
      }
  }
  console.log(`nswp ${VERSION}

  nswp check <url> [--relays wss://a,wss://b] [--json]   check a world: manifest, CORS, announcements, verification
  nswp validate <file.json>                               validate a world event, list, manifest or portal
  nswp keygen <key-file>                                  create a publisher key (hex, mode 600)
  nswp sign-world <input.json> --key-file <f> [--out f]   sign a world announcement from a WorldInput file
  nswp sign-list <input.json> --key-file <f> [--out f]    sign a list of worlds: { "d", "title", "description", "worlds": [addresses] }
  nswp worlds [--verify] [--not-on <list.json>] [--json]  every world announced on the relays, newest first
  nswp publish <event.json> [--relays ...]                publish a signed event`);
  return cmd ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(red(err instanceof Error ? err.message : String(err)));
    process.exit(2);
  },
);
