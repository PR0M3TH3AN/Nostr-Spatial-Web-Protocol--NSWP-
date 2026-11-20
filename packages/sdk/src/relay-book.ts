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
import { learnRelays, pickRelays, publishEvent, queryRelays, type Filter, type NostrEvent, type QueryResult, type RelayNotes } from "@nswp/core";

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
export async function sendWell(event: NostrEvent, o: { own: string[]; usual: string[]; publish?: typeof publishEvent; now?: () => number }): Promise<SentWell> {
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
  return { took, relays: tried, own: first.own };
}

/** Ask the relays that are working, and remember how each answered. */
export async function askWell(filter: Filter, o: { own: string[]; usual: string[]; query?: typeof queryRelays; timeoutMs?: number; now?: () => number }): Promise<QueryResult> {
  const now = o.now ?? (() => Date.now());
  const got = await (o.query ?? queryRelays)(relaysWell(o, now()).relays, filter, o.timeoutMs ?? 4000);
  learnFrom(got.relays, now());
  return got;
}

/** For tests: forget everything. */
export function forgetRelays(): void {
  notes = {};
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
}
