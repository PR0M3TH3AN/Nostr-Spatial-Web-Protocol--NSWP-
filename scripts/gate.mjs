// Every check this repository has, one after another, on this machine: what a change must pass before it is merged.
// There is no check run anywhere else (the owner, 2026-11-21: "We should do the CI tests local"), so this is the gate.
// It stops at the first step that fails and exits with that step's code, so `npm run gate && git merge …` means it.
//
//   npm run gate            everything
//   npm run gate -- --quick everything but the Godot export (which needs Godot, and a minute)
import { spawnSync } from "node:child_process";

const quick = process.argv.includes("--quick");
const steps = [
  ["build", "the core, the tools and every site"],
  ["build:engine", "the kit for other engines"],
  ["engine:check", "what is in the repository is what the source builds"],
  ["vectors:check", "the examples are current, and the core agrees with every one"],
  ["typecheck", "types"],
  ["test", "tests"],
  ...(quick ? [] : [["build:godot", "the Godot world"]]),
];
const began = Date.now();
const done = [];
for (const [step, what] of steps) {
  const at = Date.now();
  process.stdout.write(`\n── ${step}: ${what}\n`);
  const args = step === "test" ? ["test"] : ["run", step];
  const ran = spawnSync("npm", args, { stdio: "inherit", shell: process.platform === "win32" });
  const secs = Math.round((Date.now() - at) / 1000);
  if (ran.status !== 0) {
    console.error(`\n✘ ${step} failed (exit ${ran.status ?? "killed"}) after ${secs}s. Passed before it: ${done.join(", ") || "nothing"}.`);
    console.error("  Nothing is to be merged on this. A test that only fails while the machine is busy still failed: run it again when it is quiet, and say so.");
    process.exit(ran.status ?? 1);
  }
  done.push(`${step} ${secs}s`);
}
console.log(`\n✔ all ${steps.length} steps passed in ${Math.round((Date.now() - began) / 1000)}s: ${done.join(", ")}${quick ? "  (quick: the Godot export was not built)" : ""}`);
