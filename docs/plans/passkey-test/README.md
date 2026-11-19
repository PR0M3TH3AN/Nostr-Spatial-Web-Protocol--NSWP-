# The passkey test pages

Two small pages that answer one question: can a component served by one site
(the client), embedded in another site (a world), ask the browser for a
passkey and get the same secret it gets on its own page?

What to press, and what success looks like, is in
[the plan](../in-game-identity.md), Part 1.

They use the browser's passkey feature directly. They do not use BitLogin,
they sign in to nothing, and they send nothing anywhere.

| Folder | Stands in for | Live at |
|---|---|---|
| [`client/`](client/index.html) | BitPortal, the visitor's client | https://nswp-passkey-client.vercel.app |
| [`world/`](world/index.html) | Any world, on another domain | https://nswp-passkey-world.vercel.app |

The two must be on **different sites**, or the test proves nothing: two
subdomains of the same domain count as one site. Two `vercel.app` addresses
are different sites.

## Putting them up again

Each folder is a static site with no build.

1. Deploy `client/` somewhere on `https`.
2. Put that address in `world/config.js`.
3. Deploy `world/` somewhere else on `https`.

Deploying is outward-facing: the repository's owner approves it, and it
counts against the day's deployments.

## Trying them on one machine

A browser treats `localhost` and `127.0.0.1` as two different sites, and
both as secure, so the pages can be served from this folder on two ports:
`client/` at `http://localhost:4390` and `world/` at
`http://127.0.0.1:4391`, with `world/config.js` saying
`window.PASSKEY_CLIENT = "http://localhost:4390";`. Chrome and Firefox both
have a simulated passkey device for testing without a real one.
