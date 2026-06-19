# Configuration

All configuration is read directly from `process.env` at startup in `main.ts`. The application fails fast with a clear error message if `JWT_PRIVATE_KEY_PATH`/`JWT_PUBLIC_KEY_PATH` are missing.

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
| `JWT_PRIVATE_KEY_PATH` | Yes | — | Path to the Ed25519 PEM private key used to sign access tokens. The process exits at startup if it is not set |
| `JWT_PUBLIC_KEY_PATH` | Yes | — | Path to the Ed25519 PEM public key used to verify access tokens. The process exits at startup if it is not set |
| `JWT_ACCESS_TTL` | No | `900` | Access token TTL in seconds |
| `JWT_REFRESH_TTL` | No | `604800` | Refresh token TTL in seconds |

Generate a key pair with:

```bash
openssl genpkey -algorithm ed25519 -out jwt_private.pem
openssl pkey -in jwt_private.pem -pubout -out jwt_public.pem
```

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

- [ ] `JWT_PRIVATE_KEY_PATH`/`JWT_PUBLIC_KEY_PATH` point to a key pair generated specifically for this environment — never reuse development keys
- [ ] `NODE_ENV` is set to `production` (enables structured JSON logging via Pino)
- [ ] `REDIS_URL` uses a password-protected Redis instance
- [ ] `ALLOWED_ORIGINS` lists only your actual frontend domains
- [ ] `OTLP_ENDPOINT` points to your observability backend
- [ ] All secrets are injected via a secrets manager — never committed to source control or `.env` files in CI
