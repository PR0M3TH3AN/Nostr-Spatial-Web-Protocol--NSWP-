# NSWP-01: Worlds

**Status:** Implemented · **Kinds:** 37300 · **Schemas:** [`world-event`](../schemas/world-event.schema.json), [`manifest`](../schemas/manifest.schema.json) · **Vectors:** [`world-events`](../vectors/world-events.json), [`manifests`](../vectors/manifests.json) · **Code:** [`world.ts`](../packages/core/src/world.ts), [`manifest.ts`](../packages/core/src/manifest.ts)

A world is a website. It says it exists with a signed Nostr event, and its
site says which key may speak for it. When the two agree, the world is
**verified for its origin**. Nothing else is needed to be a world.

## The announcement

An addressable event of kind `37300`. Its coordinate, `37300:<pubkey>:<d>`, is
how everything else refers to the world.

```json
{
  "kind": 37300,
  "tags": [
    ["d", "example-museum"],
    ["title", "Example Virtual Museum"],
    ["summary", "An immersive art gallery with three wings."],
    ["r", "https://museum.example/world"],
    ["preview", "https://blossom.example/<sha256>.webp", "pano", "<sha256>", "4096x2048"],
    ["mode", "immersive-vr"],
    ["mode", "inline-3d"],
    ["capability", "webxr"],
    ["comfort", "locomotion", "teleport"],
    ["comfort", "intensity", "low"],
    ["input", "controllers"],
    ["perf", "standalone"],
    ["t", "museum"],
    ["L", "ISO-639-1"],
    ["l", "en", "ISO-639-1"],
    ["status", "live"],
    ["alt", "Spatial world listing: Example Virtual Museum"]
  ],
  "content": "Walk through three wings of rotating exhibitions…"
}
```

| Tag | Required | What it is |
|---|---|---|
| `d` | yes | The world's name under this key. Changing it makes a different world |
| `title` | yes | Display name |
| `r` | yes | Where a visitor lands. `https` only |
| `alt` | yes | Fallback text for clients that don't know the kind (NIP-31) |
| `summary` | | One line |
| `image` | | A small card image, with optional dimensions |
| `preview` | yes | The view through a door, which a world must have: a 360° `pano`, or a `flat` for a place that is only a web page. A reader draws a placeholder for a world that has none. See [NSWP-04](04-previews.md) |
| `mode` | | `2d`, `inline-3d`, `immersive-vr`, `immersive-ar`. Repeat in order of preference |
| `capability` | | `webxr`, `rooms`, `multiplayer`, `voice`, `spatial-portals`, `avatars`, `entry-assertion`, `payments`, `home`, `saves`, `scores`, `achievements`, `tips`. What a world does with the things visitors carry is not one of these: it is the `items` tag |
| `comfort` | | `locomotion`: `stationary`, `teleport`, `smooth`, `vehicle`. `intensity`: `low`, `medium`, `high`. `seated`: `supported`, `required`, `unsupported` |
| `input` | | `controllers`, `hands`, `gaze`, `keyboard-mouse`, `touch`, `gamepad` |
| `perf` | | The weakest device it targets: `mobile`, `standalone`, `desktop` |
| `t` | | Topics |
| `L`, `l` | | Language and other NIP-32 labels |
| `content-warning` | | NIP-36, with a reason |
| `audience` | | Who it is for, as its maker says: `kids`, `general` or `adult` |
| `category` | | What kind of place it is, as its maker says: `game`, `experience`, `social`, `app` or `site`. One. See below |
| `items` | | What it does with the things visitors carry: `none`, `allowed` or `play`. Left out, it is `allowed`: a world has items unless it says `none`. [NSWP-17](17-items.md) |
| `status` | | `live`, `beta`, `maintenance`, `retired` |
| `p` | | Co-creators |
| `a` | | Linked things. One marked `access` (`["a", "30078:<pubkey>:<name>", "", "access"]`) is a listing a paid world is entered by: see "A paid world" |

`content` is a description in plain text or Markdown. Clients never parse data
out of it. Capability, comfort and performance tags are claims, not
permissions.

A newer event with the same coordinate replaces the older one. To close a
world, publish it with `status` `retired`.

### What a world offers

A client has a world's announcement before anyone looks at its door, so a
door can say what its world offers without a site being asked anything.
Thirteen things, read by one function (`worldOffers` in `@nswp/core`), each
from what the announcement says in so many words:

| A door shows | It is said by |
|---|---|
| It works in a headset | `mode` `immersive-vr` |
| Other people can be met there | `capability` `rooms` or `multiplayer` |
| People can talk there | `capability` `voice` |
| The things visitors carry work there | `items` `allowed` or `play` |
| A visitor's progress is kept ([NSWP-12](12-saves.md)) | `capability` `saves` |
| It keeps scores, or marks what a visitor achieves ([NSWP-15](15-scores.md), [NSWP-16](16-achievements.md)) | `capability` `scores`, `achievements` |
| Only people its owner invited may go in | `by-invitation` (see "A world by invitation") |
| It costs money to go in | an `a` tag marked `access`, naming what is sold |

| A door's details add | It is said by |
|---|---|
| It takes tips | `capability` `tips` |
| It has doors onward | `capability` `spatial-portals` |
| People appear as they chose to look ([NSWP-05](05-looks.md)) | `capability` `avatars` |
| A visitor can go by name ([NSWP-10](10-identity.md)) | `capability` `entry-assertion` |
| It can be a home ([NSWP-07](07-homes.md)) | `capability` `home` |

**Only what is said is shown as offered.** Nothing is lit by a default, by a
guess from something else the world said, or because most worlds have it. A
world that leaves out `items` does allow them ([NSWP-17](17-items.md)), and
its door still doesn't say so. Saying it takes `payments` is not saying it
costs money to go in. So a line that isn't lit never means "this world
doesn't": it means "this world doesn't say", and a reader's words must say
that and no more. They are claims, like every capability: a world's own
word, checked by nobody.

### What kind of place it is

`category` is the maker's own word for what kind of place a world is: one
value from a short closed list, so that a door, a list and the Airlock all
say it the same way.

| Value | Means | Said as |
|---|---|---|
| `game` | There is something to win, beat or finish | A game |
| `experience` | A place to walk through and look at | An experience |
| `social` | Made for meeting other people | A place to meet |
| `app` | A tool that does a job | An app |
| `site` | Mostly words and pictures to read | A site |

- **One, or none.** A world that fits two picks the one a visitor would
  expect at the door; topics (`t`) say the rest. A value that isn't on the
  list is treated as not stated.
- **It is a claim,** like everything a world says of itself. A list's
  curator may say otherwise in their own list, and a client may show theirs.
- **A door says it under the name:** "A game at example.com". A door is told
  by whoever placed it, from the destination's announcement; it never asks
  the destination while a visitor stands there.

### Who it is for

`audience` is the maker's own word about who a world is for.

| Value | Means |
|---|---|
| `kids` | Made for children |
| `general` | Not made for children, and nothing an adult would need warning about |
| `adult` | Not for anyone under age: what some call NSFW. It also carries `content-warning`, which clients that don't know `audience` already read |

A reader that wants to be careful takes a world as `adult` when it says so,
and also when it carries `content-warning` and no `audience`: a warning with
no audience is not a promise that the world suits everyone. A world that
says nothing is unrated, and what to do with those is the reader's choice.

This keeps honest makers' worlds where they belong. It does nothing about a
maker who lies, which is what lists are for ([NSWP-08](08-lists.md)): a
client that must not show adult worlds shows only worlds someone it trusts
has listed, and drops from those any that say they are adult.

`t` tags are hashtags: lowercase, without the `#`. A client may let a
visitor find worlds by them, and rank by the ones the visitor likes.

### A world by invitation

`["by-invitation"]`, one tag with nothing after it, says only people its
owner invited may go in. Anything after it is ignored with a warning, and
the tag still says it. A door shows it as the eighth thing it carries,
beside "Paid" at the foot: what it takes to get in. It is there so a client
can say so before anyone crosses, with nothing asked of the world. What the
world acts on is its own site's word, `by_invitation` in its manifest
("The manifest", below), and who is invited is its owner's allow list
([NSWP-10](10-identity.md), "A world's own lists").

### A paid world

A world that is paid says so by naming what it is entered by: one `a` tag
marked `access` for each listing, a day pass and a season pass, say.

```json
["a", "30078:<the world's own key>:<the listing's name>", "", "access"]
```

- **A world that names none is free,** exactly as every world was before
  this. There is no other word for paid: naming a listing is the whole of
  it.
- **A listing is the seller's own signed note** (kind `30078`), read from
  relays, saying what it costs and how long it lasts
  ([NSWP-10](10-identity.md), "A listing"). The announcement holds only its
  coordinate, so a price is never copied into two places.
- **Nobody prices a world that isn't theirs.** A listing counts only if its
  coordinate carries the key that signed the announcement. Any other is
  left out with a warning (`access_not_own`), and so is anything that isn't
  a listing's coordinate. A world left with none is free: a paid door is
  never read out of a tag that doesn't hold up.
- **Eight at most,** each once.
- **It is there so a client can tell before anyone crosses:** a door or an
  Airlock can say a world is paid, and for how much, from the announcement
  and the listing, with nothing asked of the world.
- **What paid means inside the world is the world's.** It may let anyone
  into part of itself first. What it opens, and on what proof, is
  [NSWP-10](10-identity.md), "The front room".

## The manifest

A JSON file at exactly `https://<origin>/.well-known/nswp.json`.

```json
{
  "schema": "nswp/manifest/0.3",
  "listing": "allow",
  "publishers": { "<hex pubkey>": { "worlds": ["example-museum"] } },
  "worlds": {
    "example-museum": {
      "entry": { "url": "https://museum.example/world", "modes": ["immersive-vr", "inline-3d"] },
      "entry_points": ["main-entrance", "north-wing"],
      "capabilities": ["webxr", "spatial-portals", "rooms"],
      "airlock": "https://portal.bitblocks.network/go/"
    }
  },
  "relays": ["wss://relay.example"],
  "kit": "0.21.0"
}
```

`tip`, where a world has one, is a lightning address (`name@host`) that
tips to the world go to. It is left out of the example because most
worlds have none. A visitor's sign-in address reads it from this file, at
the world's own address, and from nowhere else: the world never passes it
along when it asks ([NSWP-10](10-identity.md), "Tips, buying, and
receipts"). The file is readable from any site, as it already must be.

`keepers`, `named_only` and `by_invitation`, inside a world's own entry, are the world's
own rules for who comes in ([NSWP-10](10-identity.md), "A world's own
lists"):

- `keepers`: whose lists count for this world, a list of one to four keys
  (64 lowercase hex). Anything else in it is left out with a warning, and
  more than four are ignored. A world that names no keepers keeps no
  lists, and none is read for it.
- `named_only`: `true` says this world's rooms show only people whose pass
  checks out ([NSWP-06](06-rooms.md), "A world's own rules"). Only exactly
  `true` turns it on; any other value is ignored with a warning.
- `by_invitation`: `true` says only people a keeper's allow list names, and
  the keepers, may go in, and its rooms show only them. With no `keepers`,
  the key that announced the world keeps its lists. Only exactly `true`
  turns it on; any other value is ignored with a warning.

All three are left out of the example above because most worlds say neither.

`access`, inside a world's own entry, is the same list of listings the
announcement gives, as the site itself says it: an array of coordinates.

```json
"worlds": { "example-museum": { "entry": { "url": "https://museum.example/world" }, "access": ["30078:<pubkey>:<name>"] } }
```

It is left out of the example above because most worlds are free. A
listing counts only if its seller is a key this file names as a publisher
of that world; others are left out with a warning. The world's own page
reads it here to know what it is entered by, and a visitor's sign-in
address reads the publishers here to know which listings are that world's
to ask about ([NSWP-10](10-identity.md)). Where the announcement and this
file differ, this file is what the world acts on, as for everything that
runs: an announcement can be out of date, and the site can't.

`capabilities` are what the world says it can do. A client that doesn't know
one ignores it. `home` says it can be the place its owner starts
([NSWP-07](07-homes.md)).

Serving rules:

- `Access-Control-Allow-Origin: *`, or a browser-based client can't read it.
- `https`, `application/json`, at most 64 KB.
- A client fetching it does not follow redirects.

`listing` is `allow` (the default) or `deny`. With `deny`, a compliant client
does not show other people's listings of this origin. A direct link still
works.

`airlock` is where the world sends visitors who arrived without a return
address ([NSWP-02](02-doors.md)). `relays` hints where the world's events live.

### Which kit a world was built with

`kit` is the version of the kit the site was built with: three numbers, as
in `"0.21.0"`. It is optional, and it is the site's own word.

A world carries its own copy of the kit: the console, how a visitor moves,
the sounds, the crossing's room. Nothing loads it from anywhere else as the
world runs, so no outside party can change what runs in a world, and a world
goes on working whatever happens to anyone else's servers. The cost is that
a world's copy grows old. `kit` is how that is seen:

- **A client may tell the visitor** that a world's controls are older than
  the ones it knows. That is all it may do with it. It is never a warning,
  never changes whether a door opens or a site is verified, and never stops
  a crossing: a world that is behind is not a world that is broken.
- **Old worlds stay open.** A reader keeps what it knows and ignores the
  rest ([NSWP-03](03-arrival.md), [NSWP-11](11-the-visitors-console.md)).
  A newer setting or flag an old world doesn't know passes it by.
- **What must always be current is not in a world at all.** Signing in, a
  visitor's look, the Airlock, their lists and their settings between
  devices are their client's ([NSWP-10](10-identity.md),
  [NSWP-05](05-looks.md)). A world gets the newest of those the day the
  client does.
- **A world's owner is told, and updating is one step.** `nswp check` says
  which kit a site says it has beside the tool's own. The template has
  `npm run update`, and a scheduled job that opens a pull request when a
  newer kit is out, for the owner to read and merge
  ([keeping-up.md](../docs/keeping-up.md)).

A script that every world loads live from one address would keep every world
current with no step at all. It is not how this works, on purpose: whoever
controlled that address would control every world at once, each world's
owner would have no say in what ran on their own site, and one outage would
take every world's controls with it. A world must never need anyone else's
server to be a world.

## Verified

An announcement is verified for its origin only when all four hold:

1. The manifest came from the origin of the event's `r` address, under the
   serving rules above.
2. The event's `pubkey` is a key under `publishers`.
3. The event's `d` is in that publisher's `worlds`.
4. The event's `r` equals that world's `entry.url`.

Then:

- **Who wins a disagreement.** The manifest wins on what actually runs (entry
  address, entry points). The signed announcement wins on description (title,
  summary, topics, pictures).
- **A client remembers the verified key per origin** and tells the visitor if
  it has changed. A lapsed domain bought by someone else looks exactly like
  this.
- **Verification covers a whole origin.** A site on a path of a shared domain
  can't serve its own manifest and can't be verified.
- **A manifest is optional.** A world without one can be listed, never
  verified. An unverified announcement is shown as "listed by", never "by".

Verified means: whoever controls this origin today vouches for this key. It
does not mean safe, honest or well made.

## Doing it

```bash
nswp keygen <key-file>
nswp sign-world world.json --key-file <key-file> --out announcement.json
nswp publish announcement.json --relays wss://…
nswp check https://museum.example/
```

[`docs/add-your-site.md`](../docs/add-your-site.md) walks through it.

## Not decided

Kind 37300 is experimental and not allocated by the NIPs process. Verification
by a third party, published as labels, is an open question (Q13). Background
and reasoning: [`spec.md`](../spec.md) §5.1 to §5.3, §7.
