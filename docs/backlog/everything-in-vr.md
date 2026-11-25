# Everything a flat screen can do, a headset can do

- **Asked:** 2026-11-25, by the owner: "we need to make sure every tab and
  function that flat screen can do, VR can do too. So this includes,
  files, purchases, sending and receiving bitcoin, etc. That is the entire
  point of this entire app."
- **Who:** the NSWP builder (the headset menu, `outOfVr`); BitLogin (its
  screens, a headset purse); BitPortal (the shell); BitBrowser (a trusted
  panel in VR).
- **State:** chosen by the owner (below): a choice of 2D (safer) or VR (riskier), BitBrowser's trusted panel in parallel, no purse.

## What stands in the way

In immersive VR a browser shows only what the world draws. BitLogin's
screens (the wallet, Files, purchases, sign-in, Allow) hold your keys and
money, so a world must never draw them: whatever a world draws, it could
fake, and whatever you see there, it could read. So in an ordinary
browser such as the Quest's own, those screens can't be in VR itself.

## Ways, and what each gives

1. **Every tab in the headset menu, and every function one press away**
   (being built): the headset menu has every tab the flat menu has
   (`headset-menu-like-the-flat-one`); a press that needs BitLogin goes
   out to its real page and back in one press (`bitlogin-from-a-headset`,
   `outOfVr`). Everything works from a headset; the wallet, Files and
   buying step out of VR for a moment.
2. **A headset purse** (dropped by the owner): a small amount moved from the wallet to
   the headset, with a cap the owner sets, spent in VR with no step out
   for tips, items and small buys. A world could at worst trick away what
   is in the purse, never the wallet. Built on device keys (Way 2).
3. **A trusted panel in BitBrowser** (on BitBrowser's TODO, 2 to 4 weeks,
   the risky piece): our own browser draws BitLogin's real pages in VR as
   its own panel, which no world can draw over, so the wallet, Files,
   buying and sign-in stay in VR safely. Only in BitBrowser.

## The owner's choice (2026-11-25)

"Yes Both in parallel. instead id rather have the option to do it in 2D as
being more secure or VR being more risky. The user should have the option
to choose between safty and convenience. And the menus in VR should look
the same or better than the flat screens. VR is not an additional feature.
It is the entire point. No small in-vr purse thing. I dont like that kinda
stuff"

So:

- **No headset purse** (way 2 is dropped).
- **A choice for the visitor, safety or convenience:**
  - **In 2D, safer** (way 1): BitLogin's real page, one press out of VR
    and one back. The default.
  - **In VR, riskier:** the wallet, Files, purchases, sending and
    receiving drawn in VR by the world from what BitLogin hands it, with
    the approvals made in VR. The visitor turns it on themselves, on
    BitLogin's own page (never from a world), for the worlds they choose,
    told plainly what it risks (a world they let in could show them
    anything and act on their wallet and files), and can turn it off
    there.
- **BitBrowser's trusted panel** (way 3) in parallel: in BitBrowser, the
  VR way is also the safe way.
- **The headset menu looks the same as the flat one, or better**, every
  tab in it; not a lesser menu.

## Must not

- Draw BitLogin's wallet, Files or approvals in a world's page unless the
  visitor turned the VR way on for that world on BitLogin's own page.
