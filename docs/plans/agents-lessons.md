# Agents: what the playground has taught us, for the port to BitPortal

**What this is.** A running record of what has been learned in the
`nswp-agents` playground about agents that decide with JEV, written as what
would have to change in our worlds, items, kit and protocol. Kept by the
orchestrator; the playground's session sends each lesson as it is found, and
its own record (its decisions, numbered D1 onward, in that repository) has
the detail and the runs.

**Asked for:** 2026-11-24. The owner: "Make sure we are documenting all of
the lessons we are learning about this JEV process. So when we port to
bitportal we have a good idea of what changes we need to make to our worlds,
items and kit".

**How to read it.** Each lesson says what was seen and how sure it is:

- **shown**: measured in the playground, with the run named;
- **read**: read from the kit's code, not run;
- **reasoned**: follows from the two above, not tried.

Nothing here is decided, and no kind, tag, field or door word is taken by
being written here. The playground's rooms live in one browser tab with the
owner's own keys; a world in BitPortal is other people's code with several
visitors in it. Everything below was learned in the first and is meant for
the second.

## The shape that works

- **Three parts, each doing one thing** (shown). A quick decider (JEV) picks
  one choice from a short list. Plain code reads what the room declares and
  works out what is possible, what is in the way and what comes first. A
  chat model talks and sets the goal. No part is asked to do another's work.
- **JEV does not plan** (shown: D48). Given a shut way and nothing said
  about it, it answered "cannot". It cannot reason about a thing that is
  absent from the question. Whatever it needs has to be in the question.
- **A room written by someone who had not seen the engine worked** (shown:
  the boat house, D48). Five of six orders with the engine untouched; the
  sixth needed a general change, not one about that room.
- **Judge by the room, not by the agent** (shown: D51). An order is carried
  out when the room's state afterwards says so, never when the decider says
  "done".

## What a world would have to say of itself

Today a world says who is in it and nothing of what is in it (read:
NSWP-06, NSWP-17; see `docs/backlog/worlds-declare-for-agents.md`).

1. **Its things** (shown: D45): for each a name, a label, a general kind,
   a place, and its state as plain values.
2. **What can be done with each** (shown: D45): a name, a label, one
   sentence saying what doing it achieves, and when it is available. Shaped
   like a row of the kit's menu (id, label, kind), which is the nearest
   thing the kit has (read: NSWP-02, `packages/core/src/menu.ts`).
3. **What is not possible yet, and what would make it so** (shown: D48).
   Leaving a choice out because its condition doesn't hold makes the order
   unintelligible ("Play the radio" with the power off). It has to be listed
   as waiting, with the first step.
4. **What opens a shut way, said to the decider** (shown: D48). JEV alone
   carried out 3 of 6 boat house orders; told what opens the way, 6 of 6.
5. **Said about the thing wanted, not in general** (shown: D53). "A shut
   way can be opened by…" as a standing remark made JEV pull the gate's
   lever when asked to start the drill.
6. **Where a body can go** (shown: D45): walls and doors with what opens
   them, or a map the world keeps current. In the kit today this is a
   function in each world's code and nothing is published (read).
7. **The body's limits**: speed and reach (shown: D45).
8. **A name on each thing that can be seen**, so that eyes can say what
   they see (shown: D44, D45).

**Effects have to be data, or the world has to say the link itself**
(shown and read). The engine works out "the lever first" by matching a
function's effect to a door's condition. That is possible only because the
playground's effects are data. In the kit what a press does is a script, so
a world would have to state what leads to what.

**What the playground's format could not say** (shown, by writing the boat
house): a condition on what is carried or where a thing is (a key, a tool;
the largest gap); two conditions at once; one thing following another by
itself; who may do a thing; amounts; a door named in an order.

**Two flaws found and left** (shown: D48): a thing sent to the visitor
passes through walls; an agent on the wrong side of a door that shuts is
shut in.

## What an item would have to say

- An item already names up to two presses (`does use`, `does second`: the
  dart blaster's "Fire" and "Reload") and what it sends out (read). That is
  the start of a declaration and the shape to keep.
- What a press does is the item's script (read). For an agent to use an
  item sensibly, the item needs a sentence for each press and when it is
  possible (reasoned from 2 and 3 above).
- `sittable`, `touchable`, `readable` and `wearable` are read from an item
  and nothing acts on them (read). They are the natural home for what an
  item is for.
- Picking up, putting down and giving do not exist in a world (read). The
  playground's agent does all three; a world's can't until
  `items-given-and-won` or a placed-things format exists.

## What the kit would have to do

- **Make declaring the same act as building** (reasoned). Nobody will write
  a second description of their world for agents. A button made with the
  kit's helper should be declared by being made, and people should gain
  from the same declaration (a "use" prompt, the menu, a screen reader).
- **Hand the decider a short list, chosen by the order** (shown: D51, D53).
  With every choice offered, a room of 54 things (about 150 choices) had 3
  of 6 orders carried out. Cut down by what the order names: 5 of 6. As a
  tree (which thing, then which action): 6 of 6, at a third of the tokens
  and twice the waiting. In a room of 12 things the cut-down flat list was
  best on every count. The rule to try: flat when the list is short, a
  dozen or so; a tree above that.
- **Every question carries what the order is about, what is in the way,
  and what comes first** (shown: D53). The tree's first form hid a thing
  behind a shut way by giving it no branch; JEV then never saw it.
- **Cutting down has traps** (shown: D53). A thing that is blocked must
  still take part in working out what the order names (asked for the black
  case behind a gate, JEV fetched the black crate). A limit on how many
  things are described must not drop the one the order is about. Where the
  order can't tell two things apart, offer the nearest.
- **Looking is offered when it is needed** (shown: D47, D51): it adds seven
  choices and one for each thing to every decision.
- **Eyes as text help where a world has not declared** (shown: D44). A
  32 by 16 text view took "where is it" answers from 0 of 11 to 10 of 11
  for JEV and 6 to 10 for the chat model, for about 450 tokens a decision.
  Where a world can say it outright ("12 degrees right, 8 m, in view") that
  is cheaper (reasoned).
- **Decide when something changes, not on a clock** (reasoned; to be
  measured on the shooting range). A decision is about 2,100 tokens in the
  boat house; five a second would be over a dollar an hour at the one price
  reported.
- **Aiming is the body's, with a person's limits** (reasoned; the range):
  the decider chooses whom and when; code turns; a capped turn rate and
  some error, so it is not an aimbot among visitors.
- **Never cut the part of a message that holds the format or the visitor's
  words** (shown: D42). Cutting every message to 2,000 bytes removed both,
  and the model guessed.
- **Leave a thinking model room to answer** (shown: D44, D46): with too
  small an allowance it spent it all thinking and said nothing.
- **Nothing is asked while nobody is interacting** (shown): JEV is asked
  only when an order waits on its next step.

## What the protocol would have to settle

- **Who decides a thing's state for everyone in a room** (read and
  reasoned). Nobody does today. Every order that changes a thing would fail
  for want of it with two visitors; the playground cannot show this, having
  one tab. Shared physics needs the same answer.
- **An agent is a visitor with a key and a client of its own** (read): it
  can already come in as a guest or by a pass it signs. A room holds eight.
- **An agent is marked as one, by the kit** (reasoned), never passes for a
  person, and never acts as the visitor who pays for it.
- **Whether a world takes agents** is a line in a door's details (the
  owner, 2026-11-24: "In door details"). The word is not given.

## Keys, money and what leaves the device

- **A provider's key never reaches a world's page or a session** (the
  design's first rule; the playground ended at the same shape: its local
  server adds the key, and the page holds none).
- **The playground's local relays and its `.env` are not the shape that
  ships.** In BitPortal the page asks BitLogin, and BitLogin (or, for the
  subscription, BitUnlock) makes the call.
- **JEV by OpenRouter's route gives the same decisions as TypeSafe's own**
  (shown: D41, 36 of 36), about 130 ms slower at the middle (282 ms against
  152). TypeSafe's own address refuses calls from a browser.
- **Consent to spend or to send speech out is the visitor's own line**; a
  script never writes it on a reading of their words (a rule set
  2026-11-24 after three such lines were written).
- **Tests must not be able to reach a real service** (shown: one did, with
  a made-up key). The playground's tests now refuse every request that is
  not to this machine.
- **Show the cost as it runs** (built: D43, D50), by service and by use.

## Talking by voice

- The kit's own way (hold, speak, release; Whisper on the visitor's
  computer) takes about 2 s for a short order on this machine when busy,
  and misheard some words (shown: commit 0d6ab91). A remote service
  (ElevenLabs) took 285 to 458 ms a phrase (shown: D42).
- The owner's direction: tech that can live in the browser session, with a
  remote service for voice to text. In BitPortal the key for it stays at
  the sign-in address.
- Speaking the answer aloud is built in the playground only.

## Not yet known

- Play that needs quick choices (the shooting range, next).
- Whether looking can stand in for a declaration a world has not made (an
  experiment set out and not run).
- More than one visitor; a real kit world; a world of hundreds of things in
  several areas.
- Orders with no single right answer.

## Kept current

After each experiment the playground's session sends its lessons in these
terms, and the orchestrator adds them here the same day.
