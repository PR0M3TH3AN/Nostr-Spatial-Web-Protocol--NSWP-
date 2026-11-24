// Fails if vitest would collect a test file that is not one of the repo's own (vitest.config.mjs).
//
// The fault this guards against only shows where there is something else to collect: in the main folder, with
// agents' worktrees under `.claude/worktrees/`. A worktree has none, so a check that only looked would always pass
// there. So this puts something there to find: a test file under `.claude/` and one in a folder of the repo's root
// outside its packages, each a test that passes. It asks vitest which files it would run, takes the two away
// again whatever happens, and fails if:
//   - either of them is among the files, or anything else outside the packages' `test` folders is;
//   - a test file git has in those folders is not among them (so a test that is never run fails too).
// One there that git hasn't yet (a test being written) is said, not failed.
// Run by `npm test`, before the tests themselves. About two seconds.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stamp = `${process.pid}-${Date.now()}`;
// Each a test that passes: if one were ever collected while this runs, it fails nothing but this check.
const decoys = [join(root, ".claude", `collect-check-${stamp}`, "decoy.test.ts"), join(root, `collect-check-${stamp}`, "decoy.test.ts")];
const body = `import { it } from "vitest";\nit("is collected only by a vitest that collects too much", () => {});\n`;
const own = /^packages\/[^/]+\/test\/.+\.test\.ts$/;

let listed;
try {
  for (const f of decoys) {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, body);
  }
  const out = execFileSync(process.execPath, [join(root, "node_modules", "vitest", "vitest.mjs"), "list", "--filesOnly"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 24 });
  listed = out.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => relative(root, join(root, l)).split(sep).join("/"));
} finally {
  for (const f of decoys) rmSync(dirname(f), { recursive: true, force: true });
}

const tracked = execFileSync("git", ["ls-files", "--", "packages"], { cwd: root, encoding: "utf8" }).split("\n").filter((f) => own.test(f));
const outside = listed.filter((f) => !own.test(f));
const listedSet = new Set(listed);
const trackedSet = new Set(tracked);
const missing = tracked.filter((f) => !listedSet.has(f));
const untracked = listed.filter((f) => own.test(f) && !trackedSet.has(f));

const wrong = [];
if (outside.length) wrong.push(`collected from outside the packages' test folders (${outside.length}):\n    ${outside.slice(0, 10).join("\n    ")}`);
if (missing.length) wrong.push(`the repo's own, not collected (${missing.length}):\n    ${missing.slice(0, 10).join("\n    ")}`);
// A test being written is not in git yet: said, not failed.
if (untracked.length) console.log(`check-test-files: collected and not yet in git (${untracked.length}): ${untracked.slice(0, 5).join(", ")}`);
if (wrong.length) {
  console.error(`check-test-files: vitest would not run exactly the repo's own tests.\n  ${wrong.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-test-files: vitest collects the repo's own ${listed.length} test files and nothing else (a test file put under .claude/ and one outside the packages were not taken)`);
