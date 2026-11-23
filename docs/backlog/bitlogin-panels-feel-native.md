# BitLogin's panels are slow; they need to feel native

- **Asked:** 2026-11-23. The owner: "one thing i noticed the other day is
  that, using anything in the bitlogin panels was really slow. Is there
  anyway we can investigate why this was so slow? Loading in wallet and
  files etc. Can we speed that up somehow? It needs to feel native."
- **Who:** the BitLogin session measures and reports first; then BitLogin
  (its pages) and BitPortal (how the shell holds the panel). Briefed
  2026-11-23 for the measurement only.
- **State:** being measured. No fix chosen.

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

## Must not

- Trade safety for speed: nothing of the visitor's keeps unlocked longer,
  is cached in the clear, or is shown to the world's page, to save time.
- Measure with the owner's own account or wallet. A throwaway account and
  pretend sats only.

## Done looks like

To be written from the report: a number for each panel before and after,
and the owner trying it.
