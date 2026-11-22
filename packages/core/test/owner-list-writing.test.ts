import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listD, ownerListTemplate, readOwnerList, verifyEvent, type ListScope } from "../src/index.js";

/**
 * Writing a world owner's list from one change (protocol/10-identity.md, "A world's own lists"), held to
 * `vectors/owner-list-writing.json`: what BitLogin's guest list and any other writer build to (asked by the
 * orchestrator, 2026-11-22). Each case: the kit's own writer makes exactly the event the file gives, and that event,
 * signed, reads back through `readOwnerList` as the file says.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
type Vector = {
  name: string;
  scope: ListScope;
  subject: string;
  before: { people: string[]; createdAt: number } | null;
  change: { op: "add" | "remove"; person: string };
  now: number;
  expect: { refused?: string; d?: string; event?: { kind: number; created_at: number; content: string; tags: string[][] }; signed?: unknown; readBack?: unknown };
};
const { vectors } = JSON.parse(readFileSync(join(root, "vectors/owner-list-writing.json"), "utf8")) as { vectors: Vector[] };

/** The file's rules, as a writer would follow them, with the kit's own template doing the writing. */
const change = (v: Vector) => {
  const was = v.before?.people ?? [];
  const people = v.change.op === "add" ? [...was, v.change.person] : was.filter((p) => p !== v.change.person);
  const createdAt = v.before ? Math.max(v.now, v.before.createdAt + 1) : v.now;
  return ownerListTemplate({ scope: v.scope, subject: v.subject, people, createdAt });
};

describe("writing a world owner's list from one change", () => {
  it("has the cases asked for: allow, unallow, block, unblock, a first list, the 500 limit, a d with colons", () => {
    expect(vectors.map((v) => v.name)).toEqual(["a_first_list_from_none", "allow", "unallow", "block", "unblock_the_last", "the_writers_clock_is_behind", "a_world_d_with_colons", "the_500_limit"]);
  });

  for (const v of vectors) {
    it(v.name, () => {
      const made = change(v);
      if (v.expect.refused) {
        expect(made).toBeNull();
        return;
      }
      expect(made).toEqual(v.expect.event);
      expect(v.expect.event!.tags[0]).toEqual(["d", listD(v.scope, v.subject)]);
      expect(v.expect.d).toBe(listD(v.scope, v.subject));
      expect(verifyEvent(v.expect.signed)).toBe(true);
      expect(readOwnerList(v.expect.signed, { now: v.now })).toMatchObject({ ok: true, ...(v.expect.readBack as object), skipped: 0 });
    });
  }
});
