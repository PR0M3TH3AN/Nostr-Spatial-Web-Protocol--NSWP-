# Maps of the connected worlds, made by travelling and shared with friends

- **Asked:** 2026-11-21. The owner: "This is a useful tool for everyone
  but is also kinda a meta gameplay mechanic. Could also make curation of
  worlds easier to surface good worlds over time. ... one of the
  activities in the game i would like to be to make maps of all the
  connected worlds. So it could be like a nostr list that includes all
  the worlds you know about. The could be represented like a node graph
  kinda like how Obsidian shows linked notes. And you can share this or
  keep it to your self. So getting around might be something you need to
  ask a friend about. That would be really cool. When you go to a new
  location it logs all its doors and where they lead. So you an keep or
  share that info. Kinda like a travel system that is better than just a
  list of ranked doors. Maybe we could show their rank by scaling them
  differently? And visiting a world could be an achievement that
  triggers this data to be added to your map?"
- **Who:** not briefed. The kit (logging doors, the map's shape, the
  graph), the protocol (a shared map as a Nostr note), BitPortal (the map
  as a place to travel from, and shared maps as a way to find worlds).
- **State:** asked

Everything below is the orchestrator's reading, to be argued with.

## What exists to build on

- **Lists of worlds (NSWP-08):** a NIP-51 curation set (kind 30004)
  naming worlds by address; following someone's list. A map's list of
  worlds is this already. What a list lacks is the *links*: which door in
  which world leads where.
- **Doors are known to the kit:** every door a world puts up is the kit's
  own (`createPortalGate`), with its destination. So the kit, in the
  visitor's browser, can note "this world has these doors, to these
  places" the moment someone arrives, with nothing asked of the world.
- **Ratings (NSWP-13):** a tally per world. That is the size of a node.
- **Achievements (NSWP-16):** claims kept on the device until BitLogin
  builds its side. "Visited" can be one, but the map itself shouldn't
  wait on that (below).

## The map, in the orchestrator's words

- **Made by travelling.** Arriving in a world adds it to your map, and
  adds every door it shows as a line to where it leads. A place you have
  seen a door to but not visited is drawn faint: you know it is there,
  not what it is like. Visiting fills it in.
- **A graph, like Obsidian's.** Worlds are dots, doors are lines; dots
  sized by their rating, lit by what you have visited, coloured by kind
  of place. Pointing at one shows its card (the same card a door has in
  the menus, doors-03) and "Travel here".
- **Yours, unless you share it.** By default it is kept for you alone.
  Sharing is a deliberate act: share all of it, or a part (a region, a
  trail), with one person or with anyone.
- **Asking a friend the way.** A shared map can be merged into your own,
  marked as theirs, so a place you only know from a friend's map is drawn
  differently until you go yourself.
- **Better curation, slowly.** Maps that many people share say which
  worlds are reached, kept and linked to, which is a signal no single
  list gives. BitPortal could surface it ("worlds on the most maps").

## Privacy, which matters more here than anywhere

A map of where you have been is a **location history**. So:

- It is private by default, and stays on the device or is kept
  encrypted to its owner's own key (as NIP-51 private entries are), never
  published unless the person shares it.
- Sharing says plainly what is shared, including that a shared map shows
  where you go.
- A world never sees your map and can't add to it on its own; the
  visitor's own kit notes what it saw.
- Nothing is noted in a private room, or in a world by invitation unless
  the person chooses (a guest list someone keeps shouldn't leak through a
  map).

## How it would be written (to settle when briefed)

- A shared map as a Nostr note: worlds (as a NIP-51 set does) plus links
  ("from A, a door to B"). The links need a tag name, asked for under the
  fleet's rule 11 before anyone writes one; perhaps a new kind. Readers
  check each world's own announcement before drawing it.
- "Visited" as an achievement only once achievements can be kept with the
  sign-in (BitLogin's side). Meanwhile the map is its own record: it
  shouldn't depend on achievements to work.
- Rank by size: from ratings people have published, read the same way
  doors read them today.

## The kit's half and the client's half

- **Kit (every world, the template, other engines):** note arrivals and
  doors in the visitor's own kit; keep the map privately; draw the graph
  in the menus (desk, phone, headset console); share and merge.
- **BitPortal:** the map as a way to travel from the room; maps people
  share as a way to find worlds; perhaps "worlds on the most maps".
- **Protocol:** the shared map's note, with vectors.

## Open, for the owner

- Private on the device only, or kept encrypted with your sign-in so it
  follows you to another device? (The second needs BitLogin.)
- Should a map be shareable as a link anyone can open, or only to people
  you choose?
- Does visiting count as an achievement from the start (kept on the
  device), or only once achievements follow the sign-in?

## Must not

- Publish where someone has been without their saying so.
- Let a world write to a visitor's map.
- Note anything in a private room or a world by invitation unasked.
- Draw a world from a map without checking its own announcement.
