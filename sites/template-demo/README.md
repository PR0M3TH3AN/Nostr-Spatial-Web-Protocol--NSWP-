# The Starter Home

`https://starter.bitblocks.network/` is the
[world template](https://github.com/PR0M3TH3AN/nswp-world-template) deployed
unchanged, as a newcomer would deploy it. This folder keeps what was added to
a fresh copy of the template to make it, so it can be made again:

- `world.json`: the demo's name and address.
- `signed/`: its announcement and home layout, signed with the reference
  publisher key. The announcement is published to relays.
- `previews/`: its preview picture.

To redeploy after the template changes: clone the template and put this
folder's name and address (`d`, `title`, `url`, `summary`, `description`,
`topics`) into the clone's own `world.json`. Then `npm install`,
`npm run preview`, `npm run sign` with `NSWP_KEY_FILE` pointing at the
reference publisher key, `npm run check`, and deploy `dist/` to the Vercel
project named in `../vercel-projects.json` under `templateDemo`. Copy the
clone's `world.json`, `signed/` and `previews/` back here.

Last made from template commit `a2d1457` (built with the signatures and preview below, not signed again), as The Starter Home (`d` is
`starter`), with a new preview picture and signatures. Its preview is also
mirrored into `sites/previews/` by `node scripts/capture-previews.mjs
--elsewhere-only`, so the Workshop's door can show it.

On 2026-11-20 its announcement alone was signed again, to add `category:
experience` (kit 0.36.0), from a clone of the template at `528135a`; the
layout's signature is the one from before. That announcement has not been
published to relays yet: publishing is the owner's to approve.

On 2026-11-18 its announcement alone was signed again, to add `audience:
general` (NSWP-01): nothing else in it changed, and the site was not built or
deployed again. So `signed/world.event.json` here is newer than the copy the
live site was built with; the relays hold the newer one.

To deploy it again without signing again (so its preview and identity stay
as published): clone the template at that commit, copy this folder's
`world.json`, `signed/` and `previews/` into the clone, run `npm run build`,
and deploy `dist/`. Its announcement is published.

On 2026-11-19 it was deployed again from template commit `5c7e9b9` (kit
0.30.1), by that second way: this folder's `world.json`, `signed/` and
`previews/` in a fresh clone, `npm run check`, and `dist/` deployed. Nothing
was signed again.

It is not built by `npm run build` here and has no code of its own.
