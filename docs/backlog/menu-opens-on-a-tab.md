# The word that brings the menu up should be able to name a tab

- **Asked:** 2026-11-24, by the orchestrator, from BitPortal's step 2 (its
  PR 209, where its own room fills the one menu through the words). Not an
  ask of the owner's.
- **Who:** the NSWP builder.
- **State:** not built. After the kit version that follows PR 448, and after
  the press lost while the menu is drawn again.

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
- A client that doesn't know the field brings the menu up as now. So the
  version of the words stays 1.
- A tab the client doesn't have is the same as no tab named.

## To settle with the pull request

- The field's name: proposed with the pull request, given by the
  orchestrator (rule 11).
- Whether it rides on the summons (`key: "summon"`, with the tab beside it)
  or is a word of its own. A word of its own can't be mistaken for a key the
  visitor pressed.
- A vector for each: a tab named, none named, a tab that is no id, and a
  client that reads the word without the field.
- NSWP-02, beside the other things a world tells its client.
