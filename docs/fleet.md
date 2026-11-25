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
| **NSWP-Agents Agent** (started 2026-11-23) | `nswp-agents` (a private repository): the agent brain, its memory and its decision and voice adapters, from the owner's design pack kept there under `docs/plans/agent-platform/` | Everything in its own code. No note kinds of its own (rule 11), no keys given to a world, and nothing in another session's folder. Not a priority (the owner, 2026-11-23) |

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
   said. The tests are the repo's own: `vitest` collects only
   `packages/*/test`, never an agent's worktree under `.claude/`, and
   `npm test` first checks that it does (`scripts/check-test-files.mjs`).
   Until 2026-11-24 the main folder's run took every worktree's copy too,
   and one mid-rebase stopped the first deploy of 0.89.0.
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

14. **One heavy run at a time on this machine** (the owner, 2026-11-24,
    "yeah this machine is basically maxed out. how can we improve our
    efficiency?", then "yeah do what you think is best"). Gates, browser
    trials, full checks and big builds, in every project, take one lock
    first and wait their turn: `$HOME/.cache/bitblocks-heavy.lock`, held
    with `flock`, and `BITBLOCKS_HEAVY_HELD=1` set while it is held so a
    run started inside one goes straight on. In NSWP, `npm run gate` and
    `npm run trial` take it (`scripts/heavy.sh`); BitPortal's gate,
    BitLogin's full check and BitBrowser's builds take the same file. A
    run that waited is not a slow run, and a run made outside the lock
    while another holds it is the thing this rule is for: don't.
    **And the orchestrator does not run what the author already ran on the
    same commit:** it runs the gate and the trial the change is about, and
    the trials without the graphics card only where the change touches
    drawing or timing, and takes the author's other counts on that head as
    reported.
15. **Nothing lives only on this laptop** (the owner, 2026-11-25: "lets
    do a push of all our code to main. So nothing is lost if this laptop
    died", and "we are running hot and id hate to loose our work in
    progress over a drive failure or something"). At every stopping point,
    and at least at the end of every turn that changed files, a session
    commits what it has (a WIP commit is fine) and pushes its branch to
    GitHub. **Branches only, never `main`** for this: BitLogin's `main`
    deploys bitlogin.network, and NSWP's and BitPortal's take only what
    passed the gate. A branch whose GitHub copy has moved on is pushed
    under a new name (`backup/<branch>-<date>`), never forced. Before a
    push, `git status` is read so no `.env`, key, trial picture or
    downloaded file goes in. A pushed branch may make a preview; that is
    fine, and it is not a deploy. `scripts/backup-check.sh` (read only)
    lists whatever of BitBlocks is on no GitHub branch; it runs every night,
    and the orchestrator asks each session named in it to push.

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
- **A trial can press without meaning to.** In a scripted browser, a call
  into a page counts there as the visitor's own press, and so does a tool
  finding a button to click. A trial of what needs a press, or of who has the
  keys, then passes wrongly (2026-11-23: two runs said a framed world could
  start a headset session from a press above it). Such trials press with a
  mouse at a place on the screen and read only the console:
  `trials/README.md`, under Rules.
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
| `menu` (a number) in a world's `here`; the topic `nswp: "menu"` with `has`, `v`, `settings`, `world`, `press`, `key`, `open`, `go`, `say` (NSWP-02) | the NSWP builder | the words between a world and a client that draws its menu (`docs/plans/the-clients-menu.md`) | 2026-11-23 |
| A world's description: `title`, `level`, `corner`, `keys`, `state` (`room`: `has`, `joined`, `mic`, `count`; `headset`: `supported`, `presenting`; `named`; `holding`; `items`), `target`, `loading`, `sections`; a row's `bar` and `picture` | the NSWP builder | what a world says of itself to the client's menu | 2026-11-23 |
| `MENU_LIMITS` (`sections` 12, `rows` 60, `allRows` 200, `label` 120, `picture` 256, `bytes` 65536, `ownTabs` 2, `say` 200), `MENU_WAIT_MS` (300; 100 since 2026-11-25), `LEAVE_MS` (1000) | the NSWP builder | the limits a client holds a world's description to, and the two waits | 2026-11-23 |
| The kit's entry `nswp-sdk/menu`; `mountMenu`, `WorldPort`, `portHere`, `portBelow`, `portAbove` | the NSWP builder | the visitor's menu as a part of the kit, and the world's port with its carriers | 2026-11-23 |
| The travelling setting `tabs` (NSWP-11); the tabs `wallet` and `files`; the browser's `nswp.can("menu")` | the NSWP builder | the order of the visitor's tabs, the two new tabs, and the menu's words through a browser's bridge | 2026-11-23 |
| A described row's `kind: "copy"` with its text in `copy`; a described row's `kind: "field"` (not `ask`) | the NSWP builder | a row the client copies for a world, and a row the visitor types into, whose text goes to the world only at their press (`docs/plans/the-clients-menu.md`, section 4) | 2026-11-23 |
| `field` on a press (`{ nswp: "menu", press: id, field }`); `MENU_LIMITS.field` (500) and `MENU_LIMITS.copy` (2000); the word `{ nswp: "menu", picture, id }` | the NSWP builder | how typed text goes down to a world, the two limits, and a row's picture sent alone as it changes (at most eight a second for a row, only while the menu is up) | 2026-11-23 |
| Core, `packages/core/src/menu.ts`: `MENU_VERSION`, `MENU_VISITOR_TABS`, `MENU_WORLD_TABS`, `MENU_KEYS`, `MENU_ROW_KINDS`, `MENU_REPORTED`, `cleanMenuWorld`, `menuBytes`, `cleanMenuSettings`, `reportedSettings`, `readMenuWordDown`, `readMenuWordUp`, `menuVersionOf`; the types `MenuWorld`, `MenuSection`, `MenuRow`, `MenuCard`, `MenuState`, `MenuSettings`, `MenuReadOptions` (`own`, `also`, `picture`), `MenuWordDown`, `MenuWordUp`, `MenuKey`, `MenuRowKind`; `MENU_LIMITS.title` (80) and `.note` (400); in a description, a tab's `rows`, `label`, `icon`, `note`, `card`, a card's `title`, `tag`, `proven`, `sub`, `copy`, `text`, `color`, `now`, `acts`, `picture`, `loading`'s `fraction` and `words`, and `target` as a list of lines; `vectors/menu-words.json` | the NSWP builder | the menu's words as data: what each side may say, the limits, and the reading of whatever arrives (#358) | 2026-11-23 |
| The kit's entry `nswp-sdk/menu-above`; `MenuAbove` (`ready`, `has`, `onChange`, `menu`, `dispose`), `MenuAboveOptions` (`state`, `home`, `above`, `keys`), `describeWorld`; inside the kit, exported from no entry: `changeSettings`, `speakMenu`, `sinceHere`, `hearClientMenu`, `sayToClient`; `UiAction.copy`, and the optional `typed` of a row's `act` and of `controls.run`; the test hook `__nswpTest.menuAbove`; `trials/menu-above.mjs` | the NSWP builder | the world's end of the menu's port: a framed world that steps its menu aside (#359) | 2026-11-23 |
| From `nswp-sdk/menu`: `mergeView`, `MenuBelow` (`port`, `origin`, `speaks`, `world`, `onChange`, `attach`, `leave`, `dispose`), `MenuBelowOptions` (`controls`, `also`, `settings`, `home`, `onReported`, `picture`, `loaded`, `hear`, `origin`); `WORLDS` (the mark `world:` before a world's ids in the client's menu); the menu's `pressKey`; `STANDARD_TABS`, `standardTab`; `trials/stand-in-client/`, `trials/menu-client.mjs`, `trials/menu-rows.mjs` | the NSWP builder | the client's end of the menu's port, and the stand-in client it is tried in (#361, #363) | 2026-11-23 |
| `picturesSwitch`, `modelsSwitch`, `chatSwitch`, `VISITOR_SWITCHES` (`packages/sdk/src/visitor-switches.ts`), with `addDeskControls`, from `nswp-sdk/menu`; `packages/sdk/src/models-switch.ts`; `MenuMountOptions` (`parent`, `only`); the test hook `__nswpTest.chatPane` | the NSWP builder | the rows that change a travelling setting as the client's own, and the chat's pane kept by a world that steps aside (#368) | 2026-11-23 |
| `card:` before a tab's id, as the id of the picture of the card at that tab's head (`MENU_CARD_PICTURE`, core); `UiCard.face`; `MenuAboveOptions.picture` | the NSWP builder | a world's pictures going up to the client's menu as bitmaps (#373, #374) | 2026-11-23 |
| The word `{ nswp: "menu", sign: "out" }`; `state.signIn` (`none`, `ready`, `asking`, `unanswered`; core `MENU_SIGN_IN`) and `state.hum`; `signInRows`; `below.hold(item, { tints, script })` and `below.signOut`; the trial seam `__nswpTrial.has` | the NSWP builder | the kit's half of You and the Bag in a client's menu, and whether a place has a hum (#378, #381) | 2026-11-23 |
| `keepMenu` and `KeptMenu` (`packages/sdk/src/menu-keeper.ts`); `deskMovingSwitch`; `trials/menu-above-engine.mjs` | the NSWP builder | who draws the menu, as one piece of code for every world; the client's own switch for how a visitor moves at a desk (#383, #384) | 2026-11-23 |
| `askDeskMoving`, from `nswp-sdk/menu`; `FpsOptions.mayAsk` | the NSWP builder | the one-time question on how a visitor moves at a desk, asked by whoever draws the console (#386) | 2026-11-23 |
| The row kinds `file` and `save`; the words `{ nswp: "menu", press, file }` and `{ nswp: "menu", save, id }`; core: `MENU_FILE_KINDS`, `MENU_SAVE_TYPES`, `MENU_SAVE_MS`, `MENU_LIMITS.file`, `.fileName`, `.save`, `.saves`, `MenuRow.accept`, `menuFileKind`, `menuFileName`, `menuSaveType`, the types `MenuFileKind`, `MenuSaveType` | the NSWP builder | a file the visitor chose going down from the client's chooser, and a picture or a clip going up to be saved by the client's page (#396, #403) | 2026-11-23 |
| Kit, public: `UiAction.accept`, `act(typed, file)`, `run(id, typed, file)`; `MenuBelowOptions.onSave` and `SavedAbout`, from `nswp-sdk/menu`. Kit, inside: `packages/sdk/src/save-file.ts` (`saveFile`, moved there, and `download`); in `client-frame.ts`, `setSaver`, `handUp`, `savesWait`, `mayShareScreen`, `framedBy`, `screenNotHere`; the rows `room-screen-not-here` and `room-screen-how` | the NSWP builder | the kit's end of a file going down and a save going up; a world saying why its screen can't be shared in a frame that doesn't allow it (#403) | 2026-11-23 |
| `trials/menu-cost.mjs`, `trials/presses-handed-over.mjs` | the NSWP builder | what the client's menu costs, and the four presses a browser wants in the page that asks (#390, #396) | 2026-11-23 |
| The rows `juke-place`, `juke-previous`, `juke-back`, `juke-forward`, `juke-shuffle`, `juke-repeat`, `juke-bar`; the row kind `slider`, `UiAction.slider`, `UiSlider` (`value`, `max`, `text`); `Jukebox.previous`, `.seek`, `.position`, `.duration`, `.how`, `.setHow`; `JukeHow` (`shuffle`, `repeat`, `bar`); `SoundsOptions.keep.how`; kept under `nswp:jukebox:how`; inside the kit: `cleanHow`, `DEFAULT_HOW`, `JUKE_REPEATS`, `SKIP_SECONDS`, `RESTART_AFTER`, `songClock`, `shuffledSongs`, `songBeside`, `visitorsOwnRow`; the icons `play`, `pause`, `next`, `previous`, `rewind`, `forward`, `shuffle`, `repeat`, `music` | the NSWP builder | playback controls for a visitor's own music (`docs/backlog/own-music-everywhere.md`, #414) | 2026-11-23 |
| `NSWP.hands(json)`, answering with the kit's `Intent`; the fade's numbers in `NSWP.kit()`; the engine script's version 18 goes to this | the NSWP builder | what the hands mean in a headset, for a world made with another engine (`docs/plans/godot-headset-controls.md`, #415). Given, not built | 2026-11-23 |
| The kit's entry `nswp-sdk/bag` (`createBag`, `addBagControls`, `mayHold`, `scriptAllowed`); the files `packages/sdk/src/bag-entry.ts`, `hold.ts`, `file-store.ts`, `bag-pictures.ts`; handed on from `nswp-sdk/menu`: `arriveWith`, `currentSettings`, `changeSettings`, `watchEscape`, `fullscreenAction` | the NSWP builder | the Bag for a page with no renderer, and a menu entry that names none: a client's page (asked by BitPortal, step 2; #417) | 2026-11-23 |
| `MenuAboveOptions.own`, and `describeWorld`'s fourth argument | the NSWP builder | a page of its client's own origin describing the visitor's own tabs too (asked by BitPortal, step 2; #420) | 2026-11-23 |
| The engine script's `NSWP.hands(json)` (version 18), answering the kit's `Intent` with `fade`, `mayStep`, `stepping`, `intense`, and taking `stepped`; in `NSWP.kit()`: `fadeSeconds`, `stepReach`, `backStep`; kit, inside: `packages/sdk/src/comfort-controls.ts` (`keepComfort`), `packages/sdk/src/engine-hands.ts`; Godot: `Nswp.hands()`, `NswpVisitor.pretend_hands()`, `hands_report()`, `STICK_FORWARD`; `trials/godot-hands.mjs` | the NSWP builder | moving in a headset in a Godot world, the same as in every world (#423) | 2026-11-23 |
| The word `{ nswp: "menu", playing }` (down, carrying nothing else; the version of the words stays 1); `MenuBelowOptions.playing`, `MenuAboveOptions.playing`, `Sounds.stepBack(on)`, `Sounds.steppedBack` | the NSWP builder | a world's own music steps back while the visitor's own plays in their client's page (asked by BitPortal, step 2; #424) | 2026-11-23 |
| The word `{ nswp: "menu", making: "<the row's id>" }` (up); core `MENU_MAKING_MS` = 60 000, counted from the press; `making()` in `packages/sdk/src/client-frame.ts`; the client's two sentences, "<the world> is making it. It will be saved when it is ready." and "Nothing came from <the world> to save. Press again to try once more." | the NSWP builder | a slow device's picture is waited for, and a world still can't hold a press open (#424) | 2026-11-23 |
| From `nswp-sdk/bag`: `createItemStore`, `ItemStore`, `ItemStoreOptions` | the NSWP builder | a client's page builds its Bag with no renderer (asked by BitPortal on 0.85.0; #424) | 2026-11-23 |
| From `nswp-sdk/three`: `createItemPreviews`, `ItemPreviews`, `ItemPreviewsOptions`, under the names they have in the source | the NSWP builder | a client's page draws the Bag's things with the kit's own code, so a thing looks the same there as in a world's Bag (asked by the orchestrator for BitPortal). No change to what it does | 2026-11-24 |
| `keep`, an option of `deskMovingSwitch` and `askDeskMoving` (`nswp-sdk/menu`): the name the visitor's choice of how they move at a desk is kept under, as `createFps` already takes it | the NSWP builder | a client whose own room keeps that choice under a name of its own gives the same name to its menu, so the two hold one choice (asked by the orchestrator for BitPortal, whose shell kept it under the kit's name and its room under `bitportal:fps`). Left out, the kit's own name, as before | 2026-11-24 |
| `making()` in `packages/sdk/src/client-frame.ts` answers `boolean` (whether the word was said); `sent()` there, the turn after which a word just said to the page above has gone. Both inside the kit; neither is a word on the wire | the NSWP builder | a world's word that it is making a picture reaches the client before the picture is drawn (#429) | 2026-11-23 |
| Hooks of the Godot example for a test only, beside `nswpPretendHands`; not of the kit, and not for a world to use: `window.nswpMeasurePixels`, `window.nswpPixelsCost`, and the page's `window.nswpTrialPixels` and `window.nswpTrialPng`, which only `trials/godot-pixels.mjs` defines | the NSWP builder | what the console's picture costs to bring into a Godot world, measured before the console there was settled (#438) | 2026-11-23 |
| The engine script's `NSWP.console(input)` (**version 19**; `NSWP.cover()` and `NSWP.bounds()` took 20, 2026-11-25; seated mode, which is parked, takes the next one free when it lands), taking `open`, `press`, `have` and answering `open`, `stamp`, `w`, `h`, `wide`, `reach`, `drop`, `least`, `away`, `rows`; a row `{ id, x, y, w, h, lit }`, `lit` being `{ fill, fillAlpha, stroke, strokeAlpha, line, corners }` or `null`; `NSWP.consolePixels()`; the event `{ type: "console", open }` | the NSWP builder | the console in a headset for a world made with another engine: the kit draws it, the engine shows it and lights the row pointed at (#440) | 2026-11-23 |
| Godot: `Nswp.console(ask)`, `Nswp.console_pixels()`, the signal `console_asked(open)`. Kit, inside: `packages/sdk/src/console-drawing.ts`, `packages/sdk/src/engine-console.ts`. The Godot example: `#pixels` on its address | the NSWP builder | the same (#440) | 2026-11-23 |
| `SAY_STAYS` (`least` 4200, `most` 10 000, `easy` 60, `each` 70) and `sayStays(text)`, in `packages/sdk/src/ui/model.ts`. Inside the kit | the NSWP builder | how long words said for a moment stay: 4.2 s up to sixty letters, 70 ms a letter after, ten seconds at most (#448) | 2026-11-24 |
| `MENU_WAIT_MS` is 100, from 300. Built 2026-11-25, with `trials/menu-soon.mjs` | the NSWP builder | how long a framed world waits for a client to say it has the menu: BitPortal's shell timed with the processor slowed six times (`docs/plans/the-clients-menu.md`, section 6) | 2026-11-24 |
| `covers`, a field of the menu's words: `{ nswp: "menu", covers: { top, bottom, left, right, sheet? } }`. Built 2026-11-24. With it, given 2026-11-24 as proposed in its pull request: the type `MenuCovers` and the limit `MENU_LIMITS.covers` (8192) in the core; `cover()` and `bounds()` on `MenuAbove.menu` and on the kept menu; `left` and `right` added to what `Hud.cover()` answers. Not in it: the engine script's hand-over to another engine (`NSWP.cover()` and `NSWP.bounds()`, given, built 2026-11-25 at engine VERSION 20) | the NSWP builder | what of a world's view its client's menu covers, answered through `cover()` and `bounds()` whoever draws (step 3 of the client's menu) | 2026-11-24 |
| `/trial-pages/`, a path of the Gallery's local copy only, answered by `scripts/serve-local.mjs` from `trials/pages/` and never from a `dist/`; a test in the gate that no site's build carries a trial's page. Built 2026-11-24 on the owner's "Go for quest" (`scripts/trial-pages.mjs`, `trials/pages/quest-picture/`, `packages/core/test/trial-pages.test.ts`) | the NSWP builder | a page for the owner's Quest, served under the Gallery's own content rules with nothing deployed (`docs/plans/headset-menu.md`). `covers` confirmed the same day with all four edges | 2026-11-24 |
| `show`, a word of the menu's from a world to its client: `{ nswp: "menu", show: "<tab id>" }`. Built 2026-11-24. A word of its own and not a field on the summons, which toggles and is the visitor's own key | the NSWP builder | a world's row that opened its own menu on a tab asks its client for the same; it never puts the menu away (`docs/backlog/menu-opens-on-a-tab.md`). With it: `NSWP.cover()` and `NSWP.bounds()` for the engine script, given, built 2026-11-25 at engine VERSION 20 | 2026-11-24 |
| `MENU_SHOW_KEEP_MS` (2000), a wait beside `MENU_WAIT_MS` in core, in the vectors' `waits`. Given 2026-11-24 | the NSWP builder | how long a menu keeps an asking for a tab it doesn't have yet, and goes to it if it arrives (`docs/backlog/menu-opens-on-a-tab.md`, "A tab asked for early"). No new setting, no new word of the menu's | 2026-11-24 |
| `RELAY_PICK.listed` (24), `.wave` (4), `.waveMs` (3000), `.lateMs` (6000), `.took` (3), `.mend` (6), `.usual` (1), `.listWaitMs` (6000); `closed` on `RelayNote` (`{ read?, write? }`, when each was found); `askOwn(filter, who, o)` in `nswp-sdk/three`, answering `{ events, state }` ("found", "none", "unreached") with its hook for each wave; `sendWell` taking the least count by default. Given 2026-11-24; the type `AskedOwn` with its fields `relays` and `own`, `askOwn`'s options `mine` (with `kept`) and `onWave`, and `for` and `usualAtLeast` on `pickRelays` and `relaysWell`, given with #531 | the NSWP builder | a visitor's own notes looked for until found and sent until three relays took them, a relay that asks for a sign-in or payment taking no place (`docs/backlog/relays-chosen-well.md`) | 2026-11-24 |
| `RELAY_PICK.graceMs` (1000), for the list and every step of `askOwn`, on the condition that a newer note from a slower relay is taken when it comes and nothing older is put back over it; `relaysOf(who, o)` in `relay-book.ts`, not in the package's entries. `askOwn`'s option `onNewer`, told of a newer note that arrives after the grace. All given 2026-11-24 | the NSWP builder | once one relay has given what was asked for, how long the rest are given; a person's relays by the same rules as a look, for the senders that need them and not a note (`docs/backlog/relays-chosen-well.md`) | 2026-11-24 |
| `markSvg(o?)` in `nswp-sdk/ui` (`accent`, `ink`, `glass`, defaulting to the kit's, and `tile`), the mark as an SVG from the same numbers as the menu's button and the headset's; `packages/sdk/assets/mark/` with `mark.svg`, `mark-tile.svg`, `mark-tile-180.png`, `mark-tile-192.png`, `mark-tile-512.png`, `mark-tile-512-maskable.png`, made by `scripts/make-mark.mjs` (with `--accent`). Given 2026-11-24 | the NSWP builder | the menu's button is the mark everywhere, with no words, and one picture of it for every icon (`docs/backlog/the-mark-everywhere.md`) | 2026-11-24 |
| `bag.looking()` (`{ asked, of } | null`), how far a look of the visitor's bag has gone through their relays; `askOwn`'s `onWave(wave, asked, of)`, the two numbers added to a given hook; and `people.looking()` the same, where a line shows it. Given 2026-11-25 | the NSWP builder | the Bag tab says "Still looking: 14 of your 23 relays asked." while a look goes on in waves (BitPortal's count on 0.90.0) | 2026-11-25 |
| `family`, a field of the signer's `want`: `"https://*.<registrable domain>"`, and `familyTaken` in its `state` (BitLogin's words, carried unchanged); the world signer's `family` (true, false, or null where not offered). Given 2026-11-25 | the NSWP builder, with BitLogin | one sign-in carries to every world under the same registrable domain (the owner, 2026-11-25); ships in 0.92.0 beside BitLogin's release | 2026-11-25 |
| `signInHere(controls, section): UiAction` in `nswp-sdk/ui`, a "Sign in" row for a tab that says to sign in, doing what You's sign-in row does in one press; its row ids `sign-in-<section>`. Given 2026-11-25 | the NSWP builder | the owner's "sign in" button wherever a menu says to sign in (`docs/backlog/sign-in-where-it-is-asked.md`) | 2026-11-25 |
| `unreached(pubkey)`, a room event: someone found but not connected to after a second, fresh try (one retry at 15 s or on "failed"). Given 2026-11-25 | the NSWP builder | rooms that always connect, part 2: said when a connection fails (`docs/backlog/rooms-that-fill-and-always-connect.md`) | 2026-11-25 |
| `ROOM_RELAYS` in core (8): `DEFAULT_RELAYS`, then wss://offchain.pub, wss://relay.nostr.net, wss://nostr.bitcoiner.social, wss://nostr.oxtr.dev; a world's own `relays` still wins. Given 2026-11-25 | the NSWP builder | rooms that always connect, part 4: two visitors share several relays (`docs/backlog/rooms-that-fill-and-always-connect.md`) | 2026-11-25 |
| `bag.start(items)`: a visitor's first bag with these items in one note, written only where `askOwn` says `none` and the device keeps none; never over a bag found anywhere, never on `unreached`. Given 2026-11-25 | the NSWP builder | BitPortal's guest starter set, signed by BitLogin with no press at three signatures a minute | 2026-11-25 |
| `services/ice/`, the Cloudflare Worker `bitblocks-ice`; its secrets `TURN_KEY_ID`, `TURN_KEY_API_TOKEN`, `CF_ANALYTICS_TOKEN`; `iceFrom` on `JoinOptions`.; `CF_ACCOUNT_ID`, a fourth secret; `ICE_FROM`, the kit's default for `iceFrom`, null until the owner's Worker is live (a world's own wins). Given 2026-11-25 | the NSWP builder | TURN for rooms within the free tier (`docs/backlog/rooms-that-fill-and-always-connect.md`, "TURN, the setup plan") | 2026-11-25 |
| Guests in every world: `signer.guest` (true, false, null), `VerifiedPass.guest` (the pass's `["nswp:guest", "1"]`), `Member.guestAccount` (`guest` keeps its meaning), `guestName` exported from `nswp-sdk`; the manifest's `"guests": false` (`Manifest.guests?: boolean`, absent is true); `"guest_items": false`; the item tag `["guests", "no"]`; `ClientPanelMode` `"secure"`. Given 2026-11-25 | the NSWP builder | the kit's half of guest accounts (`docs/backlog/guest-accounts.md`), in four PRs | 2026-11-25 |
| The kit's held hands: `packages/sdk/assets/hands/` (the four GLBs from bitportal-art c30f660, `LICENSE-webxr-input-profiles.md`, `PROVENANCE.md`), served by each world at `hands/kit/`, and `createXrInput({ handsAt })`; for profiles `meta-quest-*` and `oculus-touch*` only, tracked bare hands unchanged. Given 2026-11-25 | the NSWP builder | the artist's hands as the kit's own (`docs/backlog/hands-in-a-headset.md`, part 2), by the owner's "Use the live game as the testing ground" | 2026-11-25 |
| `MenuState.guest` (whether who a world has is a guest account; only where `named`), `signInRows`' `secure` option, the row ids `world-guest` and `world-secure`. Given 2026-11-25 | the NSWP builder | a guest over a world, in the client's own You (PR 593) | 2026-11-25 |
| `MENU_LIMITS.sections` 16 (was 12). Given 2026-11-25 | the NSWP builder | BitPortal's room lost two tabs past 12 without a word | 2026-11-25 |
| `takesGuests`: whether guest accounts may come in, one word wherever the kit holds it: the world gate's `takesGuests` (its `guests` is the invitation list), `accessFor(...).takesGuests`, `JoinOptions.takesGuests` (absent or true, guests come in). The announcement's word stays `"guests": false` (`Manifest.guests?: false`). Given 2026-11-25 | the NSWP builder | a world that takes no guests (`docs/backlog/guest-accounts.md`, part 3) | 2026-11-25 |
| `{ t: "full" }`, a room signal message; `ROOM_LIMITS.lobbies` (32); the lobby rule "lobby", "lobby-2" and on (shown "Lobby 2"), the default room only, ties settled by when each joined, then key. `lobbyName(n)` in core, its function ("lobby" for 1, "lobby-n" from 2 to `ROOM_LIMITS.lobbies`, null past it), and `vectors/rooms.json`. Given 2026-11-25 | the NSWP builder | rooms that fill one at a time (`docs/backlog/rooms-that-fill-and-always-connect.md`, part 3) | 2026-11-25 |
| `packages/core/src/entry-places.ts`; `ENTRY_PLACES_LEAST = 4`, `ENTRY_PLACES_ROOMS = 8`, `ENTRY_CLEAR = 1`; `EntryPlace`, `entryPlaces`, `pickEntryPlace`, `checkEntryPlaces`; `PresenceOptions.arrival`; `NSWP.entryPlace`; Godot: an `nswp_entry`'s child `Node3D`s | the BitPortal session | places to arrive (spawn points) | 2026-11-22 |
| `npm run release:prepare`, `scripts/release-prepare.mjs` | the BitPortal session | everything of a release up to the deploy, in one command (`docs/backlog/one-command-release.md`) | 2026-11-23 |
| `FILE_HOSTS`, `fileHosts()`, `fetchByHash(sha256, hint)`; the console row `files-anywhere` ("Load people's files from anywhere") | the BitPortal session | fetching someone's look or item files only by hash from hosts on the viewer's own list (`docs/plans/own-models.md` 2.3a; `docs/backlog/item-file-hosts.md`) | 2026-11-22 |
| Own models (`docs/plans/own-models.md` section 4): core `LOOK_BUDGET`, `LOOK_HEIGHT`, `LOOK_MODELS_AT_ONCE`, `LOOK_NOTE_LIMIT`, `GlbCount.joints`, `GlbCount.morphs`, `readLookModel(note)`, `lookHeight(asked, world?)`, manifest `avatar.height` and `avatar.dress` (`"own"`), the NSWP-06 room message `avatar`; SDK `driveHumanoid`, `PresenceOptions.looks`, `Presence.lookInfo()`, console rows `people-models` ("Show people's own models") and `person-simple` ("Show as simple look"); engines: frame `people[].model`, `.height`, `.moment`, `.pace`, `.bones`, `NSWP.kit()`'s `lookHeight` and `lookBudget`; BitPortal rows `look-model` ("Use your own model") and `look-simple` ("Back to my simple look") | the BitPortal session | a look of your own: your own model, at your own height, in every world that allows it | 2026-11-22 |
| Own models, step 2 (all given 2026-11-23, after #342): core `withoutRequired`, `glbJson`, `lookFacing`, the travelling setting `models`; SDK `createLookModels`, `lookBudget`, `ownLookNote`, `showsModels` / `setShowsModels` / `onModelsChange`, `arrival.avatar()`, `Member.model`, `JoinOptions.avatar`, `PresenceOptions.avatar` and `.lookModels`, `Presence.showSimple` / `isSimple` / `drawsModels`, the `LookInfo` type; reference worlds: `WorldConfig.avatar`, `__nswpTrial.looks`, the test hook `lookInfo`. From step 1: `LOOK_FORMATS`, `ModelBudget` | the BitPortal session | the kit drawing people's own models (`docs/plans/own-models.md`) | 2026-11-23 |
| `chooseLooks`, `worldDrawsModels`, the `WorldLooks` type, `AVATAR_EVERY_MS` (SDK); `MODE` of `trials/own-models-two.mjs` | the BitPortal session | who is drawn as their own model, as one tested rule; how often a member's look note is taken (#347) | 2026-11-23 |
| `scripts/lan-address.mjs`: `lanAddress`, `anyAddress`, `waitForLanAddress`; the env `LAN_WAIT_MS` | the BitPortal session | the local sites served at the machine's own network address, never a VPN's (#348) | 2026-11-23 |
| `nextVersion`, `cutVersion` (`scripts/release-prepare.mjs`); the env `NSWP_RELEASE_WORK`, `NSWP_RELEASE_WAIT_MS`, `NSWP_RELEASE_POLL_MS` | the BitPortal session | `npm run release:prepare` (#344) | 2026-11-23 |
| The hello's `"first":true` (NSWP-06), `buildHello(..., { first })`, `Member.joinedAfterYou`; a frame's `view.moving` | the BitPortal session | only the one arriving steps aside. The engine event `stepAside` given earlier is not used: a frame's existing `nudge` does it | 2026-11-22 |

## Trying things together

`trials/` holds the scripts that try the projects together on one machine,
and `trials/README.md` says what each needs running. What a trial showed is
recorded in the plan it belongs to.
