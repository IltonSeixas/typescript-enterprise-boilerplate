# Configuration

All configuration is read from environment variables at startup, validated with a Zod schema. The application fails fast with a clear, structured error message if any required variable is missing or fails validation.

A `.env.example` file in the repository root lists every variable. Copy it to `.env` for local development.

```bash
cp .env.example .env
```

---

## Reference

### Server

| Variable | Required | Default | Description |
|---|---|---|---|
| `HOST` | No | `0.0.0.0` | Bind address |
| `PORT` | No | `3000` | HTTP listen port |
| `GRPC_PORT` | No | `50051` | gRPC listen port |

### Persistence

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADAPTER` | No | `memory` | Persistence adapter: `memory` or `postgres` |
| `DATABASE_URL` | If `postgres` | — | PostgreSQL connection string |
| `DATABASE_POOL_MAX` | No | `10` | Max connections in pool |
| `DATABASE_POOL_MIN` | No | `2` | Min idle connections |

### Cache

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_URL` | If `postgres` | — | Redis connection string (`redis://host:port`) |

### Authentication

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes | — | HS256 signing key — minimum 32 characters, use a random value |
| `JWT_ACCESS_TTL` | No | `900` | Access token TTL in seconds (15 min) |
| `JWT_REFRESH_TTL` | No | `604800` | Refresh token TTL in seconds (7 days) |

### Security

| Variable | Required | Default | Description |
|---|---|---|---|
| `ALLOWED_ORIGINS` | No | `http://localhost:*` | Comma-separated CORS allowed origins |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window per IP |
| `RATE_LIMIT_WINDOW` | No | `60000` | Rate limit window in milliseconds |

### Observability

| Variable | Required | Default | Description |
|---|---|---|---|
| `LOG_LEVEL` | No | `info` | Pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | `http://localhost:4317` | OTLP gRPC endpoint |
| `OTEL_SERVICE_NAME` | No | `typescript-enterprise-boilerplate` | Service name in traces |
| `OTEL_SERVICE_VERSION` | No | — | Injected by CI from git tag |

---

## Production Checklist

Before deploying to production:

- [ ] `JWT_SECRET` is a random value of at least 32 characters — never reuse development values
- [ ] `DATABASE_URL` uses a TLS connection string (`?sslmode=require`)
- [ ] `REDIS_URL` uses a password-protected Redis instance
- [ ] `ALLOWED_ORIGINS` lists only your actual frontend domains
- [ ] `LOG_LEVEL` is set to `info` or `warn` — never `debug` or `trace`
- [ ] `OTEL_EXPORTER_OTLP_ENDPOINT` points to your observability backend
- [ ] All secrets are injected via a secrets manager — never committed to source control or `.env` files in CI
