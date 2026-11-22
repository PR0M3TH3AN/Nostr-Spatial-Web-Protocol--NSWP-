# Looking up and down, and using a held item, on a phone and at a casual desk

- **Asked:** 2026-11-21. The owner: "for mobile. there is not currently a
  good way to look up or down. Or when an item like the dart gun is being
  held, there is not a good way to aim or shoot or reload it. Items like
  this that rely on button presses need some sort of UI built for them to
  enable functions on mobile or casual desktop. please look into that
  carfuly and propose some options before i approve."
- **Who:** the kit (every world); BitPortal is looking first.
- **State:** asked (being looked into; options go to the owner before
  anything is built)

## What the kit does today (the orchestrator's reading of the code; being checked by trying it)

- Dragging turns the view left and right only (`DRAG_LOOK`, on the
  horizontal movement of a drag). There is no way to look up or down on a
  phone or at a desk moving the casual way.
- A held item's presses (`addItemControls`): Fire and Reload as the bar's
  first two buttons; a short tap or click on the view is the first press,
  sent where it was pressed (shorter than `TAP_MS`, 320 ms; held longer is
  a walk); R for the second press at a desk; the mouse in intense.

## Done looks like

Options, with pictures, put to the owner; their choice built in the kit
for every world and engine; tried on a phone and at a casual desk with the
dart blaster.

## Must not

Change the intense way of moving or the headset; put anything in the way
when nothing is held; bury a press more than one step deep.
