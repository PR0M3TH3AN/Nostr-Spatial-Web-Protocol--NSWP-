// Builds the reference sites into sites/<name>/dist as plain static files.
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { KIT_VERSION, ITEM_BOX_HTML, itemBoxCsp, stampPage, cleanLightningAddress, cleanAccess, paidWorldReaches, cleanRoot, checkEntryPlaces } = await import(join(root, "packages/core/dist/index.js"));
const config = JSON.parse(readFileSync(join(root, "sites", "sites.json"), "utf8"));
// A door says what kind of place it leads to, from sites.json. That must be the place's own word, in its world.json.
for (const [name, file] of [...Object.keys(config.worlds).map((n) => [n, join(root, "sites", n, "world.json")]), ["starter", join(root, "sites", "template-demo", "world.json")], ["foundry", join(root, "engines", "godot", "world.json")]]) {
  const said = (config.worlds[name] ?? config.elsewhere[name])?.category;
  // The Starter Home's file is the template's, which keeps a world's own details under "world".
  const read = JSON.parse(readFileSync(file, "utf8"));
  const own = (read.world ?? read).category;
  if (said !== own) throw new Error(`sites.json says ${name} is "${said}", and its own world.json says "${own}". They must agree.`);
  // And what it does with the things visitors carry (protocol/17-items.md): a door warns of a place where items
  // are part of play, so that word must be the place's own too.
  // A place that says nothing has items: `none` is the word that turns them off.
  const carried = (config.worlds[name] ?? config.elsewhere[name])?.items ?? "allowed";
  const ownCarried = (read.world ?? read).items ?? "allowed";
  if (carried !== ownCarried) throw new Error(`sites.json says ${name} does "${carried}" with items, and its own world.json says "${ownCarried}". They must agree.`);
  // And what it offers (NSWP-01, "What a world offers"): a door shows lit and dark tiles for the place it leads to,
  // from what its own site was told, so that must be the place's own word, exactly: the same modes, the same
  // capabilities, and the same word for items or the same silence. Saying nothing is not saying `allowed` here.
  const place = config.worlds[name] ?? config.elsewhere[name];
  const world = read.world ?? read;
  for (const key of ["modes", "capabilities"]) {
    if (JSON.stringify(place?.[key] ?? null) !== JSON.stringify(world[key] ?? null))
      throw new Error(`sites.json says ${name}'s ${key} are ${JSON.stringify(place?.[key] ?? null)}, and its own world.json says ${JSON.stringify(world[key] ?? null)}. They must agree: copy the world's own.`);
  }
  if ((place?.items ?? null) !== (world.items ?? null))
    throw new Error(`sites.json says ${name}'s items are ${JSON.stringify(place?.items ?? null)}, and its own world.json says ${JSON.stringify(world.items ?? null)}. They must agree, word for word or both silent.`);
  // And every world has the picture its doors show (protocol/04-previews.md): a 360° still, which is required.
  // `--before-pictures` builds without, which is how a new world's first one gets taken (`npm run previews`).
  if (!((read.world ?? read).previews ?? []).some((p) => p.type === "pano") && !process.argv.includes("--before-pictures"))
    throw new Error(`${name} has no 360° picture for doors to show, and a world must have one. Take it: npm run build -- --before-pictures, then npm run previews -- --only ${name}, then npm run build.`);
  // And the page must do what the announcement says: a reference world's own code names the same rule.
  if (config.worlds[name]) {
    const inCode = /^\s*items: "([a-z]+)",?\s*$/m.exec(readFileSync(join(root, "sites", name, "src", "main.ts"), "utf8"))?.[1] ?? "allowed";
    if (inCode !== carried) throw new Error(`sites.json says ${name} does "${carried}" with items, and its src/main.ts says "${inCode}". They must agree.`);
  }
  // Places to arrive (protocol/01-worlds.md): every entry point a set, at least eight here (every world here has
  // rooms), a metre or more apart. Read from the literal in src/main.ts, where the world writes them.
  const main = join(root, "sites", name, "src", "main.ts");
  const entryAt = config.worlds[name] && existsSync(main) ? readFileSync(main, "utf8").indexOf("entryPoints:") : -1;
  if (entryAt >= 0) {
    const text = readFileSync(main, "utf8");
    const open = text.indexOf("{", entryAt);
    let depth = 0;
    let end = open;
    for (; end < text.length; end++) {
      if (text[end] === "{") depth++;
      else if (text[end] === "}" && --depth === 0) break;
    }
    let entryPoints;
    try {
      entryPoints = Function(`"use strict"; return (${text.slice(open, end + 1)});`)();
    } catch {
      throw new Error(`${name}'s src/main.ts: its entryPoints must be written as plain numbers and names, for the build to check them.`);
    }
    const issues = checkEntryPlaces(entryPoints, { capabilities: ["rooms"] });
    const bad = issues.filter((i) => i.level === "error" || i.code === "single_spot");
    if (bad.length) throw new Error(`${name}'s places to arrive:\n  ${bad.map((i) => i.message).join("\n  ")}`);
  }
}
/**
 * What a world is entered by, where it is paid (protocol/01-worlds.md, "A paid world"): the listings its own
 * world.json names under `access`, each sold by the key these worlds are announced with. None of the worlds here
 * names any: they are free, and a test keeps them so until the owner says otherwise (`listing.test.ts`). A listing
 * that isn't this publisher's to sell stops the build: a world must never be built half paid.
 */
const accessOf = (world) => {
  const said = world.access === undefined ? [] : [world.access].flat();
  const listings = cleanAccess(said, [config.publisher]);
  if (listings.length !== said.length) throw new Error(`${world.d}: "access" in its world.json must be listings' coordinates (30078:<pubkey>:<name>), each once, sold by the publisher in sites.json, and at most eight.`);
  return listings;
};
/**
 * A world's own rules for who comes in (protocol/10-identity.md, "A world's own lists"): whose lists count
 * (`keepers`, one to four keys) and whether its rooms show only named people (`named_only`). None of the worlds
 * here says either, and a test keeps them so until the owner says otherwise. A word that doesn't read stops the
 * build: a world must never be built with a rule it didn't mean.
 */
const rulesOf = (world) => {
  const out = {};
  if (world.keepers !== undefined) {
    const keepers = cleanRoot(world.keepers);
    if (!keepers || !Array.isArray(world.keepers) || keepers.length !== world.keepers.length) throw new Error(`${world.d}: "keepers" in its world.json must be a list of one to four keys, each 64 lowercase hex, each once.`);
    out.keepers = keepers;
  }
  if (world.named_only !== undefined) {
    if (typeof world.named_only !== "boolean") throw new Error(`${world.d}: "named_only" in its world.json must be true or false.`);
    if (world.named_only) out.named_only = true;
  }
  if (world.by_invitation !== undefined) {
    if (typeof world.by_invitation !== "boolean") throw new Error(`${world.d}: "by_invitation" in its world.json must be true or false.`);
    if (world.by_invitation) out.by_invitation = true;
  }
  return out;
};
/** Whether a world draws what its visitors carry: then it fetches models from wherever their makers keep them. */
const carries = (s) => {
  return (config.worlds[s.name]?.items ?? "allowed") !== "none";
};
/** The headset test page's sender (sites/shared/xr-test-post.js), built once and written into every world. */
let xrTestPostBuilt = null;
const xrTestPost = async () =>
  (xrTestPostBuilt ??= (
    await build({ entryPoints: [join(root, "sites", "shared", "xr-test-post.js")], bundle: true, format: "iife", target: "es2022", minify: true, write: false, legalComments: "none", logLevel: "warning" })
  ).outputFiles[0].text);
// Every world in sites.json, and the reference Airlock. Pass names to build only those.
const only = process.argv.slice(2);
const sites = [...Object.keys(config.worlds).map((name) => ({ name, entry: "src/main.ts", world: true })), { name: "airlock", entry: "src/airlock.ts", world: false }].filter(
  (s) => !only.length || only.includes(s.name),
);

// The mark, as each site's page icon: the kit's own `markSvg` (packages/sdk/src/ui/mark.ts), in the site's own accent,
// and the kit's tile for a phone's home screen. Bundled here from the kit's source, so the icon is the same shape as
// the menu's button by construction.
const markModule = await build({ entryPoints: [join(root, "packages", "sdk", "src", "ui", "mark.ts")], bundle: true, write: false, format: "esm", platform: "neutral", logLevel: "silent" });
const { markSvg } = await import(`data:text/javascript;base64,${Buffer.from(markModule.outputFiles[0].text).toString("base64")}`);
const MARK_TILE_180 = join(root, "packages", "sdk", "assets", "mark", "mark-tile-180.png");
/** A site's own accent, from its entry (`palette: { accent: 0xrrggbb }`), or the kit's where it has none. */
const accentOf = (dir, entry) => {
  const found = readFileSync(join(dir, entry), "utf8").match(/accent:\s*0x([0-9a-fA-F]{6})\b/);
  return found ? `#${found[1].toLowerCase()}` : undefined;
};
const ICON_LINKS = `<link rel="icon" href="mark.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="mark-tile-180.png">`;

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
/** A world's page: a stage and nothing else. Its controls come from the NSWP controls kit. */
const page = (world) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escape(world.title)}</title>
<meta name="description" content="${escape(world.summary)}">
${ICON_LINKS}
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  #stage canvas { display: block; touch-action: none; }
  .leaving #stage { opacity: .4; transition: opacity .3s; }
</style>
</head>
<body>
<div id="stage"></div>
<script type="module" src="./app.js"></script>
</body>
</html>
`;
/** What the site says about itself (spec §5.3): which key may announce it, and where it is. */
const manifest = (world) => ({
  schema: "nswp/manifest/0.3",
  // Which kit this build is, so a visitor's client can tell how old a world's controls are without loading it.
  kit: KIT_VERSION,
  listing: "allow",
  publishers: { [config.publisher]: { worlds: [world.d] } },
  // Where a tip to this world goes, if it takes them: a lightning address, which is public. A visitor's sign-in
  // address reads it from here, at this world's own address, and from nowhere else (protocol/10-identity.md).
  ...(cleanLightningAddress(world.tip) ? { tip: cleanLightningAddress(world.tip) } : {}),
  worlds: {
    [world.d]: {
      entry: { url: world.url, modes: world.modes },
      entry_points: world.entryPoints,
      capabilities: world.capabilities,
      rooms: { transports: ["mesh"], max_mesh: 8 },
      budgets: { initial_download_mb: 2 },
      airlock: config.airlock,
      // What it is entered by, where it is paid. The world reads this, its visitor's sign-in address reads this,
      // and a client can before anyone crosses. Left out, the world is free.
      ...(accessOf(world).length ? { access: accessOf(world) } : {}),
      // Whose lists count, and whether its rooms show only named people. Left out, as in every world here.
      ...rulesOf(world),
    },
  },
  relays: config.relays,
});

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

for (const s of sites) {
  const dir = join(root, "sites", s.name);
  const out = join(dir, "dist");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await build({
    entryPoints: { app: join(dir, s.entry) },
    bundle: true,
    splitting: true,
    format: "esm",
    target: "es2022",
    minify: true,
    sourcemap: false,
    outdir: out,
    chunkNames: "chunks/[name]-[hash]",
    legalComments: "linked",
    logLevel: "warning",
  });
  const world = s.world ? JSON.parse(readFileSync(join(dir, "world.json"), "utf8")) : null;
  if (world) writeFileSync(join(out, "index.html"), page(world));
  else cpSync(join(dir, "index.html"), join(out, "index.html"));
  // Its page icon, in its own accent, and the kit's tile for a phone's home screen.
  writeFileSync(join(out, "mark.svg"), `${markSvg({ accent: accentOf(dir, s.entry), tile: false })}\n`);
  cpSync(MARK_TILE_180, join(out, "mark-tile-180.png"));
  if (s.world) {
    // Sound: the kit's own files, which every world starts with, and this world's own beside them.
    const sound = /\.(ogg|oga|opus|mp3|m4a|aac|wav|webm|flac|json)$/;
    const copySounds = (from, to) => {
      for (const f of readdirSync(from, { withFileTypes: true })) {
        if (f.isDirectory()) copySounds(join(from, f.name), join(to, f.name));
        else if (sound.test(f.name)) {
          mkdirSync(to, { recursive: true });
          cpSync(join(from, f.name), join(to, f.name));
        }
      }
    };
    // A test page for finding out what a headset's browser does at a door (sites/shared/xr-test): on every world,
    // since the question is what happens between two sites. It is linked from nowhere.
    cpSync(join(root, "sites", "shared", "xr-test"), join(out, "xr-test"), { recursive: true });
    // The part of it that sends a guided run's log out: signing needs a library, and the test itself stays without one.
    writeFileSync(join(out, "xr-test", "post.js"), await xrTestPost());
    copySounds(join(root, "packages", "sdk", "sounds"), join(out, "sounds", "kit"));
    if (existsSync(join(dir, "sounds"))) copySounds(join(dir, "sounds"), join(out, "sounds"));
    // Previews this world mirrors by hash: its own, and those of the worlds its portals lead to.
    mkdirSync(join(out, "previews"), { recursive: true });
    for (const f of readdirSync(join(root, "sites", "previews"))) {
      if (/^[0-9a-f]{64}\.webp$/.test(f)) cpSync(join(root, "sites", "previews", f), join(out, "previews", f));
    }
    // The starter items' models (protocol/17-items.md), named by hash, kept by one world for every world to fetch.
    if (config.keepsItems === s.name) {
      mkdirSync(join(out, "items"), { recursive: true });
      for (const f of readdirSync(join(root, "sites", "items", "models"))) {
        if (/^[0-9a-f]{64}\.(glb|js|ogg)$/.test(f)) cpSync(join(root, "sites", "items", "models", f), join(out, "items", f));
      }
    }
    // The locked box an item's own logic runs in (protocol/17-items.md): a page of its own, served under rules
    // that let it reach nothing, in a world that draws items. A world with none has no such page.
    if (carries(s)) writeFileSync(join(out, "item-box.html"), ITEM_BOX_HTML);
    mkdirSync(join(out, ".well-known"), { recursive: true });
    writeFileSync(join(out, ".well-known", "nswp.json"), `${JSON.stringify(manifest(world), null, 2)}\n`);
  }
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    // A visitor's own files, played from where the browser keeps them: their music, and video on a panel.
    "media-src 'self' blob:",
    // Worlds reach Nostr relays (wss) for the room handshake; the Airlock also fetches manifests (https).
    // A world that draws what its visitors carry (protocol/17-items.md) fetches each item's model from wherever its
    // maker keeps it, so it may reach any https address. Every file is checked against the hash its description
    // gives before it is used. A world with no items reaches only itself and relays, as before.
    // A paid world asks the service that signed a receipt whether it was taken back since: that service by name,
    // and nothing else is added for it.
    s.world && !carries(s) ? ["connect-src 'self' wss:", ...paidWorldReaches(accessOf(world))].join(" ") : "connect-src 'self' https: wss:",
    // A world embeds one thing from elsewhere: its visitor's own client's signer, which it can't read
    // (protocol/10-identity.md, "Signing from a world"). Which client that is, is the visitor's choice.
    ...(s.world ? ["frame-src 'self' https:"] : []),
    "base-uri 'none'",
    "form-action 'none'",
    // A world may be shown inside its visitors' client, where that client keeps the screen filled from world to
    // world by showing each in a frame of its own page (protocol/02-doors.md, "A client that keeps the screen").
    // Only the client these worlds send their visitors through is let: any other page that framed a world could
    // lay something over it. The Airlock is framed by nobody.
    s.world ? `frame-ancestors 'self' ${new URL(config.airlock).origin}` : "frame-ancestors 'none'",
  ].join("; ");
  const headers = [
    {
      // Every page but the locked box, which has rules of its own below: this world's rules would stop the one
      // script the box is for, and the box's own are far tighter.
      source: s.world && carries(s) ? "/((?!item-box\\.html$).*)" : "/(.*)",
      headers: [
        ...common,
        { key: "Content-Security-Policy", value: csp },
        { key: "Permissions-Policy", value: s.world ? "xr-spatial-tracking=(self), microphone=(self)" : "xr-spatial-tracking=(self), camera=(), microphone=()" },
      ],
    },
  ];
  // Always the latest (protocol/09-what-a-world-owes.md): a browser asks before it uses a copy of the page or a
  // script it kept. Said outright, and not left to a host's habit. Not for what is named by its hash, or has a
  // rule of its own below.
  headers.push({ source: "/((?!previews/|items/|\\.well-known/nswp\\.json).*)", headers: [{ key: "Cache-Control", value: "no-cache" }] });
  // An item's files are fetched by every world that draws it, and are the same for ever: each is named by its hash.
  // A script is only ever fetched as text, checked, and handed to the locked box: no page runs it from here.
  if (config.keepsItems === s.name) {
    for (const [ext, type] of [["glb", "model/gltf-binary"], ["js", "text/plain; charset=utf-8"], ["ogg", "audio/ogg"]]) {
      headers.push({
        source: `/items/(.*)\\.${ext}`,
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Content-Type", value: type },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      });
    }
  }
  if (s.world && carries(s)) {
    headers.push({ source: "/item-box\\.html", headers: [...common, { key: "Content-Security-Policy", value: itemBoxCsp(new URL(config.airlock).origin) }, { key: "Cache-Control", value: "no-cache" }] });
  }
  if (s.world) {
    headers.push({
      source: "/previews/(.*)",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    });
    headers.push({
      source: "/.well-known/nswp.json",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Content-Type", value: "application/json; charset=utf-8" },
        { key: "Cache-Control", value: "public, max-age=300" },
      ],
    });
  }
  // A world that has moved sends visitors of its old address on to the new one.
  const was = config.worlds[s.name]?.was;
  const redirects = was ? [{ source: "/(.*)", has: [{ type: "host", value: was }], destination: `${config.worlds[s.name].url}$1`, permanent: false }] : undefined;
  writeFileSync(join(out, "vercel.json"), `${JSON.stringify({ headers, redirects }, null, 2)}\n`);
  // The page is marked with this kit and with everything it is served with, so that it changes whenever either
  // does. A browser keeps a page's old content rules for as long as the page itself is unchanged (core stamp.ts).
  writeFileSync(join(out, "index.html"), stampPage(readFileSync(join(out, "index.html"), "utf8"), KIT_VERSION, headers));
  console.log(`built sites/${s.name}/dist`);
}
