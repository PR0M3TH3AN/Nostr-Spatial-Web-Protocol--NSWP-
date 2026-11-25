import { DEFAULT_RELAYS, ROOM_RELAYS } from "@nswp/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A room's relays (docs/backlog/rooms-that-fill-and-always-connect.md, part 4). The owner, 2026-11-25: two of his
 * computers met in the Grove's room on one relay only. Eight now, so two visitors who each reach most share several.
 * Nothing is reached here: the sockets are stand-ins that only say where they were asked to go.
 */
let RoomSession: typeof import("../src/room.js").RoomSession;
const asked: string[] = [];
beforeEach(async () => {
  asked.length = 0;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.stubGlobal("location", { origin: "https://world.example", pathname: "/" });
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
  vi.stubGlobal("WebSocket", Object.assign(class {
    readyState = 0;
    constructor(url: string) { asked.push(url); }
    send() {}
    close() {}
  }, { OPEN: 1 }));
  ({ RoomSession } = await import("../src/room.js"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a room's relays", () => {
  it("are eight, the usual four first, each once and each its own", () => {
    expect(ROOM_RELAYS).toHaveLength(8);
    expect(ROOM_RELAYS.slice(0, 4)).toEqual(DEFAULT_RELAYS);
    expect(new Set(ROOM_RELAYS).size).toBe(8);
    expect(new Set(ROOM_RELAYS.map((u) => new URL(u).hostname)).size).toBe(8);
    for (const u of ROOM_RELAYS) expect(u).toMatch(/^wss:\/\/[a-z0-9.-]+$/);
  });

  it("are all asked by a room that names none", () => {
    const s = new RoomSession({ world: "https://world.example/" });
    s.start();
    expect(asked).toEqual([...ROOM_RELAYS]);
    expect(s.relays).toEqual([...ROOM_RELAYS]);
    s.leave();
  });

  it("give way to a world's own", () => {
    const s = new RoomSession({ world: "https://world.example/", relays: ["wss://relay.world.example"] });
    s.start();
    expect(asked).toEqual(["wss://relay.world.example"]);
    s.leave();
  });
});
