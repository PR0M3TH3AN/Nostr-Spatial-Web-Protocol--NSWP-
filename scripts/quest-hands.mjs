// Makes the hands page's script beside it (trials/pages/quest-hands/hands.js), bundled from trials/quest-hands/main.ts
// with three.js. Not kept in this repository (.gitignore): the page is a trial's, answered only by the local service on
// this machine. The four models it draws are the kit's own (packages/sdk/assets/hands/), served by every world at
// /hands/kit/ since the kit carries them, so the page keeps no copy of its own.
//
//   node scripts/quest-hands.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = join(root, "trials", "pages", "quest-hands");

await build({
  entryPoints: { hands: join(root, "trials", "quest-hands", "main.ts") },
  outdir: page,
  bundle: true,
  format: "esm",
  splitting: true,
  chunkNames: "hands-[name]-[hash]",
  minify: true,
  target: "es2022",
  logLevel: "warning",
});
console.log(`the hands page's script, in ${page}: hands.js`);
