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
import { cleanRelayUrl, DISCOVERY, DISCOVERY_RELAYS, learnRelays, pickDiscovered, pickRelays, publishEvent, queryRelays, readRelayList, RELAY_DISCOVERY_KIND, RELAY_LIST_KIND, RELAY_PICK, verifyEvent, WRAP_KIND, type DiscoveredRelays, type Filter, type NostrEvent, type QueryResult, type RelayNotes } from "@nswp/core";

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

/**
 * Where to send something of a person's, or look for it: their own relays, best first, and the usual ones if too few
 * of theirs are up. `for` leaves out relays found closed to reading or to writing; `usualAtLeast` makes sure of that
 * many usual relays among them.
 */
export function relaysWell(o: { own: string[]; usual: string[]; for?: "read" | "write"; usualAtLeast?: number }, now: number = Date.now()): { relays: string[]; own: number; added: string[] } {
  return pickRelays({ ...o, notes: withMonitors(read()), now });
}

/** These relays, cleaned, without any found closed to `to`. */
const openOf = (urls: string[], to: "read" | "write", at: number): string[] => {
  const notes = withMonitors(read());
  // A pick of one relay leaves it out only where it is closed to `to`.
  return [...new Set(urls.map(cleanRelayUrl).filter(Boolean))].filter((u) => pickRelays({ own: [u], usual: [], notes, now: at, for: to }).relays.includes(u));
};

/** What is remembered, with what monitors found closed (kept from the last time they were asked) as closed to writing. */
const withMonitors = (kept: RelayNotes): RelayNotes => {
  if (!found?.closed.length) return kept;
  const next: RelayNotes = { ...kept };
  for (const url of found.closed) next[url] = { ...(next[url] ?? { ok: 0, failed: 0, at: found.at }), closed: { ...(next[url]?.closed ?? {}), write: found.at } };
  return next;
};

export interface SentWell {
  /** How many relays took it. */
  took: number;
  /** Every relay that was tried. */
  relays: string[];
  /** How many of those were the person's own. */
  own: number;
}

/**
 * Send something of a person's to the relays that are working, until `RELAY_PICK.took` of them said they took it.
 *
 * - Their own relays, best first, and always at least `RELAY_PICK.usual` of the usual ones as well: a world that
 *   hasn't their relay list yet looks only there. Never for a wrapped private message, which goes only where its
 *   reader said.
 * - Where fewer than `RELAY_PICK.took` took it, the rest of the usual relays are tried once. `took` says how many
 *   took it in all, for the caller to say so where it is fewer, and to send it again.
 * - Relays found closed to writing take no place.
 */
export async function sendWell(event: NostrEvent, o: { own: string[]; usual: string[]; publish?: typeof publishEvent; query?: typeof queryRelays; now?: () => number }): Promise<SentWell> {
  const publish = o.publish ?? publishEvent;
  const now = o.now ?? (() => Date.now());
  const wrapped = event.kind === WRAP_KIND;
  const first = relaysWell({ own: o.own, usual: o.usual, for: "write", ...(wrapped ? {} : { usualAtLeast: RELAY_PICK.usual }) }, now());
  const sent = await publish(first.relays, event).catch(() => ({ relays: Object.fromEntries(first.relays.map((r) => [r, "error: not sent"])) }));
  learnFrom(sent.relays, now());
  let took = Object.values(sent.relays).filter((said) => said === "ok").length;
  const tried = [...first.relays];
  if (took < RELAY_PICK.took && !(wrapped && took > 0)) {
    // The usual relays not yet tried, best first, leaving out any found closed to writing.
    const rest = openOf(o.usual.filter((r) => !tried.includes(cleanRelayUrl(r))), "write", now());
    if (rest.length) {
      const again = await publish(rest, event).catch(() => ({ relays: Object.fromEntries(rest.map((r) => [r, "error: not sent"])) }));
      learnFrom(again.relays, now());
      took += Object.values(again.relays).filter((said) => said === "ok").length;
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

// ---- A person's own notes, looked for well. Asked of their own relays (NIP-65) and the usual ones, and where it is
// the visitor's own note on their own device, looked for until it is found or every relay of theirs has been asked,
// and put back where it is missing. "None" is never said on one relay's word, nor where nobody answered.

/** What a look for a person's own note found: the notes, and whether there is none or it couldn't be looked for. */
export interface AskedOwn {
  events: NostrEvent[];
  /** "found": something came back. "none": enough relays answered to the end and none had it. "unreached": too few answered to say. */
  state: "found" | "none" | "unreached";
  /** Per relay asked: "eose", "timeout", or what it said instead. */
  relays: Record<string, string>;
  /** Their own relays, as their relay list gives them; empty where none was found. */
  own: string[];
}

/** The visitor's own relay list, kept on their device once known: used at once next time, while a newer one is asked for. */
const LIST_KEY = "nswp:relays:list";
/** What has been put back where, and when: a relay has one note put back on it at most once a day. */
const MENDED_KEY = "nswp:relays:mended";
const MENDED_FOR_MS = 24 * 3600 * 1000;
/** Other people's relay lists, found on this page: for the page's life. A miss is never kept. */
const lists = new Map<string, NostrEvent>();

const keptList = (who: string): NostrEvent | null => {
  try {
    const kept = JSON.parse(globalThis.localStorage?.getItem(LIST_KEY) ?? "null") as unknown;
    return verifyEvent(kept) && kept.kind === RELAY_LIST_KIND && kept.pubkey === who ? kept : null;
  } catch {
    return null;
  }
};
const keepList = (list: NostrEvent) => {
  try {
    globalThis.localStorage?.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    /* a private window: for this page only */
  }
};
/** Where nothing can be kept on the device (a private window, or no browser): remembered for the page. */
let mendedHere: Record<string, number> = {};
const mended = (): Record<string, number> => {
  try {
    const kept = JSON.parse(globalThis.localStorage?.getItem(MENDED_KEY) ?? "null") as unknown;
    return kept && typeof kept === "object" && !Array.isArray(kept) ? (kept as Record<string, number>) : mendedHere;
  } catch {
    return mendedHere;
  }
};

type Asked = { said: string; ids: Set<string> };
/** Ask each relay on its own (one socket each, as asking them together is), so what each one has is known. */
const askEach = async (urls: string[], filter: Filter, ms: number, query: typeof queryRelays, now: () => number, into: Map<string, Asked>, events: Map<string, NostrEvent>) => {
  await Promise.all(
    urls.map(async (url) => {
      const got = await query([url], filter, ms).catch(() => ({ events: [] as NostrEvent[], relays: { [url]: "error: not asked" } }));
      learnFrom(got.relays, now());
      const ids = new Set<string>();
      for (const e of got.events) {
        if (!verifyEvent(e)) continue;
        ids.add(e.id);
        events.set(e.id, e);
      }
      into.set(url, { said: got.relays[url] ?? Object.values(got.relays)[0] ?? "timeout", ids });
    }),
  );
};

/** The newest of these, by date, the lower id on a tie. */
const newest = (events: NostrEvent[]): NostrEvent | null => events.slice().sort((x, y) => y.created_at - x.created_at || (x.id < y.id ? -1 : 1))[0] ?? null;

/**
 * Put a note back on the relays that answered to the end without it: at most `RELAY_PICK.mend`, each at most once a
 * day for that note. Already signed: nothing new is signed. Not waited for.
 */
const putBack = (note: NostrEvent, asked: Map<string, Asked>, o: { publish?: typeof publishEvent; now: () => number; first?: string[] }) => {
  // Outside a browser, only by what the caller handed in: a script or a test reaches no relay by this.
  if (!o.publish && typeof document === "undefined") return;
  // Never a wrapped private message, whoever asks: it goes only where its reader said their messages reach them
  // (sendWell keeps to that), and putting it back elsewhere would undo it.
  if (note.kind === WRAP_KIND) return;
  const done = mended();
  const at = o.now();
  const missing = [...asked.entries()]
    .filter(([url, a]) => a.said === "eose" && !a.ids.has(note.id) && !(at - (done[`${url} ${note.id}`] ?? -Infinity) < MENDED_FOR_MS))
    .map(([url]) => url);
  // Their own relays first, then the usual ones.
  const ownFirst = [...missing.filter((u) => o.first?.includes(u)), ...missing.filter((u) => !o.first?.includes(u))];
  const to = openOf(ownFirst, "write", at).slice(0, RELAY_PICK.mend);
  if (!to.length) return;
  const next = Object.fromEntries(Object.entries(done).filter(([, when]) => at - when < MENDED_FOR_MS));
  for (const url of to) next[`${url} ${note.id}`] = at;
  mendedHere = next;
  try {
    globalThis.localStorage?.setItem(MENDED_KEY, JSON.stringify(next));
  } catch {
    /* a private window: for this page only */
  }
  void (o.publish ?? publishEvent)(to, note)
    .then((sent) => learnFrom(sent.relays, o.now()))
    .catch(() => null);
};

/**
 * Ask each relay on its own, and be done once one has given something and the rest have had `grace`, or once all
 * have answered, or at `most`, whichever comes first. Those still asking go on answering into `into` after.
 */
const askFirst = (urls: string[], filter: Filter, most: number, grace: number, query: typeof queryRelays, now: () => number, into: Map<string, Asked>, events: Map<string, NostrEvent>, pending?: Promise<unknown>[]) =>
  new Promise<void>((done) => {
    let left = urls.length;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (graceTimer) clearTimeout(graceTimer);
      clearTimeout(cap);
      done();
    };
    const cap = setTimeout(finish, most);
    if (!left) return finish();
    for (const url of urls) {
      const asking = askEach([url], filter, most, query, now, into, events).then(() => {
        left--;
        if (events.size && !graceTimer) graceTimer = setTimeout(finish, grace);
        if (left === 0) finish();
      });
      // Each asking, to the end of its own wait: what still comes after the step is done is not lost.
      pending?.push(asking);
    }
  });

/**
 * A person's relay list (NIP-65), looked for on the usual relays: the best of them, as anything else is asked (a
 * relay known not to answer is not chosen). Taken once one has given it and the rest have had
 * `RELAY_PICK.graceMs`, or once all have answered, and never waited for longer than `RELAY_PICK.listWaitMs`: one
 * relay that never answers no longer holds every look for six seconds (the orchestrator, reading #531, 2026-11-24).
 * Where it is the visitor's own on their own device, the newest known is kept there and put back on a usual relay
 * that answered without it.
 */
const listOf = async (who: string, o: { usual: string[]; mine: boolean; query: typeof queryRelays; publish?: typeof publishEvent; now: () => number }): Promise<NostrEvent | null> => {
  const asked = new Map<string, Asked>();
  const events = new Map<string, NostrEvent>();
  const best = relaysWell({ own: [], usual: o.usual, for: "read" }, o.now()).relays;
  await askFirst(best, { kinds: [RELAY_LIST_KIND], authors: [who], limit: 4 }, RELAY_PICK.listWaitMs, RELAY_PICK.graceMs, o.query, o.now, asked, events);
  const had = o.mine ? keptList(who) : (lists.get(who) ?? null);
  const list = newest([...events.values(), ...(had ? [had] : [])].filter((e) => e.kind === RELAY_LIST_KIND && e.pubkey === who));
  if (!list) return null;
  if (o.mine) {
    keepList(list);
    putBack(list, asked, o);
  } else lists.set(who, list);
  return list;
};

/**
 * A person's own relays, as their relay list gives them, for sending something of theirs: by the same rules as a
 * look (`askOwn`). The visitor's own list (`mine`) is kept on their device once known and used at once, while a
 * newer one is asked for behind; anyone else's is kept for the page's life. A list not found is never kept: it is
 * asked for again next time. Empty where none was found.
 */
export async function relaysOf(who: string, o: { usual: string[]; mine?: boolean; query?: typeof queryRelays; publish?: typeof publishEvent; now?: () => number }): Promise<string[]> {
  const known = o.mine ? keptList(who) : (lists.get(who) ?? null);
  const coming = listOf(who, { usual: o.usual, mine: !!o.mine, query: o.query ?? queryRelays, ...(o.publish ? { publish: o.publish } : {}), now: o.now ?? (() => Date.now()) }).catch(() => null);
  const list = known ?? (await coming);
  return readRelayList(list ? [list] : [], who)?.write ?? [];
}

/**
 * Look for a person's own note: `filter` asks for it, `who` is whose it is.
 *
 * - Their relay list is asked for on the usual relays while the usual relays are asked for the note, and waited
 *   for up to `RELAY_PICK.listWaitMs`. When it comes, their own relays, best first, are asked too. The visitor's own
 *   list, once known, is kept on their device and used at once next time while a newer one is asked for. A list
 *   not found is never kept: it is asked for again next time.
 * - `mine`, the visitor's own note on their own device: where nothing was found, the rest of their listed relays
 *   (up to `RELAY_PICK.listed`) are asked in waves of `RELAY_PICK.wave`, each waited for `RELAY_PICK.waveMs`; then
 *   each relay that ran out of time is asked once more, waited for `RELAY_PICK.lateMs`. `onWave` is told as each wave begins (its number, and how many of their own relays are asked with it, of how many)
 *   begins. Their newest note, found or `mine.kept` on the device, is put back where it is missing (`RELAY_PICK.mend`).
 *   Anyone else's note gets the first look and no more: no waves, nothing put back.
 * - "none" only once every relay there was to ask was asked, and at least half of those asked answered to the end,
 *   and never fewer than three of them (or all, where fewer than three could be asked). Otherwise "unreached".
 * - Relays found closed to reading take no place. One that answered with a challenge to sign in and then to the end
 *   answered like any other.
 * - Where nobody answered at all, a few relays monitors found working are asked, as `askWell` does.
 */
export async function askOwn(
  filter: Filter,
  who: string,
  o: { usual: string[]; mine?: { kept?: NostrEvent | null } | false; query?: typeof queryRelays; publish?: typeof publishEvent; timeoutMs?: number; now?: () => number; onWave?: (wave: number, asked: number, of: number) => void; onNewer?: (got: AskedOwn) => void },
): Promise<AskedOwn> {
  const query = o.query ?? queryRelays;
  const now = o.now ?? (() => Date.now());
  const mine = !!o.mine;
  const first = o.timeoutMs ?? 4000;
  const asked = new Map<string, Asked>();
  const events = new Map<string, NostrEvent>();
  // Each step of the look is done once something was found and the rest have had `RELAY_PICK.graceMs`, or once all
  // have answered: one relay that never answers holds nothing up once another has answered with it.
  // The askings still going when a step was done: a slower relay may hold a newer note than the first to answer.
  const pending: Promise<unknown>[] = [];
  const ask = (urls: string[], ms: number) => askFirst(urls.filter((u) => !asked.has(u)), filter, ms, RELAY_PICK.graceMs, query, now, asked, events, pending);

  // What is known of their list now, and what will be known when it comes.
  const known = mine ? keptList(who) : (lists.get(who) ?? null);
  const coming = listOf(who, { usual: o.usual, mine, query, ...(o.publish ? { publish: o.publish } : {}), now });
  const ownOf = (list: NostrEvent | null) => readRelayList(list ? [list] : [], who)?.write ?? [];

  // The first look: the usual relays at once, with their own already known; then their own as the list comes.
  const firstPick = relaysWell({ own: ownOf(known), usual: o.usual, for: "read", usualAtLeast: 1 }, now()).relays;
  const list = await Promise.all([ask(firstPick, first), coming]).then(([, l]) => l ?? known);
  const own = ownOf(list);
  await ask(relaysWell({ own, usual: [], for: "read" }, now()).relays, first);

  if (mine && events.size === 0) {
    // The rest of their relays, in waves, best first.
    const rest = openOf(own, "read", now()).filter((u) => !asked.has(u));
    // How many of their own relays are asked, with this wave, of how many: for a line that says what is going on.
    const askedOfOwn = () => own.filter((u) => asked.has(u)).length;
    for (let i = 0, wave = 1; i < rest.length && events.size === 0; i += RELAY_PICK.wave, wave++) {
      const batch = rest.slice(i, i + RELAY_PICK.wave);
      o.onWave?.(wave, askedOfOwn() + batch.length, own.length);
      await ask(batch, RELAY_PICK.waveMs);
    }
    // Then once more, waited for longer, each that ran out of time.
    const late = [...asked.entries()].filter(([, a]) => a.said === "timeout").map(([url]) => url);
    for (let i = 0, wave = 1; i < late.length && events.size === 0; i += RELAY_PICK.wave, wave++) {
      o.onWave?.(wave, askedOfOwn(), own.length);
      await askFirst(late.slice(i, i + RELAY_PICK.wave), filter, RELAY_PICK.lateMs, RELAY_PICK.graceMs, query, now, asked, events, pending);
    }
  }

  // Nobody answered: a few found by monitors, as everywhere else.
  const answered = () => [...asked.values()].filter((a) => a.said === "eose").length;
  if (answered() === 0 && events.size === 0 && mayAskBackUp([...asked.keys()], o)) {
    const more = (await foundRelays({ not: [...asked.keys()], ...(o.query ? { query: o.query } : {}), now })).open.slice(0, BACKUP_AT_ONCE);
    if (more.length) await ask(more, first);
  }

  const all = [...events.values()];
  const relays = Object.fromEntries([...asked.entries()].map(([url, a]) => [url, a.said]));
  let state: AskedOwn["state"] = "found";
  if (!all.length) {
    const n = asked.size;
    const need = Math.min(n, Math.max(3, Math.ceil(n / 2)));
    // Mine: every listed relay of theirs that could be asked, was.
    const everyOne = !mine || openOf(own, "read", now()).every((u) => asked.has(u));
    state = n > 0 && answered() >= need && everyOne ? "none" : "unreached";
  }
  // Once every asking has come to its end: a newer note from a slower relay is taken when it comes, and the caller
  // is told (`onNewer`); and only then is anything put back, the newest of all, so an older one is never put back
  // over a newer (the orchestrator, giving `RELAY_PICK.graceMs`, 2026-11-24). What it keeps open: the sockets of
  // relays that hadn't answered when the step was done, each to the end of its own wait, as before.
  const ownDevice = o.mine;
  const shown = newest(all);
  void Promise.all(pending).then(() => {
    const everything = [...events.values()];
    const latest = newest(everything);
    if (latest && shown && latest.id !== shown.id && latest.created_at > shown.created_at && o.onNewer)
      o.onNewer({ events: everything, state: "found", relays: Object.fromEntries([...asked.entries()].map(([url, a]) => [url, a.said])), own });
    if (ownDevice) {
      const note = newest([...everything, ...(ownDevice.kept ? [ownDevice.kept] : [])]);
      if (note && note.pubkey === who) putBack(note, asked, { ...(o.publish ? { publish: o.publish } : {}), now, first: own });
    }
  });
  return { events: all, state, relays, own };
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
  lists.clear();
  mendedHere = {};
  found = null;
  backup = true;
  try {
    globalThis.localStorage?.removeItem(FOUND_KEY);
    globalThis.localStorage?.removeItem(KEY);
    globalThis.localStorage?.removeItem(LIST_KEY);
    globalThis.localStorage?.removeItem(MENDED_KEY);
  } catch {
    /* nothing kept */
  }
}
