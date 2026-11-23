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

## The order unbriefed items are taken in

Proposed by the orchestrator on 2026-11-22 after the owner asked whether
backlog items get picked up once the right session is free (they had
been jumping the queue behind newer asks). Each time a session frees up,
it takes the next item here that fits its project. The owner can reorder
it at any time; nothing in it is a decision about what an item does.

**First, by the owner's word on 2026-11-23:** `menus-are-the-clients`, the
menus drawn by the client and not by each world, with the kit's menu as the
fallback. A written design first, then the kit and BitPortal's shell. It
goes ahead of everything below except a live fault; work already in hand
(own models step 2, the seat) is finished or parked at a safe point first.
Its design also covers `menu-tabs-wallet-files-order-pin` (the owner, the
same day).

**With it, the same day:** `bitlogin-panels-feel-native`: measured now by
the BitLogin session, fixed before the menu's Wallet and Files tabs (step 4).

**For the builder once the menu's step 1 is done** (while BitPortal's
session does step 2): `godot-headset-controls`, the same controls in a
headset in a Godot world as in every other.
Then `headset-menu-like-the-flat-one`, a design with pictures first.
Before both, since it is small and is the menu's own: the playback
controls of `own-music-everywhere`.

**After the menu, asked the same day:** `guest-accounts` (a design first),
then `items-for-guests`, which it largely replaces. In full: `items-for-guests`, items a visitor
can use without signing in, where the world and the item's maker allow it.

**Second, the same day:** `one-command-release`, everything of a release
up to the deploy in one command.

1. `room-computers-sign-in-words` (BitPortal): merged 2026-11-22.
2. `spawn-points` (kit, BitPortal session): merged 2026-11-22 (kit 0.81.0, template 129, BitPortal 194); not live.
3. `game-worlds-kit-gaps`: the presence source (after COMBATRIG's report),
   then the seated or vehicle mode (design merged 2026-11-22,
   `docs/plans/seated-mode.md`; the NSWP builder is building the fade first).
4. `rooms-start-or-join`: rooms you can see and join, with counts and a
   default.
5. `avatars-own-models`: your own model as your look.
6. `world-maps`.
7. One piece for things a world gives: `items-given-and-won`,
   `achievements-granted`, `hidden-items-easter-eggs`,
   `scores-across-worlds`, `scores-checked`.
8. `shared-physics` (a written design first).
9. `bag-icon-on-items`: merged 2026-11-22 (NSWP 331); not live.
10. Then: `door-and-airlock-skins` (after `item-file-hosts`, whose rule it
    uses), `items-scarce`, `starter-world-as-a-3d-website`,
   `rooms-stun-servers`, `tests-that-depend-on-the-clock`,
   `local-security-checks`.

**Last, and not a priority** (the owner, 2026-11-23): the agent platform,
`ai-keys-and-agents` and its nine pieces, `agents-0-contracts` to
`agents-8-a-companion-across-worlds`, in that order.

New asks from the owner still go in the day they are asked; where one is
urgent (a live fault), it goes first.

## Open

| File | What | Who | State |
|---|---|---|---|
| [doors-01-spacing](doors-01-spacing.md) | A least distance between two doors | BitPortal (kit half and client half) | live (kit 0.73.0) |
| [doors-02-what-a-world-offers](doors-02-what-a-world-offers.md) | Lit and dark icons on a door for what its world offers, explained in the game on hover | BitPortal (kit half and client half) | live (kit 0.73.0; Godot and a headset look left) |
| [one-command-release](one-command-release.md) | Everything of a release up to the deploy, in one command; the deploy stays the owner's word | BitPortal session (NSWP scripts) | building |
| [menus-are-the-clients](menus-are-the-clients.md) | The menus are the client's (BitPortal's), the same in every world; a world may add a tab; the kit's menu is the fallback | design first; then the NSWP builder and BitPortal | design drafted (`docs/plans/the-clients-menu.md`); questions with the owner and the orchestrator |
| [bitlogin-panels-feel-native](bitlogin-panels-feel-native.md) | BitLogin's panels (Wallet, Files and the rest) are slow; they need to feel native | BitLogin (its pages), then BitPortal (the shell keeps the panel alive) | measured; fixes being built on BitLogin's beta |
| [menu-tabs-wallet-files-order-pin](menu-tabs-wallet-files-order-pin.md) | Wallet and Files as their own tabs; tabs the visitor can reorder; one pinned at the far left | with the client's menu design | design drafted (`docs/plans/the-clients-menu.md`); questions with the owner and the orchestrator |
| [doors-03-details-and-travel](doors-03-details-and-travel.md) | A door's details in the menus, like an item's, with "Travel here" | BitPortal (kit half and client half) | building (kit, BitPortal's room and the template merged; the engine script's Travel tab left) |
| [door-and-airlock-skins](door-and-airlock-skins.md) | Doors and Airlock chambers that wear a world's own look, published like an item, with the same information | not briefed (kit first) | asked |
| [paid-front-room](paid-front-room.md) | The first thing in a world that asks to buy | NSWP builder | live (kit 0.73.0; no world paid) |
| [scores-across-worlds](scores-across-worlds.md) | A leaderboard shared by several worlds | not briefed | asked |
| [scores-checked](scores-checked.md) | Scores somebody has checked, not only claimed | not briefed | asked |
| [achievements-granted](achievements-granted.md) | Achievements a world grants, and ones across worlds | not briefed | asked |
| [items-given-and-won](items-given-and-won.md) | An item given by a world, or won | not briefed | asked |
| [hidden-items-easter-eggs](hidden-items-easter-eggs.md) | Hidden items to find across worlds, with proof of who found one | not briefed (the owner asked to think about it) | asked |
| [rooms-start-or-join](rooms-start-or-join.md) | Start a room or join one; open rooms listed with how full they are; join the best one by default; public, invite only or private; up to large servers | not briefed | asked |
| [shared-physics](shared-physics.md) | Physics that everyone in a room sees the same, and what happens when the one in charge leaves | not briefed (the owner asked to talk it through) | asked |
| [spawn-points](spawn-points.md) | Enough places to arrive at that nobody arrives inside someone | BitPortal | merged (kit 0.81.0, template 129, BitPortal 194); not live |
| [room-computers-sign-in-words](room-computers-sign-in-words.md) | The room's computers still say "Sign in on the front page" | BitPortal | merged (BitPortal 193; its Sign in button tried in the room); not live |
| [avatars-own-models](avatars-own-models.md) | Your own model, size and animations as your look, in every world that allows it | BitPortal session (design: `docs/plans/own-models.md`; the owner's answers 2026-11-22) | building, parked (steps 1 and 2 merged; what was owed first is done) |
| [world-maps](world-maps.md) | Maps of the connected worlds, made by travelling, private unless shared, drawn as a graph | not briefed | asked |
| [lists-dated-in-the-future](lists-dated-in-the-future.md) | A list of worlds signed with a fast clock can pin itself | NSWP builder | building |
| [gate-shut-for-a-moment](gate-shut-for-a-moment.md) | Someone just invited can be told a world is shut, for a moment, before they are let in | NSWP builder | asked |
| [headset-casual-and-intense](headset-casual-and-intense.md) | Casual or intense, asked once in a headset and at a desk, kept in synced settings; a phone always casual | BitPortal (kit and room) | building (intense lost at every door: being fixed; offered once on entering VR) |
| [rooms-stun-servers](rooms-stun-servers.md) | Every room asks Cloudflare's and Google's STUN servers, who see each joiner's address | not briefed | asked |
| [item-file-hosts](item-file-hosts.md) | An item's files are fetched from any host its maker chose, which can learn the address of everyone in the room | BitPortal session (the rule decided 2026-11-22) | building |
| [fullscreen-button-and-escape](fullscreen-button-and-escape.md) | A full-screen button at the top; Escape opens the menu first | NSWP builder | merged (kit 0.78.0; not live) |
| [jump-sound-two-steps](jump-sound-two-steps.md) | The jump sounds like two footsteps, a little louder | NSWP builder | merged (kit 0.78.0; not live) |
| [bag-icon-on-items](bag-icon-on-items.md) | Items in your bag show a bag in their corner; the rest are greyed out | NSWP builder | merged (NSWP 331); not live |
| [own-music-everywhere](own-music-everywhere.md) | Your own music keeps playing across worlds, gets proper playback controls, and can play from your BitLogin files | BitPortal (step 2), NSWP builder (controls), BitLogin (files, step 4) | asked; the controls: building |
| [godot-headset-controls](godot-headset-controls.md) | A Godot world has no way to move in a headset: the same controls as every other world | NSWP builder | asked (next for the builder after the menu's step 1) |
| [headset-menu-like-the-flat-one](headset-menu-like-the-flat-one.md) | In a headset, the flat screen's menu: larger, floating, the bar below tilted towards you, things coming forward under the pointer | NSWP builder | asked (after Godot's headset controls; a design with pictures first) |
| [books-and-shelves](books-and-shelves.md) | Books bound to Nostr long-form notes, read page by page with the same pages for everyone; shelves with a fixed number of places; a world's keeper placing things that stay | design first (kit) | asked |
| [guest-accounts](guest-accounts.md) | One identity across BitPortal: a guest is a generated account made automatically, and a guest or an account is known in every world without being asked | design first (BitLogin, with the kit's half) | asked |
| [ai-keys-and-agents](ai-keys-and-agents.md) | AI provider keys kept in BitLogin (intelligence, voice, System 1, other), and AI agents in the worlds made by signed notes, paid for by each visitor's own key | design first (BitLogin, the kit, BitPortal) | asked |
| [agents-0-contracts](agents-0-contracts.md) | The words and the boundaries, before anything is built | not briefed (nswp-agents) | done 2026-11-23 in nswp-agents, on a branch, unmerged |
| [agents-1-several-in-one-world](agents-1-several-in-one-world.md) | Several agents in one world, in the visitor's own browser | not briefed (nswp-agents) | asked; not a priority |
| [agents-2-a-world-places-them](agents-2-a-world-places-them.md) | A world's maker places agents by writing data | not briefed (nswp-agents) | asked; not a priority |
| [agents-3-who-an-agent-is](agents-3-who-an-agent-is.md) | Who an agent is, as signed notes, with its SOUL | not briefed (nswp-agents) | asked; not a priority |
| [agents-4-what-it-remembers](agents-4-what-it-remembers.md) | What an agent remembers of a visitor, kept private | not briefed (nswp-agents) | asked; not a priority |
| [agents-5-thinking-deciding-speaking](agents-5-thinking-deciding-speaking.md) | Thinking, quick decisions, speaking and hearing, each replaceable | not briefed (nswp-agents) | asked; not a priority |
| [agents-6-keys-in-bitlogin](agents-6-keys-in-bitlogin.md) | Provider keys kept in BitLogin, and spent without a world holding them | not briefed (bitlogin) | asked; not a priority |
| [agents-7-shared-and-always-on](agents-7-shared-and-always-on.md) | One agent shared by a room, and agents that go on when nobody is there | not briefed (NSWP and nswp-agents) | asked; not a priority |
| [agents-8-a-companion-across-worlds](agents-8-a-companion-across-worlds.md) | A companion that comes with you from world to world | not briefed (NSWP) | asked; not a priority |
| [items-for-guests](items-for-guests.md) | Items a visitor can use without signing in, where the world and the item's maker both allow it | not briefed (kit first) | asked |
| [items-work-in-the-room](items-work-in-the-room.md) | Items like the dart blaster work in BitPortal's room | BitPortal | merged (not live) |
| [touch-look-and-item-presses](touch-look-and-item-presses.md) | Looking up and down, and aiming, firing and reloading a held item, on a phone and at a casual desk | BitPortal (kit) | briefed (option B chosen) |
| [bar-scrolls-when-too-wide](bar-scrolls-when-too-wide.md) | The bar along the bottom scrolls with arrows when it is too wide | NSWP builder | building |
| [game-worlds-kit-gaps](game-worlds-kit-gaps.md) | What a game world like COMBATRIG needs: a presence source, a seated mode, a loading signal and more | not briefed (COMBATRIG answered) | asked |
| [items-scarce](items-scarce.md) | Items of which only so many exist | not briefed | asked |
| [protocol-status-lines](protocol-status-lines.md) | Four status lines that say BitLogin hasn't built what it has | the orchestrator | merged |
| [bridge-test-fails-when-busy](bridge-test-fails-when-busy.md) | A test that fails only when the machine is busy | the orchestrator | merged |
| [tests-that-depend-on-the-clock](tests-that-depend-on-the-clock.md) | Tests that fail when the machine is busy | NSWP builder | asked |
| [local-security-checks](local-security-checks.md) | A check for committed secrets and faulty dependencies, run locally | NSWP builder; BitPortal | asked |
| [landing-01-refresh](landing-01-refresh.md) | BitPortal's first page made new: one job, getting a visitor in | BitPortal | merged (lobby at /doors/, new landing page; not live) |
| [landing-02-get-started](landing-02-get-started.md) | A getting-started page for builders, written for agents | BitPortal; the words from the kit | building (`docs/start.md` merged as kit 0.74.1; BitPortal's /start/ next) |
| [landing-03-how-it-works](landing-03-how-it-works.md) | A page that explains doors, the Airlock, signing in and the rest | BitPortal | briefed |
| [landing-04-prototype-notice](landing-04-prototype-notice.md) | A notice, once, that this is an early prototype | BitPortal | live (kit 0.73.0 release) |
| [starter-world-as-a-3d-website](starter-world-as-a-3d-website.md) | The starter world as a walk through every feature | not briefed | asked |
| [bitgate](bitgate.md) | BitGate deciding who may sell, be paid, and be shown | BitGate | briefed |
| [private-worlds-by-invitation](private-worlds-by-invitation.md) | A world by invitation: its owner's own list of who may come in, and who may not | NSWP builder (kit); BitGate (the list's shape); BitPortal (client) | building (block list and by-invitation live since kit 0.78.1; the owner's screen merged, NSWP 319, tried against BitLogin's real signer; the sealed kind and BitPortal hiding doors left) |
