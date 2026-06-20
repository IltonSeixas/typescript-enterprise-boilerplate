# Contributing

Contributions are welcome. Please read this document before opening a pull request.

---

## Prerequisites

- Bun 1.1+

---

## Development Workflow

```bash
# Install dependencies
bun install

# Type checking
bun run typecheck

# Lint
bun run lint

# Run unit tests
bun run test

# Run unit tests in watch mode
bun run test:watch

# Security audit
bun audit

# Run integration tests (in-memory adapters, no external deps)
bun run test:integration
```

All of the above run automatically in CI on every pull request. A PR will not be merged if any of these steps fail.

---

## Code Standards

### Architecture

- Never import infrastructure packages from `domain/` or `application/`
- This rule is enforced automatically by `eslint-plugin-boundaries`, configured in `eslint.config.js` — see [ADR-0006](adr/0006-eslint-boundaries-architecture-test.md). A PR that violates it fails `bun run lint`
- Every new use case must have a corresponding `.spec.ts` file
- Every new value object must validate its invariants in the constructor and have tests for both valid and invalid inputs
- No generic `BaseService`, `Manager`, or catch-all `Service` class. Each use case is its own class with a single `execute` method and an explicit, narrow set of injected dependencies — never a god class that accumulates every repository and port in the application

### Style

- TypeScript strict mode is enforced — no `any`, no `as unknown as X` escape hatches
- `eslint` runs in CI — lint before committing
- No comments that explain *what* the code does — only *why* when non-obvious
- Prefer `const` over `let`; never `var`

### Tests

- New behavior requires a test written first (TDD)
- Mock repositories as plain TypeScript objects implementing the port interface — no mocking framework needed for simple cases
- Integration tests must drive real adapters end to end (e.g. boot the gRPC server against in-memory repositories) and clean up via `afterAll`

---

## Pull Request Guidelines

1. Fork the repository and create a branch from `main`
2. Branch naming: `feat/short-description`, `fix/short-description`, `docs/short-description`
3. Keep each PR focused on a single concern
4. Include tests for every behavior change
5. Update relevant documentation in `docs/` if the change affects it
6. Ensure CI passes before requesting review

---

## Commit Convention

```
feat: add password reset use case
fix: correct argon2 parameter configuration
docs: update security configuration reference
refactor: extract email validation into value object
test: add integration test for login flow
chore: update dependencies
```

---

## Reporting Security Vulnerabilities

Do **not** open a public GitHub issue for security vulnerabilities.

Send a private disclosure to [contact@iltonseixas.com](mailto:contact@iltonseixas.com) with:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 72 hours.

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
