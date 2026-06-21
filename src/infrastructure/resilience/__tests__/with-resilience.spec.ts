import { describe, it, expect } from 'bun:test';
import { CircuitBreaker } from '../circuit-breaker.js';
import { RetryPolicy } from '../retry-policy.js';
import { callWithResilience } from '../with-resilience.js';
import { ServiceUnavailableError } from '../../../domain/errors/domain.errors.js';

const errBoom = new Error('boom');
const alwaysRetryable = (): boolean => true;

describe('callWithResilience', () => {
  it('returns the operation result and records success on the breaker', async () => {
    const breaker = new CircuitBreaker(2, 30_000);
    const policy = new RetryPolicy(1, 1, 2);

    const result = await callWithResilience(breaker, policy, alwaysRetryable, async () => 'ok');

    expect(result).toBe('ok');
    expect(breaker.allowRequest()).toBe(true);
  });

  it('records a failure on the breaker when the operation exhausts retries', async () => {
    const breaker = new CircuitBreaker(2, 30_000);
    const policy = new RetryPolicy(1, 1, 2);

    await expect(
      callWithResilience(breaker, policy, alwaysRetryable, async () => {
        throw errBoom;
      }),
    ).rejects.toThrow('boom');

    await expect(
      callWithResilience(breaker, policy, alwaysRetryable, async () => {
        throw errBoom;
      }),
    ).rejects.toThrow('boom');

    expect(breaker.allowRequest()).toBe(false);
  });

  it('fails fast without calling the operation when the circuit is open', async () => {
    const breaker = new CircuitBreaker(1, 30_000);
    const policy = new RetryPolicy(1, 1, 2);
    let calls = 0;

    await expect(
      callWithResilience(breaker, policy, alwaysRetryable, async () => {
        calls += 1;
        throw errBoom;
      }),
    ).rejects.toThrow('boom');

    await expect(
      callWithResilience(breaker, policy, alwaysRetryable, async () => {
        calls += 1;
        return 'unreachable';
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);

    expect(calls).toBe(1);
  });
});
