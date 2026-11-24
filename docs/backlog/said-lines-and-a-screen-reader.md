# Said lines and a screen reader: are they read twice when the menu moves them?

- **Asked:** 2026-11-24, by the orchestrator, from the NSWP builder's own
  note on PR 434. Not an ask of the owner's.
- **Who:** whoever next has a screen reader to hand; then the NSWP builder.
- **State:** not known. Nothing to build until it has been tried.

## What changed

Since PR 434 (merged 2026-11-24 as 73ab018, not live), a line said for a
moment ("Picture saved", "The Gallery is making it") stands inside the
menu's sheet while the menu is up, and at the lower left otherwise. The
lines live in one place in the page, `.says`, which is a live region
(`role="status"`): a screen reader reads out what is added to it. When the
menu opens or closes, that one place is moved in the page with any lines
still in it.

## What is not known

Whether a screen reader reads those lines out a second time when they are
moved. The builder had no screen reader to try it with and said so. It was
not tried in a headset or on a real phone either.

## To try

With a screen reader on (Orca here, VoiceOver on a phone, TalkBack on
Android): say a line (take a picture), and open the menu while it is still
up; then close the menu while a line is up. Listen for the line being read
again.

## If it is read twice

The builder's mend, named in PR 434 and not built on a guess: two regions
that stay put, one in the sheet and one at the lower left, with a line put
into whichever is in use and never moved.

## Must not

- Build the mend before it has been heard to be needed.
