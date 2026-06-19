# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial project structure: Clean Architecture + DDD layers
- In-memory user repository adapter (zero-config default)
- Argon2id password hashing via `argon2` npm package
- JWT HS256 access token (returned in the response body, with a `jti` claim) + opaque UUID refresh token, rotated and stored server-side in Redis, delivered as an HttpOnly/Secure/SameSite=Strict cookie scoped to `/api/v1/auth`
- Fastify HTTP server with security plugins (`@fastify/rate-limit`, `@fastify/helmet`, `@fastify/cors`, `@fastify/cookie`)
- gRPC server with `@grpc/grpc-js`, mirroring the REST auth and user endpoints
- OpenTelemetry distributed tracing via OTLP, structured logs via Pino
- Prometheus metrics endpoint (`/metrics`) via `prom-client`, with health and readiness checks (`/health`, `/ready`)
- PostgreSQL adapter via Drizzle ORM (implemented against the `UserRepository` port, not yet wired into the composition root)
- Docker multi-stage image (Bun-based) and docker-compose stack
- GitHub Actions CI (typecheck, lint, test, bun audit), Docker, and Release workflows
- Architecture documentation, ADRs, security policy
- `JWT_ACCESS_TTL` and `JWT_REFRESH_TTL` environment variables to configure token lifetimes

### Fixed
- Moderate `protobufjs` vulnerability (GHSA-f38q-mgvj-vph7) via a transitive dependency override

[Unreleased]: https://github.com/IltonSeixas/typescript-enterprise-boilerplate/compare/HEAD
