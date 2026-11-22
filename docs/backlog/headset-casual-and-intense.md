# Casual and intense, asked once: in a headset and at a desk; a phone is always casual

- **Asked:** 2026-11-21. The owner: "in bitportals VR mode, we need an
  "casual" and an "intense" mode. Where in casual its click to move and in
  intense its smooth locomotion. (i like smooth loco in VR)"
- **Who:** BitPortal (to check its room shows it and say what the owner
  will see); the kit has it.
- **State:** building. Step 1 merged (BitPortal pull request 169, b1dbc81: intense now goes through a door from BitPortal's room). Step 2, checked: the kit's own way out was already right (a world reads how the visitor moves before ending the session; the Gallery told the Airlock `moving=intense` in the made-up headset), and `keptSettings` was not a fault (`intense` is the desk's, `turn` the notch). Step 3 written in the kit: the `headset` setting, the two one-time questions, "How you move", touch never intense. Next: BitPortal keeps `headset` in its settings note, and its room asks. Not live.

## What is already built

The kit has exactly this (`createXrInput`, `packages/sdk/src/input.ts`,
since well before today), and BitPortal's room uses it:

- In a headset, the menu's **Moving** section has one switch, "Headset
  controls: casual" or "Headset controls: intense".
- **Casual:** point at the floor and press to step there; turn a notch at
  a time. The default.
- **Intense:** one stick walks and the other turns, smoothly, with the
  whole view. Under it, walking, turning and which hand moves can each be
  changed separately.
- The choice is kept for that device and carried through doors, so
  choosing intense once keeps it in every world.

Casual stays the default for everyone (a standing rule: smooth movement
makes some people unwell, so nobody gets it unasked). The owner's own
preference is kept by choosing intense once.

## What to find out

- Whether the owner has seen the switch on the Quest, and if it worked:
  the menu in a headset opens from the small button low in front of you,
  or above the wrist.
- If it is hard to find, that is the thing to fix (the switch first in
  the Moving section, or offered once on entering a headset session).

## What the BitPortal session found (2026-11-21, in the made-up headset on BitPortal main 40629f1)

- **The switch works and survives a refresh,** but it is three presses
  deep (Menu, Moving, "Headset controls"), and Moving is the 12th of 18
  tabs in the headset's menu. Nothing in the room says it exists.
- **Intense is lost at every door (a fault).** Leaving through a door in
  VR, the room ends the headset session first and only then reads how the
  visitor moves, so it reads the desk's switch and the Airlock carries no
  `moving=intense`. Each world is its own site, so it opens casual. The
  same may be true of the kit's own way out (`portal.go`), and the carried
  settings (`set=`) show the desk's choice rather than the headset's.

## What is being done (the orchestrator's order, as design; the owner may overturn it)

1. BitPortal: read how the visitor moves before ending the session, both
   places, with a test.
2. The kit: the same order in its own way out, and `set=` carrying the
   headset's choice, with tests.
3. The kit, for every world: the first time a device enters a headset
   session, offer the choice once, in the headset (casual or intense, and
   that it can be changed later); remembered, never asked again, never
   asked of someone who arrived carrying a choice; casual if dismissed.
   The owner, the same day: "when the user enters vr the game should pop
   up an option for the first time they enter VR and ask if they prefer
   casual or intense mode. And then it should save that setting in the
   users settings that syncs and is persistent. I think its a nostr note".
   So the choice becomes one of the settings that travel (core
   `TravelSettings`, a new field named under rule 11), and BitPortal's
   sealed settings note (NIP-78, only the visitor's key can open it,
   NSWP-11) keeps it, so a second device starts from it and isn't asked
   again.
   The switch reads "How you move: casual / intense". The menu's order of
   tabs stays as it is.

## At a desk too, and never on a phone (the owner, 2026-11-21)

"And something similer should happen the first time someone enters the
game in 2D desktop mode. Casual or intense. Then save and be the defaut.
Mobile is always casual."

- At a desk with a mouse: the same one-time choice on the flat screen
  (casual: click to walk, drag to look; intense: the mouse looks, keys
  walk). The answer is the desk's `intense` setting, which already travels
  and is kept in BitPortal's synced note. Choosing intense never takes the
  pointer until they press something.
- On a phone or tablet: always casual, no question, no intense shown.
- Desk and headset are two choices, each asked once; one never answers
  the other.

## How it is carried (the orchestrator's decision, 2026-11-21, after the BitPortal session's check)

- The kit's own way out was already right (step 2 needed no change), and
  `set=`'s `intense` and `turn` are the desk's choice and the headset's
  notch, as written. The headset's choice travels only as `moving`, which
  is present only for intense, so "answered casual" couldn't be told from
  "never asked".
- So the headset's choice gets one new field in `TravelSettings`, with
  both values, as the desk's `intense` already has (NSWP-11 first, a name
  given under rule 11, vectors). `moving` stays as it is.
- A world asks the headset or desk question only when nothing for that
  choice arrived and nothing is kept on that site; BitPortal's sealed note
  keeps both. A world reached with nothing carried asks once on that site.

## Done looks like

The owner, on the Quest, switches to intense in BitPortal's room, walks
smoothly, goes through a door, and is still moving smoothly in the world
on the other side.
