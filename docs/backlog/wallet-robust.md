# The wallet couldn't be opened, and wallets have to be robust

- **Asked:** 2026-11-24, by the owner, with a picture of what is live: "also,
  i did have 20 sats in my NIP-60 wallet. But im getting this sync error
  message. We gotta make sure the wallets are robust". The picture:
  BitLogin's panel over BitPortal's room, signed in, the wallet's screen
  saying "Your wallet couldn't be opened. Nothing was changed."
- **Who:** the Bitlogin session. Briefed the same hour.
- **State:** the first fault is mended and **live**, and the owner's wallet
  opened again ("I was able to load in the 20 sats again. =)"). Released
  on 2026-11-24, each on the owner's own word for that commit and each
  found by the orchestrator in what the site serves: the mend itself
  (beta 16c0da2 as main 6258a73, "Yes, release it"); the wallet reading
  the account's relay list again each time it opens (ad4b4aa as f818c5b,
  "yes do as you recommend"); the panel asking for the PIN itself before
  the wallet, Files and Purchases when BitLogin's lock is on (1271008 as
  49b7488, "Yes, release it"); and keeping a saved record the answering
  relays did not return until a mint says it is spent (e1e1eb1 as
  511e3f5, his word in BitLogin's session). In order after that, on his
  "yes": restoring what is held from the mint by a seed; its design is
  written (`docs/ecash-seed-counter.md` in BitLogin) and its tests on
  mock mints come first. **Open:** the wallet needing a refresh (below),
  mended as local commit 4310d13 and not released. Still not known: whether the cause
  found is what happened to his wallet, and which line his wallet now
  shows (kept only in this browser, or kept with his account).

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

## It should work without a refresh, or say when it needs one (the owner, 2026-11-24)

After the day's releases, the owner: "for bitlogin. i am signed in but
cant open the ecash wallet. Oh i just tried again and it seems a refresh
fixed the issue. Can we make it more clear if a wallet needs a refresh?
Or if we can make sure it works reliably with out a refresh that would be
idea".

**Found and made to happen on demand by the Bitlogin session the same
day.** A shell keeps the panel's frame between openings, and the
wallet's code is fetched only when the wallet is opened. So a panel
loaded before a release runs the release after's wallet code against its
own older page: with this morning's build before and the live one after,
the wallet stays on "Opening your wallet." (the new code sets an element
the old page doesn't have). Seven releases went out that day. The
orchestrator's first reading, files renamed by a build, was wrong: those
files keep their names in every release. The panel is not held together
by the service worker either, which only the front pages register.

**Mended as BitLogin's local commit 4310d13, not released: the owner's
word.** Each build has an id, in every page and in `/build.json`. At
every showing the panel asks which build is served (1.5 s at most; not
known counts as current) and, if it is newer, reloads itself and comes
back to what it was shown for; what it was asked (the client's address,
already checked, and the mode) is kept a minute in its own session
storage. From an open account page, where something may be typed, it
says "BitLogin has been updated since this page was opened. Reload it to
open this." with one press, "Reload BitLogin". Its test fails on the live
build and passes with the mend; the gate's exit was 0 (775 passed, 2
skipped) after earlier tries failed under load. Read by the orchestrator
in the commit. As read in BitPortal's `src/shell/panel.ts`, not run: a
reloaded page in the kept frame is still heard (the frame's window is
the same one, a second `ready` is ignored, its size is taken). A panel
loaded from a build before the mend can't check, so the mend holds from
the release after the one that carries it.

Wanted, the second before the first:

1. The wallet opens without a refresh across a release. A page loaded
   before a release can still open the wallet after it.
2. Where it truly can't, the wallet's screen says so in a sentence a
   person can act on ("BitLogin was updated. Reload to open your
   wallet."), with a button that does it, and never "couldn't be opened"
   for this.

Still to do: BitPortal's own trial of a kept panel that reloads itself,
once a build with the mend can be put in front of it.

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
