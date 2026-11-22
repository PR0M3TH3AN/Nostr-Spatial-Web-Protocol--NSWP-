import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * `npm run release:all` says plainly, by its exit code, whether it deployed: anything but 0 when it refused, when a
 * step failed, or when a site didn't come up on the kit (the orchestrator, 2026-11-22: a refusal was read as 0, which
 * was the `| tail` it was piped through answering, not the script). This runs the script where it can deploy nothing
 * and reach nothing: a stand-in `vercel` that always fails (so the script always refuses: it can't count today's
 * deployments), a `git` whose `fetch` fails, and a `fetch` that fails. It is run with `--go`, the case that matters.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const work = mkdtempSync(join(tmpdir(), "nswp-release-test-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));
const realGit = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
const stand = (name: string, body: string) => {
  const at = join(work, name);
  writeFileSync(at, `#!/bin/sh\n${body}\n`);
  chmodSync(at, 0o755);
};
stand("vercel", 'echo "stand-in vercel: never deploys" >&2\nexit 1');
stand("git", `if [ "$1" = "fetch" ]; then exit 1; fi\nexec "${realGit}" "$@"`);
writeFileSync(join(work, "nofetch.mjs"), 'globalThis.fetch = async () => { throw new Error("no network in this test"); };\n');

describe("npm run release:all, by its exit code", () => {
  it("is not 0 when it refuses with --go, and says nothing was deployed", () => {
    const ran = spawnSync(process.execPath, ["--import", join(work, "nofetch.mjs"), join(root, "scripts", "release-all.mjs"), "--go"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: `${work}:${process.env.PATH ?? ""}`, GIT_TERMINAL_PROMPT: "0" },
      timeout: 60_000,
    });
    expect(ran.stdout).toContain("Nothing was deployed. To put right first:");
    expect(ran.stdout).toContain("the Vercel CLI didn't answer");
    expect(ran.stdout).not.toContain("Deploying");
    expect(ran.status).toBe(1);
  }, 90_000);
});
