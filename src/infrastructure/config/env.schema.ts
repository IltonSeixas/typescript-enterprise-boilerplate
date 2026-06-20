import { z } from 'zod';

const portSchema = z.coerce.number().int().min(1).max(65535);

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: portSchema.default(3000),
  GRPC_PORT: portSchema.default(50051),
  JWT_PRIVATE_KEY_PATH: z.string().min(1, 'JWT_PRIVATE_KEY_PATH is required'),
  JWT_PUBLIC_KEY_PATH: z.string().min(1, 'JWT_PUBLIC_KEY_PATH is required'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  DATABASE_URL: z.string().min(1).optional(),
  ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  OTLP_ENDPOINT: z.string().min(1).default('http://localhost:4317'),
  npm_package_version: z.string().min(1).default('1.0.0'),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = EnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    process.stderr.write(`Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }

  return result.data;
}
