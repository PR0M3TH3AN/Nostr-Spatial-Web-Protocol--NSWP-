// The mark's pictures, made once, from the kit's own `markSvg` (packages/sdk/src/ui/mark.ts): the same numbers the
// menu's button and the headset's are drawn from. Nobody draws their own copy; a place with its own colour makes
// its own set with --accent.
//
//   sh scripts/heavy.sh npx tsx scripts/make-mark.mjs                       # the kit's, into packages/sdk/assets/mark/
//   sh scripts/heavy.sh npx tsx scripts/make-mark.mjs --accent '#4fd08b' --out some/dir
//
// Writes mark.svg (the doorway on its line), mark-tile.svg (in its glass tile), and the tile as PNGs for a phone's
// home screen and a web app: 180 (Apple), 192 and 512 (Android), and 512 maskable (full-bleed glass, the doorway
// well inside the circle four fifths across that a mask keeps). The PNGs are drawn by the headless Chrome the trials
// use, so run it through the heavy lock.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MARK, markSvg } from "../packages/sdk/src/ui/mark.ts";
import { DEFAULT_THEME } from "../packages/sdk/src/ui/theme.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const accent = arg("--accent") ?? DEFAULT_THEME.accent;
if (!/^#[0-9a-fA-F]{6}$/.test(accent)) throw new Error(`--accent must be #rrggbb, not ${accent}`);
const out = resolve(arg("--out") ?? join(root, "packages", "sdk", "assets", "mark"));
mkdirSync(out, { recursive: true });

const bare = markSvg({ accent, tile: false });
const tiled = markSvg({ accent });
writeFileSync(join(out, "mark.svg"), `${bare}\n`);
writeFileSync(join(out, "mark-tile.svg"), `${tiled}\n`);

const pw = await import(`${root}/node_modules/playwright-core/index.mjs`);
const browser = await pw.chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  /** A square picture of `svg`, its own box fitted to `fill` of the square and centred, on `background` or nothing. */
  const png = async (size, svg, fill, background) => {
    const [, , w, h] = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
    const scale = (size * fill) / Math.max(w, h);
    await page.setViewportSize({ width: size, height: size });
    const sized = svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w * scale}" height="${h * scale}"`);
    await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${background ?? "transparent"}">${sized}</body></html>`);
    return page.screenshot({ omitBackground: !background, clip: { x: 0, y: 0, width: size, height: size } });
  };
  for (const size of [180, 192, 512]) writeFileSync(join(out, `mark-tile-${size}.png`), await png(size, tiled, 0.92));
  // Maskable: the whole square is the tile's glass, and the doorway stands well inside what any mask keeps (a circle
  // four fifths across): its box, glow and all, fills the square, so the doorway itself is about half of it.
  writeFileSync(join(out, "mark-tile-512-maskable.png"), await png(512, bare, 1, DEFAULT_THEME.glass));
} finally {
  await browser.close();
}
console.log(`the mark, in ${accent}, into ${out}: mark.svg, mark-tile.svg, mark-tile-180.png, mark-tile-192.png, mark-tile-512.png, mark-tile-512-maskable.png (tile ${MARK.tile.w} by ${MARK.tile.h})`);
