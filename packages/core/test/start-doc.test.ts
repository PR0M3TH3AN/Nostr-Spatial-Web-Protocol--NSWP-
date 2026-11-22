/**
 * docs/start.md is the one starting point for someone, or some agent, who has never seen any of this
 * (docs/backlog/landing-02-get-started.md). It is copied into BitPortal's getting-started page, so what it points at
 * must exist, and it must never hand anyone a public, permanent step to copy without saying what it does.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../..");
const text = readFileSync(join(root, "docs", "start.md"), "utf8");
const REPO = "https://github.com/PR0M3TH3AN/Nostr-Spatial-Web-Protocol--NSWP-/blob/main/";

describe("docs/start.md", () => {
  it("points only at files this repository has", () => {
    const links = [...text.matchAll(/\]\((https:\/\/github\.com\/PR0M3TH3AN\/Nostr-Spatial-Web-Protocol--NSWP-\/blob\/main\/[^)#\s]+)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) expect(existsSync(join(root, link.slice(REPO.length))), link).toBe(true);
    // And names the paths in this repository it talks about.
    for (const path of ["engines/godot/addons/nswp", "engines/nswp-engine.js"]) expect(existsSync(join(root, path)), path).toBe(true);
  });

  it("never gives publishing as a command to copy: --yes is named in the words that say it is public and permanent", () => {
    const blocks = [...text.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]!.trim());
    for (const b of blocks) expect(b, b).not.toMatch(/--yes/);
    expect(text).toMatch(/publishes to public relays, for good/);
    // One command to a block, so each can be copied by itself.
    for (const b of blocks) expect(b.split("\n").length, b).toBe(1);
  });

  it("has no key in it", () => {
    expect(text).not.toMatch(/\b[0-9a-f]{64}\b/);
    expect(text).not.toMatch(/nsec1[0-9a-z]+/);
  });
});
