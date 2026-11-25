# One identity across BitPortal: a guest is a generated account, and an account is known in every world

- **Asked:** 2026-11-23. The owner, straight after `items-for-guests`: "can a
  guest be a generated and is the user decideds to sign up they can import
  this generated user into a bitlogin account? This might solve some of the
  issues around kicking, items and onboarding users into a signed in account
  with less friction."
- **Who:** a written design first, by the BitLogin session (it holds
  accounts and keys) with the kit's half by the NSWP builder. Not briefed.
- **State:** BitLogin's half live (a76ff51, 2026-11-25, on the owner's
  "Yes, release 4425c08"): a guest per family per browser, signing notes,
  reactions and its bag with no press, "Secure this account" keeping its
  key, passes tagged `["nswp:guest","1"]`. BitPortal's first half (its Bag
  over worlds) is BitPortal 246; the kit's `bag.start(items)` writes a
  guest's first bag in one note. Next: the guest is themselves in every
  world (below). The kit's half in four parts (agreed 2026-11-25): asking for
  the guest and a guest's pass in rooms (merged, 19c7252, not live); a world's
  `"guests": false` (built, not merged); items for guests; what a guest is told.
- **Confirmed again, 2026-11-25:** "a guest should be the same guest in
  every world and they should have access to a bag with the free items
  that the worlds allow". So a guest is not Bag-only: in every world they
  are the same guest, by their guest key's pass (its name and look the same
  each visit), in rooms, chat, notes and reactions, as an account is; and
  their Bag holds the free starter items, used where a world allows guests
  to use items (`items-for-guests`). Follows, messages, the wallet, Files
  and buying say "Secure this account first".

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
- **Made automatically** (the owner's decision, 2026-11-23, against the
  orchestrator's recommendation of a press: "Made fully automaticly. I want
  to treat BitProtal like one coherent place. Not new anaons in every world.
  If they want another anon account then they can clear cache and load
  again."). A visitor who arrives signed out is given a guest account at
  once, with nothing asked, and is the same guest in every world they go to
  through BitPortal. There is no "play as a guest" press and no per-world
  question for a guest. Someone who wants to be a different guest clears
  their browser's data for the site.
- **What that gives up, said plainly in the design and to visitors:** a
  signed-out visitor is no longer unlinkable from one world or one visit to
  the next. Every world they enter can know the same guest came back. The
  help and the You tab say so in a sentence.
- **Kicking is better, not solved.** A keeper can block a guest's key, and it
  holds until they make another. That is true of any account anywhere; what
  changes is that a block lasts past one session.
- **Nothing of value before it is secured.** A key that lives only in one
  browser is lost when that browser's data is cleared. So no wallet (or a
  very small limit) until the account is secured, and the screen says
  plainly that a guest account lives on this device only.

## For the design to settle

- **Accounts too** (the owner's decision, 2026-11-23, asked whether
  signed-in accounts should also be known in every world without being
  asked: "one account and known as the same user across all worlds", and
  "like i said. BitPortal is one place"). So a signed-in visitor is not asked
  at each world whether to be known there. They sign in once, and are
  themselves in every world they reach through BitPortal, as a guest is the
  same guest. The orchestrator had recommended keeping the question for
  accounts; this replaces it.
- **What "known" covers, for the design to hold to.** Being known is who
  they are: their key, name, look and bag, as a pass says today. It is not
  leave for a world to act as them. Anything a world would do in their name
  (sign a note, send a message, pay, read what is private) is still asked at
  its first use, on the sign-in address's own page, as now. One place means
  one identity, not one permission.
- **What this changes that is already written or built:**
  NSWP-10 and NSWP-03 ("once for here, and once at each world you choose to
  be known in"; "go as yourself, or go plain" at each trip); BitLogin's
  per-world question; the kit's You rows for signing in to one world
  (`signInRows`, NSWP 381), which stay for clients that do ask and for a
  world opened by its own address; and what a keeper's "by invitation" and
  block lists can rely on. Whether a visitor can still choose to go plain,
  as a setting and never as a prompt, is for the design to propose.
- **Said plainly to visitors:** every world you enter through BitPortal
  knows it is you. The You tab says so, and so does signing in.
- Whether "known everywhere" means every world reached through BitPortal's
  doors only, or a world opened by its own address too (which depends on
  where the key can be kept).
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
- Hide from a guest that they are the same guest everywhere: the You tab says it.
- Let a guest account hold money it can lose by clearing a browser, without
  saying so first.
