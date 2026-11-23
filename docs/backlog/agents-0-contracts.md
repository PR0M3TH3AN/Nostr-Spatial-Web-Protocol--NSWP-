# Agents 0: the words and the boundaries, before anything is built

- **Asked:** 2026-11-23. The owner handed over a design pack ("NSWP Agent
  Platform, Modular Design Pack", 0.3 draft) and said of it: "This is not a
  priority. Id like for each to be added to the backlog."
- **State:** asked. Not a priority (the owner, 2026-11-23). Not briefed.
- **The whole of it:** `ai-keys-and-agents`. The pack is the owner's own, for
  the private repository `PR0M3TH3AN/nswp-agents` (kept there under
  `docs/plans/agent-platform/` by the session that has that repository, since
  2026-11-23). This entry is a
  short account of one piece of it, not a copy.
- **In the pack:** M0, the pack's document 00.
- **Whose:** `nswp-agents`.
- **Needs first:** nothing.

## What it is

An agent's identity, its placement in a world, its running instance, its
history and who has authority over each are written as separate types that
can't be mistaken for one another. What a world may tell an agent and what an
agent may ask of a world are fixed as bounded, typed things. Stand-in worlds,
decision makers and voices exist for tests.

## Done looks like

The types check; a test shows the ids can't be mixed; the existing companion
still builds and restores its saved state. No new note kinds and no BitLogin
change.

