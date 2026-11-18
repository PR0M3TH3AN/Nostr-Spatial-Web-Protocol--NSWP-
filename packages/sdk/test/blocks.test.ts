import { describe, expect, it } from "vitest";
import { BLOCK_LIMIT, cleanBlocked, loadBlocked, storeBlocked, withBlocked, withoutBlocked } from "../src/blocks.js";

const k = (n: number) => n.toString(16).padStart(64, "0");
const store = () => {
  const m = new Map<string, string>();
  return { getItem: (x: string) => m.get(x) ?? null, setItem: (x: string, v: string) => void m.set(x, v), removeItem: (x: string) => void m.delete(x), m };
};

describe("the people a visitor has blocked", () => {
  it("keeps a person once, newest first, and lets them go again", () => {
    let list = withBlocked([], { key: k(1), name: "Ada" }, 100);
    list = withBlocked(list, { key: k(2), name: "Bo" }, 200);
    list = withBlocked(list, { key: k(1), name: "Ada again" }, 300);
    expect(list.map((b) => [b.name, b.at])).toEqual([["Bo", 200], ["Ada", 100]]);
    expect(withoutBlocked(list, k(2)).map((b) => b.name)).toEqual(["Ada"]);
    expect(withBlocked(list, { key: "not a key" })).toBe(list);
  });

  it("trusts nothing in a kept list", () => {
    const hidden = `Ada${String.fromCharCode(0x202e)}evil`;
    const read = cleanBlocked([{ key: k(1), name: hidden, at: 5 }, { key: k(1), name: "twice" }, { key: "xyz" }, null, "text", { key: k(2), name: 7, at: -1 }, { key: "AB".repeat(32) }]);
    expect(read.map((b) => b.key)).toEqual([k(1), k(2)]);
    expect(read[0]!.name).toBe("Ada evil");
    expect(read[1]!.name.startsWith("npub1")).toBe(true);
    expect(read[1]!.at).toBe(0);
    expect(cleanBlocked("nope")).toEqual([]);
    expect(cleanBlocked(Array.from({ length: BLOCK_LIMIT + 50 }, (_, i) => ({ key: k(i + 1) })))).toHaveLength(BLOCK_LIMIT);
  });

  it("is kept on this site, and survives storage that fails", () => {
    const s = store();
    storeBlocked(withBlocked([], { key: k(9), name: "Cy" }, 50), s);
    expect(loadBlocked(s)).toEqual([{ key: k(9), name: "Cy", at: 50 }]);
    storeBlocked([], s);
    expect(s.m.size).toBe(0);
    s.m.set("nswp:blocked", "{not json");
    expect(loadBlocked(s)).toEqual([]);
    expect(loadBlocked(null)).toEqual([]);
    const broken = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); }, removeItem: () => {} };
    expect(loadBlocked(broken)).toEqual([]);
    expect(() => storeBlocked([{ key: k(1), name: "x", at: 1 }], broken)).not.toThrow();
  });
});
