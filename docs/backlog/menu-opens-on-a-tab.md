# The word that brings the menu up should be able to name a tab

- **Asked:** 2026-11-24, by the orchestrator, from BitPortal's step 2 (its
  PR 209, where its own room fills the one menu through the words). Not an
  ask of the owner's.
- **Who:** the NSWP builder.
- **State:** built in the kit, 2026-11-24; not live. The word's name is
  given (the orchestrator, the same day): `{ nswp: "menu", show: "<tab
  id>" }`, a word of its own and not a field on the summons. BitPortal's
  half is to vendor the kit: the kit's end of the port in its page honours
  the word.

## What is missing

A world whose client has the menu asks for it to come up by saying the
visitor's summons upward (`{ nswp: "menu", key: "summon" }`). It can't say
which tab. So a world's row that used to open its own menu on a tab ("Change
how you look", opening on Your look) now only brings the client's menu up,
on whatever tab it was last on.

In a world's own page the kit already does this: something asks for the
controls on one of their sections (`controls.signal("show:<section>")`), and
the menu comes up there. The words between a world and its client have
nothing for it.

## Wanted

- The word that brings the menu up may name the tab to come up on: one of
  the world's own, or one of the client's, by its id.
- ~~A client that doesn't know the field brings the menu up as now.~~
  **Changed, 2026-11-24 (the orchestrator): a client that doesn't know the
  word does nothing.** The summons is the visitor's own key and toggles; a
  client that read the asking as a summons would put away a menu that is
  up, at a row pressed inside that menu. A word an unknowing client ignores
  fails better than one it obeys wrongly. The only client today vendors
  the kit, and the word is part of version 1 before any other exists. So
  the version of the words stays 1.
- A tab the client doesn't have is the same as no tab named. **Added to,
  2026-11-24 (the orchestrator): one it doesn't have yet is waited for a
  short while.** See "A tab asked for early" below.

## As built

- **It never puts the menu away.**
- **With the menu up, only in answer to a press** of that world's own row
  in the client's menu: within a second of it, and once for each press. So
  a world can't move a visitor about in a menu they are using.
- **With the menu down, the visitor's closing wins:** two seconds in which
  nothing a world says brings the menu back. Where they put away a menu
  that `show` had brought up, having pressed nothing in it, that doubles
  each time in a row, to a minute. A world asking ten times a second for
  five minutes, each one put away at once, brings the menu up nine times.
- A world says it by what it already does: `controls.signal("show:<tab>")`,
  or the kept menu's `setOpen(true, "<tab>")`. No new name in the kit.
- **A tab asked for early** (found by `trials/menu-client.mjs`, whose
  `file` visit raced it; decided by the orchestrator, 2026-11-24). A world
  may ask for a tab of its own a moment before its client has heard of
  that tab: the asking and the description travel as two words, and the
  description is said no oftener than eight times a second. The asking
  used to be forgotten, so the menu came up elsewhere and stayed there
  when the tab arrived. Now the menu keeps the asking for two seconds
  (`MENU_SHOW_KEEP_MS`): it comes up at once where it last was, and goes
  to the tab when it arrives, unless the visitor has chosen a tab meanwhile
  or put the menu away. Two seconds because a description is said within
  an eighth of a second of a change and a slow device takes a few times
  that, so there is room to spare; and it is short enough that a tab
  arriving later doesn't move a visitor who has settled. The same holds
  for a world drawing its own menu and calling `setOpen(true, "<tab>")`
  before it has added the tab. **Not done:** the menu in a headset
  (`console.ts`), which has no asking for a tab by name.
- Nothing new is handed to a world made with another engine. Whether such
  a world has a way to make the asking today was not looked at.

## To settle with the pull request

- The field's name: proposed with the pull request, given by the
  orchestrator (rule 11).
- Whether it rides on the summons (`key: "summon"`, with the tab beside it)
  or is a word of its own. A word of its own can't be mistaken for a key the
  visitor pressed.
- A vector for each: a tab named, none named, a tab that is no id, and a
  client that reads the word without the field.
- NSWP-02, beside the other things a world tells its client.
