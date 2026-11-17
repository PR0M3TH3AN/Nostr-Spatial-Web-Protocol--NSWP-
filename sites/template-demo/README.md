# The world template's demo

`https://nswp-world-template.vercel.app/` is the
[world template](https://github.com/PR0M3TH3AN/nswp-world-template) deployed
unchanged, as a newcomer would deploy it. This folder keeps what was added to
a fresh copy of the template to make it, so it can be made again:

- `world.json`: the demo's name and address.
- `signed/`: its announcement and home layout, signed with the reference
  publisher key. **Not published to relays.**
- `previews/`: its preview picture.

To redeploy: clone the template, copy these three over the clone's own, then
`npm install`, `npm run check`, and deploy `dist/` to the Vercel project named
in `../vercel-projects.json` under `templateDemo`.

It is not built by `npm run build` here and has no code of its own.
