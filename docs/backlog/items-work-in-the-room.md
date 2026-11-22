# Items do what they do in BitPortal's room

- **Asked:** 2026-11-21. The owner, holding the dart blaster in the room on
  the live site: "for some reason the items like the dart gun dont work in
  the portal world", and after the deploy: "and i still cant shoot the dart
  gun in this main portal room." Asked "Let items like the dart blaster work
  in BitPortal's room, not just be held there?", they answered with the
  second message; the orchestrator read it as yes and said so.
- **Who:** BitPortal.
- **State:** building

The room drew what a visitor holds but ran none of an item's own logic: that
runs only in the kit's locked box, a page the room was not allowed to frame.
BitPortal now frames its own copy of that box (`frame-src 'self'`, nothing
else added), under exactly the kit's rules, as every world does. The Bag's
words ("Items work here") were wrong meanwhile, and are fixed with it.
