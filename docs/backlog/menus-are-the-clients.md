# The menus are the client's, not each world's

- **Asked:** 2026-11-23. The owner, after the trouble keeping BitPortal's
  UI the same across worlds: "Im wondering if we should make our systems
  more modular like we do with items? Then the worlds would load the same
  thing each time and if we want to update it then all the worlds would get
  the change. Same goes for like doors designs. Movement controls or other
  things." Then: "I think the menus in bitportal are a bitportal menu. Not a
  world menu. Items and world can be other users worlds things. And skins
  like door skins or player skins etc. But the interface and menus and such
  should be Bitportals. Maybe a world can add a tab to the menu but thats
  and addition and not a change to our UI." And: "yes keep the kit menu as
  the fallback. And lets write up all the design. And id like to bring this
  up to the top of the list for the backlog so we get it in place asap."
- **Who:** a written design first (`docs/plans/the-clients-menu.md`), then
  the kit (the NSWP builder) and BitPortal's shell (the BitPortal session).
- **State:** asked; first in the order (the owner, 2026-11-23). Design
  drafted: [`docs/plans/the-clients-menu.md`](../plans/the-clients-menu.md),
  answered by the orchestrator on 2026-11-23 (names given, steps agreed).
  Steps 0 (the seam) and 0b (the press trial) are being built by the NSWP
  builder. The owner's eight questions (its section 14) are open, and step
  1 waits for them.
- **State, 2026-11-24:** BitPortal's own menu above a world is built behind
  a switch that is off in every live build. Shown its seventeen pictures
  and asked whether the switch may go on, the owner said: "Yes for menu
  pictures". Read by the orchestrator as: the pictures are approved, and
  BitPortal may build and merge the change that turns the switch on, in
  its order (the Bag, the answer from the first file, the core carried
  once, then the switch). Going live with it is a separate word. Three
  things in the pictures are worse than the menu that is live, and are
  named again when that word is asked for: the view isn't yet shifted
  clear of the bar (`view-clear-of-the-menu`), "Change how you look" opens
  on You (`menu-opens-on-a-tab`), and things in the Bag show by their
  first letters.
- **And when it goes live:** asked whether BitPortal's menu should go live
  as it is in the pictures or wait for those three, the owner said,
  2026-11-24: "Wait for the mends". So the switch stays off on BitPortal's
  main until all three are mended and merged, and the switch-on change is
  the last of them. Other mends deploy in the meantime. Names given for
  them the same day: the word a world says to bring the menu up on a tab,
  `{ nswp: "menu", show: "<tab id>" }` (a word of its own, not a field on
  the summons), and `NSWP.cover()` and `NSWP.bounds()` for the engine
  script.

## What is true today

- The visitor's console is drawn by each world's own page, from that
  world's copy of the kit (NSWP-11, "Who draws it"). A change to the menus
  reaches a world only when that world takes a new kit and is deployed, and
  somebody else's world never has to.
- BitPortal's shell (`/shell/`, NSWP-02 "A client that keeps the screen")
  already keeps one page open and shows each world in a frame, at a desk.
  It already draws one thing of its own above the world: the sign-in
  address's panel.

## What is wanted

- **The interface is the client's.** In a world shown in BitPortal's frame,
  the menu is BitPortal's own, drawn by the shell above the world: one
  copy, updated once, the same in every world, whoever made the world and
  whatever kit it carries. A world can't change it, imitate it or cover it.
- **A world adds, never changes.** A world may add a tab of its own by
  describing it (words, buttons, switches) for the client to draw; presses
  go back to the world. None of the world's code runs in the menu.
- **The kit's menu stays as the fallback** (the owner, 2026-11-23): for a
  world opened by its own address, one that isn't framed, and wherever no
  client above says it has the menu. It steps aside when one does.
- **Things that are other people's stay modular, as items are:** worlds,
  items, and looks (door skins, a person's own model). See
  `door-and-airlock-skins` and `avatars-own-models`.

## What the design must settle

- The words passed between a world and the client above it, written into
  the protocol so any client can do it (NSWP-11 would then say what a world
  may ask of a client's console, as it already foresees for a browser).
- Which tabs move first. The orchestrator's proposal: those that are the
  visitor's own and need nothing from the world (You, Travel, Bag, Display,
  Moving), then the ones a world feeds (Room, People, the world's own tab).
- What a world's tab may hold, and its limits.
- The summons (the key left of 1, two fingers held still) when the menu is
  the client's: who hears it, and that a world can't swallow it.
- Settings: which the client holds and sends in, and how movement (which
  runs in the world's own drawing loop and stays the kit's code) reads them.
- **A headset.** Only the world's page can draw into the view there, so the
  menu stays drawn by the kit inside the world until a browser of our own
  (BitBrowser) can draw it. The design says so plainly and says what the
  client can still hold (the settings, the words).
- **A phone.** The shell is the way in at a desk today; whether the frame
  works on a phone needs trying.
- Other engines (the engine script's console steps aside the same way).
- What a visitor sees while a world is slow to say it came up, and when a
  world can't be framed.
- What it costs each frame to pass input and words between the two pages.

## Also asked, and where it went

Loading the kit's own code live in every world, so one update reaches all
of them ("like we do with items"): not taken up as such. Item code is safe
to load from anywhere because it runs in a sealed box; the menus and
movement can't be boxed, so whoever controlled that one copy would control
every world at once. The client owning the menus gets the same result for
the interface without that. The kit's default looks (doors, sounds, icons)
as published data can follow with `door-and-airlock-skins`.

## Asked with it, the same day

- Wallet and Files as their own tabs, tabs the visitor can reorder, and one
  pinned at the far left: `menu-tabs-wallet-files-order-pin`.
- The orchestrator's proposals from the same talk, for the design to take
  or leave: **one menu, two places it runs** (the client's menu and the
  kit's fallback are the same code, so they can't drift apart); **the kit
  in two parts** (what a world runs: movement, doors, presence; and the
  console, which a client carries), so a world's part changes less often;
  and **the same words for BitPortal's shell and for BitBrowser**, so the
  browser's own console needs no second design.

## Must not

- Let a world read what is in the client's menu, or press it.
- Leave a world with no menu at all when no client is above it.
- Make BitPortal the only client that can do this: the words are the
  protocol's.
