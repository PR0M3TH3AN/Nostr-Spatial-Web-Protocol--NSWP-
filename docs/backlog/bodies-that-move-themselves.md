# Bodies that move themselves: animation made by a small model, driven by what an agent decides

- **Asked:** 2026-11-24. The owner, handing over a proposal another
  assistant wrote for him: "what do you think of something like this as a
  part of our AI agent system? The animation component driven by our
  agents logic."
- **Who:** nobody yet. A look first (the owner's, in a browser), then a
  written design. It would touch the kit (figures), the playground
  (`nswp-agents`) and whatever own models for figures become.
- **State:** asked. Nothing fetched, built or tried. Part of
  `ai-keys-and-agents`, which is last and not a priority; and it stands
  behind `avatars-own-models`, since a figure today has no skeleton.

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

## Must not

- Ship anything under a licence that forbids commercial use, or fetch any
  of it without the owner's word and the licence read.
- Put motion in the way of a frame.
- Make it a thing a world must have.
