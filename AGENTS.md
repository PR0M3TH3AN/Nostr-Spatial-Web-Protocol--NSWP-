# AGENTS

- The protocol is `protocol/`: one short document per part. A change to a format touches four things together, or it isn't done: its document there, its schema, its vectors, and `@nswp/core`. `packages/core/test/docs.test.ts` checks the documents against the library.
- `spec.md` is the full design and the reasoning. Its section numbers (§) are cited from code in three repos, so never renumber it. What changed goes in `CHANGELOG.md`, newest first, not in the spec.
- Anything two implementations must agree on to work together belongs in `protocol/`, not only in code. If you add a message, a tag or a field, write it down there in the same change.
- Before finishing a change: `npm test`, `npm run vectors:check`, `npm run typecheck`, `npm run build`.
- Vectors are generated: edit `scripts/generate-vectors.ts` (hand-written expectations), then `npm run vectors`. The generator refuses to write if core disagrees.
- Schemas must never reject input that `@nswp/core` accepts (warnings included); `packages/core/test/schemas.test.ts` enforces it.
- Issue codes are lowercase snake_case and stable (BitBlocks convention D4). Unknown values are warnings, not errors.
- Never commit keys. The reference publisher key is at `~/.config/nswp/reference-publisher.key`. Test vector keys are deliberately public and must never appear in a real manifest.
- Publishing events to public relays and deploying the sites are outward-facing: the repo owner approves each.
- Part I of the spec must not depend on BitBlocks (spec §1.3).
- **The Bridge (`browser/bridge.md`, `packages/bridge`, `packages/core/src/bridge.ts`, `nswp-sdk/terminal`) runs commands on a person's computer.** Its document, its schema, its vectors and the code change together. Never without the owner's decision: make it answer more than one key, skip or pre-answer the question at the computer, lengthen a grant, let a grant and a pass share a kind or be accepted for each other, accept a grant twice, reply to strangers more often, or let a world reach any of it. Test it with throwaway keys and a relay on this machine only (`packages/bridge/test/relay.ts`); never run it against a real identity or a public relay from automation, and never give a test a config folder that isn't a temporary one (`--dir`).
- **Speech (`packages/sdk/src/speech.ts`, `packages/bridge/src/ears.ts`):** what a visitor says is turned into text on their own computer, or by their own browser after they have been told where the sound may go. Never send sound to a service of ours or anyone's, never keep it past the moment it is used, never skip the telling, and never let spoken words press Enter or any other key: they are typed as one line and the visitor decides.
- `browser/spec.md` is a plan for a browser, not part of the protocol. A world must never need that browser: nothing in `protocol/` may depend on it, and no announcement field is added for it until one exists to read it.
