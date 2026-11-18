# NSWP-08: Lists and finding worlds

**Status:** Lists are implemented; finding worlds through the people you follow, and search, are proposed · **Kinds:** 30004 (NIP-51 curation set), 37300 · **Code:** BitPortal's [`catalog.ts`](https://github.com/PR0M3TH3AN/bitportal/blob/main/src/shared/catalog.ts)

There is no index of worlds, and nobody to apply to. A world is found because
it announced itself, because someone put it on a list, or because a link to it
was shared.

## Three ways a world is found

1. **It announces itself** ([NSWP-01](01-worlds.md)). The event is on public
   relays for any client to read. This needs nobody's permission.
2. **Someone lists it.** A list is a signed event too, and anyone can publish
   one.
3. **Someone shares it:** an `naddr` or an address in an ordinary note, or a
   door in another world.

## A list

A NIP-51 curation set, kind `30004`. Each `a` tag is a world's coordinate, in
the order the curator wants them shown.

```json
{
  "kind": 30004,
  "tags": [
    ["d", "my-favourites"],
    ["title", "Quiet places"],
    ["description", "Worlds worth sitting down in."],
    ["a", "37300:<pubkey>:grove"],
    ["a", "37300:<pubkey>:observatory"]
  ],
  "content": ""
}
```

A client decides whose lists to show. The reference client ships one, signed
by its own curator's key, bundled with the page so the first screen needs no
relay. It takes a newer copy from relays only if the same key signed it.

## Listing a site that hasn't announced itself

A curator can describe a site that has never heard of this protocol: they sign
a world announcement for it themselves. It can't be verified, since the site
has no manifest naming that key, so a client shows it as **"listed by"** the
curator and never as the site's own word. The site gets a plain visit, with
nothing added to its address ([NSWP-03](03-arrival.md)).

A site that doesn't want this says `"listing": "deny"` in a manifest, and a
compliant client drops other people's listings of it.

## Rules for a client

- **Tell the two apart.** "Verified for this address" and "listed by someone"
  are different claims and are shown differently, everywhere.
- **Check every signature yourself.** A relay's word for an event is worth
  nothing.
- **Looking is private.** A client does not contact a world's own site (its
  manifest, its page, a picture on its server) merely because the world is on
  a list. It does so when the visitor opens that world's door, or reaches the
  Airlock. Pictures come from a mirror, checked by hash
  ([NSWP-04](04-previews.md)).
- **Retired worlds stay readable.** A world whose `status` is `retired` is
  shown as closed, not hidden, so a saved door to it still explains itself.
- **Keep the list of relays visible and editable.** A default list is a
  convenience, not an authority.

## What the reference client does today

- Shows its bundled starter list.
- Has a setting, off by default, to also show any announced world it finds on
  its relays, at most 60.
- Lets a visitor save any door to their own wall, kept on their device.
- Has a page for announcing a world.

## Proposed, not built

- **Following other people's lists,** and worlds announced or recommended by
  the people a visitor follows.
- **A shelf of new worlds** shown without a setting. Showing only verified
  ones is not free: verifying a world means contacting its site, which a
  lobby must not do merely to list it.
- **Search** over topics and languages.
- **A way to ask a curator to list a world.**

Background and reasoning: [`spec.md`](../spec.md) §5.4 to §5.7.
