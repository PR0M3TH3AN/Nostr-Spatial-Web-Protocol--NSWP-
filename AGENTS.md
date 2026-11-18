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
