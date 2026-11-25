// Makes the hands page's own files beside it (trials/pages/quest-hands/): its script, bundled from
// trials/quest-hands/main.ts with three.js, and the 3D artist's four models, copied from the art repository's checkout
// at one commit. Neither is kept in this repository (.gitignore): the models are the art repository's, and the page
// is a trial's, answered only by the local service on this machine.
//
//   node scripts/quest-hands.mjs                       # the art at c30f660, from ../bitportal-art
//   node scripts/quest-hands.mjs --art <checkout> --at <commit>
//
// The models are read with `git show <commit>:<path>`, so the checkout's own working files are never touched or
// relied on.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
// The repository's main folder sits beside the art's; from a worktree, so does the folder three levels up.
const artDefault = [join(root, "..", "bitportal-art"), join(root, "..", "..", "..", "..", "bitportal-art")];
const art = resolve(arg("--art", artDefault.find((p) => { try { execFileSync("git", ["-C", p, "rev-parse"], { stdio: "ignore" }); return true; } catch { return false; } }) ?? artDefault[0]));
const at = arg("--at", "c30f660");
if (!/^[0-9a-f]{7,40}$/.test(at)) throw new Error(`--at must be a commit, not ${at}`);
const page = join(root, "trials", "pages", "quest-hands");

mkdirSync(join(page, "models"), { recursive: true });
for (const name of ["hand-left.glb", "hand-right.glb", "controller-left.glb", "controller-right.glb"]) {
  const bytes = execFileSync("git", ["-C", art, "show", `${at}:assets/hands/out/${name}`], { maxBuffer: 1 << 26 });
  if (bytes.subarray(0, 4).toString("latin1") !== "glTF") throw new Error(`${name} at ${at} isn't a GLB`);
  writeFileSync(join(page, "models", name), bytes);
}

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
console.log(`the hands page's files, in ${page}: hands.js, and the four models from ${art} at ${at}`);
