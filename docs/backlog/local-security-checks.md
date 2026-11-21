# The scans a hosted check used to run, run here

- **Asked:** raised by BitUnlock's session on 2026-11-21, after the owner
  decided checks are local ("We should do the CI tests local. I have no
  github credits and im not paying for that"). Its hosted checks had also
  been the only thing looking for a committed secret or a dependency with a
  known fault, and nothing was once they stopped. It built a local command
  for its own repository the same day.
- **Who:** the NSWP builder for this repository and the template; BitPortal's
  session for BitPortal.
- **State:** asked

`npm run gate` here runs the build, the types and the tests. Nothing looks
for a key committed by mistake (an `nsec`, a wallet connection string, a
private-key block), or for a dependency with a known fault. The rules in
`AGENTS.md` say never to commit a key; nothing checks.

## Done looks like

A step in each repository's gate that fails on a committed secret of the
kinds this project uses, seen to fail on one planted for the test, and that
checks dependencies for known faults at a level that means something. It
never prints what it found. BitUnlock's `scripts/security-check.mjs` is
written to be copied; start from it.

## Must not

Send anything about the repository to a service. Make the gate slow enough
that people stop running it.
