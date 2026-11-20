// Exports the Godot example world (engines/godot) for the web, into engines/godot/dist, and puts the kit's
// script and sounds beside its page, which the export can't do for itself.
//
//   GODOT=/path/to/godot node scripts/build-godot-example.mjs
//
// Needs Godot 4 with its web export templates installed. Without GODOT set, it looks for `godot` on the PATH and
// then in ~/Applications.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
// What goes beside the page: the kit's script and its sounds. Godot's export can't put them there itself.
// The page itself was written by the export from shell.html: only what goes beside it is copied.
cpSync(join(project, "addons", "nswp", "web"), dist, { recursive: true, filter: (from) => !from.endsWith(".gdignore") && !from.endsWith("shell.html") });

// The example is also a public world, The Foundry (engines/godot/world.json; sites/sites.json, "elsewhere"). What
// makes an export a world is beside the page, and has nothing to do with Godot: the file that says which key may
// announce it, and what its host is to send with each file.
const { KIT_VERSION, ITEM_BOX_HTML, ITEM_BOX_CSP } = await import(join(root, "packages/core/dist/index.js"));
const config = JSON.parse(readFileSync(join(root, "sites", "sites.json"), "utf8"));
const world = JSON.parse(readFileSync(join(project, "world.json"), "utf8"));
mkdirSync(join(dist, ".well-known"), { recursive: true });
writeFileSync(
  join(dist, ".well-known", "nswp.json"),
  `${JSON.stringify(
    {
      schema: "nswp/manifest/0.3",
      kit: KIT_VERSION,
      listing: "allow",
      publishers: { [config.publisher]: { worlds: [world.d] } },
      worlds: {
        [world.d]: {
          entry: { url: world.url, modes: world.modes },
          entry_points: world.entryPoints,
          capabilities: world.capabilities,
          // The engine comes with it: a visitor's client can say so before they go.
          budgets: { initial_download_mb: 40 },
          airlock: config.airlock,
        },
      },
      relays: config.relays,
    },
    null,
    2,
  )}\n`,
);
// A world that draws what its visitors carry (protocol/17-items.md) also serves the locked box an item's own logic
// runs in: a page of its own, under rules that let it reach nothing, and none of this site's other rules. A world
// with no items has no such page.
const carries = world.items === "allowed" || world.items === "play";
if (carries) writeFileSync(join(dist, "item-box.html"), ITEM_BOX_HTML);
const csp = [
  "default-src 'self'",
  // Godot's engine is WebAssembly. Nothing is written into the page itself (addons/nswp/web/shell.html).
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https: wss:",
  // The one thing embedded from elsewhere: the visitor's own client's signer, which the world can't read.
  "frame-src 'self' https:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");
writeFileSync(
  join(dist, "vercel.json"),
  `${JSON.stringify(
    {
      headers: [
        {
          source: carries ? "/((?!item-box\\.html$).*)" : "/(.*)",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "no-referrer" },
            { key: "Content-Security-Policy", value: csp },
            { key: "Permissions-Policy", value: "xr-spatial-tracking=(self), microphone=(), camera=()" },
          ],
        },
        ...(carries ? [{ source: "/item-box\\.html", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "Content-Security-Policy", value: ITEM_BOX_CSP }] }] : []),
        // Always the latest (protocol/09-what-a-world-owes.md): a browser asks before it uses a copy it kept. The
        // engine is forty megabytes, and a browser that has the latest is told so in a few bytes.
        { source: "/((?!\\.well-known/nswp\\.json).*)", headers: [{ key: "Cache-Control", value: "no-cache" }] },
        {
          source: "/.well-known/nswp.json",
          headers: [
            { key: "Access-Control-Allow-Origin", value: "*" },
            { key: "Content-Type", value: "application/json; charset=utf-8" },
            { key: "Cache-Control", value: "public, max-age=300" },
          ],
        },
      ],
    },
    null,
    2,
  )}\n`,
);
console.log(`exported engines/godot/dist: ${readdirSync(dist).join(", ")}`);
