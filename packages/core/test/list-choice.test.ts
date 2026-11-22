import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LIST_LIMITS, resolveList } from "../src/index.js";

/**
 * Choosing a list of worlds from the copies relays gave (protocol/08-lists.md, "Following one"), held to
 * `vectors/lists.json`'s `choosing` cases: a copy dated more than ten minutes ahead of the reader's clock is left
 * out before choosing, and said, as BitGate's lists already do (found by the BitGate session, 2026-11-21).
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const { choosing } = JSON.parse(readFileSync(join(root, "vectors/lists.json"), "utf8")) as {
  choosing: { vectors: { name: string; coordinate: string; now: number; events: unknown[]; expect: { chosen: string | null; title?: string; futureDated: string[] } }[] };
};

describe("choosing a list from the copies relays gave", () => {
  it("allows ten minutes ahead of the reader's clock, and no more", () => {
    expect(LIST_LIMITS.ahead).toBe(600);
  });

  for (const v of choosing.vectors) {
    it(v.name, () => {
      const r = resolveList(v.events, { coordinate: v.coordinate, now: v.now });
      expect(r.id).toBe(v.expect.chosen);
      expect(r.futureDated).toEqual(v.expect.futureDated);
      if (v.expect.title !== undefined) expect(r.list?.title).toBe(v.expect.title);
      if (v.expect.chosen === null) expect(r.list).toBeNull();
    });
  }

  it("chooses nothing for a coordinate that isn't a list's, whatever relays sent", () => {
    const any = choosing.vectors[0]!;
    expect(resolveList(any.events, { coordinate: any.coordinate.replace(/^30004:/, "37300:"), now: any.now })).toEqual({ list: null, id: null, futureDated: [] });
    expect(resolveList(any.events, { coordinate: "not a coordinate", now: any.now })).toEqual({ list: null, id: null, futureDated: [] });
  });

  it("passes over what isn't an event at all", () => {
    const any = choosing.vectors[0]!;
    const r = resolveList([null, 7, "text", {}, ...any.events], { coordinate: any.coordinate, now: any.now });
    expect(r.id).toBe(any.expect.chosen);
  });
});
