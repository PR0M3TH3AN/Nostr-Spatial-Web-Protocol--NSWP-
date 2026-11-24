# The wallet couldn't be opened, and wallets have to be robust

- **Asked:** 2026-11-24, by the owner, with a picture of what is live: "also,
  i did have 20 sats in my NIP-60 wallet. But im getting this sync error
  message. We gotta make sure the wallets are robust". The picture:
  BitLogin's panel over BitPortal's room, signed in, the wallet's screen
  saying "Your wallet couldn't be opened. Nothing was changed."
- **Who:** the Bitlogin session. Briefed the same hour.
- **State:** diagnosed and mended on BitLogin's beta as 0ad2eab
  (2026-11-24), not pushed and not released: that is the owner's word for
  that commit. Not a regression from the morning's release (the same on
  the release before it). The cause found is a strong lead and not proven
  for his wallet: his own browser's console would settle it.

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
