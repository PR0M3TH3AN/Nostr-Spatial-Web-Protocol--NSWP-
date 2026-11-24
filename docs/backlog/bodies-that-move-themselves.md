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
one is ever free to use. His answer is awaited.

## Must not

- Ship anything under a licence that forbids commercial use, or fetch any
  of it without the owner's word and the licence read.
- Put motion in the way of a frame.
- Make it a thing a world must have.
