/**
 * The protocol documents are what other people build from, so they are held
 * to account: each says where it stands, and everything it points at exists.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPABILITIES, ACHIEVEMENT_KIND, AVATAR_KIND, BAG_KIND, CURATION_SET_KIND, MESSAGE_RELAYS_KIND, RATING_KIND, SCORE_KIND, SAVE_KIND, ENTRY_ASSERTION_KIND, HOME_LAYOUT_KIND, ITEM_KIND, LOOK_PARTS, ROOM_PASS_KIND, ROOM_SIGNAL_KIND, WORLD_KIND } from "../src/index.js";

const root = join(import.meta.dirname, "../../..");
const dir = join(root, "protocol");
const docs = readdirSync(dir).filter((f) => /^\d\d-.*\.md$/.test(f));
const read = (file: string) => readFileSync(join(dir, file), "utf8");
/** Every relative link in a Markdown file. */
const links = (text: string) => [...text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((m) => m[1]!).filter((l) => !/^[a-z]+:/.test(l));

describe("the protocol documents", () => {
  it("01-worlds.md: the capabilities it lists are the library's, no more and no fewer", () => {
    const row = /^\| `capability` \| \| ([^.|]+)/m.exec(read("01-worlds.md"))?.[1] ?? "";
    expect([...row.matchAll(/`([a-z-]+)`/g)].map((m) => m[1])).toEqual([...CAPABILITIES]);
  });

  it("are all there, numbered without gaps", () => {
    expect(docs.map((f) => f.slice(0, 2))).toEqual(docs.map((_, i) => String(i + 1).padStart(2, "0")));
    expect(docs.length).toBeGreaterThanOrEqual(9);
  });

  for (const file of [...docs, "README.md"]) {
    it(`${file}: every file it points at exists`, () => {
      for (const link of links(read(file))) expect(existsSync(resolve(dirname(join(dir, file)), link)), `${file} -> ${link}`).toBe(true);
    });
  }

  for (const file of docs) {
    it(`${file}: says where it stands, and is in the index`, () => {
      const text = read(file);
      expect(text).toMatch(/^# NSWP-\d\d: /);
      expect(text).toMatch(/\*\*Status:\*\* /);
      expect(read("README.md")).toContain(`](${file})`);
    });
  }

  it("name only kinds the library knows", () => {
    const known = new Set([WORLD_KIND, AVATAR_KIND, HOME_LAYOUT_KIND, ITEM_KIND, ROOM_PASS_KIND, ROOM_SIGNAL_KIND, ENTRY_ASSERTION_KIND, CURATION_SET_KIND, SAVE_KIND, RATING_KIND, MESSAGE_RELAYS_KIND, SCORE_KIND, ACHIEVEMENT_KIND, BAG_KIND]);
    for (const file of docs) {
      const kinds = /\*\*Kinds:\*\* ([^·\n]*)/.exec(read(file))?.[1] ?? "";
      for (const k of kinds.match(/\b\d{5}\b/g) ?? []) expect(known.has(Number(k)), `${file} names kind ${k}`).toBe(true);
    }
  });

  it("list the same parts of a look, in the same order, as the library", () => {
    const text = read("05-looks.md");
    for (const [part, choices] of Object.entries(LOOK_PARTS)) {
      const row = new RegExp(`\\| \`${part}\` \\| ([^|]*)\\|`).exec(text)?.[1] ?? "";
      expect(row.match(/`([a-z]+)`/g)?.map((c) => c.replace(/`/g, "")), part).toEqual([...choices]);
    }
  });
});

describe("the other documents", () => {
  for (const file of ["README.md", "docs/add-your-site.md", "docs/controls-kit.md", "docs/grid-look.md", "CHANGELOG.md", "browser/spec.md", "browser/bridge.md"]) {
    it(`${file}: every file it points at exists`, () => {
      const text = readFileSync(join(root, file), "utf8");
      for (const link of links(text)) expect(existsSync(resolve(dirname(join(root, file)), link)), `${file} -> ${link}`).toBe(true);
    });
  }
});
