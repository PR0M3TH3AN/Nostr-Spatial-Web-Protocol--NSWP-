import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A room's TURN servers, asked for where it is told to (`iceFrom`, services/ice/): once as it is joined, at most 3
 * seconds waited, and again before they run out, for connections already made too. Nothing is reached: the address
 * asked is a stand-in, and so are the sockets and connections.
 */
const WHERE = "https://ice.example/";
let room: typeof import("../src/room.js").room;
let ICE_FROM: typeof import("../src/room.js").ICE_FROM;
const made: { config: RTCConfiguration; set: RTCConfiguration[] }[] = [];
let asked: string[] = [];
let answer: () => Promise<Response>;

beforeEach(async () => {
  made.length = 0;
  asked = [];
  vi.stubGlobal("location", { origin: "https://world.example", pathname: "/" });
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
  vi.stubGlobal("WebSocket", Object.assign(class { readyState = 0; send() {} close() {} }, { OPEN: 1 }));
  vi.stubGlobal("RTCPeerConnection", class {
    connectionState = "connecting";
    signalingState = "stable";
    onconnectionstatechange: (() => void) | null = null;
    me: { config: RTCConfiguration; set: RTCConfiguration[] };
    constructor(config: RTCConfiguration) { this.me = { config, set: [] }; made.push(this.me); }
    setConfiguration(c: RTCConfiguration) { this.me.set.push(c); }
    close() {}
    getTransceivers() { return []; }
  });
  vi.stubGlobal("fetch", async (url: string) => (asked.push(url), answer()));
  ({ room, ICE_FROM } = await import("../src/room.js"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const TURN = { urls: ["turn:turn.example:3478?transport=udp", "turns:turn.example:443?transport=tcp"], username: "made-up", credential: "made-up-too" };
const good = (o: { ttl?: number; username?: string } = {}) => async () => new Response(JSON.stringify({ iceServers: [{ urls: ["stun:stun.example:3478"] }, { ...TURN, ...(o.username ? { username: o.username } : {}) }], ttl: o.ttl ?? 3600 }));
const connect = (s: Awaited<ReturnType<typeof room.join>>, pubkey = "f".repeat(64)) => (s as unknown as { createPeer(p: string): unknown }).createPeer(pubkey);

describe("a room's TURN servers", () => {
  it("are asked nowhere by default, until the kit names its own", async () => {
    expect(ICE_FROM).toBeNull();
    answer = good();
    const s = await room.join({ world: "https://world.example/", relays: [] });
    connect(s);
    expect(asked).toEqual([]);
    expect(made[0]!.config.iceServers!.some((x) => x.username)).toBe(false);
    s.leave();
  });

  it("are asked for once as the room is joined, and used beside its STUN", async () => {
    answer = good();
    const s = await room.join({ world: "https://world.example/", relays: [], iceFrom: WHERE });
    connect(s);
    expect(asked).toEqual([WHERE]);
    const servers = made[0]!.config.iceServers!;
    expect(servers.filter((x) => !x.username).length).toBeGreaterThan(0);
    expect(servers.filter((x) => x.username)).toEqual([TURN]);
    s.leave();
  });

  it("take only what is well formed: a TURN entry with no credential, or an odd address, is left out", async () => {
    answer = async () => new Response(JSON.stringify({ iceServers: [{ urls: ["turn:no-credential.example"] }, { urls: ["javascript:alert(1)"], username: "a", credential: "b" }, TURN], ttl: 3600 }));
    const s = await room.join({ world: "https://world.example/", relays: [], iceFrom: WHERE });
    connect(s);
    expect(made[0]!.config.iceServers!.filter((x) => x.username)).toEqual([TURN]);
    s.leave();
  });

  it("are waited for 3 seconds at most: a room is joined with STUN alone where they don't come", async () => {
    answer = () => new Promise<Response>(() => {});
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      asked.push(url);
      return new Promise<Response>((_, fail) => init.signal?.addEventListener("abort", () => fail(new Error("timed out"))));
    });
    const t0 = Date.now();
    const s = await room.join({ world: "https://world.example/", relays: [], iceFrom: WHERE });
    const took = Date.now() - t0;
    expect(took).toBeGreaterThanOrEqual(2900);
    expect(took).toBeLessThan(4500);
    connect(s);
    expect(made[0]!.config.iceServers!.some((x) => x.username)).toBe(false);
    s.leave();
  }, 8000);

  it("are asked for again before they run out, and handed to connections already made", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    answer = good({ ttl: 3600 });
    const s = await room.join({ world: "https://world.example/", relays: [], iceFrom: WHERE });
    connect(s);
    answer = good({ ttl: 3600, username: "renewed" });
    await vi.advanceTimersByTimeAsync(3600 * 800 - 1000);
    expect(asked).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(asked).toHaveLength(2);
    expect(made[0]!.set.at(-1)!.iceServers!.find((x) => x.username)!.username).toBe("renewed");
    s.leave();
  });
});
