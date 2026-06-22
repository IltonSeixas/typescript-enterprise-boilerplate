import { describe, it, expect } from 'bun:test';
import postgres from 'postgres';

describe('createPostgresDatabase pool options', () => {
  it('passes pool options through to the postgres-js client', () => {
    const poolOptions = {
      max: 25,
      idleTimeoutSeconds: 300,
      connectTimeoutSeconds: 15,
      maxLifetimeSeconds: 900,
    };

    const client = postgres('postgres://user:pass@localhost:5432/db', {
      max: poolOptions.max,
      idle_timeout: poolOptions.idleTimeoutSeconds,
      connect_timeout: poolOptions.connectTimeoutSeconds,
      max_lifetime: poolOptions.maxLifetimeSeconds,
    });

    expect(client.options.max).toBe(25);
    expect(client.options.idle_timeout).toBe(300);
    expect(client.options.connect_timeout).toBe(15);
    expect(client.options.max_lifetime).toBe(900);

    void client.end();
  });
});
