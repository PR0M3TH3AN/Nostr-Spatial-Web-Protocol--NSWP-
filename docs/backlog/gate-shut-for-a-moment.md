# The gate says "shut" for a moment to someone who is invited

- **Asked:** 2026-11-23, by the orchestrator, after the NSWP builder saw it in a
  trial (not the owner's words; written down so it isn't lost).
- **Who:** the NSWP builder (the kit's `front-room.ts`, a world by invitation).
- **State:** asked.

In a world by invitation, someone who has just been put on the guest list
can arrive and be told the world is shut, and a moment later be let in.
Their page's first reading of the relays came back with the list as it was
a moment before; the gate said "shut" on that, and "open" at its next
reading.

Seen in `trials/owners-screen.mjs`, step 10, on 2026-11-23 on a busy
machine: in one run of two, Ben's gate said `["shut", "not-invited"]` first
and then opened. The trial now keeps what the gate said first beside the
check ("10 what Ben's gate said first"), so the moment is seen when it
happens. It was so before that day; the trial only stopped hiding it.

It matters because "shut: you are not invited" is a hard thing to be told
wrongly, even for a second, and a visitor who reads it may leave.

## Done looks like

- The gate says **"checking"** until the guest list has been read for this
  visit, and never "shut" to someone who is on the list.
- "Shut" is said only on a list that was read and doesn't name them. What
  counts as read is the kit's existing rule (`ListState` in
  `front-room.ts`): a reading that no relay answered is not a list that
  leaves them out.
- A list that changes while they are at the gate still lets them in when
  it next names them, as now.
- `trials/owners-screen.mjs` step 10 can then want what the gate said
  first to be anything but "shut", and say so as a check.

## What it must not do

- Let anyone in on a list that hasn't been read. "Checking" keeps the way
  shut, as it does today.
- Wait without end. If nothing can be read, the gate says so in the words
  it has for that now.
- Change who is let in. Blocked still beats invited, and a keeper is
  always let in.
