# A Bridge test that fails when the machine is busy

- **Asked:** found on 2026-11-21. It failed for the BitPortal session once,
  and once for the orchestrator, who then merged a documents-only change on
  the failed gate by a slip (pull request 233; `main` was run again
  afterwards and passed).
- **Who:** the NSWP builder.
- **State:** merged (by the orchestrator, since it was stopping every merge while the machine was busy)

`packages/bridge/test/bridge.test.ts`, "answers a stranger once, however
many times they ask": expected 1, got 2, with the machine's load above 30.
It passes when the machine is quiet. A test that depends on how busy the
machine is will keep failing gates that have nothing to do with it, and
people learn to ignore a red gate, which is the worse harm.

## Done looks like

The test decides by what happened, not by how long it took: no fixed wait
that a slow machine can outlast. Run twenty times in a row with the machine
loaded (several other gates running), it passes every time. Whatever it was
protecting is still protected: seen to fail when the Bridge is made to
answer twice.

## Must not

Be skipped, retried until green, or given a longer timeout and called
fixed.

## What was done

The Bridge answers a stranger once in a while, a second by default, and the
test sent six requests and counted one reply. A machine busy enough to take
more than a second over six requests got a second reply, which was the
Bridge doing right and the test asking the wrong thing. The test now sets
the while to ten minutes, so it asks what it means: six requests inside one
while get one reply. A second test sets it to nothing and sees every request
answered, so the rule is held from both sides. No wait was lengthened and
nothing is retried. Other Bridge tests have also failed under load for
another session; they are not touched here and stay to be looked at.
