// Builds the reference sites into sites/<name>/dist as plain static files.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sites = [
  { name: "world-a", entry: "src/main.ts", world: true },
  { name: "world-b", entry: "src/main.ts", world: true },
  { name: "airlock", entry: "src/airlock.ts", world: false },
];

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
  cpSync(join(dir, "index.html"), join(out, "index.html"));
  if (s.world) {
    mkdirSync(join(out, ".well-known"), { recursive: true });
    cpSync(join(dir, "nswp.json"), join(out, ".well-known", "nswp.json"));
  }
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    // Worlds reach Nostr relays (wss) for the room handshake; the Airlock also fetches manifests (https).
    s.world ? "connect-src 'self' wss:" : "connect-src 'self' https: wss:",
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
      source: "/.well-known/nswp.json",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Content-Type", value: "application/json; charset=utf-8" },
        { key: "Cache-Control", value: "public, max-age=300" },
      ],
    });
  }
  writeFileSync(join(out, "vercel.json"), `${JSON.stringify({ headers }, null, 2)}\n`);
  console.log(`built sites/${s.name}/dist`);
}
