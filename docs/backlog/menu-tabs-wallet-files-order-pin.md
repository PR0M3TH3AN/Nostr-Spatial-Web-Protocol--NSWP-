# Wallet and Files as their own tabs; tabs the visitor can reorder; one pinned at the far left

- **Asked:** 2026-11-23. The owner: "i do think "Wallet" and "files" needs
  to be their own tabs. Not buried in the "You" tab. And users should be
  able to reorder tabs as they like. And select 1 to pin on the far left."
- **Who:** part of the client's menu (`menus-are-the-clients`); its design
  covers this. Not briefed.
- **State:** asked. Covered by the draft design,
  [`docs/plans/the-clients-menu.md`](../plans/the-clients-menu.md)
  (section 13, and step 4 of its build); the owner's question on pins is
  its section 14, question 1.

## What it is

- **Wallet** and **Files** each become a tab of the menu. Today they are
  rows in the You tab ("Your files, at bitlogin.network" and the wallet),
  which open the sign-in address's own pages.
- **The visitor orders the tabs** as they like.
- **One tab can be pinned at the far left,** the visitor's choice.

## Notes for the design (the orchestrator)

- Wallet and Files are the sign-in address's own pages. The shell already
  shows that address's panel above a world, with modes for `wallet` and
  `files` (NSWP-02, "A client that keeps the screen"), so a tab can be that
  same panel, shown in the menu. A world still can't see into it.
- The order and the pinned tab are the visitor's settings: kept with their
  other synced settings so they follow them between devices, and held by
  the client, not by each world.
- There is already "Keep this tab on your bar". The design says how that,
  the order and the one pinned tab fit together, so there aren't three
  kinds of pinning.
- Where a world adds a tab of its own: whether the visitor can move it like
  any other, and that it can never be pinned or moved by the world itself.
- The kit's fallback menu gets the same tabs, order and pin, from the same
  code (see `menus-are-the-clients`), so the two never drift apart.
- A guest (not signed in) has no wallet or files: what those tabs show
  then, or whether they show at all.

## Done looks like

To be written with the design: Wallet and Files open as tabs; a tab dragged
(or moved with the keyboard, and in a headset) stays where it was put after
a reload and on another device; one tab pinned at the far left stays there
whatever the order; all of it the same in every world.
