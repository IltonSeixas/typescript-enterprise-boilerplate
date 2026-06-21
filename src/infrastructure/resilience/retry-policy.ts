export class RetryPolicy {
  readonly maxAttempts: number;
  readonly initialBackoffMs: number;
  readonly backoffMultiplier: number;

  constructor(maxAttempts: number, initialBackoffMs: number, backoffMultiplier: number) {
    this.maxAttempts = Math.max(1, maxAttempts);
    this.initialBackoffMs = Math.max(1, initialBackoffMs);
    this.backoffMultiplier = Math.max(1, backoffMultiplier);
  }

  private backoffForAttempt(attempt: number): number {
    return this.initialBackoffMs * this.backoffMultiplier ** attempt;
  }

  async run<T>(
    isRetryable: (err: unknown) => boolean,
    operation: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === this.maxAttempts - 1) {
          throw err;
        }
        await delay(this.backoffForAttempt(attempt));
      }
    }

    throw lastError;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
