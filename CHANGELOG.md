# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial project structure: Clean Architecture + DDD layers
- In-memory user repository adapter (zero-config default)
- Argon2id password hashing via `argon2` npm package
- JWT HS256 access token + opaque refresh token with Redis rotation
- Fastify HTTP server with security plugins (rate-limit, helmet, cors)
- gRPC server with `@grpc/grpc-js`
- OpenTelemetry tracing, Prometheus metrics via `prom-client`, structured JSON logs via Pino
- PostgreSQL adapter via Drizzle ORM
- Zod-validated configuration at startup
- Docker multi-stage image (Bun-based) and docker-compose stack
- GitHub Actions CI (typecheck, lint, test, bun audit), Docker, and Release workflows
- Architecture documentation, ADRs, security policy

[Unreleased]: https://github.com/IltonSeixas/typescript-enterprise-boilerplate/compare/HEAD
