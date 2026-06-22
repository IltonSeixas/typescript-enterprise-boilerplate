import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { container } from 'tsyringe';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { parseEnv } from './infrastructure/config/env.schema.js';
import { setupTelemetry } from './infrastructure/telemetry/setup.js';
import { RedisStore } from './infrastructure/cache/redis-store.js';
import { CircuitBreaker } from './infrastructure/resilience/circuit-breaker.js';
import { RetryPolicy } from './infrastructure/resilience/retry-policy.js';
import { Argon2Hasher } from './infrastructure/security/argon2-hasher.js';
import { JwtService } from './infrastructure/security/jwt-service.js';
import { InMemoryUserRepository } from './infrastructure/persistence/in-memory/user.repository.js';
import { PostgresUserRepository } from './infrastructure/persistence/postgres/user.repository.js';
import { createPostgresDatabase } from './infrastructure/persistence/postgres/connection.js';
import { InMemoryAuditAdapter } from './infrastructure/audit/in-memory-audit.adapter.js';
import { PostgresAuditAdapter } from './infrastructure/audit/postgres-audit.adapter.js';
import type { UserRepository } from './domain/repositories/user.repository.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { securityHeadersPlugin } from './interfaces/http/plugins/security-headers.plugin.js';
import { rateLimitPlugin } from './interfaces/http/plugins/rate-limit.plugin.js';
import { authPlugin } from './interfaces/http/plugins/auth.plugin.js';
import { authRoutes } from './interfaces/http/routes/auth.routes.js';
import { userRoutes } from './interfaces/http/routes/user.routes.js';
import { healthRoutes } from './interfaces/http/routes/health.routes.js';
import { metricsRoutes } from './interfaces/http/routes/metrics.routes.js';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case.js';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case.js';
import { LogoutUserUseCase } from './application/use-cases/logout-user.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case.js';
import { GetUserUseCase } from './application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case.js';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case.js';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case.js';
import { ChangeRoleUseCase } from './application/use-cases/change-role.use-case.js';
import { createGrpcServer, startGrpcServer, stopGrpcServer } from './interfaces/grpc/server.js';
import { ServiceUnavailableError } from './domain/errors/domain.errors.js';
import { domainError } from './interfaces/http/http-errors.js';

const env = parseEnv(process.env);
const {
  NODE_ENV,
  HOST,
  PORT,
  GRPC_PORT,
  JWT_PRIVATE_KEY_PATH,
  JWT_PUBLIC_KEY_PATH,
  REDIS_URL,
  DATABASE_URL,
  ALLOWED_ORIGINS,
  OTLP_ENDPOINT,
  npm_package_version: SERVICE_VERSION,
  JWT_ACCESS_TTL,
  JWT_REFRESH_TTL,
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_RESET_TIMEOUT_MS,
  RETRY_MAX_ATTEMPTS,
  RETRY_INITIAL_BACKOFF_MS,
  RETRY_BACKOFF_MULTIPLIER,
  DB_POOL_MAX,
  DB_POOL_CONNECT_TIMEOUT_SECONDS,
  DB_POOL_IDLE_TIMEOUT_SECONDS,
  DB_POOL_MAX_LIFETIME_SECONDS,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_COMMAND_TIMEOUT_MS,
} = env;

const JWT_PRIVATE_KEY = await readFile(JWT_PRIVATE_KEY_PATH, 'utf-8');
const JWT_PUBLIC_KEY = await readFile(JWT_PUBLIC_KEY_PATH, 'utf-8');

setupTelemetry({
  serviceName: 'typescript-enterprise-boilerplate',
  serviceVersion: SERVICE_VERSION,
  exporterEndpoint: OTLP_ENDPOINT,
});

container.register('RedisCircuitBreaker', {
  useValue: new CircuitBreaker(CIRCUIT_FAILURE_THRESHOLD, CIRCUIT_RESET_TIMEOUT_MS),
});
container.register('RedisRetryPolicy', {
  useValue: new RetryPolicy(RETRY_MAX_ATTEMPTS, RETRY_INITIAL_BACKOFF_MS, RETRY_BACKOFF_MULTIPLIER),
});
container.registerSingleton('RedisStore', RedisStore);
container.register('PasswordHasher', { useClass: Argon2Hasher });
container.register('TokenService', { useClass: JwtService });

let database: PostgresJsDatabase | undefined;

if (DATABASE_URL) {
  database = await createPostgresDatabase(DATABASE_URL, {
    max: DB_POOL_MAX,
    idleTimeoutSeconds: DB_POOL_IDLE_TIMEOUT_SECONDS,
    connectTimeoutSeconds: DB_POOL_CONNECT_TIMEOUT_SECONDS,
    maxLifetimeSeconds: DB_POOL_MAX_LIFETIME_SECONDS,
  });
  container.register('Database', { useValue: database });
  container.registerSingleton('UserRepository', PostgresUserRepository);
} else {
  container.registerSingleton('UserRepository', InMemoryUserRepository);
}

container.register('JwtPrivateKey', { useValue: JWT_PRIVATE_KEY });
container.register('JwtPublicKey', { useValue: JWT_PUBLIC_KEY });
container.register('JwtAccessTtl', { useValue: JWT_ACCESS_TTL });
container.register('JwtRefreshTtl', { useValue: JWT_REFRESH_TTL });
container.register('RedisUrl', { useValue: REDIS_URL });
container.register('RedisConnectTimeoutMs', { useValue: REDIS_CONNECT_TIMEOUT_MS });
container.register('RedisCommandTimeoutMs', { useValue: REDIS_COMMAND_TIMEOUT_MS });

const app = Fastify({
  logger:
    NODE_ENV === 'production'
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        },
});

container.register('Logger', { useValue: app.log });
if (database) {
  container.registerSingleton('AuditPort', PostgresAuditAdapter);
} else {
  container.registerSingleton('AuditPort', InMemoryAuditAdapter);
}

await app.register(securityHeadersPlugin);
await app.register(rateLimitPlugin, { max: 100, timeWindow: 60000 });

const userRepository = container.resolve<UserRepository>('UserRepository');
const tokenService = container.resolve<InstanceType<typeof JwtService>>('TokenService');
const redisStore = container.resolve<RedisStore>('RedisStore');
await redisStore.connect();

await app.register(authPlugin, { userRepository, tokenService });
await app.register(fastifyCookie);

await app.register(healthRoutes, { redisStore, database });
await app.register(metricsRoutes);

await app.register(fastifyCors, {
  origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
  credentials: true,
});

const registerUser = container.resolve(RegisterUserUseCase);
const loginUser = container.resolve(LoginUserUseCase);
const refreshToken = container.resolve(RefreshTokenUseCase);
const logoutUser = container.resolve(LogoutUserUseCase);
const getUser = container.resolve(GetUserUseCase);
const listUsers = container.resolve(ListUsersUseCase);
const updateProfile = container.resolve(UpdateProfileUseCase);
const changePassword = container.resolve(ChangePasswordUseCase);
const changeRole = container.resolve(ChangeRoleUseCase);

await app.register(
  async (api) => {
    await api.register(authRoutes, {
      prefix: '/auth',
      registerUser,
      loginUser,
      refreshToken,
      logoutUser,
    });

    await api.register(userRoutes, {
      prefix: '/users',
      getUser,
      listUsers,
      updateProfile,
      changePassword,
      changeRole,
    });
  },
  { prefix: '/api/v1' },
);

app.setErrorHandler((err, _request, reply) => {
  app.log.error(err);

  if (err instanceof ServiceUnavailableError) {
    void reply.status(503).send(domainError(err));
    return;
  }

  void reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
});

const grpcServer = createGrpcServer({
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getUser,
  listUsers,
  updateProfile,
  changePassword,
  changeRole,
  tokenService,
  userRepository,
});

const shutdown = async (): Promise<void> => {
  app.log.info('Shutting down...');
  await app.close();
  await stopGrpcServer(grpcServer);
  await redisStore.disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

try {
  const boundGrpcPort = await startGrpcServer(grpcServer, HOST, GRPC_PORT);
  app.log.info(`gRPC server listening on ${HOST}:${boundGrpcPort}`);
  await app.listen({ host: HOST, port: PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
