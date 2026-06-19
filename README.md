# typescript-enterprise-boilerplate

[![CI](https://github.com/IltonSeixas/typescript-enterprise-boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/IltonSeixas/typescript-enterprise-boilerplate/actions/workflows/ci.yml)
[![Docker](https://github.com/IltonSeixas/typescript-enterprise-boilerplate/actions/workflows/docker.yml/badge.svg)](https://github.com/IltonSeixas/typescript-enterprise-boilerplate/actions/workflows/docker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Production-ready enterprise backend boilerplate in **TypeScript** — built on Clean Architecture, Domain-Driven Design, and Test-Driven Development. Runs immediately with an in-memory adapter; plug in PostgreSQL when ready for production.

---

## Philosophy

TypeScript's type system is the first line of defense. This boilerplate uses it deliberately: Value Objects that cannot be constructed in an invalid state, use cases that are typed end-to-end, and repository interfaces that compile away any coupling between domain logic and infrastructure. The domain layer has no framework imports.

---

## Architecture

```
src/
├── domain/               # Enterprise business rules — zero runtime deps
│   ├── entities/         # Aggregates and Entities
│   ├── value-objects/    # Immutable, self-validating values
│   ├── repositories/     # Port interfaces (TypeScript interfaces)
│   └── errors/           # Domain error classes
│
├── application/          # Use cases — depends only on domain
│   ├── use-cases/        # One class per use case
│   ├── ports/            # Input/output port interfaces
│   └── dtos/             # Zod-validated DTOs
│
├── infrastructure/       # Adapters — implements domain interfaces
│   ├── persistence/
│   │   ├── in-memory/    # Default: zero-config, runs immediately
│   │   └── postgres/     # Production: Drizzle ORM + PostgreSQL
│   ├── security/         # Argon2id password hashing
│   ├── cache/            # Redis adapter (ioredis)
│   └── telemetry/        # OpenTelemetry setup
│
├── interfaces/           # Entry points
│   ├── http/             # Fastify routes, plugins, middleware
│   └── grpc/             # @grpc/grpc-js service implementations
│
└── main.ts               # Wiring: build container, start server
```

### Dependency rule

```
interfaces/ → application/ → domain/
infrastructure/ → application/ → domain/
```

`domain/` and `application/` never import from `infrastructure/` or `interfaces/`.

---

## Stack

| Concern | Library |
|---|---|
| HTTP framework | `fastify` |
| Schema validation | `zod` |
| gRPC | `@grpc/grpc-js` + `@grpc/proto-loader` |
| Database (production) | `drizzle-orm` + `postgres` |
| Password hashing | `argon2` (native bindings) |
| JWT | `jose` |
| Observability | `@opentelemetry/sdk-node` |
| Structured logging | `pino` (built into Fastify) |
| DI container | `tsyringe` |
| Testing | `bun:test` (built-in test runner) |
| Linting | `eslint` + `@typescript-eslint` |
| Runtime | `Bun` |

---

## Getting Started

### Prerequisites

- Bun 1.3+
- Optional for production: PostgreSQL 15+, Redis 7+

### Run immediately (in-memory, zero database)

```bash
git clone https://github.com/your-org/typescript-enterprise-boilerplate
cd typescript-enterprise-boilerplate

cp .env.example .env
openssl genpkey -algorithm ed25519 -out jwt_private.pem
openssl pkey -in jwt_private.pem -pubout -out jwt_public.pem

bun install && bun run dev
```

The server starts on `http://localhost:3000`. No database required.

### Persistence adapter

`main.ts` wires `UserRepository` to the in-memory implementation by default. Setting `DATABASE_URL` switches the composition root to `PostgresUserRepository` (`src/infrastructure/persistence/postgres/`), running pending migrations from `migrations/` via `drizzle-orm/postgres-js/migrator` on startup. Schema changes are managed with `drizzle-kit` (`bunx drizzle-kit generate`).

---

## Security

### Password Hashing — Argon2id

Passwords are hashed with **Argon2id** via the `argon2` package, which uses native bindings to the reference C implementation. bcrypt is not used.

Parameters follow OWASP recommendations:
- Memory: 65536 KB (64 MB)
- Iterations: 3
- Parallelism: 4

The `PasswordHasher` interface in `domain/repositories/` abstracts the algorithm — use cases never call crypto directly.

### Authentication Flow

- **Access token**: JWT EdDSA (Ed25519), TTL 15 min, validated by Fastify JWT plugin
- **Refresh token**: opaque UUID (crypto.randomUUID), stored in Redis with TTL 7 days, rotated on every use, delivered via HttpOnly cookie
- **Revocation**: delete the Redis key to immediately invalidate the session

### Security (Fastify plugins, applied globally)

- Rate limiting: `@fastify/rate-limit` with sliding window per IP
- Security headers: `@fastify/helmet` (CSP, HSTS, X-Frame-Options, etc.)
- CORS: `@fastify/cors` with explicit allow-list, never `*` in production
- Input validation: Zod on every route — invalid input returns 400 before reaching the use case

---

## API

### REST — `http://localhost:3000`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register a new user |
| `POST` | `/api/v1/auth/login` | Authenticate, receive tokens |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token |
| `GET` | `/api/v1/users/me` | Get authenticated user profile |
| `PUT` | `/api/v1/users/me` | Update authenticated user profile |
| `PUT` | `/api/v1/users/me/password` | Change authenticated user password |
| `GET` | `/api/v1/users/:id` | Get a user by id |
| `PUT` | `/api/v1/users/:id/role` | Change a user's role (owner only, cannot change own role) |
| `GET` | `/health` | Liveness check |
| `GET` | `/ready` | Readiness check (Redis, Postgres if configured) |
| `GET` | `/metrics` | Prometheus metrics |

### gRPC — `localhost:50051`

Proto definitions live in `proto/boilerplate/v1/boilerplate.proto` and are loaded dynamically at
runtime via `@grpc/proto-loader` — no code generation step required. The gRPC server runs
alongside the REST API in the same process and reuses the exact same use cases, so business rules
never diverge between transports.

| Service | RPC | Mirrors REST endpoint |
|---|---|---|
| `AuthService` | `Register` | `POST /api/v1/auth/register` |
| `AuthService` | `Login` | `POST /api/v1/auth/login` |
| `AuthService` | `RefreshToken` | `POST /api/v1/auth/refresh` |
| `AuthService` | `Logout` | `POST /api/v1/auth/logout` |
| `UserService` | `GetMe` | `GET /api/v1/users/me` |
| `UserService` | `UpdateProfile` | `PUT /api/v1/users/me` |
| `UserService` | `ChangePassword` | `PUT /api/v1/users/me/password` |
| `UserService` | `ChangeRole` | `PUT /api/v1/users/:id/role` |

`UserService` RPCs require an `authorization: Bearer <access_token>` request metadata entry,
validated by the same active-account check used by the REST authentication plugin. Since gRPC has
no cookie mechanism, `Login` and `RefreshToken` return the refresh token in the response body
instead of a `Set-Cookie` header — clients are responsible for storing it securely. Domain and
application errors are translated to standard gRPC status codes (e.g. `NOT_FOUND`,
`ALREADY_EXISTS`, `UNAUTHENTICATED`, `PERMISSION_DENIED`) by a dedicated error mapper.

---

## Testing

```bash
bun run test              # unit tests (no external deps, uses in-memory adapter)
bun run test:coverage     # coverage report
bun run test:integration  # integration tests (in-memory adapters, no external deps)
```

### Structure

- **Unit tests**: co-located as `*.spec.ts`. Domain entities, value objects, and use cases tested in complete isolation. Repository mocks are TypeScript classes implementing the port interface — no mocking library needed.
- **Integration tests**: `src/**/*.integration.spec.ts`. Exercise the gRPC server end to end against in-memory adapters, using `bun:test` as the runner.

### TDD Approach

Start from the use case interface. Write a test that constructs the use case with mock repositories, calls the input port, and asserts on the output port. The compile-time check that the mock satisfies the interface eliminates an entire class of bugs before the test runs.

---

## Observability

- **Traces**: OpenTelemetry auto-instrumentation covers Fastify and outgoing HTTP; use cases emit custom spans
- **Metrics**: Prometheus metrics at `/metrics` via `prom-client`
- **Logs**: structured JSON via Pino, correlated with trace IDs

```env
OTLP_ENDPOINT=http://localhost:4317
```

---

## Configuration

All configuration via environment variables, validated with Zod at startup (invalid config fails fast).

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, ...) |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3000` | HTTP port |
| `GRPC_PORT` | `50051` | gRPC port |
| `JWT_PRIVATE_KEY_PATH` | — | Path to the Ed25519 PEM private key used to sign access tokens — required, fails fast if missing |
| `JWT_PUBLIC_KEY_PATH` | — | Path to the Ed25519 PEM public key used to verify access tokens — required, fails fast if missing |
| `JWT_ACCESS_TTL` | `900` | Access token TTL in seconds |
| `JWT_REFRESH_TTL` | `604800` | Refresh token TTL in seconds |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string (refresh token storage) |
| `ALLOWED_ORIGINS` | — | Comma-separated CORS allow-list — empty disables cross-origin requests entirely |
| `OTLP_ENDPOINT` | `http://localhost:4317` | OTLP gRPC endpoint for traces |

The global rate limit (100 requests per 60-second window per IP, via `@fastify/rate-limit`) is currently fixed in the composition root (`src/main.ts`) rather than environment-driven — adjust it there if your deployment needs different values.

---

## Docker

```bash
# Multi-stage build — Bun Alpine final image
docker build -t typescript-enterprise-boilerplate .

docker run -p 3000:3000 -p 50051:50051 --env-file .env \
  -v "$(pwd)/jwt_private.pem:/app/jwt_private.pem:ro" \
  -v "$(pwd)/jwt_public.pem:/app/jwt_public.pem:ro" \
  typescript-enterprise-boilerplate
```

```bash
# Full stack: app + postgres + redis + jaeger
# Requires jwt_private.pem/jwt_public.pem in the repo root — see Configuration above
openssl genpkey -algorithm ed25519 -out jwt_private.pem
openssl pkey -in jwt_private.pem -pubout -out jwt_public.pem
docker compose up
```

---

## CI/CD

GitHub Actions pipelines in `.github/workflows/`:

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | push / PR | typecheck, lint, test, audit |
| `docker.yml` | push to `main` | build + push to GHCR |
| `release.yml` | tag `v*` | build, create GitHub Release |

`bun audit` runs on every push. `tsc --noEmit` enforces strict TypeScript — no `any`, no implicit returns.

---

## Plugging in a Real Database

Implement the `UserRepository` interface from `domain/repositories/` and register your adapter in the DI container (`main.ts`). The in-memory adapter stays available for local development and unit tests.

---

## Author

**Ilton Seixas** — [contact@iltonseixas.com](mailto:contact@iltonseixas.com)

---

## Disclaimer

This boilerplate is provided **as-is**, for educational and reference purposes only.

**No warranty.** The author makes no representations or warranties of any kind, express or implied, regarding the correctness, completeness, reliability, suitability, or availability of this software for any purpose. Your use of this code is entirely at your own risk.

**No liability.** To the fullest extent permitted by applicable law, the author shall not be held liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from the use or misuse of this software — including but not limited to data breaches, security incidents, financial loss, service downtime, or regulatory non-compliance.

**Misuse.** The author is not responsible for any unlawful, harmful, or unethical use of this codebase by any party.

**Security.** Security patterns and cryptographic implementations in this project follow industry best practices at the time of writing. However, the threat landscape evolves. You are solely responsible for auditing, hardening, and maintaining any system you build on top of this code.

> **Never blindly trust third-party code — including this project.**
> The author strongly recommends that you read and understand every line before deploying to production. Security-sensitive components (authentication, password hashing, token management, input validation) deserve particular scrutiny. No code review by a stranger on the internet replaces your own.

---

## License

MIT — Copyright (c) Ilton Seixas
