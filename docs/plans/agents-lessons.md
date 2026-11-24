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
  the boat house, D46, D48). Five of six orders with the engine untouched;
  the sixth needed a general change, not one about that room. **A written
  page and a checker were enough for a stranger:** the room passed the check
  as sent. Whatever format is chosen for the kit, a checker that names the
  thing and the field at fault is part of it.
- **A decider shown a list with no fitting choice says "cannot" at once**
  (shown: D48, D53), in about one question. That is cheap and honest, and
  it means a wrong "cannot" is almost always a piece missing from the
  question.
- **The chat model settles what matching words cannot** (shown: D48). With
  it setting the goal, "bring me a buoy" became "pick up the red buoy and
  hand it to the player", and one buoy was fetched. The free rules fetched
  both.
- **Judge by the room, not by the agent** (shown: D51). An order is carried
  out when the room's state afterwards says so, never when the decider says
  "done".

## What a world would have to say of itself

Today a world says who is in it and nothing of what is in it (read:
NSWP-06, NSWP-17; see `docs/backlog/worlds-declare-for-agents.md`).

1. **Its things** (shown: D45): for each a name, a label, a general kind,
   a place, and its state as plain values. **And words that single it out,
   with a word for its kind** (shown: D53): cutting the choices down works
   by matching an order's words to these. A thing with no words can't be
   asked for, and things that share all their words can't be told apart.
2. **What can be done with each** (shown: D45): a name, a label, one
   sentence saying what doing it achieves, and when it is available. Shaped
   like a row of the kit's menu (id, label, kind), which is the nearest
   thing the kit has (read: NSWP-02, `packages/core/src/menu.ts`).
3. **What is not possible yet, and what would make it so** (shown: D48).
   Leaving a choice out because its condition doesn't hold makes the order
   unintelligible ("Play the radio" with the power off). It has to be listed
   as waiting, with the first step.
4. **What opens a shut way, said to the decider** (shown: D48, D53). JEV
   alone carried out 3 of 6 boat house orders. Told what opens the way, the
   three that had failed were run again and all succeeded; all six together
   with the hint were then carried out in each of the tree test's three
   runs.
   - **Shut ways are opened one at a time** (shown: D48). The lifebelt
     needed two, with what opens the second behind the first. The engine
     never plans the chain: it says the next first step at each decision,
     and that was enough.
   - **A condition on the very state a function changes is a guard, not
     something to do first** (shown: D48). "Silence" on a silent radio must
     not start it playing first. A declaration has to let the two be told
     apart.
5. **Said about the thing wanted, not in general** (shown: D53). "A shut
   way can be opened by…" as a standing remark made JEV pull the gate's
   lever when asked to start the drill.
6. **Where a body can go** (shown: D45): walls and doors with what opens
   them, or a map the world keeps current. In the kit today this is a
   function in each world's code and nothing is published (read).
7. **The body's limits**: speed and reach (used by the engine, D45;
   neither was varied or tested).
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
- **The two named presses were enough to offer "Reload" in words; they
  were not enough to offer it sensibly** (shown: the range, D54). The
  range's blaster also had to say how many shots it holds, how fast it
  fires and how long a reload takes. None of those is in the kit's item
  today (read).
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
- **Hand the decider a short list, chosen by the order** (shown: D51, D52,
  D53; three runs, 428 requests, about three cents). This is a step in the
  agent's own running, not something a world writes. The third run, the
  one to go by, in a made-up warehouse of 54 things and the boat house of
  12, six orders each:

  | Room | Way of asking | Orders carried out | Tokens an order | Waiting on JEV an order |
  |---|---|---|---|---|
  | Warehouse | everything offered | 3 of 6 | 11,561 | 673 ms |
  | | cut down by the order | 6 of 6 | 2,782 | 782 ms |
  | | a tree (which thing, then which action) | 6 of 6 | 4,174 | 1,381 ms |
  | Boat house | everything offered | 6 of 6 | 8,551 | 958 ms |
  | | cut down by the order | 6 of 6 | 2,960 | 850 ms |
  | | a tree | 6 of 6 | 4,535 | 1,443 ms |

  **Everything offered does not survive a place of 54 things.** **The list
  cut down by the order did as well as the tree on orders and better on
  tokens, questions and waiting, in both rooms.**
- **A tree was the owner's idea** ("i see JEVs options like a branching
  tree of possibilities"), **tried, and not needed at this size** (shown:
  D53). After the second run it looked like the answer for a long list (6
  of 6 against 5 of 6 in the warehouse). Two mends to the cut-down list,
  below, closed that. The tree stays in the playground's code, off the main
  path. Where it might still win, none of it shown: an order that names
  nothing in particular in a place of hundreds of things, where the cut-down
  list is still long; and play that needs quick choices, where staying at a
  leaf means not asking the wider question again.
- **What made the difference was what each question carries** (shown: D53):
  what the order is about, what is in the way, and what comes first. The
  tree's first form hid a thing behind a shut way by giving it no branch,
  and JEV then never saw it.
- **Cutting down has traps, each met and mended** (shown: D53):
  - A thing that is blocked must still take part in working out what the
    order names. Asked for the black case behind a gate, JEV fetched the
    black crate.
  - Describe only the things the choices are about. A fixed limit on things
    described (24) silently left out the very thing the order named.
  - A hint is tied to the thing wanted. A general "this opens the way",
    true whenever any door was shut, made JEV pull a lever that had nothing
    to do with the order.
  - Between things the order can't tell apart, the agent's own running
    picks the nearest. Asked to choose between two equal buoys, JEV called
    the order unclear.
  - A thing's functions are offered only where the order names the thing
    or needs it first. Every function on every step was a distraction.
- **Cutting down works by matching words, and that has a limit** (reasoned:
  D53). An order that describes a thing without naming it ("the thing that
  makes noise") keeps everything. That case needs the chat model to name
  the thing first, or the whole list.
- **For sizing** (shown: D53): cut down, about 2,800 to 3,000 input tokens
  an order and under 900 a question, one question a step.
- **Looking is offered when it is needed** (shown: D47, D51): it adds seven
  choices and one for each thing to every decision.
- **Eyes as text help where a world has not declared** (shown: D44). A
  32 by 16 text view took "where is it" answers from 0 of 11 to 10 of 11
  for JEV and 6 to 10 for the chat model, for about 350 to 450 tokens a decision (the gap between two moments in
  the owner's own session, not a measurement made for it).
  Where a world can say it outright ("12 degrees right, 8 m, in view") that
  is cheaper (reasoned).
- **Decide when something changes, not on a clock** (shown with the free
  rules deciding, D54: under 70% of a clock's questions for the same
  shooting; not yet shown with JEV). Either way nothing is asked when there
  is nothing to decide, one question is in flight at a time, the world runs
  on meanwhile, and an answer that no longer fits is thrown away and
  counted. In the boat house a question is about
  2,100 tokens with everything offered and about 850 to 880 cut down. At
  the one price reported ($0.042 a million input tokens, through
  OpenRouter), five a second would be about $1.59 an hour with everything
  offered and about $0.67 cut down.
- **Leave the walk out where a use is on offer** (reasoned from D48, not
  tried). JEV walks to a thing before using it, one decision more than
  needed, though every "use" already includes the walking.
- **A world's rules should run without its picture** (shown: D51 to D53).
  The orders ran in rooms with nothing drawn, as fast as the machine
  allowed: 19 to 25 orders three ways took about a minute. For the kit: a
  world's rules separable from its drawing, so agents can be tried.
- **Aiming is the body's, with a person's limits, and the limits are
  stated** (built: the range, D54). The decider says whom to shoot, or
  reload, or wait; code turns at no more than 300 degrees a second and
  fires with a spread (over 95% of shots hit at 6 m, 20 to 75% at 20 m).
  Without stated limits the same code is an aimbot.
- **A world's loop must not depend on its tab being in view** (shown: D54).
  In a pane that was not in view the browser woke the round about once a
  second and the free rules hit 1 of 12; in view, 12 of 12. For an agent
  among visitors: its client can't be a background tab. No timed test is
  run in a pane that is not in view.
- **To be asked on events, a world has to announce them** (reasoned: D54):
  a target coming up, a target dropping, what a shot did, a clip emptying,
  a reload ending. The range's own simulation hands them over; in a world
  today nothing does.
- **The same round for everyone** (built: D54). A round is made from a
  seed, so the owner, the free rules and JEV shoot the very same targets at
  the same times. Any trial that compares an agent with a person needs
  this.
- **Never cut the part of a message that holds the format or the visitor's
  words** (shown: D42). Cutting every message to 2,000 bytes removed both,
  and the model guessed. It bit only with the text view on; without the
  view the report fitted.
  The newest message now has 8,000 bytes of its own; older turns keep
  2,000.
- **Leave a thinking model room to answer** (shown: D44, the second eyes
  run): with 512 tokens allowed it spent them all thinking and said
  nothing. The default is now 1,500.
- **Nothing is asked while nobody is interacting** (shown: D43): JEV is
  asked only when an order waits on its next step, and the chat model
  checks in only while an order is being carried out.

## What is public about JEV (the playground's D55, from TypeSafe's own pages; not checked by the orchestrator)

- **It plays from text that says the state, not from the screen.** Its
  Doom demo makes about ten decisions a second, at about seven dollars an
  hour of play by TypeSafe's own figure. TypeSafe says a scripted bot would
  play better, and no score is published. No page gives the state's fields
  or the list of actions.
- **Its price** is $0.042 a million input tokens, which is what our own
  runs worked out.
- **One request can carry several questions,** answered at once and blind
  to each other. Our contract asks one. Asking "whom" and "fire now?"
  together is worth having before a port (reasoned).
- **Kinds of question:** a choice, a score, a yes or no, and one that finds
  a thing in a picture (new, marked early). The last is a second kind of
  eyes, and bears on whether looking can stand in for a declaration.
- **Over about 32,000 bytes of text, or with any picture, a request runs in
  a slower and less accurate way.** The largest text view (128 by 128) with
  a room's state comes near it: keep a question well under.
- **Its Pong demo is built as the range is:** the world runs on, the latest
  answer that fits steers for a short while, late answers are dropped, and
  code works out the hard number and hands it over.

## What the protocol would have to settle

- **Who decides a thing's state for everyone in a room** (read and
  reasoned). Nobody does today. Every order that changes a thing would fail
  for want of it with two visitors; the playground cannot show this, having
  one tab. Shared physics needs the same answer.
- **An agent is a visitor with a key and a client of its own** (read): it
  can already come in as a guest or by a pass it signs. A room holds eight.
- **An agent is marked as one, by the kit** (reasoned), never passes for a
  person, and never acts as the visitor who pays for it. **Its body's
  limits are published with it** (reasoned: D54): a person can see that a
  shooter is an agent, and its hit rate and how fast it reacts sit near a
  person's.
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
  152). TypeSafe's own address refuses calls from a browser (shown: D19),
  so an agent in a browser alone reaches JEV by OpenRouter or by whatever
  makes the call for it. The playground has since dropped TypeSafe's own
  address at the owner's ask (D49).
- **Consent to spend or to send speech out is the visitor's own line**; a
  script never writes it on a reading of their words (a rule set on
  the evening of 2026-11-23 local time, the 24th by UTC, after three such
  lines were written).
- **Tests must not be able to reach a real service** (shown: one did, with
  a made-up key). The playground's tests now refuse every request that is
  not to this machine.
- **Show the cost as it runs** (built: D43, D50), by service and by use.

## Talking by voice

- The kit's own way (hold, speak, release; Whisper on the visitor's
  computer) takes about 2 s for a short order on this machine when busy,
  and `base.en` misheard some words of clips made from text ("malt door"
  for "vault door"); `small` heard them right and took 8 to 18 s (shown:
  commit 0d6ab91). A remote service (ElevenLabs) took 240 to 521 ms a
  phrase over about nine phrases in the owner's first two sessions (from
  his session logs, not a run made for it).
- **A recording under 0.3 s is not sent** (shown: D42): a tap on the speak
  control made an empty recording and an error from the service.
- **When changing a setting switches a service off, say so** (shown: D42).
  The owner ticked "share memories", which switched the chat model off
  until it was applied again, and read it as the app breaking.
- The owner's direction: tech that can live in the browser session, with a
  remote service for voice to text. In BitPortal the key for it stays at
  the sign-in address.
- Speaking the answer aloud is built in the playground only.

## Not yet known

- Play that needs quick choices: the shooting range is built (D54) and has
  not yet been shot by JEV or by the owner. With the free rules deciding,
  in view: 12 of 12 hostile and no friendly hit, 22 shots, 417 ms from a
  target coming up to the first shot.
- **Whether a tree has another use than the one tried.** The owner,
  2026-11-24, after the third run: "Maybe there is another application for
  the tree method we don't quite understand yet?" What was tried is one
  reading only: two questions for each decision, which thing and then which
  action. Not tried:
  - a tree as where the agent is, not how it is asked: it stays at a leaf
    (fire, reload, move) and is asked the wider question only when
    something changes (the shooting range);
  - a tree of goals over time: an order broken into steps by the chat
    model, each step carried out by JEV;
  - a tree searched in code, not asked of JEV: since effects are data, the
    engine could look several steps ahead where today it looks one, for
    things that need two conditions or a key and a tool;
  - an order that names nothing ("tidy up"), where there are no words to
    cut the list down by;
  - choosing among worlds and doors, which are a tree already.
- How often a rare failure happens: in the three runs above each order was
  tried once for each way of asking.
- Whether looking can stand in for a declaration a world has not made (an
  experiment set out and not run).
- More than one visitor; a real kit world; a world of hundreds of things in
  several areas.
- Orders with no single right answer.

## Kept current

After each experiment the playground's session sends its lessons in these
terms, and the orchestrator adds them here the same day.
