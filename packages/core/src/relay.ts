/**
 * A deliberately small NIP-01 relay client: one REQ per relay, collect until
 * EOSE or timeout, verify every signature locally (spec §5.6). Works in
 * browsers and Node 22+ (global WebSocket).
 */
import { verifyEvent, type NostrEvent } from "./event.js";

export interface Filter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  [tag: `#${string}`]: string[] | undefined;
}

// Checked 2026-11-17: these accepted WebSocket connections and the reference
// announcements. relay.damus.io refused WebSocket upgrades from our test network.
export const DEFAULT_RELAYS = ["wss://nos.lol", "wss://relay.primal.net", "wss://relay.snort.social", "wss://nostr.mom"];

/** A person's own relay list (NIP-65): the relays they say they write to and read from. */
export const RELAY_LIST_KIND = 10002;

export interface RelayList {
  /** Where they publish: where their notes are sent, and where to look for them. */
  write: string[];
  /** Where they read: where a note that mentions them is sent. */
  read: string[];
}

/**
 * A relay's address as it may be connected to: `wss`, a real host name, no
 * credentials, at most 200 characters. "" for anything else. A list is
 * someone's own say, and still only an address on the open web is dialled:
 * never plain `ws`, a bare machine name, or a number for a machine.
 */
export function cleanRelayUrl(url: unknown): string {
  if (typeof url !== "string" || url.length > 200) return "";
  try {
    const u = new URL(url.trim());
    const host = u.hostname;
    if (u.protocol !== "wss:" || u.username || u.password) return "";
    if (!host.includes(".") || host.startsWith("[") || /^[0-9.]+$/.test(host) || /\.(local|localhost|internal|lan|home)$/i.test(host)) return "";
    u.hash = "";
    return u.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/**
 * Read someone's relay list out of what relays returned: their newest kind
 * 10002 event, its `r` tags, cleaned, with no relay twice and at most `max`
 * of each. A tag with no marker is both. Null when they have published none.
 * The events are taken as already checked (`queryRelays` checks every
 * signature); whose they are is checked here.
 */
export function readRelayList(events: NostrEvent[], pubkey: string, max = 8): RelayList | null {
  const latest = events.filter((e) => e.kind === RELAY_LIST_KIND && e.pubkey === pubkey).sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1))[0];
  if (!latest) return null;
  const write: string[] = [];
  const read: string[] = [];
  for (const t of latest.tags) {
    if (t[0] !== "r") continue;
    const url = cleanRelayUrl(t[1]);
    if (!url) continue;
    if ((t[2] === undefined || t[2] === "" || t[2] === "write") && !write.includes(url) && write.length < max) write.push(url);
    if ((t[2] === undefined || t[2] === "" || t[2] === "read") && !read.includes(url) && read.length < max) read.push(url);
  }
  return { write, read };
}

/**
 * Where one of someone's notes is sent, and where theirs are looked for
 * (NIP-65): the relays they write to. A list too thin to count on (fewer
 * than two) is filled out from `fallback`, to four in all; with no list, it
 * is `fallback`. `own` says how many of them are the person's own.
 */
export function writeRelaysFor(list: RelayList | null, fallback: string[]): { relays: string[]; own: number } {
  const own = (list?.write ?? []).slice(0, 6);
  if (own.length >= 2) return { relays: own, own: own.length };
  const relays = [...own];
  for (const url of fallback) {
    if (relays.length >= 4) break;
    if (!relays.includes(url)) relays.push(url);
  }
  return { relays, own: own.length };
}

// ---- Which relays are working. A relay that is down, slow or refusing is no use to anyone, whoever chose it. So a
// client keeps a note of how each relay it has used answered, and leans on the ones that have been answering.

/** What is remembered of one relay: how often it answered and how often it didn't, lately, and when it was last tried. */
export interface RelayNote {
  ok: number;
  failed: number;
  /** When it was last tried, in milliseconds. */
  at: number;
}
export type RelayNotes = Record<string, RelayNote>;

export const RELAY_PICK = {
  /** A person's own relays are used up to this many. */
  most: 6,
  /** There should be this many that are thought to be working, their own or not. */
  least: 3,
  /** Below this, a relay is thought not to be working. One nothing is known of scores 0.5. */
  working: 0.34,
  /** What is remembered of a relay fades: past this many tries, the counts are halved, so lately counts for more. */
  remembered: 8,
  /** A relay that hasn't been tried for this long is given another chance: what was known of it is forgotten. */
  staleMs: 7 * 24 * 3600 * 1000,
  /** No more relays than this are remembered. */
  kept: 40,
} as const;

/** How far a relay can be counted on, 0 to 1, from what is remembered of it. Nothing known is 0.5. */
export function relayScore(note: RelayNote | undefined, now: number): number {
  if (!note || now - note.at > RELAY_PICK.staleMs) return 0.5;
  return (note.ok + 1) / (note.ok + note.failed + 2);
}

/**
 * What is remembered, after some relays were asked or sent to: `results` is what `queryRelays` or `publishEvent`
 * said of each. "ok" and "eose" are an answer; anything else is none, or a refusal.
 */
export function learnRelays(notes: RelayNotes, results: Record<string, string>, now: number): RelayNotes {
  const next: RelayNotes = { ...notes };
  for (const [url, said] of Object.entries(results)) {
    const clean = cleanRelayUrl(url);
    if (!clean) continue;
    const had = next[clean] && now - next[clean]!.at <= RELAY_PICK.staleMs ? next[clean]! : { ok: 0, failed: 0, at: now };
    let { ok, failed } = had;
    if (said === "ok" || said === "eose") ok++;
    else failed++;
    if (ok + failed > RELAY_PICK.remembered) {
      ok = Math.round(ok / 2);
      failed = Math.round(failed / 2);
    }
    next[clean] = { ok, failed, at: now };
  }
  // The longest untried are forgotten first.
  const kept = Object.entries(next).sort((a, b) => b[1].at - a[1].at).slice(0, RELAY_PICK.kept);
  return Object.fromEntries(kept);
}

/**
 * Where to send something of a person's, and where to look for it.
 *
 * Their own relays come first, always: it is where they said they write, and where anyone looking for them will
 * look. They are put in order of how well they have been answering. If fewer than `least` of them are thought to
 * be working, the best of the usual relays are added, so that what is sent is kept somewhere that is up.
 * `own` is how many of the result are the person's own; `added` is which were added.
 */
export function pickRelays(o: { own: string[]; usual: string[]; notes: RelayNotes; now: number }): { relays: string[]; own: number; added: string[] } {
  const score = (url: string) => relayScore(o.notes[url], o.now);
  // Best first; ties keep the order they were given in.
  const best = (urls: string[]) => urls.map((url, i) => ({ url, i, s: score(url) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.url);
  const own = best([...new Set(o.own.map(cleanRelayUrl).filter(Boolean))]).slice(0, RELAY_PICK.most);
  const working = own.filter((url) => score(url) >= RELAY_PICK.working).length;
  const added: string[] = [];
  for (const url of best([...new Set(o.usual.map(cleanRelayUrl).filter(Boolean))].filter((u) => !own.includes(u)))) {
    if (working + added.length >= RELAY_PICK.least) break;
    if (score(url) < RELAY_PICK.working && added.length > 0) continue;
    added.push(url);
  }
  return { relays: [...own, ...added], own: own.length, added };
}

export interface QueryResult {
  events: NostrEvent[];
  /** Per relay: "eose", "timeout", or an error message. */
  relays: Record<string, string>;
}

export async function queryRelays(relays: string[], filter: Filter, timeoutMs = 4000): Promise<QueryResult> {
  const byId = new Map<string, NostrEvent>();
  const status: Record<string, string> = {};
  await Promise.all(
    [...new Set(relays)].map(
      (url) =>
        new Promise<void>((resolve) => {
          let ws: WebSocket;
          const subId = `nswp-${Math.random().toString(36).slice(2, 10)}`;
          const done = (s: string) => {
            if (status[url]) return;
            status[url] = s;
            clearTimeout(timer);
            try {
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(["CLOSE", subId]));
              ws.close();
            } catch {
              /* ignore */
            }
            resolve();
          };
          const timer = setTimeout(() => done("timeout"), timeoutMs);
          try {
            ws = new WebSocket(url);
          } catch (e) {
            done(`error: ${e instanceof Error ? e.message : String(e)}`);
            return;
          }
          ws.onopen = () => ws.send(JSON.stringify(["REQ", subId, filter]));
          ws.onerror = () => done("error: connection failed");
          ws.onclose = () => done("closed");
          ws.onmessage = (msg) => {
            let data: unknown;
            try {
              data = JSON.parse(String(msg.data));
            } catch {
              return;
            }
            if (!Array.isArray(data) || data[1] !== subId) return;
            if (data[0] === "EVENT" && verifyEvent(data[2])) byId.set(data[2].id, data[2]);
            else if (data[0] === "EOSE") done("eose");
            else if (data[0] === "CLOSED") done(`closed: ${String(data[2] ?? "")}`);
          };
        }),
    ),
  );
  return { events: [...byId.values()], relays: status };
}

/** For addressable events: keep only the newest event per (pubkey, kind, d). */
export function latestAddressable(events: NostrEvent[]): NostrEvent[] {
  const best = new Map<string, NostrEvent>();
  for (const e of events) {
    const d = e.tags.find((t) => t[0] === "d")?.[1] ?? "";
    const key = `${e.kind}:${e.pubkey}:${d}`;
    const cur = best.get(key);
    if (!cur || e.created_at > cur.created_at || (e.created_at === cur.created_at && e.id < cur.id)) best.set(key, e);
  }
  return [...best.values()];
}

export interface PublishResult {
  relays: Record<string, string>;
}

export async function publishEvent(relays: string[], event: NostrEvent, timeoutMs = 6000): Promise<PublishResult> {
  const status: Record<string, string> = {};
  await Promise.all(
    [...new Set(relays)].map(
      (url) =>
        new Promise<void>((resolve) => {
          let ws: WebSocket;
          const done = (s: string) => {
            if (status[url]) return;
            status[url] = s;
            clearTimeout(timer);
            try {
              ws.close();
            } catch {
              /* ignore */
            }
            resolve();
          };
          const timer = setTimeout(() => done("timeout"), timeoutMs);
          try {
            ws = new WebSocket(url);
          } catch (e) {
            done(`error: ${e instanceof Error ? e.message : String(e)}`);
            return;
          }
          ws.onopen = () => ws.send(JSON.stringify(["EVENT", event]));
          ws.onerror = () => done("error: connection failed");
          ws.onmessage = (msg) => {
            try {
              const data = JSON.parse(String(msg.data));
              if (Array.isArray(data) && data[0] === "OK" && data[1] === event.id) done(data[2] ? "ok" : `rejected: ${String(data[3] ?? "")}`);
            } catch {
              /* ignore */
            }
          };
        }),
    ),
  );
  return { relays: status };
}
