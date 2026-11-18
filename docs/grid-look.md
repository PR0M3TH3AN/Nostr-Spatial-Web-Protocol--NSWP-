# The grid look

How the reference places are drawn: a dark plane ruled with light, with
things standing on it. BitPortal's room, the reference worlds, and any home
drawn by the SDK share it, from one copy in `packages/sdk/src/`.

It is one renderer's look. A home layout is data (spec §4.5), and a world's
scene is its own; nothing here is part of the protocol.

## The pieces

| Piece | What it is | Where |
|---|---|---|
| The ground | A grid of light to the horizon, a glow where it ends, a skyline of blocks. Three draw calls, no textures | `createEnvironment(accent, { ground })` in `nswp-sdk/home` |
| Blocks | Dark boxes with lit edges: furniture, walls, trees. Every box in one builder is drawn together, in two draw calls | `createBlocks(accent)` in `nswp-sdk/home` |
| The doorway | An arch standing on the floor, with its sign above. The one curve | `createPortalGate()` in `nswp-sdk/home` |
| A home | The ground, a room of block walls, and the built-in furniture as blocks | `createHome(layout)` in `nswp-sdk/home` |

## The rules

- **One colour of light per place.** The accent draws the grid, the edges and
  anything that glows. Everything solid is dark.
- **Nothing is lit by lights.** Each face of a block carries its own shade, so
  a room of furniture costs a headset two draw calls and no lighting. A lamp's
  light is drawn: a glowing cube and a pool on the floor.
- **Sizes sit on a lattice.** Furniture on tenths of a metre, the skyline on
  two metres, the grid on one and eight. It is why everything reads as made of
  the same stuff.
- **A camera has to see a long way.** Set the far plane to 700 or more, or the
  horizon is cut off.

## Using it in a scene of your own

```ts
import { createBlocks, createEnvironment } from "nswp-sdk/home";

const environment = createEnvironment("#ffb703");
scene.add(environment.group);

const blocks = createBlocks("#ffb703");
blocks.at([2, 0, -3], 45);                                  // place and turn what follows
blocks.box([0.3, 1.8, 0.3], [0, 0.9, 0]);                   // a trunk
blocks.box([1.4, 0.6, 1.4], [0, 2.1, 0], { color: "#3a2a08" }); // a crown
blocks.box([0.5, 0.5, 0.5], [0, 2.65, 0], { color: "#ffb703", lit: true }); // lit at the top
scene.add(blocks.build());

// each frame
environment.update(t);
```

`sites/world-a/src/main.ts` (a gallery) and `sites/world-b/src/main.ts` (a
grove) are worked examples.

## Changing it

The grid's spacing, how far it reaches and the travelling ring of light are in
the floor's shader in `environment.ts`. The skyline's density and heights are
just below it. A block's face shades are the `FACES` table in `blocks.ts`. The
furniture's shapes are `buildItem()` in `home.ts`.

Changing any of them changes how the reference worlds look, so their preview
pictures have to be retaken and their announcements signed and published
again (`README.md`, "Previews").
