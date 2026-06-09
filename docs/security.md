# Security

## Threat Model

This boilerplate is designed for multi-tenant web APIs exposed to the public internet. The primary threats addressed are:

- Credential stuffing and brute-force attacks
- Session hijacking and token theft
- Injection attacks (SQL, command)
- Information disclosure via error messages or logs
- Denial of service via resource exhaustion

---

## Password Hashing — Argon2id

All passwords are hashed using **Argon2id** via the `argon2` npm package, which uses native bindings to the reference C implementation.

bcrypt and scrypt are not used.

### Parameters

```typescript
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MB
  timeCost: 3,         // 3 iterations
  parallelism: 4,      // 4 parallel lanes
});
```

These parameters meet the OWASP minimum recommendations. Adjust upward based on your hardware profile and acceptable latency budget.

### Salt

A cryptographically random salt is generated automatically per-hash by the `argon2` library using the OS CSPRNG. The salt is embedded in the output string — never stored separately.

### Verification

Timing-safe comparison is handled internally by the `argon2` library. `argon2.verify()` is the only correct way to compare passwords against stored hashes.

---

## Authentication

### Access Token (JWT HS256)

- Algorithm: HS256 (HMAC-SHA256) via `jsonwebtoken`, signed in `JwtService`
- TTL: 15 minutes (hardcoded `JwtAccessTtl` constant — 900 seconds)
- Claims: `sub` (user ID), `jti` (unique token ID)
- Transport: returned in the JSON response body (`accessToken`); the client is responsible for storage and for sending it as `Authorization: Bearer <token>`
- Validation: signature + expiry checked on every authenticated request via the `authPlugin` Fastify preHandler hook

### Refresh Token

- Format: opaque UUID v4 via `crypto.randomUUID()` (built into the runtime, no library)
- Storage: server-side in Redis with TTL 7 days (hardcoded `JwtRefreshTtl` constant — 604800 seconds)
- Transport: `HttpOnly`, `Secure`, `SameSite=Strict` cookie set via `@fastify/cookie`, scoped to the `/api/v1/auth` path — never exposed to client-side JavaScript
- Rotation: a new refresh token is issued on every use; the old one is immediately invalidated
- Revocation: deleting the Redis key invalidates the session instantly

### Token Revocation

Access tokens cannot be revoked before expiry (stateless by design). The 15-minute TTL limits the exposure window. Refresh tokens, by contrast, are revocable instantly because they are stored server-side in Redis.

---

## Rate Limiting

Implemented via `@fastify/rate-limit` with fixed in-process limits — not Redis-backed and not environment-configurable.

```
Global:        100 requests / 60 seconds per IP (registered in main.ts)
Auth routes:    10 requests / 60 seconds per IP (per-route config on /register, /login, /refresh)
```

Authentication routes carry a stricter per-route limit via `config: { rateLimit: { max: 10, timeWindow: 60000 } }` passed directly to each `app.post()` declaration in `auth.routes.ts`. `@fastify/rate-limit` picks up this config and applies it independently from the global limit.

On limit exceeded, the server returns `429 Too Many Requests` with a structured JSON error body.

---

## Security Headers

Applied globally via `@fastify/helmet` on every response:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Content-Security-Policy` | `default-src 'none'` (API — no HTML served) |
| `Referrer-Policy` | `no-referrer` |

`Permissions-Policy` is not configured.

---

## CORS

CORS is configured via `@fastify/cors` with an explicit allow-list read from `ALLOWED_ORIGINS`. The wildcard `*` is never permitted — an empty allow-list disables cross-origin requests entirely.

```typescript
const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

await app.register(fastifyCors, {
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: true,
});
```

---

## Input Validation

All inputs are validated at the HTTP boundary using Zod schemas before reaching any use case. Invalid input returns `400 Bad Request` with a structured error body — never a stack trace.

```typescript
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(100),
});
```

Domain-level invariants are re-enforced inside value object constructors regardless of what the HTTP layer does. The domain is the last line of defense.

---

## SQL Injection Prevention

The default in-memory adapter performs no SQL queries at all. The PostgreSQL adapter (`infrastructure/persistence/postgres/`) is implemented against Drizzle ORM's parameterized query builder — template literal interpolation into raw SQL is never used — though it is not yet wired into the composition root.

```typescript
await db.select().from(users).where(eq(users.email, email.toString()));
```

---

## Sensitive Data

- Passwords are never logged, never returned in API responses, and never stored in plain text
- Tokens are never logged
- Error responses to clients contain a message and an error code — never internal details, stack traces, or database errors
- The default Pino log level (`info`) must not be lowered to `debug` or `trace` in production — verbose levels would serialize request bodies

---

## Dependency Auditing

`bun audit` runs on every CI push.

```bash
bun audit
```

Review `bun.lock` before deploying. Every transitive dependency is a potential attack surface. Pin affected versions in `package.json` when vulnerabilities are found and run `bun install` to update the lockfile.
