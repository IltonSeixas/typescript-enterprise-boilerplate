# Stage 1: dependencies
FROM oven/bun:1.3-alpine AS deps

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 2: build
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app
COPY package.json bun.lock tsconfig.json tsconfig.build.json ./
RUN bun install --frozen-lockfile
COPY src ./src
RUN bun run build \
    && mkdir -p dist/infrastructure/persistence/postgres/migrations \
    && cp -r src/infrastructure/persistence/postgres/migrations/. dist/infrastructure/persistence/postgres/migrations/

# Stage 3: runtime
FROM oven/bun:1.3-alpine AS runtime

RUN addgroup --system --gid 1001 app \
    && adduser --system --uid 1001 --ingroup app app

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY proto ./proto

USER app

EXPOSE 3000 50051

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://0.0.0.0:3000/health || exit 1

ENTRYPOINT ["bun", "dist/main.js"]
