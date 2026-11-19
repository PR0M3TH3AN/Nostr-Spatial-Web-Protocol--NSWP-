// Which kit is every site on? Asks each one what it was built with and sets it beside the kit in this repo.
//
//   npm run kits            the public sites
//   npm run kits -- --local the copies on the development server (scripts/serve-local.mjs; --at=https://host:port names it)
//
// A world says its kit in its manifest (/.well-known/nswp.json, "kit"). BitPortal says the kit and the BitLogin it
// carries in /version.json. Exits 1 if any site is on another kit than this repo's, or didn't answer: so it can
// stand in front of a deploy, and after one.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const local = process.argv.includes("--local");
const kit = /KIT_VERSION = "([^"]+)"/.exec(readFileSync(join(root, "packages", "core", "src", "constants.ts"), "utf8"))?.[1];
const projects = JSON.parse(readFileSync(join(root, "sites", "vercel-projects.json"), "utf8"));
const PORTAL = "https://portal.bitblocks.network/";

// A development server's certificate is its own: only its copies are asked without checking it.
if (local) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const ask = async (url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
};
/** On a development server, the address a real site is served at there: it says so itself (docs/local-server.md). */
const LOCAL = process.argv.find((a) => a.startsWith("--at="))?.slice(5) ?? "https://192.168.68.84:4300";
const said = local ? await ask(`${LOCAL}/.well-known/nswp-local.json`) : null;
const map = said?.sites ?? said ?? {};
const there = (url) => {
  if (!local) return url;
  const to = map[new URL(url).origin];
  return typeof to === "string" ? `${to.replace(/\/$/, "")}/` : null;
};

const sites = [
  ...Object.entries(projects.sites)
    .filter(([name]) => name !== "airlock")
    .map(([name, s]) => ({ name, url: s.url, world: true })),
  { name: "starter", url: projects.templateDemo.url, world: true },
  { name: "portal", url: PORTAL, world: false },
];
let behind = 0;
console.log(`This repo's kit is ${kit}.${local ? " Asking the development server's copies." : ""}\n`);
for (const site of sites) {
  const at = there(site.url);
  if (!at) {
    console.log(`  ?  ${site.name.padEnd(12)} not served on this development server`);
    continue;
  }
  const told = site.world ? await ask(`${at}.well-known/nswp.json`) : await ask(`${at}version.json`);
  const has = told?.kit ?? null;
  const same = has === kit;
  if (!same) behind++;
  const more = !site.world && told?.bitlogin ? `, BitLogin ${String(told.bitlogin).slice(0, 7)}` : "";
  console.log(`  ${same ? "✔" : "✘"}  ${site.name.padEnd(12)} ${has ? `kit ${has}` : told ? "doesn't say (built before sites said)" : "didn't answer"}${more}   ${new URL(at).host}`);
}
console.log(behind ? `\n${behind} of ${sites.length} ${behind === 1 ? "is" : "are"} not on this kit. Worlds: npm run build && npm run deploy:sites. The portal and the Starter Home are deployed from their own repos.` : "\nEvery site is on this kit.");
process.exit(behind ? 1 : 0);
