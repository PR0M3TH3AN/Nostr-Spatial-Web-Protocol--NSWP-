# Hidden items: things to find across worlds (Easter eggs)

- **Asked:** 2026-11-21. The owner: "the next concept id like to think
  about is global items like Easter eggs. Thinking about Ready Player 1.
  I think we have a lot of the basic functions in but how could global
  items work and be hidden in worlds? That players can interact with
  without knowing where they are by looking in code or something? Could
  that fit in our inventory system for items? Are they already global? I
  guess they are. Would bitunlock be required to determin who found one
  first. Where it was located. and what happens to the user?"
- **Who:** not briefed. The kit and the protocol (it sits on
  [items-given-and-won](items-given-and-won.md), which is not built).
  The owner asked to think about it, not yet to build it.
- **State:** asked

Everything below is the orchestrator's reading, to be argued with. None
of it is decided.

## The owner's questions, answered as the code stands

**Are items already global?** Yes, in the way that matters. An item is a
signed description on relays that names its files by their hashes
(NSWP-17), and a visitor's bag goes with their account, so what they hold
is the same in every world. What is not built is an item that a world
*gives* with proof it was earned: today a visitor picks an item up
themself. A found egg is exactly that missing piece.

**Can something be hidden so that reading the code doesn't find it?**
Not by hiding it in the code. A world is a static site: everything the
page knows, anyone reading the page knows. What can be hidden is a
**secret the page doesn't hold**. The way that needs no service:

- The egg is a key. Its maker makes a key pair, publishes the public half
  in the egg's description, and throws the private half away, keeping
  only a way to rebuild it: the private key is made from the answer to
  the hunt (a phrase, a sequence of things done, pieces gathered).
- The world's code holds only a check that can't be run backwards (the
  public key, or a scrambled prize). Reading it tells you an egg exists
  and nothing about where or how.
- Finding it is rebuilding that private key. The finder signs "I found
  this", with the egg's key and their own. Anyone can check it; nobody
  could have made it without the answer.

**What that can and can't hide.** It hides only what is hard to guess. A
place alone ("stand here") is not: a program can try every square of a
floor in seconds. So a hidden egg needs an answer with real size: words
typed or said, an order of things touched, or parts handed out by other
eggs in other worlds, which is the Ready Player One shape (three keys,
each a riddle, each leading to the next). The hunt's maker has to design
for that; the kit should refuse to make an egg whose answer is too small
to be a secret.

**Is BitUnlock needed to say who found it first?** Not to find it, and
not to prove someone found it. "First" is the hard word: a Nostr note
carries whatever time its writer put on it. Three honest ways, cheapest
first:

1. **The prize is in the egg.** The key that finding rebuilds also holds
   the prize (sats as ecash, or a pass only that key can claim). The
   first finder takes it and it is gone. Nobody judges; the mint or the
   Bitcoin network already settles who was first. This needs no service
   of ours and fits a hunt with one winner.
2. **A stamp from Bitcoin.** The finder's signed claim is anchored to a
   block (OpenTimestamps, NIP-03). No service of ours; "first" is good to
   about a block, ten minutes or so. Fits a public record of finders in
   order.
3. **A witness that countersigns.** A service signs each claim with the
   time it saw it. BitUnlock already signs receipts and could be this.
   Needed only where "first" must be exact to the second, or where only
   the first N may get something that isn't a bearer prize (that is
   [items-scarce](items-scarce.md): somebody has to keep count).

**Where it was located.** The finder knows, and the claim can say (the
world's address, signed with the egg's key so it can't be made up) or
keep quiet, as the hunt's maker chooses. Before it is found, the egg's
description need not say which world it is in at all.

**What happens to the user.** The egg's item goes in their bag with the
proof that it was found, as any given item would, and shows in every
world as theirs. A world can react at once (a sound, a door that opens,
a line on a board of finders). An achievement can hang on it. If the egg
held a prize, it is theirs.

## What it can't stop, said plainly

- A finder can tell everyone the answer. After that, anyone can make a
  true-looking claim. So "first" and "found before it leaked" are what
  carry weight, and a hunt's maker should expect later claims to be
  worth less.
- Anyone can see that an egg exists, and how many there are, from the
  descriptions on relays.
- A world's maker knows the answer to their own egg. A hunt across worlds
  by different makers needs them to trust whoever made the eggs, or to
  make their own.

## How it would fit what exists

- An egg is an item (NSWP-17) with one more thing in its description: the
  public key that proves it was found, and what size of answer it needs.
- "Found" is a grant: the piece [items-given-and-won](items-given-and-won.md)
  and [achievements-granted](achievements-granted.md) both wait for. One
  shape of grant for all three, signed by the world's key where a world
  gives something, and by the egg's key where it was found.
- The kit gives a world one call to offer an answer ("try this"), and
  one to make an egg from an answer, with examples (vectors) so another
  engine checks a find the same way.
- BitPortal shows a found egg in the bag and on a person's card like any
  held item, and could keep a board of hunts and finders.
- A place for the money rules: a prize inside an egg is a payment with no
  receipt. It goes through the sign-in address like a tip, never through
  a world's code, and is small.

## Open, for the owner when this is taken up

- One winner, or everyone who finds it gets the item and only the order
  differs?
- Are prizes in sats wanted at all, or items and standing only?
- Who makes hunts: only you to begin with, or any world's maker?

## Must not

- Hide anything by putting it in the page and hoping nobody reads it.
- Say "first" on the strength of a time the finder wrote themself.
- Let a world's code hold or move a prize.
- Need a service for the plain case: find it, prove it, hold it.
