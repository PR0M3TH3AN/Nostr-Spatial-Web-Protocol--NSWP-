// Builds engines/nswp-engine.js: the kit for an engine that isn't JavaScript's, as one script with no rendering
// in it (packages/sdk/src/engine.ts), and puts a copy where the Godot addon carries it.
//
//   node scripts/build-engine.mjs           build
//   node scripts/build-engine.mjs --check   fail if what is in the repository isn't what the source builds
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const out = check ? join(tmpdir(), `nswp-engine-${process.pid}.js`) : join(root, "engines", "nswp-engine.js");
const copies = [join(root, "engines", "godot", "addons", "nswp", "web", "nswp-engine.js")];
mkdirSync(dirname(out), { recursive: true });
execFileSync(
  join(root, "node_modules", ".bin", "esbuild"),
  [join(root, "packages/sdk/src/engine.ts"), "--bundle", "--format=iife", "--global-name=NSWP", "--target=es2020", "--legal-comments=inline", "--log-level=warning", `--outfile=${out}`],
  { stdio: "inherit", cwd: root },
);
if (check) {
  const built = readFileSync(out, "utf8");
  const stale = [join(root, "engines", "nswp-engine.js"), ...copies].filter((f) => {
    try {
      return readFileSync(f, "utf8") !== built;
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Out of date, run node scripts/build-engine.mjs:\n${stale.map((f) => `  ${f}`).join("\n")}`);
    process.exit(1);
  }
  console.log("engines/nswp-engine.js is what the source builds");
} else {
  for (const to of copies) {
    mkdirSync(dirname(to), { recursive: true });
    cpSync(out, to);
  }
  console.log(`built engines/nswp-engine.js (${Math.round(readFileSync(out).length / 1024)} KB) and ${copies.length} copy`);
}
