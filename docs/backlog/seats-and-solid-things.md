# Seats with a side to sit from, solid things, and legs that sit

- **Asked:** 2026-11-25, by the owner, in the `nswp-agents` session,
  after playing a cast member in the trial world: "things like benches
  need a facing side that is the only side they can be sat on from. And
  objects like the bench, lamp posts, plants etc need collision." And:
  "the legs need to be programmaticly adjusted when it sits down."
- **Who:** the playground first (its world format, its walker); then the
  kit's pieces (`addBench`, `addLamp`, `addPlant` and the rest) by names
  given.
- **State:** the playground's half built the same day (its D114, free):
  any thing may declare `solid`, `footprint`, `facing` and `seat`;
  bodies walk round what is solid; "sit on the bench" walks to the seat's
  front from wherever the body is, turns, and sits, legs bent to the seat
  by the same solve as walking. The owner watched it: first "no the agent
  just stands clipped through the bench", mended, then "much better", and
  sent from behind the bench it went round to the front. The kit's pieces
  handing back their own footprint, facing and seat height is the kit's
  half, by names given, not started.

## Wanted

1. A seat says which side it is sat from, and only that side is offered
   for sitting.
2. Every solid thing has a footprint that walking avoids, for visitors
   and agents alike. Today a world keeps bodies out with its own code
   (`canStand`); the kit's pieces could hand their footprint back so a
   world needn't say each one twice (the playground's D81 finding).
3. A body that sits has its legs bent to the seat by code, from the same
   two-bone solve as walking.

## Must not

- Change how the kit's pieces look or where they stand in worlds that
  already use them.
