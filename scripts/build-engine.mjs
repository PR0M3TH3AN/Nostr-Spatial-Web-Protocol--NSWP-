// Builds what an engine that isn't JavaScript's takes from the kit, and puts it where the Godot addon carries it:
//
//   engines/nswp-engine.js                           the kit's script, with no rendering in it (packages/sdk/src/engine.ts)
//   engines/godot/addons/nswp/web/nswp-engine.js     a copy, to go beside a Godot export's page
//   engines/godot/addons/nswp/web/sounds/kit/        the kit's sound files, to go beside it too
//   engines/godot/addons/nswp/gate/frame.obj         the standard doorway's frame, as the kit models it
//
//   node scripts/build-engine.mjs           build
//   node scripts/build-engine.mjs --check   fail if what is in the repository isn't what the source builds
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const esbuild = join(root, "node_modules", ".bin", "esbuild");
const work = mkdtempSync(join(tmpdir(), "nswp-engine-"));
const addon = join(root, "engines", "godot", "addons", "nswp");

// The script.
const script = join(work, "nswp-engine.js");
execFileSync(esbuild, [join(root, "packages/sdk/src/engine.ts"), "--bundle", "--format=iife", "--global-name=NSWP", "--target=es2020", "--legal-comments=inline", "--log-level=warning", `--outfile=${script}`], {
  stdio: "inherit",
  cwd: root,
});

// The doorway's frame: the kit's own modelling code, run here, written out as a mesh any engine can read.
const maker = join(work, "gate-mesh.mjs");
execFileSync(esbuild, [join(root, "scripts/gate-mesh.ts"), "--bundle", "--platform=node", "--format=esm", "--log-level=warning", `--outfile=${maker}`], { stdio: "inherit", cwd: root });
const frame = join(work, "frame.obj");
writeFileSync(frame, execFileSync(process.execPath, [maker], { maxBuffer: 64 * 1024 * 1024 }));

/** Every file under a folder, as paths from it. */
function filesIn(dir, from = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const at = join(dir, name);
      return statSync(at).isDirectory() ? filesIn(at, from) : [relative(from, at)];
    });
}

// What is built, and each place it goes.
const sounds = join(root, "packages", "sdk", "sounds");
const soundsCopy = join(addon, "web", "sounds", "kit");
const wanted = [
  [script, join(root, "engines", "nswp-engine.js")],
  [script, join(addon, "web", "nswp-engine.js")],
  [frame, join(addon, "gate", "frame.obj")],
  ...filesIn(sounds).map((f) => [join(sounds, f), join(soundsCopy, f)]),
];
const same = (a, b) => existsSync(b) && readFileSync(a).equals(readFileSync(b));
// A sound taken out of the kit is taken out of the copy too.
const extra = filesIn(soundsCopy).filter((f) => !existsSync(join(sounds, f)));

if (check) {
  const stale = [...wanted.filter(([from, to]) => !same(from, to)).map(([, to]) => to), ...extra.map((f) => join(soundsCopy, f))];
  rmSync(work, { recursive: true, force: true });
  if (stale.length) {
    console.error(`Out of date, run node scripts/build-engine.mjs:\n${stale.map((f) => `  ${relative(root, f)}`).join("\n")}`);
    process.exit(1);
  }
  console.log("engines/ is what the source builds: the script, the doorway's frame and the sounds");
} else {
  for (const [from, to] of wanted) {
    if (same(from, to)) continue;
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
  }
  for (const f of extra) rmSync(join(soundsCopy, f));
  console.log(`built engines/nswp-engine.js (${Math.round(readFileSync(script).length / 1024)} KB), the doorway's frame (${Math.round(readFileSync(frame).length / 1024)} KB) and ${filesIn(sounds).length} sound files for the Godot addon`);
  rmSync(work, { recursive: true, force: true });
}
