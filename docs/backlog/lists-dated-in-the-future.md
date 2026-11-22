# A list of worlds dated in the future

- **Asked:** 2026-11-21, found by the BitGate session while reading NSWP-08
  lists (not the owner's words; written down so it isn't lost).
- **Who:** the NSWP builder (the kit's `list.ts` and NSWP-08), after
  worlds by invitation's stage 1.
- **State:** building. Built on the NSWP builder's branch `lists-future`, not merged: NSWP-08 "Following one" says it, `resolveList` in `list.ts` does it, and `vectors/lists.json` `choosing` has the cases

A NIP-51 list of worlds (kind 30004) is replaceable: the newest copy
wins. NSWP-08 says nothing about a copy dated in the future, so one signed
with a clock a year ahead would stand until then, and an honest newer copy
couldn't replace it.

BitGate's scoped lists already answer this (a copy more than 600 seconds
ahead of the reader's clock is dropped before choosing, and the reader
says it saw one). The same rule, written in NSWP-08 and `list.ts` with
vectors, and BitGate's 30004 reader then follows NSWP-08.

## Done looks like

NSWP-08 says it; `list.ts` does it; `vectors/lists.json` has the cases
(exactly 600 seconds ahead read, 601 dropped, a future copy beside a
current one leaves the current standing); BitGate is told the commit.
