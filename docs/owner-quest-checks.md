# Waiting for the owner's Quest 3S

**What this is.** Every check that only the owner's own headset can make,
in the order to make them, each with what to do and what to say back. Kept
by the orchestrator. Written on 2026-11-24, when the owner said: "can you
document this quest check i need to run. Ill have to wait until i get off
work. So i dont want it lost".

Say the answers in the orchestrator's session (the NSWP one), in any words.
A "no" is as useful as a "yes". Nothing here needs an account, and none of
it sends anything anywhere.

Check 1 is struck (below, with why). Check 2 is the one to do first; it
takes two minutes. The rest can be done on the same evening or another.

## 1. Struck, 2026-11-25: the Quest's browser making the menu's picture

**Not needed any more.** The headset now draws the menu itself, from the
same description as the flat menu, which works in every browser
(`docs/plans/headset-menu.md`), so nothing waits on this answer. The page
for it, `trials/pages/quest-picture/`, still works if you're curious.

## 2. Is the menu drawn over your hands? (two minutes; asked 2026-11-24)

**Why:** you said "we need to make sure that the menu is not drawn above
the hands in VR", and then "ok lets draw the hands last". Read from the
code, today's headset menu is painted over the hands. Nobody has looked in
a headset.

1. On the same visit, go to `https://192.168.68.84:4301/` (the Gallery's
   local copy), or to `https://gallery.bitblocks.network/` (the live one,
   kit 0.87.0). Either will do.
2. Enter VR and open the menu (the Menu button low in front of you, or
   hold B or Y for a moment).
3. Hold each hand in front of the menu, then to its edges.

**Say:** whether the menu is drawn over your hands; and whether hands held
at rest are in the way of reading it.

**The mend is live since kit 0.88.0** (deployed 2026-11-24), in the kit's
worlds and in the Foundry. So on the live Gallery
(`https://gallery.bitblocks.network/`) and the Foundry
(`https://foundry.bitblocks.network/`) your hands should now be drawn in
front of the menu wherever you hold them. The laptop's local copy at
`:4301` is whatever was last built there and may still show the old way:
use the live sites for this one. Say whether your hands are in front, in
both. Then also: hold something large from your
Bag in front of the menu, and say whether it hides too much.

## 3. The menu in a Godot world (five minutes; live since kit 0.87.0)

At `https://foundry.bitblocks.network/`, in VR:

1. Press B or Y. **It should** open the menu in front of you.
2. Point at a row and press the trigger. **It should** do what the row
   says.
3. Find the row that leaves VR and press it. **It should** end VR with the
   page in front of you.

**Say:** whether B or Y opened it, whether rows could be pressed, whether
the words could be read, and whether the way out worked.

## 4. Moving in a Godot world (ten minutes; live since kit 0.86.0)

At `https://foundry.bitblocks.network/`. Each should be the same as in the
Grove.

1. Enter VR: two hands show where yours are.
2. Push the left stick forward and hold: a ring on the floor where you
   point. Let go: the view fades and you are there.
3. Point at a wall, or past the floor's edge, and let go: you don't move.
4. Pull the left stick back: a step back of about a metre, with the fade.
5. Flick the right stick: a notch turn each flick.
6. Point at a door from close by and press the trigger: it lights, then
   takes you through.
7. In the page's menu before entering, choose the intense way, then enter:
   smooth walking with the left stick, smooth turning with the right,
   stopping at walls.

**Say** any that did not happen. If pushing forward steps you back, say so:
it is one number to flip.

## 5. The casual fade (five minutes; live since kit 0.83.0)

In any world, for example `https://grove.bitblocks.network/`: enter VR and
choose casual.

1. Point at the floor and press: a blink of black, then you are there. The
   floor never slides.
2. Stick back: one step back, the same blink.
3. Flick the other stick: a notch turn, no blink.
4. Menu, Moving, "The view fades when you step. Turn that off", then step:
   no blink.
5. Switch to intense and walk: smooth, never dark.

**Say** if the blink is too long, too short, or flickers. It is about 120
ms each way and can be tuned from what you see.

## 6. Smooth walking through a door, and the door icons (five minutes)

In BitPortal's room, `https://portal.bitblocks.network/walk/`: enter VR,
pick "Intense" when it asks, walk through a door.

**Say:** whether you are still walking smoothly on the other side; and
whether the icons on the doors, or anything else, are too small to read.

## 7. BitBrowser's first build (not a check: a set-up, in its own session)

The first BitBrowser build for the Quest is ready to install. It needs the
Quest in developer mode, a connection to a computer, and the debugging
prompt accepted in the headset. This laptop's USB ports don't work for it
today (their USB 2 half is switched off at every boot), so it is a USB 3 data
cable in one of its USB-C ports, or another computer. Then say yes to installing **in the
BitBrowser session**, not here. That session checks the headset shows up,
and that no Wolvic is on it, before it installs anything.

## 8. The Menu button is the mark (one minute; once the kit with it is live)

In any world in the headset, with the menu put away: the floating Menu button, where no hand is tracked, is now the
same tile as the corner button on a screen. A rounded glass tile, an arch lit in the world's colour on a short
light line, and **no words**. Aim at it: its edge lights in the world's colour. Press: the menu opens.

- Say: whether you can tell it is the menu from the mark alone, and whether it reads well at that size.
- Nothing changes on the wrist: raising it opens the menu as before.

## 9. The artist's hands, on your controllers (two minutes; on the live site, once the kit with them is live)

**Why:** the 3D artist's see-through hand holding a see-through controller, for each side (bitportal-art
c30f660, with the smaller trigger pull you chose), is now the kit's own drawing for a Quest's
controllers in every world. You said: "Use the live game as the testing ground. Ill let you know if
they feel off". So there is nothing to set up: once the kit with them is live, go into any world in
the headset.

1. In any world, holding both controllers, press **Enter VR**.
2. Look at your hands. Pull each trigger slowly, squeeze each grip, and put your thumb on A, B (X, Y
   on the left), the stick and the thumb rest in turn.

- Say: whether the hands and controllers **look right** (size, where they sit in your grip, the
  see-through look), and whether each finger and the thumb **follow** you. "They feel off" is enough,
  with what is off.
- Bare hands (a controller put down) are drawn as before, as joints: only held hands are new.
- Still open, only if you want it answered: which profile your controllers report (touch-plus or a
  v2). The kit draws the same hands for either, so nothing waits on it. The trial page that reads it
  out is kept (`trials/pages/quest-hands/`) for a day you want to run it.

## 10. A window over VR, in BitBrowser (five minutes; once its build is on the headset)

**Why:** in VR no browser shows a page's own windows, so BitLogin's sign-in
can't appear while you're in a world. BitBrowser's first try at fixing that
(its `docs/trusted-panel.md`) shows a window a page opens from inside VR as
a panel in front of you, with the world still running behind it and your
controllers drawn over it. It is built and has never run on a headset.

**Needs:** BitBrowser's panel build installed on the Quest
(`bitbrowser-panel-m1-2026-11-25.apk`, from the BitBrowser session; how it
gets onto the headset is being worked out), this laptop on and awake, and
the Quest on the home network. The page is served from the laptop only; it is
not on the internet and is never deployed.

1. On the Quest, open **BitBrowser** (it shows as Wolvic, in the app library
   under Unknown sources), not the Quest's own browser.
2. Go to `https://192.168.68.84:4301/trial-pages/bitbrowser-panel/`. The
   first time, accept the certificate warning as for check 1.
3. Press **Enter VR**. The room is one colour that slowly changes.
4. Pull the **trigger**. A white window should open in front of you.
5. Try its text box, then its **Close** button with the trigger. Then open
   it again and close it with the left controller's **Menu button** (≡).
6. Leave VR and read the log on the page.

**Say:**

- whether the window appeared in VR, or you were dropped out of VR, or
  nothing happened;
- whether the room kept changing colour behind it;
- whether your controllers were drawn over the window, under it, or not at
  all;
- whether you could read its text without leaning in, and whether it was too
  high, low, near or far;
- whether Close and the Menu button each closed it;
- the log's lines (a photo of the page is fine).

Say it in the BitBrowser session or here; either passes it on.

## 11. Sign In using Phone, and Back into VR (five minutes; on the live site, once the kit with it is live)

**Why:** you said the only things that should take you out of VR are pairing your phone and the browser's limit
between sites. In a headset, Sign in is now "Sign In using Phone": one press takes you out of VR to BitLogin's own
page, and one press brings you back where you were. A made-up headset can't say whether the Quest's browser lets a
press inside VR open a window, so this is the check.

1. In any world, signed out (or as a guest), in VR, open the menu, You, and press **Sign In using Phone**.
2. You should see BitLogin's page with a code and a QR code, outside VR, at once. If instead you see the world on a
   flat screen with **Open BitLogin**, press it: that is the browser refusing the window from inside VR.
3. Pair with your phone as BitLogin's page says. It closes itself when you're signed in.
4. Press **Back into VR**.

- Say: which of the two you saw at step 2 (BitLogin's page at once, or Open BitLogin).
- Say: whether you were back where you stood, facing the same way, with the same thing in hand.
- Say: whether the menu now says you're signed in.

## 12. The flat screen's menu in your headset (five minutes; on the live site, once the kit with it is live)

**Why:** you said "Yes, build it" to the headset menu that is the flat screen's own, every tab, 1.0 m wide with the
bar under it. It is built behind a switch in the address until the rest of it is in, so you can try it first:
`?menu=sheet` after any world's address (for example `https://gallery.bitblocks.network/?menu=sheet`).

1. Open that address in the Quest's browser, enter VR, and open the menu (the Menu button, or hold B or Y).
2. Read a row without leaning in. Point at tabs and rows: each comes forward a little as you point at it.
3. Press a tab, then a row (Sound, then Effects, say). Point at a key on the bar under the menu.
4. On a long tab, point at the menu and push a thumbstick up or down: the list scrolls, and you don't move.
5. Hold each hand in front of the menu, at its edges and middle, and over the bar.
6. Press Close.

- Say: whether you could read it without leaning in, and whether it is too big, too small, too near or too far.
- Say: whether the coming forward feels right, too much or too little, and whether it flickers when your hand shakes.
- Say: whether your hands were ever covered by any part of it.
- Say: whether it looks "the same or better" than the flat screen's.

Typing into a row, a song's bar, rows that take a file, the chat panel, and the engine-made worlds (Godot) come in the
next pull requests; then it is the menu everywhere without the switch.

## Not the Quest, but also yours by hand: full screen and BitLogin's panel

Live since kit 0.88.0 (deployed 2026-11-24). On a desk, in BitPortal's room
or any world through the portal: turn "Desk controls" to intense, go full
screen, open the menu, press "Sign in, at bitlogin.network" (or Your
account, Your files, Your purchases). **It should** let you use the panel
with the mouse at once, with no Escape, the world still behind it, and
full screen still on. Close the panel and press once in the world: the
mouse looks around again. No scripted browser can go full screen, so
nobody has seen this part.

On the same visit, for how soon the panel hears you: over a world, press
"Sign in, at bitlogin.network" and click in the middle of the panel at
once, and again every half second. Say roughly how long it was before a
click did something. On this machine under load the scripted count ran
from under three seconds to never in seven, and followed the load more
than anything the panel changed, so your own hand is the measure.

## Kept current

The orchestrator takes a check off this page when its answer is in, and
adds one the day it is asked for. The same list is on the owner's page.
