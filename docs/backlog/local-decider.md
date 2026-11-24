# A decider that runs on the visitor's own device

- **Asked:** 2026-11-24. The owner, handing over a proposal written for him
  by another assistant (one small model, downloaded once, kept running in
  BitPortal's shell and asked by every world): "ok i would like to talk
  about the potability for a local JEV alternative and test to see if it
  will even work. Normal API Jev works so we know that. But what do you
  think of something like this as a potability? Or a fallback if enabled?"
- **Who:** a test first, in the `nswp-agents` playground (step 1 briefed
  2026-11-24). Then a written design: BitPortal's shell (where it would
  run), the kit (the words a world asks in), the protocol.
- **State:** the first step of the test is briefed to the `nswp-agents`
  session (the owner, 2026-11-24: "Yes, brief the agents session on the
  local model test"). Nothing downloaded, built or tried: which model is
  not yet named, and each download is his own word in that session. Part
  of `ai-keys-and-agents`, which is last and not a priority.

## The idea

A small model that chooses among a world's typed choices, as JEV does, run
in the visitor's browser on their own graphics card. BitPortal's shell
stays one page while worlds come and go in its frame, so one copy could
stay loaded and answer every world. Nothing a visitor does would leave
their device, and it needs no key and no credit.

## What it would be for (the orchestrator)

One of three deciders behind the same question, and the runner always
says which answered:

1. **Rules:** always there, free, and better than any decider on a fast
   task (`docs/plans/agents-lessons.md`, the two ranges).
2. **On the device:** if the visitor turned it on and the device can.
3. **A service** (JEV by the visitor's key, or later by subscription).

It answers a fault found the same day: a decider refused for want of
credit left an agent with nothing but a silent fall-back. And it is what a
guest could have, who may spend nothing.

It fits where a decider was measured to fit: slow choices that need words
understood (the house, where a choice stays good for five seconds and
only a quarter of decisions are asked at all). It is not for the range.

## The test, cheapest first

1. **Can a small model choose as JEV does, at all?** Free of any provider:
   the playground's own checked tasks (the narrowed orders, 6 of 6 in two
   rooms; the house with code choosing the need, against the two free
   baselines), asked of a local model on this machine. Needs one download,
   which is the owner's own word for a named model, its size, licence and
   source.
2. **In a browser tab,** on the graphics card: time to first answer, time
   for each answer, memory, and frame times of a world drawn beside it.
3. **In the shell with a world in its frame,** through a door and back:
   one copy stays, and the world's frames hold.
4. **On the Quest 3S and a phone:** whether it loads at all, heat and
   battery, and frames in a headset while it answers. This is the owner's.

Stop at the first step that fails, and say so.

## For a design to settle

- **Which model.** JEV is a service; whether its maker publishes anything
  to run is not known here. Another small model has to be shown to choose
  well among typed actions, and to give a lean for each choice, not only
  one answer.
- **It answers with a choice, never with words.** What a world sends is a
  stranger's words going into a model; what comes back is one of the
  world's own choices and a lean. No text from it is shown or run. Talking
  is a different and larger model, and a different entry.
- **A world can't run a visitor's device down:** asked for on first use in
  each world, a ceiling on how often, stopped when the visitor leaves, and
  shown while it works, as credit would be.
- **Nothing waits on it to draw a frame.** It shares the graphics card
  with the world. In a headset a dropped frame is a comfort fault.
- **The download:** hundreds of megabytes, the visitor's own choice, kept
  for this site, said with its size before it starts.
- **Where it runs:** the shell, not the sign-in address (it holds no
  secret), and not a world. A world opened by itself has rules only.
- **The words between a world and the shell,** and any capability word,
  are given, not taken (fleet rule 11).
- **What a device says of itself:** whether "can run it" tells a world
  anything about the visitor's hardware. It should learn only "answered"
  or "not".

## Must not

- Download a model without the owner's word for that model.
- Let a world start it, or learn what the visitor's device is.
- Show or run anything the model writes.
