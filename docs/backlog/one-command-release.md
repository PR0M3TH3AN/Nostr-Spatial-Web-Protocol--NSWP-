# Everything of a release up to the deploy, in one command

- **Asked:** 2026-11-23. The orchestrator proposed it ("each release today
  is a chain I run by hand: cut the version, copy it into BitPortal, copy it
  into the template, update two checkouts, deploy. A script could do
  everything up to the deploy, leaving that as your word"); the owner: "yes
  do 4 and 5 as well. That is awesome."
- **Who:** not briefed. NSWP's scripts (`scripts/`), beside `release-all.mjs`.
- **State:** asked. Second in the order, after the client's menu design.

## What it does

`npm run release:prepare` (`scripts/release-prepare.mjs`; names given
2026-11-23), run from a clean NSWP worktree on the current `main`:

1. Takes the next kit number (given as an argument, or the next patch or
   minor) and makes the version pull request as fleet rule 11 says: the
   `## Next` heading becomes the number, `KIT_VERSION`, `npm run build`, the
   engine script rebuilt. Runs the full gate, opens the pull request, waits
   for GitHub to show that commit mergeable, merges, reads it back merged.
2. Builds NSWP's main folder at that merge.
3. BitPortal: `npm run vendor -- --only nswp` on a branch from its `main`,
   its gate, a pull request, merged the same way.
4. The world template: `npm run vendor` and `npm run check` on a branch,
   failing if the output says "differs from the template" (never
   `--lock-plumbing`), a pull request, merged the same way.
5. Brings the two main folders the deploy reads (`../bitportal`,
   `../nswp-world-template`) up to date by fast-forward, only where each is
   on `main` and clean; otherwise it stops and says which isn't.
6. Ends by saying what `npm run release:all` would now deploy, and stops.

## What it never does

- **Deploy, or publish anything to relays.** Going live is the owner's word
  each time (fleet rule 6); `release:all -- --go` stays a separate command.
- Go on after a step that didn't exit 0. Every step is tested by its exit
  code, never through a pipe (`release-all.mjs`'s header says why).
- Merge a commit other than the one it gated.
- Touch a checkout that isn't on `main` and clean, or switch any branch in
  another session's folder. It works in worktrees of its own.
- Sign anything or read a key.

## Done looks like

- A rehearsal mode (`--dry-run`) that does every step it can without
  pushing, and prints the rest.
- A test that runs it where it can push and merge nothing (stand-in `git`
  and `gh`), and holds it to stopping at the first failing step with a
  non-zero exit.
- One real release made with it, then the deploy on the owner's word.
