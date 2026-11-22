import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { cleanSettings, cleanFileHost, fileAt, fileExtension, FILE_HOST_LIMITS, FILE_HOST_LIST_KIND, FILE_HOSTS, finalizeEvent, getPublicKey, onFileHost, parseFileHostList } from "../src/index.js";

const KEY = sha256(utf8ToBytes("nswp core file hosts test key"));
const me = getPublicKey(KEY);
const H = "a".repeat(64);

describe("file hosts", () => {
  it("are left to the visitor's list by a link: only filesAnywhere off travels", () => {
    expect(cleanSettings({ filesAnywhere: true })).toEqual({});
    expect(cleanSettings({ filesAnywhere: false })).toEqual({ filesAnywhere: false });
  });

  it("are https prefixes ending in a slash, with nothing else in them", () => {
    expect(cleanFileHost("https://files.example")).toBe("https://files.example/");
    expect(cleanFileHost("https://files.example/items?x=1#y")).toBe("https://files.example/items/");
    expect(cleanFileHost("http://files.example/")).toBeNull();
    expect(cleanFileHost("https://me:pw@files.example/")).toBeNull();
    expect(cleanFileHost(`https://files.example/${"x".repeat(FILE_HOST_LIMITS.url)}`)).toBeNull();
    expect(FILE_HOSTS.every((h) => cleanFileHost(h) === h)).toBe(true);
  });

  it("serve a file at <host><sha256><ext>, the extension from the hint", () => {
    expect(fileExtension("https://x.example/a/b.GLB")).toBe(".glb");
    expect(fileExtension("https://x.example/a/b")).toBe("");
    expect(fileExtension("not a url")).toBe("");
    expect(fileAt("https://files.example/", H, "https://elsewhere.example/thing.ogg")).toBe(`https://files.example/${H}.ogg`);
    expect(onFileHost(`https://files.example/items/${H}.glb`, ["https://files.example/items/"])).toBe(true);
    expect(onFileHost(`https://files.example/other/${H}.glb`, ["https://files.example/items/"])).toBe(false);
    expect(onFileHost(`https://files.example.evil/items/${H}.glb`, ["https://files.example/"])).toBe(false);
  });

  it("are read from a person's own newest list, six at most", () => {
    const list = (servers: string[], at: number) => finalizeEvent({ kind: FILE_HOST_LIST_KIND, created_at: at, tags: servers.map((s) => ["server", s]), content: "" }, KEY);
    const many = Array.from({ length: 9 }, (_, i) => `https://f${i}.example`);
    expect(parseFileHostList([list(["https://old.example"], 1), list(many, 2)], me)).toEqual(many.slice(0, 6).map((h) => `${h}/`));
    expect(parseFileHostList([{ ...list(["https://forged.example"], 3), pubkey: "b".repeat(64) }], "b".repeat(64))).toEqual([]);
    expect(parseFileHostList([], me)).toEqual([]);
  });
});
