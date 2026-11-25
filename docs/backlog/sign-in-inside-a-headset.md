# Signing in from inside a headset

- **Asked:** 2026-11-25, by the owner, in his Quest on the live sites: "in
  VR i cant seem to login with Bitlogin. The live sites menus in VR look
  old. They should look the same."
- **Who:** a design first (the orchestrator with BitLogin, the owner
  choosing); then BitLogin and the kit. The menus' half is
  `headset-menu-like-the-flat-one`, already designed.
- **State:** way 2 chosen by the owner, 2026-11-25 ("yeah lets build that",
  after the phone pairing was described to him). BitLogin designs the
  pairing first, to the orchestrator; then BitLogin builds it and the kit
  draws the code and QR in the headset menu, by names given.

## Why it can't today

A headset shows only what the world draws itself (WebXR has no way to show
a web page's own elements in a headset). BitLogin's sign-in, its window
and its panel, are pages of bitlogin.network, so they can't be seen there,
and a world must never draw a sign-in itself: whatever is typed into a
world's page, the world could read. So today the kit says "Leave the
headset view for a moment, sign in, and come back in."
(`packages/sdk/src/ui/identity.ts`).

## Ways (the orchestrator's, for the owner)

1. **A guest needs no sign-in at all** (live in BitLogin since a76ff51;
   worlds take it up with kit 0.92.0 and BitPortal's guest work). Someone
   who arrives in a headset is already themselves, the same guest in
   every world, with a Bag.
2. **Sign in with your phone** (recommended, as TVs and headsets do it):
   in the headset, the menu's Sign in shows a short code and a QR code,
   drawn by the world, holding nothing secret. On a phone or computer
   where they are signed in at bitlogin.network, they open
   bitlogin.network/pair (or scan) and say yes to "Sign in this headset?".
   BitLogin then gives the headset's signer a grant, as it does a site,
   and the headset is signed in, never having left the world. Nothing
   secret is typed in the headset or crosses through the world.
3. **Leave VR for a moment,** as now: the fallback where no other device
   is to hand.

## Continue on phone: securing the headset's guest (asked 2026-11-25)

The owner: "can we do like a "continue on phone" to secure the account that
the headset is using?" A guest in a headset presses **"Continue on phone"**;
after the same code and number matching, the headset hands its guest to the
phone, which runs the ordinary "Secure this account" (login name, password,
recovery phrase, typed and written down there). The headset is then that
account, the same key and everything of the guest kept, never having left
VR. BitLogin designs it first, against its pairing (feef753). It never
merges a guest into an account the phone is already signed in to (the
owner: no merging).

## Where it stands (2026-11-25)

- **The in-world pairing (feef753) is paused** (BitLogin 1fa173d, the
  owner's "Yes, pause it now"): a hostile world could draw another
  device's code and number and be handed the key.
- **Way 1 is live** (BitLogin 6983e66, the owner's "Yes, release
  6983e66"): the code, QR and number only on BitLogin's own
  `bitlogin.network/headset/`, opened from the world's "Sign In using
  Phone" in the press that leaves VR; the phone asks of every code whether
  its address bar says bitlogin.network. The kit wires the press next
  (`outOfVr`).
- **Way 2, device keys, the core to be built** (the owner, "Yes, build the
  core"): `docs/plans/headset-device-keys.md`; kinds 27305 (the grant,
  carried) and 37312 (`nswp-devices-out`, the sign-out list) given. The
  kit's three parts, then BitLogin's half. The Bag, scores, saves and
  public notes stay with the phone.

## Must not

- Draw a password or recovery phrase field in a world, or pass one through
  a world's page.
- Let a code be used twice, or for longer than a few minutes, or for
  anything but signing in that one headset's signer, BitLogin saying
  which site and which device before the yes.
