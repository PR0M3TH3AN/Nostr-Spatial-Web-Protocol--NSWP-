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
| `preview` | | The view through a door: see [NSWP-04](04-previews.md) |
| `mode` | | `2d`, `inline-3d`, `immersive-vr`, `immersive-ar`. Repeat in order of preference |
| `capability` | | `webxr`, `rooms`, `multiplayer`, `voice`, `spatial-portals`, `avatars`, `items`, `entry-assertion`, `payments` |
| `comfort` | | `locomotion`: `stationary`, `teleport`, `smooth`, `vehicle`. `intensity`: `low`, `medium`, `high`. `seated`: `supported`, `required`, `unsupported` |
| `input` | | `controllers`, `hands`, `gaze`, `keyboard-mouse`, `touch`, `gamepad` |
| `perf` | | The weakest device it targets: `mobile`, `standalone`, `desktop` |
| `t` | | Topics |
| `L`, `l` | | Language and other NIP-32 labels |
| `content-warning` | | NIP-36, with a reason |
| `status` | | `live`, `beta`, `maintenance`, `retired` |
| `p` | | Co-creators |
| `a` | | Linked things, such as an access product |

`content` is a description in plain text or Markdown. Clients never parse data
out of it. Capability, comfort and performance tags are claims, not
permissions.

A newer event with the same coordinate replaces the older one. To close a
world, publish it with `status` `retired`.

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
  "relays": ["wss://relay.example"]
}
```

Serving rules:

- `Access-Control-Allow-Origin: *`, or a browser-based client can't read it.
- `https`, `application/json`, at most 64 KB.
- A client fetching it does not follow redirects.

`listing` is `allow` (the default) or `deny`. With `deny`, a compliant client
does not show other people's listings of this origin. A direct link still
works.

`airlock` is where the world sends visitors who arrived without a return
address ([NSWP-02](02-doors.md)). `relays` hints where the world's events live.

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
