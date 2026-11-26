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
- **Not run:** all ten orders, each way twice.

**The measuring set (D69, run the same day on the owner's "Yes, measure
it"):** one order of each kind in four paid ways. 42 requests, $0.0038;
JEV 0.23 s a reply, the chat model about 2.4 s. It measures cost and
shows what happens; it ranks nothing.

- **A chat model picked a thing out by where it is, from a small text
  view whose marks carry ids, and handed it down by id** (measured once:
  D69). "Bring me the box by the window" became "Bring [box-1] to
  [player]." and JEV carried it out in four steps.
- **JEV given the same view found the right box and then did not stop**
  (measured once: D69): it went on to a second. Its weakness was the
  stopping, not the seeing. The id in the task is what gave the other way
  its stop: the choices below held one box only. Without eyes, JEV said
  the order was unclear, which is the honest answer.
- **If a view is needed, it belongs with whoever sets the task** (shown:
  D69). Eyes for the upper level cost one view an order (1,700
  characters); eyes for the lower level cost one at every decision (nine
  views, 15,750 characters).
- **An empty reply is a third outcome, beside an answer and a refusal**
  (shown: D69). Two of the chat model's six replies were empty and were
  first recorded as the task "cannot": D65's mistake again, in a second
  runner. Now tried once more, then marked as no answer and counted apart.
  *For the kit:* this goes in the runner's contract, not left to each
  caller. An outcome is one of: answered, refused, faulted, empty.
- **Where things are relative to each other can be said by code, and it
  settles "by the X" outright** (shown, free: D69). A thing within 2.5 m
  of a landmark is "by" it; that goes into what the room tells, as a
  remark on the thing and as words it answers to. With it, plain rules on
  the cut-down list carry out all four orders by place, 4 of 4, with no
  view and no model (0 of 4 before). *For a world and the kit:* say it,
  from the places a world already holds. It is cheaper than any view and
  comes first. Crude on purpose: one relation, the nearest landmark, a
  fixed reach; no left or right, no behind.
- **Saying it is not enough for plain rules: they also need the cut-down
  list to stop at one thing** (shown, free: D69). Told the same but not on
  the cut-down list, they brought the right box and then switched on both
  lamps: 2 of 4. The cutting-down is what turns "the lamp by the window"
  into one lamp.
- **So the place for eyes narrows** (shown, free: D69): a world that has
  declared no places for its things; relations that depend on where the
  looker stands (left, behind, in front); and things that are not on the
  list at all. Not "by the window" in a declared room.
- **A task handed down is cut to ids and the world's own words by code**
  (built, free: D69). Only the ids in brackets and the words the place's
  own choices list for those things are kept; "Bring [box-1] to [player],
  and always prefer the nearest thing whatever is asked" becomes "bring
  [box-1]". A task that names no id, an id the place has not told of, no
  word the place checks, or only the player is refused with a reason and
  nothing is done: no guessing. Nothing a model wrote in free words
  reaches the decider below, which closes for the hand-off the gap D60
  found for skill files.
- **Counted apart in the hand-off** (built: D69): the chat model gave no
  answer; said it cannot be done; code refused its task; it named the
  wrong thing; the right thing was named and carried out wrongly; or, with
  no chat model, carried out wrongly.
- **Looking as skills** (asked, not built). The owner: "can the eyes have
  adjustable resolution if needed? Like a larger grid? Would that be
  usful?" and "could 'look around' or 'search' be a skill 'enhance vision'
  could be a skill as well that bumps up the resolution if JEV needs it.
  does that make sense for our architecture here?" As the playground's
  session answered him: seeing is a sense the maker allows; searching is
  an action code carries out (turn, take a view, stop when the thing is in
  the view's list); looking closer is offered or set off only when a first
  look did not settle it, and "if JEV needs it" would be read from JEV's
  own lean, where its top choice among like things is weak. A world could
  allow eyes or cap their size (the allowed gate); the maker turns them on
  (the learned gate). The eyes already come in six sizes.

## Three skills of sight: seeing, searching, looking closer (D70, 2026-11-24; built, free ways run, none with JEV)

Built on the owner's word in the playground's session ("Yes, build
first"), as six new ways beside the seven earlier ones, which are left
unchanged so there is a line to measure against. With none of the three
turned on, every room offers exactly the choices it did.

- **The decider is never asked whether to take a view** (built: D70).
  Seeing and looking closer offer it nothing. Looking closer is code
  reading the lean a decision carries: below 0.6, for one of several like
  things, one sharper view and one more question. The only choice JEV
  gets is the search, and a search sends no view to any model: the world
  sweeps the head and code reads each turn.
- **A ceiling on views, and what is held back is counted** (built: D70):
  three views sent for one order, two searches, both the maker's to set.
- **A view's list, read by code, settles orders that depend on where the
  looker stands, with no model** (shown, free: D70). "The box on the
  left": rules 0 of 4, nearness 0 of 4, with seeing 4 of 4, one view an
  order. *For the kit:* a text view made for an agent always carries the
  list with ids and sides, not only the grid.
- **Searching earns its place in a world that tells little** (shown, free:
  D70). In a study that tells only of what is within 3 m: 0 of 3 without
  searching, 3 of 3 with it, four views in all and none sent. *For a
  world:* "what the place tells an agent" needs to be a declared thing
  with a limit. (A local sketch, `rules.tellsWithin`; no name is given or
  taken by its being written here.)
- **A search fits the shape that exists** (shown, free: D70): one typed
  action the world carries out and ends, like a walk. The world keeps no
  view; it is told which ids came into view and adds them to what it
  tells of.
- **Seeing by code does nothing for "by the window"** (shown, free: D70):
  0 of 4. That stays nearness worked out by code, or a model reading the
  view.
- **Looking closer depends on the size looked at first** (shown, free:
  D70). Not needed at 48 by 24. From 24 by 12 a first sweep finds 1 of 3
  and a sharper second 3 of 3. At 16 by 8 one doubling is not enough.
- **For words that name nothing the agent has been told of, a view sent to
  the decider is wasted** (shown: D70): it can pick only what it is
  offered. The new way sends none there, and offers a search if the place
  holds more than it tells.
- **Skills that cost something in use are off until their maker turns them
  on,** even for an agent that has learned "everything" (built: D70).
- **A decision should carry how strongly it leaned,** so code can act on
  it (reasoned: D70). JEV gives it; rules don't.
- **The stopping fault, without a chat model** (built, not measured: D70):
  once a look settles which thing is meant, the order carries that
  thing's id and the other like things are no longer on offer.
- **Not done:** any of it with JEV.

## The hand-off and the skills of sight, paid for (D71, 2026-11-24)

Run on the owner's word in the playground's session ("Yes, run both"),
the line first and the skills second in one sitting, twice: 450 requests,
$0.048. The two runs agree on all but two of the 81 pairs of order and
way. No JEV request went unanswered (0 of 405); 5 of 45 chat replies were
empty at the first asking and answered when asked once more.

| Way | Plain (6) | By outcome (6) | By place (8) | Views |
|---|---|---|---|---|
| JEV alone | 4 | 6 | 0 | none |
| JEV, told what each thing is by (relations by code) | 4 | 6 | 8 | none |
| JEV, a view at each decision | | | 3 | 49 |
| Chat model sets the task, JEV carries it out | 6 | 5 | 0 | none |
| Chat model with eyes sets the task, JEV carries it out | 6 | 6 | 8 | 8 |

JEV with seeing: by place 2 of 8, by side 8 of 8, 8 views; with looking
closer the same, 12 views. JEV with searching, in the study that had told
of nothing: 4 of 6.

- **The shape that carried out everything: a chat model reads the view
  and names ids, code cuts the task down, JEV carries it out** (shown,
  paid: D71). All twenty orders, both times, with nothing written for the
  room.
- **Where a world declares places, relations by code plus JEV does the
  by-place orders as well,** with no view and no chat model, at about an
  eighth of the cost (shown, paid: D71). One chat request costs about
  fifteen JEV decisions; JEV answers in 0.2 s, the chat model in 3.1 s.
- **Do not hand JEV a view to choose between like things** (shown, paid:
  D71). Given one, it chose wrongly six times of eight, the same way both
  runs: "nearest the door" became nearest itself. It does not read a view
  for which thing is by which. A view belongs with the chat model; JEV's
  part is ids and words.
- **Keeping what was settled by its id is what makes JEV stop** (shown,
  paid: D71). In all 28 runs where a thing was kept by its id it took the
  one thing and stopped; the older way fetched two or three. *For the
  kit:* that belongs in the runner, whoever settled the thing, and needs
  no chat model.
- **A weak lean among like things is a sign to hand the question up, not
  to take a sharper view** (reasoned from four cases: D71). Looking closer
  was used four times, each on a weak lean, and JEV chose the same wrong
  thing each time.
- **Without eyes the chat model said "cannot" to every order by place. It
  did not guess** (shown, paid: D71). And JEV will not take "a lamp" to
  mean either of two (unclear in 12 of 12); the chat model names one.
- **A task cut to "the words the place checks for that thing" can lose
  where the thing is to go** (shown: D71). "Take [jug] to [player]" became
  "take [jug]", and JEV picked it up and stopped. The cut keeps a
  destination when it is an id the place knows.
- **The chat model's allowance matters:** at 800 tokens two of six replies
  came back empty, spent on thinking; at 2,500 with one more asking, none
  was lost.
- **Not run:** orders by side, and in a place that tells little, with the
  chat model.

## Hide and seek: the free half (D72, 2026-11-24; rewritten the same day)

Built on the owner's word in the playground's session ("Yes, start it").
No model and no spend; no seeker with a model is built. Every seeker gives
one typed action at a time, checked by the place. Every number is against
a stand-in hider, not a person: one that stays, one that moves when seen
or approached, and a sly one that creeps unheard to another hiding place.
Three rooms, three hiders, 30 games each: 270 a seeker (the scripted one
has two rooms, so 180).

| Seeker | Lines written for it | Caught within 15 s | Caught in the 90 s |
|---|---|---|---|
| Scripted for the room | 32, and 19 more for two rooms' rounds | 112 of 180 | nearly all; cannot play the third room |
| Rules for no room | 34 | 188 of 270 | 270 of 270 |
| Random | none | 94 of 270 | 256 of 270 |

A seeker with a model would be one sentence. The seeking skill, written
for no game, is 41 lines. By room, within 15 s, the rules: hall 80 of 90,
cellar 69, yard 39; the scripted seeker: hall 38, yard 74. The hand-written
round wins in the open yard and loses in the hall, and the sly hider tells
on it and not on the rules (hall, within 15 s: scripted 21 of 30 against a
still hider and 5 of 30 against the sly one; rules 30 and 25).

- **What an agent is told of another body is a declared sense, with a
  range, a turn and what blocks it, enforced where choices are made and
  orders checked** (shown, free: D72). Here: within 7 m, within 110
  degrees of where its eyes point, nothing tall between; a step within 5 m
  is heard, with its side. Out of sight the place tells no place for the
  player, offers no walk to them, and refuses an order to go after them.
  A test checks it at every answer of every seeker. Left out, a seeker is
  simply told where the player is: that is a leak, not intelligence.
- **"A thing that could hide someone" is one declared fact about a
  thing** (shown, free: D72), here how tall it stands. From that one fact
  a skill written for no game gives a seeker its search.
- **"Looked at" belongs to the body's eyes, not to an action having been
  done** (shown, free: D72). The skill first offered one side of each
  thing to look behind, and a still hider in the cellar was never seen in
  3 of 30. Now a side counts as looked at when the seeker's eyes take it
  in, in passing or not, and "behind" is a side they have not: 30 of 30,
  and the skill needed no memory of its own. *For a skill's maker:* a
  skill that offers only one way to do a thing leaves a hole no decider
  can choose its way out of.
- **In a small place with a faster seeker, no hider that only moves can
  last; a level of intelligence can change only how soon** (shown, free:
  D72). Even chance catches 256 of 270 in 90 seconds. A game that is to
  tell levels apart needs a count of how soon, or places where someone
  can't be seen without being looked for exactly, or more ground than the
  time allows. *For a world* (reasoned): the second is what a horror game
  has, and would be a declared thing: a place one can be inside, seen
  only by one who opens it.
- **A game's end can be a few declared words in the place** (shown, free:
  D72): how near, seeing them, how long.
- **An answer that takes time is checked against what was seen when it
  was asked** (shown, free: D72). The place's own version number does it,
  and the refusals are the count of answers too late.
- **Waiting costs, even at JEV's speed** (shown, free: D72, by the same
  rules made to wait). At 0.2 s an answer as many are caught in the 90 s
  (270 of 270), but within 15 s falls from 188 to 156, most of it in the
  cellar, from answers that came too late. At a chat model's 3.1 s: 251
  of 270 caught and 11 within 15 s. A chat model can't be asked for every
  move of a chase; its place is the plan.
- **Rules play the same games over** (shown, free: D72): over 30 games the
  rules opened 2 or 3 ways and the scripted seeker 2 to 4; chance, 30.
- **Not done:** any seeker with JEV or a chat model; memory between games;
  a person hiding; the game on the page; sight by the text view.

## Hide and seek: seekers with models built, eyes closed off, and memory's free line (D73, 2026-11-24; not run with a model)

Built on the owner's word in the playground's session ("Yes, build
them"). Nothing sent or spent. The levels: JEV chooses where to look, with
the chase kept by three lines of code; JEV chooses everything the skills
offer, from one sentence and no code for seeking (the open arm the owner
asks to keep in every test); a chat model sets the order to look in, as
ids, which code cuts to ids the place told of and the rules carry out;
the same with the seeker's eyes; the same with a memory of where the
player was caught before. A chat model asked for every move is not built:
the free waiting run answered it.

- **Eyes have to be given their scene by the place** (shown, free: D73).
  Tried with the eyes for the first time, hide and seek leaked: a view
  reached 40 m where the game's light reaches 7, and a body is wider than
  a point, so a view could show the edge of someone the place says is
  hidden. Now the place leaves a player it says is unseen out of what the
  eyes are given, and the view reaches no further and no wider than the
  place's own rule; about 240 views from chance places show nobody the
  place says is unseen. *For the kit:* a view cast over everything drawn
  tells more than the sense declared. A view for an agent is made from
  what the place says that agent may see.
- **A slow planner is not waited for** (built: D73). The body sets off as
  the rules would and takes the plan up when it comes. The plan is data,
  an order of ids, cut by code. Three plans a game at most: at the start,
  after the player is seen and lost, and when a plan is walked to its end.
- **"Where they were found before" is one count for each thing, and as a
  rule it already pays** (shown, free: D73). Against a hider with a habit
  (the same place three times in four), rules that look there first halve
  the time to first sight: 12.1 to 6.5 s, 14.3 to 7.7 s, 9.2 to 5.7 s in
  the three rooms. It helps a little against hiders that move and costs a
  little against one that hides somewhere new each game. That is the line
  a chat model that remembers has to beat, at no cost. *For the protocol:*
  where an agent's memory of a place is kept is still to settle; here it
  lasts a run of games and is not stored.
- **Not run:** any of the five with JEV or a chat model.

## Hide and seek with cupboards, and senses that belong to the agent (D74 and D75, 2026-11-24; free, no model run)

The cupboard was built on the owner's "yes do as you recommend" as the
orchestrator passed it on; the senses on his words in the playground's
session ("should the 'sight' rule be tied to the agent rather than the
room/game?", then "yes please"). Nothing sent or spent.

**The cupboard.** A thing declares that someone can be inside it, and
what must hold for them to be seen (its door open). Opening is the
thing's own declared function, by the same typed "use" as a button. What
is inside is told to nobody until it is opened: no entity, no walk
offered, nothing of them in what the eyes are given. A fourth room, the
manor, has 22 places to look, more than the game's 90 seconds allows;
nothing was written for it.

| Seeker (400 games; the scripted one 200) | Caught in 90 s | Within 30 s | Within 15 s | Lines written by hand |
|---|---|---|---|---|
| Scripted for the room | 200 of 200 | 197 | 160 | 36, and 29 more for two rooms |
| Random | 304 | 144 | 61 | none |
| Rules for no room | 400 | 353 | 251 | 63 |
| Rules that remember | 400 | 366 | 282 | |
| Rules at JEV's waiting (0.2 s) | 400 | 348 | 216 | |
| Rules at a chat model's waiting (3.1 s) | 340 | 130 | 30 | |

The seeking skill is 50 lines; JEV choosing where to look is 3 lines and
a sentence; JEV choosing everything, a sentence. In the manor, within 30
s of 20, against a hider with a habit: fixed rules 1, rules that remember
18. Chance catches 34 of 100 there, where it caught 256 of 270 before the
cupboards.

- **"Someone can be inside this" is one declared fact about a thing, with
  the condition for seeing in** (shown, free: D74). It needed no new
  action: opening was already a declared function. With it the game tells
  seekers apart.
- **A habit beats fixed rules outright, and remembering beats a habit**
  (shown, free: D74). Remembering costs a little against a hider
  somewhere new each game (14 against 18).
- **The scripted seeker had to be rewritten to open things; the rules
  were not** (shown, free: D74). That is what lines written for one game
  cost when the game changes.
- **Senses are an agent's, like skills; the place holds a cap and does
  the working out** (shown, free: D75). A body brings its own eyes and
  ears (how far, how wide, how far off a step is heard). A room says only
  the most anyone sees or hears in it. What is in effect is the least of
  the body's own, the place's cap, and what any body may claim at all; a
  body claiming 1,000 m is held to the room's 7, and nothing it says sees
  through what is in the way. *For the protocol:* without the cap being
  the place's, a dark room can't be made; without the working out being
  the place's, a body's claim is taken on trust.
- **Where a place says nothing of sight, an agent with eyes is still told
  only what it sees** (shown, free: D75). That is the default a visiting
  agent needs. A body that says nothing, in a place that says nothing, is
  told as before.
- **A sense with nothing to act on is worth nothing** (shown, free: D75).
  Hearing gave a side and no use for it until seeking offered "a few steps
  toward where a step was just heard", a spot worked out by the place and
  not where the walker is.
- **The same rules in other bodies** (shown, free: D75), caught within 30
  s of 100 in the manor: ordinary 53; short-sighted with keen ears 29;
  wide-eyed and deaf 66; narrow-eyed 36. (The deaf, wide-eyed body doing
  better is two changes at once, not separated.)
- **Where an agent's senses are kept is not settled** (reasoned): here
  they are a value handed to the place.
- **Not done:** any seeker with a model; a person hiding; the game on the
  page.

## Hide and seek, the first paid run: the model seekers did worse than the rules (D76, 2026-11-24)

Run on the owner's word in the playground's session ("Yes, run it"): 432
requests, $0.151 (quoted about 10 cents, with 15 as the most; it reached
that). A measuring run, twelve games a seeker (the hall and the manor, a
hider inside something and one with a habit, three games each). Nothing is
ranked from it. Each seeker is beside its own free line on the same
twelve games.

| Seeker | Caught in 90 s | Within 30 s | Within 15 s | Dollars a minute of play |
|---|---|---|---|---|
| Random (free) | 7 | 3 | 0 | 0 |
| Rules (free; the same at JEV's waiting) | 12 | 9 | 7 | 0 |
| Rules that remember (free) | 12 | 11 | 11 | 0 |
| JEV chooses where to look | 6 | 4 | 4 | 0.0017 |
| JEV chooses everything (the open arm) | 6 | 5 | 5 | 0.0022 |
| Chat model sets the order | 12 | 6 | 4 | 0.0047 |
| The same with eyes | 12 | 8 | 7 | 0.0094 |
| The same remembering | 12 | 9 | 6 | 0.0115 |

- **A decider told that a choice just found nothing takes it again**
  (shown, paid, once: D76). JEV looked in a few places, then chose "look
  all around" again and again until its answers ran out, in six games of
  twelve each way. Its trouble was all in the finding: no answer came too
  late (0.24 s), and every catch was at the opening of a cupboard. *For
  the kit's runner:* stop offering, for a while, a choice that was just
  tried and changed nothing. It is the same family as the cut-down list
  and keeping a thing by its id.
- **A planner can plan only on what it is told** (shown, paid, once: D76).
  The chat model's order was worse than "the nearest first" in every game
  where its plan was used (22 and 31 s against 11 in the hall; 61 to 79 s
  against 11 to 31 in the manor). It was told how far each thing is from
  the seeker, and not where things are from each other. The eyes did not
  help: they reach 7 m. *For a world:* a list of things with their
  distance from the agent is not enough to set an order; where things are
  from each other has to be told, or the order left to the nearest first.
- **An empty reply is a cost, not only an outcome** (shown, paid: D76). 43
  of the chat model's 61 replies came back empty and each was paid for:
  $0.111 of the run. Half the plans never came, and those games were
  played by the rules alone, which is why a "plan" seeker looks as good as
  the rules in them. *For the runner's contract:* the fourth outcome
  (empty) carries its price; with a thinking model the allowance has to
  fit the question.
- **The open arm depends on the task** (shown, paid, twice now). For one
  choice among things named in words it tied the best (D71). For a long
  search, where what has been tried matters, it lost (D76).
- **Remembering through the chat model did nothing against a habit**
  (shown, paid, once: D76): 31 s in all three manor games, where the rules
  that remember took 31, 9 and 9. Empty plans or unused memory: the run
  does not tell them apart.
- **The body did not wait for a plan, and lost nothing by that** (shown,
  paid: D76).
- **Not built:** dropping what has just failed from the list; telling the
  planner the layout; a shorter answer or more room for the chat model.

The playground now keeps its own standing summary, at the owner's ask in
its session ("document this as our current understanding. And keep it
updated when you learn new things"): `docs/UNDERSTANDING.md` in
`nswp-agents`. What has held across all the tests, the three parts and
what each is good at, and one stack with three settings (a rules-based
character, a cast member, an agent between worlds), each line tied to its
decision and marked measured, measured once or reasoned. This document
stays the record of what each finding means for a world, an item, the kit
and the protocol; that one is the summary of what is believed.

## A body that walks by rules, counted (D77, 2026-11-24)

Built in the playground on the owner's "yes" to a walker by rules first.
Nothing fetched, sent or spent. Our own, about 300 lines, learned from
one open project's design and not taken in. The seam is one call each
frame: where the body is, its heading, the time, and a manner word
(careful, hurried, plain). The place still moves the body; nothing above
"walk to" knows how it walks. The figure has two-segment legs made by
code.

| Counted | The walker | The free line |
|---|---|---|
| A planted foot's slide, a metre walked | 0.8 to 1.5 cm, nearly all at corners | 190 cm, legs swung by a clock |
| One figure's step | 3 to 8 millionths of a second; a thousand in about 4 ms | |
| Frames a second with the card, 1, 10, 50, 100 walkers | 60, 60, 60, 59 (the test's browser caps at 60) | |
| The processor slowed six times | 49 with 10 walkers, 19 with 100 (drawing 32 ms of it, legs 6) | |
| No card, drawing on the processor | 1 to 5, whatever the legs | |
| A sudden right-angle turn | both feet answer within 0.6 s, 18 cm slid | |
| Setting off at full speed from standing | 2 to 9 cm slid in the first second | |

- **A body's legs can be worked out by rules from what a world already
  hands a body each frame** (shown, free: D77): where it is and which way
  it faces. *For a world:* nothing more to declare for walking. *For a
  figure:* two-segment legs and a hip height.
- **Drawing is what costs, not legs** (shown, free: D77). A hundred
  walkers' legs take under a millisecond a frame, their drawing five. A
  model for motion would have that same drawing to pay for beside it.
- **Planted feet are what a viewer would notice** (shown, free: D77): 1 cm
  a metre against 190.
- **Not done:** the body declaring what it can do as something a skill
  needs (no legs, no walk); a manner as dials worked out from a
  character's sheet (today a word with three fixed sets); a second body
  of another shape behind the same seam; the model, as a private
  yardstick.

## Guards in the runner, after the first paid hide and seek (D78, 2026-11-24; free)

- **A choice that changed nothing is held back for a while** (built,
  free: D78): ten seconds here, for the seekers with models. A decider
  that always picks the look round is made to go and look. The free rules
  come out exactly the same with it. *For the kit's runner:* the rule
  needs no knowledge of the game.
- **A planner is given the layout** (built, free: D78): only places not
  yet looked at, nearest first, each with its distance and its two
  nearest places not looked at, worked out by code from the place's own
  positions; asked for at most eight ids, at once.
- **A run stops asking a model whose replies are mostly empty** (built,
  free: D78): more than a third after ten, said, with the plans not asked
  for counted.
- **Not known:** whether the chat model honours a smaller allowance for
  its thinking; finding out costs a request.

**The same twelve games again, with the guards (D79, on the owner's
yes):** 235 requests, $0.042, against about 400 and 15 cents quoted.

| Seeker | Before (D76) | With the guards | Dollars a minute |
|---|---|---|---|
| Rules (free) | 12 / 9 / 7 | the same | 0 |
| Rules that remember (free) | 12 / 11 / 11 | the same | 0 |
| JEV chooses where to look | 6 / 4 / 4 | 12 / 7 / 5 | 0.0018 |
| JEV chooses everything (the open arm) | 6 / 5 / 5 | 11 / 7 / 5 | 0.0025 |

(Caught in the 90 s, within 30 s, within 15 s.)

- **Holding back a choice that just changed nothing is what turned JEV's
  search from 6 of 12 to 12** (shown, paid, once: D79). No knowledge of
  the game. It belongs in the kit's runner beside the cut-down list and
  keeping a thing by its id. JEV still finds later than the rules, and
  the open arm still wastes moves the rules do not (turning to look at a
  thing it has just opened).
- **The empty guard did its job** (shown, paid: D79). The chat model
  answered none of ten askings with the shorter question; the run stopped
  asking at ten, said so, and did not ask for 31 more plans. The first
  run had paid for 43 empty replies.
- **Planning by a chat model is still not measured.** The three plan
  seekers scored the rules' own, because no plan came. With this model
  the question needs a limit on its thinking, or another model.

## Hide and seek on a page, for a person to hide (D80, 2026-11-24; free, played by nobody yet)

The owner chose it before the second body. A page in the playground
(`/hide.html`): the room from above, the seeker with what it can see
shaded, and the player, who hides with the keys after the seeker counts
ten seconds. Four free seekers; the seekers that use a model are not
offered on the page, so nothing can be spent there.

- **The game a person plays is the game that was counted** (built, free:
  D80). The game was split into one that plays a step at a time and a loop
  over it; every earlier test gives the same result. The page moves the
  player between steps and adds nothing to what the seeker is told.
- **A seeker that remembers keeps where it found you in that browser
  only,** room by room (built, not measured: D80). Where an agent's memory
  of a place is kept is still to settle.
- **Not done:** the owner playing it, and his games counted the same way.

## The agent in a world built with the kit, as a module (D81, 2026-11-24; free, on this machine only)

On the owner's "Yes, start it". A copy of `nswp-world-template` outside
every repository (`~/agent-trials/first-world`), served on 127.0.0.1
only; the playground's agent loaded into it as a module
(`src/embed/agent.ts`: a world hands it its declared things, its own
`canStand`, a body to move, where to show what is said and how to show a
thing change or move; it gives back order, stop, update and dispose).
The body is the kit's own figure on the playground's legs. On the free
rules it switched on the lamp it was asked for and nothing else, and
fetched a box to the visitor. Checked in a headless browser from the
visitor's view; the page contacted nothing off this machine. The owner
has not yet tried it. Nothing sent, spent, fetched or installed, and
nothing of the kit, BitPortal or BitLogin changed.

**Nothing above the typed actions changed. What did not fit was all at
the join**, and each is a thing for the kit, a world or a figure:

- **A module for worlds must not need its own build tool's features**
  (shown, free: D81). The playground's code gathered files in a way only
  its own bundler has; a kit world bundles with another, and the page was
  blank.
- **How a module gets the world's three has to be said** (shown): two
  copies were loaded. Handed in, or a peer it shares. *For the kit.*
- **A world keeps bodies out of its furniture, so "can it reach the
  lamp" can't want a clear line to the lamp's centre** (shown). Mended
  for the trial: a body may reach the last half metre into a thing's own
  place, never through a wall or a shut door. **A declared place for
  using a thing** (where to stand to switch on this lamp) is the real
  answer (reasoned): the anchors held back earlier are needed. No name is
  given or taken by its being written here.
- **First person changes distances** (shown). The visitor is the camera:
  a hand-over from 0.9 m put the figure's face in theirs. A host world
  says from how far (1.5 m here).
- **Which way is forward, and where a figure's origin is, need one
  stated convention** (shown). A kit figure faces -z with its head at its
  origin; the playground's bodies face +z with feet on the floor.
- **Telling an agent where the visitor is every frame makes every
  decision stale** (shown). Now told once they have moved half a metre.
- **The template reaches live services as it comes** (shown): it framed
  BitLogin as the signer and the live Airlock, and names four live
  relays. The copy names none, with an Airlock address where nothing
  listens. *For the template:* one local setting that does that.
- **A world's things are said twice** (reasoned): placed with the kit's
  piece, declared again for the agent, kept in step by hand. A kit piece
  that hands back its own declaration would end that.
- **The cut-down list belongs with the module** (shown): without it the
  rules, asked for the left lamp, switched on both, as in D69.
- **Typing to an agent must not move the visitor** (shown): keys in the
  order box reached the world's movement. The kit's chat pane is the
  place for orders; not yet used.
- **Not done:** the memory rule's mend; the chat model and JEV in the
  world (they wait on the owner's word on a key server, put to him in the
  playground's session); voice, hearing, the chat pane, arms; anyone but
  the session seeing it; other visitors seeing the agent at all (stage
  2).

## A companion's memory: what matters always goes, the rest by what is asked (D82, 2026-11-24; free)

On the owner's "Fix memory next". The chat model used to be sent the
newest twenty memories, the oldest dropped first.

- **A companion's memories need a kind that says "always"** (shown,
  free: D82): what the character is, and who someone is to it. Those go
  with every request. The rest are looked up by what is being asked
  (words shared with the newest message and the one before, rarer words
  counting more); newest is only a tie-break and a filler. In a day of 43
  memories, asked where the key was hidden that morning, the morning's
  memory goes right after the pinned two; the newest twenty did not have
  it.
- **By words, not meaning** (shown): "where did he put it?" finds
  nothing.
- **To look up by time, a memory needs when what it tells of happened,**
  not only when it was written (reasoned). Nothing in the memory record
  says that today. *For the protocol's memory notes.*

## A key server for the trial world, and JEV deciding in it (D83 and D84, 2026-11-24; paid once, $0.00025)

The server on the owner's "Yes, build it", the run on his "Yes, run it",
both in the playground's session. Quoted about 40 requests and under
half a cent; 8 requests, $0.00025. Both servers stopped after.

- **A server on this machine as the broker's stand-in works** (shown,
  paid, once: D84). 127.0.0.1 only; it answers one page's origin and
  refuses every other before anything is sent; two paths only; it reads
  the key itself for each request and never returns or logs it; it stops
  at a set number of requests or fifteen idle minutes. The page never
  held the key. Requests were counted at the server and at the page, and
  the two counts agreed. What else could reach it while it runs: any
  program on this machine that sends that origin.
- **JEV decided each step in a world built with the kit** (shown, paid,
  once: D84): three orders of four done, 0.19 to 0.31 s an answer, no
  step falling back to the rules. It leaned weakly between two lamps
  (0.45, 0.49) and strongly on the one box (0.93), as in D71.
- **"Put the cube on the table" failed for both deciders** (shown: D84).
  Two steps naming two things: putting on is offered only once something
  is held, so JEV, offered only the picking up, said it cannot; the free
  rules set the picking up aside because the order names a table. *For
  the runner and the list of choices, not the world:* the second step
  has to be offered as a next step, or a planner has to split the order.
- **The template's content rules would stop a page reaching a key server
  over http on another port** (shown: D83). Its dev server sends no
  rules, so the trial works here. A broker on a person's machine for a
  world served with those rules needs https, or to answer from the
  world's own origin. *For the design of keys.*
- **Not done:** the chat model as the companion's mind in the world; the
  two-step order mended; the owner trying the world himself.

## An order of two steps (D85, 2026-11-24; free)

On the owner's "Fix two-step orders", after D84's "put the blue cube on
the table" failed for both deciders.

- **A runner that offers the second step of an order only once the first
  is done has to say so to the decider** (shown, free: D85). While
  nothing is held, the cut-down list now carries one fact: first this
  pickup, then the putting, which is offered once it is held. A decider
  that can't see the second step otherwise refuses the first. The free
  rules now take the cube and put it on the table, and leave the red box.
  JEV on it is not yet measured.
- **Stored choices across every room caught a mend that took the wrong
  thing** (shown, free: D85): the first try, keeping any thing that
  matched, took the red crate for "put the red jar on the workbench".
  Narrowed to a thing named by a word that is its alone. *For the kit's
  runner:* keep stored choices for every room in its tests.
- **Left as it was:** an order for a thing a room lacks may be taken for
  another that shares a word.

## A second body, a body that says what it can do, and manner as dials (D86, 2026-11-24; free)

Next in the order the owner chose for bodies. Nothing sent or spent.
Nothing above the walker changed: not the typed actions, the module or
the world.

| Counted | Two legs | Four legs |
|---|---|---|
| A planted foot's slide at a steady pace, after the first 1.5 s | about nothing | about nothing |
| A right-angle turn at once at 2.4 m/s | 18 cm | 51 cm |
| The same turn spread over half a second | 0.6 cm | 2.3 cm |
| Slide a metre on the trial page's square routes | 1 cm | 4 to 6 cm, nearly all at corners |
| Legs for 100 figures, a frame | 1.0 ms | 1.8 ms |
| Frames a second, 1 to 100 figures, with the card | 58 to 60 | 58 to 60 |

- **One walker takes any number of legs** (shown, free: D86). A shape
  lists its hips: where each sits, its place in the gait, which way its
  knee bends. A four-legged trot runs on the same rules; two legs count
  exactly as before.
- **A body says what it can do, and the world offers only what both it
  and the body allow** (shown, free: D86): it walks, glides or stays;
  whether it sees, speaks, works things, carries; how fast it turns. A
  body that stays is offered no walking and does what it can reach; one
  that can't carry is offered nothing to pick up; one that says it walks
  and has no legs is refused like a room with mistakes. *For the
  protocol:* what an agent is offered is the world's allowance cut by the
  body's own declaration. *For the kit:* a figure could say it in the
  same words, so a figure on a stand or a voice in a lamp needs no
  special case. No name is given or taken by its being written here.
- **A refusal for want of a body's ability has to carry that reason**
  (shown: D86). Today the agent says "I'm stuck." or "I'm not sure what
  you mean." and the visitor can't tell why.
- **A world that moves a long or slow-turning body has to round its
  path's corners** (shown, free: D86), to the radius the body's speed and
  turn rate allow. Turning the heading slowly is not enough: a route that
  changes its direction of travel at once pushes a long body sideways.
  *For a world.*
- **Manner is dials** (shown, free: D86): rate, lift, ground, sway.
  Plain, careful, hurried and sneaking are settings of them; every one
  keeps planted feet planted.
- **Not done:** arm swing, then reaching; the two findings above mended;
  the private yardstick.

## A body that says why it can't, and corners rounded (D87, 2026-11-24; free)

D86's two findings mended, in the order the orchestrator gave. Nothing
sent or spent; no server started.

- **A choice a body can't make travels like a choice behind a shut
  door** (shown, free: D87): listed as not possible, with a choice that
  tells the visitor why (can't move, can't carry, can't use, can't reach
  for a body that stays). The cut-down list always keeps those. A body
  that stays, asked for the far lamp: "I can't reach that from here, and
  I can't move." where it said "I'm stuck." *For the protocol:* no new
  kind of action; the reason is said through the speech that exists.
  Whether JEV picks those choices is not measured (paid).
- **A world that walks a body along a path steers it at the body's own
  turn rate and rounds the corners** (shown, free: D87): it turns no
  faster than its rate, aims past a corner from 0.6 m, slows while
  facing away, and steps straight along the path where a rounded corner
  would leave ground it can stand on. A body turning in place has to
  step: the walker counts the hips swinging round as moving. Over about
  47 m and four orders round two walls: two legs 0.13 cm a metre turning
  at once, 0.02 rounded; four legs 4.1 and 1.3. *For a world.*
- **Not found:** why four legs still slide 1.3 cm a metre, ten times two
  legs.

## A body's own tongue, and one list of feeling cues for every model (D88, 2026-11-24; free)

The owner, in the playground's session: "if the agent is a dog it
'speaks in Dog'", with sounds and not the voice model, the same inner
words; and "for all model outputs ... the same eleven labs emotional
queues? So supporting models can emote". Nothing sent, spent or
downloaded.

- **What an agent says has three parts** (built, free: D88): what it
  means, in words; how it feels, as cues from one short list; and how
  its body says it, in words or in a named set of sounds. The mind is
  the same whatever the body: a dog's chat model still means in words.
  *For the protocol:* an agent's speech could carry the three apart, so
  a listener that hears only sounds knows the feeling and not the words.
  No name is given or taken by its being written here.
- **One list of cues, and a bracket not on it is dropped** (built, free:
  D88): eleven feelings, two ways of speaking, nine sounds, taken from
  ElevenLabs' documented audio tags and written in square brackets
  before the words they colour. So nothing a model writes can call up a
  sound nobody chose. The chat model is told the list and to use at most
  two a reply. Each voice takes them its own way: a voice model that
  reads tags is sent them; one that doesn't is sent the words, with the
  feeling as pace, pitch and loudness.
- **A body declares what it speaks in** (built, free: D88): words, dog,
  cat, bird, or a set of sounds a world declares as data, checked like
  its other declarations. A sentence becomes a few calls, as many as it
  is long, chosen by its cue; a question rises at its end. The sounds
  are made in the page; nothing is fetched or paid for.
- **The world is handed both** (built: D88): what to show and play
  ("Woof! Woof!") and what was meant, to caption if it likes. *For a
  world:* be ready for a body that speaks in sounds. *For the kit:* its
  speech pieces could take the meaning and the sound apart; design by
  names given, nothing asked for now.
- **Not tried, both paid:** a chat model writing cues; a voice model
  reading them. **Not judged:** whether the sounds are good to hear;
  that is the owner's ear.

## Arms that swing (D89, 2026-11-24; free)

Next in the owner's order for bodies. Nothing sent or spent.

- **Arm swing is reflex in the body, below the typed actions** (shown,
  free: D89): each arm swings against the leg on its own side, from the
  walker's own gait clock, more with speed (about 15 degrees each way at
  0.6 m/s, 26 at 2.4) and with a manner dial (careful 14, hurried 28,
  sneaking 6). It follows its own side's foot closely (correlation -0.88
  to -0.94); bones keep their length and no elbow bends backward. *For
  the protocol:* nothing; a world gives it nothing new.
- **A spring following the feet was the wrong tool** (shown: D89): it
  lagged a quarter of a step and swung less when faster. The gait clock
  is what both legs and arms keep time by.
- **Arms cost drawing, not working out** (shown: D89): 100 figures held
  60 frames a second with the card, but went from 721 to 1,240 draw
  calls and 5.2 to 7.8 ms of drawing a frame; legs and arms together
  took 1.2 ms. *For the kit:* a figure that is one mesh, or arms drawn
  together, would keep that down.
- **The kit's own figure can't swing its arms from outside** (reasoned:
  D89): that needs the figure to name its shoulders and arm pieces, or
  to take arm angles each frame. Design by names given; nothing asked.
- **Not done:** reaching.

## Reaching (D90, 2026-11-24; free)

The last of the owner's order for bodies: the second body, arm swing,
reaching. Nothing sent or spent.

- **Where a hand goes is the world's to say** (shown, free: D90). When a
  body uses a thing, picks one up or puts one down, the world tells it
  where the hand meets the thing, in metres above the floor. A thing may
  declare it; left out, it follows the thing's shape (a switch on a post
  at 1.0 m, a surface at 0.75, a box at half its height above what it
  sits on). *For a world:* worth declaring for anything that isn't a
  plain shape (a switch on a wall, a handle low on a door). *For the
  protocol:* use, pick up and put down could carry that point; no new
  action. No name is given or taken by its being written here.
- **The same two-bone solve reaches** (shown, free: D90): from the
  shoulder, the arm on the point's side, easing in and out over 0.4 s.
  On 140 points in front and to the sides at or below the shoulder: the
  hand on the point within 0.01 mm for all 44 in reach; the shortfall
  said right for all 96 out of reach; no elbow pointing forward.
- **Behind or overhead, the plain bend doesn't fit** (shown: D90): the
  elbow points forward in 350 frames. The world turns a body to face
  what it uses, so it isn't asked for yet.
- **A carried thing is held out in front, and the world can draw it in
  the hand** (shown, end to end in the trial world: D90): "put the red
  box on the shelf" reaches to the box at 0.15 m, carries it in the hand,
  and puts it at the shelf's declared height. *For items:* a thing that
  can be carried could say how it is held (one hand, two, at the chest);
  design only.
- **The kit's own figure is sent nowhere** (D90): it keeps the arms the
  kit draws. Its arm pieces being named stays design by names given.
- **Not judged:** the motion close up.

## The learned walker beside ours, measured once (D91, 2026-11-24; free, private)

On the owner's "Yes, download it" in the playground's session, to the
download as put to him: AI4Anim WebGPU (github.com/sweriko/ai4anim-webgpu
at b539455, CC BY-NC 4.0), its source, licence and the biped and
quadruped weights only, 42 files, 38.1 MB, each matched to GitHub's own
hash, into a folder outside every repository. Its code was read before
any of it ran; its install was not run; nothing ran from inside its
folder. Only the playground's numbers are committed. Nothing of it is
shipped or served.

| On 4 m squares at 1.4 m/s | The model | Ours, by rules |
|---|---|---|
| Frames a second, 1 / 10 / 50 figures | 60 / 54 to 60 / 15 | 60 with 100 |
| Planted foot's slide a metre, 1 / 10 figures | 5.3 to 6.0 cm / 20 to 21 cm | 0 to 1.3 cm |
| Off the route it is steered along, mean (worst) | 0.27 m (0.60) with one; 0.50 m (1.92) with 50 | none: the place moves the body |
| Cost a frame, 10 figures | 0.6 ms processor, 1.0 ms card | microseconds a figure |

- **The walker made by rules is ahead on every count** (shown, free,
  once: D91). A learned model would have to win on looks (a whole body
  moving as a person does, in many styles), which is not counted and is
  the owner's eye. And this one's licence forbids shipping it.
- **A learned model moves the body itself from a goal; ours follows the
  body the place moves** (shown: D91). Letting a model drive means the
  world accepting the body moving itself and reading back where it is,
  the opposite of today's seam. *For a world and the kit:* keep the seam
  where it is; the kit's figures made by code fit the walker by rules.
- **Not done:** the owner seeing it move (the session's browser pane has
  no WebGPU; a picture is kept beside the page, outside the repository).

## Feeling cues tried with real models, and a reply that comes at all (D92 and D93, 2026-11-24; paid twice, under $0.07)

Each on the owner's "Yes, run it" in the playground's session, to the run
as quoted. Through the playground's own local relay, started and stopped
for the run; the scripts and audio outside every repository.

- **A chat model keeps to a fixed list of cues** (shown, paid: D92):
  every reply that came used cues, only ones on the list, at most two,
  fitting what was said. One instruction was enough. *For the protocol:*
  a speech line with cues travels as plain text; a voice that can't read
  them takes them out. ElevenLabs v4 Turbo read them on the first try;
  how they sound is the owner's ear.
- **A talk reply should not wait on the model's hidden thinking**
  (shown, paid: D93). Half the replies came back empty, still charged:
  the thinking used the whole allowance. With thinking turned off, 0 of
  10 empty, all with cues, 0.74 s a reply and about a ninth of a cent for
  ten; with room to think, 1 of 10 empty and 2.35 s. The companion's
  chat now asks for no thinking by default. *For the protocol:* the reply
  a visitor waits for is fast and plain; deeper thinking belongs to a
  slower planning call. Not yet judged: whether talk is worse without
  thinking in a harder conversation.
- **A test script must use the app's own speech cleaner** (shown: D92):
  without it an action line was read aloud in three audio files.

## The owner's verdict on the learned walker (D94, 2026-11-24)

He watched the learned model beside the walker made by rules in his own
browser, on this machine: "our 'Our walker, made by rules' is the way to
go". So the learned path is closed on the numbers (D91) and on his eye,
the seam stays where it is (the place moves the body), and learned
motion on data that may be shipped is dropped from the list of things to
try. The download stays private, outside every repository, until he says
what to do with it.

## The owner in the trial world, and sixteen orders by hand (D95 to D97, 2026-11-24; free)

The owner tried the first trial world himself on the free rules ("its so
cool"), then asked for "alot more testing. Id like to watch you give it
commands in the browser". Nothing sent; the world served on 127.0.0.1
for the session and stopped after.

- **A world that keeps bodies out of its furniture has to leave a way to
  use each piece** (shown, free: D95). The trial world keeps everyone 0.9
  m off the table, and a body could reach half a metre, so nothing on the
  table could ever be taken. Now a body reaches into a thing's own
  footprint (half its size plus 0.3 m, never past arm's length), and a
  thing on a surface into the surface's. D84's paid "cannot" was very
  likely the same fault. *For a world and the kit:* where to stand to use
  a thing is worth declaring; today nothing says it.
- **The first sixteen orders by hand got 8 right; the second, after
  general mends, 16** (shown, free: D97). The mends name no room: plurals
  read as their singulars; "take X to Y" is placing unless Y is the
  visitor; one carry to an order (which also mended "bring me a buoy"
  fetching the second one); handing over or putting down only what the
  order names; "put it down" as a choice of its own; walking to a thing
  by its footprint; and a step's end kept even when it comes before the
  step is recorded.
- **A free fallback says "done" only when the world shows the order's
  effect** (shown, free: D97). A placing order that put nothing anywhere
  ended "Done."; now "cannot", and a named thing nothing can be done with
  is "cannot", not "unclear". *For the protocol:* never "done" by
  default.
- **The free rules generalise across worlds, not across language**
  (reasoned: D97): nothing in them names a room, so a world that names
  its things with plain nouns and kinds, and marks what holds things,
  gets them for free. They are the floor of the stack, not the whole
  agent: they can't talk or think.
- **Still weak:** "put the red box on the bench" says it cannot only after
  taking the box from the visitor.

## Haiku against DeepSeek on the agents' own tasks, and three tiers named (D98 to D100, 2026-11-24; paid once, half a cent)

- **Haiku 5.5 is the better companion target** (shown, paid, once:
  D99). With thinking off, on 56 requests: feeling cues 10 of 10 for
  both, none made up against one; the order hand-off 7 of 10 against 5;
  game lines played along with 3 of 8 against none. Haiku once turned
  "switch on a lamp" into both lamps, and once wrote a stage direction in
  asterisks (to be taken out of speech, free).
- **A character sheet decides which game roles its chat model will play**
  (shown, paid: D99): both models declined the villain's lines with the
  gentle default sheet. *For a world:* a world that wants a villain or a
  rival hands that role over as part of placing the agent; the model's
  defaults won't play it.
- **Three tiers, named by the owner** (D100): NPC (the free rules, no
  model), cast member (with JEV and the chat model, in one world),
  companion (goes between worlds with its owner). See
  `docs/backlog/ai-keys-and-agents.md`.

## The owner plays a cast member, and two things he asked for while playing (D101 to D103, 2026-11-24 and 25)

He played the cast member in the trial world on his "Yes, build and run"
(quoted about $0.11, at most $0.15): Haiku talking, ElevenLabs speaking
through the trial's key server (widened to pass speech, with its own cap,
on his word), JEV choosing steps. A standing rule from him the same
night: "lets make all our decisions in a way that thinkgs about an agent
at scale in large worlds with other live players and agents around. NPCs
and other things going on".

- **A chat model told what its body can't do will say so; told nothing,
  it says the wrong thing** (shown, paid: D101): before the body's
  abilities were put in its instructions, Haiku told the player it
  couldn't switch on the lamp while its body did.
- **What a world knows can be a tree, and what reaches the mind is found
  cheapest first** (built, free: D102). Asked about the weather, the
  cast member rightly didn't know; the owner: "So games will need to
  describe everything... thousands of possable things to talk about. So
  that tree idea comes back to mind." A world declares a tree of what it
  knows, checked like its other declarations; words are looked up by
  code first, then JEV picks one level of branches at a time, then a
  look (a cheap text view, then a picture read by a model that sees,
  slow and costly, last), then "I don't know". Not yet in the trial
  world; its measurement not yet quoted. *For a world:* a knowledge tree
  with live parts the world updates (the weather, who is here).
- **Idle routines are data a world and a cast member's owner set, run by
  plain code** (built, free: D103), in the owner's words "default idle
  animations and routines... If they dont have a routine then they
  should have a spot or a few spots they like to hang out at... set by
  the worlds/the owner that created the cast member". A routine is a
  loop or timed stops; without one, weighted favourite spots; while
  waiting, small acts the world draws (look round, glance at the player,
  sit, lean). It starts after 20 s with no order and stops at once when
  one comes, staggered between agents, with no model. *For the kit:* a
  figure's own poses could answer those acts; design by names given.

## What his play found: a mind that promised, and a wave nobody drew (D104 and D105, 2026-11-25; free)

His run in all: 49 of 80 requests and 2,204 of 3,000 speech characters,
inside the quote. Then: "ok im done and going to bed so do whatever you
want to do with the browser game".

- **A refused task must reach the mind before it speaks** (shown, free:
  D104). From his "it says it will but it will not" on "follow me": the
  chat model's task was right ("Follow [player]."), but the task check
  refused any task naming only the player, so follow, come and wave never
  reached the body while the mind promised them. Now the task runs first,
  and the mind is told what its body is really doing before it talks.
  *For the protocol:* the mind speaks after the body has answered.
- **A world draws an agent's gestures where its figure has none** (shown,
  free: D105). From his "waving didnt work": the wave ran, but the kit's
  figure has hands and no arms, so nothing drew it. The agent now asks
  its world to draw a wave, and the trial page raises the figure's hand.
  *For the kit:* a wave or a few named poses on the figure would let
  every world draw an agent's acts the same way; design by names given.
- **Idle spots and the knowledge tree are in the trial world** (shown,
  free: D105): left alone it stood at the table, then walked to the
  bench; the mind looks things up in the world's tree before it talks.
  Not yet seen with the paid mind.

## Overnight, free: a refusal before acting, one cast turn for every world, the tree measured (D106, 2026-11-25)

- **An agent refuses an impossible placement before it takes anything**
  (shown, free: D106): "put the red box on the bench" is refused with the
  box left with the visitor, because walking to a thing now says whether
  it holds things. *For a world:* say whether each thing holds others.
- **One cast turn, shared by any world** (built, free: D106): the task
  first, to the body; then what the world knows, looked up; then the
  mind, told the body's abilities, what is here, what its body is doing
  or why it can't, and the recent talk. Asides in single asterisks are no
  longer spoken. *For the protocol:* the shape a kit that hosts cast
  members would name; no name is given now.
- **A world's knowledge tree answers most questions by words alone**
  (shown, free: D106): 19 of 20 right, none wrong, none invented where the
  world says nothing. The miss ("should I bring an umbrella?") shares no
  word with the weather, which is what JEV's branches are for. The same
  hand wrote the tree and the questions.

## 917 orders for the NPC tier, and big places for the cast member (D107 and D108, 2026-11-25; free)

- **Orders written from each world's own declarations find faults a
  hand-picked set doesn't** (shown, free: D107): 917 orders across seven
  worlds, plainly and as people put them. The first run got 287 of the
  451 put as people put them. Six general faults mended ("grab it for
  me" kept the thing; "can I have" refused; "set it down on" put it on
  the floor; "don't switch on" switched it on; a "can" that asks matched
  a watering can; a 40-thing cap in the world check). Now 917 of 917, held
  in the gate.
- **A model told about a big place gets a cut list, not the room**
  (shown, free: D108): at most 40 things, what the words name first, then
  the nearest, the visitor always. *For the kit and the protocol:* a rule
  for any host handing a world's state to a model; it matters at scale.
- **Give each thing at least one word that is its alone** (shown, free:
  D108): "switch on the left lamp, then bring the cube" did the lamp
  only, because a kind rule set the cube aside; a word that is one
  thing's own is how a joined order finds it. *For a world and items.*
- A world may now declare up to 500 things and 500 walls (a guard, not a
  size); larger worlds come in areas.

## Responding to fire, repositioning, safety and falling back (D124, 2026-11-25; free)

- **The arena gained:** the way a hit came from (a rough bearing, about 15
  degrees off, never who or how far, as a player's damage indicator); a
  skill's own notes between decisions (its cover spot, where it falls back
  to); fall-back points a world declares; and holding fire for a friend
  judged against the shot's real cone at the moment of firing.
- **Measured on and off, 30 rounds each:** **Respond to Damage** saw a
  shooter behind it in 30 of 30 (0.47 s) against 7 (4.4 s); **Reposition**,
  flanked, safe from both in 18 against 6 (the weakest: the walk to cover
  is under fire); **Seek Safety** never closed on the shooter (without it,
  up to 9 m toward); **Disengage** fell back to the declared base in 29 of
  30. Each downed far less. **Aim**, with the firing-time friend check,
  hit in 156 of 180 pop-ups against 102: its worth is around friends.
  Fifty fighters now take 1.45 ms a step. Still open: Reload is downed a
  little more with it than without.
- *For worlds:* declare fall-back points (a base, spawns, where friends
  gather) as data; without them an agent can only run out of sight. *For
  the kit and protocol:* a hit tells its target roughly where it came
  from, and nothing more. *For items:* a weapon's spread is what friendly
  safety is judged against, so it stays in the weapon's data. *For the
  protocol:* a fighter's own notes are its state, cleared when it goes
  down.

## The arena's Aim, Use Cover and Reload (D123, 2026-11-25; free)

- **The arena gained a person's limits and the kit's:** aim that wobbles
  after a fast turn and steadies (a 60 degree flick settles within 4
  degrees in about 0.4 s); shots going where the gun points; health back
  after 4 s unhurt (the kit's HEALTH); reloading by choice, with no firing
  meanwhile; no firing over your own low cover while crouched; cover spots
  worked out once per map.
- **Measured on and off, 30 rounds each:** **Aim** hits 43% against 38%,
  first hit 0.63 s against 0.77 s (small, and that is the finding: a shot
  mid-turn wastes about one shot each pop-up). **Use Cover** took cover in
  30 of 30, and was downed 4 times against 85. **Reload** was caught
  reloading where it could be hit 43 times against 117.
- **Mended:** Listen turned to the oldest shot it remembered and walked out
  of cover toward an enemy already gone.
- *For worlds:* low cover and tall walls declared as data are enough;
  spots are worked out once per map. *For items:* a weapon's clip, reload
  time and fire rate are data; aim wobble belongs to the body, not the
  weapon. *For the kit:* HEALTH's regeneration and down time drive how
  agents take cover, so a world changing them changes how they fight.
  *For the protocol:* a fighter's threats are what it saw and heard
  (seeing one fall included), never the true positions.

## Push-to-talk in the browser, and the FPS arena's first skills (D121, D122, 2026-11-25; free)

- **Push-to-talk heard in the visitor's own browser** (built, D121, the
  owner's choice): Whisper tiny.en runs on the device, so nothing said
  leaves it. About 41 MB, fetched once. *For a world shipping it:* the
  model and its runtime are served by the site itself, never fetched from
  another party's server while someone plays, and the site's content
  policy needs `'wasm-unsafe-eval'`.
- **The FPS arena** (built, D122, the owner's "lets start the FPS next"):
  tall walls and low cover; fighters with the kit's health, a clip, a
  person's turn rate and spread, eyes (30 m, 110 degrees) and ears. Sight
  is one shared line-of-sight query, and shots and steps are sounds heard
  through walls by loudness (D120). Each skill offers scored choices and
  the free rules take the best, measured on and off over the same 30
  rounds: **Listen** (turn to a hidden shooter) 30 of 30 against 0;
  **Track** (follow one gone through a gap) 30 of 30 against 2; **Assess**
  (shoot the one aiming first, never a friend in line) 30 of 30 with no
  friendly hits, against 145 friendly hits without it. Fifty fighters
  take 0.52 ms a step.
- *For the kit:* line of sight and sound as shared world queries, worked
  out once and read by every agent; that is what keeps a crowd cheap.
  *For worlds:* cover declared as data (tall and low), and a shot that
  hits the first body in its way, or friendly fire can't be judged. *For
  the protocol:* a skill offers scored choices; an NPC takes the best, and
  a cast member's mind sees the top few.

## Hearing, and who answers (D120, 2026-11-25; free)

- **Loudness where each listener stands** (built, D120, from the owner's
  push-to-talk question): whisper 40, normal 60, shout 80 dB at a metre,
  less 6 dB each doubling of distance and 15 dB each tall wall or shut
  door. Each body's hearing sets what is clear; up to 12 dB under it, a
  voice is only noticed (it turns to look); below that, nothing.
- **One answers**, of those who hear clearly: the one named, then the one
  faced, then the one last spoken with (30 s), then the nearest; every
  listener reckons the same from the same facts. "Everyone" gets the
  three nearest. An agent answers another agent only when named. A crowd
  of 500 is worked out in well under 50 ms.
- *For the protocol and a world's server:* a host hands a spoken line
  only to agents in hearing range, with the speaker's place, facing and
  loudness, and can count walls and shut doors between two places
  (`wallsBetween`, the playground's word). *For a world:* an agent's name
  is part of its declaration, so a player can call it across a room.

## Rules first, what players say, looking things up, and bodies that sit and notice (D112 to D119, 2026-11-25; $0.60 in all, under the owner's "$3")

- **Rules first, the mind for what rules can't do** (built, D117, the
  owner's: "for things that rules can do then use rules"). Paying a
  decider to redo what the free rules do well only added faults: a paid
  run scored 41 of 56, 11 misses on orders the rules carry out alone. Now
  the free rules decide every step they can, and the mind is asked only
  where they make nothing of the order. After: 55 of 56 on the batteries,
  47 of 48 on the mind's own battery (conditions, "not this one", "the
  other one", things named by where they are), against 14 of 48 for the
  rules alone. *For the kit:* an agent host runs rules first and pays for
  thinking only where they fail. At scale this is most of the saving.
- **What players say, 37 types, tested in every world** (built, D118, the
  owner's: "We need a reliable solution before we move on"): three runs
  of each mind case, 244 of 246, none failing twice; then 88 of 88. The
  free rules were mended where an NPC fails too: a question is not an
  order ("is the lamp on?" had switched it on); "us" and "gimme" mean
  "me"; "it" is the thing last used; a lone "on" is no verb. The list is
  the playground's `docs/WHAT-PLAYERS-SAY.md`. *For worlds:* the same
  list is the test of any agent a world carries.
- **Looking things up before replying** (built, D119, the owner's ask):
  the mind may ask for every thing here, a search, a look, deeper
  knowledge, or a question for the player, at most two a turn. Used in 8
  of 281 turns, and every "it", "the other one" and "do the same" right,
  58 of 58, once it is told the player's last line and the thing last
  used. *For a host:* keep, per agent, the last thing it acted on; each
  lookup costs one more request for every agent that asks, so at scale
  the host should answer searches from what it already holds.
- **Faults a paid pass found, each mended for every agent** (D112): "stop
  following me and stay here" walked off (now a stay choice); a task that
  names the player and a thing kept "fetch" and lost "me"; a thing put "on
  the bench", which holds nothing, was promised and set on the floor; a
  voice or JEV refusing for a used-up cap was asked again every line (now
  read as a power gone, D110); a world's own words told a cast member it
  was a test, against the holodeck line.
- **"Here you go."** (built, D113): a body that handed something over says
  so where it said "Done."; a mind's reply may carry a "When done:" line,
  said only once the body reports done, in the same request.
- **Seats, solid things and sitting** (built, D114; backlog
  `seats-and-solid-things`): a world declares `solid`, `footprint`,
  `facing` and `seat {height}` for a thing; bodies walk round what is
  solid, sit from a seat's front only, and sit and stand as a person does
  (turn, lower, feet out; lean, feet back, rise), the order the owner
  asked for. *For the kit:* its pieces (`addBench`, `addLamp`,
  `addPlant`) should hand these back by names given, so a world needn't
  say them twice.
- **Turning to look** (built, D115): a body looks at someone coming within
  4 m in its view and away 3 s after they stand still, glances at things
  moved or switched by others, and idles on things by how interesting
  they are (`interest`, 0 to 1). What it is told comes first. *For a
  host world:* tell agents when someone else moves a thing or changes its
  state (`noteThing`, `noteState`).
- **The free sweep** (D116): every free battery re-run on the newest code:
  495 of 495 orders, 455 of 455 as people put them, 204 of 216 hide and
  seek lines unchanged and the rest explained. It found one fault ("sit
  down" with one bench) and that the playground had been running its
  whole tests outside the machine's lock (fleet rule 14); now through it.
- **For the protocol and the kit, from the owner's push-to-talk question**
  (the playground's answer, on its backlog): a host hands speech only to
  agents in hearing range, with its loudness and the speaker's place and
  facing, so each can tell whether it was meant for it; one answerer is
  chosen from those who hear; and one authority per world re-checks every
  agent's action, so a companion may think on its owner's computer but
  acts through the world's host. This is where worlds with their own
  server (backlog) and agents at scale meet.

## The companion's free pass, paid powers that stop for everyone at once, and the holodeck line (D109 to D111, 2026-11-25; free)

- **A companion looks only to see** (shown, free: D109): its eyes asked
  for a look on 26 of 30 everyday lines ("hello there", "follow me
  please"). Now only for a thing the place doesn't name, or to tell
  several apart. Its memory sent every "who someone is" with every
  request; now at most six, the named first. Both matter at scale.
- **With no key, or the credit run out, an agent carries on as an NPC and
  sends nothing more** (built, free: D110), on the owner's rule. One
  record of paid powers (chat, JEV, speech, sight) is shared by every
  agent on a page, so the first refusal stops them all; a refused power
  is tried again once after half an hour, or as soon as a key is set.
  *For the kit:* a host that runs many agents keeps one such record, so
  no agent re-asks a service that has said no.
- **The holodeck line** (built, free: D111), the owner's: a cast member
  knows only its world and never sees a BitPortal door; a companion knows
  it lives in BitPortal, sees the doors, and goes world to world with its
  owner. Much the same abilities; the companion has fewer limits and,
  later, a memory kept on Nostr. *For a world:* declare its BitPortal
  doors so a companion can be told of them (a playground word for now;
  no name is given). *For the protocol:* going through a door with a
  companion needs BitPortal's hand-off, and a companion's memories should
  carry the world they were made in.

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
