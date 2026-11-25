# Bodies that move themselves: animation made by a small model, driven by what an agent decides

- **Asked:** 2026-11-24. The owner, handing over a proposal another
  assistant wrote for him: "what do you think of something like this as a
  part of our AI agent system? The animation component driven by our
  agents logic."
- **And then,** the same day: "ok id like to get even a minimal version of
  the Neural animation system working and tested with performance
  metrics."
- **Who:** the `nswp-agents` session, in its playground, as a trial.
  Briefed 2026-11-24. Later, if it earns it: the kit (figures) and
  whatever own models for figures become.
- **State:** a minimal trial is briefed, with what to measure. Nothing
  fetched or built: each download is the owner's own word in that
  session, with its licence read first. Part of `ai-keys-and-agents`,
  which is last and not a priority; for the kit it stands behind
  `avatars-own-models`, since a figure today has no skeleton.

## The idea

Instead of hand-made animations and the rules for moving between them
(walk, run, turn, crouch), a small model is given where a body means to
go, how fast, in what manner, and the ground under it, and works out how
its skeleton moves, many times a second, on the visitor's own device. The
same for a person, an agent or a scripted figure: whoever decides says
"go there, carefully"; the body does the walking.

The proposal names work to look at: Meta's research framework for it
(bipeds and quadrupeds), a port of that to three.js on the graphics card
with a demonstration in a browser, a physics-based one that also runs in
a browser, and a studio's learned motion matching. None of it checked
here.

## What the orchestrator makes of it

**It is the right seam.** The agents work has ended in three layers: a
model that understands and sets a task, a fast decider that picks among a
few typed actions, and code that carries them out. "Walk to this thing"
is already one typed action the world carries out. How the body looks
while doing it sits below all three, and nothing above needs to know. A
manner ("cautious") could come from a character's sheet as a word.

**Three things stand in front of it:**

- **A figure has no skeleton today.** The kit's figure is a head, a body
  and two hands, modelled by the kit. Nothing can walk until figures can
  have models of their own with bones (`avatars-own-models`).
- **The licences, which the proposal itself names as the blocker.** The
  framework and its three.js port are for non-commercial use only. Worlds
  here may sell things. So nothing of them could ship: a model of ours
  would have to be trained on motion we are free to use, which is a
  project of its own.
- **Another model on the device, beside the world's picture.** Smaller by
  far than a language model, but the device-decider test found that "runs
  in a browser" has to be asked for each route and each device, and in a
  headset a dropped frame is a comfort fault.

**The free line first, as with every decider tried.** Ordinary clips
blended by rules, with feet placed by code, is the baseline: it is what
games ship, it costs nothing to run, and for a two-legged figure walking
on a floor it may be most of what anyone sees. A model has to earn its
place against that in a count (how often feet slide, how a turn looks,
frames lost), not in a demonstration.

**Where it might matter most for us, and is not in the proposal:** a
visitor in a headset has a head and two hands and no body. Giving them a
believable body from those three points is the same family of model, and
is a thing people would see at once.

## The first step that costs nothing

The three.js port has a demonstration in a browser. The owner opening it
on his own desk, and in the Quest's browser, says whether it runs there
at a frame rate worth having, before anything is fetched or built. He
opens it himself; no session downloads it.

## The trial, as briefed

One two-legged figure in a page, its skeleton moved every frame by the
model from a goal; then the playground's own typed "walk to this thing"
action, chosen by rules or JEV, handed to that body as its goal. Cheapest
facts first, stopping at the first no: whether any browser on this
machine has a graphics adapter for it; whether the published
demonstration runs and how fast (the owner can open it himself); only
then a fetch, on his word, of code and weights that are for
non-commercial use, kept out of every repository and served from an
origin of their own.

The numbers asked for: size and time to the first pose; time for one
figure's step, middle and worst; frames a second and the worst frame in a
hundred with 1, 10, 50 and 100 figures, and with the processor slowed six
times; memory; each route that does not start, said plainly; feet sliding
and time to answer a change of goal; and all of it beside the same figure
moved by ordinary clips blended by rules.

## A walker made by rules first (the orchestrator's recommendation, 2026-11-24)

The owner, with a second list of projects: "which of these might be a
better open source option? We dont have to use that meta one."

Looked up on GitHub by the orchestrator (the licence each repository
states, nothing more) and read on their public pages by the `nswp-agents`
session (nothing saved or run):

- **The walkers made by rules are free to ship** (MIT) and need no model,
  no weights and no graphics adapter. `three-procedural-locomotion`: a
  two-legged figure by exact two-bone inverse kinematics, feet planted in
  the world, a gait clock; about 12,000 lines, a month old, one author. It
  needs a figure with named leg bones, moves the root itself (where our
  place moves the body), and begins to run at 1.7 m/s where our figures
  walk at 2.4. `threejs-procedural-animals`: animals only, tied to bodies
  it makes, with one idea to take: following a body something else moves.
- **The models are for non-commercial use** (the three.js port and Meta's
  framework, CC BY-NC 4.0 by their own licence files). The port is WebGPU
  only, about 18 MB of weights for two legs, and needs a 23-bone skeleton
  with a figure skinned to it. A training framework that is free to use
  (MimicKit, Apache-2.0) has no runtime for a browser.
- **This machine has a WebGPU adapter by one route** (Chrome with its
  Vulkan settings: the laptop's built-in card), so a model can be
  measured here.

Recommended, and put to the owner: the first working thing with numbers
is a small walker of our own, learned from the first project (two-bone
inverse kinematics, a gait clock, a swing with the foot planted, landing
from the body's velocity, pelvis height and sway: a few hundred lines),
on a figure given two-segment legs made by code, following the body the
place already moves. A model second, read against it, and only shipped if
one is ever free to use. His answer, 2026-11-24: "yes".

## The path chosen (the orchestrator, on the owner's word, 2026-11-24)

Asked which open option was best for the model side, the orchestrator
answered that none is ready to ship. The owner: "ok pick the best path.
You know what im trying to achieve". So, chosen:

1. **The walker made by rules,** ours and small, behind one seam that
   every later body uses: each frame the place hands a body where it is,
   how fast it is going, which way it faces and a manner word; nothing
   above the typed action knows what moves the bones.
2. **A private yardstick:** Meta's three.js port run on this machine
   beside the walker, to learn what a model buys in the counts and what
   it costs in frames. Non-commercial; a named download on the owner's
   word; never committed, shipped or served beyond this machine. If the
   walker is within sight of it, stop here and ship the walker.
3. **Only if a model earns its place:** learned motion matching
   (orangeduck/Motion-Matching: MIT code, small networks, a WebAssembly
   build, no physics engine and no graphics adapter needed), trained again
   on motion whose licence lets us ship. A training job; one page on what
   it needs comes to the owner before any of it.
4. **Not chosen:** physics-driven controllers (MimicKit), for the weight
   of a physics engine at run time and a training project before the
   first step; and anything whose weights could not be shipped.

What it serves, as the orchestrator reads the owner's aim: one general
agent that can be given a body and a world and behave specifically, with
as little written for any one game as will do; open, and able to be
shipped; and measured before believed.

## A wider design the owner handed over, and what is taken from it (2026-11-24)

The owner, with a third document from the other assistant, "BitPortal
Generalized Agent Embodiment System": "Is this a better plan than the
neural?" It proposes rules and inverse kinematics as the default body,
with clips, motion matching and models as optional backends behind one
action interface; bodies assembled from parts (legs, arms, wings, a
tail); a body that declares what it can do; things that declare how they
can be used and where; a manner made of dials (energy, confidence,
tension); a compact state sent between visitors with the motion rebuilt
on each device; and a standard for all of it in the protocol, last.

**The orchestrator's answer: yes as the default, and it is the path
already chosen, drawn much larger.** Its first step is the walker by
rules; its optional model is the yardstick and what follows. Most of what
it says of agents is what the playground has measured: an agent says what
it wants and not which bones; the world checks every action; a refusal
comes back with a reason; things say what they offer; the agent is told
of the world in words and looks only when it must; and it decides when
something changes, not on a clock.

**Taken from it now, into the walker's trial:**

- The seam is its action interface, kept as small as the typed actions
  the playground already has, with an outcome and a reason for each.
- A body declares what it can do, and that is one more of the things a
  skill needs before it offers anything (beside learned, allowed and
  supplied).
- A manner is a few dials worked out from a word on the character's
  sheet. A walker by rules has dials; the house showed that a sentence
  has none.
- After the two-legged walker, **one second body of another shape behind
  the same seam** (four legs, or wheels), before any model. That is the
  cheapest test of whether the seam is general, which is what the owner
  is after.

**Not taken yet, each for a reason:** the many kinds of body and part
(none measured; the second body says whether the first abstraction
holds); reaching and grasping by anchors on things (things here declare
functions, not places for a hand); a physics engine and a path-finder
fetched in (weight in every world, and the kit fetches nothing); rigged
figures from elsewhere (their terms, and our figure has no bones); a
package of files for an agent (an agent here is a sheet and notes, as
`ai-keys-and-agents` has it); and anything for the protocol, which comes
after something works and by names given (fleet rule 11).

## The walker is built and counted (the playground's D77, 2026-11-24)

About 300 lines of our own, behind one call each frame. A planted foot
slides about a centimetre a metre walked, against 190 for legs swung by a
clock; a hundred walkers' legs cost under a millisecond a frame, and 60
frames a second holds with a hundred on this laptop's card. Drawing is
the cost, not legs. The numbers and what they mean are in
`docs/plans/agents-lessons.md`. Next: a second body of another shape
behind the same seam, the body declaring what it can do, and a manner as
dials; then the private yardstick, on the owner's word for that download.

## The second body is built and counted (the playground's D86, 2026-11-24)

Four legs on the same walker, a body that says what it can do, and
manner as dials. A steady pace slides about nothing for both bodies; a
hundred four-legged figures' legs cost 1.8 ms a frame against 1.0 for
two. Found: a long body is pushed sideways at a route's sharp corners (4
to 6 cm a metre against 1), so a world has to round its paths for it;
and an agent asked for what its body can't do does not yet say why. The
numbers and what they mean for a world, the kit and the protocol are in
`docs/plans/agents-lessons.md`. Next, in the owner's order: arm swing,
then reaching.

## Arms swing (the playground's D89, 2026-11-24)

From the same gait clock as the legs, more with speed and with a manner
dial; 100 figures still hold 60 frames a second with the card, at more
drawing. The kit's own figure keeps its arms as the kit draws them. Next,
in the owner's order: reaching.

## Reaching is built (the playground's D90, 2026-11-24)

With that, the order the owner set for bodies (a second body, arm swing,
reaching) is done, free. Where a hand meets a thing is the world's to
say, declared or worked out from the thing's shape. The private yardstick
followed on his "Yes, download it" (D91): the learned walker measured
beside ours on this machine, nothing of it committed or shipped. Ours is
ahead on every count (feet slide a quarter to a sixteenth as much, 60
frames a second at twice the figures, the body staying where the place
puts it). So the third path, learned motion on data that may be
shipped, has not earned its place by numbers; it would have to win on
looks, which the owner has not yet seen.

## Must not

- Ship anything under a licence that forbids commercial use, or fetch any
  of it without the owner's word and the licence read.
- Put motion in the way of a frame.
- Make it a thing a world must have.
