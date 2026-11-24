# On a phone: no bar in the Arcade, and a Bag that lists nothing

- **Asked:** 2026-11-24, by the owner, with two pictures of what is live
  (kit 0.89.0) on his phone, kept in the sessions' notes folder
  (`menu/owner-arcade-phone-you-tab-2026-11-24.png`,
  `menu/owner-arcade-phone-bag-empty-2026-11-24.png`): "On mobile I can't
  see the menu bar in the arcade and I'm logged in but items in the bag
  are not listed."
- **Who:** the NSWP builder (the bar); BitPortal's session first, then
  the builder (the Bag).
- **State:** asked. Read from the code by the orchestrator the same hour;
  nothing run.

## The bar

The pictures show the kit's quiet form: one mark in the top right corner,
no bar, and the sheet standing 72 px from the bottom. That is as built,
on every screen: the Arcade says `quiet: true`
(`sites/arcade/src/main.ts`), and `sites/shared/world.ts` answers with
`setPresence("quiet")`, the mark in the top right and the bar's number
keys off, because "a game has an interface of its own, and the keyboard
is for playing". It is the only one of our worlds that does.

On a phone that reason does not hold. There is no keyboard to keep for
play, and with no bar a visitor has nothing to press for what the bar
carries (the microphone, the chat, jump, a tab they kept on it; the menu
even offers "Keep this tab on your bar" where there is no bar to keep it
on).

Wanted: on a phone, the Arcade has its bar. The orchestrator's
recommendation, for the builder to answer before building: decide it in
the kit, not in the Arcade alone, so that it is the same for every
world that asks for quiet: where a visitor plays by touch, the quiet
form keeps the bar. A check at a phone's size that fails today. Whether
the Arcade should have its bar at a desk too is the owner's to say; he
spoke of his phone.

## The Bag

His Bag's line reads "Your bag is empty. Things are put in it at your
home. Items work here." From `packages/sdk/src/bagging.ts` and
`bag.ts`, that line is said only when he is signed in, at least one
relay answered to the end, and no bag note of his came back (or one
with nothing in it), and this device holds no copy. A world reads the
bag from his own write relays and the kit's usual ones; his home also
keeps a copy on the device it was changed on, and shows that copy
whether or not any relay has it.

Not known, and the first thing to find out: whether there is anything
in his bag. Three readings, none shown:

1. His bag note never reached a relay the worlds ask, and only the
   device he put things in on has it. The home sends it again only when
   it looks; a phone has no copy to send.
2. The note is on relays, and the phone's look ended before the relay
   holding it answered: one relay's end counts as an answer, and "empty"
   is then said where "couldn't be looked for" would be true.
3. His bag is empty, and what he sees at his home are the things
   offered there, which read to him as his.

Asked of BitPortal's session: at a phone's size, a throwaway account on
stand-in relays with two things in its bag, signed in at the home and
travelled to the Arcade: are they listed; and the same with the note
held by only one of the relays, answering late; and what the home's Bag
shows for a signed-in person whose bag note is empty. Looking for the
owner's own note on the public relays needs his word, asked.

## Found the same hour: his bag is on one relay of twenty-three

The owner then gave his public key to have his relays found ("how can i
find my relays? Here is my npub"), and the orchestrator read, and only
read, his relay list and his bag from public relays.

- His relay list names 23 relays, all for writing. From this machine two
  of them ask for a sign-in before answering, four give an error, and the
  rest answer.
- His bag note, dated 2026-11-21 with one thing in it, is held by **one**
  of the 23, and by none of the kit's four usual relays.
- The kit asks at most six of a person's own relays
  (`RELAY_PICK.most`), the ones this device has found answering first,
  and adds usual ones only when fewer than three of those six are thought
  to work; a relay nothing is known of counts as working. And where his
  relay list isn't found in two and a half seconds, only the usual four
  are asked. Any one relay's "that is all" then counts as an answer, and
  "Your bag is empty" is said.

So the second reading is the one, and the first is why it could happen:
the bag was sent to six of his relays once, one kept it, nothing sent it
again, and a device that doesn't ask that one relay says "empty". What
to do about it, for every note of a person's and not only the bag, is
[`relays-chosen-well`](relays-chosen-well.md).

## Must not

- Use the owner's npub with any relay without his word.
- Say "empty" where the truth is "not found yet".
