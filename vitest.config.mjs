// The repo's tests are the repo's own: those in its packages' `test` folders, and nothing else.
//
// With no config vitest takes every `*.test.*` file under the folder it runs in. In the main folder that includes
// each agent's worktree under `.claude/worktrees/`, with its own copy of every test at whatever state its branch is
// in: 252 files where the repo has 126. On 2026-11-24 one of those, in a worktree mid-rebase, failed the release's
// test step and stopped the first deploy of 0.89.0. `scripts/check-test-files.mjs` (run by `npm test`) fails if
// anything outside these folders is ever collected again.
import { defineConfig } from "vitest/config";

export const TEST_FILES = ["packages/*/test/**/*.test.ts"];

export default defineConfig({
  test: {
    include: TEST_FILES,
    // Never into another checkout, wherever this is run from.
    exclude: ["**/node_modules/**", "**/.git/**", "**/.claude/**"],
  },
});
