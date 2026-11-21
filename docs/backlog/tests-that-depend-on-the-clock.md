# Tests that depend on how busy the machine is

- **Asked:** found by the orchestrator on 2026-11-21, a day when another
  session's long compile kept the machine's load near 30.
- **Who:** the NSWP builder.
- **State:** asked

With the machine busy, a gate failed on tests that had nothing to do with
the change being merged, and passed when run again. Each such failure costs
a run, and teaches people that a red gate may be ignored. Seen so far:

- `packages/sdk/test/relay-book.test.ts`, "says plainly when nothing took it
  anywhere": timed out at its 5 seconds.
- The same file, "takes what is sent when everything they chose is down: a
  relay two monitors found, never one found by one": expected 1, got 0.
- Two more in `packages/bridge/test/bridge.test.ts`, seen by BitPortal's
  session and not named. (One in that file, "answers a stranger once", was a
  real fault in the test and is fixed: `bridge-test-fails-when-busy.md`.)

## Done looks like

For each: find what in the test, or in the code it tests, is measured in
real time, and make the test say what it means without it (a clock the test
holds, a while the test sets, an answer awaited and not a pause). Where the
code really must finish in a time, the test says so and why. Then the whole
gate passes ten times running while another full gate is running beside it.

## Must not

Raise a time limit and call it fixed. Retry until green. Skip a test.
