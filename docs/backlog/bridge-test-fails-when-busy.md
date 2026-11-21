# A Bridge test that fails when the machine is busy

- **Asked:** found on 2026-11-21. It failed for the BitPortal session once,
  and once for the orchestrator, who then merged a documents-only change on
  the failed gate by a slip (pull request 233; `main` was run again
  afterwards and passed).
- **Who:** the NSWP builder.
- **State:** asked

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
