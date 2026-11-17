// Deploys each built site to its Vercel project (production).
// Run `npm run build` first. Needs the Vercel CLI, logged in.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2);
const projects = JSON.parse(readFileSync(join(root, "sites", "vercel-projects.json"), "utf8"));
for (const [name, ids] of Object.entries(projects.sites)) {
  if (only.length && !only.includes(name)) continue;
  const dist = join(root, "sites", name, "dist");
  if (!existsSync(join(dist, "index.html"))) throw new Error(`sites/${name}/dist is missing; run npm run build`);
  console.log(`deploying ${name} → ${ids.url}`);
  execFileSync("vercel", ["deploy", dist, "--prod", "--yes"], {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, VERCEL_ORG_ID: projects.orgId, VERCEL_PROJECT_ID: ids.projectId },
  });
}
