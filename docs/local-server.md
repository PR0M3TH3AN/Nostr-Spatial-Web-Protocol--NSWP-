# Trying sites on your own machine

```bash
npm run build && node scripts/serve-local.mjs
```

Each built site is served on a port of its own: BitPortal on 4300, the
reference worlds on 4301 to 4307, the world template on 4308, and the Godot
example on 4309 if it has been exported (`npm run build:godot`). BitPortal
and the template are served from their own repositories beside this one, if
they are built. Add `--lan` to reach them from another device on the same
network.

## Links lead to the copies served here

A world is built for its real address, and stays that way: what you try is
the same build that gets deployed. But while it is being served from your
machine, the links between sites lead to the copies on your machine:

- A door in the local Gallery leads to the local BitPortal's Airlock.
- That Airlock sends you on to the local Grove.
- The way home from there leads to the local BitPortal.

A site that isn't being served locally still leads to the real one.

Once a site is deployed, every link leads to the real address. Nothing has
to be switched, because nothing in the build was changed.

## How it works

The server publishes a map at `/.well-known/nswp-local.json`, real address to
local copy:

```json
{
  "https://portal.bitblocks.network": "http://localhost:4300",
  "https://gallery.bitblocks.network": "http://localhost:4301"
}
```

A page reads its own server's map, and follows it at one moment only: when it
sends the browser somewhere (`toLocal` in `packages/core/src/local.ts`). The
kit's doors, the way home and BitPortal's Airlock all do.

Three limits keep this from mattering anywhere else:

- **Only a page on a local address asks for a map.** That means plain `http`
  on `localhost`, a loopback address, or a private network address. A
  deployed site is on `https` and never asks.
- **A map can only lead to a local address.** Each entry must go from an
  `https` origin to an `http` origin on a local host. Anything else in the
  map is ignored.
- **Only the last step is changed.** What a door says, what an Airlock checks
  and shows, and what an announcement is signed over are all still the real
  address. The Airlock says so on its card: "Development server: you will be
  taken to the copy at localhost:4302, not to grove.bitblocks.network."

So an Airlock on a development server still checks the real site and its
real announcement. A world that hasn't been deployed yet can't be checked,
and is shown as unverified, as it would be for anyone.

## What a local address can't do

From another device (`--lan`) the address isn't a secure one, so a browser
withholds the microphone and a headset session there. On the machine itself,
`localhost` counts as secure and both work.

A pass that says who you are is made for the place it is shown at, so on a
development server it is made for the local copy.

Going to a world you are building with leave to open terminals on your
computer (BitPortal's "bring") is not changed by any of this. That grant is
for the world's real address and no other.

## Your own server

Any development server can do the same: answer
`/.well-known/nswp-local.json` with a map like the one above. A page built
with the kit, served from that server on a local address, follows it.
