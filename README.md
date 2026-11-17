# Nostr Spatial Web Protocol (NSWP)

An open protocol for linking independently hosted WebXR worlds through Nostr:
signed world announcements, origin verification, portals, and a trusted
handoff page (the **Airlock**) between worlds. **BitPortal**, a reference app
on the [BitBlocks](https://bitblocks.network/) stack, is specified alongside it.

Read [`spec.md`](spec.md) first. Status: concept spec v0.3.1, with **Phase 0
built** (formats, reference library, test worlds). Nothing here is an adopted
NIP or standard.

## Try it

No headset needed:

1. Open [World A](https://nswp-world-a.vercel.app/?xr=emulate). `?xr=emulate`
   loads the [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime)
   emulator, which pretends to be a Meta Quest 3.
2. Press **Enter VR**, or just click the portal.
3. The [Airlock](https://nswp-airlock.vercel.app/) shows where the portal really
   leads. Continue to arrive in World B, then take its portal back.

With a headset, open the same pages in its browser without `?xr=emulate`
(see spec §21.2 for which browsers support WebXR).

## What's here

| Path | What it is | License |
|---|---|---|
| `spec.md` | The protocol and the BitPortal design | CC0 1.0 |
| `schemas/` | JSON Schemas for world events, manifests, portals, arrival context, entry assertions | CC0 1.0 |
| `vectors/` | Test vectors with expected results, signed with public test-only keys | CC0 1.0 |
| `packages/core` | `@nswp/core`: build, validate and verify everything above | MIT |
| `packages/cli` | `nswp`: check a live world, validate files, sign and publish announcements | MIT |
| `packages/sdk` | `nswp-sdk`: portals and arrival handling for world developers | MIT |
| `sites/` | Two reference worlds and the reference Airlock | MIT |

CC0 1.0: <https://creativecommons.org/publicdomain/zero/1.0/>. Everything else is
under the MIT [`LICENSE`](LICENSE).

## Develop

Requires Node 22+.

```bash
npm install
```

```bash
npm test                 # unit tests + schema/vector agreement
```

```bash
npm run vectors:check    # vectors/ is current and @nswp/core agrees with every expectation
```

```bash
npm run typecheck
```

```bash
npm run build            # core, CLI, and the three sites (sites/*/dist)
```

Check any world from the command line:

```bash
npm run -s nswp -- check https://nswp-world-a.vercel.app/
```

### Validating your own implementation

`vectors/*.json` lists inputs with the exact issue codes a validator should
report. The schemas are structural only and never reject something a full
validator accepts; the vectors cover the rest (signatures, origin rules,
expiry, replay).

### Deploying the reference sites

The three sites deploy to Vercel projects listed in
`sites/vercel-projects.json` (IDs, not secrets):

```bash
npm run build && npm run deploy:sites
```

The reference worlds' publisher key lives outside the repo, at
`~/.config/nswp/reference-publisher.key`. Signed announcements are in
`sites/announcements/`.
