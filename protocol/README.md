# The Nostr Spatial Web Protocol

A way to link independently hosted 3D and VR places, with nobody in the
middle. A world is a website. A door is a link. Who runs what is said with
signed [Nostr](https://github.com/nostr-protocol/nips) events, so there is no
index to be listed in and no platform to ask.

These are the documents an implementer needs. Each is short, covers one part,
and says plainly what is built and what is only proposed.

## Start here

| You want to | Read | Then |
|---|---|---|
| **Build a world** from scratch | [`nswp-world-template`](https://github.com/PR0M3TH3AN/nswp-world-template): copy it, edit one scene file | [01](01-worlds.md), [09](09-what-a-world-owes.md) |
| **Add a site you already have** (a game, a gallery) | [`docs/add-your-site.md`](../docs/add-your-site.md) | [01](01-worlds.md), [03](03-arrival.md), [09](09-what-a-world-owes.md) |
| **Build a client**: a lobby, a directory, an Airlock | [01](01-worlds.md), [02](02-doors.md), [08](08-lists.md), [04](04-previews.md) | [03](03-arrival.md), [05](05-looks.md) |
| **Join the same rooms** as the reference worlds | [06](06-rooms.md), [05](05-looks.md) | [10](10-identity.md) |
| **Know who a visitor is,** or let them go by name | [10](10-identity.md) | [03](03-arrival.md) |
| **See all of it at once:** what is required, what comes ready-made, what you may replace | [`docs/integrating.md`](../docs/integrating.md) | |
| **Build a game** with an interface of its own | [11](11-the-visitors-console.md) | [09](09-what-a-world-owes.md) |
| **Keep a visitor's progress,** on every device they use | [12](12-saves.md) | [10](10-identity.md) |
| **Show what people thought** of a world, or let them say | [13](13-ratings.md) | [08](08-lists.md) |
| **Let a visitor follow someone,** or write to them privately | [14](14-people-and-messages.md) | [10](10-identity.md) |
| **Draw people** your own way | [05](05-looks.md), "What a world may change" | |
| **Know why** it is built this way | [`spec.md`](../spec.md) | |
| **Build a browser,** or see where a browser could take this | [`browser/spec.md`](../browser/spec.md): a plan, not part of the protocol | [02](02-doors.md), [10](10-identity.md) |

## The documents

| | Covers | Status | Kinds |
|---|---|---|---|
| [01 Worlds](01-worlds.md) | Announcing a world; the site's manifest; what "verified" means | Implemented | 37300 |
| [02 Doors and the Airlock](02-doors.md) | Linking to another place; the page every crossing stops on; going home | Implemented | |
| [03 Arriving](03-arrival.md) | What travels with a visitor; proving who they are | Implemented, in part | 27235 |
| [04 Previews](04-previews.md) | The picture in a doorway | Implemented | |
| [05 Looks](05-looks.md) | How a person appears, the same in every world | Implemented, in part | 37301 |
| [06 Rooms](06-rooms.md) | Seeing and hearing each other | A first version | 27301 |
| [07 Homes](07-homes.md) | A place of your own, described by a signed layout | Implemented, in part | 37302 |
| [08 Lists and finding worlds](08-lists.md) | Lists anyone can publish and follow; worlds nobody has listed | Implemented, in part | 30004 |
| [09 What a world owes a visitor](09-what-a-world-owes.md) | The few things that are the same everywhere | Implemented | |
| [10 Who someone is](10-identity.md) | Going by name without a world ever holding a key: passes, names, the proven mark | Implemented, in part | 27300 |
| [11 The visitor's console](11-the-visitors-console.md) | Their own controls over a world's own interface: hidden when the world wants, summoned whenever they want; arriving in the form they left in; and the settings that go with them | Implemented, in part | |
| [12 Saves](12-saves.md) | What a world keeps for its visitor: on their own relays, readable only by them, reachable only by the world it belongs to | Implemented; a signer's side is not built in BitLogin yet | 37304 |
| [13 Ratings](13-ratings.md) | What a visitor thought of a world, and whose ratings a client counts: never a crowd of strangers | Implemented, in part | 37305 |
| [14 People and messages](14-people-and-messages.md) | Following someone and writing to them privately: Nostr's own, done only at the visitor's own client, and a follow list changed without losing it | Implemented in the library; not in BitPortal yet | |

## What "status" means

- **Implemented**: built in the reference library, tested, and used by the
  live sites. It can still change: nothing here is frozen.
- **Implemented, in part**: the document says which parts.
- **A first version**: works, and is expected to be replaced.
- **Proposed**: written down, not built. Listed at the end of each document.

Every event kind here is experimental. None is allocated by the Nostr NIPs
process. Code refers to them by name so they can change.

## How to check your work

| What | Where |
|---|---|
| The shape of each format | [`schemas/`](../schemas): JSON Schema. Structural only: they never reject something a full reader accepts |
| What a reader must make of each input | [`vectors/`](../vectors): inputs with the exact result, including the errors and warnings |
| A world that is live | `nswp check <address>` |
| A file | `nswp validate <file>` |

If your implementation agrees with the vectors, it agrees with ours.

## The reference implementation

| | What it is |
|---|---|
| [`packages/core`](../packages/core) | `@nswp/core`: reads, writes and checks every format here. No browser needed |
| [`packages/sdk`](../packages/sdk) | `nswp-sdk`: what a world uses. Arriving, doors, rooms, figures, the controls every world owes |
| [`packages/cli`](../packages/cli) | `nswp`: keys, signing, publishing, checking |
| [`sites/`](../sites) | Seven worlds, as worked examples |
| [BitPortal](https://github.com/PR0M3TH3AN/bitportal) | A client: a lobby, a room of doors, an Airlock. Live at <https://portal.bitblocks.network/> |

The packages are not on a package registry yet. Until they are, copy
`vendor/nswp/` from the world template.

None of this is needed to take part. The protocol is the documents and the
events; the reference code is one way to follow them.

## Changing the protocol

A change to a format touches four things together, or it isn't done: its
document here, its schema, its vectors, and `@nswp/core`. `npm test` and
`npm run vectors:check` say whether they still agree.

Open questions are numbered in [`spec.md`](../spec.md) §24. What changed in
each version is in [`CHANGELOG.md`](../CHANGELOG.md).

## Licence

These documents, the schemas and the vectors are CC0 1.0: the protocol belongs
to everyone. The code is MIT.
