import 'reflect-metadata';
import { container } from 'tsyringe';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { setupTelemetry } from './infrastructure/telemetry/setup.js';
import { RedisStore } from './infrastructure/cache/redis-store.js';
import { Argon2Hasher } from './infrastructure/security/argon2-hasher.js';
import { JwtService } from './infrastructure/security/jwt-service.js';
import { InMemoryUserRepository } from './infrastructure/persistence/in-memory/user.repository.js';
import { PostgresUserRepository } from './infrastructure/persistence/postgres/user.repository.js';
import { createPostgresDatabase } from './infrastructure/persistence/postgres/connection.js';
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
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case.js';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case.js';
import { ChangeRoleUseCase } from './application/use-cases/change-role.use-case.js';
import { createGrpcServer, startGrpcServer, stopGrpcServer } from './interfaces/grpc/server.js';

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const HOST = process.env['HOST'] ?? '0.0.0.0';
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const GRPC_PORT = parseInt(process.env['GRPC_PORT'] ?? '50051', 10);
const JWT_SECRET = process.env['JWT_SECRET'];
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const DATABASE_URL = process.env['DATABASE_URL'];
const OTLP_ENDPOINT = process.env['OTLP_ENDPOINT'] ?? 'http://localhost:4317';
const SERVICE_VERSION = process.env['npm_package_version'] ?? '1.0.0';

if (!JWT_SECRET) {
  process.stderr.write('JWT_SECRET environment variable is required\n');
  process.exit(1);
}

setupTelemetry({
  serviceName: 'typescript-enterprise-boilerplate',
  serviceVersion: SERVICE_VERSION,
  exporterEndpoint: OTLP_ENDPOINT,
});

container.registerSingleton('RedisStore', RedisStore);
container.register('PasswordHasher', { useClass: Argon2Hasher });
container.register('TokenService', { useClass: JwtService });

let database: PostgresJsDatabase | undefined;

if (DATABASE_URL) {
  database = await createPostgresDatabase(DATABASE_URL);
  container.register('Database', { useValue: database });
  container.registerSingleton('UserRepository', PostgresUserRepository);
} else {
  container.registerSingleton('UserRepository', InMemoryUserRepository);
}

container.register('JwtSecret', { useValue: JWT_SECRET });
container.register('JwtAccessTtl', { useValue: 900 });
container.register('JwtRefreshTtl', { useValue: 604800 });
container.register('RedisUrl', { useValue: REDIS_URL });

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

const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

await app.register(fastifyCors, {
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: true,
});

const registerUser = container.resolve(RegisterUserUseCase);
const loginUser = container.resolve(LoginUserUseCase);
const refreshToken = container.resolve(RefreshTokenUseCase);
const logoutUser = container.resolve(LogoutUserUseCase);
const getUser = container.resolve(GetUserUseCase);
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
      updateProfile,
      changePassword,
      changeRole,
    });
  },
  { prefix: '/api/v1' },
);

app.setErrorHandler((err, _request, reply) => {
  app.log.error(err);
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
