# Observability

## Overview

Distributed tracing is built into the boilerplate from the start using **OpenTelemetry** — the vendor-neutral standard. You can export to any compatible backend (Jaeger, Grafana Tempo, Honeycomb, Datadog, AWS X-Ray) by pointing `OTLP_ENDPOINT` at it.

This boilerplate ships traces, structured logs, and Prometheus metrics out of the box — see [Metrics](#metrics) below.

---

## Traces

Every HTTP request is automatically instrumented via `@opentelemetry/instrumentation-fastify`. Outgoing HTTP calls, database queries, and Redis operations are instrumented via the corresponding auto-instrumentation packages.

### Setup

```typescript
// infrastructure/telemetry/setup.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';

export function setupTelemetry(config: {
  serviceName: string;
  serviceVersion: string;
  exporterEndpoint: string;
}): NodeSDK {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
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

`GET /metrics` exposes default Node.js process and runtime metrics (CPU, memory, event loop, GC) via `prom-client`'s `collectDefaultMetrics`, registered in `metricsRoutes`. Custom application metrics are not yet instrumented — the route is wired and ready to register additional counters/histograms as needed.

The `prometheus` and `grafana` services in `docker-compose.yml` are pre-configured to scrape this endpoint — see `docker/prometheus.yml` (`metrics_path: /metrics`, target `app:3000`) and the provisioned Grafana datasource.

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

Open `http://localhost:16686` to browse traces in Jaeger. The `OTLP_ENDPOINT` value baked into the compose file points the application at the bundled Jaeger instance.
