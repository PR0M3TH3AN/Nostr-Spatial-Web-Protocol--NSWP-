# Nostr Spatial Web Protocol (NSWP)

An open protocol for linking independently hosted 3D and VR worlds through
Nostr. A world is a website, a door is a link, and who runs what is said with
signed events, so there is no index to be listed in and no platform to ask.

**Building something? Start at [`protocol/`](protocol/README.md):** eleven short
documents, one per part of the protocol, each saying what is built and what is
only proposed.

| You want to | Go to |
|---|---|
| Build a world | [`nswp-world-template`](https://github.com/PR0M3TH3AN/nswp-world-template) |
| Add a site you already have | [`docs/add-your-site.md`](docs/add-your-site.md) |
| Build a client, or join the same rooms | [`protocol/`](protocol/README.md) |
| See it running | <https://portal.bitblocks.network/> |
| Know why it is built this way | [`spec.md`](spec.md), and [`CHANGELOG.md`](CHANGELOG.md) for what changed |

**BitPortal**, the reference client, is in its own
[`bitportal`](https://github.com/PR0M3TH3AN/bitportal) repo and built on the
[BitBlocks](https://bitblocks.network/) stack. The protocol does not depend on
either.

Status: spec v0.34.0, an exploratory draft. Worlds, doors, the Airlock,
previews, looks, lists, a first version of rooms, going by name in a room,
hands in a headset, and home layouts are built and live. Published items, hosted rooms, and finding worlds
through the people you follow are design only. Nothing here is an adopted NIP or standard, and every
event kind is experimental.

## Try it

Start in the lobby: <https://portal.bitblocks.network/>. Pick a door, and the
Airlock shows where it leads before you go.

Or stand in it: <https://portal.bitblocks.network/walk/> is the room you start in,
with your saved doors on one wall and suggested ones on the other. Add `?xr=emulate` to try the headset view without a headset.

Or go straight to a world. No headset needed:

1. Open [the Gallery](https://gallery.bitblocks.network/?xr=emulate). `?xr=emulate`
   loads the [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime)
   emulator, which pretends to be a Meta Quest 3.
2. Press **Enter VR**, or just click a doorway.
3. The [Airlock](https://portal.bitblocks.network/go/) shows where the door really
   leads. Continue to arrive in the Grove, then take its door back.

With a headset, open the same pages in its browser without `?xr=emulate`
(see spec §21.2 for which browsers support WebXR). In VR, raise your left wrist
in front of you, or look low and ahead for the **Menu** button: either opens
the console, with the way back, Turn around, and the room's controls. Nothing has been tried on a real headset yet;
[`docs/headset-checklist.md`](docs/headset-checklist.md) is what to try.

### Share a room (experimental)

Every world has a peer-to-peer room: other visitors appear as avatars, and
you can talk.

1. Open [the Grove](https://grove.bitblocks.network/) and press **Join the room**.
   Joining shows your IP address to the others in the room.
2. Press **Make a private room**. It copies an invite link; send it to someone,
   or open it in a second window to see yourself.
3. Press **Turn microphone on** to talk. Do this before **Enter VR**.

This is the Phase 4b spike. A visitor is a guest, or known by name once they
sign in at a world, in a window at their own sign-in address. A world has no
accounts of its own. There is no moderation beyond each visitor's own mutes
and blocks, and no fallback for networks that block direct connections
(spec §9, §20).

## What's here

| Path | What it is | License |
|---|---|---|
| `protocol/` | The protocol, as eleven short documents an implementer reads | CC0 1.0 |
| `spec.md` | The full design: reasoning, the reference app, the roadmap, open questions | CC0 1.0 |
| `browser/spec.md` | A plan, built in stages: [a browser of the visitor's own](browser/spec.md), for what a website isn't allowed to do. Crossings with no flat pages, an Airlock inside the headset, web pages and programs on panels | CC0 1.0 |
| `browser/bridge.md`, `packages/bridge` | [The Bridge](browser/bridge.md): a small program on your own computer that answers your key, so you can open a terminal on it from a panel in your home. What it trusts is the first thing in that document | CC0 1.0, MIT |
| `schemas/` | JSON Schemas for world events, manifests, portals, arrival context, entry assertions | CC0 1.0 |
| `vectors/` | Test vectors with expected results, signed with public test-only keys | CC0 1.0 |
| `packages/core` | `@nswp/core`: build, validate and verify everything above | MIT |
| `packages/cli` | `nswp`: check a live world, validate files, sign and publish announcements | MIT |
| `packages/sdk` | `nswp-sdk`: portals, arrival handling and peer-to-peer rooms for world developers. `nswp-sdk/ui` is the controls kit: one list of what a visitor can do, drawn as a HUD on a flat screen ([`docs/controls-kit.md`](docs/controls-kit.md)). `nswp-sdk/three` adds avatars, spatial voice, previews and the same controls as a console in a headset for Three.js worlds, and `nswp-sdk/home` draws a home layout and the standard portal (an arched doorway), and holds the sky, the ground and the modelling kit the reference places are made with ([`docs/grid-look.md`](docs/grid-look.md)) | MIT |
| `sites/` | Seven worlds and the reference Airlock | MIT |

The CC0 1.0 text is in [`LICENSE-CC0`](LICENSE-CC0): the protocol is given to
the public domain, so anyone may implement it without asking. Everything else
is under the MIT [`LICENSE`](LICENSE). What the built files contain from other
projects is listed in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

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
npm run build            # core, CLI, and every site (sites/*/dist)
```

Check any world from the command line:

```bash
npm run -s nswp -- check https://gallery.bitblocks.network/
```

### Adding a site you already have

[`docs/add-your-site.md`](docs/add-your-site.md) is the short path for an
existing website: be listed, announce yourself so the door shows as verified,
and welcome travellers with a way back. It needs no VR mode.

### Validating your own implementation

`vectors/*.json` lists inputs with the exact issue codes a validator should
report. The schemas are structural only and never reject something a full
validator accepts; the vectors cover the rest (signatures, origin rules,
expiry, replay).

### The worlds

Seven worlds are built here, each for a reason, and each at its own address
under `bitblocks.network`. They are the first doors in BitPortal's room.

| World | What it is for |
|---|---|
| [The Tour](https://tour.bitblocks.network/) | Five stops that teach looking, moving, doors and the way home |
| [The Gallery](https://gallery.bitblocks.network/) | Six sculptures made in code |
| [The Grove](https://grove.bitblocks.network/) | Somewhere to sit and talk |
| [The Arcade](https://arcade.bitblocks.network/) | A small game: catch twelve lanterns against a clock |
| [The Observatory](https://observatory.bitblocks.network/) | A terrace for looking at the sky |
| [The Workshop](https://workshop.bitblocks.network/) | Every part the worlds are built from, with its name |
| [The Library](https://library.bitblocks.network/) | Eight notes on why it is built this way |

An eighth, [the Starter Home](https://starter.bitblocks.network/), is the world
template deployed unchanged (`sites/template-demo/`).

Each is one file, `sites/<name>/src/main.ts`, on the shared code in
`sites/shared/world.ts`: arriving, doors, stepping, the controls, the room and
the preview picture. `sites/sites.json` names them and their addresses; a
world's page and manifest are generated from its `world.json` when it is built.

### Building a world, or fitting an existing one

[docs/integrating.md](docs/integrating.md) is the whole of it on one page:
the short list every world keeps, what the kit gives you by default (the
menu, the sounds, the doorway, how people move and look) and how to replace
each with your own.

### Trying the sites on your own machine

```bash
npm run build && node scripts/serve-local.mjs --lan --https
```

Each built site is served at one `https` address: this machine's address on
the network, on a port of its own from 4300 up (BitPortal and the world
template too, from their repositories beside this one, if they are built).
It is the same address from this machine and from a phone or a headset on
the same network. Links between the sites lead to the copies served there,
and to the real addresses once deployed, with nothing to switch:
[docs/local-server.md](docs/local-server.md).

### Deploying the sites

The ten public sites (the seven worlds, the Starter Home, The Foundry and
BitPortal) are deployed together, from this repo, so that none is left on an
older kit. The worlds deploy to Vercel projects listed in
`sites/vercel-projects.json` (IDs, not secrets):

```bash
npm run release:all            # a look: what would be deployed. Changes nothing
```

```bash
npm run release:all -- --go    # deploys all ten
```

It needs this repo, BitPortal and the world template side by side, each on
main and clean, and Godot 4 with its web export templates, which exports The
Foundry. `npm run kits` shows which kit each public site is on.

The worlds' publisher key lives outside the repo, at
`~/.config/nswp/reference-publisher.key`. Signed announcements are in
`sites/announcements/` and are published to public relays; after changing a
`world.json`, re-sign it with `nswp sign-world` and publish it with
`nswp publish`. (On 2026-11-21 all nine were signed again from their
`world.json`, with what each world offers, and published to the four relays
in `sites/sites.json` on the owner's word.)

### Previews

Each reference world has a preview: a 360° picture taken from where a visitor
arrives, which a portal or a lobby can show before anyone goes there (spec
§5.8). A world must have one, and a reference world won't build without it.
To retake them all:

```bash
npm run build && npm run previews && npm run build
```

Retaking a picture changes its hash, so that world's announcement has to be
signed and published again. To take one world's and leave the rest as they
are (The Foundry's is taken from the Godot export, so `npm run build:godot`
first; a new world with no picture yet builds with `-- --before-pictures`):

```bash
npm run previews -- --only foundry
```

`npm run previews` opens each built world in headless Chrome (it needs Google
Chrome installed), asks the world to photograph itself, and saves the file
under its SHA-256 in `sites/previews/`. It records the hash in each
`world.json`, so re-sign the announcements afterwards. Each world also serves
the *other* world's preview from its own address, so its portal can show where
it leads without contacting the destination.

In your own world, `capturePanorama()` from `nswp-sdk/three` takes the picture
and `createPortalWindow()` shows one inside a portal.
