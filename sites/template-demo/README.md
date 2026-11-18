# The world template's demo

`https://nswp-world-template.vercel.app/` is the
[world template](https://github.com/PR0M3TH3AN/nswp-world-template) deployed
unchanged, as a newcomer would deploy it. This folder keeps what was added to
a fresh copy of the template to make it, so it can be made again:

- `world.json`: the demo's name and address.
- `signed/`: its announcement and home layout, signed with the reference
  publisher key. **Not published to relays.**
- `previews/`: its preview picture.

To redeploy after the template changes: clone the template and put this
folder's name and address (`d`, `title`, `url`, `summary`, `description`,
`topics`) into the clone's own `world.json`. Then `npm install`,
`npm run preview`, `npm run sign` with `NSWP_KEY_FILE` pointing at the
reference publisher key, `npm run check`, and deploy `dist/` to the Vercel
project named in `../vercel-projects.json` under `templateDemo`. Copy the
clone's `world.json`, `signed/` and `previews/` back here.

Last made from template commit `fe2a63e`. The scene and its preview picture
didn't change, so `world.json`, `signed/` and `previews/` here are as before.

It is not built by `npm run build` here and has no code of its own.
