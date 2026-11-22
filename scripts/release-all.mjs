// Every public site, moved together: the seven reference worlds, the Starter Home, The Foundry (the Godot example)
// and BitPortal.
//
// Each of them is a site of its own with its own copy of the kit, so nothing keeps them alike but deploying them
// alike. This is the one command for that. It refuses to start unless all three repositories are on the same
// kit, and it deploys all ten sites or says exactly which it did before it stopped.
//
//   npm run release:all            say what would be deployed, and why not if it can't be. Changes nothing.
//   npm run release:all -- --go    do it. Deploying is the owner's to approve, each time: run this on their word.
//
// It exits 1 whenever nothing was deployed with --go (it refused), whenever a step fails, and whenever a site
// didn't come up on the kit afterwards; 0 only when all of it went through (or, without --go, when it is ready).
// Read that from the script itself: piped through `| tail`, a shell gives tail's exit, which is 0. Use
// `set -o pipefail`, or `${PIPESTATUS[0]}`. (packages/core/test/release-all.test.ts holds it to the first.)
//
// Needs the Vercel CLI, logged in, and the three repositories side by side:
//   ../bitportal   ../nswp-world-template
import { execFileSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const go = process.argv.includes("--go");
const portal = join(root, "..", "bitportal");
const template = join(root, "..", "nswp-world-template");
const projects = JSON.parse(readFileSync(join(root, "sites", "vercel-projects.json"), "utf8"));
const WORLDS = ["gallery", "grove", "tour", "arcade", "observatory", "workshop", "library"];
/** How many deployments this makes: the worlds, the Starter Home, The Foundry, BitPortal. */
const NEEDED = WORLDS.length + 3;
/**
 * How many deployments Vercel allows in any 24 hours, by the plan the team is on (vercel.com/docs/limits,
 * "Deployments Created per Day"). The plan is asked for each time, and a plan this doesn't know, or one that
 * couldn't be read, is counted as the free one: the careful answer.
 */
const DAILY_BY_PLAN = { hobby: 100, pro: 6000 };

const run = (cmd, args, cwd, opts = {}) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
const quiet = (cmd, args, cwd) => {
  try {
    return run(cmd, args, cwd).trim();
  } catch (e) {
    return null;
  }
};
const problems = [];
const say = (ok, words) => console.log(`  ${ok ? "✔" : "✘"}  ${words}`);
const need = (ok, words, fix) => {
  say(ok, words);
  if (!ok) problems.push(fix ?? words);
  return ok;
};

// ---------------------------------------------------------------- the three repositories, as they stand
console.log("\nThe three repositories");
const kit = /KIT_VERSION = "([^"]+)"/.exec(readFileSync(join(root, "packages/core/src/constants.ts"), "utf8"))?.[1];
const head = quiet("git", ["rev-parse", "HEAD"], root);
for (const [name, dir] of [["NSWP", root], ["BitPortal", portal], ["the world template", template]]) {
  if (!existsSync(join(dir, ".git"))) {
    need(false, `${name} isn't at ${dir}`);
    continue;
  }
  const branch = quiet("git", ["branch", "--show-current"], dir);
  const dirty = quiet("git", ["status", "--porcelain"], dir);
  quiet("git", ["fetch", "-q", "origin"], dir);
  const behind = quiet("git", ["rev-list", "--count", "HEAD..origin/main"], dir);
  const ahead = quiet("git", ["rev-list", "--count", "origin/main..HEAD"], dir);
  need(branch === "main" && !dirty && behind === "0" && ahead === "0", `${name} is on main, clean, and the same as what is on GitHub`, `${name}: ${branch !== "main" ? `on branch ${branch}` : dirty ? "has changes that aren't committed" : behind !== "0" ? "is behind GitHub: git pull" : "has commits that aren't pushed"}`);
}
/** The NSWP commit a repository's copy of the kit was taken from. Each repository writes it down its own way. */
const vendoredAt = (dir) => {
  try {
    const kept = JSON.parse(readFileSync(join(dir, "vendor", "integrity.json"), "utf8"));
    const sources = [kept.source, ...Object.values(kept.packages ?? {}).map((p) => p.source)].filter(Boolean);
    return sources.find((source) => /Nostr-Spatial-Web-Protocol/.test(source.remote ?? source.repository ?? ""))?.commit ?? null;
  } catch {
    return null;
  }
};
/**
 * Whether the kit at that commit is the kit here. A later commit that changed only words or scripts changed no
 * kit: what a world carries is built from `packages/`, and nothing else.
 */
const sameKit = (at) => {
  try {
    run("git", ["diff", "--quiet", at, "HEAD", "--", "packages"], root);
    return true;
  } catch {
    return false;
  }
};
for (const [name, dir, how] of [["BitPortal", portal, "npm run vendor -- --only nswp"], ["The world template", template, "npm run vendor"]]) {
  const at = vendoredAt(dir);
  need(!!at && sameKit(at), `${name} carries this repo's kit (${kit}, taken at ${at?.slice(0, 7) ?? "?"})`, `${name} carries the kit from ${at?.slice(0, 7) ?? "nowhere this could read"}, and the kit has changed here since: in that repo, ${how}, then commit and merge`);
}

// ---------------------------------------------------------------- what is public now
console.log("\nWhat is public now");
const live = async (url) => {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    return res.ok ? ((await res.json()).kit ?? null) : null;
  } catch {
    return null;
  }
};
const sites = [
  ...WORLDS.map((name) => [name, new URL("/.well-known/nswp.json", projects.sites[name].url).href]),
  ["starter", new URL("/.well-known/nswp.json", projects.templateDemo.url).href],
  ["foundry", new URL("/.well-known/nswp.json", projects.godotDemo.url).href],
  ["portal", "https://portal.bitblocks.network/version.json"],
];
let behindNow = 0;
for (const [name, url] of sites) {
  const has = await live(url);
  if (has !== kit) behindNow++;
  console.log(`  ${has === kit ? "=" : "→"}  ${name.padEnd(12)} ${has ? `kit ${has}` : "didn't say"}${has === kit ? "" : `   would become ${kit}`}`);
}

// ---------------------------------------------------------------- what the deploy itself needs
console.log("\nWhat the deploy needs");
// The Foundry is exported by Godot, on this machine: without it there is no tenth site to deploy.
const hasGodot = (() => {
  if (process.env.GODOT) return existsSync(process.env.GODOT);
  if (quiet("godot", ["--version"], root) !== null || quiet("godot4", ["--version"], root) !== null) return true;
  try {
    return readdirSync(join(homedir(), "Applications")).some((d) => /^godot/i.test(d));
  } catch {
    return false;
  }
})();
need(hasGodot, "Godot is here, to export The Foundry", "Godot 4 with its web export templates isn't on this machine, and The Foundry is exported by it: install it, or set GODOT to its path");
// Every address a door here leads to answers: nothing is deployed that points somewhere that isn't there.
for (const [name, url] of [["starter", projects.templateDemo.url], ["foundry", projects.godotDemo.url]]) {
  const host = new URL(url).host;
  const there = await lookup(host).then(
    () => true,
    () => false,
  );
  need(there, `${host} has an address`, `${host} has no DNS record yet: add it before a deploy puts doors to ${name} in the other worlds`);
}

// ---------------------------------------------------------------- room to deploy
console.log("\nRoom to deploy");
let plan = "hobby";
try {
  const said = JSON.parse(run("vercel", ["api", `/v2/teams/${projects.orgId}`], root)).billing?.plan;
  if (typeof said === "string" && said in DAILY_BY_PLAN) plan = said;
} catch {
  /* counted as the free plan */
}
const DAILY = DAILY_BY_PLAN[plan];
let used = null;
try {
  const since = Date.now() - 24 * 3600 * 1000;
  // A page at a time, a hundred to a page, until there are no more or there is plainly no room.
  let until = "";
  used = 0;
  for (let page = 0; page < 80; page++) {
    const got = JSON.parse(run("vercel", ["api", `/v6/deployments?teamId=${projects.orgId}&since=${since}&limit=100${until}`], root));
    used += got.deployments.length;
    const next = got.pagination?.next;
    if (!next || got.deployments.length === 0 || used + NEEDED > DAILY) break;
    until = `&until=${next}`;
  }
} catch {
  used = null;
}
need(used !== null && used + NEEDED <= DAILY, used === null ? "Vercel couldn't be asked how many deployments were made today" : `${used} deployments in the last 24 hours; this makes ${NEEDED} more, of ${DAILY} allowed on the ${plan} plan`, used === null ? "the Vercel CLI didn't answer: is it installed and logged in?" : `only ${DAILY - used} deployments are left today, and this needs ${NEEDED}`);

if (problems.length) {
  console.log(`\nNothing was deployed. To put right first:\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
  process.exit(1);
}
if (!go) {
  console.log(`\nReady. ${behindNow ? `${behindNow} of ${sites.length} public sites differ from this kit.` : "Every public site is already on this kit: a deploy would only publish other changes."}\nNothing was deployed: this was a look. With the owner's word, run it again with --go:\n\n  npm run release:all -- --go\n`);
  process.exit(0);
}

// ---------------------------------------------------------------- tests, then all ten
const step = (words, fn) => {
  process.stdout.write(`  …  ${words}`);
  try {
    fn();
    console.log(`\r  ✔  ${words}`);
  } catch (e) {
    console.log(`\r  ✘  ${words}\n\n${String(e.stdout ?? "").slice(-1500)}${String(e.stderr ?? e.message ?? "").slice(-1500)}`);
    throw e;
  }
};
const done = [];
let work = null;
try {
  console.log("\nTests and builds, before anything is deployed");
  step("NSWP: tests", () => run("npm", ["test"], root));
  step("NSWP: build", () => run("npm", ["run", "build"], root));
  step("NSWP: the engine script is what the source builds", () => run("npm", ["run", "engine:check"], root));
  step("BitPortal: types, tests, vendored files", () => {
    run("npm", ["run", "typecheck"], portal);
    run("npm", ["test"], portal);
    run("npm", ["run", "vendor:check"], portal);
  });
  step("BitPortal: build", () => run("npm", ["run", "build"], portal));
  step("The Foundry: exported from Godot", () => run("npm", ["run", "build:godot"], root));
  // The Starter Home is the template itself, as someone starting from it gets it, with this demo's own files.
  work = mkdtempSync(join(tmpdir(), "starter-home-"));
  const home = join(work, "home");
  step("Starter Home: a fresh copy of the template, checked", () => {
    run("git", ["clone", "-q", template, home], work);
    const demo = join(root, "sites", "template-demo");
    cpSync(join(demo, "world.json"), join(home, "world.json"));
    for (const dir of ["signed", "previews"]) cpSync(join(demo, dir), join(home, dir), { recursive: true });
    run("npm", ["ci"], home);
    run("npm", ["run", "check"], home);
  });

  console.log("\nDeploying");
  const deploy = (name, dist, projectId) =>
    step(name, () => {
      run("vercel", ["deploy", dist, "--prod", "--yes"], root, { env: { ...process.env, VERCEL_ORG_ID: projects.orgId, VERCEL_PROJECT_ID: projectId } });
      done.push(name);
    });
  // The worlds first and BitPortal last: a portal is never on a newer kit than the worlds it sends people to.
  for (const name of WORLDS) deploy(name, join(root, "sites", name, "dist"), projects.sites[name].projectId);
  deploy("starter", join(home, "dist"), projects.templateDemo.projectId);
  deploy("foundry", join(root, "engines", "godot", "dist"), projects.godotDemo.projectId);
  const portalProject = JSON.parse(readFileSync(join(portal, "vercel-project.json"), "utf8"));
  deploy("portal", join(portal, "dist"), portalProject.projectId);
} catch {
  console.log(`\nStopped. Deployed so far: ${done.length ? done.join(", ") : "nothing"}. Not deployed: ${sites.map(([n]) => n).filter((n) => !done.includes(n)).join(", ")}.\nPut right what failed and run it again: sites already on this kit are deployed again, which is harmless.\n`);
  process.exitCode = 1;
} finally {
  if (work) rmSync(work, { recursive: true, force: true });
}
if (process.exitCode) process.exit();

console.log("\nWhat is public now");
let wrong = 0;
for (const [name, url] of sites) {
  const has = await live(url);
  if (has !== kit) wrong++;
  say(has === kit, `${name.padEnd(12)} ${has ? `kit ${has}` : "didn't say"}`);
}
console.log(wrong ? `\n${wrong} did not come up on kit ${kit}. Look at those before anything else.\n` : `\nAll ${sites.length} sites are on kit ${kit}.\n`);
process.exit(wrong ? 1 : 0);
