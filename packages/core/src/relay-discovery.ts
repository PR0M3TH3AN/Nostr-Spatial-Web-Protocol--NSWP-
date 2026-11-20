/**
 * Relays that others have found to be working (NIP-66, "Relay Liveness Monitoring"), as a backup for when a
 * person's own relays and the usual ones all fail.
 *
 * A monitor is a key that tries relays and publishes what it found, one note for each relay (kind 30166). Anyone
 * can be a monitor, and a monitor can be wrong or lying. So, as the NIP asks: nothing here is ever needed for a
 * client to work; no single monitor is believed; and what is taken from them is a short list to *try*, which
 * then has to answer like any other relay before it is leaned on.
 *
 * This file is the pure part: reading a monitor's note, and choosing from many of them.
 */
import { getTags, isHex64, type NostrEvent } from "./event.js";
import { cleanRelayUrl } from "./relay.js";

/** What a monitor found of one relay: addressable, one for each relay it watches. NIP-66. */
export const RELAY_DISCOVERY_KIND = 30166;

/** Where monitors' notes are looked for, beside the usual relays: relays that keep them. */
export const DISCOVERY_RELAYS: readonly string[] = ["wss://relay.nostr.watch", "wss://relaypag.es", "wss://monitorlizard.nostr1.com"];

export const DISCOVERY = {
  /** A finding older than this says nothing about now, in seconds. */
  freshSec: 3 * 86_400,
  /** A relay is taken only where this many different monitors found it working. */
  agree: 2,
  /** No more than this many are offered as a backup. */
  most: 6,
  /** A relay slower to open than this, by every monitor's count, is no backup, in milliseconds. */
  slowMs: 2500,
} as const;

/** What one monitor found of one relay. A thing it didn't say is null. */
export interface RelayFinding {
  url: string;
  monitor: string;
  /** When, in seconds. */
  at: number;
  /** Whether a reader or writer has to prove who they are. */
  auth: boolean | null;
  payment: boolean | null;
  /** Whether writing is restricted to some people. */
  restricted: boolean | null;
  pow: boolean | null;
  /** How long it took to open, in milliseconds. */
  rttOpen: number | null;
  /** How long a write took, where the monitor wrote something to it and it was taken. */
  rttWrite: number | null;
  /** Kinds it says it won't take. */
  refuses: number[];
}

/**
 * Read a monitor's note. Null unless it is one, about a relay this library would dial at all: a public `wss`
 * address on the open internet. A relay on another network (tor, i2p) is not for a browser.
 */
export function readRelayFinding(event: NostrEvent | null | undefined): RelayFinding | null {
  if (!event || event.kind !== RELAY_DISCOVERY_KIND || !isHex64(event.pubkey) || !Array.isArray(event.tags)) return null;
  const url = cleanRelayUrl(getTags(event, "d")[0]?.[1]);
  const network = getTags(event, "n")[0]?.[1];
  if (!url || (network !== undefined && network !== "clearnet")) return null;
  const said = (name: string): boolean | null => {
    const values = getTags(event, "R").map((t) => t[1]);
    return values.includes(name) ? true : values.includes(`!${name}`) ? false : null;
  };
  const ms = Number(getTags(event, "rtt-open")[0]?.[1]);
  const wrote = Number(getTags(event, "rtt-write")[0]?.[1]);
  const refuses = getTags(event, "k")
    .map((t) => t[1] ?? "")
    .filter((k) => /^!\d{1,5}$/.test(k))
    .map((k) => Number(k.slice(1)));
  return { url, monitor: event.pubkey, at: Number.isInteger(event.created_at) ? event.created_at : 0, auth: said("auth"), payment: said("payment"), restricted: said("writes"), pow: said("pow"), rttOpen: Number.isFinite(ms) && ms > 0 ? ms : null, rttWrite: Number.isFinite(wrote) && wrote > 0 ? wrote : null, refuses };
}

export interface DiscoveredRelays {
  /** Relays to try as a backup, best first: found open, by more than one monitor, lately. */
  open: string[];
  /** Relays some monitor found closed to a stranger: asking for proof of who they are, or payment. */
  closed: string[];
}

/**
 * Choose from what monitors found. `open` is a short list to try when everything a person chose has failed.
 * `closed` is for leaving a relay out of somewhere a stranger has to be able to read or write.
 *
 * - Only a finding made lately counts, and each monitor's newest of each relay.
 * - A relay is open only where at least two monitors found it so, and none found that it asks for proof of
 *   who someone is, for payment, for work, or keeps writing to a few. One monitor is never believed alone.
 * - `kind`, where given, leaves out a relay any monitor says refuses that kind.
 * - `not` leaves out relays already known: there is no use offering as a backup what was just tried.
 */
export function pickDiscovered(events: readonly NostrEvent[], o: { now: number; not?: readonly string[]; kind?: number; most?: number }): DiscoveredRelays {
  const newest = new Map<string, RelayFinding>();
  for (const event of events) {
    const f = readRelayFinding(event);
    if (!f || f.at > o.now + 600 || o.now - f.at > DISCOVERY.freshSec) continue;
    const key = `${f.url} ${f.monitor}`;
    const had = newest.get(key);
    if (!had || had.at < f.at) newest.set(key, f);
  }
  const byRelay = new Map<string, RelayFinding[]>();
  for (const f of newest.values()) byRelay.set(f.url, [...(byRelay.get(f.url) ?? []), f]);
  const not = new Set(o.not ?? []);
  const open: { url: string; monitors: number; sure: number; wrote: number; rtt: number }[] = [];
  const closed: string[] = [];
  for (const [url, found] of byRelay) {
    const shut = found.some((f) => f.auth === true || f.payment === true);
    if (shut) closed.push(url);
    if (shut || not.has(url) || found.length < DISCOVERY.agree) continue;
    if (found.some((f) => f.restricted === true || f.pow === true || (o.kind !== undefined && f.refuses.includes(o.kind)))) continue;
    const times = found.map((f) => f.rttOpen).filter((n): n is number => n !== null).sort((a, b) => a - b);
    const rtt = times.length ? times[Math.floor(times.length / 2)]! : DISCOVERY.slowMs;
    if (times.length && times[0]! > DISCOVERY.slowMs) continue;
    // How many said outright that it asks no proof and no payment: that is worth more than silence.
    const sure = found.filter((f) => f.auth === false && f.payment === false).length;
    // And how many wrote to it and had it taken: a backup is somewhere to send things.
    const wrote = found.filter((f) => f.rttWrite !== null).length;
    open.push({ url, monitors: found.length, sure, wrote, rtt });
  }
  open.sort((a, b) => Math.min(b.sure, 4) - Math.min(a.sure, 4) || Math.min(b.wrote, 2) - Math.min(a.wrote, 2) || Math.min(b.monitors, 6) - Math.min(a.monitors, 6) || a.rtt - b.rtt || (a.url < b.url ? -1 : 1));
  return { open: open.slice(0, o.most ?? DISCOVERY.most).map((r) => r.url), closed: closed.sort() };
}
