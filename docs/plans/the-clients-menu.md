# The client's menu: a design

**Status:** the orchestrator answered on 2026-11-23 (section 14): the names are given,
the steps stand, and steps 0 and 0b go ahead. The owner's eight questions are still
open, and step 1 waits for them. NSWP builder, 2026-11-23. From
`docs/backlog/menus-are-the-clients.md` and
`docs/backlog/menu-tabs-wallet-files-order-pin.md`. Every new name is a proposal, listed
in section 13; none is used before it is given (rule 11).

## 0. In one paragraph

Today each world's page draws the visitor's console from its own copy of the kit. This
design moves it up: where a client keeps the screen and shows a world in a frame
(BitPortal's `/shell/`), **the client draws the menu, above the world**, from one copy
that is the same in every world. The world steps its own aside and says a few words
upward: what it is called, the tabs it adds, and the state of the things only it can run
(its room, its headset session, what is in hand). Presses on those go back down as
words. The kit's own menu stays, as the same code, for every place with no client above:
a world opened by its address, a phone until the frame is tried there, and inside a
headset, where only the world's page can draw.

## 1. What the owner decided, and what follows from it

Decided (2026-11-23):

- The menu is the client's, drawn by the shell above a framed world, the same in every
  world.
- A world may add a tab by describing it. It can't change, imitate or cover the rest.
- The kit's menu stays as the fallback wherever no client above says it has the menu.
- Wallet and Files are tabs of their own. The visitor can reorder tabs and pin one at
  the far left.

What follows, and is new:

- **Home becomes a guarantee, not an agreement.** The client owns the frame, so its Home
  takes the visitor home whatever the world does (section 5). NSWP-11 says today that
  "a world can break it"; in a client's frame, for the way home, it no longer can.
- **The menu is there before the world is.** The client's menu is up while a world is
  still loading, with the visitor's own tabs and Home. That also serves "you're in,
  still loading".
- **Private things stop passing through worlds.** The visitor's messages, follows, files
  and wallet are drawn and run by their own client. A framed world never handles them.
- **A world still decides how much room the console takes** (full, quiet, hidden), as
  NSWP-11's "The world leads" says. It says so in words, and the client keeps to it.

## 2. One menu, two places it runs

Taken from the orchestrator's proposal. The menu is one piece of code with one seam.

- **The menu** is everything a visitor sees of the console on a flat screen: the bar,
  the marks, the sheet with its tabs, the words shown for a moment, the line about what
  is pointed at. It also holds the logic of the visitor's own tabs.
- **The world's port** is the only way the menu learns anything of the world or does
  anything in it. It has a handful of calls: the world's description, a press, the
  visitor's settings, the menu opening and closing, leaving.
- **Two carriers for the port, and the menu can't tell which it has:**
  - *Direct.* The menu runs in the world's own page and calls the port as functions.
    This is the fallback, and it is what every world does today under other names.
  - *Words.* The menu runs in the client's page and the port is carried by the words of
    section 4 between the two pages.

So the fallback and the client's menu can't drift apart: they are the same menu, built
from the same source, and the world answers both through the same port. A test runs
the menu's own tests against each carrier.

## 3. The kit in two parts

Also the orchestrator's proposal, taken.

| Part | What is in it | Who carries it |
|---|---|---|
| **What a world runs** | Movement, doors and crossings, the chamber, rooms and presence, items and play, the gate, sounds as they play, the headset's in-world console, and the world's end of the port | Every world |
| **The menu** | The bar, marks and sheet; the visitor's own tabs; their settings; the summons at the top of the page; the Wallet and Files tabs | A client, for the worlds it frames. A world too, as the fallback |

- **A world still ships the menu,** as a separate file of its own build, on its own
  site, checked like the rest of the kit. It is loaded only when needed: at once where
  the world isn't framed, and where it is framed only if no client says it has the menu
  (section 6). A framed world never downloads it.
- **Never from another site.** The backlog set aside "one live copy of the kit for
  every world": whoever held that copy would hold every world. That stands. A world's
  fallback is its own copy; the client's menu is the client's own copy.
- **A world's part changes less often.** A change to how the menu looks or is laid out
  reaches every framed world the day the client deploys, with no world deployed. A
  world takes a new kit for the things it runs.
- **Versions.** The words carry a version. Each side ignores fields it doesn't know,
  and the lower of the two versions is the one spoken.

## 4. The words, as protocol text

Written to go into NSWP-02, "A client that keeps the screen", after the words for the
screen and for signing in, and to replace NSWP-11's "Who draws it" (section 12).

> **The client has the menu.** A client that keeps the screen can draw the visitor's
> console itself, above the world, so that it is the same in every world. The world's
> own console then steps aside. As with the screen, it is done in a few words between
> the two pages, and a world takes them only from the page directly above it.
>
> - the world, as it loads: `{ nswp: "here", at, menu: 1 }`. `menu` is the version of
>   these words it speaks. A world that leaves it out draws its own console, as
>   before.
> - the client, in answer: `{ nswp: "menu", has: true, v: 1, settings }`. The client
>   draws the console for this world. `settings` are the visitor's, in the shape of
>   NSWP-11's "Settings that travel". The world's own console draws nothing from then
>   on: no bar, no mark, no sheet. The client says `settings` again whenever they
>   change, and `{ nswp: "menu", has: false }` if it stops, at which the world's own
>   console comes back.
> - the world, whenever what it says changes, whole each time, and no oftener than
>   eight times a second: `{ nswp: "menu", world }`, its description (below).
> - the client, at the visitor's press on something the world described:
>   `{ nswp: "menu", press: id }`. Only for an `id` in the world's last description.
> - the world, for the few keys that are the visitor's and are pressed while it has
>   the keyboard: `{ nswp: "menu", key }`, where `key` is `"summon"`, `"escape"`,
>   `"menu"` or a digit `"1"` to `"9"`. Never any other key, and never what was typed.
> - the client, as its menu comes up and goes: `{ nswp: "menu", open }`. The world
>   leaves the visitor's input alone in between, as NSWP-11 asks.
> - the client, as the visitor leaves by their own Home: `{ nswp: "menu", go: "home" }`.
>   The world may go itself at once, carrying what the visitor carries. Whether it
>   does or not, the client takes them home within a second.
> - the world, with words to show for a moment: `{ nswp: "menu", say }`, at most 200
>   characters of plain text, shown under the world's name.
>
> **A world's description** is plain data. Nothing in it is run, and every word is
> shown as text:
>
> - `title`, at most 80 characters. The address shown beside it is the one the browser
>   gives the client for the frame, never the world's word.
> - `level` (`full`, `quiet`, `hidden`) and `corner`: how much room the console takes
>   (NSWP-11, "The world leads"), and `keys: false` while the world has taken every key.
> - `state`: the things every place has and only the world can run. Whether there is
>   a room, whether the visitor is joined, their microphone and how many are here;
>   whether a headset session can start, and whether one is running; whether this
>   world has the visitor's name; what is in their hand, and the world's rule for
>   items.
> - `target` and `loading`: what is pointed at, and what is still loading, as NSWP-11
>   has them.
> - `sections`: the tabs the world fills. Each has an `id`, and its rows: `id`,
>   `label`, and optionally `short`, `icon` (a name from the console's own set),
>   `kind`, `on`, `tone`, `color`, `mark`, `faint`, `bar`, and a small `picture`.
>
> A world may fill only the tabs that are its to fill: Room, People, Camera, Panels,
> View, Scores, Achievements, its own doors under Travel, its keeper's "Who comes in",
> and **at most two tabs of its own**. A world's own tab is drawn in the client's
> style, stands after the visitor's tabs, and carries the world's name. A world never
> fills, reads or presses the visitor's own tabs (You, Bag, Wallet, Files, Following,
> Messages, Moving, Sound, Display), and is never told what is in them or which is open.
>
> Limits a client holds a world to, whatever it sends: 12 sections, 60 rows in one, 200
> rows in all, 120 characters in a label, a picture of 256 pixels a side, 64 kilobytes
> of description without its pictures. What is over is left out, not cut to fit.
>
> Nothing about the visitor is in any of the world's words. The client's words carry
> their settings and nothing else of them: the same settings a link already carries
> into a world.
>
> **A switch that guards the visitor's privacy is not a comfort setting.** "Load
> people's files from anywhere" is turned on by the visitor's own press, for the one
> place they are in. A client above may say `filesAnywhere: true` only to the world
> the visitor turned it on for, and to no other; a link still never can. The same
> care holds for whether they see people's pictures and people's own models: a client
> sends each as the visitor set it for that world, and never widens one on a world's
> word.
>
> **What a world may say back.** While its headset session runs, where only it can
> draw the console, a world may report the settings the visitor changed there:
> `{ nswp: "menu", settings }`. A client takes from it only comfort and layout, by
> name: how they move and turn (`headset`, `intense`, `turn`, `hand`, `narrow`,
> `fade`, `look`, `fov`, `wrist`), the volumes (`sound`), whether things move
> (`motion`), the size of text (`text`), and the order of their tabs and their pins
> (`tabs`, `pins`). Everything else in it is dropped: a world's report can never turn
> a privacy switch on, or change who the visitor is, what they hold or what they see
> of other people.

Notes on the words, not for the protocol:

- **`settings` go only to the world that said `here`.** The client addresses them to
  that page's own address, not to whatever is in the frame.
- **A world may send `{ nswp: "menu", settings }` back only while its headset session
  runs** (section 8). The client takes the named comfort and layout settings from it
  and drops the rest, then cleans what it took as anything that arrives is cleaned.
- **The client keeps the privacy switches per world.** `filesAnywhere` on is kept
  against the world's address it was pressed for, and is in the `settings` sent to
  that world only. Off is the default everywhere and is what every other world is
  told. Pictures and people's own models are the visitor's general settings, and a
  world may be given a narrower one (off, there) but never a wider one than they set.
- **Pictures** cross as bitmaps the browser copies between pages, so the client never
  fetches an address a world names.

## 5. What a world can't do, and how each is held

| It can't | Because |
|---|---|
| Change or restyle the menu | It sends data, never markup, styles or code. The client draws every row itself, with icons from its own set |
| Cover the menu | The client draws above the frame. A world's page can't draw outside its frame |
| Read the menu, or press it | The two pages are different sites. Nothing of the visitor's tabs is in any word sent down |
| Keep the visitor from going home | The client owns the frame, and takes it home itself |
| Put its words in the client's mouth | Its tab carries its name; its words for a moment are shown under its name; it may fill only the tabs listed |
| Swallow the summons for good | See section 7: the client's own mark, and the browser's own Escape, don't pass through the world |

**Imitation that is left, said plainly:** a world can still draw, inside its own frame,
something that looks like the menu. Nothing but a browser of our own can stop that
(NSWP-11 already says so). What changes is that the real one is always in the same
place, above the world, and a world's drawing can never be above it.

## 6. Who has the menu, and when the fallback comes up

- **Not framed:** the world loads its own menu at once. Nothing changes from today.
- **Framed, and the client answers `has: true`:** the world never loads its menu. The
  client answers `here` at once, as it already does for the screen.
- **Framed, and nothing is said within about 300 ms:** the world loads its own menu.
  A client that doesn't know these words (or isn't one) changes nothing.
- **The client answers late:** the world's own menu is put away, and the client's
  stands. One menu at any moment, never two.
- **A world that doesn't speak the words** (an older kit, or built some other way)
  draws its own console in the frame, as today. The client then draws no menu of its
  own over it, only what it always has (the screen, the sign-in panel). Such a world
  gets the client's menu when it takes a kit that speaks them. This is a limit, said
  plainly: "the same in every world" is true of every world on a kit from this step on.
- **While a world is slow to come up:** the client's menu is already there, with the
  visitor's own tabs and Home. The world's tabs arrive with its first description.
- **A world that can't be framed** is gone to the ordinary way, as NSWP-02 says, and
  draws its own menu there.

## 7. The summons, and the keys

A page above a frame doesn't hear keys or touches while the frame has them. So:

- **The world's part forwards the visitor's few keys,** heard before the world's own
  code hears anything, as the reference console does today: the key left of 1, Escape
  where the client holds it in fullscreen, M, and the digits for the bar (not while
  the world has taken every key, except the summons). On a touch screen it forwards
  the two-finger hold. Nothing else is ever forwarded.
- **While the menu is up the client has the keyboard itself,** so nothing typed in the
  menu reaches the world, and the world is told only that it came up and went. When it
  goes, the keys go back to the frame.
- **A world built some other way could swallow those keys.** Three things don't pass
  through it:
  - the client's own mark and bar, drawn above the frame and pressed with a pointer or
    a finger, at the full and quiet levels;
  - in fullscreen, a long hold of Escape, which is the browser's: it leaves
    fullscreen, the client's page hears that, and brings the menu up;
  - the browser's own controls.
- **At the hidden level** the client draws nothing until summoned, as NSWP-11 says
  ("hidden means hidden"). There the summons rests on the world's part forwarding the
  key, as it rests on the world today. A client frames only the worlds it names, so
  this is a trust it has already given. (A question for the owner: section 14.)
- **A headset:** the summons stays the world's part's, with the console it draws.

## 8. A headset

Only the world's page can draw into a headset's view. So:

- **In a headset session the world's part draws the console, in-world, as today,** by
  running the same menu through the direct carrier with the headset's drawing. It is
  the same tabs in the same order, because it is the same code and the same settings.
- **What the client still holds:** the visitor's settings, including the order of
  their tabs and their pins, which it sent in. Changes made in the headset are said
  back (`settings`), and the client keeps the ones that are comfort and layout
  (section 4 names them), so they are there on the flat screen and in the next world.
- **A privacy switch pressed in a headset is the world's own to act on, and stays
  there.** "Load people's files from anywhere", turned on in the headset's console,
  holds in that world for that visit, as it does in any world today. The client
  doesn't take it from the world's report, so it isn't on when the visitor comes back
  by the client, until they press it in the client's own menu.
- **Wallet and Files in a headset** say to take the headset off, as buying does: the
  sign-in address's pages can't be shown in there.
- **This is no worse than today for trust,** and no better: inside a headset a world
  runs the visitor's tabs itself, as every world does now. A world could report a
  comfort setting the visitor didn't choose; today any world can do the same on the
  link to the next. It can report nothing else, and outside a headset nothing at all.
- **A browser of our own** is what makes the headset's console the client's too
  (section 11).

**To be tried before step 1, not assumed:** which presses must land in the world's own
page. A browser starts a headset session only at a press in the page that asks for it,
and a press in the client's menu is a press in another page. If that holds for entering
a headset (and for anything else found), the row in the client's menu tells the world,
and the world shows its own "press to enter" across its view, as it already does for a
visitor who left a headset to come here: one press more. The pointer for the intense
way is taken at a press on the view, which is the world's page already.

## 9. A phone, and other engines

- **A phone.** The shell is the way in at a desk today. Whether a frame behaves on a
  phone needs trying before anything is promised: the safe areas at the screen's
  edges, the keyboard on the glass, the two-finger hold, sound starting, and a world
  turned sideways. Until it has been tried and passed (section 15, step 5), a phone
  goes the ordinary way and every world shows its own menu. Because that is the same
  code, a phone gets the same tabs, order and pins from the start.
- **Other engines.** The engine script is a world's part with the fallback, as a
  Three.js world's is. It steps its console aside the same way, describes what the
  engine added with `menu()`, and hands presses back as the events an engine already
  hears. An engine's own code changes nothing. `view()` gives the world's own tabs and
  whether the menu is up, and no longer the visitor's own tabs when a client has the
  menu, so the script's version goes up.

## 10. Settings, and movement

- **The client holds the visitor's settings** and sends them in with its first answer
  and at each change. They are the settings of NSWP-11, in the same shape, cleaned by
  the same code. BitPortal already keeps them in the visitor's sealed, synced note.
- **A world applies them where it runs the thing:** how they move, how fast the view
  turns, how wide they see, the fade, the volumes, whether things move. Movement runs
  in the world's own drawing loop and stays the world's part.
- **The Moving, Sound and Display tabs are the client's.** They change a setting, and
  the world hears it within a frame or two. Nothing is passed per frame.
- **The one-time questions** (how you move at a desk; in a headset) are asked by
  whoever draws the console: the client on a flat screen, the world's part in a
  headset. The answer is a setting like any other.
- **The link still carries settings,** for the worlds reached with no client above.
- **Two kinds of setting, held differently:**
  - *Comfort and layout* (how they move, the volumes, text, motion, tabs and pins) are
    the visitor's everywhere. The client sends the same to every world.
  - *Privacy switches* (`filesAnywhere`; whether they see people's pictures and
    people's own models; whether anything carried is drawn) say what the visitor lets
    other people's things do to them. `filesAnywhere` on is kept per world, sent only
    to the world it was pressed for, and never rides a link. The rest are the
    visitor's general settings, and no world's word ever widens one.

**What it costs.** Nothing is sent per frame. Words go when something changes: a
description at most eight times a second, a setting when the visitor changes one, a
press when they press. The client's bar and marks are a small layer over the frame.
Step 1 measures frame times in a framed world with the menu down and up, against the
same world drawing its own, and the bytes a framed world no longer downloads.

## 11. The same words for a browser of our own

`browser/spec.md` says the browser's menu sits on a layer above every world, and that a
page finds what the browser offers by asking (`nswp.can`). The words of section 4 are
that menu's words too, with another carrier:

- In BitPortal's shell they are messages between the frame and the page above it.
- In the browser they go through its bridge (`window.nswp`), found with
  `nswp.can("menu")`.

The world's part picks the carrier that is there: the bridge, else the page above,
else its own fallback. The description, the presses and the settings are the same
objects. In the browser the summons is the browser's own, which no page can swallow;
the headset's console can be the browser's too; and NSWP-11 then says what a world may
ask of a client's console, in place of what a world owes.

## 12. What changes in the protocol's text

- **NSWP-02, "A client that keeps the screen":** the words of section 4.
- **NSWP-11, "Who draws it":** rewritten. Where a client above says it has the menu,
  the client draws it and a world may add to it (the tabs it may fill, and the
  limits). Elsewhere a world's page draws it, as now. The way home in a client's frame
  is the client's.
- **NSWP-11, "What is in it":** Wallet and Files join the sections; the order becomes
  the visitor's (section 13's `tabs`), from a default that is the order written there.
- **NSWP-11, "Settings that travel":** the order of tabs joins them.
- **NSWP-09:** a world never draws anything that could be taken for the console
  already stands; it gains "nor says anything in a tab it fills that could be taken
  for the client's own".

## 13. Pins, order and the bar as one idea; and the names to give

**One idea, proposed: a pinned tab comes first.**

- The visitor **orders** their tabs as they like: drag, the keyboard, or "Move left /
  Move right" in a headset. The order is theirs everywhere.
- They may **pin** up to four, as now. Pinned tabs stand at the far left of the strip
  in the order they were pinned, stay in sight when the strip scrolls, and are the
  keys on the bar. The first pinned is the far-left tab, and the menu opens on it.
- So "pin one at the far left" is pinning one; "Keep this tab on your bar" becomes
  "Pin this tab", and means the same thing in both places. There is one kind of
  pinning, and the setting that already travels (`pins`) holds it.
- **A world's own tab** can be moved by the visitor among the tabs after the pinned
  ones, and can't be pinned: pins are for tabs that are in every world. Where the
  visitor put it is kept by the client for that world, and never sent to any world,
  since it would say where they have been.

(The other reading, exactly one far-left pin kept apart from the bar's four, is the
owner's to choose: section 14, question 1.)

**Wallet and Files.** Each is a tab whose body is the sign-in address's own page for
it, in the panel the shell already draws (`wallet`, `files`), shown in the sheet. In
the fallback, where no client can draw that panel, each tab has the one row that opens
the sign-in address's window, as the rows under You do today.

**Names, given by the orchestrator on 2026-11-23, all as proposed** (recorded in
`docs/fleet.md` with step 0):

| What | Name |
|---|---|
| The version a world says in `here` | `menu` (a number, 1) |
| The topic of every new word | `nswp: "menu"` |
| Its fields | `has`, `v`, `settings`, `world`, `press`, `key`, `open`, `go`, `say` |
| The description's fields | `title`, `level`, `corner`, `keys`, `state`, `target`, `loading`, `sections`; a row's `bar` and `picture` |
| What `state` holds | `room` (`has`, `joined`, `mic`, `count`), `headset` (`supported`, `presenting`), `named`, `holding`, `items` |
| The limits | `MENU_LIMITS` (`sections` 12, `rows` 60, `allRows` 200, `label` 120, `picture` 256, `bytes` 65536, `ownTabs` 2, `say` 200) |
| How long a framed world waits for a client | `MENU_WAIT_MS` (300) |
| How long the client waits for a world to leave by itself | `LEAVE_MS` (1000) |
| The kit's entry for the menu | `nswp-sdk/menu` |
| The menu, and the port | `mountMenu(port)`, `WorldPort` |
| The port's carriers | `portHere(controls)` (direct), `portBelow(frame)` (the client's end), `portAbove()` (the world's end) |
| The setting for the order of tabs (NSWP-11) | `tabs`: tab names in order, 24 at most, each as a pin's name is |
| The two new tabs | `wallet`, `files` |
| The browser's feature name | `nswp.can("menu")` |
| The engine script's version | the next |

## 14. Questions

**For the owner, each with my recommendation:**

1. **Pins.** One idea (pin up to four; pinned come first, the first of them far left,
   and they are the bar's), or exactly one far-left pin kept apart from the bar?
   *Recommend the one idea:* it is one thing to learn, and no new setting.
2. **Does a world's colour still tint the menu?** Today each world's accent colours
   the console. *Recommend no:* the client's menu wears the visitor's own look
   everywhere, and a world's colour shows on its name and its own tab only. That is
   "the same in every world", and one less thing a world can dress up.
3. **The hidden level.** Draw nothing until summoned, as now, or always keep one small
   mark of the client's that no world can hide? *Recommend as now,* for worlds the
   client names; a small mark that can't be hidden for any world a client frames
   without naming it.
4. **A guest's Wallet and Files.** Shown, each saying "Sign in to have one" with the
   sign-in row, or not shown? *Recommend shown,* so the menu is the same shape for
   everyone.
5. **Changing the bag anywhere.** Today a bag is changed only at home. With the menu
   the client's, it could be changed from any world, since the world isn't the one
   changing it. *Recommend yes, in the last step,* and unchanged until then.
6. **How many tabs a world may add.** *Recommend two.*
7. **Worlds on an older kit** keep their own menu in the frame until they take a newer
   one (section 6). Accept that, or have the client stop framing them after a date?
   *Recommend accept:* every world of ours moves together on one deploy.
8. **A phone.** Try the frame on a phone as its own step after the desk is done
   (section 15, step 5), or sooner? *Recommend after.*

**The orchestrator's answers (2026-11-23):**

- (a) All the names in section 13 are given as proposed.
- (b) The steps stand, in that order, with Sound and Help among the first tabs to move.
- (c) The room's chat, Following and Messages come with step 3. Step 1 stays small.
- (d) The kit's half is the NSWP builder's and the shell's half is BitPortal's. Each
  step is tried first in a stand-in client under `trials/`.
- (e) The protocol text is written with step 1, marked with its status as NSWP-02
  does today, and revised as later steps land.
- Two additions, now in sections 4, 8 and 10: privacy switches are not comfort
  settings, and what a world may report back from a headset is limited by name.
- Steps 0 and 0b go ahead now. Step 1 waits for the owner's answers above and for
  BitPortal's review of the shell's half.

## 15. The build, a pull request a step

Each step is tried with **a stand-in client** this repository carries
(`trials/`: a page that frames a world's build and mounts the menu from this checkout),
so the kit's half never waits on BitPortal's. BitPortal's session then does the same
step in the real shell.

| Step | What | Done looks like | Trials |
|---|---|---|---|
| **0. The seam** | The menu and the world's port, with the direct carrier only. The kit's entry for the menu. Nothing a visitor can see changes | Every world behaves exactly as before; a framed world's build has the menu as a file of its own | The gate; the existing console trials unchanged; the bar and sheet pictured before and after, alike |
| **0b. What needs a press in the world's own page** | A trial, no feature: entering a headset, the microphone, the pointer, sound, from a press in a page above | A written list, and for each what the client's row does | A scripted client above a world, in Chrome; the made-up headset |
| **1. The client has the menu** | The words of section 4, both carriers. The client draws the bar, marks and sheet. The visitor's own tabs run in the client: You, Travel (Home, their doors), Bag, Display, Moving, Sound, Help. Every tab the world fills is described and drawn. The summons and keys forwarded. Home as a guarantee. Protocol text | In the stand-in client: one menu, the client's, over the Gallery, the Grove and the Godot example; the world draws none; Home works with the world's script stopped; nothing of the visitor's tabs in any word sent down; a world sending too much, markup or a tab it may not fill is held to the limits | Unit tests for the words and limits, with examples in `vectors/`; a trial per world; a world that never answers, answers late, and stops answering; frame times and bytes |
| **2. BitPortal's shell** (the BitPortal session) | The shell mounts the menu from its copy of the kit and speaks the client's end | The owner walks from the room through three worlds with one menu that never changes | Its own trials; the owner's look, with pictures |
| **3. Rooms and people, from facts** | The world says who is here (session keys and passes), microphones and recording, as facts. The client draws Room and People itself: names, the proven mark, follow, mute and block from the visitor's own lists. The room's chat, Following and Messages run in the client | A world can't put a name or a picture on someone; blocks and follows never pass through a world | Two scripted visitors in the stand-in client; the owner-lists trial through it |
| **4. Wallet, Files, order and pins** | The two tabs; reorder by drag, keyboard and in a headset; pins as section 13 says; the order travels and syncs; the bag changed anywhere, if the owner says so | Both backlog pages' "done": the tabs open as tabs; a tab moved stays put after a reload and on another device; a pinned tab stays far left; the same in every world, and in the fallback | Unit tests for the order and pins; a trial in the stand-in client and unframed; pictures for the owner |
| **5. A phone** | The frame tried on a phone, by the list in section 9 | A written result, and either the shell opened to phones or the reasons not | The owner's own phone; a scripted phone-sized browser for what it can show |
| **Later** | The browser's carrier (section 11), with the browser's session | | |

**Parked while this is built:** seated mode step 2 (the seat). The fade from step 1 of
that plan is the world's part and is not touched by this.
