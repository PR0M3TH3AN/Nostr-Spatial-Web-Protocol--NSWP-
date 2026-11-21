# A world by invitation: the kit's plan for stages 1 and 2

From the NSWP builder, 2026-11-21, for the orchestrator. A plan, not code.
Nothing here is built. Read against `docs/backlog/private-worlds-by-invitation.md`
(main at dcb3327), `packages/sdk/src/front-room.ts`, `room.ts`, `blocks.ts`,
and NSWP-06 and NSWP-10 as they stand. No kind is picked: the list's shape
is BitGate's, and section 1 says only what the kit needs of it.

Words used: **by invitation** for the gate with a guest list. Never
"private": that is the sealed kind, stage 3, not planned here.

## 0. In one paragraph

The owner's list is one signed note. Every visitor's own copy of the kit
reads it and checks the signature against a key the world's own site names.
Stage 1: a person the owner has blocked is stopped at that world's gate and
is dropped by every other visitor's kit in its room. Stage 2: a world says
it is by invitation, and its gate opens only for a signed-in key on the
list. No service is asked at any point. The gate stays the `soft` kind and
says so.

## 1. The list, in core

**What the kit needs of BitGate's shape** (to check against its answer):

1. One event per world, signed by one key, where a newer one replaces the
   older (so "taken off the list" is a new event, not a deletion).
2. It names the world it is for by the world's coordinate
   (`37300:<key>:<d>`), so a list for one world can't be replayed as
   another's.
3. Allowed keys and blocked keys are told apart in it, as plain public
   keys.
4. "By invitation with nobody invited yet" can be told from "no allow
   list": an empty allow list must not read as an open world.
5. It may also say "every world of mine" for a block (the backlog asks
   that a blocked person is not seen in any world of that owner's). If
   BitGate's shape has no such thing, stage 1 is per world and that waits.

**Whose list counts.** The world's own manifest says, as it says who may
announce it and who may sell it. By default: the keys it names as
publishers of that world. I'd add one optional word to the manifest so a
world built and announced with a deploy key (ours are: the reference
publisher's key is a file) can name the owner's own key as the one whose
list counts. Without that, an owner signed in at BitLogin could never
change the list of a world announced by a key in a file. *This is a
decision; see section 6.*

**The reader**, beside `readListing`: `readGuestList(event, { world,
keepers })`. Refuses, with the first reason: not that kind of note; signed
by a key that isn't a keeper; a signature that doesn't hold; for another
world; a list that doesn't read. Gives: who is blocked, who is allowed (or
"no allow list"), and when it was signed.

**The answer for one person**: `standingOf(list, key)`: `blocked`,
`invited`, `not-invited`, or `open` (no allow list, not blocked). Rules:

- Blocked beats allowed.
- The keeper is never blocked or uninvited in their own world: nobody
  locks themselves out, and nobody else can.
- A limit on how many names are read (500, as `BLOCK_LIMIT` is), so a list
  can't be made a way to stall a page.

**Never going back.** The kit keeps, on the device, the newest list it has
seen for a world (it is public). An older one handed over later is not
taken. This is what stops someone replaying the list from before they
were blocked.

**When a relay is down.** A block list fails *open* with the remembered
copy: if no relay answers, the last list seen is used, and with none ever
seen the world is as it was. Otherwise one relay outage would shut every
world that has a list. An allow list fails *closed*: a by-invitation gate
with no list it can read is shut and says why, as the paid gate is.

Vectors (`vectors/guest-lists.json`): each refusal, blocked-beats-allowed,
the empty allow list, the keeper's own key, the older list refused.
Protocol text: a section in NSWP-10 beside "The front room", and the word
in NSWP-01 for the manifest and announcement.

## 2. The gate

`front-room.ts` today has one thing that opens it: a receipt. The change
is to make "what opens it" a short list of conditions, each of which is
unknown, met or unmet, with the same rule as now: **anything unknown is
shut.**

- **paid**: a receipt, exactly as built.
- **invited**: the signed-in key's standing in the owner's list.

What a world asks for is its own site's word, in the manifest:
`access` (listings), as now, and a new word for by invitation. The four
cases:

| The world says | The gate opens for |
|---|---|
| nothing | everyone (no gate), unless stage 1 blocks them, below |
| paid | a receipt |
| by invitation | a signed-in key that is invited |
| both | invited **and** a receipt. Both, never either: "either" would let anyone buy their way past a guest list, which is not what an owner who keeps one means. If an owner wants "members free, others pay", that is a third thing and I'd leave it out |

**Stage 1, the block, in a world with no gate.** Today a free world makes
no gate at all, on purpose. For blocks I'd keep that for a world that
names no list keeper and has no list: nothing read, nothing asked. A world
whose manifest says it keeps a list gets a gate whose only job is to stop
a blocked, signed-in key. It reads one event from relays as the world
loads. It says to that person: "The owner of this world has asked you not
to come in." and nothing to anyone else.

**Said plainly, the limit of a block at a soft gate.** A blocked person
who signs out is a guest, and walks in. A new key costs nothing. So a
block in an open world stops a *name*, and its real effect is in the room
(section 3), where nobody sees or hears them under that name. A world
that wants a block to bite at the gate is a by-invitation world. I would
put that sentence in the owner's screen, not hide it.

**Signed out at a by-invitation gate**: the same row as the paid gate,
"Sign in to come in", and the same headset words.

**The control and the words** stay in the console (`addGateControls`), so
desk, phone and headset are the same. An uninvited visitor sees whose
world it is and that it is by invitation; no "ask to be let in" button in
these stages (section 5).

**What it must not do**, to go in `AGENTS.md`: open for a key the page
was told of by anything but the signer; treat a list that can't be read
as "everyone invited"; call itself private.

## 3. The room

**What proof of a key the room has today** (read from `room.ts` and
NSWP-06/10):

- Everyone speaks with a throwaway session key. The handshake notes (kind
  27301) are signed with it, so a peer provably holds its session key and
  nothing more.
- Someone who came by name says `id:<pass>` on the data channel once it
  opens. The pass (27300) is signed by their identity key, for this site,
  naming that session key. `verifyRoomPass` checks all of it. That is
  real proof that an identity key vouches for the member in front of you.
- A guest has no identity at all.
- The visitor's own blocks already work on this: when a pass names a key
  they blocked, "the connection ends here, a moment after it began", and
  that person is not answered again.

**Stage 1.** The owner's blocked keys are handed to the room beside the
visitor's own (`RoomSession` already takes `blocked`). So in every
visitor's kit, a member whose checked pass names an owner-blocked key is
dropped the moment the pass arrives, and is not shown or heard. It is the
existing mechanism with a second source. Two things to hold to:

- The visitor's own blocks stay as they are: on their device, never
  published, nobody told. The owner's list is a different thing and is
  public by its nature. The two are never merged into one stored list.
- A blocked person can still join as a guest. So stage 1 needs one world
  setting to mean anything in the room: **"named people only"**: in such
  a room a kit shows and hears only members with a checked pass. An owner
  who blocks someone is told this is what makes it hold. *A decision;
  section 6.*

**Taking effect at once.** A list is read as the world loads and every
five minutes. So that a block doesn't wait five minutes, any member's kit
that has a newer list says it on the room's channel (the signed event
itself, checked exactly as one from a relay is). The owner pressing
"block" is then felt by everyone present within a second.

**Stage 2, a by-invitation world's room.** A kit joins only when its own
gate is open. It shows and hears a member only once their pass has
checked out *and* names an invited, unblocked key; one who shows none
within a few seconds is dropped. Guests are never shown there.

**Voice, and refusing at the connection.** Today a pass arrives after the
connection has opened, so an uninvited person's kit can open a
connection (and learn addresses) before it is dropped. Refusing *before*
connecting would mean showing a pass inside the handshake. I would not do
that in stage 2: whoever shows their pass first shows it to a stranger,
so a lurker on the room's topic would learn which invited people are
there now, which is worse than what it prevents. The right fix is stage
3's: a room whose topic and handshake are keyed by the group's key, so an
outsider can't find it or read it. So for stage 2: refused on screen and
in sound, and the connection closed a moment after it opens, as blocks do
today, with NSWP-06 saying exactly that and no stronger.

## 4. How the owner changes the list

The rule stands: a world's signer signs a note and a reaction and nothing
else, and none of `ORDINARY_KINDS`, `NEVER_KINDS`, `PROPOSE_KINDS`,
`SIGN_LIMITS` moves. Two ways, in this order:

1. **The `nswp` command, with a key file** (`nswp guests …`): add, take
   off, block, for a world. It needs nothing from anyone, covers worlds
   announced with a key in a file (all of ours), and is what the trials
   use. Stage 1 ships with this alone if BitLogin's half isn't there.
2. **One new request to the sign-in address**, for the menus. Built the
   way `follow` is, not the way `propose` is:
   - The world hands over the newest list it found (the owner's own
     signed event) and **one change**: let one key in, take one off, block
     one, unblock one.
   - The sign-in address shows it on its own page every time, in words
     ("Let Ana into Home?", "Block Ana from Home?"), with the world's
     address. No standing say-so: a world never gets to change the list
     quietly.
   - It builds the new event itself. It refuses unless the list is its
     own key's, is for a world whose manifest names that key as keeper,
     and the asking page is that world. It refuses with no list unless
     told the world has none yet, at a second press, as following does
     (a relay that was down must not wipe a guest list).
   - The kit checks what comes back is exactly that list with that one
     change, as `isFollowAsked` does, before sending it to relays.

   **What I'd ask of BitLogin:** that request and its page; that it never
   takes the list's kind through `sign` or `propose`; that it reads the
   manifest for the keeper as it does for `have`; and whether its page
   can be shown in a headset yet (today: no, so in a headset the row says
   to step out, as buying does).

The owner's screen itself (people here now, people they follow, by key)
is the kit's, in the console, shown only where the signed-in key is the
keeper. BitPortal uses it.

## 5. What I would leave out of stages 1 and 2

- The sealed kind, hidden lists, an encrypted room: stage 3.
- Refusing before a connection opens (section 3).
- "Ask to be let in", invitations by link or code (a link is a claim
  anyone can write), and invitations that run out.
- Anyone but the keeper changing the list: no helpers or moderators yet.
- "Members free, others pay" (section 2).
- BitGate's service or its evaluation: only its shape for a list.
- The door's side: "By invitation" on a plate, not showing a door to
  someone not on the list. That is `offers.ts` (one line, mine) and
  BitPortal's half.
- Anything in BitBrowser.

## 6. Decisions I need before building (my recommendation first)

1. **The owner's list is public, and that is new.** `AGENTS.md` says a
   block is never published. That rule is about a visitor's own blocks
   and should stay. An owner's list is published by design. Recommend:
   yes, with the owner's screen saying "Anyone can read this list", and
   the AGENTS entry kept apart from the one about personal blocks. This
   one I think is the owner's to say, since it touches a standing rule.
2. **Whose list counts:** the manifest names a keeper, defaulting to the
   world's publishers. Recommend yes.
3. **"Named people only" as a room setting** in stage 1. Recommend yes;
   without it a block in an open world is undone by signing out.
4. **Paid and by invitation together means both.** Recommend yes.
5. **A block list that can't be read fails open** (remembered copy, else
   as it was); an allow list fails closed. Recommend yes.
6. **Several keepers:** blocked by any is blocked; invited by any is
   invited. Recommend yes, and at most a few keepers.

## 7. Order

1. **The paid gate in the engine script and Godot, first.** It is owed,
   it is small (the gate draws nothing; it needs its calls through
   `engine.ts`, the add-on, and the control in the engine's menu), and it
   waits on nobody. Stage 1 waits on BitGate's shape anyway. I'd start it
   as soon as pull request 236 is on main.
2. **Stage 1** when BitGate's shape reaches me and the decisions above are
   answered: core reader and vectors; the gate's second condition; the
   room's second source of blocks and "named people only"; the `nswp`
   command; a trial with three scripted visitors on the stand-in relay.
3. **Stage 2:** the manifest and announcement word, the by-invitation
   gate, the room's rule, the owner's screen, and BitLogin's request when
   it exists. The engine script and Godot get each stage in the same pull
   request from here on, so they don't fall behind again.

Each stage is its own pull request, gated, with its trial run before I
ask for a merge.

## 8. BitGate's shape, checked against the kit (added after its answer)

BitGate's answer as the orchestrator passed it on: kind 30078; an allow
list and a block list are two events told apart by `d`
(`<namespace>:governance:<scope>:v1`, scope `user-allow` or `user-deny`);
tags `d`, `v`, `client`, `scope`, then one `p` a person; newest wins, a tie
to the smallest id; proposed per-world lists with `d` ending in the world's
coordinate and a `subject` tag equal to it; at most 2,000 `p` tags. I have
not read BitGate's source; this is checked against the kit's own code.

**It works for the kit, with five things to settle. None needs a second
shape.**

What changes in my plan above because of it:

- Two events, not one. The kit asks relays for both in one question (and
  the owner-wide block list, below), keeps the newest of each, and
  remembers each so an older one is never taken. Section 1's "one event"
  becomes "one event a list".
- Whether a world is by invitation is the **manifest's** word and never
  the allow list's presence. A relay that doesn't hand over the allow
  event must not read as "no allow list, so open". The manifest says by
  invitation; then no allow event that can be read means shut. An allow
  event with no `p` in it means nobody but the keeper.
- "Every world of mine" for a block needs nothing new: it is the list
  BitGate already has, `nswp:governance:user-deny:v1` with no suffix,
  signed by the owner. The kit reads it beside the per-world one.

What I checked, as asked:

1. **30078 is also a listing's kind, and a receipt's. Nothing of the kit's
   mistakes one for another.** The only place the kit asks relays for
   30078 is the gate (`front-room.ts`), and it asks by author *and* exact
   `d`, then puts what comes back through `readListing`, which wants one
   `price`, `status` `active` and `br:delivery`: a list has none of them
   and is refused (`not-for-sale`). `readReceipt` believes only the
   selling service's key. The list's reader will want the `scope` tag and
   the `d` to agree, which no listing has. And 30078 is on `NEVER_KINDS`,
   so a world's signer can never sign a list: that is as it should be and
   stays.
   One oddity, harmless: `cleanListing` takes a name that begins
   `nswp:governance:` (a listing's name is any one line of 1 to 256
   characters not starting with a colon). A seller who named a listing
   exactly as their own list is named would have the two replace each
   other on relays. Only an owner can do that, to themselves. I would not
   narrow `cleanListing` for it: that rule is BitUnlock's.

2. **A world's `d` can hold a colon. It can hold anything.** The kit's
   rule for a world's name is 1 to 128 characters and nothing else: no
   list of allowed characters. A coordinate is read as kind, then 64 hex,
   then *everything after the next colon* (`parseCoordinate`). So the
   suffix `37300:<owner>:<world-d>` may contain colons, spaces, even a
   line break. It is still unambiguous **if BitGate reads it the same
   way**: the fixed prefix, `37300:`, 64 hex, `:`, and the rest as the
   name, never by splitting on every colon; and `subject` compared with
   the suffix character for character. If BitGate would rather not take
   that, the alternative is to refuse per-world lists for worlds whose
   name isn't plain (`A-Z a-z 0-9 . _ -`), said in both places. All nine
   of our own worlds' names are plain. I'd take "the rest is the name".
   The longest `d` is 229 characters; no trouble.

3. **2,000 is enough as a ceiling for readers, and too many to write.**
   A `p` tag is about 72 bytes, so 2,000 is about 144 KB in one event,
   and many relays refuse an event over 64 KB. About 850 names fit in
   64 KB. I have not asked our four relays what they take (that is a
   question to a real service; say if you want it asked). So: the kit
   reads up to 2,000, as BitGate does, so the two never disagree about a
   list; the kit's own writers (the command, the owner's screen) stop at
   500 a list and say so. A group of more than 500 invited people, or a
   block list of more than 500, is a later problem with a different
   answer (several events), and a block list that long is a sign the
   world wants an allow list.

Five things to settle with BitGate before either builds:

a. **Who may sign a per-world list.** Its rule: only the subject's own
   key, which is the key that announced the world. Then the list of a
   world announced with a key in a file (every one of ours, and anything
   made from the template with `nswp sign-world --key-file`) can only be
   changed with that file, never from the menus by the owner signed in
   with their everyday key. That is my decision 2 (a "keeper" the
   manifest names). I don't ask BitGate to build keepers. I ask that its
   rule be written as "signed by the root the reader was given", with
   the subject's own key as *its* default root, since by its own account
   authority is applied by the reader. Then the kit can name the root
   from the manifest later without a change to the shape or the vectors.
   For stage 1 the default is all I need (the command signs with the
   file).
b. **Reading the suffix** (2 above).
c. **The `client` tag.** If the kit's command and BitLogin write these
   events, must they say `["client","bitgate"]`, and does a reader refuse
   one that says something else or nothing? I'd have readers ignore it.
d. **A list dated in the future.** Newest wins, and the kit never goes
   back; so one list signed with a clock a year ahead would pin itself
   until then. Readers should refuse a list dated more than ten minutes
   ahead, and BitGate's vectors should say so, or the kit and BitGate
   will disagree about which list stands.
e. **The namespace.** I'd use `nswp`. Confirm nobody else means to use
   another for the same lists (`bitportal`), or a visitor in one client
   would not see what the owner set in another.

On vendoring: I agree with you. The kit doesn't take BitGate's code for
this. It gets a small reader in `@nswp/core`, checked against BitGate's
own vectors copied into `vectors/` with the commit they came from, the way
`vectors/shares.json` is shared.

Rule 11: I will ask you for the kind and the `d` before I write any of it.
What I'd ask to use: kind 30078, `d` exactly as BitGate's vectors give it,
namespace `nswp`.
