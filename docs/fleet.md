# How the sessions work together

Several AI sessions build this with the owner, each in its own project. This
is how they stay one system, written down on 2026-11-21 when the owner said:
"build our little fleet how you think it will work best."

## Who has what

| Session | Its project | It decides |
|---|---|---|
| **The orchestrator** (the NSWP session) | No code of its own to build. It holds the plans, the board and the list of what waits on the owner; reviews and merges what the builders hand it for this repository and BitPortal; vendors the kit; releases the sites on the owner's word | What the others are asked to build to; what is recorded as decided; what is merged here |
| **NSWP builder** | This repository: the protocol, the kit, the reference worlds | How its brief is built; nothing that changes a decision of the owner's |
| **BitPortal** (was "Bitportal VR") | BitPortal the website, and what was learnt on a headset | How a feature it is briefed on is built |
| **Bitlogin** | The sign-in address: accounts, the signer, the wallet, the buy and tip screens | Everything in its own code and its own releases |
| **Bitunlock** | The selling service: listings, payments, receipts | Everything in its own code and its own releases |
| **BitBrowser** | A headset browser of our own (a fork) | Everything in its own code; nothing of payments or identity (`browser/spec.md`, section 2a) |

The owner works through the orchestrator (2026-11-21: "id like to work
through you directly"): they say what they want, it is written as a brief
for the session whose project it is, and their questions and answers pass
the same way. The orchestrator says what is live.

## The rules

1. **An agreement is a file, not a message.** What two projects must agree on
   is written as examples both run (`vectors/`), a schema, or a section of a
   plan, before either builds to it. A message says where the file is.
2. **Each repository's main folder stays on `main`, clean, and nobody edits
   in it.** It is what is deployed and what others copy from. Every change is
   made in a worktree beside it and arrives by pull request. (Agreed for this
   repository and BitPortal's; the others' are their own sessions' to run.)
3. **The checks are run here, on this machine.** There is no paid check
   anywhere else (the owner: "We should do the CI tests local. I have no
   github credits and im not paying for that"). `npm run gate` is every check
   this repository has, stops at the first failure, and exits with its code.
   Nothing is merged on a gate that didn't pass. Whoever merges says which
   command they ran and that it exited 0. A test that fails only while the
   machine is busy still failed: it is run again when quiet, and that is
   said.
4. **A report says what was seen and what wasn't.** "Passed here", "the
   other session reports", and "nobody has tried" are three different
   things, and each is written as what it is. A report of work names the
   commit, the command, how it exited and how many things it looked at.
5. **A pull request that is ready doesn't wait for the owner** (the owner,
   2026-11-21: "tell all the sessions not to wait for me to approve a PR.
   If its ready commit, push and merge it"). Ready means the gate exited 0.
   In this repository and BitPortal's, a session hands its pull request to
   the orchestrator to merge, since it vendors and releases what goes in;
   that is not a wait on the owner. **What goes live is still the owner's
   own word:** a deploy, a release, a migration of live data, a live
   setting, a publish to public relays, a new thing at a host, a licence.
   In BitLogin's repository a merge to `main` is a release to
   bitlogin.network, and that too goes when it is ready (the owner, asked
   exactly that: "if they are ready then commit and push to main too"). The
   orchestrator's recommendation is never that word. The owner's words are
   passed on exactly, quoted, with what they were asked and the exact step
   beside them. A session whose own rules need a step said to it directly
   says so, and the owner goes there.
6. **Merged is not live.** Every report to the owner begins with what the
   public sites are on.
7. **Questions for the owner go through the orchestrator** (the owner,
   2026-11-21: "I told them to ask me questions through you and you will
   answer them for me"). A session sends its question and its own
   recommendation. A question of design or order the orchestrator answers
   itself, and says the answer is its own. Anything under rule 5 it puts to
   the owner, on the one list it keeps of what waits on them, and sends
   back their words. Nobody asks the owner the same thing in two places.
8. **A message says what it wants.** Its first line says whether it needs
   an answer or is for information. One report for one stage of work, not
   several. Before asking again, a session checks whether the answer is
   already waiting for it: messages cross.
9. **What is shared doesn't belong to a session.** The local sites and the
   stand-in relay run as services on the owner's machine
   (`trials/README.md`), so they outlive every session. What one session
   does run for the others (the sandbox) it says so, and says before it
   changes under someone.
10. **A big piece of work starts in a session of its own,** from a written
    brief that names the files and what done looks like. The orchestrator
    reviews it; it doesn't hold everything in its own head.
11. **Where there is one of something, it is given, not taken.** Two
    sessions took kit 0.72.0 on the same afternoon (2026-11-21), and one
    had to change every mention of it. So a pull request that changes the
    kit leaves `KIT_VERSION` alone and writes its changelog entry under a
    heading `## Next` at the top of `CHANGELOG.md` (the check reads the
    newest numbered heading, so this passes). The orchestrator gives it
    the next number after the merge, in a pull request of its own: the
    heading, `KIT_VERSION`, the engine script rebuilt. The same holds for
    anything else two sessions could both reach for: an event kind, a tag's
    name, a port. It is asked for before it is used, and written on the
    board.
12. **A branch handed over to be merged is left alone** until it is merged
    or answered. The orchestrator gates the exact commit it was told of and
    merges only if the head is still that commit; a push meanwhile means the
    gate is run twice (it happened, 2026-11-21). A fix found after handing
    over is said in a message first.
13. **A session merges its own pull request when it changes only words**
    (the owner, 2026-11-23: "yes do 4 and 5 as well"). Every pull request
    used to pass through the orchestrator, backlog notes and plans included,
    and its turns went on those. So in NSWP and BitPortal a session gates
    and merges its own pull request, without handing it over, where every
    file it changes is under `docs/`: the gate (`npm run gate -- --quick`)
    exited 0 on that commit, tested by its exit code; the branch is on the
    current `main`; the merge is read back as merged; and the orchestrator
    is told in one line, for information. Everything else is still handed
    over: code, tests, scripts, `protocol/`, `schemas/`, `vectors/`,
    `CHANGELOG.md`, the engine script, and any change to these rules. In
    `docs/fleet.md` a session may add only rows to "Names given", for names
    the orchestrator gave. A plan with questions for the orchestrator or
    the owner may be merged as a draft, but nothing is built from it until
    they are answered. Never in BitLogin, where a merge to `main` deploys.

## What a bigger fleet taught us

The owner runs a fleet of about fifty sessions on another project, and sent
the orchestrator to ask its dispatcher what had gone wrong there
(2026-11-21). These are the lessons taken, and the few left for later.

- **Messages cross whatever you do, so make it not matter.** Every piece of
  work between sessions is a row on the board (below). A message points at a
  row; when two messages cross, both sides read the row again, not their
  memory of a message.
- **Done means on `main`, and seen there.** Not "committed", not "on my
  branch", not "queued". For something a visitor uses, done means live, and
  checked on the live site.
- **A report that can be believed has four things:** the commit, the exact
  command, how it exited (its exit code, never a count pulled out of its
  output), and how many things it looked at ("no failures" out of how many?).
  Whoever receives it checks one thing cheaply: that the commit is on `main`,
  or the line is there, or the page answers.
- **A check that can't fail proves nothing.** When a check is added, it is
  seen to go red once on something wrong.
- **"Passed every check" is not "works".** Both of today's real faults were
  found by trying the thing end to end, not by a check.
- **Memory holds lessons, never the state of things.** What is live, what is
  waiting and who is doing what go stale in hours. They are read from the
  board, the repository and the live sites each time. A rule is read again
  from the file before it is acted on.
- **Whoever orchestrates doesn't also build.** A session that does both
  fills with diffs and loses the thread. (Rule 10 was the start of this.)
- **Keep this file short.** A rule goes in only if it is easy to break, and
  each new one should push an old one out or earn its place.

Left for when five becomes more: a queue for merging, a set rhythm of
reminders, reports made by a tool. At five, the board and a look at `main`
do most of it.

Small things worth knowing on this machine, each learnt the hard way there:
close every browser a script opens; never stop a program by matching its
name (the command doing the matching matches itself); never `git stash` in a
repository with worktrees (the stack is shared); never `git add -A` while
something else is still writing files.

## The board

One page holds what is waiting on the owner and what each session has in
hand: who, where it stands, what it waits on, and what stands behind that.
The orchestrator keeps it. It is the owner's private page ("Waiting on you"),
with a small store behind it; a session that can't read it asks the
orchestrator, and says the row's name in any message about that work. The
plans in `docs/plans/` stay the record of what was decided and why; the board
is only what is in motion.

## Names given

Rule 11's record: each thing there is one of, who it was given to, and
when. Ask the orchestrator before using one that isn't here.

| Name | Given to | For | When |
|---|---|---|---|
| Kit version numbers (`KIT_VERSION`, the changelog's headings) | the orchestrator, at each merge | the kit | 2026-11-21 |
| Kind 30078 with `d` = `<namespace>:governance:<scope>:v1[:<subject>]` | BitGate (its shape, `docs/governance-lists.md` in its repository) | allow and block lists, per world and per owner | 2026-11-21 |
| The tag `subject` inside those lists | BitGate | which world a list is for | 2026-11-21 |
| The namespace `nswp` in those lists | the kit | every client's lists for worlds | 2026-11-21 (final: BitGate's vectors at 8b98ed9) |
| `keepers`, `by_invitation`, `named_only` in a world's manifest entry | the kit's builder | worlds by invitation | 2026-11-21 |
| The announcement tag `["by-invitation"]` | the kit's builder | a world that says it is by invitation | 2026-11-21 |
| The page `/doors/` in BitPortal | the BitPortal session | the lobby's own page | 2026-11-21 |
| `docs/start.md` in NSWP; `/start/` and `/start.md` in BitPortal | the BitPortal session | the getting-started page | 2026-11-21 |
| Namespaces `bitunlock.sellers`, `bitunlock.payees`, `bitunlock.listings`, `bitunlock.people` in governance lists | BitGate (its `named-lists.json`, merged at a9b02cb) | who may sell, be paid, which listings may be sold, who is blocked, at BitUnlock | 2026-11-21 (BitUnlock agreed) |
| The role `list-curator` in a root's role document | BitGate | a key that may keep lists and nothing else | 2026-11-21 |
| `controls.setLoading`, `view.loading`; engine events `loading` and `loaded`; Godot `Nswp.loading` (ends at 1.0, no `Nswp.loaded`); `worldDownload`; `DOWNLOAD_WARN_MB = 50` | the NSWP builder | "you're in, still loading" and how big a world says it is | 2026-11-22 |
| `changeOwnerList`, `isOwnerListAsked`, `signer.guests`, `gate.changeList`, `gate.keeper`, `gate.guests`; console section `guests`, titled "Who comes in" | the NSWP builder | the owner's screen for a world by invitation | 2026-11-22 |
| The arrival field `smooth` (`true` or `false`, absent for a plain link) and the link parameter `smooth=1` / `smooth=0` (NSWP-03) | the NSWP builder | the visitor's answer at the Airlock to being moved smoothly, for that visit (seated mode) | 2026-11-22 |
| `maySlide`, `rideWords` (core) | the NSWP builder | whether a visitor may be moved smoothly here, and the Airlock's words for it (seated mode) | 2026-11-22 |
| `Comfort.fade` and the travelling setting `fade` (NSWP-11) | the NSWP builder | the fade for jumps the kit makes in a headset | 2026-11-22 |
| `xrInput.sit`, `xrInput.stand`, `xrInput.recentre`, `xrInput.jump` | the NSWP builder | the seat, recentring, and a jump with the fade (seated mode) | 2026-11-22 |
| Console ids `ride-ask`, `ride-here`, `recentre`, `move-fade` | the NSWP builder | the in-world question, its Moving switch, recentring, and the fade's Moving switch (seated mode) | 2026-11-22 |
| `CATCH_UP_MS` = 1000 | the NSWP builder | the shortest time between a casual visitor's catch-up jumps in a vehicle (seated mode) | 2026-11-22 |
| `scripts/release-prepare.mjs`, `npm run release:prepare` | whoever builds `one-command-release` | everything of a release up to the deploy, in one command | 2026-11-23 |
| Engine script: `seated(on)`, `kit()`'s `slide` and `fade`, the event `{ type: "recentre" }`, engine VERSION 18 | the NSWP builder | seated mode in engine worlds | 2026-11-22 |
| Godot: `NswpSeat`, `Nswp.recentre_asked` | the NSWP builder | seated mode in Godot | 2026-11-22 |
| `mark` and `faint` on a menu control (`UiAction`), given in the view (`UiItemView`) as `mark` and `faint` | the NSWP builder | a tile's small icon in its corner, and a tile drawn greyed and still pressable, for any tile (the Bag's items) | 2026-11-22 |
| `packages/core/src/entry-places.ts`; `ENTRY_PLACES_LEAST = 4`, `ENTRY_PLACES_ROOMS = 8`, `ENTRY_CLEAR = 1`; `EntryPlace`, `entryPlaces`, `pickEntryPlace`, `checkEntryPlaces`; `PresenceOptions.arrival`; `NSWP.entryPlace`; Godot: an `nswp_entry`'s child `Node3D`s | the BitPortal session | places to arrive (spawn points) | 2026-11-22 |
| `FILE_HOSTS`, `fileHosts()`, `fetchByHash(sha256, hint)`; the console row `files-anywhere` ("Load people's files from anywhere") | the BitPortal session | fetching someone's look or item files only by hash from hosts on the viewer's own list (`docs/plans/own-models.md` 2.3a; `docs/backlog/item-file-hosts.md`) | 2026-11-22 |
| Own models (`docs/plans/own-models.md` section 4): core `LOOK_BUDGET`, `LOOK_HEIGHT`, `LOOK_MODELS_AT_ONCE`, `LOOK_NOTE_LIMIT`, `GlbCount.joints`, `GlbCount.morphs`, `readLookModel(note)`, `lookHeight(asked, world?)`, manifest `avatar.height` and `avatar.dress` (`"own"`), the NSWP-06 room message `avatar`; SDK `driveHumanoid`, `PresenceOptions.looks`, `Presence.lookInfo()`, console rows `people-models` ("Show people's own models") and `person-simple` ("Show as simple look"); engines: frame `people[].model`, `.height`, `.moment`, `.pace`, `.bones`, `NSWP.kit()`'s `lookHeight` and `lookBudget`; BitPortal rows `look-model` ("Use your own model") and `look-simple` ("Back to my simple look") | the BitPortal session | a look of your own: your own model, at your own height, in every world that allows it | 2026-11-22 |
| The hello's `"first":true` (NSWP-06), `buildHello(..., { first })`, `Member.joinedAfterYou`; a frame's `view.moving` | the BitPortal session | only the one arriving steps aside. The engine event `stepAside` given earlier is not used: a frame's existing `nudge` does it | 2026-11-22 |

## Trying things together

`trials/` holds the scripts that try the projects together on one machine,
and `trials/README.md` says what each needs running. What a trial showed is
recorded in the plan it belongs to.
