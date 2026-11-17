# AGENTS

- Canonical design: `spec.md`. Keep it, `schemas/`, `vectors/` and `@nswp/core` in agreement.
- Before finishing a change: `npm test`, `npm run vectors:check`, `npm run typecheck`, `npm run build`.
- Vectors are generated: edit `scripts/generate-vectors.ts` (hand-written expectations), then `npm run vectors`. The generator refuses to write if core disagrees.
- Schemas must never reject input that `@nswp/core` accepts (warnings included); `packages/core/test/schemas.test.ts` enforces it.
- Issue codes are lowercase snake_case and stable (BitBlocks convention D4). Unknown values are warnings, not errors.
- Never commit keys. The reference publisher key is at `~/.config/nswp/reference-publisher.key`. Test vector keys are deliberately public and must never appear in a real manifest.
- Publishing events to public relays and deploying the sites are outward-facing: the repo owner approves each.
- Part I of the spec must not depend on BitBlocks (spec §1.3).
