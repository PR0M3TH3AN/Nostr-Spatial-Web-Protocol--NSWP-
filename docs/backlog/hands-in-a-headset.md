# Hands in a headset: drawn last, a better default, and a world's own

- **Asked:** 2026-11-24. The owner, of the headset menu: "B I think. But we
  need to make sure that the menu is not drawn above the hands in VR." Told
  that today's menu is painted over the hands, he said: "ok lets draw the
  hands last. Eventualy ill want to make the hands a high quality quest
  controller with the blue quest style virtual hand holding it. Like in
  early oculus games. I really liked that design. Games should be able to
  skin hands as well. Using ours as a default and fallback"
- **Who:** the NSWP builder (the kit: `packages/sdk/src/input.ts`, which
  draws controllers and hands, and `console.ts`; the same in the Godot
  add-on). A written design before the second and third parts.
- **And, the same day,** with a picture of what he means and a proposal
  another assistant wrote for him: "Ok lets talk more about the VR
  controlls. Here is what id like to do. Something like this." The picture
  is kept in the sessions' notes folder, `hands/owner-mockup-2026-11-24.webp`:
  two controllers of the Quest's kind drawn as pale see-through shells with
  fine lines over them, each held by a solid, soft blue hand that fades out
  at the wrist, thumbs on the sticks, a finger on each trigger.
- **State:** the first part is built and merged (NSWP PR 485, 2026-11-24,
  the kit and the Godot add-on; not live, and not yet seen in a headset).
  The second and third are asked and set out below; nothing of them is
  built, fetched or briefed. Asked whether the new look should be built
  after the menu's mends or sooner, the owner said, 2026-11-24: "After the
  menu".

## Three parts

### 1. Hands are drawn last (decided)

Today the headset's menu and its Menu button are painted over everything,
hands included (read from the code, in the kit and in the Godot add-on; not
looked at in a headset). The rule, in the owner's words above: hands and
controllers are drawn after the menu and over it, wherever they are held.
The menu is still drawn over the room. It is written into
`docs/plans/headset-menu.md` with a check that can fail. A small kit PR,
needing nothing else settled.

A thing held in the hand stays as it is drawn today, and is the owner's to
judge on the Quest: a large one could hide the menu.

### 2. A better default: a controller, with a see-through blue hand holding it

What a visitor sees for their own hands today is drawn by the kit in its
own plain style, the same for every make of headset. Wanted in its place: a
well-made controller, with a blue, see-through hand around it, as early
Oculus games drew them. It is the default, and what a world falls back to.

### 3. A world may give hands a look of its own

A game dresses the hands to suit itself, with the kit's as the default and
the fallback. Today a world can only turn the kit's hands off and draw
everything itself (`models: false`); there is no way to say "these hands,
here" and keep the kit's handling.

## The proposal he handed over, and what the orchestrator makes of it

**What it proposes:** not to model controllers from scratch. Take the
controller and hand models the WebXR group publishes (the "WebXR Input
Profiles" project: a model for each make of controller, with a list of
which part moves for which button, and a standard hand of 25 joints), load
the one that matches the visitor's hardware, draw every controller with
one see-through shell material and every hand with one blue material, and
move the hand's fingers from what the controller reports (a thumb on a
stick or button, a finger on the trigger, a squeeze). A tracked hand with
no controller is the same blue hand moved by its real joints. The
controller is put away while something is held. Labels on the controls
that say what each does here. In the kit, for every world.

**It is the right shape,** and most of it fits what is here: the kit
already draws controllers and hands itself in one place (`input.ts`), hands
are about to be drawn through one function that a model would pass through
too, and "ours as a default and fallback" is the same idea.

**Not checked by anyone here:** the proposal's claims about licences, which
controllers have models, and other makers' headsets. It says the models
are under the MIT licence; that is read from the files themselves before
anything is fetched.

**Where it meets rules we hold:**

- **No model comes from someone else's server while a visitor plays.** The
  usual way to use these models fetches them from a public file host as
  the session starts, by the controller's name. That tells a third party
  which headset each visitor owns, and it is a request to a site that is
  not the world's. The kit draws its own controller today for exactly this
  reason. So: the models are carried with the kit and served by the
  world's own site, fetched only in a headset and only the one needed. A
  world's page is told the controller's kind by the browser anyway, so its
  own site learns nothing new.
- **Fetching the models is a download,** and the owner's own word, after
  the licence is read: which package, which version, how large.
- **A model's licence must allow a world that sells things.** One of the
  newer headsets' controllers is published only for non-commercial use;
  that one is left out, and gets the kit's own plain controller.
- **The fall-back is a chain:** the visitor's own controller's model; a
  plain one of the same layout; the kit's own drawn controller as today.
  Never nothing.

**The real work is the hand, not the controller.** No published set says
where a hand's fingers rest on each controller. Each make needs its own
grip and its own places for thumb and finger, made by hand and tried in
that headset. Only the Quest 3S can be tried here.

**In what order, if it is built:**

1. The blue hand for tracked hands, and the Quest's own controller as a
   see-through shell with the blue hand around it in one fixed grip. The
   look, on the one headset that can be tried. Lines along a model's
   edges, not every triangle: cleaner, and cheaper on a headset.
2. Fingers that move: thumb to the stick or the button it touches, a
   finger on the trigger, a squeeze.
3. Other makes of controller, each by its own model and a grip that
   someone with that headset has tried; until then the plain one.
4. A world's own hands; and labels on the controls.

The Godot add-on draws its own hands: the same look there is a second
piece of work, or said plainly that it is not done.

## For the design to settle

- **Ours, made here.** The look is a style to work in, not a model to copy:
  the controller and the hand are modelled for the kit. If a model from
  anywhere else is ever wanted, its licence is read first and fetching it
  is the owner's own word.
- **Nothing is fetched to draw a hand, and no request says which headset a
  visitor owns.** That is why the kit draws one controller for every make
  today. A Quest's controller shown to everyone keeps to it; a different
  model for each make, fetched as needed, does not. Carried in the kit, it
  costs every world its size, on a phone too: say the size.
- **The hand moves with the buttons:** a finger on the trigger, a squeeze
  on the grip, a thumb on the stick, as those games had it. And a tracked
  hand with no controller: the same blue hand, by itself.
- **What a world's hands are:** models for left and right, where they sit
  on the grip, and what moves when a button is pressed. As data a world
  declares, or as code it runs. The names are given, not taken (fleet rule
  11).
- **The fallback is real:** a world's hands that fail to load, are too
  large, or draw nothing leave the kit's own in place, at once.
- **What a world's hands may not do:** hide the menu or the visitor's own
  controls (drawn last cuts both ways: a hand the size of a wall covers
  everything), or stand in for the pointer so a press lands where the
  visitor didn't aim. A least and a most size, and the pointer always the
  kit's.
- **The Godot add-on and other engines:** the same default there, or said
  plainly that it is not.
- **How it is tried:** in a made-up headset first, then the owner's Quest
  3S, which is the only place the look can be judged.

## Must not

- Fetch a model, or copy one from a game or a maker's kit, without its
  licence read and the owner's word.
- Let a world's hands be drawn over the visitor's own controls so they
  can't be used.
- Take a name for what a world declares.
