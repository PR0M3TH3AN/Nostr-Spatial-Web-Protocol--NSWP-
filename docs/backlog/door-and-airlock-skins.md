# Doors and Airlocks that wear a world's own look

- **Asked:** 2026-11-22. The owner: "Doors need to be able to be skinned so
  they can match the world they are in if needed. We have our default but
  they should be able to be skinned while also supporting all the same
  information and functionality. Same for airlocks. This should be a part of
  the kit that other worlds can use and interop with. Kinda like our items.
  Doors can be skinned with meshes and textures and maybe particle effects
  stored like an item is."
- **Who:** the kit first (the NSWP builder; the door drawing in
  `packages/sdk/src/three.ts` and `door-*.ts`, the Airlock's chamber), then
  the template and BitPortal by vendoring. Not briefed.
- **State:** asked.

## What it is

Today every door and every Airlock chamber is drawn the kit's one way. A
world should be able to give its doors (and the Airlock chamber where it has
one) a look of its own: a mesh, textures, and perhaps particle effects,
published as a signed description with files named by hash, the way an item
is. Any world, the template or another engine can then use a skin someone
else made, by its address.

Everything a door does stays the same whatever it wears: the real address,
verified or listed, the name, kind, intensity, warnings, price, whether this
device can run it, the icons for what the world offers, the details card,
"Travel here", and walking through.

## The kit's half and the client's half

- **The kit:** a skin's description (a new kind or a new use of the item
  description, to be decided in the design), checking it before drawing,
  fitting the skin to the door's frame, and drawing the information over it.
  The kit's own door is the default and is drawn when a skin can't be
  fetched, is too big, or fails a check.
- **Other engines:** the engine script hands the checked skin to the engine
  (Godot builds it from checked bytes, as with own models).
- **The template:** a world picks a skin in `world.json`.
- **BitPortal:** its room keeps the default; it may offer skins for the
  doors you keep.

## What a skin may never do (the design must hold these)

- **Hide or fake the information.** The kit draws the address, the verified
  mark and the icons on a plate no skin can cover, move off-screen or
  imitate, as it does for a person's mark above an own model.
- **Run anything.** Meshes, textures and particle settings only, read as
  data. Particles are parameters the kit's own particle drawing reads, never
  code.
- **Tell a host who is looking.** Files are fetched by hash, under the same
  rule as items and own models (`item-file-hosts`): only from the viewer's
  listed content-addressed hosts, unless they switched that on.
- **Cost too much.** A budget per door, lower than an item's, since a room
  can have many doors; beyond a number of skinned doors in view, the rest
  are drawn plain.
- **Change where a door goes** or skip the Airlock.

## Open, for the owner

- **Whose skin is an Airlock's?** The Airlock exists to check the
  destination, so a destination dressing its own Airlock could make a
  doubtful crossing look trusted. The orchestrator's recommendation: the
  Airlock's chamber wears the skin of the client running it (BitPortal's,
  or the world you're leaving), never the destination's; the information
  panel is never skinned.
- Whether skins can be sold or given like items, later.

## Done looks like

To be written when briefed: a world with skinned doors, the same door
information read the same way as on a plain door, a skin that fails a check
drawn plain with a note, a Godot world showing the same skin, and an
off-list host seeing no request.
