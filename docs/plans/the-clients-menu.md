# The client's menu: a design

**Status:** decided, and being built. The owner answered all eight questions on
2026-11-23 (section 14), and decided that entering a headset is two presses, named
"Enter VR" and "Launch" (section 8). The orchestrator gave the names (section 13).
The shell's review (section 16) is folded into sections 4 to 8, 13 and 15. Step 0 (the
seam) is merged: the menu takes a world's port and nothing else (`nswp-sdk/menu`,
`ui/port.ts`), and is a file of a world's own build. Step 0b (the press trial) is
done, with a second part on the pointer and on windows. Step 1's first part is
built: the words, their limits and the reading of them, in the kit's core
(`packages/core/src/menu.ts`, `vectors/menu-words.json`), and NSWP-02's text. Of
its second part, both ends of the port are built (`portAbove`, in the reference worlds;
`portBelow`, in a stand-in client: `trials/menu-client.mjs`) and the menu draws
rows typed into and rows that copy. A world that steps aside keeps the chat's
pane, the rows that change a travelling setting are the client's own, a world's
pictures go up as bitmaps, "Enter VR" above is "Launch" in the world, the world
says the state of its room, the visitor's name, what is in hand and its rule for
items, and Sound and Help are tabs both fill, the client's part first. Still to
come in step 1: You and the Bag in the client, the engine script, frame times
and bytes, and the trials of the four presses. NSWP builder,
2026-11-23. From `docs/backlog/menus-are-the-clients.md` and
`docs/backlog/menu-tabs-wallet-files-order-pin.md`. A name still marked as a proposal
in section 13 is not used before it is given (rule 11).

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
>   The word is not the visitor's press: the browser doesn't count it as one in the
>   world's page. So a world never copies, opens a window, takes the pointer or starts
>   a headset session on it (see "Two kinds of row the client does itself", below).
> - the world, for the few keys that are the visitor's and are pressed while it has
>   the keyboard: `{ nswp: "menu", key }`, where `key` is `"summon"`, `"escape"`,
>   `"menu"` or a digit `"1"` to `"9"`. Never any other key, and never what was typed.
> - the client, as its menu comes up and goes: `{ nswp: "menu", open }`. The world
>   leaves the visitor's input alone in between, as NSWP-11 asks.
> - the client, as the visitor leaves by their own Home: `{ nswp: "menu", go: "home" }`.
>   The world may go itself at once, carrying what the visitor carries. Whether it
>   does or not, the client takes them home within a second. Where the world didn't
>   go itself, what was in the visitor's hand doesn't come with them: only the world
>   knew it. A client says so as it takes them.
> - the world, with words to show for a moment: `{ nswp: "menu", say }`, at most 200
>   characters of plain text, shown under the world's name.
>
> **A world's description** is plain data. Nothing in it is run, and every word is
> shown as text:
>
> - `title`, at most 80 characters. The address shown beside it is never the world's
>   word: it is the origin the browser reports for the page that last said `here`. A
>   client can't read a frame's address, so until a `here` it shows none.
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
> **A client keeps a description only as long as the page that sent it.** At every
> load of the frame the description is dropped, with its title, its tabs and its
> address, before the next page says anything. One world's tabs never stand over the
> next, or over a page that never says `here`.
>
> **Two kinds of row the client does itself,** because the word of a press is not a
> press in the world's page:
>
> - `kind: "copy"`, with `copy`, the text. At the visitor's press the client writes
>   that text to the clipboard itself, and says it did. The world is told of the press
>   like any other.
> - `kind: "field"`: a row the visitor types into. The client draws the box and a
>   button with the row's `label`. At the visitor's press on that button, and only
>   then, it sends `{ nswp: "menu", press: id, field }`, where `field` is what they
>   typed. A client keeps four rules for it:
>   - it shows, under the world's name, that what is typed there goes to that world;
>   - it is plain text, of a limited length;
>   - the client never fills it from anything the visitor didn't type or paste there:
>     not the clipboard, not what they typed before, not the browser's own filling-in;
>   - nothing typed is sent before the press, and nothing of it is kept after.
>
>   A `field` row may stand only in the keeper's "Who comes in" and in a world's own
>   tabs. Anywhere else it is left out.
>
> **A picture that changes.** A row whose picture is fed by the world as it runs (a
> camera's view, a watched screen) sends each new one alone, without a description:
> `{ nswp: "menu", picture, id }`, a bitmap for the row `id` of the last description.
> At most eight a second for a row, 256 pixels a side, and only while the menu is up.
> A client draws them only for a row in sight, and may drop any.
>
> A world may fill only the tabs that are its to fill: Room, People, Camera, Panels,
> View, Scores, Achievements, its own doors under Travel, its keeper's "Who comes in",
> its own part of Sound and of Help, and **at most two tabs of its own**. A world's own
> tab is drawn in the client's style, stands after the visitor's tabs, and carries the
> world's name. A world never fills, reads or presses the visitor's own tabs (You,
> Your look, Bag, Wallet, Files, Following, Messages, Moving, Display), and is never
> told what is in them or which is open.
>
> **A world's part of a tab is always visibly the world's** (the orchestrator,
> 2026-11-23, with Sound and Help becoming tabs both fill). Where the client has rows
> of its own in a tab, they come first, and the world's stand below under the world's
> name. A world's note is never drawn as the client's own words: it comes after the
> client's, under the world's name. In Sound the volumes, "all sound", the hum's
> switch and the visitor's own music are the client's; the world adds the piece it is
> playing, and says whether the place has a hum (`state.hum`). In Help the client's
> own help comes first, and a world's sentence about itself is a note after it, within
> `MENU_LIMITS.note`. Nothing typed goes to a world from either tab.
>
> Limits a client holds a world to, whatever it sends: 12 sections, 60 rows in one, 200
> rows in all, 120 characters in a label, a picture of 256 pixels a side, 64 kilobytes
> of description without its pictures, 2000 characters of text to copy, 500 characters
> typed into a field. What is over is left out, not cut to fit.
>
> Nothing about the visitor is in any of the world's words. The client's words carry
> their settings and nothing else of them: the same settings a link already carries
> into a world.
>
> **A switch that guards the visitor's privacy is not a comfort setting.** "Load
> people's files from anywhere" is turned on by the visitor's own press, for the one
> place they are in, and that place keeps it. Where a client draws the menu the row
> is still the world's, pressed through the client. A client never holds it and never
> says it: nothing above a world can turn it on, and `filesAnywhere: true` in a
> client's settings is dropped as a link's is. The same care holds for whether they
> see people's pictures and people's own models: those are the client's own rows, a
> client says each as the visitor set it, and never widens one on a world's word.
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
- **"Load people's files from anywhere" stays the world's own row** (the orchestrator,
  2026-11-23, in place of "the client keeps it per world", which this section first
  said). It is for one place, pressed there through the client, and that place keeps
  it on its own site. So the client never holds it, never says it on or off, and
  can't say it to another world; and the core drops `filesAnywhere: true` from a
  client's settings as from a link's. Nothing above a world can turn that switch on.
  Pictures and people's own models are the visitor's general settings, held by the
  client and said to every world.
- **Pictures** cross as bitmaps the browser copies between pages, so the client never
  fetches an address a world names. Each goes alone by the `picture` word, never in
  the description (which is text, and said again at every change): a row's by its
  id, a card's by `card:` and its tab. The world makes them only while the menu is
  up, afresh each time it comes up; the client keeps each by id until the world
  stops describing the thing it is of. Someone's picture on a People card is
  fetched by the world and crosses as a bitmap. Built: a tile's picture and a
  card's face. Not built, since nothing in the kit has one in a tab a world fills:
  a picture fed as the world runs (a camera's view).
- **Pages of the client's own origin are the client's own** (section 16, point 1).
  BitPortal's room and its Airlock are shown in the same frame as a world. A page
  whose origin is exactly the shell's may fill any tab, the visitor's own included,
  still as data through these same words; the limits on which tabs a world may fill
  are for every other origin. This is the client's rule about itself and is not
  protocol text. A later step moves the room's tabs into the shell's menu.
- **The Bag's turning item is drawn by the client,** from the kit's own previews and
  `fetchByHash`. Only a picture a world feeds crosses as a bitmap.
- **A row that changes a travelling setting is the client's own, wherever it stands**
  (the orchestrator, 2026-11-23). The client holds the visitor's settings and says
  them to each world. If a world changed one itself the client would never hear,
  and the next world would get the old value. So these rows are drawn by the client
  inside the tabs a world otherwise fills, and the world leaves them out of what it
  describes: how wide you see (View), whether you see people's pictures and
  people's own models (People), and chat on or off (Room). The two People switches
  guard the visitor's privacy, and were never a world's to hold once a client is
  above it. In the fallback they are where they are today.
- **A world's one `here` waits for the page's first files to have run,** so that it
  can say `menu`. It is still said once: a client takes a second as the next
  page's. Measured (2026-11-23, twelve loads of the Gallery in a frame, each side):
  the page above heard `here` 1 ms after the frame's load was told before the
  change, and 5 ms after it now (medians; 168 ms and 133 ms after the frame was
  pointed at the world, on a machine less busy for the second). BitPortal's shell
  waits 4 seconds after a load for a place to say it came up, so its watch doesn't
  trip. A world that loads the world's end of the port any later than with the
  page says `here` without `menu`, and draws its own menu: the safe way to fail.
- **Until step 3 the world still fills Room, People, Following and Messages,** as
  it draws them today, and a client takes them. The protocol's text says the rule as
  it will stand (a world never fills the visitor's own tabs), with its status beside
  it, as NSWP-02 does. Section 15 has what that means for each row a visitor types
  into.

## 5. What a world can't do, and how each is held

| It can't | Because |
|---|---|
| Change or restyle the menu | It sends data, never markup, styles or code. The client draws every row itself, with icons from its own set |
| Cover the menu | The client draws above the frame. A world's page can't draw outside its frame |
| Read the menu, or press it | The two pages are different sites. Nothing of the visitor's tabs is in any word sent down |
| Keep the visitor from going home | The client owns the frame, and takes it home itself |
| Put its words in the client's mouth | Its tab carries its name; its words for a moment are shown under its name; it may fill only the tabs listed |
| Swallow the summons for good | See section 7: the client's own mark, and the browser's own Escape, don't pass through the world |
| Leave its name or tabs standing over the next place | The client drops a description at every load of the frame, and shows an address only from the origin of the last `here` |
| Read what the visitor copied | The frame is never allowed it (`clipboard-read` is not in the frame's `allow`, and is not to be added). What a visitor wants a world to have, they paste into a `field` row, and see it go |
| Have the client type or paste for it | A `field` row is filled only by the visitor, and sent only at their press |
| Carry off what is in hand when the client takes the visitor home | It can't, and neither can the client: if the world didn't go itself within a second, what was in hand is left behind, and the client says so |

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
  stands. One menu at any moment, never two. This is not rare: on a development
  server the shell asks the network whether a place may be shown before it answers,
  so `has: true` can come after `MENU_WAIT_MS`. It is one of step 1's trial cases.
- **Whoever wires a menu asks again who has it, each time its own menu's file
  arrives** (the orchestrator, 2026-11-23, after a fault found that day). A world's
  own menu is a file fetched when it is needed, and a client can answer while it is
  on its way. A world that only asked before fetching then drew its menu when the
  file came, though the client now had one: two menus. So the rule for every place
  that wires a menu: when its own menu's file arrives, ask who has the menu now; a
  menu that arrives for a page whose client has one is put away before it is seen;
  and a change of who has it is listened for from before the fetch, not after.
  - *The reference worlds* (`sites/shared/world.ts`) do this since PR 372, and
    `trials/menu-above.mjs` has the case ("during").
  - *The engine script* can't have this fault today, for two reasons: it doesn't
    speak the menu's words, so no client ever has its menu; and its menu is in the
    one file, mounted as that file runs, so there is no fetch for an answer to
    land in. When it comes to speak the words, the second still holds, and it
    needs only the other half of the rule: put its own menu away when a client
    says it has one, however late.
  - *BitPortal's room* (`/walk/`) mounts its menu as its page starts, from its
    own bundle, and doesn't speak the words yet. When it does, as a page of the
    client's own, the same rule is its to keep. BitPortal's session has been told.
- **A new page in the frame:** the client drops the last description at the frame's
  load and shows only its own tabs and Home until the new page says `here` and
  describes itself (section 4).
- **The client's own pages** (its room, its Airlock) say the same words. The room may
  fill any tab. At the Airlock the menu shows Home and the visitor's own tabs only,
  and nothing of the menu may cover the Airlock's own panel.
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
- **The client's bar must not strand the world's keys.** Any press on the client's
  page moves the keys to it, and the world stops hearing them: walking stops, with
  the sheet down. So the rule is: *while the sheet is down and the panel is down,
  the frame has the keys.* A press on the bar or the mark doesn't take them, and
  after the row has acted the client gives them to the frame again, whatever
  happened. Section 17.2 has every case, for the shell; the stand-in client keeps
  the same rule.
- **The client hears the summons keys itself whenever it does have the keys,** and
  does what the forwarded key would have done. Only one page hears a given press, so
  nothing is done twice. Any other key it hears there can't be passed into the
  frame: it gives the frame the keys at once, and that one press is lost.
- **A pointer the world holds** (the intense way). The client's bar can't be pressed
  while the world holds the pointer, and the page above can't let go of it. So:
  - at `open: true` the world lets the pointer go;
  - Escape with the pointer held is the browser's. The world hears no key, only that
    its hold ended without its asking, and asks for the menu by saying
    `key: "summon"` (the orchestrator, 2026-11-23). Not `key: "escape"`: with the
    menu down Escape does nothing outside fullscreen, today and in the client's
    menu, and it is the lost pointer that brings the menu up. Had the world said
    `escape`, a client would have had to bring the menu up on every Escape;
  - at `open: false` the world tries to take the pointer again at once, and where
    the browser refuses, takes it at the next press on the view (the orchestrator,
    2026-11-23). Chrome allows the first for a world that let go by itself (step
    0b's second part); after the browser's own Escape it refuses, and the kit
    already says "a click on the view" there.
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
- **Escape in fullscreen.** Only the top page can hold Escape; a frame can't. The
  client holds it itself whenever it fills the screen, where the browser lets it
  (Chrome and its kin; elsewhere as now, where Escape leaves fullscreen). Then
  Escape brings the menu, and Escape again leaves fullscreen: the owner's ask in
  `docs/backlog/fullscreen-button-and-escape.md`. The key is still heard by
  whichever page has the keys, so the world's part forwards it as above.
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

**Which presses must land in the world's own page: tried** (step 0b,
[`the-clients-menu-presses.md`](the-clients-menu-presses.md), Chrome only). A press on
the client's menu is not a press in the world. So:

- **Entering a headset is two presses, each with its own name** (decided: the owner,
  2026-11-23, "Yes, two presses", and each named differently). The row in the
  client's menu is **"Enter VR"**. It tells the world, and the world shows its own
  press across its view, which says **"Launch"**. The world says "Launch" wherever
  it shows that screen, including for a visitor who left a headset to come here.
  In the fallback, where the menu is in the world's own page, "Enter VR" is the one
  press, as today.
- The pointer for the intense way is taken at a press on the view, and only the
  world can let it go, when told the menu is up (section 7).
- Copying is the client's to do: a row of the kind `copy` (section 4).
- **Reading what the visitor copied is never a framed world's.** The two rows that do
  it today ("Put in the item I copied" in the Bag, "Someone whose key I copied" in
  "Who comes in") can't work in a world shown in BitPortal's frame. This is **a known
  fault for a framed world, with no quick fix**: `clipboard-read` is not added to
  the frame's `allow` (the orchestrator, 2026-11-23), since a world would then read
  the visitor's clipboard under the client's name. The fix is step 1's: the Bag's
  row becomes the client's own, and the keeper's becomes a `field` row the visitor
  pastes into. Until then both rows say why the read was refused.
- A window can't be opened by a world from a press on the client's menu (tried with
  the browser's blocker on, step 0b's second part). The windows the menu opens are
  the client's own to open: the sign-in address's pages, in the panel.
- Sound and the microphone need nothing.

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
    other people's things do to them. `filesAnywhere` is each world's own: turned on
    by the visitor's press there, kept by that place, never held or said by a
    client, and never on a link. The rest are the visitor's general settings, and no
    world's word ever widens one.

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

**One idea, decided (the owner, 2026-11-23): a pinned tab comes first.**

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

(The other reading, exactly one far-left pin kept apart from the bar's four, was not
taken: section 14, question 1.)

**Wallet and Files.** Each is a tab whose body is the sign-in address's own page for
it, in the panel the shell already draws (`wallet`, `files`), shown in the sheet. In
the fallback, where no client can draw that panel, each tab has the one row that opens
the sign-in address's window, as the rows under You do today. A guest sees both tabs,
each saying to sign in (section 14, question 4).

**The panel, in the client's menu** (section 16, points 6 and 10):

- The panel is a frame of the client's page directly, never inside another frame,
  with a place of its own above the sheet's body. While it is up the menu draws
  nothing in its box. For Wallet and Files its size is the client's to set, and no
  longer comes from a place a world names.
- **Account and Library stay rows under You,** opening the panel in the sheet as
  Wallet and Files do. They are not tabs.
- **The client opens the sign-in ask itself,** from its You tab, for the origin of
  the world in the frame. A world's own `sign-in` ask still works, and the client
  places it itself, since the world has no menu to point at.

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
| A row the client copies for the world (given 2026-11-23) | a row's `kind: "copy"`, with its text in `copy` |
| A row the visitor types into (given 2026-11-23, in place of `ask`) | a row's `kind: "field"` |
| How the typed text goes down (given 2026-11-23) | `field` on the press: `{ nswp: "menu", press: id, field }` |
| The longest text typed into a field (given 2026-11-23) | `MENU_LIMITS.field` (500): room for a key or an item's address with its relays, and no more |
| The longest text a `copy` row carries (given 2026-11-23) | `MENU_LIMITS.copy` (2000) |
| A row's picture, sent alone as it changes (given 2026-11-23) | `{ nswp: "menu", picture, id }`: the bitmap, and the row it is for. At most eight a second for a row, only while the menu is up; `MENU_LIMITS.picture` (256) is its size |

## 14. Questions

**The owner's answers (2026-11-23: "go with you recs on the questions for me you
had"). All eight are decided as recommended:**

1. **Pins are one idea.** Pin up to four. Pinned tabs come first, the first of them
   at the far left, and the menu opens on it. They are the bar's keys. Not a single
   far-left pin kept apart from the bar.
2. **A world's colour no longer tints the menu.** The client's menu wears the
   visitor's own look everywhere. A world's colour shows on its name and its own tab
   only.
3. **The hidden level stays as now:** nothing is drawn until summoned, for the worlds
   a client names. A client that frames a world it doesn't name keeps one small mark
   that can't be hidden.
4. **A guest's Wallet and Files are shown,** each saying to sign in, with the sign-in
   row. The menu is the same shape for everyone.
5. **The bag can be changed from any world,** in the last step (step 4), and is
   unchanged until then.
6. **A world may add two tabs.**
7. **Worlds on an older kit keep their own menu in the frame** until they take a
   newer one (section 6). The client doesn't stop framing them.
8. **A phone comes after the desk** (step 5).

**Also decided by the owner (2026-11-23):** entering a headset from the client's menu
is two presses, named "Enter VR" (the client's row) and "Launch" (the world's own
press across its view). Section 8.

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
  BitPortal's review of the shell's half. (Both are in: the answers above, and the
  review as section 16, folded into sections 4 to 8, 13 and 15.)
- The names `copy` and `field` are given (section 13). `field`, not `ask`.
- The clipboard fault of a framed world gets no quick fix: `clipboard-read` is never
  added to the frame's `allow`. The `field` row in step 1 is the fix (section 8).

**Answered by the orchestrator later the same day (2026-11-23):**

- The four names proposed in section 13 are given: `field` on a press,
  `MENU_LIMITS.field` (500), `MENU_LIMITS.copy` (2000), and
  `{ nswp: "menu", picture, id }`.
- At `open: false` the kit tries to take the pointer again first, and falls back to
  a press on the view where the browser refuses (section 7). Escape with the
  pointer held is for the owner to try by hand, with step 2.
- A `field` row only in "Who comes in" and a world's own tabs is right as the
  default, on one condition: **step 1 must not lose anything a visitor can do
  today.** Section 15 lists every typed or pasted row, and where each goes.

**Answered by the orchestrator on PRs 355 and 358 (2026-11-23):**

- **The chat's pane stays the world's own until step 3,** drawn in its frame under the
  client's menu and opened from a described row. It carries no bar, mark or sheet,
  and nothing in it may look like the client's menu. Step 3 removes it (section 15).
- **The four more presses are the orchestrator's to agree, by the rule the owner set**
  (a second press with its own plain name reads as intended, as "Enter VR" then
  "Launch" does). First, though, try whether the client can do the browser's part
  itself and hand the result over, so that it stays one press (section 15).
- **The names of step 1's first part are all given as listed** (`docs/fleet.md`).
  Two decisions stand: a word carrying anything only the other side says isn't
  read, and only the first 12 tabs sent are looked at.
- **A card's `proven` is taken only from a page of the client's own origin.** From
  any other world it is dropped (section 15, "The one thing knowingly given up").

**Answered by the orchestrator on PR 359 (2026-11-23):**

- Its names are given as listed (`docs/fleet.md`).
- When the browser takes the pointer back at Escape, the world says `key: "summon"`
  (section 7).
- A world's `here` waits for the page's first files, with the delay measured
  (section 4's notes).
- A row that changes a travelling setting is the client's own row, drawn by the
  client inside the tab it stands in (section 4's notes).

## 15. The build, a pull request a step

Each step is tried with **a stand-in client** this repository carries
(`trials/`: a page that frames a world's build and mounts the menu from this checkout),
so the kit's half never waits on BitPortal's. BitPortal's session then does the same
step in the real shell.

| Step | What | Done looks like | Trials |
|---|---|---|---|
| **0. The seam** (done: merged, 2026-11-23) | The menu and the world's port, with the direct carrier only. The kit's entry for the menu. Nothing a visitor can see changes | Every world behaves exactly as before; a framed world's build has the menu as a file of its own | The gate; the existing console trials unchanged; the bar and sheet pictured before and after, alike |
| **0b. What needs a press in the world's own page** (done: [`the-clients-menu-presses.md`](the-clients-menu-presses.md)) | A trial, no feature: entering a headset, the microphone, the pointer, sound, copying, from a press in a page above | A written list, and for each what the client's row does. A second part adds windows, and a pointer the world holds | `trials/presses-from-above.mjs`: two sites in a scripted Chrome. Not the made-up headset, which asks for no press |
| **1. The client has the menu** | The words of section 4, both carriers. The client draws the bar, marks and sheet. The visitor's own tabs run in the client: You, Travel (Home, their doors), Bag, Display, Moving, Sound, Help. Every tab the world fills is described and drawn, with the `copy` and `field` rows. The summons and keys forwarded; the bar never strands the world's keys; the world lets the pointer go as the menu comes up. Home as a guarantee. "Enter VR" in the menu and "Launch" in the world. Nothing a visitor types today is lost (below). Protocol text | In the stand-in client: one menu, the client's, over the Gallery, the Grove and the Godot example; the world draws none; Home works with the world's script stopped, and says what was in hand is left behind; nothing of the visitor's tabs in any word sent down; a world sending too much, markup or a tab it may not fill is held to the limits; a description is gone at the frame's next load; a key pasted into "Who comes in" reaches the world only at the press; the four done-conditions of section 17.2, in the stand-in client | Unit tests for the words and limits, with examples in `vectors/`; a trial per world; a world that never answers, answers late (after `MENU_WAIT_MS`, as a development server makes it), and stops answering; frame times and bytes. Anything about keys or presses is tried with real presses at places on the screen, never a scripted call into a page |
| **2. BitPortal's shell** (the BitPortal session) | The shell mounts the menu from its copy of the kit and speaks the client's end. Its own pages (the room, the Airlock) speak the same words. It holds Escape in fullscreen where the browser lets it | The owner walks from the room through three worlds with one menu that never changes; the menu runs under the shell's policy unchanged (section 17.1); who has the keys, as section 17.2 says | Its own trials; the owner's look, with pictures |
| **3. Rooms and people, from facts** | The world says who is here (session keys and passes), microphones and recording, as facts. The client draws Room and People itself: names, the proven mark, follow, mute and block from the visitor's own lists. The room's chat, Following and Messages run in the client | A world can't put a name or a picture on someone; blocks and follows never pass through a world | Two scripted visitors in the stand-in client; the owner-lists trial through it |
| **4. Wallet, Files, order and pins** | The two tabs; reorder by drag, keyboard and in a headset; pins as section 13 says; the order travels and syncs; the bag changed anywhere, if the owner says so | Both backlog pages' "done": the tabs open as tabs; a tab moved stays put after a reload and on another device; a pinned tab stays far left; the same in every world, and in the fallback | Unit tests for the order and pins; a trial in the stand-in client and unframed; pictures for the owner |
| **5. A phone** | The frame tried on a phone, by the list in section 9 | A written result, and either the shell opened to phones or the reasons not | The owner's own phone; a scripted phone-sized browser for what it can show |
| **Later** | The browser's carrier (section 11), with the browser's session | | |

**Nothing is lost in step 1: every row a visitor types or pastes into today.** The
orchestrator's condition (section 14). On a flat screen, in a world the client has the
menu for:

| Today | Tab | In steps 1 and 2 | From step 3 |
|---|---|---|---|
| "Put in the item I copied" | Bag | The client's own row. It reads what was copied in its own page, at the visitor's press, as a world opened by its address does today | The same |
| "Someone whose key I copied" | Who comes in | A `field` row: the visitor pastes the key in and presses | The same |
| Following someone "by key" | Following | A `field` row. Following is still filled by the world (below), so `field` is allowed there until step 3 | The client's own row |
| Writing to the room | Room | The chat's pane stays the world's own, drawn in its frame and opened by a described row. The visitor types in the world's page, which the client gives the keys to | The client's |
| Writing to a person; writing a post | Messages, Following | The same pane, the same way | The client's. Private messages no longer pass through a world |
| "Hang a note" (a title and its words) | Panels | The world's own form over its view, as today. The client puts the sheet away and gives the frame the keys | The same |

So until step 3 a `field` row may also stand in Following, and nowhere else beyond
section 4's two places. A client that runs Following itself leaves such a row out.

**In a headset** nothing changes: the world draws the console and its own keyboard.

**The chat's pane, for steps 1 to 3** (decided: the orchestrator, 2026-11-23). The
room's chat, messages and posts are models with calls of their own, not yet words
(`ui/port.ts`). Sending them through the words is step 3's work. Until then the world
keeps that one pane, drawn in its own frame under the client's menu and opened from
a described row. It carries no bar, no mark and no sheet, and nothing in it may look
like the client's menu. It is what a visitor has today, so nothing private passes
through a world that doesn't already. **Step 3 removes it.**

**The one thing knowingly given up, for steps 1 and 2: the proven mark in People.**
Until step 3 a world still fills People, and its card says who someone is. A card's
`proven` (the mark for a name their own client vouched for) is taken only from a
page of the client's own origin, and dropped from any other world (the orchestrator,
2026-11-23). A proven mark drawn by the client, in the client's own style, on a
world's say-so would be the client vouching for what it hasn't checked. That is
worse than today, where the world draws its own menu and the mark is plainly the
world's. A world can still write what it likes in a card's `tag`, which is its own
words. Step 3 brings the mark back, from a pass the client checks itself.

**Four more presses that must land in the page that asks,** found while listing
these, and not in step 0b's trial. A browser refuses each without a press in the page
that asks. Decided (the orchestrator, 2026-11-23): **before settling for a second
press, try whether the client can do the browser's part itself and hand the result
over,** so that it stays one press. Each is tried in the trial with step 1.

| What | Tab | First tried | If handing over fails |
|---|---|---|---|
| Choosing a file: "Hang a picture or video from this device" | Panels | The client's page has the press, so it opens the chooser and hands the file down to the world. The row says which world gets it, and nothing is sent until the visitor has chosen | A second press on the world's view: "Choose a file" |
| Saving a photo | Camera | The world hands the picture up, and the client saves it from its own page | A second press: "Save the photo" |
| The visitor's own music | Sound | Sound is the client's tab: the client's page chooses the files and plays them itself. The music then doesn't stop at a door | None needed |
| Sharing the screen | Room | Not tried: the stream has to start in the page that uses it | A second press on the world's view: "Share your screen" |

The words for a file going down and a picture going up, with their limits, are
proposed once the trial shows they work. Copying the room's link (Room) is a `copy`
row.

**For the owner to try by hand, once step 2 is up** (BitPortal's shell with the menu).
Each of these a scripted browser can't show, or a made-up headset can't, so nothing
here is known to work until a person has done it. Kept as one list so none is lost.

| What to do | What should happen | Why a trial can't say |
|---|---|---|
| Moving the intense way (the mouse looks round), press Escape | The world lets the pointer go and the client's menu comes up. It takes one press of Escape, and nothing else happens | A scripted Escape never reaches the browser's own handling |
| The same, then close the menu | Looking round starts again by itself, or at the next press on the view | The same |
| Moving the intense way, try to press the client's bar | The pointer is the world's, so the bar can't be pressed until Escape or the summons key | A scripted mouse goes to a place on the screen whatever holds the pointer |
| In fullscreen, press Escape, then Escape again | The first brings the menu, the second leaves fullscreen | A scripted Escape doesn't leave fullscreen |
| On the Quest: "Enter VR" in the client's menu | The world shows "Launch" across its view. A press there starts the session. Two presses, and they read as intended | The made-up headset starts a session whenever asked |
| Press things in the menu with sound on | Each press is heard once, not twice | The trial counts which page was asked to play, and doesn't listen |
| Sound: add a piece of your own music from a file, and go through a door | It plays, and doesn't stop at the door | Choosing a file needs a person, and nobody listened |
| Sound: turn "The room's hum" off in a place that has one | The hum stops, and stays off in the next place | Not tried end to end |
| People, in a room with someone who has a picture: choose them | Their face is on the card in the client's menu | Needs a room and a person with a picture |
| In a headset, a row typed into (a keeper's "Add someone by key") | It asks its own way there, as before | Not looked at in a made-up headset |
| On a phone, the client's menu over a world | Step 5: the frame on a phone is its own step | |

**Parked while this is built:** seated mode step 2 (the seat). The fade from step 1 of
that plan is the world's part and is not touched by this.

## 16. The shell's review, and what was decided

From the BitPortal session, 2026-11-23, as the session that owns `/shell/`: sections 4,
6, 7, 8, 13 and 15 read against the real shell (BitPortal's `src/shell/main.ts`,
`panel.ts`, `index.html`, and its policy in `scripts/build.mjs`). The design holds.
Thirteen points, each with the orchestrator's decision of the same day. Where a point
changes an earlier section, this section is what stands until that one is rewritten.

**What the design left out**

1. **The room and the Airlock are in the frame too.** The frame holds `/walk/`
   (BitPortal's own room) and `/go/` (the Airlock), not only worlds. The room fills
   the visitor's own tabs today: the look editor under You, the bag changed at home,
   computers, their doors.
   *Decided:* the shell treats pages of **its own origin, exactly**, as the client's
   own. The room may fill any tab, still as data through the same words. A later step
   moves those tabs into the shell's menu. At the Airlock the menu shows Home and the
   visitor's own tabs only, and nothing of it may cover the Airlock's own panel.
2. **Tabs with a live picture.** A row's `draw` (the kit's `ui/model.ts`) is a canvas
   the world's page paints each frame: the turning item in Bag, Camera's view, a
   watched screen. A description at eight a second can't carry those.
   *Decided:*
   - The Bag's turning item is drawn by the client itself: it has the kit's previews
     and `fetchByHash`.
   - A picture a world feeds (Camera's view, a watched screen) crosses as that row's
     bitmap, sent alone and not with a whole description, at most 8 a second and 256
     pixels a side. Choppy, and no new mechanism.
   - If the owner finds that too poor once they see step 2, the next thing to try is
     a rectangle the client leaves clear for the world to draw in, in its own frame.
     Not before.
3. **Stale tabs.** The shell drops the world's description at every `load` of the
   frame, not at the next `here`. Otherwise one world's tabs and name stand over the
   next while it loads, or over a page that never says `here`. The address shown can
   only be the origin the browser reports for the last `here`: the shell can't read
   the frame's address. Until a `here`, none is shown. *Accepted.*
4. **Presses that need the world's own page.** A `press` arrives in the world with no
   press of the visitor's in that page. A row that copies (the clipboard needs a
   press, and the keys, in the page that writes) and anything that opens a window
   fail quietly. So a row may be of a kind the client does itself: `copy`, with its
   text. This joins step 0b's list beside the headset, the pointer and sound.
   *Accepted.*
5. **Rows the visitor types into.** The description has no field for one. A
   world-filled tab that has one (an item's address, a keeper's "add by key") needs a
   kind for it, or that row stays the world's. *Accepted.*
6. **The panel's other pages.** `panel.ts` has `account` and `library` as well as
   `wallet` and `files`, and `ask` and `switch` take a `menu` place from the world.
   *Decided:* Account and Library stay rows under You, opening the panel in the sheet
   as Wallet and Files do. The shell opens `ask` itself from its You tab, for the
   origin of the world in the frame. A world's own `sign-in` ask still works, and
   the shell places it itself, since the world has no menu to point at.

**What is harder than the design says**

7. **Focus.** Any press on the client's bar or mark moves the keys to the shell's
   page, and the world stops hearing them (walking stops) even with the sheet down.
   Section 7 covers only "while the menu is up". So the bar doesn't take the keys, or
   the shell hands them back to the frame after each press, as it does today at a
   load, a change of fullscreen and the panel closing. The shell also hears the
   summons keys itself whenever it does have them. *Accepted.*
8. **A held pointer.** In the intense way the world holds the pointer, so the
   client's bar can't be pressed. At `open: true` the world lets the pointer go; the
   words say so. Escape with the pointer held is the browser's: the world sees the
   hold end, not a key, and says `key: "summon"` for that (changed from `"escape"`
   by the orchestrator, 2026-11-23, with step 1's world's end: section 7 has why). After the menu closes,
   the pointer is taken again only at a press on the view. *Accepted.*
9. **Escape in fullscreen.** Nothing holds Escape today, and only the top page can
   (a frame can't).
   *Decided:* the shell holds Escape itself when it fills the screen, where the
   browser lets it. That is the owner's ask in `fullscreen-button-and-escape`:
   Escape brings the menu, Escape again leaves fullscreen. Elsewhere, as now.
10. **The panel in the sheet.** The sign-in address's panel must be a frame of the
    shell's page directly, never inside another frame: it finds the world's signer
    two frames deep. Inside the menu's own shadow root is fine. It needs a place of
    its own above the sheet's body, and for Wallet and Files its size no longer
    comes from a world's `menu` place. *Accepted.*
11. **The shell's page gets bigger.** Today it "does three things and nothing else",
    and the sign-in address trusts it by name to frame the panel. Step 2 puts the
    whole menu into that page, and later steps relays, follows and messages. Its
    policy today is `style-src 'self'`, `img-src 'self' data: blob:`, `connect-src
    'self' https: wss:`. **A done-condition of step 2:** the menu runs under that
    policy unchanged, with constructed stylesheets, no inline styles, and pictures as
    blobs or bitmaps. *Accepted.*
12. **`MENU_WAIT_MS` on a development server.** There the shell's "may this place be
    shown" is asked of the network, so `has: true` can come after 300 ms and the
    world's own menu shows for a moment. That is the "answers late" case of section
    6, and it is one of step 1's trial cases. *Accepted.*
13. **Home as a guarantee.** The shell sends the frame to the room itself after
    `LEAVE_MS`, through its own watch for whether a place came up.
    *Decided:* what is in the visitor's hand is lost when the world didn't go
    itself, and the text says so.

**Fine as written:** who may frame what (worlds already name the shell; the panel's
rule is the sign-in address's and doesn't change); fullscreen (the shell already
holds it, the menu's row becomes a call of its own, and the `screen` words stay for
a first press that lands in the world); a phone going the ordinary way; the
headset's extra press (step 0b).

## 17. The shell's half of step 2, as an approach: its policy, and who has the keys

From the BitPortal session, 2026-11-23, at the orchestrator's ask: points 11 and 7 of
section 16 written out, before any shell code. No shell code is written against
`nswp-sdk/menu` until step 0 has merged it; what is here names nothing of that
interface beyond what section 13 gives.

### 17.1 The menu under the shell's policy, unchanged (point 11)

**The policy as it stands** (BitPortal's `scripts/build.mjs`, `cspShell`):
`default-src 'self'`; `script-src 'self'`; `worker-src 'self'`; `style-src 'self'`;
`font-src 'self'`; `img-src 'self' data: blob:`; `media-src 'self' blob: mediastream:`;
`connect-src 'self' https: wss:`; `frame-src` itself, the worlds named in
`shell-worlds.json` and the sign-in address; `base-uri 'none'`; `form-action 'none'`;
`frame-ancestors 'none'`. Step 2 changes none of these words.

**Why that should hold.** The kit's menu already runs under the same rules, in
BitPortal's own room (`/walk/`, whose policy differs only in what it frames and who
may frame it). What it needs, against the policy:

| The menu needs | How it gets it | The rule it stays inside |
|---|---|---|
| Its code | BitPortal's own vendored copy of the kit, as a file of this site | `script-src 'self'` |
| Its looks | A constructed stylesheet (`adoptedStyleSheets`) and values set through the style object; no `<style>` element, no `style` attribute in markup | `style-src 'self'` |
| A world's words | Set as text, never as markup. The menu's own code has no `innerHTML` today, and none is added | (not the policy's: a rule of the code) |
| A picture a world sends | A bitmap the browser copies between the pages; nothing is fetched | `img-src` is not asked |
| A person's picture (step 3) | Fetched as bytes and drawn from a blob, as the kit's `loadPicture` does | `connect-src https:`, `img-src blob:` |
| The Bag's items | `fetchByHash`, from the visitor's own file hosts | `connect-src https:` |
| Its sounds | The kit's cue files, from this site | `media-src 'self'` |
| Relays (step 3) | Web sockets | `connect-src wss:` |
| The sign-in address's panel | The frame the shell already shows | `frame-src`, as now |

**What step 2 must not do,** each a reason to stop and ask: add `'unsafe-inline'` or
`'unsafe-eval'` anywhere; widen `img-src`, `frame-src` or `script-src`; load any code
from another site; put a world's words into the page as markup.

**Beyond the policy, since the sign-in address trusts this page by name:**

- **Everything a world says is cleaned before the menu sees it,** by the kit's own
  code for the words and `MENU_LIMITS` (section 4), in the shell's message handler:
  the one place a world's data enters the page. A description that is over a limit
  is left out, as section 4 says.
- **The menu can never cover the panel, or sit over a press in it.** The panel stays
  a frame of the shell's page directly (point 10), drawn above the sheet. While it is
  up, the menu draws nothing in its box.
- **The panel's code stays apart from the menu's** (`panel.ts`): the menu asks for a
  page of it by name (`ask`, `account`, `wallet`, `files`, `library`) and learns only
  that it opened and closed.
- **The world's frame is set going first.** The shell sets the frame's address before
  it loads the menu's code, so a world is never slower to come up for the menu.
- **The visitor's settings** are kept where the room keeps them today. The shell and
  the room are one site, so nothing moves.

**Done, for this point, when:**

1. BitPortal's build fails if `cspShell` differs from the words above (a check beside
   the ones `scripts/build.mjs` already makes).
2. A trial opens the shell over a world and over the room, opens every tab of the
   menu, the panel, and a row with a picture from the world, and the page reports no
   refusal by its policy (the browser's own `securitypolicyviolation`, counted: 0).
3. In that trial, with the panel up and the sheet open, the thing at the middle of
   the panel's box is the panel.
4. A world that sends markup in a label sees it shown as the letters it sent.

### 17.2 Who has the keys (point 7)

**The rule: while the sheet is down and the panel is down, the frame has the keys.**
A page above a frame hears no key while the frame has them, and the frame hears none
while the page above has them. A press on anything of the shell's moves them to the
shell. So every way the shell can come to have them is closed, or handed back:

| When | What the shell does |
|---|---|
| A press on the bar or the mark, with the sheet down | The press doesn't take the keys (the press's default is stopped as it goes down, for a mouse and a pen; the row still acts). And after the row has acted, the frame is given the keys again, whatever happened |
| The sheet opens (a press, or a summons the world forwarded) | The shell takes the keys, on the open tab, and says `open: true`. Nothing typed reaches the world |
| The sheet closes | `open: false`, and the frame is given the keys |
| The panel opens | The keys are the panel's. The menu takes none while it is up |
| The panel closes | The frame is given the keys, or the sheet if it is open (today: always the frame) |
| A place comes into the frame, or the screen is filled or given back | The frame is given the keys, as today |
| The window comes back from another window or tab | The frame is given the keys, if the sheet and the panel are down |
| A press on a bare part of the shell's page | The same |

**When the shell has the keys and shouldn't** (it can still happen: a browser moves
them in ways no page is told of), a key pressed is heard by the shell:

- **A summons key** (the key left of 1, M, Escape, a digit for the bar) does what it
  would have done if the world had forwarded it. The same handler takes both, and
  only one page ever hears a given press, so nothing is done twice.
- **Any other key** can't be passed into another site's frame. The shell gives the
  frame the keys at once, so the next press is the world's. One press is lost, once,
  and a held key has to be pressed again. This is the cost, said plainly.

**How the shell knows.** The frame has the keys when the page's active element is the
frame. The shell checks that at each of the moments in the table, and doesn't keep a
count of its own that could drift.

**The keyboard alone.** With the sheet down, the bar's keys are not stops for Tab
(`tabindex="-1"`, as the bar's scroll arrows already are): Tab pressed in a world
stays the world's. The way in for someone using only a keyboard is the summons key
and the digits, as now. With the sheet open, Tab goes round the sheet and Escape
closes it. The mark stays a named control for a screen reader.

**With a held pointer** (point 8) no press reaches the shell at all, so this table is
not reached: the world lets the pointer go at `open: true`.

**How these are tried.** With real presses and real keys, at places on the screen, in
the page that should get them: never a scripted call into a page, and never a tool
finding a button and clicking it. Either counts in that page as the visitor's own
press, so a trial of who has the keys, or of what needs a press, passes wrongly
(`docs/plans/the-clients-menu-presses.md`).

**Not a fix for anything here:** the frame's `allow` never gains `clipboard-read`. A
framed world can't read the clipboard today, and must not: it would read the
visitor's clipboard under the client's name. What a visitor pastes goes into the
menu's own `field` row, in the client's page.

**Done, for this point, when a trial shows:**

1. With a key for walking held in a world, a press on a bar key acts, and the world
   goes on hearing keys with no press on the view (its own count of keys heard goes
   on rising).
2. After each of: the sheet closed by a key, by a press outside it, and by its own
   close; the panel closed; a door crossed; the screen filled and given back: the
   page's active element is the frame.
3. With the shell given the keys by hand, the summons key opens the menu, and
   another key gives them back to the frame.
4. Nothing typed into the menu's own fields is heard by the world (its count of
   keys heard doesn't rise).
