# Everything a flat screen can do, a headset can do

- **Asked:** 2026-11-25, by the owner: "we need to make sure every tab and
  function that flat screen can do, VR can do too. So this includes,
  files, purchases, sending and receiving bitcoin, etc. That is the entire
  point of this entire app."
- **Who:** the NSWP builder (the headset menu, `outOfVr`); BitLogin (its
  screens, a headset purse); BitPortal (the shell); BitBrowser (a trusted
  panel in VR).
- **State:** asked; the ways below put to the owner.

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
2. **A headset purse** (proposed): a small amount moved from the wallet to
   the headset, with a cap the owner sets, spent in VR with no step out
   for tips, items and small buys. A world could at worst trick away what
   is in the purse, never the wallet. Built on device keys (Way 2).
3. **A trusted panel in BitBrowser** (on BitBrowser's TODO, 2 to 4 weeks,
   the risky piece): our own browser draws BitLogin's real pages in VR as
   its own panel, which no world can draw over, so the wallet, Files,
   buying and sign-in stay in VR safely. Only in BitBrowser.

## Must not

- Draw BitLogin's wallet, Files or approvals in a world's page.
