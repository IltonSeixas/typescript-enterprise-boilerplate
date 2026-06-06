# ADR-0004: Use Fastify as the HTTP Framework

**Date:** 2024-01-01  
**Status:** Accepted

---

## Context

The TypeScript backend framework landscape includes Express, NestJS, Fastify, and Hono. Each has different performance, ergonomics, and coupling characteristics.

## Decision

**Fastify** with a plugin-based architecture.

## Consequences

**Positive:**
- Consistently the fastest Node.js HTTP framework in benchmarks — low overhead per request.
- Plugin system (`@fastify/` ecosystem) is well-maintained and covers all production concerns (CORS, helmet, rate-limit, JWT, cookie).
- Built-in Pino logger with request serialization.
- Schema-based request/response validation (JSON Schema natively; Zod via type-provider-zod).
- Does not couple the application to the framework — route handlers are thin adapters over use cases.

**Negative:**
- Plugin system has a registration order dependency that can be confusing initially.
- Slightly less opinionated than NestJS — requires explicit wiring of DI container.

## Alternatives Considered

- **NestJS** — excellent DI and module system, but decorators couple domain classes to the framework. Chosen against to keep the domain clean.
- **Express** — the default choice but no built-in validation, slower, and lacks a modern plugin ecosystem.
- **Hono** — excellent for edge runtimes; considered for future edge deployment variant.
