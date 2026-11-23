// Everything of a release up to the deploy, in one command (docs/backlog/one-command-release.md). It never deploys
// and never publishes anything to relays: going live is the owner's word each time (docs/fleet.md, rule 6), and stays
// `npm run release:all -- --go`.
//
//   npm run release:prepare                     the next minor (0.83.0 -> 0.84.0)
//   npm run release:prepare -- --patch          the next patch (0.83.0 -> 0.83.1)
//   npm run release:prepare -- 0.90.0           that number
//   npm run release:prepare -- --dry-run        a rehearsal: every step it can do without pushing, the rest printed
//
// What it does, each step tested by its exit code and nothing run after one that failed:
//   1. NSWP: the version pull request as fleet rule 11 says (the `## Next` heading gets the number under it,
//      KIT_VERSION, `npm run build`, the engine script rebuilt), the full gate, the pull request, merged once GitHub
//      shows that very commit mergeable, and read back merged.
//   2. NSWP's main folder brought to that merge and built.
//   3. BitPortal: `npm run vendor -- --only nswp` on a branch from its main, its gate, a pull request, merged the same way.
//   4. The world template: `npm run vendor` and `npm run check` on a branch (never --lock-plumbing; it stops if the
//      check says the plumbing differs from the template), a pull request, merged the same way.
//   5. The two main folders the deploy reads (../bitportal, ../nswp-world-template) brought up to date by fast-forward.
//   6. `npm run release:all` without --go, which says what would be deployed. And there it stops.
//
// What it never does: go on after a step that didn't exit 0; merge a commit other than the one it gated; touch a
// main folder that isn't on `main` and clean (it stops and says which); switch a branch in anyone's folder (it works
// in worktrees of its own, in a folder it makes and takes away); sign anything, or read a key.
//
// It exits 0 only when all of it went through; anything else is 1. Read that from the script itself: piped through
// `| tail`, a shell gives tail's exit. (packages/core/test/release-prepare.test.ts holds it to stopping at the first
// failing step, with stand-ins for git, gh and npm.)
//
// Needs `git`, `gh` (signed in) and `npm`, and the three repositories side by side:
//   Nostr-Spatial-Web-Protocol--NSWP-   bitportal   nswp-world-template
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const patch = args.includes("--patch");
const asked = args.find((a) => /^\d+\.\d+\.\d+$/.test(a));
const unknown = args.filter((a) => a !== "--dry-run" && a !== "--patch" && a !== asked);
/** How long GitHub is given to show a pushed commit mergeable, and how often it is asked. */
const WAIT_MS = Number(process.env.NSWP_RELEASE_WAIT_MS ?? 300_000);
const POLL_MS = Number(process.env.NSWP_RELEASE_POLL_MS ?? 5000);

class Stop extends Error {}
const stop = (words) => {
  throw new Stop(words);
};
const say = (words) => console.log(words);
const show = (cmd, argv, cwd) => `${cmd} ${argv.join(" ")}   (in ${cwd})`;
/** Run a command, its output shown as it comes. Anything but exit 0 stops everything. */
const run = (cmd, argv, cwd) => {
  say(`  $ ${show(cmd, argv, cwd)}`);
  try {
    execFileSync(cmd, argv, { cwd, stdio: "inherit" });
  } catch (e) {
    stop(`"${cmd} ${argv.join(" ")}" didn't exit 0 (${e.status ?? e.code ?? "it couldn't be run"}), in ${cwd}`);
  }
};
/** Run a command and take what it printed. Anything but exit 0 stops everything. */
const read = (cmd, argv, cwd) => {
  try {
    return execFileSync(cmd, argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
  } catch (e) {
    stop(`"${cmd} ${argv.join(" ")}" didn't exit 0 (${e.status ?? e.code ?? "it couldn't be run"}), in ${cwd}`);
  }
};
/** A command that changes something outside this machine: run, or in a rehearsal only printed. */
const outward = (cmd, argv, cwd) => (dry ? say(`  would run: ${show(cmd, argv, cwd)}`) : run(cmd, argv, cwd));
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** A main folder as it must be before anything of it is used: on `main`, with nothing uncommitted. */
const mustBeMainAndClean = (name, dir) => {
  if (!existsSync(dir)) stop(`${name}'s main folder isn't at ${dir}`);
  const branch = read("git", ["branch", "--show-current"], dir);
  if (branch !== "main") stop(`${name}'s main folder (${dir}) is on "${branch || "no branch"}", not main. Nothing of it was touched.`);
  if (read("git", ["status", "--porcelain"], dir) !== "") stop(`${name}'s main folder (${dir}) has changes that aren't committed. Nothing of it was touched.`);
};

/**
 * Push a branch, open its pull request, wait for GitHub to show that very commit mergeable, merge it only if the
 * head is still that commit, and read it back merged. Returns the merge commit. In a rehearsal, only printed.
 */
const pullRequest = async (name, dir, branch, title, body) => {
  const sha = read("git", ["rev-parse", "HEAD"], dir);
  outward("git", ["push", "-u", "origin", branch], dir);
  outward("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", title, "--body", body], dir);
  if (dry) {
    say(`  would wait for GitHub to show ${sha.slice(0, 7)} mergeable, then run: gh pr merge ${branch} --merge --match-head-commit ${sha}, and read it back merged`);
    return null;
  }
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const seen = JSON.parse(read("gh", ["pr", "view", branch, "--json", "mergeable,headRefOid,state"], dir));
    if (seen.headRefOid !== sha) stop(`${name}: the pull request's head is ${String(seen.headRefOid).slice(0, 7)}, not the gated ${sha.slice(0, 7)}. Nothing was merged.`);
    if (seen.state !== "OPEN") stop(`${name}: the pull request is ${seen.state}, not open. Nothing was merged.`);
    if (seen.mergeable === "MERGEABLE") break;
    if (seen.mergeable === "CONFLICTING") stop(`${name}: the pull request conflicts with main. Nothing was merged.`);
    if (Date.now() > until) stop(`${name}: GitHub didn't show ${sha.slice(0, 7)} mergeable in ${Math.round(WAIT_MS / 1000)} s. Nothing was merged.`);
    await sleep(POLL_MS);
  }
  run("gh", ["pr", "merge", branch, "--merge", "--match-head-commit", sha], dir);
  const after = JSON.parse(read("gh", ["pr", "view", branch, "--json", "state,mergeCommit"], dir));
  const merged = after.mergeCommit?.oid;
  if (after.state !== "MERGED" || !merged) stop(`${name}: the pull request reads back as ${after.state}, not merged.`);
  say(`  ✔  ${name}: merged as ${merged.slice(0, 7)}`);
  return merged;
};

/** Bring a main folder to its remote's main by fast-forward, and nothing else. */
const fastForward = (name, dir) => {
  mustBeMainAndClean(name, dir);
  if (dry) return say(`  would run: git pull --ff-only origin main   (in ${dir})`);
  run("git", ["pull", "--ff-only", "origin", "main"], dir);
};

/** The next number after `now`: the next minor, or with --patch the next patch. */
export function nextVersion(now, wantPatch = false) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(now);
  if (!m) return null;
  return wantPatch ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : `${m[1]}.${Number(m[2]) + 1}.0`;
}

/**
 * The version change itself, in a checkout: the number under `## Next` in CHANGELOG.md, with what was under Next
 * now under it, and KIT_VERSION. Stops if there is nothing under Next to release, or the number is already there.
 */
export function cutVersion(dir, number) {
  const logAt = join(dir, "CHANGELOG.md");
  const log = readFileSync(logAt, "utf8");
  const at = log.indexOf("\n## Next\n");
  if (at < 0) throw new Stop("CHANGELOG.md has no `## Next` heading");
  if (log.includes(`\n## ${number}\n`)) throw new Stop(`CHANGELOG.md already has ${number}`);
  const after = log.slice(at + "\n## Next\n".length);
  const under = after.slice(0, Math.max(0, after.search(/\n## /)));
  if (under.trim() === "") throw new Stop("there is nothing under `## Next` in CHANGELOG.md: nothing to release");
  writeFileSync(logAt, `${log.slice(0, at)}\n## Next\n\n## ${number}\n${after}`);
  const constAt = join(dir, "packages", "core", "src", "constants.ts");
  const consts = readFileSync(constAt, "utf8");
  if (!/KIT_VERSION = "[^"]+"/.test(consts)) throw new Stop("packages/core/src/constants.ts has no KIT_VERSION");
  writeFileSync(constAt, consts.replace(/KIT_VERSION = "[^"]+"/, `KIT_VERSION = "${number}"`));
}

async function main() {
  if (unknown.length) stop(`not understood: ${unknown.join(" ")}. It takes a number (0.84.0), --patch and --dry-run.`);
  // Where things are: NSWP's main folder is the first worktree git lists, whichever worktree this is run from.
  const nswp = /^worktree (.+)$/m.exec(read("git", ["worktree", "list", "--porcelain"], here))?.[1] ?? stop("git didn't say where NSWP's main folder is");
  const portal = join(nswp, "..", "bitportal");
  const template = join(nswp, "..", "nswp-world-template");
  say(dry ? "\nA rehearsal: nothing is pushed, merged or changed in any main folder.\n" : "");

  say("Before anything: the three main folders");
  for (const [name, dir] of [["NSWP", nswp], ["BitPortal", portal], ["the world template", template]]) {
    mustBeMainAndClean(name, dir);
    run("git", ["fetch", "origin", "main"], dir);
    say(`  ✔  ${name}: on main, clean`);
  }
  const now = /KIT_VERSION = "([^"]+)"/.exec(read("git", ["show", "origin/main:packages/core/src/constants.ts"], nswp))?.[1] ?? stop("NSWP's main has no KIT_VERSION");
  const number = asked ?? nextVersion(now, patch) ?? stop(`KIT_VERSION on main is "${now}", which isn't a number this can count from. Give the number.`);
  const branch = `kit-${number}`;
  say(`\nKit ${now} -> ${number}\n`);

  // Worktrees of its own, side by side as the vendoring scripts expect to find NSWP: ../Nostr-Spatial-Web-Protocol--NSWP-.
  const work = mkdtempSync(join(process.env.NSWP_RELEASE_WORK ?? tmpdir(), "nswp-release-"));
  const made = [];
  const worktree = (repo, dir) => {
    run("git", ["worktree", "add", "-b", branch, dir, "origin/main"], repo);
    made.push([repo, dir]);
  };
  const tidy = () => {
    for (const [repo, dir] of made.reverse()) {
      try {
        execFileSync("git", ["worktree", "remove", "--force", dir], { cwd: repo, stdio: "ignore" });
        // A rehearsal leaves no branch behind; a real run's branch is on GitHub, merged.
        execFileSync("git", ["branch", "-D", branch], { cwd: repo, stdio: "ignore" });
      } catch {
        /* said below, by the folder being left */
      }
    }
    rmSync(work, { recursive: true, force: true });
  };
  try {
    // ---------------------------------------------------------------- 1. NSWP: the version pull request
    say("1. NSWP: the version");
    const cut = join(work, "nswp-version");
    worktree(nswp, cut);
    run("npm", ["ci"], cut);
    cutVersion(cut, number);
    say(`  ✔  CHANGELOG.md and KIT_VERSION say ${number}`);
    run("npm", ["run", "build"], cut);
    run("npm", ["run", "build:engine"], cut);
    run("npm", ["run", "gate"], cut);
    run("git", ["add", "-A"], cut);
    run("git", ["commit", "-m", `Kit ${number}`], cut);
    const merged = await pullRequest("NSWP", cut, branch, `Kit ${number}`, `The version, as fleet rule 11 says: the \`## Next\` heading gets ${number} under it, \`KIT_VERSION\`, the build, the engine script rebuilt. Made by \`npm run release:prepare\`; the full gate exited 0 on this commit.`);

    // ---------------------------------------------------------------- 2. NSWP's main folder, at that merge, built
    say("\n2. NSWP's main folder, at that merge");
    fastForward("NSWP", nswp);
    if (dry) say(`  would check its HEAD is the merge, then run: npm ci, npm run build   (in ${nswp})`);
    else {
      if (read("git", ["rev-parse", "HEAD"], nswp) !== merged) stop(`NSWP's main folder is at ${read("git", ["rev-parse", "--short", "HEAD"], nswp)}, not the merge ${merged.slice(0, 7)}: something else merged meanwhile. Nothing was vendored.`);
      run("npm", ["ci"], nswp);
      run("npm", ["run", "build"], nswp);
    }
    const from = dry ? "the merge" : `NSWP ${merged.slice(0, 7)}`;
    // The vendoring scripts read NSWP from beside their own folder.
    symlinkSync(nswp, join(work, "Nostr-Spatial-Web-Protocol--NSWP-"));

    // ---------------------------------------------------------------- 3. BitPortal
    say("\n3. BitPortal: the kit vendored");
    const p = join(work, "bitportal");
    if (dry) say(`  would, on a branch ${branch} from BitPortal's main, run: npm ci, npm run vendor -- --only nswp, npm run gate; commit "Kit ${number} vendored (${from})"; push, open the pull request, and merge it the same way`);
    else {
      worktree(portal, p);
      run("npm", ["ci"], p);
      run("npm", ["run", "vendor", "--", "--only", "nswp"], p);
      run("npm", ["run", "gate"], p);
      run("git", ["add", "-A"], p);
      run("git", ["commit", "-m", `Kit ${number} vendored (${from})`], p);
      await pullRequest("BitPortal", p, branch, `Kit ${number} vendored (${from})`, `The kit at ${number}, vendored from ${from} by \`npm run release:prepare\`. BitPortal's gate exited 0 on this commit.`);
    }

    // ---------------------------------------------------------------- 4. The world template
    say("\n4. The world template: the kit vendored");
    const t = join(work, "nswp-world-template");
    if (dry) say(`  would, on a branch ${branch} from the template's main, run: npm ci, npm run vendor, npm run check (stopping if it says the plumbing differs from the template; never --lock-plumbing); commit; push, open the pull request, and merge it the same way`);
    else {
      worktree(template, t);
      run("npm", ["ci"], t);
      run("npm", ["run", "vendor"], t);
      say(`  $ npm run check   (in ${t})`);
      const checked = read("npm", ["run", "check"], t);
      say(checked);
      if (/differs from the template/.test(checked)) stop("the template's check says its plumbing differs from the template. That is put right by hand, never by --lock-plumbing here. Nothing of the template was pushed.");
      run("git", ["add", "-A"], t);
      run("git", ["commit", "-m", `Kit ${number} vendored (${from})`], t);
      await pullRequest("the world template", t, branch, `Kit ${number} vendored (${from})`, `The kit at ${number}, vendored from ${from} by \`npm run release:prepare\`. \`npm run check\` exited 0 on this commit, with the plumbing as the template has it.`);
    }

    // ---------------------------------------------------------------- 5. The two main folders the deploy reads
    say("\n5. The main folders the deploy reads");
    fastForward("BitPortal", portal);
    fastForward("the world template", template);

    // ---------------------------------------------------------------- 6. What would now be deployed
    say("\n6. What `npm run release:all` would now deploy");
    if (dry) say(`  would run: npm run release:all   (in ${nswp}; without --go, which changes nothing)`);
    else run("npm", ["run", "release:all"], nswp);
    say(dry ? `\nThe rehearsal went through: kit ${number} can be cut. Nothing was pushed, merged or deployed.` : `\nKit ${number} is prepared, and nothing is deployed. Going live is the owner's word: npm run release:all -- --go`);
  } finally {
    tidy();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(`\n✘ Stopped: ${e instanceof Stop ? e.message : (e?.stack ?? e)}\n  Nothing after this step was run, and nothing was deployed.`);
      process.exit(1);
    },
  );
}
