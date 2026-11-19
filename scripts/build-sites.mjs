// Builds the reference sites into sites/<name>/dist as plain static files.
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { KIT_VERSION } = await import(join(root, "packages/core/dist/index.js"));
const config = JSON.parse(readFileSync(join(root, "sites", "sites.json"), "utf8"));
// Every world in sites.json, and the reference Airlock. Pass names to build only those.
const only = process.argv.slice(2);
const sites = [...Object.keys(config.worlds).map((name) => ({ name, entry: "src/main.ts", world: true })), { name: "airlock", entry: "src/airlock.ts", world: false }].filter(
  (s) => !only.length || only.includes(s.name),
);

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
  worlds: {
    [world.d]: {
      entry: { url: world.url, modes: world.modes },
      entry_points: world.entryPoints,
      capabilities: world.capabilities,
      rooms: { transports: ["mesh"], max_mesh: 8 },
      budgets: { initial_download_mb: 2 },
      airlock: config.airlock,
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
    copySounds(join(root, "packages", "sdk", "sounds"), join(out, "sounds", "kit"));
    if (existsSync(join(dir, "sounds"))) copySounds(join(dir, "sounds"), join(out, "sounds"));
    // Previews this world mirrors by hash: its own, and those of the worlds its portals lead to.
    mkdirSync(join(out, "previews"), { recursive: true });
    for (const f of readdirSync(join(root, "sites", "previews"))) {
      if (/^[0-9a-f]{64}\.webp$/.test(f)) cpSync(join(root, "sites", "previews", f), join(out, "previews", f));
    }
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
    s.world ? "connect-src 'self' wss:" : "connect-src 'self' https: wss:",
    // A world embeds one thing from elsewhere: its visitor's own client's signer, which it can't read
    // (protocol/10-identity.md, "Signing from a world"). Which client that is, is the visitor's choice.
    ...(s.world ? ["frame-src 'self' https:"] : []),
    "base-uri 'none'",
    "form-action 'none'",
    s.world ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
  ].join("; ");
  const headers = [
    {
      source: "/(.*)",
      headers: [
        ...common,
        { key: "Content-Security-Policy", value: csp },
        { key: "Permissions-Policy", value: s.world ? "xr-spatial-tracking=(self), microphone=(self)" : "xr-spatial-tracking=(self), camera=(), microphone=()" },
      ],
    },
  ];
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
  console.log(`built sites/${s.name}/dist`);
}
