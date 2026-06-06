import 'reflect-metadata';
import { Redis } from 'ioredis';
import { inject, injectable } from 'tsyringe';

@injectable()
export class RedisStore {
  private readonly client: Redis;

  constructor(@inject('RedisUrl') redisUrl: string) {
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
