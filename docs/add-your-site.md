# Add a site you already have

How to make an existing website a world on the spatial web: a game, a gallery,
a scene, anything with a 3D view. It does not have to support VR, and none of
its code has to change for the first two steps.

This is the short version. Each step names the part of [`spec.md`](../spec.md)
it comes from, for when you need the detail.

There are three steps, and each works without the next:

| Step | What a visitor gets | What it costs you |
|---|---|---|
| 1. Be listed | A door to your site in a lobby, marked "listed by" whoever listed it | Nothing. Ask the lobby's curator |
| 2. Announce yourself | The door shows as **verified**: your site and your key vouch for each other | One static file, one signed note |
| 3. Welcome travellers | Arriving feels like arriving, and there is a way back | A few lines of code |

## Before you start

You need the `nswp` command-line tool and, for step 3, the SDK. Neither is on
a package registry yet. Take both from the
[world template](https://github.com/PR0M3TH3AN/nswp-world-template): copy its
`vendor/nswp/` folder into your project. It holds:

- `nswp-cli.js`: the tool. Run it as `node vendor/nswp/nswp-cli.js`.
- `nswp-core.js` and `sdk/index.js`: the library and the SDK, for step 3.

The examples below call the tool `nswp`.

## 1. Be listed

A lobby's curator can list any site, with their own description of it, without
the site doing anything. Nothing here is yours to do. The door will say who
listed it, and it will not say "verified", because your site hasn't said
anything about itself yet.

## 2. Announce yourself

Two things have to agree: a signed note saying "this world is at this
address", and a file on your site saying "that key speaks for me" (spec §5.2,
§5.3).

**Make a key.** Keep the file out of your repository. Anyone who has it can
announce worlds as you.

```bash
nswp keygen ~/.config/nswp/my-site.key
```

It prints the public key: 64 letters and digits. You need it below.

**Describe your world** in a file, `world.json`:

```json
{
  "d": "my-game",
  "title": "My Game",
  "url": "https://game.example/",
  "summary": "One line about it.",
  "modes": ["inline-3d"],
  "comfort": { "locomotion": "smooth", "intensity": "medium" },
  "inputs": ["keyboard-mouse", "gamepad"],
  "perf": "desktop",
  "topics": ["game"],
  "languages": ["en"],
  "status": "beta"
}
```

- `d` is your world's name under your key. Pick it once: changing it later
  makes a different world, and doors people saved stop leading to you.
- `url` is where a visitor lands. It must be `https`.
- `modes` says how it can be seen: `inline-3d` for a 3D view on an ordinary
  screen, `immersive-vr` if it has a VR mode. A site with only `inline-3d` is
  a full citizen. In a headset, its door says it opens in the browser.
- `comfort`, `inputs` and `perf` let a lobby tell a visitor, before they go,
  whether it suits them and their device. Be honest: `intensity` is `low`,
  `medium` or `high`; `perf` is `mobile`, `standalone` (a headset on its own)
  or `desktop`.

**Put a manifest on your site** at `/.well-known/nswp.json`:

```json
{
  "schema": "nswp/manifest/0.3",
  "listing": "allow",
  "publishers": { "<your public key>": { "worlds": ["my-game"] } },
  "worlds": {
    "my-game": {
      "entry": { "url": "https://game.example/", "modes": ["inline-3d"] },
      "airlock": "https://portal.bitblocks.network/go/"
    }
  },
  "relays": ["wss://nos.lol", "wss://relay.primal.net"]
}
```

Serve it with the header `Access-Control-Allow-Origin: *`, or a lobby's page
can't read it and you won't verify. `"listing": "deny"` asks lobbies not to
list you at all.

**Sign and publish.**

```bash
nswp sign-world world.json --key-file ~/.config/nswp/my-site.key --out announcement.json
nswp validate announcement.json
nswp publish announcement.json --relays wss://nos.lol,wss://relay.primal.net
```

Publishing is public and can't be taken back, so deploy the manifest first and
publish last.

**Check.**

```bash
nswp check https://game.example/
```

It reads your manifest, finds your announcement on the relays, and says
"Verified world" when the two agree. That is the whole of step 2. If you
change `world.json`, sign and publish again: the new note replaces the old.

### A picture in the doorway (optional)

A door can show what is behind it (spec §5.8). Add a still to `world.json`:

```json
"previews": [{
  "url": "https://game.example/previews/<sha256 of the file>.webp",
  "type": "flat", "sha256": "<sha256 of the file>", "width": 1280, "height": 720
}]
```

`flat` is an ordinary picture, at most 1920 × 1080 and 500 KB. `pano` is a
360° picture, at most 4096 × 2048 and 2 MB. Name the file by its SHA-256
(`sha256sum picture.webp`) and serve it with `Access-Control-Allow-Origin: *`.
A lobby keeps its own copy, checked against the hash, and shows that, so
looking at your door never contacts your site.

## 3. Welcome travellers

A visitor who comes through a door arrives with a short note in the address:
where they came from and how to get back (spec §4.4). Three things make the
trip feel like one place leading to another.

Point your bundler at the copied files, so `nswp-sdk` means
`vendor/nswp/sdk/index.js` and `@nswp/core` means `vendor/nswp/nswp-core.js`.
With Vite:

```js
// vite.config.js
resolve: {
  alias: {
    "nswp-sdk": "/vendor/nswp/sdk/index.js",
    "@nswp/core": "/vendor/nswp/nswp-core.js",
  },
}
```

Then, as early as your page runs, before any third-party script:

```js
import { arrival, configure, portal } from "nswp-sdk";

// 1. Read how the visitor arrived. This also removes the note from the
//    address, so it doesn't linger in history or reach other scripts.
const { context } = arrival.read();
configure({ defaultAirlock: "https://portal.bitblocks.network/go/" });

// 2. Offer the way back, when there is one. Put it wherever your own menus
//    are: a pause menu is fine.
if (arrival.returnAirlock()) showBackToLobbyButton(() => portal.home());

// 3. Send every link that leaves your site through the visitor's Airlock.
//    It shows them the real address and waits for them to agree.
exitButton.onclick = () => portal.go({ url: "https://gallery.bitblocks.network/" });
```

That adds about 170 KB to your bundle before compression, most of it the
signature checking.

### How your visitors look to each other

If your site has shared rooms, each visitor has a **look**: a few parts and
colours they chose, or that their key generates (spec §4.2). It is data, not a
3D file, so nothing is downloaded to draw a stranger.

```js
import { decodeLook } from "@nswp/core";
import { arrival } from "nswp-sdk";
import { createFigure } from "nswp-sdk/three";

const arrived = arrival.look();                       // what this visitor chose to wear here, or undefined if they came plain
const read = arrived ? decodeLook(arrived) : null;    // never trust it unread
const figure = createFigure(read?.ok ? read.value.look : theirKey); // a key or any seed generates a look of its own
```

You choose how much of it to keep:

- **As it is:** `createFigure(look)` draws the standard figure.
- **Re-dressed:** `createFigure(look, { material, palette, omit })` keeps the
  shapes and uses your material and your colours.
- **Your own thing:** read the look's fields (`color`, `build`, `head` and the
  rest) and draw whatever fits your world. A game might paint a vehicle in
  the visitor's `color`.

Whatever you do, try to keep the **mark** visible: a five-by-five pattern from
the visitor's key (`markGrid(look.mark)` in `@nswp/core`). It is the one thing
that follows a person from world to world and that someone else can't copy.

The SDK's room code does all of this for you:
`createPresence({ look: () => arrival.look(), identity: () => arrival.identity(), figureStyle })`.

### Who your visitors are

Most are guests, and that is fine. A visitor is known by name once your
site holds a **pass** for them: their own key's signed word that a throwaway
key speaks for them on your site for a few hours
([NSWP-10](../protocol/10-identity.md)). From BitPortal nobody arrives with
one. A visitor signs in at your site, in a window at their own sign-in
address, and their signer makes the pass: the kit's menu has the row for it,
under "You" ([controls-kit.md](controls-kit.md), "Signing as the visitor").
A client that names no signer may send the pass with the visitor on arrival.
You never see their real key, and you must never ask for it.

```js
import { hereAs } from "nswp-sdk/three";

const who = hereAs();   // { pubkey, name } once checked, or undefined for a guest
if (who) greet(who.name || "friend");
```

A static site can show the name and should gate nothing on it. Don't store
the pass: it is proof that this person visited, and it isn't yours to keep.

### What every world owes a visitor

Your interface is yours, and it leads. But a visitor needs a few things to be
the same everywhere (spec §21.3). Whatever your menus look like, a visitor
must always be able to do each of these in one deliberate action:

- **Go home**, when they arrived with somewhere to return to. That is
  `portal.home()` above.
- **See the address** of the world they are in.
- **Leave VR**, if you have a VR mode, without reaching for the headset's own
  button.
- **Know whether others can see or hear them**, and stop it, if you have
  shared rooms.

Two things a world must never do (spec §6.2, §12.3):

- **Never navigate a visitor away yourself.** `location.href = …` to another
  site skips the page that shows them where they are going. Use `portal.go()`.
- **Never ask for a password, a key or a sign-in on arrival.** A world doesn't
  need one to let someone look around, and a place that asks looks exactly
  like a phishing page.

If you would rather not draw the list yourself, the SDK's controls kit draws
it, and can shrink to one small mark in a corner while your own interface has
the screen: [`controls-kit.md`](controls-kit.md), "Sharing the screen with a
world's own interface".

## Worked examples

- [`sites/shared/world.ts`](../sites/shared/world.ts): everything above in one
  file, for seven worlds: arriving, doors, the way home, the controls.
- The world template's `scripts/sign.mjs` and `scripts/check.mjs`: step 2 as a
  script you can adapt.

## What has and hasn't been tried

Step 2's commands and step 3's code were run against a scratch site on
2026-11-17: the key, the signed note, the manifest and the bundled code all
check out. `nswp check` and publishing were not run for that scratch site,
since it has no real address; they are the same commands the eight worlds
under `bitblocks.network` were verified with. No site outside this project
has followed this page yet. If a step is wrong or unclear, that is a bug in
the page.
