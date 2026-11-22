# A look of your own: your own model, size and animations, in every world that allows it

- **Asked:** 2026-11-21. The owner: "Id like to allow users to create and
  use their own skins kinda like we have for bitportal items. So we have
  our default avatar customize but users can be or look like whatever
  they want. This could include size adjustments (within limits) new
  meshes with animations if they want. Etc. All across worlds if the
  worlds allow custom skins and dont want to skin the players themselves.
  Thats two different things there."
- **Who:** not briefed. The kit and the protocol (NSWP-05); BitPortal for
  the screen where a look is made and chosen.
- **State:** briefed (the BitPortal session; the written design is `docs/plans/own-models.md`, waiting on the orchestrator and the owner's answers; nothing built)

## What exists today

- **A look (NSWP-05)** comes in three kinds, and a world draws the richest
  it accepts:
  - *generated* from the key (everyone differs from the start),
  - *simple*: parts chosen from short lists and three colours, which is
    what "Your look" edits today,
  - *model*: a 3D file the person points at. **Written in the spec
    (§4.2) and not built.** That is this request.
- **What a world may do with a look** is already written (NSWP-05, "What
  a world may change"): draw it as it is, re-dress it in its own palette,
  recast it as something of its own, or ignore it (a uniform). The
  owner's "two different things" are exactly the first and the last two:
  a world that allows your own model, and a world that dresses its
  players itself.
- **Items (NSWP-17)** already do the hard part safely, and a model look
  would use the same path: a signed description names its files by hash
  wherever they are kept; every file is checked against its hash and
  read through the kit's one model reader (`readGlb`) before anything
  draws it; a budget caps size; a model that fails is drawn as a marker.

## What is asked, in the orchestrator's words

- **Your own model.** A file (glTF binary, or VRM, which is glTF with a
  standard skeleton) published in your look's note (kind 37301, the
  existing one), named by hash, kept anywhere.
- **Animations.** If the model has the standard skeleton, the kit drives
  walking, idling, pointing and talking for it, so it moves in every
  world without its maker doing anything. A model may bring its own
  animations for those same moments, and the kit plays them in their
  place.
- **Size, within limits.** A scale the person picks, held between limits
  the kit sets and a world may narrow. Size can't change how far you can
  reach or walk, where your eyes are for a door, or anyone's personal
  space: those stay the kit's numbers (the owner's own; never raised for
  this).
- **Across worlds.** A world says in its announcement which kinds of look
  it draws. One that allows models draws yours; one that doesn't draws
  your simple look instead; one that dresses everyone draws its own. The
  door can say which before you cross.

## Safety, in short

- A look has **no script**. Unlike an item, nothing in it runs. (If the
  owner wants looks that do things, that is a separate decision.)
- Every file is checked against its hash and read by `readGlb`; never by
  an engine's own loader, never a file that names another file outside
  itself.
- A budget for size and detail, lower than an item's, since a room has
  many people. Over it, the simple look is drawn.
- **The mark stays.** The one cue that follows a person everywhere and
  can't be copied is drawn on every model, so nobody can wear someone
  else's face undetected.
- Anyone can choose to see another person's simple look instead of their
  model, as they can mute a voice.

## The kit's half and the client's half

- **Kit (every world, the template, other engines):** read a model look,
  check it, fit it to the budget, drive it, scale it within limits, fall
  back; the world's word for which kinds it draws; the same in Godot by
  the kit's own code, as items are.
- **BitPortal:** "Your look" gains "Use your own model": pick a file, see
  it before publishing, publish the note through the sign-in address.
  Where the file is kept (Blossom, as items are) follows what items do.
- **Protocol:** NSWP-05's model tier written down, with vectors.

## Open, for the owner

- Size limits: the orchestrator's proposal is half to one and a half
  times the standard height, a world able to narrow it.
- VRM only (moves in every world for free), or any glTF (more freedom,
  and a model with no skeleton just floats along)? Proposal: both, with
  VRM recommended and shown as "moves everywhere".
- May a look ever carry a script? Proposal: no.

## Must not

- Run anything from a look.
- Let size change reach, walking speed, door reach or personal space.
- Draw a model before its hash and `readGlb` have passed.
- Hide or replace the mark.
