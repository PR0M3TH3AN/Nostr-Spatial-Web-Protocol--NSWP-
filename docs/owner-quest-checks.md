# Waiting for the owner's Quest 3S

**What this is.** Every check that only the owner's own headset can make,
in the order to make them, each with what to do and what to say back. Kept
by the orchestrator. Written on 2026-11-24, when the owner said: "can you
document this quest check i need to run. Ill have to wait until i get off
work. So i dont want it lost".

Say the answers in the orchestrator's session (the NSWP one), in any words.
A "no" is as useful as a "yes". Nothing here needs an account, and none of
it sends anything anywhere.

The first two are new and want doing first. Together they take about ten
minutes. The rest are older and can be done on the same evening or another.

## 1. Can the Quest's browser make the menu's picture? (five minutes; asked 2026-11-24)

**Why:** you asked for the flat screen's menu in the headset, and chose B
(1.0 m wide). The plan is for the headset to show the flat menu's own
picture, made by the browser, so there is one menu and not two drawings.
Chrome on a desk can do it. Whether the Quest's browser can is not known,
and the build waits on this answer.

**Needs:** this laptop on and awake, and the Quest on the home network. The
page is served from the laptop only; it is not on the internet and is never
deployed.

1. Put the headset on, open its browser, and go to:
   `https://192.168.68.84:4301/trial-pages/quest-picture/`
2. The first time, the browser warns about the certificate. Before
   accepting, check the fingerprint it shows is this one:
   `87:A5:B3:64:44:5C:C9:BD:30:54:52:ED:BB:50:FB:12:39:C7:4A:95:DE:17:78:23:81:FC:E8:D8:59:B8:B8:D2`
3. Nothing to press. The page answers in a second or two. Say what it says:
   - **"Yes." in green:** the two times in milliseconds, and whether the
     right-hand box looks like the left-hand one (the words, the two drawn
     icons, the round corners, the slider).
   - **"No." in red:** the whole line, with "Step that failed:" one, two or
     three.
   - **"Not started." still there after a few seconds:** say that.
   - And the last line, "This browser says it is:", as far as its first
     number.

**If the address doesn't answer:** the laptop's address on the network, or
the certificate, may have changed. The service prints both as it starts,
and those are the ones to trust. Ask the orchestrator for them, or on the
laptop run:

```bash
journalctl --user -u nswp-local-sites -n 40 --no-pager
```

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

The mend is merged (NSWP PR 485, the kit and the Godot add-on) and not
live. After it is live this is done once more, to see the hands in front,
in the Gallery and in the Foundry. The orchestrator will say when. Then also: hold something large from your
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
Quest in developer mode, a USB cable to this laptop, and the debugging
prompt accepted in the headset. Then say yes to installing **in the
BitBrowser session**, not here. That session checks the headset shows up,
and that no Wolvic is on it, before it installs anything.

## Not the Quest, but also yours by hand: full screen and BitLogin's panel

Once the kit version after 0.87.0 is live. On a desk, in BitPortal's room
or any world through the portal: turn "Desk controls" to intense, go full
screen, open the menu, press "Sign in, at bitlogin.network" (or Your
account, Your files, Your purchases). **It should** let you use the panel
with the mouse at once, with no Escape, the world still behind it, and
full screen still on. Close the panel and press once in the world: the
mouse looks around again. No scripted browser can go full screen, so
nobody has seen this part.

## Kept current

The orchestrator takes a check off this page when its answer is in, and
adds one the day it is asked for. The same list is on the owner's page.
