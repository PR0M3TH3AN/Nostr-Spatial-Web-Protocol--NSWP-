# On a phone: no bar in the Arcade, and a Bag that lists nothing

- **Asked:** 2026-11-24, by the owner, with two pictures of what is live
  (kit 0.89.0) on his phone, kept in the sessions' notes folder
  (`menu/owner-arcade-phone-you-tab-2026-11-24.png`,
  `menu/owner-arcade-phone-bag-empty-2026-11-24.png`): "On mobile I can't
  see the menu bar in the arcade and I'm logged in but items in the bag
  are not listed."
- **Who:** the NSWP builder (the bar); BitPortal's session first, then
  the builder (the Bag).
- **State:** the bar is built (2026-11-24): in the kit, for every world
  that asks for quiet, where the visit started by touch the quiet form
  keeps the bar. `trials/arcade-bar.mjs` holds it, at a phone's size with
  real taps, and at a desk where nothing changed. The Bag's part is the
  relay mends (`relays-chosen-well.md`).

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
`bag.ts`, that line is said when he is signed in, no bag note of his came back
(or one with nothing in it), and this device holds no copy. (The
orchestrator first wrote "and at least one relay answered": wrong.
BitPortal ran the kit's own code: the kit knows when nobody answered,
and says "empty" all the same.) A world reads the
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

## Made to happen on demand (BitPortal, 2026-11-24)

The kit's own `createBag` from kit 0.89.0, in Node, with stand-in relays
that answer after a set time or refuse, and a throwaway key. Nothing
went to a real relay.

- **Only the device it was signed on has it:** another device says
  empty; the home on its own device lists it. The home's next look there
  sends it again and three of four relays then hold it. Where every
  relay refuses the note, another device says empty for good.
- **One relay holds it and answers late; the world waits four seconds:**
  at 3.5 s listed; at 4.5 s and at 8 s, "empty".
- **No relay answers at all: "Your bag is empty" too.** "Couldn't be
  looked for" is only ever said to someone signed out. A wording fault
  whatever else is true.
- **His relay list comes late.** With three or more of his own relays
  working, the home sends the bag only to those and to no usual relay. A
  world learns his relays from his relay list, waited for two and a half
  seconds. Answering at 0.3 s or 2 s: listed. At 3 s, a slow line or a
  phone: the world asks only the usual relays, which never had it, and
  says empty. **The miss is kept ten minutes**, so "Look again" asks the
  same wrong relays until then.
- **Read, not shown:** the home uses the relays a visitor set in
  BitPortal's own Settings where a world uses the kit's four, so someone
  with no relay list who changed that setting has a bag written where no
  world looks.
- Counted on the kit's four usual relays, from anybody, with no author
  asked: one bag note in all.

Every mend is the kit's. They are listed in
[`relays-chosen-well`](relays-chosen-well.md).

## Must not

- Use the owner's npub with any relay without his word.
- Say "empty" where the truth is "not found yet".
