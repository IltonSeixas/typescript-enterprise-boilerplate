# ADR-0001: Adopt Clean Architecture with Hexagonal Ports & Adapters

**Date:** 2026-06-06  
**Status:** Accepted

---

## Context

TypeScript's flexibility makes it easy to write tightly coupled code where database models bleed into HTTP handlers and business logic is scattered across services. A boilerplate must demonstrate the discipline required to prevent this.

## Decision

The project adopts **Clean Architecture** in its Hexagonal / Ports & Adapters form, with four layers and a strict inward-only dependency rule:

1. **domain/** — entities, value objects, repository interfaces. Zero runtime imports.
2. **application/** — use cases, port interfaces. Imports domain only, plus data/utility packages (`zod` for DTO validation) and the `tsyringe`/`reflect-metadata` DI container — never an infrastructure or interfaces package.
3. **infrastructure/** — adapters (Drizzle ORM, Redis, Argon2). Implements application ports.
4. **interfaces/** — Fastify routes, gRPC services. Calls application use cases.

TypeScript's structural typing makes the port/adapter pattern natural: any class with the right method signatures satisfies an interface, with no decorator required. This dependency rule is enforced automatically by `eslint-plugin-boundaries`, configured in `eslint.config.js` and run as part of `bun run lint` — see [ADR-0006](0006-eslint-boundaries-architecture-test.md).

## Consequences

**Positive:**
- Use cases are testable with plain TypeScript mock objects — no framework needed in unit tests.
- Swapping infrastructure (e.g., replacing Drizzle with Prisma) requires touching only the adapter.
- TypeScript interfaces compile away — zero runtime cost for the port abstraction.
- The dependency rule is a linted, automatically-enforced check rather than a convention that erodes silently over time.

**Negative:**
- More files and indirection than a typical Express/NestJS flat structure.
- Requires tsyringe or manual DI wiring — adds setup complexity.

## Alternatives Considered

- **NestJS modules** — opinionated DI built in, but decorators couple the domain to the framework.
- **Flat service layer** — common but does not enforce domain isolation.
