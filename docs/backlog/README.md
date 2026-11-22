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
| [doors-01-spacing](doors-01-spacing.md) | A least distance between two doors | BitPortal (kit half and client half) | live (kit 0.73.0) |
| [doors-02-what-a-world-offers](doors-02-what-a-world-offers.md) | Lit and dark icons on a door for what its world offers, explained in the game on hover | BitPortal (kit half and client half) | live (kit 0.73.0; Godot and a headset look left) |
| [doors-03-details-and-travel](doors-03-details-and-travel.md) | A door's details in the menus, like an item's, with "Travel here" | BitPortal (kit half and client half) | building (kit, BitPortal's room and the template merged; the engine script's Travel tab left) |
| [paid-front-room](paid-front-room.md) | The first thing in a world that asks to buy | NSWP builder | live (kit 0.73.0; no world paid) |
| [scores-across-worlds](scores-across-worlds.md) | A leaderboard shared by several worlds | not briefed | asked |
| [scores-checked](scores-checked.md) | Scores somebody has checked, not only claimed | not briefed | asked |
| [achievements-granted](achievements-granted.md) | Achievements a world grants, and ones across worlds | not briefed | asked |
| [items-given-and-won](items-given-and-won.md) | An item given by a world, or won | not briefed | asked |
| [hidden-items-easter-eggs](hidden-items-easter-eggs.md) | Hidden items to find across worlds, with proof of who found one | not briefed (the owner asked to think about it) | asked |
| [rooms-start-or-join](rooms-start-or-join.md) | Start a room or join one; open rooms listed with how full they are; join the best one by default; public, invite only or private; up to large servers | not briefed | asked |
| [shared-physics](shared-physics.md) | Physics that everyone in a room sees the same, and what happens when the one in charge leaves | not briefed (the owner asked to talk it through) | asked |
| [spawn-points](spawn-points.md) | Enough places to arrive at that nobody arrives inside someone | not briefed | asked |
| [room-computers-sign-in-words](room-computers-sign-in-words.md) | The room's computers still say "Sign in on the front page" | BitPortal | asked |
| [avatars-own-models](avatars-own-models.md) | Your own model, size and animations as your look, in every world that allows it | not briefed | asked |
| [world-maps](world-maps.md) | Maps of the connected worlds, made by travelling, private unless shared, drawn as a graph | not briefed | asked |
| [items-scarce](items-scarce.md) | Items of which only so many exist | not briefed | asked |
| [protocol-status-lines](protocol-status-lines.md) | Four status lines that say BitLogin hasn't built what it has | NSWP builder | asked |
| [bridge-test-fails-when-busy](bridge-test-fails-when-busy.md) | A test that fails only when the machine is busy | the orchestrator | merged |
| [tests-that-depend-on-the-clock](tests-that-depend-on-the-clock.md) | Tests that fail when the machine is busy | NSWP builder | asked |
| [local-security-checks](local-security-checks.md) | A check for committed secrets and faulty dependencies, run locally | NSWP builder; BitPortal | asked |
| [landing-01-refresh](landing-01-refresh.md) | BitPortal's first page made new: one job, getting a visitor in | BitPortal | merged (lobby at /doors/, new landing page; not live) |
| [landing-02-get-started](landing-02-get-started.md) | A getting-started page for builders, written for agents | BitPortal; the words from the kit | briefed |
| [landing-03-how-it-works](landing-03-how-it-works.md) | A page that explains doors, the Airlock, signing in and the rest | BitPortal | briefed |
| [landing-04-prototype-notice](landing-04-prototype-notice.md) | A notice, once, that this is an early prototype | BitPortal | live (kit 0.73.0 release) |
| [starter-world-as-a-3d-website](starter-world-as-a-3d-website.md) | The starter world as a walk through every feature | not briefed | asked |
| [bitgate](bitgate.md) | BitGate deciding who may sell, be paid, and be shown | BitGate | briefed |
| [private-worlds-by-invitation](private-worlds-by-invitation.md) | A world by invitation: its owner's own list of who may come in, and who may not | NSWP builder (kit); BitGate (the list's shape); BitPortal (client) | building (plan written; one decision is the owner's) |
