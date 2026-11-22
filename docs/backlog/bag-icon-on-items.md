# Items show a bag in their corner when they're in your bag

- **Asked:** 2026-11-22. The owner: "The items that are in your bag in the
  menu need a bag icon in there corner. If it's not in the bag the it should
  be grayed out."
- **Who:** the NSWP builder (the kit: the console's Bag section,
  `packages/sdk/src/bagging.ts`, and how the console draws a section's
  tiles), for every world, the template and BitPortal alike.
- **State:** asked.

## What it is

The menu's Bag section lists the items a visitor has in their bag and the
things offered in the place they are in. Today only the card, once an item
is chosen, says "In your bag", "In your hand" or "Offered here".

- An item that is in the visitor's bag shows a small bag icon in its tile's
  corner.
- An item that isn't in their bag (offered here, not taken) is drawn greyed
  out, with no bag icon. It can still be chosen and taken, as now.
- An item in their hand is in their bag, so it shows the bag too.

## The kit's half and the client's half

All of it is the kit's: the console is the kit's, so every world, the
template and BitPortal get it by vendoring. Other engines get it through the
engine script's console, which is the same code. Nothing for BitPortal's own
code unless it draws items somewhere else.

## Done looks like

- In the Bag section, with two items in the bag and one offered here: two
  tiles with the bag icon, one greyed out without it.
- Taking the offered one: it loses the grey and gains the icon, without
  reopening the menu. Putting one away does the reverse.
- The icon and the grey read in both themes, at a phone's width and in a
  headset's panel, and the greyed tile still says what it is to a screen
  reader ("not in your bag").
- Pictures of before and after, for the owner, before it is merged.

## Must not

- Hide an offered item or make it unpressable: grey means "not yours yet",
  not "unavailable".
- Use a second icon set: the bag icon comes from the console's own icons.
