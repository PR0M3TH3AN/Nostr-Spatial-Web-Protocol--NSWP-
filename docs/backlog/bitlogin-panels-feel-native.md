# BitLogin's panels are slow; they need to feel native

- **Asked:** 2026-11-23. The owner: "one thing i noticed the other day is
  that, using anything in the bitlogin panels was really slow. Is there
  anyway we can investigate why this was so slow? Loading in wallet and
  files etc. Can we speed that up somehow? It needs to feel native."
- **Who:** the BitLogin session measures and reports first; then BitLogin
  (its pages) and BitPortal (how the shell holds the panel). Briefed
  2026-11-23 for the measurement only.
- **State:** measured 2026-11-23; fixes 1 to 3 and the `show` message being built on BitLogin's beta; the shell's half (fix 4) follows. Nothing live.

## Why it matters now

Wallet and Files are about to become tabs of the client's menu
(`menu-tabs-wallet-files-order-pin`, `menus-are-the-clients` step 4), each
showing the sign-in address's own panel. A tab that takes seconds to fill
would make the whole menu feel slow.

## First: measure, on the live site and locally

For each panel mode (`account`, `wallet`, `files`, `library`, and `ask`),
opened cold and opened again, in the shell's frame and as a window:

- from the press to the frame's first paint, and to the content being usable;
- what is downloaded, how big, and whether it is cached the second time;
- how long unlocking takes (the worker, the key's derivation);
- every relay question: which relays, and whether the page waits for the
  slowest, for all of them, or for the first good answer (a wait on the
  slowest relay was the fault fixed for buying on 2026-11-21);
- every call to a mint or a file host, and what the page shows meanwhile;
- each action inside a panel (open a file, a wallet's balance, a send).

## What "native" would mean (the orchestrator's proposal, for the report to test)

- Something useful on screen within about a tenth of a second of the press:
  what was there last time, marked as being checked, then the fresh answer.
- The panel already loaded before it is asked for, where that is safe: the
  shell could keep the sign-in address's frame alive between openings, not
  load it anew each time. What that frame may do while hidden has to be
  said, since it is the page that holds the visitor's keys.
- Never waiting on the slowest relay, mint or host for anything on screen.

## What was measured (BitLogin, 2026-11-23; its `docs/panel-speed-2026-11-23.md` on beta d2bddab)

Locally, at a real press, in a client frame like the shell's, with relays
slowed to what was timed that day (11 answer in 0.4 to 1.2 s, 3 refuse at
once, relay.nostr.band accepts and never answers), a throwaway account, a
pretend mint and file host. Not on the live site; `ask` and the window not
measured.

| Panel | Usable, cold | Opened again | Relay questions |
|---|---|---|---|
| account | 1.4 s | 0.85 s | 0 |
| wallet | 13.6 s | 12.9 s | 59 |
| files | 19.6 s | 18.9 s | 60 |
| library | 6.3 s | 5.6 s | 37 |

The frame itself paints in 0.15 to 0.4 s. The time goes on:

1. **Every relay question waits for the slowest relay,** and one that never
   answers costs about 9 s. Fix: ask as the paying screens do (done when all
   have answered, or 0.7 s after two), with a 2 s connect limit for reads.
2. **One thing at a time:** slow reads stack, and screens wait for things
   they don't show. Fix: ask for what the screen shows, the rest behind it.
3. **Nothing shown until relays answer,** though the browser holds a sealed
   copy. Fix: show the last copy at once, marked as being checked, with Pay
   and Send held until it is.
4. **Each opening loads the panel from nothing.** Fix (the shell's): keep the
   panel's frame alive and hidden between openings, shown again by a new
   `{ t: "show", mode }` message. While hidden it only listens for `show`,
   answers no world, runs no wallet or file action, closes on sign-out or
   lock, and lets its worker go after a few minutes.

With 1 to 3: usable in about 1 s. With 4 as well: the last view within about
0.1 s from the second opening.

**The orchestrator's conditions:** quick reads are for showing only; a write
that replaces a whole note is built on a careful read, so a slow relay's
newer copy is never overwritten. Nothing is kept unlocked longer or in the
clear for speed.

**For the owner:** whether relay.nostr.band leaves BitLogin's built-in list
(it has failed every probe since 2026-11-18).

## Must not

- Trade safety for speed: nothing of the visitor's keeps unlocked longer,
  is cached in the clear, or is shown to the world's page, to save time.
- Measure with the owner's own account or wallet. A throwaway account and
  pretend sats only.

## Done looks like

To be written from the report: a number for each panel before and after,
and the owner trying it.
