# An item's files are fetched from any host its maker chose, which can learn who was there

- **Found:** 2026-11-22, by the BitPortal session, writing the own-models
  plan (`docs/plans/own-models.md`, 2.3a), at the orchestrator's question about
  looks. Not asked by the owner: found.
- **Who:** the BitPortal session (the kit: every world, the template, other
  engines). It comes before own models: it is a hole in what is live now.
- **State:** briefed

## What happens today

- An item's description names its files by url and hash (NSWP-17). The url
  may be any https address its maker wrote: `item.ts` cleans it to https with
  no user name or password, and nothing more.
- When someone in a room holds an item, every other visitor's kit fetches its
  model (and its sounds, its script) from that address (`item-store.ts`). The
  fetch sends no cookies, no referrer and follows no redirects, and the bytes
  are kept only if they hash right: so nothing can be carried back or run.
- But the request itself reaches the maker's host. Anyone can make an item
  whose files live on a server of their own, hold it in a room, and learn the
  address of everyone there and when they were there.

## The rule (decided by the orchestrator, 2026-11-22, for looks and items alike)

- Fetch an item's files by hash only from content-addressed file hosts the
  viewer's kit already uses: the hosts their sign-in address keeps their files
  on, and the kit's short default list. The url is a hint, used only when its
  host is on that list.
- Anywhere else only with the viewer's switch ("Load people's files from
  anywhere", off by default). Without it the item is drawn as its marker.
- The starter items (on `grove.bitblocks.network/items/`) move to, or are
  mirrored on, a listed host, so nothing changes for anyone holding them.

## Must not

- Let a holder or maker choose which host a viewer's kit asks.
- Break an item someone already holds: a file on a listed host keeps working.
