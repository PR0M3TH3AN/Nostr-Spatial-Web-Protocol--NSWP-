# Our worlds open inside the portal, so signing in is never a popup

- **Asked:** 2026-11-25. The owner, trying the Gallery opened on its own
  address: "Its still using the popup. Why is it not using the embeded
  bitlogin panel?" Then: "can we do both consistently? And make sure the
  copy the world is running is as up to date as the version that we server?
  Like a remote script running?" Then: "which way would be the best user
  experience and keep things most consistent across worlds and work in
  mobile, desktop and VR without any popup or extentions?" Given the NSWP
  builder's and the orchestrator's answer below: "Yes, do that".
- **Who:** the NSWP builder (the kit's half); BitPortal (its shell takes an
  allowed world's address); BitLogin unchanged; the template's worlds set it.
- **State:** asked; agreed by the owner 2026-11-25. Taken after BitLogin's
  release of one sign-in for a whole family (`family`) and the kit's half of
  it (held, for kit 0.92.0). The setting's name is to be given.

## Why it was a popup

By design. A world shows BitLogin's panel only when its client draws one
(BitPortal, which says so when it frames a world). A world opened on its own
address has no client, so it opens BitLogin's window. BitLogin lets only the
portal frame its panel (`/connect/panel/`), on purpose: a world that framed
the sign-in question could cover it with a picture of its own. In a headset
no page shows inside the session at all, panel or window.

## What was agreed

- **A world's maker may name its home client** in the world's settings (a
  name the orchestrator gives; the builder proposes `homeClient`). Our ten
  sites name the portal. A world made from the template leaves it unset
  unless its maker chooses one.
- **At load, a world that names a client and isn't framed by one goes into
  it:** a plain navigation to the client, carrying the world's address, as
  the portal's address already does when it frames a world. So a link to a
  world still lands in that world, inside the portal, and the visitor has
  the same menu and panel from the first moment on desktop and phone. A
  query flag (or the client's own answer) stops it looping; a world framed
  by any client never carries itself.
- **A world that names none stays as today:** BitLogin's window, the safe
  fallback for a world nobody frames. Visitors may still choose their own
  client (BitBrowser, another one, or none); the protocol doesn't change.
- **No remote kit script.** One bad release would break every world at once,
  and whoever served it would control everyone's worlds. Instead: inside the
  portal the menu and the panel are the client's, always live; every kit
  deploy updates all ten of our worlds; other people's worlds update their
  own kit, and `npm run update -- --check` tells them when theirs is behind.
- **In a headset:** sign in once before entering VR, and it carries (the
  `family` grant). A panel inside VR is BitBrowser's later work, so the
  promise is "no popup on desktop and phone; in VR, sign in once before".

## Must not

- Widen BitLogin's `frame-ancestors` for its panel.
- Carry a world that is already framed by any client, or loop.
- Load the kit, the menu or anything else as a remote script.
- Let a world name a client in a way that skips BitPortal's Airlock checks
  for anything not on its list.

## Done looks like

Each of our ten worlds, opened on its own address on a desktop and a phone,
comes up inside the portal at the same world, and signing in shows BitLogin's
panel with no popup. A world with no home client still opens BitLogin's
window. A link copied from inside the portal opens the same world again.
