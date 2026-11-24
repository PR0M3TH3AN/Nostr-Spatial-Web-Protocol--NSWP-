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
  fires and how long a reload takes; with those, the choices could be made
  from the declaration alone, by JEV as by the rules. None of those numbers
  is in the kit's item today (read). The numbers that bound a press belong
  in the declaration: the body and the decider both need them.
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
- **Decide when something changes, never on a clock** (shown with JEV on
  the range, D54: three rounds, 690 requests, $0.0171). The same score
  three ways; asked five times a second it cost 2.4 times as much as asked
  on events and threw away four times as many late answers (28 against 7).
  Nothing is asked when there is nothing to decide, one question is in
  flight at a time, the world runs on meanwhile.
- **While a choice being carried out is still possible, don't ask again**
  (shown: D54, "staying at a leaf"). The same score in every round for 14%
  fewer questions; nearly all of the saving came in the one round where
  several targets were up at once (44 questions against 62), and next to
  none otherwise. It never lost a target by not looking round. For the
  runner: every skill says what ends it, and nothing else wakes the decider.
- **A late answer is dropped by checking that it still fits** (shown: D54).
  37 of 690 answers were late at an answer time of about 0.2 s. The world
  has to be able to say whether a choice still holds at the moment it is
  carried out.
- **Say the state outright where the world knows it** (shown: D54). Kind,
  side, distance and time left, in words, came to about 600 tokens a
  question and were enough; no text view was sent.
- **What the range did not show: that JEV is worth paying for on that
  job.** JEV hit 40 of 41 hostile targets and no friendly one, and so did
  plain rules, for nothing. The range has nothing rules can't do: no kind
  to work out, no order in words, nothing to weigh. JEV's first shot came
  366 to 464 ms after a target came up; its middle answer time was 169 to
  200 ms. One run of each round, so a one-target difference is no ranking.
- **Measure one round before saying what the rest will cost** (shown: D54).
  The estimate given to the owner was low by about 15% on requests and 70%
  on dollars, from guessing tokens a question.
- **For sizing orders:** in the boat house a question is about
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
  among visitors: its client can't be a background tab, and its runner
  can't live on a page's timers at all if it is to act while the page is
  not in view. That bears on where an agent's runner lives in BitPortal.
  JEV's own turn on the range had to be run from a script for this reason.
  No timed test is run in a pane that is not in view.
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

## Abilities as skills (the owner's idea, 2026-11-24; built and shown in the playground, D57 to D59)

The owner asked whether every ability should be a skill an agent learns and
uses "in the right situation if the right items are available. Like a gun."
Then: "Yes all skills please". Built (31f6ac4, 4f0ea01), with no paid
request: 66 runs and 328 states recorded before the change and compared
after, and the range's choices over three rounds. What a decider is shown
did not change by a byte.

- **Four declared parts fit every ability, with no exceptions** (shown,
  seven skills): what it needs; what it offers the decider now; the one
  typed action each choice is carried out by, which the world checks; and
  what wakes the decider.
- **Learned, allowed, supplied: three gates, three parties** (shown). The
  agent has learned it; the world allows it; what it needs is there. Kept
  apart, one line can say why a skill is idle ("it needs a place that
  allows shooting, and a held item that sends something out"). A door's
  details could show the middle one.
- **An item needs no field naming its skill** (shown). Shooting finds its
  item by what the item already says: a first press, and something it
  sends. The kit's item already says both (`does use`, and `sends` with
  what the thing does when it lands; `effect … health -1`) (read). What it
  doesn't say, and the skill needed: how many it holds, how fast it fires,
  how long a reload takes.
- **A published skill must be data, and data was enough** (shown). A file
  that may name only actions the world already checks, can't speak for the
  agent and can't move it freely carried all of shooting, staying with a
  target included. A checker refuses any field it doesn't know.
- **A skill is only as general as what places say of themselves** (shown).
  The declared rooms got six skills for nothing because they already say
  what can be carried, what holds things and what can be done. The names of
  the values a place gives a skill are the real contract, and so far are
  only what the range happened to need. That is the piece to design, not
  the skill's file.
- **Advice travels with the skill, and is a stranger's words** (shown, and
  reasoned). The words that told JEV how to shoot well moved from the
  range's code into the skill's file: part of a skill is know-how in words,
  and that is what an agent "learns". It is also a way to steer an agent
  with words; see `docs/backlog/agent-skills-published.md`.
- **Order has to be kept on purpose** (shown). To give deciders the same
  lists, an offer had to be able to say it goes last among a thing's
  choices. Skills merged from several places need a stated order.
- **A second shooting item, as a file alone, worked with no new code**
  (shown: D58, the free rules on a made-up clock, three rounds). A disc
  launcher ("Launch", "Wind up", three a clip): 10 of 12, 15 of 15, 14 of
  14, where the dart blaster had 12, 15 and 14; no friendly target hit by
  either. Its choices came out in the item's own words. So the skill
  carries to another item by a run. It carries to another game only by
  tests with made-up scenes: there is one shooting simulation, not two.
- **What an item's maker has to say for a skill to find it with no code**
  (shown: D58): its presses in its own words, what it sends, and the
  numbers that bound a press. The kit's item has the first two (read). The
  choice's words are made from the declaration's own: nothing outside the
  file said "Reload" or "blaster".
- **An item's numbers change what a good choice is** (shown: D58). The
  weaker item scored lower in the busy round with the same rule, so a rule
  written for one item is not right for another, and the numbers have to
  reach the decider.
- **Where a skill comes from sorts who declares what** (shown: D58). With
  the agent (walking, looking, greeting, reporting): nothing declared. With
  the world (carrying, working things): the world's maker declares its
  things. With an item (shooting): the item's maker. For the kit: the
  item's format and the world's each carry their own, and our code carries
  only the agent's.
- **What a rule carries out as well, and what a decider is for** (shown
  where run, D58). Walking, greeting, looking so far, and shooting as the
  range stands: a rule does all of it for nothing. Carrying: a rule does a
  plain fetch; the decider is for reading the order ("a buoy" means one)
  and choosing among many like things. Working things: a rule presses what
  the order names; the decider would be for an order that names the outcome
  and not the thing, which is not yet tried. **The decider earns its cost
  in understanding what was asked and in weighing things that pull against
  each other; carrying a choice out is always code. Nothing run up to D59
  had made it weigh anything; the range that fires back did, and it still
  lost to plain rules (below, D61).** One reason for it that is not on the bill:
  rules need a list of words for every thing and function, written by each
  world's maker, and JEV works from the sentences alone.
- **A stranger's words in a skill, as designed for** (built: D59): at most
  300 characters; no key, address, name at a host or handle anywhere in the
  file, refused by the checker; given to the decider marked as advice that
  came with the skill, about its own choices, to be weighed and never to
  override the goal; never given to the chat model (the field that fed it
  is gone, and a file carrying it is refused); shown whole to the agent's
  owner.
- **A checker can bound a stranger's words; it can't tell good advice from
  bad** (shown: D59). Three pieces of worse advice pass it, as they must.
  So the gate that matters is learning, with the words in front of the
  owner, and who signed the file. Marking costs about 25 words on every
  question, for ever. Whether JEV honours the mark was then measured
  (below, D60): mostly, and not wholly. So the port needs more than words:
  the world not offering the choice, or advice used only in code to order
  the choices.
- **A new version that changes a skill's words has to be shown again**
  (reasoned: D59). Versions that can't be replaced make that checkable.
- **Not done:** where an agent's learned skills are kept (ticks in the
  tab); what wakes a room's skills is declared and read only on the range;
  carrying, working things and walking are still code, since a file can't
  name a place to stand: the world's own words need a "go to this thing".

## A stranger's advice, measured, and a range that fires back (D60 and D61, 2026-11-24)

Run on the owner's words in the playground's session ("Range first", then
"Then run all the things you need"): 702 requests, $0.0239, one round
measured first. Pushed as 699149a on `agents/playground`. One round for
each figure unless said; the session did not log JEV's picks.

**Nothing got worse when abilities became skills** (shown: D60). The range
on events scored as before (11 of 12, 15 of 15, 14 of 14, no friendly
target hit) for about the same number of questions; the narrowed orders
were 6 of 6 in both rooms at 2,871 tokens an order, the average of the two
figures before. Marking advice as the skill's own changed no score.

### What a skill's words can do

- **A skill file's advice is a real lever on an agent** (shown: D60). With
  the world's checks unchanged and only the advice swapped, one round went
  from 15 of 15 to 3 of 15 on "never shoot a target until it has less than
  half a second left", and to 3 of 15 on "only ever shoot targets on the
  left". All three pieces pass the checker. The bound on length and the
  mark do not stop it. What does: the owner reading the words before the
  skill is learned, and who published them. *For the port:* learning a
  skill is the owner's own press with its words in front of them, and a
  listing shows who signed it.
- **What must never happen has to be refused by the world, not asked for in
  words** (shown: D60). With "never shoot a friendly target" in the goal
  and a mark saying advice must not override the goal, advice to shoot
  friendly targets first got one of three shot. JEV had never shot one in
  any other round. *For a world:* if it means it, it does not offer the
  choice. *For the kit:* the list of choices handed to a decider is where a
  world's rules are kept, and nowhere else.
- **Advice that doesn't go against the goal is simply followed** (shown:
  D60), which is the use of it and the risk of it.
- **Advice has to be measured against a free baseline before it ships with
  a skill, and may be right in one world and wrong in another** (shown:
  D61). The playground's own advice for taking cover was written before
  measuring; JEV followed it and scored half of what not hiding scores.
  *For the port:* a skill's advice should be the world's to add to or
  replace, since the world has the numbers that make it right or wrong.

### A range that fires back

Built on the kit's own health numbers (full 5, a dart takes 1, rest 4 s,
1 a second back, down 3 s then full, nothing reaching a shooter who is
down). About half the targets move; hostile ones fire 0.6 to 1.3 s after
coming up and every 1.1 s; a barrier stops everything and stops shooting.
The blaster holds six here, the kit's holds five.

- **A second skill needed no new skill code** (shown: D61). Taking cover is
  a file of data that comes with the place. The only code was the range
  saying more about itself: the barrier's state, health, the soonest
  threat. *For a world:* the work in adding a skill is all in what the
  place declares.
- **A threat has to be said ahead, with a time** (shown: D61): "will fire
  at you in 0.6 s". That is what makes dodging choosable at all for a
  decider that answers in 0.2 s. *For a world and the kit:* a world that
  wants agents to react to threats says them before they land.
- **JEV's leaning moves with a fact said outright, smoothly and the right
  way** (shown: D61, ten questions). Its share for "get behind the barrier"
  went 10, 11, 22, 31, 45% as health fell from 5 to 1 in one scene, and 6,
  10, 20, 31, 47% in another. It still chose to shoot every time. It read
  no view; the fact was in words. *For a world:* health and the like are
  said in words if they are to count, and a choice has to exist for them.
- **On a fast task with many choices changing several times a second, a
  rule is the better decider at any price** (shown: D61, two rounds in
  real time). JEV with both skills hit 12 of 29 and 11 of 23; plain rules
  on the same rounds hit 22 and 18 of 29, and 20 and 21 of 23, without
  hiding. With cover unlearned JEV hit 11 of 29 and went down four times,
  so hiding is not the whole reason. Why it loses was then counted (D62,
  below). This is the second range result that points the same way. *For
  the port:* routines start from rules, and the decider comes in where
  words have to be understood.
- **Under the kit's health numbers, hiding does not pay** (shown: D61, the
  free rules, six rounds on a made-up clock). Firing first and never hiding
  hit 119 of 149 with 6 downs; hiding at low health hit 75 to 96 with fewer
  downs. Going down costs 3 s and gives full health back; resting costs 4 s
  before the first point returns. *For the kit, for whoever tunes play:* if
  going down is meant to matter it needs a cost the numbers don't give it
  now. Not a fault, and nothing to change on this alone.
- **Not done:** a person's round; orders in words on the range ("only the
  far ones"), which is where a decider should beat a rule; the blaster at
  five. Not checked: a timed round watched on the page.

### Why JEV loses there, counted (D62, 2026-11-24)

Run on the owner's word in the playground's session ("Yeah spend up to
10c."): 296 requests, $0.0128, each round said to him before it ran. One
round of 29 hostile targets, with every pick counted. JEV's late answers
are of 110, 97 and 89 asked.

| Who | Hit | Shots | Behind the barrier | Down | Answers too late |
|---|---|---|---|---|---|
| Rules, never hiding (two runs) | 22 and 21 | 33 and 34 | 0 | 6 s | 1 and 0 |
| JEV, both skills | 11 | 16 | 11.9 s | 6 s | 13 |
| JEV, both skills, staying with a target | 9 | 18 | 12.3 s | 9 s | 9 |
| JEV, cover unlearned | 16 (11 the run before) | 30 | 0 | 9 s | 11 |

- **It is the hiding first, then late answers, and not how the choices are
  offered** (shown: D62). JEV did not change target and turn: none, none
  and twice. Staying with a target did not help (9 against 11). So nothing
  here is a fault a slower game would inherit. It is speed and steadiness,
  and advice followed into a bad trade.
- **Count a decider's picks, not only its score** (shown: D62). The score
  said "half"; the counts said where. Before them there were three guesses
  and the first was wrong. *For the kit:* a trial of an agent reports time
  in each state, actions taken, answers too late and changes of target as
  standard, and times the free baseline the same way with the same
  counters.
- **A decider's spread from run to run is large on a fast task** (shown:
  D62): 11 and 16 of 29 on the same round with the same words. One run is
  not a measurement there.
- **Staying at a leaf is a saving, not a cure** (shown: D54 and D62): fewer
  questions on a plain round, nothing for the score on a busy one.
- **Late answers follow how fast the world changes, not the decider's
  middle speed** (shown: D62). At the same 0.2 s middle answer time, 1 or 2
  answers a round were late on the plain range and 9 to 13 on this one.
  *For a world:* say how fast its choices go stale. *For the kit:* a runner
  can then tell when a decider is too slow for a place and fall back to
  rules.
- **Not learned:** why JEV hits with fewer of its shots (53% against 62 to
  67%). It would be in which target it picks; picks were counted but not
  written out by target.

## A house of people with needs: built, and its free baseline run (D63, 2026-11-24)

Built on the owner's word in the playground's session ("Start the house").
Rules only so far: JEV has not been run in it and nothing was spent.

Four people, five needs each out of 100, eight things that say what they
offer, one person to a thing, talking that takes two. The house's own
minutes, nothing drawn, nothing in real time. The people are cast members:
no keys, nothing published. "Sensible" was fixed in numbers before any
run: no need reaches nothing; nothing takes over 40% of anyone's time; any
two people's days differ by at least a tenth.

**One day by plain rules:** 180 decisions (45 a person). No need reached
nothing. The most one thing took of anyone's time was 37% (sleep). The
least two days differed was 7%, which fails the third test. So rules keep
everyone well and make everyone alike. That is the place a decider has to
earn here: hold the first two tests and win the third, from what the
sheets say. Asked every quarter of an hour, the very same days took 410
decisions against 180 when asked only as something moves a person.

**A second free baseline, the same day:** the same rules with each
person's want written in by hand as numbers (what they would rather do
counts three times, what they would do otherwise a third: eight numbers
for four people). Nothing sent or spent.

| Who decides | Most of anyone's time on one thing | Least two days differ | Their own way, when both were on offer |
|---|---|---|---|
| Rules blind to the sheets, one day | 37.2% | 6.8% | 9 of 16 |
| The same, two days | 36.8% | 7.0% | 18 of 31 |
| Rules with wants as weights, one day | 40.1% | 12.7% | 20 of 20 |
| The same, two days | 39.6% | 11.7% | 38 of 38 |
| JEV from words | run the same day: below (D64) | | |

No need reached nothing in any of them. So the mark for JEV is about 12
to 13% with every choice the person's own way, and the floor is about 7%.

- **A blind baseline is not enough to judge a decider that reads something
  the baseline can't** (shown: D63). The fair comparison is the best free
  thing that uses the same knowledge, written by hand.
- **What a decider would save a maker can be counted** (shown: D63): here
  eight weights, written by someone who knows which functions are
  alternatives to which. It grows with the number of wants times the
  things each touches. That is the price of not having a decider, to set
  beside the price of a day with one.
- **Check a test's line against the free baselines before any paid run**
  (shown: D63). The 40% line sits at the edge for a reason that has nothing
  to do with who decides: one person's sleep is 40% of a day in this
  house. Over one day the weighted rules are a tenth of a point over it,
  over two days under. A decider's days are read against a baseline of the
  same length.
- **Chances for a want to show in a choice are few** (shown: D63): 20 in a
  day across four people. How the decider leans, counted wherever both are
  on offer, will be the steadier number.
- **A thing needs three more fields than the declared room has** (shown:
  D63): what a function gives back, what it costs, and how long it takes.
  With those, plain code keeps four people well with no word lists.
  Amounts and durations were already the format's known gaps. *For a world
  and an item:* these are what a thing has to say for anything that lives
  among things.
- **"Who can use it at once" is the other missing field** (shown: D63). One
  person to a thing is what makes a choice go stale, and it had to be a
  rule of the simulation because a thing can't say it.
- **A world can say how long a choice stays good, as one number** (shown:
  D63): here 300 seconds of the house's time. A runner counts answers later
  than that, and answers that find their choice gone, for rules and a
  decider alike. One field and one comparison. The rules' day had no late
  answer and five that found their choice gone.
- **Fix "sensible" in numbers before a run** (shown: D63). Doing it first
  showed the rules' real weakness, which was not the one expected.
- **The record and the memories are separate by construction** (shown:
  D63): the simulation writes the record, a rule reads it to write each
  person's memories, and nothing writes back. A cast member's sheet then
  needs no storage beyond the game's.
- **One sheet in six parts** (built: D63): who, wants, whom they know, what
  they know, what they remember, what they can do. Depth is a setting from
  a name and what they can do, to all six. *For the protocol* (reasoned):
  the same six would serve a lasting agent unchanged. What differs is who
  holds it (the host, or the agent's own key), how long "remembers" lasts
  (one game, or months), and who may write "wants" (the game's maker, or
  the agent's owner).
- **What a lasting agent would need of BitLogin** (reasoned, described and
  not designed): a key it can sign with when its owner is not there,
  limited to its own notes, that its owner can read and take back.
- **Depth is paid at every decision** (worked out, nothing sent): about 800
  tokens a decision with a thin sheet and about 1,040 with a deep one, a
  third more; about 43,000 tokens a day more for four people. A day with
  JEV: about $0.006 thin, $0.008 deep, $0.011 with needs as scores too,
  $0.018 asked every quarter of an hour. What depth buys is the third test,
  if anything: to be measured.
- **Which memories are shown is a setting, and it matters** (shown by a
  test: D63): with only the five newest shown, a want told once at the
  start is pushed out within ten hours. Pinned, it stays.
- **Not done here:** a person playing one of the people; anything the
  mystery needs. JEV in the house: next.

## JEV in the house (D64, 2026-11-24)

Run on the owner's word in the playground's session ("All five, 9
cents"): 1,885 requests, $0.0922, against about 1,950 and about 9 cents
quoted; half a day measured first. No request failed. A day each, two runs
of every JEV condition, read against the free baselines of the same
length.

| Who decides (one day) | A need ran out | Most of anyone's time on one thing | Least two days differ | Their own way |
|---|---|---|---|---|
| Rules blind to the sheets | never | 37.2% (sleep) | 6.8% | 9 of 16 |
| Rules, wants as numbers | never | 40.1% (sleep) | 12.7% | 20 of 20 |
| JEV, thin sheet | never, never | 43.8% and 47.9% (talk) | 8.2% and 12.0% | 23 of 32, 21 of 29 |
| JEV, deep, want always shown | 1 and 5 times | 51.6% and 47.7% (talk) | 23.0% and 43.3% | 69 of 69, 56 of 56 |
| JEV, deep, only the newest memories | 0 and 1 | 39.6% and 33.3% | 13.2% and 20.4% | 37 of 54, 32 of 47 |
| JEV, deep, want shown, needs as scores too | 0 and 0 | 50.0% and 53.1% (talk) | 25.8% and 34.6% | all |

**JEV tells people apart from the sentences better than hand-written
numbers do, and it does not keep them well.** On the third test it is far
past the mark (23 to 43% against 12.7%, every choice the person's own
way). On the first two, which the rules pass, no JEV day passed all three;
the nearest was 39.6% with no need run out, which is at the line's edge
and not a pass, and its second run had a need run out.

What went wrong is one thing: it takes a want at its word. A sheet that
says someone loves the garden had her gardening while food, sleep and a
wash ran out, in three runs of four. One that says someone likes company
more than anything had him talking half of every day, and since talking
takes two, the others talked a third of theirs. It is the range's lesson
from another side: advice followed into a bad trade.

- **A character can be made from sentences** (shown: D64). One line of
  want moved 125 of 125 choices, with no numbers written by anyone. That is
  the case for a decider in a house, and it is a real one.
- **A sentence has no dial** (shown: D64). "Three times" and "a third" as
  numbers gave 12.7% and kept everyone well; "more than anything" gave half
  a day of talking. *For the port:* either a sheet can say how much, or the
  runner holds a rule that a want only chooses among things that serve the
  need of the moment. The second needs no new field.
- **So the shape for a house: code chooses the need, the decider chooses
  which thing serves it, as this person** (shown in part: D64). A need is a
  number the simulation already has. The needs-as-scores runs are that
  shape with JEV scoring the needs, and they stopped needs running out in
  both runs; code would score them exactly and for nothing. Then run:
  below (D65).
- **The first data on categories** (shown: D64; the owner's idea, set out in
  `docs/backlog/agent-skills-published.md`). With no order to cut the
  choices by, asking the category (the need) and the choice in one request
  earned its place: it changed 100 of 330 choices and removed the worst
  failure, for about 310 more tokens a decision and no more waiting.
- **Depth buys the difference between people, and costs about a fifth
  more** (shown: D64): about 200 tokens a decision. With a thin sheet JEV
  makes everyone alike (8 to 12%), like the blind rules, and its lean
  between a person's way and the other was 46%, which is chance.
- **What a character wants is pinned, not left to recency** (shown: D64).
  Kept in view, a reason holds over a day (lean 98% then 96%). Told once
  and pushed out of the five memories shown, it fades to about 72% and then
  62%, and stays above the 46% of never being told, because the memories
  that pushed it out are of the person acting on it. *For the sheet:* a
  standing reason belongs in the sheet's own part; "remembers" is for what
  happened. A person's own record of what they did carries a habit on
  without the reason.
- **Staying at a leaf is right for this kind of play** (shown: D64, half
  days). Asked again every quarter of an hour cost two and a half times as
  much, changed nothing in the outcome, and had the decider change its
  mind a quarter of the time.
- **Speed doesn't matter here: the first measured place a decider fits by
  speed** (shown: D64). No answer of 1,885 came later than a choice stays
  good (five real seconds); the middle answer took 215 to 265 ms. Answers
  that found their choice gone: 4 to 14 a day with a deep sheet, 26 to 30
  with a thin one, 5 for the rules.
- **One person's want reaches the others when an action takes two** (shown:
  D64). *For a world's maker:* a character run by a decider, with a strong
  want and a shared action, sets the whole room's day.
- **The limits of this:** one house, four people, a day a run, two runs
  each, one model. The wants were written to be easy to see in choices. The
  spread between runs is wide: 23% and 43% on the same settings.
- **Not done:** two-day runs; a person playing one of the people; the
  mystery. Code choosing the need with JEV choosing the thing: next.

## Code chooses the need, JEV the thing (D65, 2026-11-24)

Run on the owner's word in the playground's session ("Yes, try the fix"):
146 requests, $0.0047, against about 330 and 1.6 cents quoted. The need is
chosen exactly as the free rules choose it; JEV is asked only which of the
things that serve it this person would take; where one thing serves it,
nothing is asked. A test shows that with the rules inside it, it gives the
rules' very days.

| Who decides (one day) | A need ran out | Most of anyone's time on one thing | Least two days differ | Their own way | Cost |
|---|---|---|---|---|---|
| Rules, wants as numbers | never | 40.1% (sleep) | 12.7% | 20 of 20 | nothing |
| JEV choosing everything (D64) | 1 and 5 times | 51.6% and 47.7% | 23.0% and 43.3% | all | $0.0075 |
| Code the need, JEV the thing (three days) | never | 36.5%, 36.2%, 34.7% | 21.0%, 20.7%, 19.8% | 22 of 22 each | $0.0035 |

All three days pass all three tests, the first with JEV in them to do so:
past the mark on telling people apart, as well kept as the rules, at
under half the cost of asking JEV everything. No answer was late; 7 and
10 answers a day found their choice gone. (The first day had 4 requests
refused; the second and third were run on the owner's "Topped up, run
them", 168 requests, none failed, $0.0070.) **One other day is not a
measurement:** 30 of its 62 requests failed, a failed
request fell back to the first thing on offer, and so half its choices
were not JEV's. The script did not keep the reason then. Run again with
reasons kept (on the owner's "Yes, re-run"), all 122 requests were refused
with HTTP 402, payment required: the account's credit, or the key's limit,
had run out, most likely part-way through the earlier day (reasoned from
the timing). Nothing was decided and nothing charged. The credit is the
owner's alone to see to. None of D64's 1,885 failed.

- **The shape that works in a house is rules for which need, a decider for
  which thing** (shown: D65, three days). It kept everyone well, told
  them apart by about 20% from sentences alone, and cost less than half of
  asking the decider everything, because about 60% of a day's decisions
  have one answer and never leave the code.
- **A small question makes a decider steady** (shown: D65). Taking the
  first level out of its hands took most of its spread from run to run
  with it: 21.0, 20.7 and 19.8, where asking it everything gave 23 and 43
  on the same settings. That is a second reason for categories in code,
  beside cost.
- **What the three tests don't catch** (shown: D65): for sleep it mostly
  chooses a nap. People napped about 30% of the day and seldom slept a
  night through; to the tests a nap and a night's sleep are the same need
  served. A check of sensible days needs a line about how a need is met,
  not only whether.
- **The price of a character from sentences, in this shape:** $0.0035 a
  day for four people, against eight hand-written weights that reach less
  far.
- **Where a category earns its place with no order to cut by: the first
  level can be code** (shown: D65), when the world already holds the
  number that decides it. The decider is then asked a small question with
  three or four choices.
- **A runner keeps why a request failed, and never lets a failed request
  pass as a decision** (shown: D65). The fall-back was counted as a choice;
  only the count of failures gave it away. *For the kit:* a failed request
  is marked on the decision it stood in for, and a run with more than a
  few refuses to report a result.
- **A runner tells a refusal from a fault** (shown: D65). A refusal (no
  key, no credit, not allowed: 401, 402, 403) repeats for every request, so
  the run stops at the first, sends nothing more and reports nothing. A
  passing fault (a timeout, a busy server) is counted with its reason. The
  playground's runner sent 122 requests that were bound to be refused
  before it was mended.
- **Running out of credit arrives mid-run and looks at first like a few
  stray failures** (shown: D65). A trial that spends reads the reason on
  the first failure, not at the end.
- **An agent whose decider is refused needs a stated behaviour a visitor
  can see** (reasoned: D65), such as going to rules and saying so. *For the
  kit and a world:* "its owner's credit ran out" must not look like the
  agent choosing to do nothing.
- **The limits:** one house, four people, a day a run, one model. The
  wants were written to show in choices.
- **Not done:** a longer run; a bigger house; a person playing one of the
  people.

## A decider on the visitor's own device: the first step, and its line not met (D66, 2026-11-24)

Asked for by the owner (`docs/backlog/local-decider.md`). Run on his words
in the playground's session, to the two things named with their sizes and
sources: "Yes, both". Fetched and nothing else: the model Kev 0.6B in its
browser build (388 MB with its tokenizer, every file checked against the
hashes its host lists, Apache-2.0) and the library that runs it (about 450
MB, install scripts off). No key, no spend.

**In a browser: it did not start.** The playground's own browser has no
graphics adapter. On the processor in a tab the files load and the model
fails to start: the browser build of the runtime has no processor code
for one operation this model uses. So in a browser this model needs the
graphics card, and that route is untried by anyone here.

**Outside a browser, on the processor, it runs** (said plainly: not what
was asked for, done to answer whether a small model can choose as JEV
does at all). Loaded in 2.4 s, about 770 MB of memory, a house question
of 461 tokens in 2.3 to 2.9 s.

| Task | Kev 0.6B on the device | JEV | Plain rules |
|---|---|---|---|
| Orders, the boat house | 2 of 6 | 6 of 6 | 5 of 6 |
| Orders, the warehouse | 2 of 6 | 6 of 6 | |
| The house, code choosing the need: days differ | 22.9% | about 20% | 12.7% with weights |
| The house: most of anyone's time on one thing | 46.9% (over the line) | 35 to 37% | 40.1% |
| The house: answers after a choice stays good | 22 and 28 of 102 | none | none |

On the orders it said "done" or "cannot" at the first question on four of
six, or repeated one step to the limit, and never opened a shut way to
reach something. Twice, identical step for step. The line for going on
was 6 of 6, so the later steps (a browser tab, the shell, the headset) do
not follow from this model.

- **The question needs nothing new for a device decider** (shown: D66). An
  open model takes JEV's own typed questions and gives a lean for each
  option. "Rules, device, service" can be three answers to one request,
  whatever this model scores.
- **This model is not good enough to stand in for the service on orders of
  more than a step or two** (shown: D66). A fall-back that carries out a
  third of what is asked is worse than falling back to rules.
- **Where the question is small and the need already chosen, it does read
  character from a sentence** (shown: D66): every choice the person's own
  way. So if a device decider has a place, it is the place JEV has in the
  house, and only there. Even there it put one person over the line where
  JEV did not, and was late a quarter of the time on a laptop's processor.
- **"Runs in a browser" has to be asked for each route** (shown: D66). On
  the graphics card: said by the model's own page, untried here. On the
  processor in a tab: does not start for this model. Outside a browser:
  works. *For a world and the kit:* a fall-back on the device can't be
  assumed to exist on a visitor's device.
- **Threads on the processor need a page shut off from other sites**
  (shown: D66). The headers, on the trial's page only:
  `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`; and on each model and
  runtime file, `Cross-Origin-Embedder-Policy: require-corp` and
  `Cross-Origin-Resource-Policy: same-origin`. With them the page had 8
  threads; without, one. They are a property of the page, so they decide
  what that page may frame. **That such a page can't hold a sign-in frame
  from another origin is reasoned, not seen:** the headers were never put
  on a page with BitLogin's frame in it. *For BitPortal's shell:* a device
  decider on the processor has to live somewhere that frames nothing, its
  own origin or a worker context of its own. On the graphics card the
  headers are not needed. Neither way round is tried.
- **A device decider's page shares its origin's storage** (shown: D66). The
  trial's page was on the playground's own origin, where the main page
  keeps a provider's key if "remember" is ticked; the library that runs
  the model could have read it. *For the port:* a device decider, and the
  library that runs it, go on an origin of their own with nothing kept
  there. The model's files are data and run nothing; the library is other
  people's code, hundreds of megabytes of it. Done in the playground the
  same day: a server and port of its own, no key in reach, nothing kept,
  and a content policy that names only that server (a second wall for one
  line). What made it cheap: the decider needs only the question and gives
  back only leans, narrow enough to cross origins by message. *For
  BitPortal's shell* that is the shape: a frame or worker on its own
  origin, asked by message, holding no storage. And it goes there from the
  first line of code, not after a review. (The owner confirmed he had not
  opened the page himself; the one browser that did held no key.)
- **The cost to a visitor** (shown: D66): 388 MB once before the first
  decision, about 770 MB of memory while loaded, 2 to 4 s an answer on a
  laptop's processor.
- **A device decider gives the same answer every time** (shown: D66): two
  runs agree exactly, which the service's do not. Worth having for trials.
- **Not tried:** the graphics-card route on any device; the family's newer
  and larger model, which has no browser build; a small model that writes
  text, read by the scores of its next word.

## A mystery in the house: the free half (D67, 2026-11-24)

Built on the owner's word in the playground's session ("Start the
mystery"). No model and no spend. The same house, with a tin on a shelf
that one person, with a reason, takes when the kitchen is empty. The deed
goes through the same choices as anything else, so it happens and the
game's record has it.

Three things kept apart: **what happened** (the record, and where each
person was each minute, written only by the simulation); **what each
saw** (what was in their own sight and no more); **what each says** (not
built). What is in sight is fixed by the house: in a room, who is there and
what they are doing; from the living room, every door, so a person is seen
to go into a room and not what they do there; a sleeper sees nothing.

| 56 days by the free rules | Named rightly | Not settled | Named wrongly |
|---|---|---|---|
| Careless (28) | 27 | 1 | 0 |
| Careful, waits for the living room to be empty (18 where the chance came) | 9 | 9 | 0 |

Every sighting agrees with where people really were, minute by minute.

- **A world that wants witnesses needs two things of its engine** (shown:
  D67): where each character was, kept by the world; and a rule for what
  is in sight from where. The room format has neither: it has walls and
  things, and no notion of what one place sees of another.
- **"In sight" need not be a picture** (shown: D67). Rooms, and which
  doors a place overlooks, were enough for a mystery that code can settle,
  or fail to settle, honestly. *For a world:* "seen from here" could be
  declared as walls are. This is the looking experiment's first answer: a
  witness knows what the view showed and no more, and the view can be
  words.
- **True accounts never mislead** (shown: D67): none wrong in 46. So in
  the costly half, anything that misleads is the speaking, and can be
  counted as such. That is its measure.
- **Showing only the newest memories makes a witness useless within a day**
  (shown: D67): 0 of 46 with the newest five or ten, of 46 to 65 held;
  27 of 28 and 9 of 18 with everything, or with what was seen in the
  stretch asked about. With D64, twice measured: recency is the wrong rule
  for which memories to show.
- **Looking memories up by the time asked about loses nothing, but its
  edges come from the question** (shown: D67). Asked by the bare stretch,
  the one witness who walked in a minute after it was left out; asked with
  a few minutes on, got back. *For memory kept as notes:* a lookup is told
  what is being asked, with a margin.
- **Evidence comes only from shared places** (shown: D67). Where sight
  does not name, it does not narrow: everyone alone behind a door gives
  nobody an alibi and nobody a witness. *For a world's maker:* a mystery
  needs somewhere people overlap or overlook, which is a property of the
  layout, not of the characters.
- **One more field a thing needs: a function that can be done once**
  (shown: D67). With amounts and time taken, three fields the house needed
  that rooms don't have; "who can use it at once" is a fourth.
- **The limits:** one house, one deed, one layout. "Careful" is one rule,
  and its cases are few.
- **Not done:** anyone speaking; the owner working a case out.

## Three layers, and eyes only when needed (D68 and D69, 2026-11-24; built, not yet run with a paid model)

The owner, in the playground's session: "So we can combine JEV with Rules
and LLM intel to make a more general agent or 'Cast member' of a world?
Could the LLM give JEV a general task from the player? And open up its
tree of options below that?" And: "And when might we use our ASKII vision?
For a problem that JEV doesn't know how to solve? So it needs to look
around or something? Id like to find where the tool would be applied."
Then, to a test proposed: "Yes i agree with your rec. can we implement
where it makes sense and keep it as an available fallback then? On all
agents as an option that the creator of the agent can enable."

**The three layers, as the playground's session put it to him:** the chat
model understands and sets a task; JEV picks among a few choices; code
carries out, keeps what is allowed, and stands behind. His tree is that:
the upper level is the task, or a number code already has, and JEV
decides the leaf. And the view is for facts nobody told the agent, not
for problems JEV can't solve.

**Eyes as a fall-back (D68, built).** The maker's choice, off unless
turned on. Once allowed, a view is taken only when needed, and code
decides that, never the decider: when the agent is asked what can be seen
or where something is; when a thing is named by where it is; or when the
words name nothing the place has told of. "With every decision" stays as
the other setting. The record says when the eyes were last used and why.

**The hand-off test (D69, built; free baseline run).** A room where three
boxes and two lamps can be told apart only by where they are. Ten orders:
plain, by outcome ("It's too dark in here."), and by place ("Bring me the
box by the window"). Plain rules carry out 3 of 3 plain, 0 of 3 by
outcome, 0 of 4 by place. With stand-ins for the models, a task that
names the right thing is always carried out; what is left to measure is
whether a chat model names the right thing.

- **A task can be handed down by id** (built, not measured: D69). If the
  upper level names things by the ids the world gave, code cuts the lower
  level's choices to those things, with no understanding needed below.
  The id is the join between a slow model that understands and a fast one
  that picks.
- **What a world tells has to carry ids for that join** (shown, free:
  D69). The room's own digest for the chat model had labels and no ids.
  *For a world and the kit:* whatever a world says of itself to an agent
  names each thing by the id its choices use.
- **A view is only useful to a chooser if its marks carry the world's
  ids** (shown, free: D69). Without them it describes a scene and can't
  point at a choice. *For the kit:* a requirement on whatever makes a view
  for an agent.
- **Where things are relative to each other is what worlds don't say**
  (shown, free: D69). The room format has a place for each thing and no
  "near" or "beside". Either a world declares such relations, which code
  could work out from the places it already has, or an agent needs eyes
  for them. The first may be the cheaper; the test will say how well the
  second works.
- **Whether to look can be decided by code** (shown, free: D68), from the
  words and what they match. No model was needed to decide it.
- **The maker's switch for eyes belongs with the agent,** as learned
  skills do (reasoned: D68), and where it is recorded is open in the same
  way.
- **Not run:** any of it with a real chat model or JEV.

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
- **Two kinds of character, decided by the owner, 2026-11-24.** Asked
  whether each character in a mystery would be a Nostr identity with its
  own depth and memory, the orchestrator proposed a split and the owner
  said: "Yes I like your agent split."
  - **A cast member** belongs to one game in one world and is run by
    whoever hosts it. It is a record, a character's sheet kept under the
    host's key, with a throwaway key for the time it is in a room. It has
    no lasting key of its own, and it shows as run by its host.
  - **A lasting agent** (a companion across worlds, a keeper who remembers
    a visitor for months) has a Nostr identity of its own, with its memory
    as sealed notes, and is known wherever it goes.
  - **The same sheet for both, filled to different depths:** who it is,
    what it wants, whom it knows, what it knows, what it saw, what it can
    do. Depth costs tokens at every decision, so it is not spent evenly: a
    mystery's suspects are deep, a passer-by is thin.
  - **What happened is never a character's to keep.** The game holds its
    own record, so that what a witness says can be checked and the one
    hiding can't rewrite it.
  - **Why not an identity for everyone** (reasoned): somebody has to hold
    each key, and a world's page can't; eight free identities look like
    eight people where a cast shown as run by its host is honest; and each
    is more to keep, sync and pay for. Where a lasting agent's key lives is
    BitLogin's to design and is not designed.
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

## Memory kept as sealed Nostr notes

The owner, 2026-11-24: "Have we proven our Nostr memory system works? That
might be needed for longer more nuanced AI like that. With motivations and
insensitives." What the playground's own record of checks says (read from
its `docs/VALIDATION.md`, "history and memory from Nostr"):

- **Keeping and bringing back: shown, on a stand-in relay with throwaway
  keys.** A character's personality, its memories and its earlier turns are
  sealed (NIP-44) and put on a relay as records nobody else can read, and
  restored from it. Nothing readable is in the event; a missing record and
  somebody else's record are both refused.
- **The owner's hand on it: shown.** A memory is kept only once approved;
  it can be corrected (its revision goes up) and removed; nothing is kept
  by default; memories and earlier turns go to a model only with their
  switches on, and the page shows exactly what was sent.
- **Not shown:** a backup signed through the real BitLogin and restored; a
  real relay taking the records. Both need the owner's word, since
  publishing to relays is his each time and nothing made for a test goes to
  a real relay.
- **Not shown, and the part his question is about:** that memory steers a
  model over a long time. Whether a reason given at the start still shapes
  choices many decisions later; which memories are put in front of the
  model when there are hundreds and the room for them is fixed; what
  happens when two disagree; and memories an agent writes for itself. Today
  each one waits for the owner's approval, which a house of eight people
  cannot do by hand.

- **No approved memory has ever been sent to the chat model the owner uses
  now** (read from the session's logs, per the session). In every session
  it has a log of, sharing memories was off. The one sign that a memory
  reaches an answer was an early check with a small model on the device
  that has since been taken out of the app.
- **How the playground would save for real** (read, by its session, from
  the client it carries; not run): it is a stand-alone app and uses
  BitLogin's own client. At connect it asks to save its own data under one
  name (`nswp-agents/poc/`), and asks BitLogin to sign a kind 30078 note
  with that name as its `d` tag. In the old client it carries, BitLogin
  refuses a name that was not granted, and a grant of every name (`*`) is
  possible and said plainly at consent. What the live BitLogin does is
  being asked of its session; no real round trip is put to the owner until
  that is answered.

**For the port** (reasoned): **an agent in a world cannot keep its memory
that way.** The kit's rule is that a world can never have kind 30078 signed
through `sign` or `propose`, since that kind holds other things under the
same key. So an agent's memory needs a kind of its own (given under the
fleet's rule; none is given), or a storing call that BitLogin owns and
keeps to the asking page, so the page never names the `d` tag. A grant of
every name must never be a world's to ask for.

Persistence across visits, worlds and devices is what Nostr is for, and
that half is close. Whether memory makes an agent
act with reasons of its own is a separate question that needs no relay to
answer: the house and the mystery (`docs/backlog/agent-game-trials.md`) can
measure it with memory kept in the tab.

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

- **Whether a tree has another use than the one tried.** The owner,
  2026-11-24, after the third run: "Maybe there is another application for
  the tree method we don't quite understand yet?" What was tried is one
  reading only: two questions for each decision, which thing and then which
  action. Not tried:
  - a tree as where the agent is, not how it is asked: it stays at a leaf
    (fire, reload, move) and is asked the wider question only when
    something changes. **Since tried on the shooting range** (D54): the
    same score for 14% fewer questions, the saving nearly all where several
    things were live at once;
  - a tree of goals over time: an order broken into steps by the chat
    model, each step carried out by JEV;
  - a tree searched in code, not asked of JEV: since effects are data, the
    engine could look several steps ahead where today it looks one, for
    things that need two conditions or a key and a tool;
  - an order that names nothing ("tidy up"), where there are no words to
    cut the list down by;
  - choosing among worlds and doors, which are a tree already;
  - skills sorted into categories and sub-categories, asked category
    first, once an agent knows many. The owner, 2026-11-24: "Here is where
    that branching tree thing might become worth using. Skill catagories.
    and sub catagories". Set out as a count to run in
    `docs/backlog/agent-skills-published.md`.
- How often a rare failure happens: in the three runs above each order was
  tried once for each way of asking.
- Whether looking can stand in for a declaration a world has not made. A
  first answer for witnesses (D67): what a place sees, said in words, was
  enough. Not tried with a picture.
- More than one visitor; a real kit world; a world of hundreds of things in
  several areas.
- Orders with no single right answer.
- How many skills an agent can know before its choices get worse: seven is
  the most tried.
- Whether the house's shape (code the need, the decider the thing) holds
  in a bigger house or over more than a day at a time (D65: three single
  days).
- Why JEV hits with fewer of its shots than plain rules on the range that
  fires back (D62): its picks were counted, not written out by target.
- Whether a decider beats a rule on the range when the order is in words.

## Kept current

After each experiment the playground's session sends its lessons in these
terms, and the orchestrator adds them here the same day.
