# The room's computers say "Sign in on the front page"

- **Asked:** 2026-11-21, found by the BitPortal session while moving the
  lobby (not the owner's words; written down so it isn't lost).
- **Who:** BitPortal.
- **State:** asked

`src/walk/computers.ts` still tells people to "Sign in on the front page"
and links `/`. Signing in is done in the room now (the owner: sign-in is
one menu row everywhere), and `/` is about to become the new landing page.

## Done looks like

The computers' words say where signing in really is (the room's own menu
row), and link nothing that leaves the room.
