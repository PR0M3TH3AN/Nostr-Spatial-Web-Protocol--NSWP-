/**
 * Which relays have been working, remembered on this device, and a way to send something to the ones that are.
 *
 *   const sent = await sendWell(event, { own: theirWriteRelays, usual: DEFAULT_RELAYS });   // { took, relays, own }
 *
 * A person's own relays are always used: it is where they said they write. What this adds is the order (the ones
 * that have been answering, first), a few of the usual relays when too few of their own are up, and one more
 * try elsewhere if nothing took it. What it learns stays on the device, is about relays and never about people,
 * and is never sent anywhere.
 */
import { DISCOVERY, DISCOVERY_RELAYS, learnRelays, pickDiscovered, pickRelays, publishEvent, queryRelays, RELAY_DISCOVERY_KIND, WRAP_KIND, type DiscoveredRelays, type Filter, type NostrEvent, type QueryResult, type RelayNotes } from "@nswp/core";

const KEY = "nswp:relays";
let notes: RelayNotes | null = null;
const read = (): RelayNotes => {
  if (notes) return notes;
  try {
    const kept = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "{}") as unknown;
    notes = kept && typeof kept === "object" && !Array.isArray(kept) ? (kept as RelayNotes) : {};
  } catch {
    notes = {};
  }
  return notes;
};

/** Remember how these relays answered: what `queryRelays` or `publishEvent` said of each. */
export function learnFrom(results: Record<string, string>, now: number = Date.now()): void {
  notes = learnRelays(read(), results, now);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* a private window: remembered for this page only */
  }
}

/** Where to send something of a person's, or look for it: their own relays, best first, and the usual ones if too few of theirs are up. */
export function relaysWell(o: { own: string[]; usual: string[] }, now: number = Date.now()): { relays: string[]; own: number; added: string[] } {
  return pickRelays({ ...o, notes: read(), now });
}

export interface SentWell {
  /** How many relays took it. */
  took: number;
  /** Every relay that was tried. */
  relays: string[];
  /** How many of those were the person's own. */
  own: number;
}

/**
 * Send something to the relays that are working. If none of the first choice takes it, the rest of the usual
 * relays are tried once: something signed should not be lost because the first few were down.
 */
export async function sendWell(event: NostrEvent, o: { own: string[]; usual: string[]; publish?: typeof publishEvent; query?: typeof queryRelays; now?: () => number }): Promise<SentWell> {
  const publish = o.publish ?? publishEvent;
  const now = o.now ?? (() => Date.now());
  const first = relaysWell(o, now());
  const sent = await publish(first.relays, event).catch(() => ({ relays: Object.fromEntries(first.relays.map((r) => [r, "error: not sent"])) }));
  learnFrom(sent.relays, now());
  let took = Object.values(sent.relays).filter((said) => said === "ok").length;
  const tried = [...first.relays];
  if (took === 0) {
    const rest = o.usual.filter((r) => !tried.includes(r));
    if (rest.length) {
      const again = await publish(rest, event).catch(() => ({ relays: Object.fromEntries(rest.map((r) => [r, "error: not sent"])) }));
      learnFrom(again.relays, now());
      took = Object.values(again.relays).filter((said) => said === "ok").length;
      tried.push(...rest);
    }
  }
  // Still nothing: a few relays that monitors have found working (NIP-66), once. Never a private message.
  if (took === 0 && maySendBackUp(tried, o) && event.kind !== WRAP_KIND) {
    const more = (await foundRelays({ not: tried, now, ...(o.query ? { query: o.query } : {}) })).open;
    for (let round = 0; round < BACKUP_ROUNDS && took === 0; round++) {
      const batch = more.slice(round * BACKUP_AT_ONCE, (round + 1) * BACKUP_AT_ONCE);
      if (!batch.length) break;
      const last = await publish(batch, event).catch(() => ({ relays: Object.fromEntries(batch.map((r) => [r, "error: not sent"])) }));
      learnFrom(last.relays, now());
      took = Object.values(last.relays).filter((said) => said === "ok").length;
      tried.push(...batch);
    }
  }
  return { took, relays: tried, own: first.own };
}

/** Ask the relays that are working, and remember how each answered. */
export async function askWell(filter: Filter, o: { own: string[]; usual: string[]; query?: typeof queryRelays; timeoutMs?: number; now?: () => number }): Promise<QueryResult> {
  const now = o.now ?? (() => Date.now());
  const asked = relaysWell(o, now()).relays;
  // Where none of them answers, a few that monitors have found working are asked (NIP-66).
  return queryBacked(asked, filter, o.timeoutMs ?? 4000, { ...(o.query ? { query: o.query } : {}), now });
}

// ---- A backup (NIP-66). When a person's own relays and the usual ones all fail, relays that monitors have found
// working are tried once. Nothing depends on it: with no monitors to ask, everything is as it was.

const FOUND_KEY = "nswp:relays:found";
const FOUND_FOR_MS = 24 * 3600 * 1000;
let backup = true;
let found: { at: number; open: string[]; closed: string[] } | null = null;
let finding: Promise<DiscoveredRelays> | null = null;

/** Whether the backup is used, and the way to turn it off or on for this page. On unless turned off. */
export function relayBackup(on?: boolean): boolean {
  if (on !== undefined) backup = on;
  return backup;
}

/**
 * What relay monitors have found (NIP-66): relays to try as a backup, and relays that are closed to a stranger.
 * Asked for once a day at most, from relays that keep monitors' notes, and kept on the device. It is asked for
 * only when it is needed: when everything else has failed, or when a visitor is choosing where their private
 * messages should reach them. Empty, never an error, when no monitor could be asked.
 */
export function foundRelays(o: { not?: readonly string[]; query?: typeof queryRelays; now?: () => number } = {}): Promise<DiscoveredRelays> {
  const now = o.now ?? (() => Date.now());
  const without = (all: DiscoveredRelays): DiscoveredRelays => ({ open: all.open.filter((r) => !(o.not ?? []).includes(r)), closed: all.closed });
  if (!found) {
    try {
      const kept = JSON.parse(globalThis.localStorage?.getItem(FOUND_KEY) ?? "null") as { at?: unknown; open?: unknown; closed?: unknown } | null;
      const list = (v: unknown) => (Array.isArray(v) ? v.filter((r): r is string => typeof r === "string" && /^wss:\/\//.test(r)).slice(0, 400) : []);
      if (kept && typeof kept.at === "number") found = { at: kept.at, open: list(kept.open), closed: list(kept.closed) };
    } catch {
      /* nothing kept */
    }
  }
  if (found && now() - found.at < FOUND_FOR_MS) return Promise.resolve(without(found));
  finding ??= (async () => {
    const since = Math.floor(now() / 1000) - DISCOVERY.freshSec;
    const got = await (o.query ?? queryRelays)([...DISCOVERY_RELAYS], { kinds: [RELAY_DISCOVERY_KIND], since, limit: 500 }, 5000).catch(() => null);
    // More are kept than are ever tried at once, so that leaving out the ones already tried still leaves some.
    const picked = pickDiscovered(got?.events ?? [], { now: Math.floor(now() / 1000), most: 24 });
    // Nothing found is not kept for a day: it is asked for again the next time it is needed.
    if (picked.open.length || picked.closed.length) {
      found = { at: now(), ...picked };
      try {
        globalThis.localStorage?.setItem(FOUND_KEY, JSON.stringify(found));
      } catch {
        /* a private window: known for this page only */
      }
    }
    return picked;
  })().finally(() => {
    finding = null;
  });
  return finding.then(without);
}

/** How many backup relays are tried at once. */
const BACKUP_AT_ONCE = 4;
/**
 * How many rounds of them are tried when sending. A monitor finding a relay open says little about whether it
 * takes a note from a key it doesn't know: probed on 2026-11-20, most of the relays monitors listed as open
 * refused one. So a refusal is expected, and the next few are tried, before giving up.
 */
const BACKUP_ROUNDS = 3;

/**
 * Whether the backup may be used for this call.
 *
 * - Not where the caller named no relays at all. "Send this nowhere" must never become "send it to relays nobody
 *   chose": a backup stands in for relays that failed, not for relays that were never there.
 * - Not outside a browser, unless the caller handed in what does the asking or the sending. A script or a test
 *   that calls this in Node reaches no relay it didn't name. (A test of BitPortal's sent a made-up rating to two
 *   real relays this way on 2026-11-20, in the hour this was first written.)
 * - Not for sending, where the caller handed in the sending and not the asking. The backup first asks relay
 *   monitors where to go. A caller that brings its own way to send (a test) and no way to ask would have that
 *   question go to real relays, and wait on them. (A test here did, until 2026-11-23, and failed a gate run when
 *   they were slow.) So for sending it is both or neither: both handed in, or neither and a browser.
 */
const mayAskBackUp = (relays: readonly string[], o: { query?: unknown }): boolean => backup && relays.length > 0 && (!!o.query || typeof document !== "undefined");
const maySendBackUp = (relays: readonly string[], o: { publish?: unknown; query?: unknown }): boolean =>
  backup && relays.length > 0 && (o.publish ? !!o.query : !o.query && typeof document !== "undefined");

/**
 * Ask relays, and where none of them answers, ask a few that monitors have found working. The same call as the
 * core's `queryRelays`: for anything that asks relays and would rather have an answer than none.
 */
export async function queryBacked(relays: string[], filter: Filter, timeoutMs = 4000, o: { query?: typeof queryRelays; now?: () => number } = {}): Promise<QueryResult> {
  const query = o.query ?? queryRelays;
  const now = o.now ?? (() => Date.now());
  const got = await query(relays, filter, timeoutMs);
  learnFrom(got.relays, now());
  if (!mayAskBackUp(relays, o) || Object.values(got.relays).some((said) => said === "eose")) return got;
  const more = (await foundRelays({ not: relays, ...o })).open.slice(0, BACKUP_AT_ONCE);
  if (!more.length) return got;
  const again = await query(more, filter, timeoutMs).catch(() => null);
  if (!again) return got;
  learnFrom(again.relays, now());
  const byId = new Map([...got.events, ...again.events].map((e) => [e.id, e]));
  return { events: [...byId.values()], relays: { ...got.relays, ...again.relays } };
}

/**
 * Send something to relays, and where none of them takes it, to a few that monitors have found working. The same
 * call as the core's `publishEvent`.
 *
 * Never for a wrapped private message: that goes where its reader said their messages reach them, and nowhere
 * else, or it is never read.
 */
export async function publishBacked(relays: string[], event: NostrEvent, o: { publish?: typeof publishEvent; query?: typeof queryRelays; now?: () => number } = {}): Promise<{ relays: Record<string, string> }> {
  const publish = o.publish ?? publishEvent;
  const now = o.now ?? (() => Date.now());
  const sent = await publish(relays, event);
  learnFrom(sent.relays, now());
  if (!maySendBackUp(relays, o) || event.kind === WRAP_KIND || Object.values(sent.relays).some((said) => said === "ok")) return sent;
  const more = (await foundRelays({ not: relays, ...(o.query ? { query: o.query } : {}), now })).open;
  const all = { ...sent.relays };
  for (let round = 0; round < BACKUP_ROUNDS; round++) {
    const batch = more.slice(round * BACKUP_AT_ONCE, (round + 1) * BACKUP_AT_ONCE);
    if (!batch.length) break;
    const again = await publish(batch, event).catch(() => null);
    if (!again) continue;
    learnFrom(again.relays, now());
    Object.assign(all, again.relays);
    if (Object.values(again.relays).some((said) => said === "ok")) break;
  }
  return { relays: all };
}

/** For tests: forget everything. */
export function forgetRelays(): void {
  notes = {};
  found = null;
  backup = true;
  try {
    globalThis.localStorage?.removeItem(FOUND_KEY);
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
}
