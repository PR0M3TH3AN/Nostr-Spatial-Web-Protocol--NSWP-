# Nostr Spatial Web Protocol (NSWP)

An open protocol for linking independently hosted WebXR worlds through Nostr:
signed world announcements, origin verification, portals, and a trusted
handoff page (the **Airlock**) between worlds. **BitPortal**, a reference app
on the [BitBlocks](https://bitblocks.network/) stack, is specified alongside it.

Read [`spec.md`](spec.md) first. Status: concept spec v0.7.3. **Phase 0** (formats,
reference library, test worlds), **Phase 1** (the BitPortal lobby, in the
separate [`bitportal`](https://github.com/PR0M3TH3AN/bitportal) repo) and
**Phase 1b** (previews) are built, along with a first cut of shared rooms and
the start room (your own doors, saved on your device). The world template is in
its own [`nswp-world-template`](https://github.com/PR0M3TH3AN/nswp-world-template)
repo. Items and carried items are design only. Nothing here is an adopted NIP
or standard.

## Try it

Start in the lobby: <https://bitportal.vercel.app/>. Pick a door, and the
Airlock shows where it leads before you go.

Or stand in it: <https://bitportal.vercel.app/walk/> is the room you start in,
with your saved doors on one wall and suggested ones on the other. Add `?xr=emulate` to try the headset view without a headset.

Or go straight to a test world. No headset needed:

1. Open [World A](https://nswp-world-a.vercel.app/?xr=emulate). `?xr=emulate`
   loads the [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime)
   emulator, which pretends to be a Meta Quest 3.
2. Press **Enter VR**, or just click the portal.
3. The [Airlock](https://nswp-airlock.vercel.app/) shows where the portal really
   leads. Continue to arrive in World B, then take its portal back.

With a headset, open the same pages in its browser without `?xr=emulate`
(see spec §21.2 for which browsers support WebXR).

### Share a room (experimental)

Both worlds have a peer-to-peer room: other visitors appear as avatars, and
you can talk.

1. Open [World A](https://nswp-world-a.vercel.app/) and press **Join the room**.
   Joining shows your IP address to the others in the room.
2. Press **Make a private room**. It copies an invite link; send it to someone,
   or open it in a second window to see yourself.
3. Press **Turn microphone on** to talk. Do this before **Enter VR**.

This is the Phase 4b spike: guests only, no accounts, no moderation, and no
fallback for networks that block direct connections (spec §9, §20).

## What's here

| Path | What it is | License |
|---|---|---|
| `spec.md` | The protocol and the BitPortal design | CC0 1.0 |
| `schemas/` | JSON Schemas for world events, manifests, portals, arrival context, entry assertions | CC0 1.0 |
| `vectors/` | Test vectors with expected results, signed with public test-only keys | CC0 1.0 |
| `packages/core` | `@nswp/core`: build, validate and verify everything above | MIT |
| `packages/cli` | `nswp`: check a live world, validate files, sign and publish announcements | MIT |
| `packages/sdk` | `nswp-sdk`: portals, arrival handling and peer-to-peer rooms for world developers. `nswp-sdk/three` adds avatars, spatial voice and previews for Three.js worlds, and `nswp-sdk/home` draws a home layout and the standard portal, an arched doorway | MIT |
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
`sites/announcements/` and are published to public relays; after changing a
`world.json`, re-sign it with `nswp sign-world` and publish it with
`nswp publish`.

### Previews

Each reference world has a preview: a 360° picture taken from where a visitor
arrives, which a portal or a lobby can show before anyone goes there (spec
§5.8). To retake them:

```bash
npm run build && npm run previews && npm run build
```

`npm run previews` opens each built world in headless Chrome (it needs Google
Chrome installed), asks the world to photograph itself, and saves the file
under its SHA-256 in `sites/previews/`. It records the hash in each
`world.json`, so re-sign the announcements afterwards. Each world also serves
the *other* world's preview from its own address, so its portal can show where
it leads without contacting the destination.

In your own world, `capturePanorama()` from `nswp-sdk/three` takes the picture
and `createPortalWindow()` shows one inside a portal.
