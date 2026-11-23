# Books you can read, and shelves to keep them on

- **Asked:** 2026-11-23. The owner: "The book item should be customizable.
  It should be able to be placed on shelves and it should be able to contain
  Nostr long format notes and embedded images. Users should be able to open
  and read it like a book with pages in oblivion. Once the book is placed it
  should contain the same information inside it regardless of who looks at
  it. The shelves it can be placed on should have limited number of slots
  like a real book shelf. The shelves themselves should be items that
  interact with worlds and book items. Books should have a random color and
  pattern unless the user customizes it. And a random size within
  constraints. Similar in size and thickness. Worlds will need to enable
  shelves have a designated area where it's allowed to be placed. and we need
  some sort of Nostr list logic to determine what books are inside. And the
  text content should be formatted in a way so that it's consistently
  located on the same page numbers across game modes. The initial version
  can just be in the users owned worlds. We can figure out synchronized item
  locations across worlds later."
- **Who:** a written design first; the kit (the NSWP builder), then the
  template and the reference Library. Not briefed.
- **State:** asked. After the client's menu.

## What is true today

There is one book, `old-book`, among the six starter items. An item can be
kept in a bag, held in a hand, and given colours by its holder from a short
list. It can't be put down, it carries nothing to read, and nothing in a
world stays where a visitor left it. NSWP-17 has no placed things.

## The pieces (the orchestrator's reading)

1. **A book holds writing.** A book is bound to a Nostr long-form note (kind
   30023), with its pictures. A visitor opens it and reads it page by page,
   in the world: two pages open, a turn of the page, at a desk, on a phone
   and in a headset.
2. **The same pages for everyone.** Where a line breaks and where a page
   ends is worked out one way by the kit, not by each screen: one page size,
   one book face, one rule for breaking, with examples in `vectors/` so
   another engine lands on the same page numbers. A screen only scales the
   page.
3. **How a book looks.** Its colour, its pattern, its height and its
   thickness are drawn from the book itself, by chance but always the same
   chance, so everybody sees the same spine; all within limits that keep
   books alike. Whoever binds it may choose them. Thickness can follow how
   many pages it has.
4. **Things that stay put.** A world's keeper can place a thing in their
   world and it is there for everyone: new to the protocol. A world says
   where things may be placed (areas in its `world.json`); what is placed
   where is a signed list of the keeper's, changed one thing at a press, as
   their guest list is.
5. **Shelves.** A shelf is an item with a fixed number of places. It is
   placed in a world's allowed area; books are placed in its places. Which
   book is in which place is in that signed list.
6. **Later, not this round:** a visitor placing things in a world that isn't
   theirs, and a thing's place following it from world to world.

## For the design to settle

- **What "the same information" is pinned to.** A long-form note can be
  rewritten by its author. A placed book names the one version it was bound
  to (by that version's id), so everyone reads the same words whenever they
  look. Whether it also says "a newer edition exists" is for the owner.
- **Pictures in a book** are somebody else's files. They follow the rule for
  every such file (NSWP-17, "Where a file is fetched from"): named by hash,
  fetched only from the reader's own file hosts unless they turned "from
  anywhere" on. A long-form note's pictures are ordinary web addresses, so
  binding a book has to take a copy by hash, or the picture is left out with
  a line saying why.
- **A book's words are a stranger's words:** shown as text and pictures,
  nothing run, no markup taken as more than headings, emphasis, lists and
  quotes, and a link is shown and never followed by itself.
- **Limits:** how long a book may be, how many pictures, how many places on
  a shelf, how many shelves in an area, how many placed things in a world.
- **Who binds a book**, and whether anyone may bind somebody else's public
  writing (the author is always shown, from the note's own signature).
- **The new notes and their kinds** (given, fleet rule 11): a bound book, and
  a world's list of placed things. Whether a bound book is an item's
  description of the kind there is, or a note beside one.
- **Reading in a headset** and on a phone; a reader who has turned movement
  down (no page-turn animation).
- **Other engines** (Godot): the same pages, the same shelf.

## Must not

- Let a book's content differ by who is looking.
- Fetch anything on a reader's behalf from a place the book's maker chose.
- Let a visitor place anything in a world whose keeper hasn't allowed it.
