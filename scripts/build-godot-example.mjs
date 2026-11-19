// Exports the Godot example world (engines/godot) for the web, into engines/godot/dist, and puts the kit's
// script beside its page, which the export can't do for itself.
//
//   GODOT=/path/to/godot node scripts/build-godot-example.mjs
//
// Needs Godot 4 with its web export templates installed. Without GODOT set, it looks for `godot` on the PATH and
// then in ~/Applications.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const project = join(root, "engines", "godot");
const dist = join(project, "dist");

function findGodot() {
  if (process.env.GODOT) return process.env.GODOT;
  for (const name of ["godot", "godot4"]) {
    try {
      execFileSync(name, ["--version"], { stdio: "ignore" });
      return name;
    } catch {
      /* not on the PATH */
    }
  }
  const apps = join(homedir(), "Applications");
  if (existsSync(apps)) {
    for (const dir of readdirSync(apps).filter((d) => /^godot/i.test(d)).sort().reverse()) {
      const binary = readdirSync(join(apps, dir)).find((f) => /^Godot_v.*linux\.x86_64$/.test(f));
      if (binary) return join(apps, dir, binary);
    }
  }
  return null;
}

const godot = findGodot();
if (!godot) {
  console.error("Godot wasn't found. Set GODOT to its path. It needs the web export templates installed too.");
  process.exit(1);
}
// The kit's script, as the source builds it now.
execFileSync(process.execPath, [join(root, "scripts", "build-engine.mjs")], { stdio: "inherit" });
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
execFileSync(godot, ["--headless", "--path", project, "--export-release", "Web", join(dist, "index.html")], { stdio: ["ignore", "ignore", "inherit"] });
if (!existsSync(join(dist, "index.html"))) {
  console.error("Godot exported nothing. Are the web export templates installed for this version?");
  process.exit(1);
}
cpSync(join(project, "addons", "nswp", "web", "nswp-engine.js"), join(dist, "nswp-engine.js"));
console.log(`exported engines/godot/dist: ${readdirSync(dist).join(", ")}`);
