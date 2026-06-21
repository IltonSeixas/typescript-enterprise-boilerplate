import { describe, it, expect } from 'bun:test';
import { CircuitBreaker, CircuitState } from '../circuit-breaker.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('CircuitBreaker', () => {
  it('starts closed and allows requests', () => {
    const breaker = new CircuitBreaker(3, 30_000);

    expect(breaker.state()).toBe(CircuitState.Closed);
    expect(breaker.allowRequest()).toBe(true);
  });

  it('opens after reaching the failure threshold', () => {
    const breaker = new CircuitBreaker(3, 30_000);

    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.state()).toBe(CircuitState.Closed);

    breaker.recordFailure();
    expect(breaker.state()).toBe(CircuitState.Open);
    expect(breaker.allowRequest()).toBe(false);
  });

  it('a success resets the failure count and closes the circuit', () => {
    const breaker = new CircuitBreaker(3, 30_000);

    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.state()).toBe(CircuitState.Closed);
  });

  it('transitions to half-open after the reset timeout elapses', async () => {
    const breaker = new CircuitBreaker(1, 5);

    breaker.recordFailure();
    expect(breaker.state()).toBe(CircuitState.Open);

    await sleep(10);

    expect(breaker.state()).toBe(CircuitState.HalfOpen);
    expect(breaker.allowRequest()).toBe(true);
  });

  it('allows only one probe at a time while half-open', async () => {
    const breaker = new CircuitBreaker(1, 5);

    breaker.recordFailure();
    await sleep(10);

    expect(breaker.allowRequest()).toBe(true);
    expect(breaker.allowRequest()).toBe(false);
  });

  it('a failed probe in half-open reopens the circuit', async () => {
    const breaker = new CircuitBreaker(1, 60_000);

    breaker.recordFailure();
    expect(breaker.state()).toBe(CircuitState.Open);

    // Force the reset timeout to have elapsed without waiting a full minute.
    (breaker as unknown as { openedAtMs: number }).openedAtMs = 0;
    expect(breaker.state()).toBe(CircuitState.HalfOpen);

    expect(breaker.allowRequest()).toBe(true);
    breaker.recordFailure();

    expect(breaker.state()).toBe(CircuitState.Open);
  });

  it('a successful probe in half-open closes the circuit', async () => {
    const breaker = new CircuitBreaker(1, 5);

    breaker.recordFailure();
    await sleep(10);

    expect(breaker.allowRequest()).toBe(true);
    breaker.recordSuccess();

    expect(breaker.state()).toBe(CircuitState.Closed);
    expect(breaker.allowRequest()).toBe(true);
  });
});
