# The backlog

Every feature the owner asks for is written here the day it is asked, in
their own words, before anyone builds it. A session's memory is summarized
and forgotten; this folder is not. (The owner, 2026-11-21: "I want to make
sure these get added to some sort of backlog of features and not lost in a
session compaction process.")

One file for one thing that can be finished by itself. Each says:

- **Asked:** the date and the owner's exact words.
- **Who:** the session whose project it is. Where it has two halves, both.
- **The kit's half, and the client's half.** The owner, 2026-11-21: "The most
  important part is the kit we ship to all users and builders. And our
  framework. So that its consistent for everyone." So anything a world
  would also need is built in the kit first, and BitPortal only uses it.
  A file says which half is which, so two builders don't each guess.
- **Done looks like,** and what it must not do.
- **State:** `asked` (written down, nobody briefed), `briefed`, `building`,
  `merged` (on `main`, with the commit), `live` (on the public sites, with
  the kit's version). Nothing is `live` because it is merged.

The orchestrator keeps these. A builder changes a file's state in the pull
request that does the work. The page of what is in motion (the board,
`docs/fleet.md`) points here; this is the record.

## Open

| File | What | Who | State |
|---|---|---|---|
| [doors-01-spacing](doors-01-spacing.md) | A least distance between two doors | BitPortal (kit half and client half) | merged |
| [doors-02-what-a-world-offers](doors-02-what-a-world-offers.md) | Lit and dark icons on a door for what its world offers, explained in the game on hover | BitPortal (kit half and client half) | building |
| [doors-03-details-and-travel](doors-03-details-and-travel.md) | A door's details in the menus, like an item's, with "Travel here" | BitPortal (kit half and client half) | briefed |
| [paid-front-room](paid-front-room.md) | The first thing in a world that asks to buy | NSWP builder | building |
| [scores-across-worlds](scores-across-worlds.md) | A leaderboard shared by several worlds | not briefed | asked |
| [scores-checked](scores-checked.md) | Scores somebody has checked, not only claimed | not briefed | asked |
| [achievements-granted](achievements-granted.md) | Achievements a world grants, and ones across worlds | not briefed | asked |
| [items-given-and-won](items-given-and-won.md) | An item given by a world, or won | not briefed | asked |
| [items-scarce](items-scarce.md) | Items of which only so many exist | not briefed | asked |
| [protocol-status-lines](protocol-status-lines.md) | Four status lines that say BitLogin hasn't built what it has | NSWP builder | asked |
| [bridge-test-fails-when-busy](bridge-test-fails-when-busy.md) | A test that fails only when the machine is busy | the orchestrator | merged |
| [tests-that-depend-on-the-clock](tests-that-depend-on-the-clock.md) | Tests that fail when the machine is busy | NSWP builder | asked |
| [local-security-checks](local-security-checks.md) | A check for committed secrets and faulty dependencies, run locally | NSWP builder; BitPortal | asked |
| [landing-01-refresh](landing-01-refresh.md) | BitPortal's first page made new: one job, getting a visitor in | BitPortal | briefed |
| [landing-02-get-started](landing-02-get-started.md) | A getting-started page for builders, written for agents | BitPortal; the words from the kit | briefed |
| [landing-03-how-it-works](landing-03-how-it-works.md) | A page that explains doors, the Airlock, signing in and the rest | BitPortal | briefed |
| [landing-04-prototype-notice](landing-04-prototype-notice.md) | A notice, once, that this is an early prototype | BitPortal | briefed |
| [starter-world-as-a-3d-website](starter-world-as-a-3d-website.md) | The starter world as a walk through every feature | not briefed | asked |
| [bitgate](bitgate.md) | BitGate deciding who may sell, be paid, and be shown | no session yet | asked |
