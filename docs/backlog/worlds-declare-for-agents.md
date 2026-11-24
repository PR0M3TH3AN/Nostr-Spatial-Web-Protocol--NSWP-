# An agent that works in any world, from what the world declares

- **Asked:** 2026-11-23, by the owner, to the `nswp-agents` session, which
  passed his words on: "im wondering if we can like open up JEVs options
  dynamically and procedural based on how we structure our worlds in our
  protocol and NSWP rather than hand crafting what it can and cant do in
  each area." And, on a room rebuilt as declared data: "Yes build it and be
  thinking about how we upgrade our bitportal world protocol so that it
  enables this kind of agent to exist. Maybe it can be one of those icons
  on the door? Ask the Orchestrator to answer the questions you have."
- **Who:** the `nswp-agents` session first, in its playground only; then a
  written design for the protocol and the kit. Not briefed to the builder.
- **State:** the playground half is being built. Nothing of the protocol is
  changed, and no kind, tag or field name is taken. Part of
  `ai-keys-and-agents`, which is last and not a priority.

## The idea

An agent has a small fixed set of things it can do anywhere (go to, look
at, use, pick up, put down, give, follow, say, gesture). In each place its
choices are made up fresh from what is near it and what each thing says can
be done with it. Nobody writes a list of choices by hand for each area.

## What a world says of itself today (read from the kit, 2026-11-24)

- **People: yes.** Who is in a room, where their head and hands are,
  fifteen times a second, what they hold, what they say. Each visitor's own
  device speaks for itself; nobody is in charge of a room (NSWP-06).
- **Things in a world: nothing.** A world's furniture, buttons and doors
  that open are its own code. There is no format for a thing with a name, a
  place and a state, and nothing about things is shared between visitors
  (`shared-physics`: not built). A home's layout (NSWP-07) lists placed
  things, from eight built-in kinds, with no names and no state.
- **What can be done with an item: a little, for a held item.** A signed
  item says how it is held and names up to two presses ("Fire", "Reload").
  What a press does is the item's script. There are no conditions as data.
  `sittable`, `touchable`, `readable` and `wearable` are read and nothing
  acts on them.
- **What can be pressed in a world's menu: yes, and it is the nearest
  shape.** A world already describes its menu's rows to the client: each
  with an id, a label and a kind, pressed by one word (NSWP-02). That is a
  bounded, typed list of what a world can be asked to do.
- **Picking up, putting down, giving:** not in any world. A visitor's bag
  changes only at their own client (`items-given-and-won`: not built).
- **Where one can stand: not data.** It is a function in the world's code.
  No floor, walls, bounds or gravity is published; places to arrive are in
  a world's own files, not in what it publishes.
- **An agent can already come in as a visitor:** a guest needs only a
  session key; to go by a name it shows a pass signed by a key of its own.
  A world can refuse it like anyone. A room holds eight by default.
- **The door's eight icons** are each lit by a word in the world's
  announcement. Eight is the most a door carries; a ninth is a new design
  and the owner's; a new word means every announcement signed and published
  again. A second list shows in a door's details and not on the door.

## What the protocol would need (the orchestrator's reading)

1. **Things, declared:** a name, a place, a state, and what can be done
   with each, shaped like the menu's rows, with conditions a client can
   read.
2. **A thing's state shared between visitors, and who decides it.** Today
   nobody does. A button that one visitor presses and that opens a door for
   everyone needs a decider: one device, or a room's server. This is the
   hard part, and shared physics needs the same answer.
3. **Where one can walk, as data:** published, or handed over by the world
   as it runs, the way it hands the menu its rows.
4. **An agent is marked as one, by the kit and not by itself.** It never
   passes for a person, its words are a stranger's words, and it never acts
   as the visitor whose key pays for it.
5. **Who runs it:** to be in a room at all it needs a client of its own.

## For the owner

- **The door.** Whether "agents are welcome here" is on the door at all,
  and where: a line in a door's details (the second list), in place of one
  of the eight, or a door redrawn to carry nine.
- **Whose world decides.** Whether a world must say yes before any agent
  comes in, or only says no.

## The trial, in the playground only

The demo room written as data, then a second room as data alone: the agent
has to work there with no new code. A third room written by someone who has
not seen the engine, from the format's own page. Measured: how many choices
a decision carries and what that costs, how many of a fixed set of orders
are carried out, and which fail for want of a declaration and which for
want of shared state. The format used is a local sketch.

## Must not

- Take a kind, a tag, a capability word or a door icon before the owner
  has placed it.
- Let an agent pass for a person, or act as a visitor.
- Let a world's declaration be trusted for more than what it is: a
  stranger's words about its own things.
