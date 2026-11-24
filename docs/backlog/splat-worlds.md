# Worlds made with, or entirely of, Gaussian splats

- **Asked:** 2026-11-24. The owner: "what do you think of Gausian Splats?
  Could we support worlds made with or entirely of these?
  https://sparkjs.dev/"
- **Who:** a small trial first (the NSWP builder), then the kit and the world
  template. Briefed 2026-11-24, in the builder's queue after its menu work.
- **State:** the trial is agreed, and has its first finding (below: what a
  splat world's page has to allow). Its file and renderer are put to the
  owner, and nothing is fetched until he says so. Asked whether the builder
  should make one splat room as a trial after the menu work, the owner
  said: "Yes, after the menu". Only the trial: nothing goes into the kit before the owner has
  tried it on the Quest 3S.

## What a splat world is

A place captured from photographs or video (or made by a model) and drawn as
millions of small soft blobs of colour, not as meshes and textures. It looks
like the real place, lit as it was when captured. It has no surfaces: nothing
in it is a floor or a wall that anything can stand on or bump into.

## What Spark is (from its own pages, read 2026-11-24)

A renderer for splats that works inside THREE.js, built by World Labs. Its
quick start uses three 0.180; the kit asks for 0.170 or later and builds with
0.187, so the two sit in one scene.

- Splats and ordinary meshes are drawn together in one scene, each in front
  of or behind the other correctly. So the kit's figures, doors, items and
  hands would stand inside a splat place.
- It reads the common files: ply, spz, splat, ksplat, sogs.
- Since its 2.0: a place of any size is drawn from a fixed number of splats
  a frame (it says 500 thousand to 2.5 million by device), chosen by where
  the visitor is looking; and a file of its own (.rad) is fetched a piece at
  a time, coarse first, so a place appears at once and sharpens.
- Its own budgets: a Quest 3, one million splats or fewer; a phone, one to
  three million; a computer, one to five million.
- It has a headset wrapper of its own, which the kit would not use: the
  kit's own session and hands stay.

## What the protocol already allows

Everything. A world is a site; NSWP says nothing of how a world draws
itself. A world made entirely of splats can be published and have a door
today. What is missing is in the kit, which is where the owner wants
consistency.

## What the kit would need

- **Somewhere to stand.** The kit's walking, stepping, doors and arriving
  places all need a floor and walls. A splat place needs a second, unseen,
  simple model of the same place: floors, walls, door openings. Made by
  hand, or made from the splats by a tool. This is the real work for a
  world's maker, and the template should say so and check it.
- **An entry of its own,** like `nswp-sdk/bag`: a world that has no splats
  does not download the renderer. The renderer is roughly a megabyte and
  includes a WebAssembly part, so a world's page has to allow that.
- **How much to draw, chosen by the kit and not by each world:** by device,
  lower in a headset, so a visitor is not made ill by a place that drops
  frames. A world may ask for less, never for more than the device's number.
- **Pictures and clips** (the Camera) draw the scene to a picture of their
  own; that has to be tried with splats in it.
- **Figures and items are lit by the kit's lights,** and the place is not
  lit at all: it carries its own light from the day it was captured. A
  figure can look pasted in. A world can set the kit's lights to match.
- **Size.** A splat place is tens to hundreds of megabytes. A door should be
  able to say a world is large before a visitor walks in, and a visitor on a
  phone connection should be able to say no.
- **Where the file comes from** tells its host who is visiting, as with
  pictures in books and with a look's model.
- **Godot worlds:** not looked into. Godot's web export is a different
  renderer and has no splats of its own.

## What a splat world's page has to allow: the first finding (2026-11-24)

Found before anything was downloaded, by reading Spark's source and then
asking the browser. It decides whether a splat world can be an ordinary kit
world at all, so it is the first thing the trial settles by running Spark.

**What Spark does** (its source, version 2.4.0): its sorting and its reading
of files are WebAssembly, carried inside its one script and compiled as the
script loads; and it starts its workers from blob addresses, with a data
address tried if that fails.

**What a world's rules say to each,** tried in Chrome with no Spark: a page
under the Gallery's own content rules, as its build wrote them
(`script-src 'self'`, no `worker-src`), asked to do each thing.

| Asked of the browser | As the worlds' rules are | With `'wasm-unsafe-eval'` in `script-src` | With `worker-src 'self' blob:` | With both |
|---|---|---|---|---|
| Compile any WebAssembly | refused | allowed | refused | allowed |
| Start a worker from a blob address | refused | refused | allowed | allowed |
| Start a worker from a data address | refused | refused | refused | refused |
| Start a worker from a file of the world's own site | allowed | allowed | allowed | allowed |

- **Spark as it ships can't run under the worlds' rules.** Two things it does
  are refused, and its fallback is a third.
- **The workers could be mended without a rule,** if Spark can be built so
  that its workers are files of the world's own site. To be tried.
- **The WebAssembly can't be built round.** Every way of running WebAssembly
  is refused without that word in the rule. Whether Spark can run at all
  without its WebAssembly is not known; expected not.

**One world already has exactly these rules: the Foundry.** A world made in
Godot is WebAssembly, so its build writes `script-src 'self'
'wasm-unsafe-eval'; worker-src 'self' blob:` (`scripts/build-godot-example.mjs`).
No other world has them.

**Decided in principle (the orchestrator, 2026-11-24): a splat world may have
what a Godot world has, by its own build, and no other world changes.**

- `'wasm-unsafe-eval'` in that world's `script-src`, written by its build
  only where the world uses splats. Never in the rules every world gets.
- **Workers as files of the world's own site, not blobs,** if Spark can be
  built that way: then `worker-src` needs no `blob:`. A rule that isn't
  needed isn't added. If it can't, it is `worker-src 'self' blob:`, as the
  Foundry has, with the reason written down.
- `'unsafe-eval'` stays refused everywhere, as now. What `'wasm-unsafe-eval'`
  allows is compiling WebAssembly from bytes the page already has; it does
  not allow running text as script.

**For the trial's first section to settle, by running it:**

- Spark under those rules and no others, in Chrome and in Firefox.
- Whether it has any way to run without its WebAssembly.
- What the template's check says to a maker whose world asks for splats, so
  that it is chosen knowingly: "this world's page will allow WebAssembly to
  be compiled, as a Godot world's does".

**Not tried:** Spark itself under any rules; Firefox; the Quest's browser.

## The trial's file and renderer, put to the owner (2026-11-24)

Nothing is fetched until the owner says so.

- **The file:** "Knock Community Hall" by scbenoit, 27.8 MB, one `.sog` file,
  about 1.9 million splats, CC BY 4.0. The note beside the file in
  PlayCanvas's engine repository says "Author must be credited. Commercial
  use is allowed.", and the scene's own page (`superspl.at/scene/0ff2e6dc`)
  shows the same licence. Chosen because its licence is stated for the file
  itself, in two places that agree.
- **It is the outside of a hall, not a room.** The true rooms found either
  need an account on their host to fetch, or have two licences that
  disagree. So the trial leaves untried what a room has: walls close by, a
  ceiling, a doorway.
- **The renderer:** `@sparkjsdev/spark` 2.4.0, MIT, for three 0.180 or later.
  About 3 MB as one script, about 1 MB as a host sends it. Into the trial's
  own copy only.

## A first step that settles most of it

One room made of splats in a copy of the template, with a floor model
under it, on the local sites: walk it at a desk, on a phone, and in the
pretend headset; take a picture; stand a figure and a door in it; measure
frames and the download. Then the owner tries it on the Quest 3S. Nothing
is added to the kit before that.

## Must not

- Let a world set the number of splats drawn above the device's own limit.
- Make every world download the renderer.
- Let a place with no floor model be published by the template's check.
