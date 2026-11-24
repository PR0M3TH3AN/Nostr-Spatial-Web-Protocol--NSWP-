# The wallet couldn't be opened, and wallets have to be robust

- **Asked:** 2026-11-24, by the owner, with a picture of what is live: "also,
  i did have 20 sats in my NIP-60 wallet. But im getting this sync error
  message. We gotta make sure the wallets are robust". The picture:
  BitLogin's panel over BitPortal's room, signed in, the wallet's screen
  saying "Your wallet couldn't be opened. Nothing was changed."
- **Who:** the Bitlogin session. Briefed the same hour.
- **State:** mended and **live**: BitLogin's beta 16c0da2 was released on
  the owner's word ("Yes, release it") as main 6258a73 on 2026-11-24, and
  the orchestrator found its wallet screen's file in what the site
  serves. The owner, an hour later: "I was able to load in the 20 sats
  again. =)". A follow-up, beta ad4b4aa (the wallet reads the account's
  relay list again each time it opens), is with BitLogin's session to
  released the same day as main f818c5b on his "yes do as you recommend",
  and the lock fix (beta 1271008: with BitLogin's lock on, the panel asks
  for the PIN itself before the wallet, Files and Purchases) as main
  49b7488 on his "Yes, release it". Each found by the orchestrator in what
  the site serves. Put to him and awaiting his order: first keeping a
  saved record the answering relays did not return until a mint says it
  is spent (small), then restoring what is held from the mint by a seed
  (two or three days). Not a regression from the morning's release. Still not known: whether the cause found is what
  happened to his wallet, and which line his wallet now shows (kept only
  in this browser, or kept with his account).

## What was found (the Bitlogin session; the commit read by the orchestrator)

- **His money is safe on that path.** Opening only reads, and may send
  again records held only in this browser, which are copies and not
  spending. On every way into that screen nothing had been written or
  deleted.
- **Why it failed, made to happen on demand** with a throwaway account on
  stand-in relays and a mock mint: records held only in this browser were
  sent again one at a time, each waited for up to 6 s, and a record counts
  as saved only when two relays confirm it. With about ten such records on
  relays that read but never confirm a write, the opening ran past the
  panel's minute, and the screen replaced the balance it was showing with
  "couldn't be opened", keeping no reason. No other condition did it:
  every relay refusing, slow, one answering, the mint down.
- **The mend:** what waits is gathered by mint and sent at once (about 7 s
  in the same condition); the reason is kept and said in plain words; a
  Try again; the balance from this browser's copy stays up, with nothing
  that spends offered until the wallet opens.
- **What it implies, to be said to him plainly:** if records were held
  only in his browser and his relays never confirmed a write, some of what
  he holds may exist nowhere else. He should not clear that browser's data
  for the sign-in address until the wallet says its records are saved.

## What robust has to mean (the Bitlogin session's `docs/wallet-robustness.md`, in the same commit)

Missing today, as its list: what is held restorable from the mint by a
seed (the one gap that can lose sats to a relay fault); a clear warning
when records stay unsaved; the browser's copy forgetting saved records
that the answering relays did not return; a single relay that takes
wallet records counting as none; no export or backup; other apps' wallets
of the same kind untried. Not checked: his real relays, mint or records;
the idle lock; other browsers. The building of these is his to order.

## As first read, before it was made to happen (the orchestrator, not run)

That sentence is one catch around the whole of the wallet's opening. It
keeps no reason, so the screen can't say whether relays did not answer,
a note would not open, the signer refused, or a mint failed. BitLogin's
release of the same morning (reserved names for application data) changed
its permissions and not the wallet's own files; whether it bears on this
is the first thing to find out. The portal still carries the older copy
of BitLogin's widget beside the new service.

## Asked of the Bitlogin session, in order

1. Whether his money is safe, and whether "Nothing was changed" is true on
   every path to that screen. Said to him in plain words.
2. Why it failed: made to happen on demand with a throwaway account, on
   stand-in relays and a test mint, on the release before this morning's
   and on this morning's.
3. What he can do that tells the causes apart with nothing of his leaving
   his browser: open the wallet at the sign-in address itself, not through
   the portal.
4. The mend: the reason kept and said in a sentence a person can act on; a
   way to try again from that screen; one relay not answering never makes
   the whole wallet unopenable where another has it.
5. For "robust": what it has to mean for this wallet and how much holds
   today. What is kept where; a relay gone; a mint gone; this browser's
   storage cleared; whether what he holds can be got back from his key
   alone. With what is missing as a list, for him to order.

## Must not

- Use the owner's npub with any relay or outside service without his word.
- Move real sats, or send anything test-made to a real relay or mint.
- Release to bitlogin.network without his word for the exact commit.
