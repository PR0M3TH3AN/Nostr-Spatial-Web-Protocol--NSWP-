// Builds the demo into dist/, for the development server to serve (scripts/serve-local.mjs).
//   node docs/plans/signin-demo/build.mjs
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const out = join(here, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync(join(root, "node_modules", ".bin", "esbuild"), [join(here, "demo.ts"), "--bundle", "--format=esm", "--target=es2022", "--minify", `--outfile=${join(out, "demo.js")}`, `--alias:@nswp/core=${join(root, "packages/core/src/index.ts")}`, "--log-level=warning"], { stdio: "inherit" });
for (const f of ["index.html", "demo.css"]) cpSync(join(here, f), join(out, f));
console.log("built docs/plans/signin-demo/dist");
