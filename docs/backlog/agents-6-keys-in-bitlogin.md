# Agents 6: provider keys kept in BitLogin, and spent without a world holding them

- **Asked:** 2026-11-23. The owner handed over a design pack ("NSWP Agent
  Platform, Modular Design Pack", 0.3 draft) and said of it: "This is not a
  priority. Id like for each to be added to the backlog."
- **State:** asked. Not a priority (the owner, 2026-11-23). Not briefed.
- **The whole of it:** `ai-keys-and-agents`. The pack is the owner's own, for
  the private repository `PR0M3TH3AN/nswp-agents` (to live there under
  `docs/plans/agent-platform/`; on 2026-11-23 it was only the file the owner
  handed over, `NSWP_Agents_Modular_Spec_Pack_v0.3 (1).zip`). This entry is a
  short account of one piece of it, not a copy.
- **In the pack:** M6, document 06.
- **Whose:** `bitlogin`.
- **Needs first:** agents-5-thinking-deciding-speaking; a security review of its own.

## What it is

A new profile in BitLogin's existing Connection Vault for AI providers, by
category: intelligence, System 1, voice, hearing, other. A screen to add,
rotate and remove them. A world asks for an operation and is granted it for
one site, one agent, some models, a time and a budget; it is never given the
key. The call is made where the world can't reach it: the sign-in address's
own page for a provider that takes calls from a browser, or a service somebody
runs for one that doesn't (a new host resource, the owner's word). A limit
shown on screen isn't called secure unless the provider enforces it too.

## Done looks like

A hostile world can't read or replay a key, widen its grant, swap in a dearer
model or spend past the budget; taking a grant back stops requests; the key is
in no note, log, link or message between pages.

