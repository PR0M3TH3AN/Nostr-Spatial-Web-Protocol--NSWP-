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
- **State:** briefed

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

## Done looks like

Seen at a desk, on a phone and in the made-up headset, in every look the
site has. One press reaches the room. Nothing on it is false on the day it
ships. It reads as the same thing as the room: its type, colours and words.

## Must not

Add a sign-in form, a key field or anything that holds a session. Keep a
visitor reading when they came to go in. Promise a date.
