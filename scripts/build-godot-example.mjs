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
const { KIT_VERSION, ITEM_BOX_HTML, itemBoxCsp, stampPage, cleanAccess, cleanRoot } = await import(join(root, "packages/core/dist/index.js"));
const config = JSON.parse(readFileSync(join(root, "sites", "sites.json"), "utf8"));
const world = JSON.parse(readFileSync(join(project, "world.json"), "utf8"));
// What it is entered by, where it is paid (protocol/01-worlds.md, "A paid world"): the listings its world.json
// names, each sold by the key it is announced with. It names none: The Foundry is free, and a test keeps it so
// until the owner says otherwise. And the world's own code must say the same, or it is built half paid.
const said = world.access === undefined ? [] : [world.access].flat();
const access = cleanAccess(said, [config.publisher]);
if (access.length !== said.length) throw new Error(`${world.d}: "access" in its world.json must be listings' coordinates (30078:<pubkey>:<name>), each once, sold by the publisher in sites.json, and at most eight.`);
// Whose lists count, and whether its rooms show only named people (protocol/10-identity.md, "A world's own lists").
// The Foundry says neither. A word that doesn't read stops the build.
const keepers = world.keepers === undefined ? null : cleanRoot(world.keepers);
if (world.keepers !== undefined && (!keepers || !Array.isArray(world.keepers) || keepers.length !== world.keepers.length)) throw new Error(`${world.d}: "keepers" in its world.json must be a list of one to four keys, each 64 lowercase hex, each once.`);
if (world.named_only !== undefined && typeof world.named_only !== "boolean") throw new Error(`${world.d}: "named_only" in its world.json must be true or false.`);
const needs = access.length > 0 || !!keepers || world.named_only === true;
const gateInCode = /^const NEEDS_GATE := (true|false)$/m.exec(readFileSync(join(project, "example", "main.gd"), "utf8"))?.[1];
if (gateInCode !== String(needs)) throw new Error(`engines/godot/world.json ${needs ? "asks for a gate (access, keepers or named_only)" : "asks for no gate"}, and example/main.gd says NEEDS_GATE := ${gateInCode}. They must agree.`);
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
          ...(access.length ? { access } : {}),
          ...(keepers ? { keepers } : {}),
          ...(world.named_only === true ? { named_only: true } : {}),
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
const carries = (world.items ?? "allowed") !== "none";
if (carries) writeFileSync(join(dist, "item-box.html"), ITEM_BOX_HTML);
// The picture a door to this world shows (protocol/04-previews.md), served from here under its hash, as the
// announcement says. `npm run previews -- --only foundry` takes it and records it in world.json.
const pictures = (world.previews ?? []).filter((p) => /^[0-9a-f]{64}$/.test(p.sha256 ?? "") && new URL(p.url).origin === new URL(world.url).origin);
// A world must have one. `--before-pictures` builds it without, which is how the first one gets taken.
if (!(world.previews ?? []).some((p) => p.type === "pano") && !process.argv.includes("--before-pictures"))
  throw new Error("engines/godot/world.json has no 360° picture for doors to show, and a world must have one. Take it: npm run build:godot -- --before-pictures, then npm run previews -- --only foundry, then npm run build:godot.");
if (pictures.length) mkdirSync(join(dist, "previews"), { recursive: true });
for (const p of pictures) {
  const from = join(root, "sites", "previews", `${p.sha256}.webp`);
  if (!existsSync(from)) throw new Error(`engines/godot/world.json names a picture that isn't in sites/previews/ (${p.sha256.slice(0, 12)}…). Run npm run previews -- --only foundry.`);
  cpSync(from, join(dist, "previews", `${p.sha256}.webp`));
}
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
  // It may be shown inside the client it sends its visitors through, and by nobody else (as every reference world).
  `frame-ancestors 'self' ${new URL(config.airlock).origin}`,
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
            // A microphone, for the room's voices: a world made with Godot has rooms since kit 0.55.0, and this still
            // said nobody's microphone could be used here.
            { key: "Permissions-Policy", value: "xr-spatial-tracking=(self), microphone=(self), camera=()" },
          ],
        },
        ...(carries ? [{ source: "/item-box\\.html", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "Content-Security-Policy", value: itemBoxCsp(new URL(config.airlock).origin) }] }] : []),
        // Always the latest (protocol/09-what-a-world-owes.md): a browser asks before it uses a copy it kept. The
        // engine is forty megabytes, and a browser that has the latest is told so in a few bytes.
        { source: "/((?!previews/|\\.well-known/nswp\\.json).*)", headers: [{ key: "Cache-Control", value: "no-cache" }] },
        // A picture is named by its hash, so it never changes; and any site may show it in a doorway.
        {
          source: "/previews/(.*)",
          headers: [
            { key: "Access-Control-Allow-Origin", value: "*" },
            { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          ],
        },
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
// The page is marked with this kit and with everything it is served with, so that it changes whenever either does:
// a browser keeps a page's old content rules for as long as the page itself is unchanged (core stamp.ts).
writeFileSync(join(dist, "index.html"), stampPage(readFileSync(join(dist, "index.html"), "utf8"), KIT_VERSION, readFileSync(join(dist, "vercel.json"), "utf8")));
console.log(`exported engines/godot/dist: ${readdirSync(dist).join(", ")}`);
