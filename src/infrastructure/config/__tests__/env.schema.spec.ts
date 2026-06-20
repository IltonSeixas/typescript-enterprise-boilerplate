import { describe, it, expect, spyOn } from 'bun:test';
import { EnvSchema, parseEnv } from '../env.schema.js';

const validEnv = {
  JWT_PRIVATE_KEY_PATH: '/keys/private.pem',
  JWT_PUBLIC_KEY_PATH: '/keys/public.pem',
};

describe('EnvSchema', () => {
  it('applies defaults for optional variables', () => {
    const env = EnvSchema.parse(validEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.GRPC_PORT).toBe(50051);
    expect(env.JWT_ACCESS_TTL).toBe(900);
    expect(env.JWT_REFRESH_TTL).toBe(604800);
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.ALLOWED_ORIGINS).toEqual([]);
  });

  it('coerces numeric variables from strings', () => {
    const env = EnvSchema.parse({ ...validEnv, PORT: '8080', JWT_ACCESS_TTL: '120' });

    expect(env.PORT).toBe(8080);
    expect(env.JWT_ACCESS_TTL).toBe(120);
  });

  it('splits and trims ALLOWED_ORIGINS into an array', () => {
    const env = EnvSchema.parse({
      ...validEnv,
      ALLOWED_ORIGINS: 'https://a.com, https://b.com ,,',
    });

    expect(env.ALLOWED_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('rejects a PORT outside the valid TCP range', () => {
    const result = EnvSchema.safeParse({ ...validEnv, PORT: '99999' });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown NODE_ENV value', () => {
    const result = EnvSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });

    expect(result.success).toBe(false);
  });

  it('requires JWT_PRIVATE_KEY_PATH and JWT_PUBLIC_KEY_PATH', () => {
    const result = EnvSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe('parseEnv', () => {
  it('returns the parsed environment when valid', () => {
    const env = parseEnv(validEnv);

    expect(env.JWT_PRIVATE_KEY_PATH).toBe('/keys/private.pem');
  });

  it('writes to stderr and exits the process when invalid', () => {
    const stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => undefined as never);

    parseEnv({});

    expect(stderrSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
