# Observability

## Overview

Distributed tracing is built into the boilerplate from the start using **OpenTelemetry** — the vendor-neutral standard. You can export to any compatible backend (Jaeger, Grafana Tempo, Honeycomb, Datadog, AWS X-Ray) by pointing `OTLP_ENDPOINT` at it.

This boilerplate ships traces and structured logs. It does not currently expose a Prometheus metrics endpoint — see [Metrics](#metrics) below.

---

## Traces

Every HTTP request is automatically instrumented via `@opentelemetry/instrumentation-fastify`. Outgoing HTTP calls, database queries, and Redis operations are instrumented via the corresponding auto-instrumentation packages.

### Setup

```typescript
// infrastructure/telemetry/setup.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';

export function setupTelemetry(config: {
  serviceName: string;
  serviceVersion: string;
  exporterEndpoint: string;
}): NodeSDK {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter({ url: config.exporterEndpoint }),
    instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation()],
  });

  sdk.start();
  return sdk;
}
```

`setupTelemetry` is called at the very top of `main.ts`, before the dependency container and the Fastify instance are created, so every subsequent HTTP call and outgoing request is captured from the start.

---

## Metrics

This boilerplate does not currently expose a Prometheus metrics endpoint or instrument custom application metrics — only distributed traces and logs are shipped out of the box. Adding a `/metrics` route backed by `prom-client` (or the OpenTelemetry metrics SDK) is a natural extension point.

The `prometheus` and `grafana` services in `docker-compose.yml` are provided as a starting point for teams that add metrics instrumentation; they are not pre-wired to scrape this service.

---

## Logs

Structured logs via **Pino** (built into Fastify). In production (`NODE_ENV=production`) logs are emitted as JSON; in development they are pretty-printed via `pino-pretty` with colorized output.

### Log levels

Pino's default level thresholds apply: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. The boilerplate does not set a custom level — Pino defaults to `info`.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OTLP_ENDPOINT` | `http://localhost:4317` | OTLP gRPC endpoint for traces |
| `NODE_ENV` | `development` | Controls log format — JSON in `production`, pretty-printed otherwise |

---

## Local Development

Start the observability stack defined in `docker-compose.yml`:

```bash
docker compose up jaeger prometheus grafana
```

Open `http://localhost:16686` to browse traces in Jaeger. The `OTEL_EXPORTER_OTLP_ENDPOINT` value baked into the compose file points the application at the bundled Jaeger instance.
