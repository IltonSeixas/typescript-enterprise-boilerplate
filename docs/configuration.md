# Configuration

All configuration is read directly from `process.env` at startup in `main.ts`. The application fails fast with a clear error message if `JWT_SECRET` is missing.

A `.env.example` file in the repository root lists every variable. Copy it to `.env` for local development.

```bash
cp .env.example .env
```

---

## Reference

### Server

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment — controls logger format (`pino-pretty` outside production) |
| `HOST` | No | `0.0.0.0` | Bind address |
| `PORT` | No | `3000` | HTTP listen port |
| `GRPC_PORT` | No | `50051` | gRPC listen port |

### Cache

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string — used unconditionally for refresh-token storage |

### Authentication

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes | — | HS256 signing key — minimum 32 characters, use a random value. The process exits at startup if it is not set |

Access token TTL (900 seconds / 15 minutes) and refresh token TTL (604800 seconds / 7 days) are hardcoded constants registered in the DI container — they are not environment-configurable.

### Security

| Variable | Required | Default | Description |
|---|---|---|---|
| `ALLOWED_ORIGINS` | No | *(empty)* | Comma-separated CORS allowed origins. An empty value means no cross-origin requests are allowed |

Rate limiting is registered with fixed values (`max: 100`, `timeWindow: 60000` ms) in `main.ts` — not environment-configurable.

### Observability

| Variable | Required | Default | Description |
|---|---|---|---|
| `OTLP_ENDPOINT` | No | `http://localhost:4317` | OTLP gRPC endpoint for traces and metrics |

---

## Production Checklist

Before deploying to production:

- [ ] `JWT_SECRET` is a random value of at least 32 characters — never reuse development values
- [ ] `NODE_ENV` is set to `production` (enables structured JSON logging via Pino)
- [ ] `REDIS_URL` uses a password-protected Redis instance
- [ ] `ALLOWED_ORIGINS` lists only your actual frontend domains
- [ ] `OTLP_ENDPOINT` points to your observability backend
- [ ] All secrets are injected via a secrets manager — never committed to source control or `.env` files in CI
