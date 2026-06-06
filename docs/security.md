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

- Algorithm: HS256 (HMAC-SHA256) via `@fastify/jwt`
- TTL: 15 minutes
- Claims: `sub` (user ID), `iat`, `exp`, `jti` (unique token ID)
- Storage: in-memory on the client — never in `localStorage` or cookies
- Validation: signature + expiry checked on every authenticated request via Fastify preHandler hook

### Refresh Token

- Format: opaque UUID v4 via `crypto.randomUUID()` (Node.js built-in, no library)
- Storage: server-side in Redis with TTL 7 days
- Transport: HttpOnly, Secure, SameSite=Strict cookie via `@fastify/cookie`
- Rotation: a new refresh token is issued on every use; the old one is immediately invalidated
- Revocation: deleting the Redis key invalidates the session instantly

### Token Revocation

Access tokens cannot be revoked before expiry (stateless by design). The 15-minute TTL limits the exposure window. If immediate revocation is required, implement a short-lived Redis blocklist for `jti` values.

---

## Rate Limiting

Implemented via `@fastify/rate-limit` using a sliding window counter per IP address backed by Redis.

```
Default: 100 requests / 60 seconds per IP
Configurable via: RATE_LIMIT_MAX environment variable
```

Authentication endpoints have a stricter independent limit to mitigate credential stuffing.

On limit exceeded, the server returns `429 Too Many Requests` with a `Retry-After` header.

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
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` |

---

## CORS

CORS is configured via `@fastify/cors` with an explicit allow-list. The wildcard `*` is never permitted in production.

```typescript
await app.register(cors, {
  origin: config.allowedOrigins, // from environment variable
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
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

All database queries use Drizzle ORM's parameterized query builder. Template literal interpolation into raw SQL is never used.

```typescript
await db.select().from(users).where(eq(users.email, email.toString()));
```

---

## Sensitive Data

- Passwords are never logged, never returned in API responses, and never stored in plain text
- Tokens are never logged
- Error responses to clients contain a message and an error code — never internal details, stack traces, or database errors
- `LOG_LEVEL` must never be set to `trace` or `debug` in production (Pino would serialize request bodies)

---

## Dependency Auditing

`npm audit` runs on every CI push.

```bash
npm audit --audit-level=high
```

Review `package-lock.json` (or `bun.lockb`) before deploying. Every transitive dependency is a potential attack surface. Use `npm audit fix` or pin affected versions when vulnerabilities are found.
