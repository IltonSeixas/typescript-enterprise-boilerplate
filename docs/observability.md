# Observability

## Overview

Observability is built into the boilerplate from the start using **OpenTelemetry** — the vendor-neutral standard. You can export to any compatible backend (Jaeger, Grafana Tempo, Honeycomb, Datadog, AWS X-Ray) by changing a single environment variable.

The three pillars — **traces**, **metrics**, and **logs** — are correlated by trace ID so you can move seamlessly from a high-level metric spike to the exact trace, then to the log lines of the failing request.

---

## Traces

Every HTTP request is automatically instrumented via `@opentelemetry/instrumentation-fastify`. Outgoing HTTP calls, database queries, and Redis operations are instrumented via the corresponding auto-instrumentation packages.

### Setup

```typescript
// infrastructure/telemetry/setup.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

This file must be `require`d before any other import — it is loaded via `--require` in the Node.js startup command.

### Manual spans in use cases

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('use-cases');

async execute(input: RegisterUserDto): Promise<void> {
  return tracer.startActiveSpan('RegisterUser.execute', async (span) => {
    try {
      // never attach sensitive fields to spans
      span.setAttribute('user.email_domain', emailDomain(input.email));
      // ...
    } finally {
      span.end();
    }
  });
}
```

---

## Metrics

Prometheus-format metrics are exposed at `GET /metrics` via `prom-client`.

### Available metrics

| Metric | Type | Description |
|---|---|---|
| `http_requests_total` | Counter | Total HTTP requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request latency by method and path |
| `http_requests_in_flight` | Gauge | Currently active requests |
| `db_query_duration_seconds` | Histogram | Database query latency by operation |

### Scrape config (Prometheus)

```yaml
scrape_configs:
  - job_name: typescript-api
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: /metrics
```

---

## Logs

Structured JSON logs via **Pino** (built into Fastify). Every log line includes the trace ID and span ID via the `pino-opentelemetry-transport`, enabling correlation with distributed traces.

### Log format (production)

```json
{
  "level": 30,
  "time": 1705312200123,
  "msg": "user registered",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "userId": "01HN..."
}
```

### Log levels

| Level | Use |
|---|---|
| `fatal` | Process is about to crash |
| `error` | Unrecoverable failures — always paged |
| `warn` | Recoverable unexpected states |
| `info` | Business events (user registered, login succeeded) |
| `debug` | Development only — never in production |
| `trace` | Never in production |

Set via `LOG_LEVEL=info` environment variable.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | OTLP gRPC endpoint |
| `OTEL_SERVICE_NAME` | `typescript-enterprise-boilerplate` | Service name in traces |
| `OTEL_SERVICE_VERSION` | — | Injected by CI from git tag |
| `LOG_LEVEL` | `info` | Pino log level |

---

## Local Development

Start a local Jaeger all-in-one instance to visualize traces:

```bash
docker compose up jaeger
```

Open `http://localhost:16686` to browse traces.

The `docker-compose.yml` in the repository root includes Jaeger, Prometheus, and Grafana pre-configured.
