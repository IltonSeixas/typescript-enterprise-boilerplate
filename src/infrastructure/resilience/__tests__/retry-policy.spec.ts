import { describe, it, expect } from 'bun:test';
import { RetryPolicy } from '../retry-policy.js';

const errBoom = new Error('boom');
const alwaysRetryable = (): boolean => true;
const neverRetryable = (): boolean => false;

describe('RetryPolicy', () => {
  it('returns the result on the first successful attempt', async () => {
    const policy = new RetryPolicy(3, 1, 2);
    let calls = 0;

    const result = await policy.run(alwaysRetryable, async () => {
      calls += 1;
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries retryable failures until success', async () => {
    const policy = new RetryPolicy(3, 1, 2);
    let calls = 0;

    const result = await policy.run(alwaysRetryable, async () => {
      calls += 1;
      if (calls < 3) {
        throw errBoom;
      }
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('stops retrying and throws after exhausting max attempts', async () => {
    const policy = new RetryPolicy(3, 1, 2);
    let calls = 0;

    await expect(
      policy.run(alwaysRetryable, async () => {
        calls += 1;
        throw errBoom;
      }),
    ).rejects.toThrow('boom');

    expect(calls).toBe(3);
  });

  it('does not retry a non-retryable failure', async () => {
    const policy = new RetryPolicy(3, 1, 2);
    let calls = 0;

    await expect(
      policy.run(neverRetryable, async () => {
        calls += 1;
        throw errBoom;
      }),
    ).rejects.toThrow('boom');

    expect(calls).toBe(1);
  });
});
