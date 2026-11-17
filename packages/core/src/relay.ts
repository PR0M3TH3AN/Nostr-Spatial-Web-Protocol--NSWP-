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

export const DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];

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
