# NSWP-08: Lists and finding worlds

**Status:** Lists, following a list, and a shelf of unreviewed worlds are implemented; finding worlds through the people you follow, and search by relays, are proposed · **Kinds:** 30004 (NIP-51 curation set), 37300 · **Schema:** [`list`](../schemas/list.schema.json) · **Vectors:** [`lists`](../vectors/lists.json) · **Code:** [`list.ts`](../packages/core/src/list.ts); BitPortal's [`catalog.ts`](https://github.com/PR0M3TH3AN/bitportal/blob/main/src/shared/catalog.ts)

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

### Reading one

- Check the signature. A list is its curator's word and nobody else's.
- The worlds are the `a` tags whose value is `37300:<pubkey>:<d>`, in order,
  each counted once. A curation set can hold articles and notes too: pass over
  anything that isn't a world, without complaint.
- `title` is the list's name; without one, use its `d`. `description` is
  optional. Read at most 200 worlds, 200 characters of title and 1000 of
  description. A list with no worlds is still a list: it shows nothing.
- Ignore `image`. A list is not a reason to fetch a picture from anywhere.

### Following one

A list's address is its coordinate, `30004:<pubkey>:<d>`, shared as an
`naddr`. A client follows a list by that coordinate, which fixes the key:

- A newer copy replaces the one a client has only if **the same key** signed
  it and its `created_at` is later.
- When relays are silent, the last copy the client saw stands.
- Whose lists a visitor follows is theirs to keep. Following a list tells its
  curator nothing, and a client does not publish it unless the visitor asks.

A client decides which lists a new visitor starts with. The reference client
ships one, signed by its own curator's key and bundled with the page, so the
first screen needs no relay. The visitor can stop showing it.

### Making one

```bash
nswp sign-list my-list.json --key-file ~/.config/nswp/my.key --out my-list.event.json
nswp publish my-list.event.json
```

`my-list.json` is `{ "d", "title", "description", "worlds": [...] }`, where
each world is a coordinate or an `naddr`. Signing prints the `naddr` people
follow the list by. Publishing it again under the same `d` replaces it.

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

## Worlds nobody has listed

An announcement on a relay needs nobody's permission, so a client that reads
relays will find worlds no list names. Showing them is how a new world is seen
at all. It is also where spam arrives. A client that shows them:

- **Keeps them apart and says what they are:** announced, and reviewed by
  nobody the visitor has chosen. They never sit among listed worlds.
- **Waits to be asked.** It may say how many there are. It shows them once the
  visitor asks, and may remember that they did.
- **Holds their pictures** until the visitor asks for each
  ([NSWP-04](04-previews.md)), and still contacts no world's site to list it.
  So none of them can show as verified until its door is opened: that is the
  cost of looking privately, and it is the right way round.
- **Limits what one key can take up:** the reference client shows at most
  three unlisted worlds from one key, newest first, and sixty in all.
- **Drops a second claim on an address the visitor already has a door to.**
  Two announcements for one address can't both be right, and the listed one
  was at least chosen by someone.

## A client that shows only what its host has listed

Whoever hosts a client answers for what it shows. A host who must not show
some worlds (worlds for adults, say) can't lean on what makers say about
their own worlds, because a maker can lie ([NSWP-01](01-worlds.md)). What
works is the other way round: show a world only when someone the host trusts
has listed it.

- **The host's list is an ordinary list:** kind 30004, signed by a key the
  client is built to trust, under a `d` name the client knows. The reference
  client uses `bitportal`. Nothing about the list says it is special; what
  makes it count is whose key signed it.
- **A strict client shows nothing else.** No lists a visitor follows, and no
  worlds nobody has listed. It says so, and says how many worlds it is
  holding back and why.
- **It still drops what it must not show.** A world on the host's list that
  says it is for adults is dropped all the same: a list can be wrong, or a
  world can change after it was listed.
- **It checks at the door as well.** A link can lead to the Airlock without
  passing the lobby, so the Airlock asks the same question before sending
  anyone on. It shows the address either way.
- **The host lists with their own signature.** Signed in with the trusted
  key, they see what is waiting and add or remove a world. Each change is a
  new version of the one list, so the newest is the whole truth.
- **It is one copy's answer.** Announcements stay on relays, and another copy
  of the same client, hosted by someone else, shows what its own host lists.

## Hashtags

A world's `t` tags are its hashtags. A client may let a visitor press one to
see every world that carries it, and ask for more or less of one.

- **What a visitor likes stays on their device** and is sent nowhere. It is
  not published, and no relay is asked a question that gives it away.
- **Ranking by it is said out loud:** a world that sits higher because of a
  hashtag says which one.
- **Less is not gone.** Asking for less of a hashtag moves its worlds down.
  It hides nothing: hiding is what lists and the host's answers are for.
- **A hashtag is the maker's word,** like everything else in an
  announcement. It is a way of finding, and never a reason to trust.

## Searching

`t` tags are a world's topics and `l` tags its languages
([NSWP-01](01-worlds.md)). A client can filter what it already holds by those,
by title, by summary and by address, without asking anyone. The reference
client does that and nothing more.

## Asking to be listed

There is no message for this, and no queue. Announcing a world is the request:
it puts the world where every curator can read it.

```bash
nswp worlds --verify --not-on my-list.event.json
```

prints every world announced on the relays that a list doesn't have yet, newest
first, and whether each one's site vouches for it. A curator who wants to hear
from people says how in the list's `description`.

## What the reference client does today

- As hosted at bitblocks.network, it is strict: it shows its starter list and
  what its operator's key has listed under `bitportal`, and no world for
  adults. A copy hosted with other answers follows the visitor's lists and
  shows unlisted worlds when asked, as below.
- Shows its bundled starter list, which the visitor can hide.
- Follows any list the visitor gives it by `naddr`, each as a shelf of its
  own, named with its curator's key. The lists a visitor follows are kept on
  their device.
- Says how many announced worlds nobody has listed, and shows them when asked,
  under the rules above.
- Filters all of that by a word, a hashtag or a language, and ranks by the
  hashtags a visitor has asked for more or less of.
- Lets a visitor save any door to their own wall, kept on their device.
- Has a page for announcing a world, and says there how a world gets listed.

## Proposed, not built

- **A list of what a host refuses,** beside the list of what it shows. A
  strict client has no use for one. An open one does.
- **Hashtags a visitor likes as a list of their own on Nostr** (NIP-51
  interests), so they follow the visitor between devices. They are private
  today, so publishing them is a decision of its own.

- **Worlds and lists from the people a visitor follows.** It needs names to
  be worth reading ("listed by" a key says little), so it waits for profiles.
- **Making a list in the client,** from a visitor's saved doors. Saved doors
  are private today, so publishing them is a decision of its own.
- **Search by relays** (NIP-50, or a `#t` filter), for worlds a client doesn't
  already hold.
- **Lists of lists,** and a way for a list to say who else is worth following.

Background and reasoning: [`spec.md`](../spec.md) §5.4 to §5.7.
