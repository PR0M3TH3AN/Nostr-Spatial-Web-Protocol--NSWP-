/** Lasting connections to a few relays: one subscription, and a way to send. They come back by themselves. */
import type { NostrEvent } from "@nswp/core";

export interface RelayLinks {
  publish(event: NostrEvent): void;
  /** How many are connected now. */
  count(): number;
  close(): void;
}

export function openRelays(urls: string[], filter: Record<string, unknown>, onEvent: (event: unknown) => void, onCount?: (open: number) => void): RelayLinks {
  const sockets = new Map<string, WebSocket>();
  const seen = new Set<string>();
  let closed = false;
  const count = () => [...sockets.values()].filter((s) => s.readyState === WebSocket.OPEN).length;

  const connect = (url: string) => {
    if (closed) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    sockets.set(url, ws);
    ws.onopen = () => {
      ws.send(JSON.stringify(["REQ", "bridge", { ...filter, since: Math.floor(Date.now() / 1000) - 5 }]));
      onCount?.(count());
    };
    ws.onmessage = (msg) => {
      let data: unknown;
      try {
        data = JSON.parse(String(msg.data));
      } catch {
        return;
      }
      if (!Array.isArray(data) || data[0] !== "EVENT" || data[1] !== "bridge") return;
      const id = (data[2] as { id?: unknown } | null)?.id;
      // The same note comes from every relay; it is read once.
      if (typeof id !== "string" || seen.has(id)) return;
      seen.add(id);
      if (seen.size > 2000) seen.clear();
      onEvent(data[2]);
    };
    ws.onclose = () => {
      if (sockets.get(url) === ws) sockets.delete(url);
      onCount?.(count());
      if (!closed) setTimeout(() => connect(url), 5000).unref?.();
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  };
  urls.forEach(connect);

  return {
    publish(event) {
      const frame = JSON.stringify(["EVENT", event]);
      for (const ws of sockets.values()) if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    },
    count,
    close() {
      closed = true;
      for (const ws of sockets.values()) ws.close();
      sockets.clear();
    },
  };
}
