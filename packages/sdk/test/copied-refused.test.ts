import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copiedRefused } from "../src/client-frame.js";

/**
 * A row that reads what the visitor copied ("Put in the item I copied", "Someone whose key I copied") is refused by
 * the browser in a world shown inside another site's page, whatever is pressed or allowed (step 0b of the client's
 * menu: docs/plans/the-clients-menu-presses.md). It used to say "allow this site to read what you copy", which
 * there is a switch that doesn't exist. Now it says why.
 */
describe("the words when what was copied can't be read", () => {
  it("ask for the site to be allowed, in a world opened by its own address", () => {
    expect(copiedRefused("Copy an item's address", false)).toBe("What you copied couldn't be read here. Copy an item's address, allow this site to read what you copy, and press again.");
    expect(copiedRefused("Copy someone's key (npub1…)", false)).toBe("What you copied couldn't be read here. Copy someone's key (npub1…), allow this site to read what you copy, and press again.");
  });

  it("say why, and what does work, in a world shown inside another page", () => {
    const said = copiedRefused("Copy an item's address", true);
    expect(said).toBe("What you copied can't be read in a world shown inside another page. Open this world by its own address, copy an item's address, and press again.");
    expect(said).not.toMatch(/allow this site/);
    expect(said.length).toBeLessThanOrEqual(200);
  });

  it("are for a world that isn't in a frame when nothing says otherwise (no window here)", () => {
    expect(copiedRefused("Copy their key (it starts npub1)")).toMatch(/allow this site to read what you copy/);
  });

  it("are the words of every row in the kit that reads what was copied", () => {
    const src = join(__dirname, "..", "src");
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
    const reading = files(src).filter((f) => /clipboard\.readText\(/.test(readFileSync(f, "utf8")));
    expect(reading.length).toBeGreaterThanOrEqual(3);
    for (const f of reading) {
      const text = readFileSync(f, "utf8");
      expect(text, f).toMatch(/copiedRefused\(/);
      expect(text, f).not.toMatch(/allow this site to read what you copy/);
    }
  });
});
