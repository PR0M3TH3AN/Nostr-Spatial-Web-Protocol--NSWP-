# Worlds made with, or entirely of, Gaussian splats

- **Asked:** 2026-11-24. The owner: "what do you think of Gausian Splats?
  Could we support worlds made with or entirely of these?
  https://sparkjs.dev/"
- **Who:** a small trial first (the NSWP builder), then the kit and the world
  template. Not briefed.
- **State:** asked, as a question. Not a priority: the client's menu comes
  first.

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
