import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanLocalMap, fromLocal, isLocalHost, localMap, mapFromLocal, mapToLocal, setLocalMap, toLocal } from "../src/local.js";

afterEach(() => {
  setLocalMap(undefined);
  vi.unstubAllGlobals();
});

describe("local copies", () => {
  it("knows a host only this machine or network can reach", () => {
    for (const h of ["localhost", "world.localhost", "127.0.0.1", "[::1]", "::1", "10.0.0.7", "172.16.4.1", "172.31.255.255", "192.168.68.84", "169.254.1.1"]) expect(isLocalHost(h), h).toBe(true);
    for (const h of ["gallery.bitblocks.network", "localhost.example.com", "172.32.0.1", "172.15.0.1", "192.169.1.1", "8.8.8.8", "1.2.3", "999.168.1.1", "192.168.1.256", ""]) expect(isLocalHost(h), h).toBe(false);
  });

  it("keeps only what leads from a real https address to a local one", () => {
    const map = cleanLocalMap({
      "https://gallery.bitblocks.network": "http://localhost:4301",
      "https://grove.bitblocks.network/": "http://192.168.68.84:4302/",
      // Each of these is left out.
      "http://plain.example": "http://localhost:1",
      "https://elsewhere.example": "https://evil.example",
      "https://out.example": "http://evil.example",
      // A local copy may be served over https, with a certificate made on that machine.
      "https://secure-local.example": "https://192.168.68.84:4303",
      "https://not-a-web-address.example": "ftp://localhost:21",
      "https://localhost": "http://localhost:2",
      "https://user:pw@creds.example": "http://localhost:3",
      "not an address": "http://localhost:4",
      "https://number.example": 5,
    });
    expect([...map]).toEqual([
      ["https://gallery.bitblocks.network", "http://localhost:4301"],
      ["https://grove.bitblocks.network", "http://192.168.68.84:4302"],
      ["https://secure-local.example", "https://192.168.68.84:4303"],
    ]);
    expect(cleanLocalMap(null).size).toBe(0);
    expect(cleanLocalMap(["https://a.example"]).size).toBe(0);
    expect(cleanLocalMap(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`https://w${i}.example`, `http://localhost:${5000 + i}`]))).size).toBe(64);
  });

  it("follows the map for an address's origin and leaves the rest of it alone", () => {
    const map = cleanLocalMap({ "https://portal.bitblocks.network": "http://localhost:4300", "https://gallery.bitblocks.network": "http://localhost:4301" });
    expect(mapToLocal("https://portal.bitblocks.network/go/#to=https%3A%2F%2Fgallery.bitblocks.network%2F&moving=intense", map)).toBe("http://localhost:4300/go/#to=https%3A%2F%2Fgallery.bitblocks.network%2F&moving=intense");
    expect(mapToLocal("https://gallery.bitblocks.network/?xr=emulate#nswp=abc", map)).toBe("http://localhost:4301/?xr=emulate#nswp=abc");
    // A site with no local copy is still the real one, and a lookalike is not the site.
    expect(mapToLocal("https://grove.bitblocks.network/", map)).toBe("https://grove.bitblocks.network/");
    expect(mapToLocal("https://gallery.bitblocks.network.evil.example/", map)).toBe("https://gallery.bitblocks.network.evil.example/");
    expect(mapToLocal("nonsense", map)).toBe("nonsense");
    // An arrival is long: a pass, a look and settings are all after the #. It is followed all the same.
    const long = `https://gallery.bitblocks.network/#nswp=${"A".repeat(3000)}`;
    expect(mapToLocal(long, map)).toBe(`http://localhost:4301/#nswp=${"A".repeat(3000)}`);
    expect(mapFromLocal(`http://localhost:4301/#nswp=${"A".repeat(3000)}`, map)).toBe(long);
    expect(mapFromLocal("http://localhost:4300/go/", map)).toBe("https://portal.bitblocks.network/go/");
    expect(mapFromLocal("http://localhost:9999/go/", map)).toBe("http://localhost:9999/go/");
    expect(mapToLocal("https://gallery.bitblocks.network/", new Map())).toBe("https://gallery.bitblocks.network/");
  });

  it("asks for no map on a deployed site, and changes nothing there", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    vi.stubGlobal("location", { protocol: "https:", hostname: "gallery.bitblocks.network" });
    expect((await localMap()).size).toBe(0);
    expect(await toLocal("https://grove.bitblocks.network/")).toBe("https://grove.bitblocks.network/");
    expect(fetched).not.toHaveBeenCalled();
  });

  it("asks for no map on a page that only looks local, whatever it is served over", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    for (const location of [
      { protocol: "http:", hostname: "localhost.example.com" },
      { protocol: "https:", hostname: "localhost.example.com" },
      { protocol: "https:", hostname: "192-168-68-84.example.com" },
      { protocol: "https:", hostname: "100.121.92.77" },
      { protocol: "file:", hostname: "localhost" },
    ]) {
      setLocalMap(undefined);
      vi.stubGlobal("location", location);
      expect((await localMap()).size, JSON.stringify(location)).toBe(0);
    }
    expect(fetched).not.toHaveBeenCalled();
  });

  it("follows a map on a local host served over https, to https copies", async () => {
    const fetched = vi.fn(async () => ({ ok: true, json: async () => ({ "https://gallery.bitblocks.network": "https://192.168.68.84:4301", "https://out.example": "https://evil.example" }) }));
    vi.stubGlobal("fetch", fetched);
    vi.stubGlobal("location", { protocol: "https:", hostname: "192.168.68.84" });
    expect(await toLocal("https://gallery.bitblocks.network/walk/#back")).toBe("https://192.168.68.84:4301/walk/#back");
    expect(await toLocal("https://out.example/")).toBe("https://out.example/");
    expect(await fromLocal("https://192.168.68.84:4301/x")).toBe("https://gallery.bitblocks.network/x");
    expect(fetched).toHaveBeenCalledTimes(1);
  });

  it("reads the map its own server publishes when the page is on a local host", async () => {
    const fetched = vi.fn(async () => ({ ok: true, json: async () => ({ "https://gallery.bitblocks.network": "http://192.168.68.84:4301", "https://out.example": "https://evil.example" }) }));
    vi.stubGlobal("fetch", fetched);
    vi.stubGlobal("location", { protocol: "http:", hostname: "192.168.68.84" });
    expect(await toLocal("https://gallery.bitblocks.network/")).toBe("http://192.168.68.84:4301/");
    expect(await toLocal("https://out.example/")).toBe("https://out.example/");
    expect(await fromLocal("http://192.168.68.84:4301/x")).toBe("https://gallery.bitblocks.network/x");
    // Asked for once, from this page's own server and nowhere else.
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(fetched.mock.calls[0]![0]).toBe("/.well-known/nswp-local.json");
  });

  it("still follows a map that is slow to come, and doesn't wait for one that never does", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("location", { protocol: "http:", hostname: "localhost" });
      // A page busy starting up hears back late: the map is still used once it is there.
      let answer: (v: unknown) => void = () => {};
      vi.stubGlobal("fetch", vi.fn(() => new Promise((done) => (answer = done))));
      void localMap();
      await vi.advanceTimersByTimeAsync(5000);
      answer({ ok: true, json: async () => ({ "https://gallery.bitblocks.network": "http://localhost:4301" }) });
      expect(await toLocal("https://gallery.bitblocks.network/")).toBe("http://localhost:4301/");
      // A server that never answers: a door gives up after a moment and leads to the real place.
      setLocalMap(undefined);
      vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
      const going = toLocal("https://gallery.bitblocks.network/");
      await vi.advanceTimersByTimeAsync(2100);
      expect(await going).toBe("https://gallery.bitblocks.network/");
    } finally {
      vi.useRealTimers();
    }
  });

  it("has no map where the server has none, or answers with something else", async () => {
    vi.stubGlobal("location", { protocol: "http:", hostname: "localhost" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect((await localMap()).size).toBe(0);
    setLocalMap(undefined);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await localMap()).size).toBe(0);
    setLocalMap(undefined);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => "<html>" })));
    expect((await localMap()).size).toBe(0);
  });
});
