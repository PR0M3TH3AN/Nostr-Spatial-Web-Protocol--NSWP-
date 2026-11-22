# Looking up and down, and using a held item, on a phone and at a casual desk

- **Asked:** 2026-11-21. The owner: "for mobile. there is not currently a
  good way to look up or down. Or when an item like the dart gun is being
  held, there is not a good way to aim or shoot or reload it. Items like
  this that rely on button presses need some sort of UI built for them to
  enable functions on mobile or casual desktop. please look into that
  carfuly and propose some options before i approve."
- **Who:** the kit (every world); BitPortal is looking first.
- **State:** briefed (2026-11-22: the owner chose option B, "B, as recommended": drag looks all ways, about 60 degrees up and down, easing back to level when walking; on touch a sight with a big Fire and smaller Reload by the right thumb, with a setting to swap sides, and taps walk; at a casual desk a click fires where clicked and R reloads. The BitPortal session builds it in the kit.)

## What the kit does today (the orchestrator's reading of the code; being checked by trying it)

- Dragging turns the view left and right only (`DRAG_LOOK`, on the
  horizontal movement of a drag). There is no way to look up or down on a
  phone or at a desk moving the casual way.
- A held item's presses (`addItemControls`): Fire and Reload as the bar's
  first two buttons; a short tap or click on the view is the first press,
  sent where it was pressed (shorter than `TAP_MS`, 320 ms; held longer is
  a walk); R for the second press at a desk; the mouse in intense.

## What the BitPortal session found (2026-11-21; report with pictures: https://claude.ai/artifact/1TixZLiGcDnNwXTtGUm1t3)

**Why the Grove and the room differed:** the live room was an older build
that never connected a held item: no Fire/Reload on the bar, the item's
logic not running, a quick tap walking instead of firing, the headset
trigger doing nothing. All four were fixed by BitPortal pull requests 174
and 176, which went live with kit 0.78.1 the same night. On main both use
the same kit code, and the controls behave the same. One small fault
remains, in the room only: on a phone, tapping a door's tile while holding
an item both fires and shows the tile's card.

**Today, in both:** no way to look up or down on a phone or at a casual
desk (a drag turns only sideways); a quick tap fires along the line through
the tapped spot, so aiming high or low works only within the screen and
nothing shows where a shot will go; Fire and Reload are the bar's first two
buttons (54 by 72 pixels), on the left thumb's side; every quick tap while
holding fires, so a tap meant to walk shoots.

**Options:** (A) drag tilts the view too, items unchanged; (B, its
recommendation) drag looks all ways, and on a phone while something that
fires is held a sight in the middle with a big Fire and a smaller Reload by
the right thumb, taps walking as with nothing held; at a desk a quick click
fires where clicked, R reloads; (C) an Aim button that switches into a mode
where drag looks and any tap fires. The owner chooses.

## Done looks like

Options, with pictures, put to the owner; their choice built in the kit
for every world and engine; tried on a phone and at a casual desk with the
dart blaster.

## Must not

Change the intense way of moving or the headset; put anything in the way
when nothing is held; bury a press more than one step deep.
