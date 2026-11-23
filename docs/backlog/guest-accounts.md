# A guest is a generated account, which signing up keeps

- **Asked:** 2026-11-23. The owner, straight after `items-for-guests`: "can a
  guest be a generated and is the user decideds to sign up they can import
  this generated user into a bitlogin account? This might solve some of the
  issues around kicking, items and onboarding users into a signed in account
  with less friction."
- **Who:** a written design first, by the BitLogin session (it holds
  accounts and keys) with the kit's half by the NSWP builder. Not briefed.
- **State:** asked. After the client's menu; it comes before
  `items-for-guests`, which it largely replaces.

## What is true today

A visitor who isn't signed in is a guest with nothing but a session key made
for one room: no name, no bag, nothing that lasts, and nothing that ties one
visit to the next. A keeper can't block a guest except for that session. To
have a name, a bag or a wallet they sign up at their sign-in address first.

## The idea

A guest gets a key of their own, made for them, and uses the worlds as a
signed-in visitor does: a bag, a look, a place on a keeper's lists. If they
later decide to sign up, that same key becomes their account, with
everything they did as a guest still theirs.

## The orchestrator's recommendation (for the design to test)

- **The sign-in address makes and holds the key,** not a world and not the
  client. A guest is then an account that hasn't been secured yet, on the
  same path as every other account: worlds get a pass, the bag is a signed
  note, blocks and guest lists work by key. "Signing up" is securing that
  account (a passkey or a password, and its sealed copy on relays), not
  moving a key from one site to another. No secret key ever crosses between
  sites.
- **A guest account says it is one.** The pass a world gets marks it as not
  yet secured, so a world, a keeper or another visitor can treat it
  differently: this is where a world's "guests may use items" option lives,
  and an item's maker's.
- **Made at the visitor's own press, not silently.** Today a guest can't be
  followed from one world or one visit to the next. A lasting key changes
  that, so it is made when they choose ("Play as a guest", or the first time
  they take something up), and "go plain" stays.
- **Kicking is better, not solved.** A keeper can block a guest's key, and it
  holds until they make another. That is true of any account anywhere; what
  changes is that a block lasts past one session.
- **Nothing of value before it is secured.** A key that lives only in one
  browser is lost when that browser's data is cleared. So no wallet (or a
  very small limit) until the account is secured, and the screen says
  plainly that a guest account lives on this device only.

## For the design to settle

- Where the key is kept in the browser, and whether a guest made inside a
  client's frame is the same guest when a world is opened by its own address
  (browsers keep a framed site's storage apart per top site).
- What securing looks like, in one or two presses, and what happens to a
  guest account never secured (how long it is kept, and how it is forgotten).
- The words on the pass for "not yet secured", and every new name.
- What a world's and an item's maker's options are, now that a guest has a
  key: `items-for-guests` is rewritten from this.
- Abuse: a new key costs nothing. What a keeper's "by invitation" and block
  lists do about guest accounts, and whether a world may refuse them.
- What the client's menu shows a guest (You, Bag), and the one row that
  secures the account.

## Must not

- Move a secret key between sites, or show one.
- Make a lasting key for someone who didn't ask for one.
- Let a guest account hold money it can lose by clearing a browser, without
  saying so first.
