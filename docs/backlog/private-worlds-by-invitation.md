# A world that is by invitation: the owner's own list of who may come in

- **Asked:** 2026-11-21. The owner (a note written before the BitUnlock
  work and before BitGate had a session, so read against the code as it
  is now): "How can we make some words private by invite only? Like a
  personal home world or a private group world. I was thinking about a
  per world white and/or black list by the owner of that world. I dont
  think private spaces like this should rely on a validator if the owner
  is willing to manage it themselves." ("words" is worlds.)
- **Who:** the kit's half, the NSWP builder (the gate is the front
  room's, `packages/sdk/src/front-room.ts`). The list's shape, BitGate
  (one shape for an allow and a block list everywhere, see
  [bitgate](bitgate.md)). The client's half, BitPortal.
- **State:** building. Stage 1 (block list) and stage 2 (by invitation, the eighth door tile) are live in the kit since 0.78.1 (no world uses them). BitLogin's request for a world owner to change their list (`guests`, shown in words every time) is live on bitlogin.network (its main 6f33eee, 2026-11-22). Next: the owner's screen in the kit's menus, built on that request (the NSWP builder). Not built: BitPortal hiding a door from someone not invited, and the sealed kind.
- **The gate.** `worldGate()` gains a second thing that opens it: being on
  the list. Signed out, it sends the visitor to sign in, as the paid gate
  does. A world may ask for both (invited and paid) or either.
- **The room.** In a by-invitation world, a visitor's kit shows and hears
  only people on the list, and a blocked person is not shown or heard in
  any world of that owner's. For the sealed kind, what is said is
  encrypted to the group.
- **What a world offers.** One more line for a door (`offers.ts`): "By
  invitation", lit only where the announcement says so outright.
- **The engine script and Godot** get the same gate, as the paid gate is
  owed there.

## The client's half (BitPortal)

- A door to a by-invitation world says so on its plate, and says whether
  the visitor is on the list where that can be known.
- The owner's own screen for the list, in the menus: add a person (from
  the people here now, from people they follow, or by their key), take
  one off, block one. The same screen in any world of the kit's, so it
  belongs in the kit's menus and BitPortal only uses it.
- A home world: where "home" leads, and that it starts by invitation.

## Open, to settle before building (the orchestrator's questions)

- **How the owner signs a change to the list.** A world's signer may not
  sign careful kinds, and that is not to be loosened. So either the list
  is a kind the sign-in address asks about in its own screen ("Let Ana
  into Home?"), or it is kept at the sign-in address's own pages, or by
  the `nswp` command with a key file. The first is the one a person can
  use in a headset. BitLogin is to be asked.
- **Whether the list itself can be read by anyone.** A public allow list
  tells the world who is in a private group. A hidden one (encrypted to
  the members) can only be checked by members. The orchestrator's
  opinion: the block list and the by-invitation gate start with a list
  anyone can read, and the menus say so plainly; the hidden list comes
  with the sealed kind, where there is a group key to hide it with.
- **Who can prove they hold a key.** At the soft gate a visitor who lies
  about their key fools only their own browser. In the room it matters:
  everyone else's kit must see proof before showing a person as a guest.
- **Voice.** Whether a by-invitation room's voice refuses a person who is
  not on the list at the connection, not only on the screen.

## What BitGate's session says its lists are (2026-11-21, from its source; not tried against a relay)

- Kind 30078, addressable. An allow list and a block list are two events,
  told apart by `d` = `<namespace>:governance:<scope>:v1`, scope
  `user-allow` or `user-deny`. One `["p", <hex>]` a person; content empty.
  A person is a key only. Newest wins.
- With the world's owner as root, the owner's two lists are the whole
  authority: no role set, no curator, no service. A reader needs the event
  and a signature check and nothing of BitGate's.
- Blocked beats allowed already. The owner can't be blocked.
- **A list scoped to one world is now specified** in BitGate's repository,
  `docs/governance-lists.md`, with vectors (merged at 3594470; a follow-up
  for a root the reader is given and for lists dated in the future is
  owed). As agreed:
  `d` = `nswp:governance:<scope>:v1:37300:<owner>:<world-d>` with a
  required `subject` tag equal to that suffix, counted only for that world
  and only when signed by the subject's own key; `scope` and `d` must
  agree; hex only; at most 2,000 people an event.
- Hidden entries: none, and hashing keys hides nobody. So lists start
  public, and the menus say so, including that **a public block list
  tells the world whom the owner blocked.**
- The orchestrator's opinion: the kit reads these two events with a small
  reader of its own in `@nswp/core`, held to BitGate's vectors, and does
  not vendor BitGate for this.

## Decided (2026-11-21), and by whom

The plan is `docs/plans/a-world-by-invitation.md` (the kit's builder's,
stages 1 and 2). Answered by the orchestrator as design:

- Whose list counts is named by the world's own manifest (a keeper, at
  most four), defaulting to the world's publishers.
- A room setting "named people only" comes with stage 1, off unless the
  world says so. Without it a block in an open world is undone by signing
  out. A block at a soft gate stops a name, not a person; the owner's
  screen says so.
- Paid and by invitation together means both, never either.
- A block list that can't be read fails open with the remembered copy; an
  allow list fails closed. Whether a world is by invitation is the
  manifest's word, never the presence of an allow event.
- Several keepers: blocked by any is blocked, invited by any is invited.
- No refusal before a connection opens in stage 2 (it would show invited
  people's names to a lurker); that comes with the sealed kind.
- The kit never goes back to an older list, and refuses one dated more
  than ten minutes ahead. Writers stop at 500 names a list.
- How the owner signs a change: the `nswp` command with a key file first;
  then one new request to the sign-in address, built like `follow`, shown
  in words on its own page every time. Nothing a world's signer may sign
  is loosened.
- Given under the fleet's rule 11, provisional until BitGate's vectors
  are merged: kind 30078, `d` as those vectors give it, namespace `nswp`.
- A door carries at most eight tiles, so "By invitation" would be the eighth. Adding a line to what a door shows is the owner's word; asked "Add an eighth door icon, 'By invitation'?", they said: "Yes, add it" (2026-11-21). It stands at the foot beside "Paid".
- Names given under rule 11: in the world's manifest entry, `keepers` (at most four keys), `by_invitation` (exactly `true`) and `named_only` (exactly `true`); in the announcement, the tag `["by-invitation"]`. BitGate's vectors to copy: commit 8b98ed9, `vectors/governance-lists/scoped-lists.json`, sha256 a29211c8ec46d51a5b88bf1dafd338d6c5caf776896c91b8aa93cd655600d372.

**The owner's, and not yet answered:** that an owner's list can be read
by anyone (it sits beside the standing rule that a visitor's own blocks
are never published, which stays). Nothing that publishes or shows an
owner's list is merged before their word.

Order: the paid gate in the engine script and Godot first; then stage 1
(the block list); then stage 2 (the allow list).

## Done looks like

Stage 1: an owner blocks a person and that person is stopped at the gate
of that world and is not seen or heard in it, with no service asked.
Stage 2: an owner makes a world by invitation, invites two people from
the menus, and a third is stopped at the gate, shown why, and is not
shown the door in BitPortal's room. Stage 3: the sealed kind, where the
third cannot read what is behind the gate by any means.
Each tried by a trial in `trials/` against the stand-in relay.

## Must not

- Call the soft gate "private". It is "by invitation". Only the sealed
  kind is called private.
- Need a validator, a curator, BitGate's service, BitUnlock or any third
  party to say who is let in. The owner's signature is enough.
- Make a second shape of list. One shape, shared with BitGate; here the
  signer is the world's owner.
- Let a world say who a visitor is. The key comes from the sign-in
  address, as everywhere.
- Loosen what a world's signer may sign to make the list easy to change.
- Put any of it in BitBrowser.
