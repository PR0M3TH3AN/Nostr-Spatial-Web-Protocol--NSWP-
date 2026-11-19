import { describe, expect, it } from "vitest";
import { buildAirlockUrl, buildWayUrl, decodeNaddr, doorFor, parseAirlockFragment, wayWithoutDestination, WORLD_KIND, type Manifest } from "../src/index.js";

const KEY = "a".repeat(64);
const OTHER = "b".repeat(64);
const manifest = (publishers: Manifest["publishers"]): Manifest => ({
  schema: "nswp/manifest/0.3",
  listing: "allow",
  publishers,
  worlds: { garden: { entry: { url: "https://garden.example/", modes: ["inline-3d"] }, entryPoints: [], capabilities: [] } },
  relays: ["wss://one.example", "wss://two.example", "wss://three.example"],
});

describe("asking to say who you are, from inside a world", () => {
  it("is a flag on a door, read back as a request", () => {
    const link = buildAirlockUrl("https://lobby.example/go/", { url: "https://garden.example/" }, { who: true, immersive: true });
    expect(new URL(link).hash).toContain("who=1");
    const req = parseAirlockFragment(new URL(link).hash);
    expect(req?.who).toBe(true);
    expect(req?.url).toBe("https://garden.example/");
    expect(req?.immersive).toBe(true);
  });

  it("is not there unless asked for", () => {
    const link = buildAirlockUrl("https://lobby.example/go/", { url: "https://garden.example/" });
    expect(new URL(link).hash).not.toContain("who");
    expect(parseAirlockFragment(new URL(link).hash)?.who).toBeUndefined();
  });

  it("means nothing but itself: only who=1 is the request", () => {
    expect(parseAirlockFragment("#to=https%3A%2F%2Fgarden.example%2F&who=yes")?.who).toBeUndefined();
    expect(parseAirlockFragment("#to=https%3A%2F%2Fgarden.example%2F&who=1&name=alice")?.who).toBe(true);
  });

  it("never rides on the way home, which has no world to come back to", () => {
    const home = buildWayUrl("https://lobby.example/go/", { who: true } as never);
    expect(new URL(home).hash).not.toContain("who");
    expect(wayWithoutDestination("#who=1")).toBeNull();
  });
});

describe("a world's own door", () => {
  it("is the announcement its manifest lists for the address", () => {
    const door = doorFor(manifest({ [KEY]: { worlds: ["garden"] } }), "https://garden.example/");
    expect(door.url).toBe("https://garden.example/");
    const pointer = decodeNaddr(door.naddr!);
    expect(pointer).toMatchObject({ kind: WORLD_KIND, pubkey: KEY, identifier: "garden" });
    expect(pointer.relays).toEqual(["wss://one.example", "wss://two.example"]);
  });

  it("is the address alone when the manifest lists nothing for it", () => {
    expect(doorFor(manifest({ [KEY]: { worlds: ["garden"] } }), "https://garden.example/elsewhere/")).toEqual({ url: "https://garden.example/elsewhere/" });
    expect(doorFor(manifest({ [KEY]: { worlds: [] } }), "https://garden.example/")).toEqual({ url: "https://garden.example/" });
  });

  it("is the address alone when two publishers claim it: the visitor's client isn't told which to believe", () => {
    expect(doorFor(manifest({ [KEY]: { worlds: ["garden"] }, [OTHER]: { worlds: ["garden"] } }), "https://garden.example/").naddr).toBeUndefined();
  });
});
