# Keeping a world up to date

A world carries its own copy of the kit: the console, how a visitor moves,
the sounds, the crossing's room. This page says how that copy is kept
current, and why it is a copy.

## What is always current, with nothing to do

Most of what changes is not in a world at all. It is in the visitor's own
client, and a world gets the newest of it the day the client does:

| Always the client's | So a world never has to update for |
|---|---|
| Signing in, at the sign-in address their client names | A new way to sign in, or a change to sign-in |
| A visitor's look, and changing it | New parts, a new editor |
| The Airlock: what is checked and shown at a door | New checks and warnings |
| Lists, saved doors, blocks | How they are kept or shown |
| Settings between devices | What is kept, and how |

A world built on an older kit still takes part in all of it, because a world
only ever reads how its visitor arrived and sends them on through their own
Airlock.

## What a world carries, and how it stays compatible

The kit in a world is the console and its controls, movement, sound, and the
crossing's room. It talks to clients through the protocol: the door link and
the arrival ([NSWP-02](../protocol/02-doors.md),
[NSWP-03](../protocol/03-arrival.md)). Both are read the same way by
everyone: **keep what you know, ignore the rest**. So:

- A newer client sending a setting an old world doesn't know: the world
  ignores it and carries on.
- An old world's link, missing a flag a newer client knows: the client
  treats it as not said.

An old world is behind. It is not broken. What it misses is whatever was
added since: a control, a setting that travels, a better default.

## Seeing how old a world's kit is

- **The world says.** Its manifest has `"kit": "0.21.0"`
  ([NSWP-01](../protocol/01-worlds.md), "Which kit a world was built with").
  The template and the reference builds write it for you. In another engine,
  it is `NSWP.KIT`: put it in your manifest.
- **A client may tell the visitor.** BitPortal's Airlock says, under "More
  about this place", when a world's kit is older than the one it knows. It
  changes nothing else about the crossing.
- **You are told.** `nswp check <address>` says which kit your site says it
  has beside the tool's own. `node scripts/probe-world.mjs <address>` reads
  which kit is really running on the page.

## Updating

### A world from the template

```bash
npm run update -- --check
```

says whether a newer kit is out, and changes nothing.

```bash
npm run update
```

takes it in. It replaces what the template owns (`vendor/`, `src/plumbing/`,
`scripts/`, and the update job) from the template's own repository, and
leaves everything of yours alone: `world.json`, `home.json`, your scenes,
your pictures and sounds. Then `npm install`, `npm run check`, look at the
world, build and upload as you always do. Nothing is built, uploaded or
announced for you.

**Or let it come to you.** The template has a job
(`.github/workflows/update-kit.yml`) that runs this once a week and opens a
pull request when there is something newer, with what changed written in it.
You read it and merge it, or don't. To let it open pull requests, turn on
"Allow GitHub Actions to create and approve pull requests" in the
repository's Actions settings.

A world made from the template before it had this: copy
`scripts/update.mjs` in from the template once, and run it.

### A world with the kit installed from this repository

Build the kit from a newer checkout and copy it in as you did the first
time. `KIT_VERSION` (from `@nswp/core`) is what to put in your manifest.

### Another engine

Copy the newer `engines/nswp-engine.js` over yours (for Godot, the whole
`addons/nswp/` folder), and put `NSWP.KIT` in your manifest.
`NSWP.VERSION` goes up when what the script offers an engine changes.

## Why not one script that every world loads?

It would keep every world current with no step at all, and it is the first
thing anyone thinks of. It is not how this works, on purpose:

- **Whoever controls that script controls every world.** One change, by its
  owner or by whoever broke into its host, runs in all of them at once. It
  could draw a sign-in that isn't one, or read the key each visitor is
  handed for their visit. Nobody building a world could see it coming.
- **A world's owner would have no say in what runs on their own site.** A
  copy is something they can read, test and keep.
- **One outage would take every world's controls with it.** A copy keeps
  working whatever happens to anyone else's servers.
- **It would make every world depend on one party.** A world must never need
  anyone else's server to be a world.

A pinned copy with an update that arrives as a pull request gets nearly all
of the benefit: a world is rarely more than a week behind, and every change
to it is one its owner saw.
