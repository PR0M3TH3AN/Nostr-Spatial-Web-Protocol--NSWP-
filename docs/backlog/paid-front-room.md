# The paid world front room

- **Asked:** 2026-11-21, as the next thing to build for buying
  (`docs/plans/paying-for-things.md`, sections 6.1 and 7.1; decisions 1 to
  5, 33, 34, 39, 40). The owner started its builder from a written brief.
- **Who:** the NSWP builder.
- **State:** merged, as kit 0.71.0 (commits aebcc4e, 4f7551f, 6c0a747). Not live, and no world is paid.

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

**Owed next: the gate in the engine script and in Godot.** The owner,
2026-11-21: "The most important part is the kit we ship to all users and
builders. And our framework. So that its consistent for everyone." Until
it is there, a paid world made in another engine has no gate of the
kit's, and would have to build its own: a second-class paid world, which
is the thing not wanted. The logic (`front-room.ts`) draws nothing and
needs no change; what is owed is its calls through `engine.ts` and the
add-on, and the control in the engine's menu.

**Left out on purpose, each a thing of its own:** the `sealed` gate (what
is behind it encrypted, the key coming with the purchase); a paid item
(`sold-by`, a locked item in the bag, a receipt beside a held item); the
mark on a door's plate and "You have this" (BitPortal's half); the walk
with BitLogin's own screen in place of the trial's stand-in.
