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

- **The door: decided, 2026-11-24.** Asked where "agents are welcome here"
  should show for a world, in a door's details or on the door itself, the
  owner said: "In door details". So it is a line in a door's details, with
  tips and looks, and the door keeps its eight. It may move to the door
  later, which would be the owner's again. The word a world's announcement
  says for it is not given yet: it is given with the design, and a new word
  means every announcement signed and published again.
- **Whose world decides.** Whether a world must say yes before any agent
  comes in, or only says no.

## The trial, in the playground only

The demo room written as data, then a second room as data alone: the agent
has to work there with no new code. A third room written by someone who has
not seen the engine, from the format's own page. Measured: how many choices
a decision carries and what that costs, how many of a fixed set of orders
are carried out, and which fail for want of a declaration and which for
want of shared state. The format used is a local sketch.

## What the trial showed (2026-11-24; `nswp-agents`, branch `agents/playground`, 0bf813c)

Three rooms as data: the session's own vault room, its greenhouse, and a
boat house the orchestrator wrote from the format's page alone, without
seeing the engine. One engine, which names nothing from any of them.

- **A room by someone else loaded with no mistakes and worked.** With the
  engine untouched and the free rules deciding, five of the boat house's six
  orders were carried out, among them "Bring me the lifebelt": two shut ways
  in a row, the opener of the second behind the first.
- **Two general changes to the engine were needed, and each is a thing a
  world has to be able to say:**
  1. **Not possible yet, and what would make it so.** A function whose
     condition doesn't hold was not offered at all, so "Play the radio" with
     the power off was not understood. It is now listed as not yet possible,
     with what to do first.
  2. **The decider has to be told what opens a shut way.** JEV alone carried
     out three of the six: a choice that is blocked was simply not on its
     list, and it does not plan through a shut door by itself. Told, in the
     opening function's own sentence, what opens the way, it carried out all
     six. "Bring me the lifebelt" took six decisions.
- **That link was worked out, not written:** from a door's condition and a
  function's effect naming the same state. It can be worked out only because
  effects are data. In the kit today what a press does is a script, so a
  world would have to say it.
- **What the format could not say,** found by writing the boat house: a
  condition on what is carried or where a thing is (a key, a tool: the
  largest gap); two conditions at once; one thing following another by
  itself; who may do a thing; amounts; a door named in an order.
- **Cost:** about 2,100 input tokens a decision in the boat house with the
  text view off (twelve things, their functions, and the choices for
  looking). At the one price reported so far (OpenRouter, about $0.04 a
  million input tokens) deciding five times a second would be over a dollar
  an hour, so a short list is worth money as well as time.
- **Not shown:** anything with more than one visitor (the room lives in one
  browser tab, so nothing could fail for want of shared state; every order
  that changes a thing would); a world with hundreds of things; a real kit
  world.

**Next, as the owner and both sessions see it:** a shooting range, to try
play that needs quick choices. The thinking so far: a small fixed set of
controls every world shares (move, look, a held item's two presses), a goal
that decides which choices are offered, a decision asked for when something
changes and not on a clock, and aiming done by the body with a person's
limits so it is not an aimbot.

## What has been learned, kept in one place

`docs/plans/agents-lessons.md`: each lesson from the playground, said as
what would have to change in a world, an item, the kit or the protocol.
Asked for by the owner on 2026-11-24 and kept current by the orchestrator.

## Must not

- Take a kind, a tag, a capability word or a door icon before the owner
  has placed it.
- Let an agent pass for a person, or act as a visitor.
- Let a world's declaration be trusted for more than what it is: a
  stranger's words about its own things.
