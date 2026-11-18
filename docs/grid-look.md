# The grid look

How the reference places are drawn: a dark plane ruled with light under a
night sky, with things of dark metal standing on it, seamed with light.
BitPortal's room, the reference worlds, and any home drawn by the SDK share
it, from one copy in `packages/sdk/src/`.

It is one renderer's look. A home layout is data (spec §4.5), and a world's
scene is its own; nothing here is part of the protocol.

## The pieces

| Piece | What it is | Where |
|---|---|---|
| The place | A sky, a ground ruled with light to the horizon, a skyline, dust in the air. About a dozen draw calls, no textures | `createEnvironment(accent, { ground })` |
| The modelling kit | A builder that makes shapes in code (bevelled boxes with panels pressed in, profiles swept along a path or turned on a lathe) and hands back one mesh | `MeshBuilder` |
| The surface | The one shader everything modelled is drawn in | `createAlloy(accent)` |
| The parts | A doorway frame, a wall, furniture, sculptures, a tree: each a function that adds itself to a builder | `addWall`, `addBench`, `addTree`, `addKnot` … |
| The doorway | An arch standing on the floor, with its sign above, a field of light inside and a glow round it | `createPortalGate()` |
| A home | The place, a room of walls, and the built-in furniture | `createHome(layout)` |
| A visitor | A helmet, a cloak and a point of light for each hand, lit in one colour | `createFigure(color)` in `nswp-sdk/three` |

Everything but the last is in `nswp-sdk/home`.

## The sky

Quiet on purpose, with one thing in it to look at: another world hanging low,
dark but for a thin lit edge, ruled with the same grid as the ground, with
lights on its night side and rings its own shadow falls across. Behind it are
fine stars, thicker along one faint band, and constellations drawn like a map
of a network: stars joined by fine lines, a point of light now and then
travelling from one to the next, each figure showing for a while and fading.

Every world's sky is arranged differently, from its colours or from a `seed`
you pass. The skyline is modelled towers (a spire, a blade, twin towers joined
by bridges, a stack of decks) and a few great arches far off: the doorway's
shape at the size of a city.

## The rules

- **One colour of light per place.** The accent draws the grid, the seams and
  anything that glows. Everything solid is dark metal.
- **Model it, don't stack boxes.** Shapes come from the kit: an edge is
  bevelled so it catches light, a face has a panel pressed into it, a curve is
  a profile swept along a path. A plain box or sphere reads as unfinished
  next to the rest.
- **Nothing is lit by lights.** The surface works its shape out per pixel: a
  fixed light from above, the horizon's glow reflected at a glancing angle, a
  rim where it turns away. A face marked as a light is drawn bright, with a
  pulse that travels along it. A lamp's light is drawn too: a glow and a pool
  on the floor.
- **One builder, one draw call.** Everything that stays still goes into one
  `MeshBuilder`, however much there is. Only things that move get a mesh of
  their own. This is what lets a detailed room run on a headset.
- **A camera has to see a long way.** Set the far plane to 700 or more, or the
  horizon is cut off.

## Using it in a scene of your own

```ts
import { addBench, addTree, createAlloy, createEnvironment, MeshBuilder, metalTone } from "nswp-sdk/home";

const accent = "#ffb703";
const environment = createEnvironment(accent);
scene.add(environment.group);

const b = new MeshBuilder();
b.tone = metalTone("#0d0804");                // this place's metal
addTree(b.at([2, 0, -3], 45), "#2a1d0a", 1);  // a part from the kit, placed and turned
addBench(b.at([0, 0, -1], 180), b.tone);

// A shape of your own: a post with a panel in each side and a light on top.
b.at([-2, 0, -3]);
b.box([0.3, 1.2, 0.3], [0, 0.6, 0], { bevel: 0.02, panel: { margin: 0.05, depth: 0.015 } });
b.box([0.2, 0.05, 0.2], [0, 1.23, 0], { glow: 1 });
// A column turned on a lathe: [radius, height] pairs from the bottom up, six sides.
b.lathe([[0.2, 0], [0.12, 0.1], [0.1, 1.5], [0.16, 1.6]], [4, 0, -3], 6);

const metal = createAlloy(accent, { ground: "#0d0804" });
scene.add(b.build(metal));

// each frame
environment.update(t);
metal.tick(t);
```

What a builder offers:

| | |
|---|---|
| `at(position, degrees, scale)` | Place and turn what is added next. `place(matrix)` for something that leans |
| `box(size, at, { bevel, panel, glow, shade, color })` | A box with its edges cut and panels pressed into the faces you name |
| `lathe(profile, at, sides, paint, { twist })` | A profile turned about the vertical: 4 sides is a square column, 24 a round one |
| `sweep(profile, frames, paint, { loop })` | A closed outline carried along a path: mouldings, ribbons, hoops. `loopFrames()` makes the path for a closed curve |
| `line(a, b, width, out)` | A thin strip of light lying on a surface |
| `quad`, `tri` | One flat face, for anything else |

A face's paint is a `color`, a `shade` (darker in a recess, lighter on a lip),
a `glow` from 0 to 1, and a `flow`: the distance along the piece, which the
travelling pulse follows.

`createAlloy` takes a `gloss` (0.5 for furniture, 1 for something polished)
and a `sheen`, which makes colour shift with the angle of view: the gallery's
sculptures use it.

`sites/world-a/src/main.ts` (a gallery) and `sites/world-b/src/main.ts` (a
grove) are worked examples.

## Changing it

| To change | Look in |
|---|---|
| The sky: the ringed world, the stars, the constellations | `createSky`, `planSky` and `createConstellations` in `environment.ts` |
| The grid's spacing, how far it reaches, the light that runs along it | the floor's shader in `environment.ts` |
| The skyline: its towers, how many, how far | `skylineShapes` and `createEnvironment` in `environment.ts` |
| How surfaces catch light | `alloy.ts` |
| The doorway's frame, the furniture, the sculptures, the tree | `models.ts` |
| What fills a doorway with no picture, and its glow | `veilMaterial` and `gateGlow` in `home.ts` |
| A visitor's figure | `avatarParts` in `three.ts` |

`packages/sdk/test/mesh.test.ts` checks that what the kit builds is sound:
faces the right way out, nothing inside the doorway's opening.

Changing any of these changes how the reference worlds look, so their preview
pictures have to be retaken and their announcements signed and published
again (`README.md`, "Previews").
