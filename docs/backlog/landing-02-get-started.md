# A getting-started page for builders, written for agents

- **Asked:** the owner, 2026-11-21, sending an older note with the words "This was writen before some of these features were in place so go based on the current state of the code". Their words: "Set up some friendly info one a page (not
  the landing) on how to get started. Assume mostly agents will be reading
  it. 3JS and Gdot are supported. stuff like this."
- **Who:** BitPortal's session for the page; the words come from the kit.
- **State:** briefed

## The kit's half

How to build a world is the kit's to say, once: `docs/add-your-site.md`,
`docs/integrating.md`, `docs/other-engines.md`, the world template and the
protocol. The page must not become a second, drifting copy. So the kit
gains one short document that is the starting point for someone, or some
agent, who has never seen any of this: what a world is, the three ways in
(the template for Three.js, the addon for Godot, the protocol for anything
else), how a world announces itself, how it is checked, and where each next
thing is written. Plain text an agent can fetch and follow, with exact
commands and addresses. Written in the NSWP repository and built into the
page.

## The client's half

A page of BitPortal's, not the landing, that shows that document well for a
person and serves it as plain text at a steady address for an agent (and
says at its top where the plain text is). Linked from the landing page.

## Done looks like

An agent given only the page's address can make a world from the template,
run it locally and say how it would announce it, with no other help: tried
by handing exactly that to a fresh session and watching where it gets
stuck. Every command in it has been run.

## Must not

Tell anyone to publish to public relays or deploy as a step to copy without
saying what it does. Put a key in an example.
