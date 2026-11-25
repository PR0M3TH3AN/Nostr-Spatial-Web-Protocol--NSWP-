# A "Sign in" press wherever a menu says to sign in

- **Asked:** 2026-11-25, by the owner: "can we have a "sign in" button
  anywhere in the menus that we say something like "sign into bitlogin to
  use this feature"".
- **Who:** the NSWP builder (one piece the kit uses in every tab that says
  it); BitPortal (its own pages and rows).
- **State:** built in the kit, 2026-11-25 (`signInHere`); not merged. BitPortal's own lines are its own.

## Today

The kit says "Sign in to ..." in the Bag, saves, following, messages,
achievements, scores and the front room, and sends the visitor elsewhere
("it is under You"). BitPortal says it for rating a place and on its
publish page.

## Wanted

- Wherever a tab or page says to sign in, a "Sign in" press right there,
  doing exactly what You's sign-in row does (under a client, the client's
  sign-in; otherwise the world's own), gone once signed in.
- One piece the kit uses everywhere, which a world's own tab may use too
  (its name given by the orchestrator), not a row written in each place.
- "It is under You" taken out of those lines.
- A check: signed out, every tab that says to sign in has the press; one
  press opens the sign-in; signed in, none anywhere.

## The change of plan (2026-11-25, agreed with the orchestrator)

Building it showed that a tab with no rows isn't shown, and that Bag,
Following and Messages have none for a guest: their "Sign in to …" lines
are never seen when signed out. A guest meets "Sign in" in Achievements
and Scores, and as a line said after a press (Follow, Write, Show, Post,
joining a room only for people who are signed in). So:

- **`signInHere(controls, section)`** (`nswp-sdk/ui`, row id
  `sign-in-<section>`, names given 2026-11-25): a "Sign in, at …" row at the
  top of a tab, doing what You's row does in one press, and not there once
  signed in or where no signer is named. Achievements has it while
  something earned waits to be shown, Scores while a best waits to be
  posted. A world's own tab can add it.
- **A press that needs signing in, made signed out, starts the sign-in
  there and then,** as the front room's "Sign in to buy" does: Follow and
  following by key ("Sign in to follow people."), Write ("Sign in to write
  to people."), Show ("Sign in to show what you have earned."), Post ("Sign
  in to post a score."), and joining a room only for people who are signed
  in.
- **Bag, Following and Messages stay unshown for a guest:** no tabs holding
  only a Sign in row. The Bag becomes a guest's own when guest accounts land.
- **"It is under You" is gone** from every line.
- **What decides whether the row is wanted is one function**
  (`signInWanted` in `ui/identity.ts`), for guest accounts to change: a
  guest's row may become "Secure your account", or go.
- **The check** (`trials/sign-in-here.mjs`, and
  `packages/sdk/test/sign-in-here.test.ts`): signed out, every line that says
  to sign in is next to a press or is a press; one press of either opens the
  sign-in; nothing says "under You"; signed in, no Sign in row anywhere.
