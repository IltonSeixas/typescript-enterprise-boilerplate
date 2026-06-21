import { ServiceUnavailableError } from '../../domain/errors/domain.errors.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { RetryPolicy } from './retry-policy.js';

export async function callWithResilience<T>(
  breaker: CircuitBreaker,
  policy: RetryPolicy,
  isRetryable: (err: unknown) => boolean,
  operation: () => Promise<T>,
): Promise<T> {
  if (!breaker.allowRequest()) {
    throw new ServiceUnavailableError();
  }

  try {
    const value = await policy.run(isRetryable, operation);
    breaker.recordSuccess();
    return value;
  } catch (err) {
    if (isRetryable(err)) {
      breaker.recordFailure();
    }
    throw err;
  }
}
