# Billboards: paid ads in worlds that want them, through AdZap

- **Asked:** 2026-11-23. The owner: "another future possibility to use
  bitpotal to drive income. I have a project called AdZap that i think could
  be used to sell in game ads across all worlds that want to support it.
  Think billboards in game."
- **Who:** a written design first; the kit (a billboard a world can place),
  AdZap (the owner's own service, a private repository of its own) and
  BitPortal. Not briefed.
- **State:** asked, as a future possibility. Not a priority.

## What AdZap is today (from its own README, read 2026-11-23)

The owner's service, live at adzaps.net. An ad is one permanent embed code:
a picture address (`/a/<slot>`) and a click address (`/c/<slot>`). What the
slot shows can change without the publisher touching anything. Advertisers
pay in bitcoin (ecash or a Lightning invoice); a click moves sats from the
advertiser to the publisher, less a fee; a Nostr key is the account. It
holds balances itself (it says so: custodial). No script, no frame, no
tracking pixel.

## The idea

A world that wants ads puts up billboards. Each billboard shows an AdZap
slot's picture; a visitor who presses it is taken to what is advertised;
the world's owner is the publisher and is paid for the click. A world that
doesn't want ads has none.

## For the design to settle

- **A billboard as a thing in a world:** part of the kit, so any world, the
  template and another engine can have one. It can be built into a world or,
  once things can be placed (`books-and-shelves`), placed by its keeper.
- **A press leaves the world.** Where it goes is somebody else's site, so it
  is a crossing like any other: the visitor is shown where they are going
  before they go, and can come back. An ad never opens anything by itself.
- **Always marked as an ad,** by the kit and not by the ad, so a billboard
  can't pass for part of the world or for the client's own menu.
- **What may be shown where.** A world has a rating; ads have to fit it. A
  keeper chooses what kinds of ad their world takes; a visitor can block an
  advertiser, and curated lists (BitGate's) can too. A billboard that is
  blocked or doesn't fit is drawn blank.
- **Honest clicks.** A world's owner is paid per click and controls the
  page a visitor is on, so the design says what counts as a visitor's own
  press, and what AdZap does about presses that aren't.
- **What a visitor's device tells AdZap:** showing a billboard fetches its
  picture from adzaps.net, which then knows that device was there. The owner
  has said of pictures in books that a visitor who wants more privacy uses a
  VPN; whether a visitor can also turn billboards off for themselves is for
  the owner.
- **Money:** AdZap holds balances and moves bitcoin, and BitPortal earning
  from ads in other people's worlds is a share of a payment. Both belong
  with the questions already waiting for a lawyer (`the-lawyer` on the
  owner's page: shares, and a service that touches payments).
- **In a headset,** and on a phone: how a billboard is pressed, and that
  leaving the world from a headset ends the session.

## Must not

- Put an ad in a world whose owner didn't choose to have them.
- Let an ad run anything, or draw outside its billboard.
- Tell an advertiser who a visitor is.
