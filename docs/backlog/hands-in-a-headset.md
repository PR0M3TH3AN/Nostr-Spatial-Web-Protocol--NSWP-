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
- **State:** the first part is decided and in the builder's queue. The
  second and third are asked ("eventually") and not designed.

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
