# ADR-0006: Enforce the Layering Rule with ESLint Boundaries

**Date:** 2026-06-19
**Status:** Accepted

---

## Context

[ADR-0001](0001-clean-architecture.md) defines a strict inward-only dependency rule between `domain/`, `application/`, `infrastructure/`, and `interfaces/`. Until now this rule was enforced only by code review — nothing failed the build if a future change imported, say, an Argon2 adapter into `application/`. Conventions enforced only by review erode the first time someone is in a hurry or unfamiliar with the codebase.

Auditing the existing code while writing this rule found that `application/` already depends on `zod` (DTO validation) and `tsyringe`/`reflect-metadata` (the DI container used to wire use cases). Neither couples a use case to a specific infrastructure choice — `zod` validates plain data, and `tsyringe` is a constructor-injection container, not a transport or persistence concern. `domain/` has no external imports at all. ADR-0001's "Zero runtime imports" line for `domain/` already matched reality; only `application/`'s line needed the same data/DI-vs-infrastructure distinction already drawn for `domain/` in the other three boilerplates.

## Decision

Add `eslint-plugin-boundaries` to `eslint.config.js`, configured with one element per Clean Architecture layer (`domain`, `application`, `infrastructure`, `interfaces`) matched by folder under `src/`. The `boundaries/dependencies` rule then disallows:

- `domain/` importing from `application/`, `infrastructure/`, or `interfaces/`
- `application/` importing from `infrastructure/` or `interfaces/`

It runs as part of the existing `bun run lint` step, already wired into CI — no new CI job.

Resolving `.js`-suffixed import specifiers (required by `NodeNext` module resolution) back to their `.ts` source files needs `eslint-import-resolver-typescript`, configured via the `import/resolver` setting; without it, every import resolves to an unknown element and the rule silently does nothing.

The plugin enforces module-to-module direction, not package-level bans, so it does not need — and does not maintain — an explicit allow-list of "data/utility" npm packages the way the Rust and Go tests do. `zod` and `tsyringe` are simply imports from `node_modules`, external to all four elements; the rule only fires on imports that resolve to one of the four `src/` layers.

## Consequences

**Positive:**

- A pull request that violates the layering rule fails `bun run lint`, which already gates CI, instead of relying on a reviewer noticing an import.
- No new CI step — the rule lives inside the linter contributors already run before pushing.
- Layer membership is derived from the real module graph (via the TypeScript resolver), not text matching — it correctly follows re-exports and barrel files.

**Negative:**

- Depends on `eslint-import-resolver-typescript` correctly resolving every import; a resolver misconfiguration (e.g. a `tsconfig.eslint.json` path mismatch) silently turns every cross-layer import into "unknown" and the rule stops catching anything, with no error raised.
- `eslint-plugin-boundaries` is one more devDependency to keep current as its v6 schema (`boundaries/dependencies` instead of the deprecated `boundaries/element-types`) continues to evolve.

## Alternatives Considered

- **Keep enforcing via code review only** — what ADR-0001 originally relied on; offers no build-time signal.
- **`dependency-cruiser`** — a dedicated, more powerful tool for this exact problem, but it is a separate CLI with its own config file and CI step; `eslint-plugin-boundaries` reuses the linter and CI step the project already has, for a lower-ceremony equivalent rule.
- **Custom script walking the TypeScript compiler API** — most precise, but a significant maintenance burden compared to a one-file ESLint config change.
