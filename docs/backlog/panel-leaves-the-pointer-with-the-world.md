# BitLogin's panel comes up over a world that still holds the pointer

- **Asked:** 2026-11-24, by the owner, of what is live: "im noticing the
  bitlogin panels force me to hit escape again to use. The game just playes
  behind them when im trying to use the menus. But when i hit escape the
  game exits full screen."
- **Who:** the NSWP builder (the kit: the mend). BitPortal (making it
  happen in the real shell with BitLogin's real panel, and a check in its
  own trial).
- **State:** mended in the kit (NSWP PR 500) and **live since kit 0.88.0**,
  deployed 2026-11-24 on the owner's word ("Yes deploy"). Run against the
  live portal and the live Grove after the deploy, BitPortal's trial says
  the world no longer holds the pointer under the panel and nobody moves;
  and with the trial made to wait until the panel is still, BitPortal's
  own run against the live sites is 42 of 42 (the orchestrator's, 41 of 41
  with one not judged). The orchestrator's first reading, that the trial
  could not hear inside the live panel, was wrong: it pressed too soon.
  Found beside it, BitPortal's and not tried by a person: a press in the
  panel within a second or so of it appearing or growing is handed to the
  page above as a press on the panel's frame, and is lost. The panel grows
  just after it appears (305 to 566 px for signing in), which lengthens
  that moment. Whether the frame can come up at its final size is asked
  of BitPortal. BitPortal's own trial in the real shell with BitLogin's real
  panel (its PRs 218 and 219) failed 20 of 42 on kit 0.87.0 and passes 42
  of 42, twice, against the mended kit on the orchestrator's own server.
  Not tried by anyone: full screen, which no scripted browser enters. For
  the owner by hand once it is live: full screen on, the row pressed, the
  panel used with no Escape, full screen still on.

## What happens

Looking with the mouse, in full screen, the world holds the pointer. A
panel of BitLogin's comes up over the world (to sign in, the wallet, a
question to sign) and the world goes on holding the pointer and reading
the keys. Nothing in the panel can be pressed until Escape, and the
browser's own Escape also ends full screen, which no page can prevent.

## Made to happen on demand (BitPortal, 2026-11-24)

The world gives the pointer up for its menu, and takes it back as the
panel comes up. In the Grove at kit 0.87.0, framed by the shell, with real
presses: desk controls set to intense; the menu opened (the pointer is
let go); the row "Sign in, at bitlogin.network" pressed. Then the panel is
up, the world's menu is closed, and the world holds the pointer again. A
press at the panel's middle is heard by the world and not by the panel,
and W and the mouse walk and turn the visitor. The same for "Your
account", "Your files" and "Your purchases". With desk controls casual it
does not happen. A world opened by itself shows no panel at all.

Why, from the kit's source: when the client says the panel is up, the
menu steps aside; closing the menu makes the mouse-look ask for the
pointer again, and the browser grants it, the visitor having just
pressed. Nothing in the mouse-look knows the client's panel is up, though
the kit already records it. So the mend needs no new word: the mouse-look
takes no pointer while a panel is up, lets go and drops held keys as one
comes up, and reads no movement until it is gone.

Not shown: full screen (the scripted browser would not enter it); the
panel asked for with the menu closed; the shell's own menu on; a world in
another engine.

## A pointer given late (found 2026-11-24, after 0.88.0)

The mend in 0.88.0 let the pointer go as the panel came up. It missed a
pointer asked for and not yet given. Under a client that has the menu, the
menu's going makes the world ask for the pointer; where the panel is said
up before the browser has given it, there is nothing yet to let go, and
the browser then gives it under the panel. `trials/panel-pointer.mjs`
showed it on a loaded machine, one run in five. Mended in `fps.ts`: a
pointer given while the panel or the menu is up is let go at once, and
with the panel up the mouse turns nothing. The trial has a round that
holds every asking for the pointer back 150 ms, so it fails every time
without the mend. The same held for a world's own menu, put away and
brought up again inside that moment.

## Why, as first read (not run)

The kit lets the pointer go in one place (`fps.ts`), on four things: the
visitor's Escape; the menu coming up, the kit's own or the client's
`open: true`; mouse-look being turned off; a headset session. Asking for
the sign-in address's page (`signer.unlock()`) is none of them, and the
words between a world and its client have nothing for "a panel of the
client's is up over you".

## Wanted

- Escape is never needed. As a world asks for a page of the sign-in
  address to be shown over it, it lets the pointer go, which does not end
  full screen, and the press that asked does not take it straight back.
- With the panel away, the next press in the world takes the pointer
  back, as after the menu.
- A panel the client brings up by itself, with no sheet up: if that can
  happen, the client says so to the world, by `open` if that can carry it
  or by a word given for it (rule 11).
- A trial with real presses that fails today: the panel up, no Escape
  pressed, a press at the panel's place lands in the panel, the visitor
  has not moved or turned, full screen still on.

## Must not

- End full screen.
- Leave a world reading keys while a panel has the visitor's attention.
