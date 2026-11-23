import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error a plain script, with no types of its own
import { cutVersion, nextVersion } from "../../../scripts/release-prepare.mjs";

/**
 * `npm run release:prepare` does everything of a release up to the deploy (docs/backlog/one-command-release.md), and
 * must stop at the first step that doesn't exit 0, with a non-zero exit of its own, and never deploy. This runs the
 * script where it can push, merge and build nothing: stand-ins for `git`, `gh` and `npm` that write down what they
 * were asked and answer as a release that goes well would, except for the one step a case tells them to fail.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const base = mkdtempSync(join(tmpdir(), "nswp-release-prepare-test-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));
const SHA = "a".repeat(40);

/** A place with the three main folders side by side, the stand-ins on a path of their own, and a log of what was asked. */
function place(name: string) {
  const dir = join(base, name);
  const bin = join(dir, "bin");
  const nswp = join(dir, "repos", "Nostr-Spatial-Web-Protocol--NSWP-");
  for (const d of [bin, nswp, join(dir, "repos", "bitportal"), join(dir, "repos", "nswp-world-template"), join(dir, "work")]) mkdirSync(d, { recursive: true });
  const log = join(dir, "asked.log");
  writeFileSync(log, "");
  // One stand-in for all three: it writes down what it was asked, fails where it is told to, and otherwise answers.
  writeFileSync(
    join(bin, "stand.mjs"),
    `import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [cmd, ...a] = process.argv.slice(2);
const asked = [cmd, ...a].join(" ");
appendFileSync(${JSON.stringify(log)}, asked + "\\n");
if (process.env.FAIL_AT && asked.startsWith(process.env.FAIL_AT)) { console.error("stand-in: told to fail at " + process.env.FAIL_AT); process.exit(1); }
const out = (s) => process.stdout.write(s + "\\n");
if (cmd === "git") {
  if (a[0] === "worktree" && a[1] === "list") out("worktree ${nswp}\\nHEAD ${SHA}\\nbranch refs/heads/main");
  else if (a[0] === "branch" && a[1] === "--show-current") out(process.env.ON_BRANCH ?? "main");
  else if (a[0] === "status") out(process.env.DIRTY ?? "");
  else if (a[0] === "show") out('export const KIT_VERSION = "0.83.0";');
  else if (a[0] === "rev-parse") out(a.includes("--short") ? "${SHA.slice(0, 7)}" : "${SHA}");
  else if (a[0] === "worktree" && a[1] === "add") {
    // A checkout, as far as the script reads one: a changelog with something under Next, and the kit's number.
    const at = a[4];
    mkdirSync(join(at, "packages", "core", "src"), { recursive: true });
    writeFileSync(join(at, "CHANGELOG.md"), "# What changed\\n\\n## Next\\n\\n- Something new.\\n\\n## 0.83.0\\n\\n- Something older.\\n");
    writeFileSync(join(at, "packages", "core", "src", "constants.ts"), 'export const KIT_VERSION = "0.83.0";\\n');
  }
} else if (cmd === "gh") {
  if (a[0] === "pr" && a[1] === "create") out("https://github.example/pull/1");
  else if (a[0] === "pr" && a[1] === "view") out(a.includes("state,mergeCommit") ? JSON.stringify({ state: "MERGED", mergeCommit: { oid: "${SHA}" } }) : JSON.stringify({ mergeable: process.env.MERGEABLE ?? "MERGEABLE", headRefOid: process.env.HEAD_SEEN ?? "${SHA}", state: "OPEN" }));
} else if (cmd === "npm" && a.join(" ") === "run check") out(process.env.CHECK_SAYS ?? "check: all as the template has it");
`,
  );
  for (const cmd of ["git", "gh", "npm", "vercel"]) {
    writeFileSync(join(bin, cmd), `#!/bin/sh\nexec "${process.execPath}" "${join(bin, "stand.mjs")}" ${cmd} "$@"\n`);
    chmodSync(join(bin, cmd), 0o755);
  }
  const go = (args: string[], env: Record<string, string> = {}) => {
    const ran = spawnSync(process.execPath, [join(root, "scripts", "release-prepare.mjs"), ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, NSWP_RELEASE_WORK: join(dir, "work"), NSWP_RELEASE_POLL_MS: "5", NSWP_RELEASE_WAIT_MS: "200", ...env },
      timeout: 60_000,
    });
    return { status: ran.status, out: `${ran.stdout}\n${ran.stderr}`, asked: readFileSync(log, "utf8").trim().split("\n"), left: readdirSync(join(dir, "work")) };
  };
  return { go };
}
const after = (asked: string[], line: string) => asked.slice(asked.findIndex((l) => l.startsWith(line)) + 1);

describe("npm run release:prepare", () => {
  it("goes through every step in order, merges only the commit it gated, and never deploys", () => {
    const r = place("all").go([]);
    expect(r.out).toContain("Kit 0.83.0 -> 0.84.0");
    expect(r.out).toContain("nothing is deployed");
    expect(r.status).toBe(0);
    const order = ["npm run gate", "git commit -m Kit 0.84.0", "git push -u origin kit-0.84.0", "gh pr create", "gh pr merge kit-0.84.0 --merge --match-head-commit " + SHA, "git pull --ff-only origin main", "npm run vendor -- --only nswp", "npm run gate", "gh pr merge", "npm run vendor", "npm run check", "gh pr merge", "git pull --ff-only origin main", "git pull --ff-only origin main", "npm run release:all"];
    let at = 0;
    for (const want of order) {
      const found = r.asked.findIndex((l, i) => i >= at && l.startsWith(want));
      expect(found, `"${want}" after line ${at}`).toBeGreaterThanOrEqual(0);
      at = found + 1;
    }
    // Nothing of a deploy, ever: no Vercel, no --go, no --lock-plumbing.
    expect(r.asked.some((l) => l.startsWith("vercel") || l.includes("--go") || l.includes("--lock-plumbing"))).toBe(false);
    // It works in a folder of its own, and takes it away.
    expect(r.left).toEqual([]);
  }, 90_000);

  it("stops at the first step that doesn't exit 0, with an exit of 1, and runs nothing after it", () => {
    const gate = place("gate").go([], { FAIL_AT: "npm run gate" });
    expect(gate.status).toBe(1);
    expect(gate.out).toContain("Stopped:");
    expect(after(gate.asked, "npm run gate").filter((l) => !l.startsWith("git worktree remove") && !l.startsWith("git branch -D"))).toEqual([]);
    expect(gate.asked.some((l) => l.startsWith("git push") || l.startsWith("gh "))).toBe(false);

    const merge = place("merge").go([], { FAIL_AT: "gh pr merge" });
    expect(merge.status).toBe(1);
    expect(merge.asked.some((l) => l.startsWith("npm run vendor") || l.startsWith("git pull") || l.startsWith("npm run release:all"))).toBe(false);

    const vendor = place("vendor").go([], { FAIL_AT: "npm run vendor -- --only nswp" });
    expect(vendor.status).toBe(1);
    expect(after(vendor.asked, "npm run vendor -- --only nswp").some((l) => l.startsWith("npm ") || l.startsWith("gh ") || l.startsWith("git push") || l.startsWith("git pull"))).toBe(false);
  }, 90_000);

  it("merges nothing when GitHub shows another commit, a conflict, or never shows it mergeable", () => {
    for (const env of [{ HEAD_SEEN: "b".repeat(40) }, { MERGEABLE: "CONFLICTING" }, { MERGEABLE: "UNKNOWN" }]) {
      const r = place(`pr-${Object.values(env)[0]!.slice(0, 6)}`).go([], env);
      expect(r.status).toBe(1);
      expect(r.out).toContain("Nothing was merged");
      expect(r.asked.some((l) => l.startsWith("gh pr merge") || l.startsWith("npm run vendor"))).toBe(false);
    }
  }, 90_000);

  it("touches nothing where a main folder isn't on main, or isn't clean", () => {
    for (const env of [{ ON_BRANCH: "some-work" }, { DIRTY: " M src/main.ts" }]) {
      const r = place(`state-${Object.keys(env)[0]}`).go([], env);
      expect(r.status).toBe(1);
      expect(r.out).toContain("Nothing of it was touched");
      expect(r.asked.some((l) => l.startsWith("git worktree add") || l.startsWith("npm ") || l.startsWith("git fetch") || l.startsWith("git pull"))).toBe(false);
    }
  }, 90_000);

  it("stops where the template's check says its plumbing differs, and never locks it", () => {
    const r = place("plumbing").go([], { CHECK_SAYS: "warn: src/plumbing/ differs from the template (door.ts). That's allowed." });
    expect(r.status).toBe(1);
    expect(r.out).toContain("differs from the template");
    expect(after(r.asked, "npm run check").some((l) => l.startsWith("git push") || l.startsWith("gh ") || l.startsWith("git commit") || l.includes("--lock-plumbing"))).toBe(false);
  }, 90_000);

  it("in a rehearsal builds and gates the version, and pushes, merges and pulls nothing", () => {
    const r = place("dry").go(["--dry-run", "--patch"]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("Kit 0.83.0 -> 0.83.1");
    expect(r.out).toContain("would run: git push -u origin kit-0.83.1");
    expect(r.asked.some((l) => l.startsWith("npm run gate"))).toBe(true);
    expect(r.asked.some((l) => l.startsWith("git push") || l.startsWith("gh ") || l.startsWith("git pull") || l.startsWith("npm run vendor") || l.startsWith("npm run release:all"))).toBe(false);
    expect(r.left).toEqual([]);
  }, 90_000);

  it("refuses what it doesn't understand", () => {
    const r = place("odd").go(["--go"]);
    expect(r.status).toBe(1);
    expect(r.asked.filter(Boolean)).toEqual([]);
  }, 90_000);
});

describe("the version change itself", () => {
  it("counts the next minor, or the next patch", () => {
    expect(nextVersion("0.83.0")).toBe("0.84.0");
    expect(nextVersion("0.83.4", true)).toBe("0.83.5");
    expect(nextVersion("soon")).toBeNull();
  });

  it("puts the number under Next, with what was there, and in KIT_VERSION", () => {
    const dir = join(base, "cut");
    mkdirSync(join(dir, "packages", "core", "src"), { recursive: true });
    writeFileSync(join(dir, "CHANGELOG.md"), "# What changed\n\n## Next\n\n- New.\n\n## 0.83.0\n\n- Old.\n");
    writeFileSync(join(dir, "packages", "core", "src", "constants.ts"), 'export const KIT_VERSION = "0.83.0";\n');
    cutVersion(dir, "0.84.0");
    expect(readFileSync(join(dir, "CHANGELOG.md"), "utf8")).toBe("# What changed\n\n## Next\n\n## 0.84.0\n\n- New.\n\n## 0.83.0\n\n- Old.\n");
    expect(readFileSync(join(dir, "packages", "core", "src", "constants.ts"), "utf8")).toContain('KIT_VERSION = "0.84.0"');
    // Nothing under Next now: nothing to release. And a number already there isn't cut twice.
    expect(() => cutVersion(dir, "0.85.0")).toThrow(/nothing to release/);
    expect(existsSync(join(dir, "CHANGELOG.md"))).toBe(true);
  });
});
