# Skills an agent learns, that anyone can publish

- **Asked:** 2026-11-24, by the owner, to the `nswp-agents` session, which
  passed his words on: "I wonder if we should structure all abilities like a
  skill that can be learned by an agent and used in the right situation if
  the right items are available. Like a gun." Then: "Yes all skills please".
  And on where skills live: "Should skills be housed in the bitportal repo?
  Or can anyone host a skill and enable any agent to use them? I'd use Nostr
  but I'm worried about reliability", "I'd like for anyone to be able to
  publish a skill", and "I do have an app called Tessera. It's a Bitblock
  app used for publishing plugins and skills that actually might be perfect
  for this."
- **Who:** the `nswp-agents` session, in its playground (the shape of a
  skill: built). Then a written design: the kit and the protocol (what a
  world and an item say), Tessera (publishing; the owner's own app, not
  briefed), BitLogin (where an agent's learned skills are kept).
- **State:** the shape is built and shown in the playground. Publishing is
  asked for and not designed; nothing has been published anywhere. Part of
  `ai-keys-and-agents`, which is last and not a priority.

## What is built (the playground, 31f6ac4 and 4f0ea01; see `docs/plans/agents-lessons.md`)

Every ability is a skill with four parts: what it needs, what it offers the
decider now, the one checked action each choice is carried out by, and what
wakes the decider. Seven of them, and all seven fit. Shooting is a file of
data that a stranger could write: it may name only actions the world
already checks, and it may not make an agent speak, walk it freely, or make
itself impossible to unlearn.

**Three separate gates, belonging to three parties:** the agent (what it
has learned), the world (what it allows), and what is there (things and
held items).

## For a design to settle

- **Where a skill is published and how it is fetched.** The owner's
  Tessera, as read by the playground's session from its help text and not
  tried: a signed pointer, an archive whose hash is in the signed release
  and is checked when it is fetched, versions that can't be replaced, a set
  pinned by version and hash. That answers the worry about relays: they are
  needed to find a skill, not to use one already fetched and pinned.
- **Where Tessera doesn't fit yet:** its skills are instructions for a
  coding agent, and what it says of a skill's trust says nothing of what a
  skill may do in a world. The check that matters here (which actions a
  file may name) lives in the agent's own running, and should show wherever
  a skill is listed.
- **A skill's words are a stranger's words.** Part of a skill is advice in
  words, and it goes into the decider's question. A skill can't do what a
  world forbids, but its words can make an agent choose badly among what is
  allowed. So: bounded in length; shown whole to the agent's owner when the
  skill is learned, which is his deliberate act; given to the decider with
  the choices they belong to and never to the chat model beside memory and
  personality; never naming a visitor, a key or an address. How large the
  risk is, was measured on the range (D60, 2026-11-24): two well-formed
  sentences took four fifths of the score, and advice against the goal got
  a friendly target shot once in three, mark and all. So what a world
  never wants is not offered as a choice, and learning is the gate.
- **What a world says:** the skills it allows, or calls for, as a pinned
  set it may carry copies of. This could be what a door's details show.
- **What an item says:** nothing new to name its skill. Shooting finds its
  item by what the item already declares (a first press, and something it
  sends). What an item doesn't say today and a skill needs: how many it
  holds, how fast it fires, how long a reload takes.
- **The names of the values a place gives a skill** (what is held, the kind
  of target, where) are the real contract, and so far are only what the
  range happened to need. This is the piece that needs designing.
- **An order among skills from several places,** stated, or a decider sees
  lists that shift.
- **Where an agent's learned skills are kept:** with its sheet. Not
  designed; in the playground they are ticks in the tab.

## How many skills, and whether they need sorting (asked 2026-11-24)

The owner, after the range that fires back: "it seems like JEV is somewhat
generalizeable with these skill choices. It will be interesting to see how
many skills we can add while keeping them all usful. Here is where that
branching tree thing might become worth using. Skill catagories. and sub
catagories"

Not tried. What is known that bears on it (`docs/plans/agents-lessons.md`):

- With seven skills and a room's worth of things, one list cut down in code
  beat a tree of two questions: 2,782 tokens an order against 4,174, for
  the same answers. The tree lost because it asks twice.
- Most of the cutting down is free and needs no decider: a skill offers
  nothing unless it is learned, allowed here and has what it needs (the
  three gates). So the number that matters is not how many skills an agent
  knows, but how many offer something at the same moment.
- A second skill on the range needed no new code.

So the trial is a count. Its shape, as sharpened by the `nswp-agents`
session the same day and agreed by the orchestrator:

- **Count choices live at once, and say skills known beside it.** Grow the
  live set with skills that all offer something in the same moment, real
  ones and near-misses. Where to look: at about 150 choices at once JEV
  carried out 3 of 6 orders (the warehouse, one list, D53), and a choice
  costs about 25 tokens, so the line past which JEV runs slower is near 450
  choices. Accuracy fell long before it. The crossing is expected between
  50 and 150 choices live at once: sample there finely.
- **Four ways of asking, each at least twice, three times near the
  crossing** (a decider's spread from run to run was 11 to 16 of 29 on the
  range): one list; category first, then the choice; the category chosen
  in code from what the place says, and only the choice asked; and both
  levels in one request, which costs no second wait. The house trial's
  "needs as scores" way of asking is the last of these already (need is
  the category, thing is the choice), so its paid run is the first data.
- **Tasks with a right answer that code can check,** a known best choice
  with near-miss skills beside it. Otherwise "stops giving right answers"
  is judged by eye.
- **Where categories can pay at all:** where code has nothing to cut by.
  For an order in words, cutting down in code already beat asking a
  category first (6 of 6 both ways, the tree at one and a half times the
  tokens and twice the waiting). With no order, or one that names nothing,
  as in the house and the mystery, there is nothing to cut by.

**A category a world acts on is worked out, not claimed.** A skill's
choices name typed actions, and each action already belongs to a
capability the kit has (firing to combat, picking up to inventory). So the
first level of a tree can be those capabilities, derived from the actions
a file names and never from a label in it; "a world allows by category" is
then what a world already does when it offers or withholds a capability.
Anything finer is a stranger's claim, like a skill's advice: shown to the
owner, never trusted for allowing. (No capability name is given or taken
by this being written here.)

After the house trial. The arithmetic of sizes is free and can be done at
any time.

## Must not

- Let a published skill carry code. Data only, naming only actions a world
  already checks.
- Let a skill make an agent speak, or act as a visitor.
- Publish anything to Tessera or to relays without the owner's own word.
