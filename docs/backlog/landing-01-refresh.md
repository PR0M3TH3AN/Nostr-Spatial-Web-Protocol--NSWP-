# The landing page, made new

- **Asked:** the owner, 2026-11-21, sending an older note with the words "This was writen before some of these features were in place so go based on the current state of the code". Their words: "refresh the landing page and remove all the
  unnecessary doors. Explain that a world can be a game, app, experience.
  anything. And nostr now has a cyberspace. Available on mobile, desktop and
  VR. Easy to build a portal, broadcast it and connect it to the network.
  ... try it out today. Also mention that a bitportal browser is in
  development for even better and more seamless experience. This should be
  at like the bottom. really make the site cool looking and consistent with
  our current features. ... dont put all this on the landing page. It should
  be inviting and try to get the user into the game/vr experience first. ...
  keeping users on the landing is not necessary."
- **Who:** BitPortal's session. The client's alone: no kit half.
- **State:** merged (BitPortal pull requests 164, the lobby at `/doors/`, and 166, the new landing page, its main at 2151dc7; each gated at exit 0). Not live. Until landing-02 exists, "Make a world of your own" points at the template's repository.

## What it is

BitPortal's first page (`src/lobby/`, the page at `/`). Its one job is to
get a visitor into the room: one clear way in, on a phone, at a desk and in
a headset. Around that, few words: a world can be a game, an app, an
experience, anything; Nostr now has a cyberspace; it runs on phones, desks
and VR; making a world and connecting it is easy, with a link to the
getting-started page ([landing-02](landing-02-get-started.md)). At the
bottom: a browser of our own is being built for a more seamless visit.
The doors it draws today that serve no purpose there go.

## What it says is true today

Their note called tips, saves, achievements and an inventory "coming soon".
They are built now (NSWP-12, 15, 16, 17; tips since kit 0.69). The page
says what a visitor can do today, and names as coming only what is: paying
to enter a world or for an item, shares, boards across worlds. Check each
claim against the code the day it is written, not against this file.

## Which doors go (2026-11-21: the orchestrator's decision as design, told to the owner, theirs to overturn)

The page at `/` is two things today: the hero (the room drawn live, the
way in) and, under it, the lobby (every door as a list, search, hashtags,
lists, Settings, the operator's list). The owner's words: "remove all the
unnecessary doors" and "keeping users on the landing is not necessary".

Chosen: the landing page becomes the way in and a few words, and the
lobby moves to a page of its own. Held to:

- Nothing changes about what is shown or allowed, only where: every way
  to a world still asks `catalog.permits`.
- Nothing a person kept breaks: an old link to `/#…` lands on the same
  thing at the new address, and the room's "front page" control leads to
  the page that now has settings and announcing.
- BitPortal's `AGENTS.md` rules that name "the front page" are rewritten
  to name the right page in the same pull request; each rule kept.
- "Sign in", "Your doors" and "Your look" stay reachable from the landing
  page.
- The new page's address is asked for before it is used.
- Two pull requests if cleaner: the move (no change in looks), then the
  new landing page.
- Until landing-02 exists, the getting-started link points at the
  template's repository.

## Done looks like

Seen at a desk, on a phone and in the made-up headset, in every look the
site has. One press reaches the room. Nothing on it is false on the day it
ships. It reads as the same thing as the room: its type, colours and words.

## Must not

Add a sign-in form, a key field or anything that holds a session. Keep a
visitor reading when they came to go in. Promise a date.
