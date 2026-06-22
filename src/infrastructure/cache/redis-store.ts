import 'reflect-metadata';
import { Redis } from 'ioredis';
import { inject, injectable } from 'tsyringe';
import { CircuitBreaker } from '../resilience/circuit-breaker.js';
import { RetryPolicy } from '../resilience/retry-policy.js';
import { callWithResilience } from '../resilience/with-resilience.js';

const alwaysRetryable = (): boolean => true;

@injectable()
export class RedisStore {
  private readonly client: Redis;

  constructor(
    @inject('RedisUrl') redisUrl: string,
    @inject('RedisCircuitBreaker') private readonly breaker: CircuitBreaker,
    @inject('RedisRetryPolicy') private readonly retryPolicy: RetryPolicy,
    @inject('RedisConnectTimeoutMs') connectTimeoutMs: number,
    @inject('RedisCommandTimeoutMs') commandTimeoutMs: number,
  ) {
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: connectTimeoutMs,
      commandTimeout: commandTimeoutMs,
    });
  }

  async get(key: string): Promise<string | null> {
    return callWithResilience(this.breaker, this.retryPolicy, alwaysRetryable, () =>
      this.client.get(key),
    );
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await callWithResilience(this.breaker, this.retryPolicy, alwaysRetryable, () =>
      this.client.set(key, value, 'EX', ttlSeconds),
    );
  }

  async del(key: string): Promise<void> {
    await callWithResilience(this.breaker, this.retryPolicy, alwaysRetryable, () =>
      this.client.del(key),
    );
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
