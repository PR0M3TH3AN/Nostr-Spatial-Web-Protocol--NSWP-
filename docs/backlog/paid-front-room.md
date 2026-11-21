# The paid world front room

- **Asked:** 2026-11-21, as the next thing to build for buying
  (`docs/plans/paying-for-things.md`, sections 6.1 and 7.1; decisions 1 to
  5, 33, 34, 39, 40). The owner started its builder from a written brief.
- **Who:** the NSWP builder.
- **State:** merged, as kit 0.73.0 (commits aebcc4e, 4f7551f, 6c0a747; pull request 236, main at 713c4d6; vendored into BitPortal at 7e7c2c4 and the template at bb31f4a). Not live, and no world is paid.

The first thing in the kit that asks a visitor to buy: a world says it is
paid and by which listing; a gate the world puts where it likes, with
everything before it free; open only on a receipt the kit believes. No
reference world becomes paid by it. The brief is the plan's own sections;
the builder reports to the orchestrator in stages.

**What was built.** `access` in a world's announcement and manifest
(NSWP-01, "A paid world"); a listing read and checked (NSWP-10, "A
listing"); the gate, the `soft` kind, and its one control (NSWP-10, "The
front room"); the Gallery able to have a gate and having none;
`trials/front-room.mjs`.

**The gate in the engine script and in Godot: built** (branch
`engine-gate`, after kit 0.73.0): `NSWP.gate()` and `Nswp.gate()`, the
example with a gate that is off, and `trials/front-room-godot.mjs`, walked
against the sandbox. A paid world made in another engine has the kit's own
gate, as the owner asked ("consistent for everyone").

**Left out on purpose, each a thing of its own:** the `sealed` gate (what
is behind it encrypted, the key coming with the purchase); a paid item
(`sold-by`, a locked item in the bag, a receipt beside a held item); the
mark on a door's plate and "You have this" (BitPortal's half); the walk
with BitLogin's own screen in place of the trial's stand-in.
