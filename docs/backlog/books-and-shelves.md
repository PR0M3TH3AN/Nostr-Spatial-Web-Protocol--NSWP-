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

- **A placed book is pinned to one version, and its keeper can bring it up
  to date** (the owner's decision, 2026-11-23, replacing "Follow the edits"
  from earlier the same day: "Can we pin by hash and have the option for the
  owner to update to a later version of the long form note? Like if someone
  makes a spelling error they will want to edit. And just fixing the long
  form note seems pretty easy"). So:
  - A placed book names the exact version of the article it was bound to, by
    that version's id. Everyone who opens it reads those same words, on the
    same pages, whenever they look.
  - When the author signs a newer version, the book doesn't change by
    itself. Whoever placed it (the world's keeper, in this first round) is
    shown that a newer version exists and can update the book to it at one
    press, which is one change to their signed list of placed things.
  - For the design to settle: whether a reader who isn't the keeper is told
    a newer version exists; whether the keeper can see what changed before
    updating; an article its author deleted (the bound version is still
    what it was, if a relay or the keeper still has it); and pictures, which
    are bound by hash with a version and are bound again at an update.
- **A book shows its pictures** (the owner's decision, 2026-11-23, against
  the orchestrator's proposal that a book's pictures be copied by hash and
  fetched only from the reader's own file hosts: "i think if users want more
  privacy then they should use a VPN. books should images."). So a book's
  pictures are loaded from the addresses its article gives, as any Nostr
  reader loads them. What that means, said plainly in the design and once to
  a reader: the place that keeps a picture learns the reader's address and
  when they opened the book. This is a decision for books; the rule for
  items' and people's own files (NSWP-17, "Where a file is fetched from") is
  unchanged unless the owner says so. Still held to: `https` only, taken as
  a picture and nothing else, within limits on size and number, and never
  loaded until the book is opened to that page.
- **A book can be blocked and banned** (the owner, the same message: "And
  also books should be allowed to be ban or blocked."):
  - a reader blocks a book, or everything by its author, for themselves, and
    doesn't see it again (their own list, which travels with them);
  - a world's keeper bans a book or an author from their world, so it can't
    be placed there and is taken off its shelves;
  - curated lists (BitGate's) of books or authors a client or a world chooses
    to follow, as for worlds and people.
  A blocked book on a shelf is drawn as a plain closed book that says it is
  blocked, so a shelf's places don't shift.
- **A book is rated, both ways** (the owner, 2026-11-23: "And raited", and,
  asked whether that meant what is in it or readers' own marks: "both"):
  - **What is in it:** said by whoever binds the book, in the words a world
    uses for how intense it is and what a visitor should know first
    (`rating.ts`), and shown before the book is opened. A world's keeper can
    refuse books above a rating; a reader can choose not to be shown them.
    It is the binder's own word, as a world's rating is the world's.
  - **How good readers found it:** a reader's own mark for a book, signed by
    them, counted by whoever shows it. For the design: whose marks are
    counted (everyone's, or people the reader follows), so that a count
    can't be run up with keys made for the purpose; and that a mark is for
    one version or for the book whatever its version.
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
- Run anything a book carries, or load a picture before its page is opened.
- Let a visitor place anything in a world whose keeper hasn't allowed it.
- Change what is in a placed book without its keeper's own press.
