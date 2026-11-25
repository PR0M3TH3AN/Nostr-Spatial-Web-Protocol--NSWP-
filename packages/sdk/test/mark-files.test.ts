// The mark's pictures, made once (scripts/make-mark.mjs), and each site's page icon (scripts/build-sites.mjs).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { markSvg } from "../src/ui/mark.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const assets = join(root, "packages", "sdk", "assets", "mark");
/** A PNG's width and height, from its header; null where it isn't one. */
const pngSize = (bytes: Buffer): [number, number] | null =>
  bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? [bytes.readUInt32BE(16), bytes.readUInt32BE(20)] : null;

describe("the mark's own pictures", () => {
  it("are what markSvg makes now: change the mark, and they are to be made again", () => {
    // If this fails, the mark changed: run `sh scripts/heavy.sh npx tsx scripts/make-mark.mjs` and commit what it makes.
    expect(readFileSync(join(assets, "mark.svg"), "utf8").trim()).toBe(markSvg({ tile: false }));
    expect(readFileSync(join(assets, "mark-tile.svg"), "utf8").trim()).toBe(markSvg());
  });

  it("are pictures of the sizes a phone and a web app ask for", () => {
    for (const [file, size] of [["mark-tile-180.png", 180], ["mark-tile-192.png", 192], ["mark-tile-512.png", 512], ["mark-tile-512-maskable.png", 512]] as const)
      expect(pngSize(readFileSync(join(assets, file))), file).toEqual([size, size]);
  });
});

describe("each site's page icon", () => {
  const built = readdirSync(join(root, "sites"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(root, "sites", e.name, "dist", "index.html")))
    .map((e) => e.name);
  it.skipIf(!built.length)("is the mark, in the site's own accent, with the kit's tile for a phone's home screen", () => {
    for (const name of built) {
      const dist = join(root, "sites", name, "dist");
      const page = readFileSync(join(dist, "index.html"), "utf8");
      expect(page, name).toContain('<link rel="icon" href="mark.svg" type="image/svg+xml">');
      expect(page, name).toContain('<link rel="apple-touch-icon" href="mark-tile-180.png">');
      expect(existsSync(join(dist, "mark-tile-180.png")), name).toBe(true);
      // Its accent, where its own code gives one; the kit's where it gives none.
      const entry = ["src/main.ts", "src/airlock.ts"].map((e) => join(root, "sites", name, e)).find((p) => existsSync(p));
      const accent = entry ? readFileSync(entry, "utf8").match(/accent:\s*0x([0-9a-fA-F]{6})\b/)?.[1]?.toLowerCase() : undefined;
      expect(readFileSync(join(dist, "mark.svg"), "utf8").trim(), name).toBe(markSvg({ accent: accent ? `#${accent}` : undefined, tile: false }));
    }
  });
});
