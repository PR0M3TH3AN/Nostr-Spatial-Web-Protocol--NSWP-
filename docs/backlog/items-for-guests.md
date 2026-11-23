# Items a visitor can use without signing in, where the world and the item's maker allow it

- **Asked:** 2026-11-23. The owner: "can we make all our current items in
  game able to be used by people even if they are logged out? This should be
  an option by the world and the items creator. Allow non-logged in users."
- **Who:** the kit first (the NSWP builder), then our own items and
  reference worlds, the template and BitPortal by vendoring. Not briefed.
- **State:** asked. After the client's menu (the owner's order of
  2026-11-23: the menu before new features).

## What is true today

NSWP-17: "Carrying an item into a world is tied to who they are there. A
guest carries nothing." A bag is a signed note of the visitor's own, so a
guest has none, the Bag tab isn't shown to them, and nothing an item does
reaches them as its holder. A guest does see what other people hold.

## What is wanted

A visitor who isn't signed in can take up and use an item, where **both**
say so:

- **the world,** in its own description (its rule for items already says
  `none`, `allowed` or `play`; this adds whether guests may hold one);
- **the item's maker,** in the item's signed description.

Then all of our own items (the dart blaster and the rest of the starter
set) are marked as usable by guests, and our reference worlds allow it.

## What it means, for the design to settle

- **Where a guest gets one.** They have no bag. The orchestrator's
  proposal: a guest may take up what is *offered in the place* (and what a
  client offers to start with), held for this visit only. Nothing is
  written or signed, nothing is kept when they leave, and nothing goes with
  them through a door unless the next world also allows guests and the item
  says so.
- **How the others know.** A guest tells the room what they hold as anyone
  does (the item's coordinate and nothing else), and everyone fetches and
  checks it for themselves as now. Nobody is asked to believe a guest has a
  bag.
- **Its logic.** An item that does things of its own still asks at the
  first press before its script runs, and still runs in the sealed box.
- **Where play can reach you** (`play`): whether a guest's item may act on
  other people as a signed-in visitor's may, or only where the world says so
  again. A guest can't be blocked by name, only by their session, and the
  design says what a visitor's block does about a guest's item.
- **What the door says.** The "items" line on a door and in the Airlock
  says when guests can use them.
- **The menu.** The Bag tab for a guest: what it shows (what is offered
  here, and that signing in keeps things), in the client's menu and the
  kit's fallback alike.
- **The words in the protocol** (NSWP-17, NSWP-01) and every new name, for
  the orchestrator to give.

## Must not

- Let a world, or an item, decide it alone: both must say so.
- Give a guest anything that lasts: no bag is made for them, and nothing is
  signed in their name.
- Weaken the checks on an item's files, its signature, or where its files
  are fetched from.

## Done looks like

To be written with the design: a guest in the Grove takes up the dart
blaster and fires it; in a world that doesn't allow guests, or with an item
whose maker didn't allow it, the same press says why not; another visitor
sees the guest holding it; nothing is left behind when the guest goes.
