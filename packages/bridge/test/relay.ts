/**
 * A relay small enough to read, for tests: it keeps the last few events and
 * passes each to whoever asked for its like. Nothing here leaves the machine.
 */
import { WebSocketServer, type WebSocket } from "ws";

type Filter = { kinds?: number[]; authors?: string[]; since?: number; "#x"?: string[]; "#p"?: string[] };
type Event = { id: string; kind: number; pubkey: string; created_at: number; tags: string[][] };

const matches = (f: Filter, e: Event) =>
  (!f.kinds || f.kinds.includes(e.kind)) &&
  (!f.authors || f.authors.includes(e.pubkey)) &&
  (f.since === undefined || e.created_at >= f.since) &&
  (["x", "p"] as const).every((t) => !f[`#${t}`] || e.tags.some((tag) => tag[0] === t && f[`#${t}`]!.includes(tag[1]!)));

export interface TestRelay {
  url: string;
  /** Everything it was sent, oldest first. */
  events: Event[];
  close(): Promise<void>;
}

export function startRelay(port = 0): Promise<TestRelay> {
  return new Promise((resolve) => {
    const server = new WebSocketServer({ host: "127.0.0.1", port });
    const subs = new Map<WebSocket, Map<string, Filter[]>>();
    const events: Event[] = [];
    server.on("connection", (ws) => {
      subs.set(ws, new Map());
      ws.on("close", () => subs.delete(ws));
      ws.on("message", (raw) => {
        let msg: unknown[];
        try {
          msg = JSON.parse(String(raw)) as unknown[];
        } catch {
          return;
        }
        if (msg[0] === "REQ") {
          const filters = msg.slice(2) as Filter[];
          subs.get(ws)!.set(String(msg[1]), filters);
          for (const e of events) if (filters.some((f) => matches(f, e))) ws.send(JSON.stringify(["EVENT", msg[1], e]));
          ws.send(JSON.stringify(["EOSE", msg[1]]));
        } else if (msg[0] === "CLOSE") subs.get(ws)!.delete(String(msg[1]));
        else if (msg[0] === "EVENT") {
          const e = msg[1] as Event;
          events.push(e);
          if (events.length > 500) events.shift();
          ws.send(JSON.stringify(["OK", e.id, true, ""]));
          for (const [sock, mine] of subs) for (const [id, filters] of mine) if (filters.some((f) => matches(f, e))) sock.send(JSON.stringify(["EVENT", id, e]));
        }
      });
    });
    server.on("listening", () => {
      const { port: at } = server.address() as { port: number };
      resolve({
        url: `ws://127.0.0.1:${at}`,
        events,
        close: () =>
          new Promise((done) => {
            for (const ws of server.clients) ws.terminate();
            server.close(() => done());
          }),
      });
    });
  });
}
