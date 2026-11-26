# A robot: a bipedal humanoid, concepts first

- **Asked:** 2026-11-25, by the owner, to the 3D artist: "a cool robot
  concept. Bipedal huminoid. Id like to see some concepts first."
- **Who:** the 3D artist (concepts, then the model); later, by what it is
  for, the agents' playground (its body and walker) and the kit.
- **State:** four concept directions with the owner (bitportal-art
  dcedab5, `assets/robot/concept/`): Courier, a slim runner; Warden, a big
  gate guard with the arch mark on its chest; Docent, a friendly guide with
  one round eye; Monolith, faceless, with an arch-shaped head. Waiting for
  his pick.

## For later, once he picks

- What it is for: an NPC or cast member in a world, a look a visitor can
  wear, a companion. And its size.
- Its body to the agents' rules: two-bone legs the walker drives, sitting,
  `solid` and `footprint`, arms that reach.

## The eye shows emoji (asked 2026-11-25)

The owner, to the 3D artist: "I would like for the face/eye to display any
emoji in a pixel sort of screen" and "the LLM should be able to pick the
emoji like it already does for the emotional voice queues". So the
Docent's eye is a small pixel screen (24 by 24, lit dots). The agent's mind
may put an emoji in its line, read out as voice cues are; with none, the
cue picks a face from the artist's own pixel set. Any emoji is drawn by
the visitor's own system emoji font into the screen, pixelated, so no font
is shipped. Names (the call, the face ids, the atlas file) are given by the
orchestrator when it is built.

## Two screens, the owner's choices (2026-11-25)

"1. face source. Both 2. color: full color 3. Chest screen should be
customize-able too. Lets support emoji on both for now. Im thinking the
chest for designation like "bar tender" or "librarian" and the face for
current conversation info like emotions or confusion." So: the eye shows
the conversation (the artist's drawn set first, then the device's emoji
font), full colour; a chest screen shows the agent's role, declared as
`designation: { emoji, title }` (name given 2026-11-25) by its world or
cast.
