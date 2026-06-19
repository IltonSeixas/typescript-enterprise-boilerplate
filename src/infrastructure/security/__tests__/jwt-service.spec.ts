import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { JwtService } from '../jwt-service.js';
import type { RedisStore } from '../../cache/redis-store.js';

// Test-only Ed25519 key pairs, generated via:
//   openssl genpkey -algorithm ed25519 -out priv.pem
//   openssl pkey -in priv.pem -pubout -out pub.pem
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBgaIljluz0JhdKBg4b5+6I4Gpo+N5hS4HCojxdZjMx6
-----END PRIVATE KEY-----
`;
const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAKi4DKMfw2l51vOWNq1MgjZt4HRw1xb8CIUupTxf2/OU=
-----END PUBLIC KEY-----
`;
const OTHER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAliC+8TJtGxsSjYPc7Q3V0YY9cVRAWVQ1Eqmw9RAtK6k=
-----END PUBLIC KEY-----
`;

const unusedRedisStore = {} as RedisStore;

describe('JwtService', () => {
  it('signs and verifies an access token with EdDSA', async () => {
    const service = new JwtService(
      TEST_PRIVATE_KEY,
      TEST_PUBLIC_KEY,
      900,
      604800,
      unusedRedisStore,
    );

    const token = await service.signAccessToken({ sub: 'user-1', jti: 'jti-1' });
    const claims = await service.verifyAccessToken(token);

    expect(claims.sub).toBe('user-1');
    expect(claims.jti).toBe('jti-1');
  });

  it('rejects a token signed with a different key pair', async () => {
    const signingService = new JwtService(
      TEST_PRIVATE_KEY,
      TEST_PUBLIC_KEY,
      900,
      604800,
      unusedRedisStore,
    );
    const verifyingService = new JwtService(
      TEST_PRIVATE_KEY,
      OTHER_PUBLIC_KEY,
      900,
      604800,
      unusedRedisStore,
    );

    const token = await signingService.signAccessToken({ sub: 'user-1', jti: 'jti-1' });

    await expect(verifyingService.verifyAccessToken(token)).rejects.toThrow();
  });
});
