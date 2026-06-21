export enum CircuitState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half-open',
}

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private rawState: CircuitState = CircuitState.Closed;
  private openedAtMs = 0;
  private probeInFlight = false;

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeoutMs: number,
  ) {}

  state(): CircuitState {
    if (
      this.rawState === CircuitState.Open &&
      Date.now() - this.openedAtMs >= this.resetTimeoutMs
    ) {
      return CircuitState.HalfOpen;
    }
    return this.rawState;
  }

  allowRequest(): boolean {
    switch (this.state()) {
      case CircuitState.Closed:
        return true;
      case CircuitState.Open:
        return false;
      case CircuitState.HalfOpen:
        if (this.probeInFlight) {
          return false;
        }
        this.probeInFlight = true;
        return true;
    }
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.rawState = CircuitState.Closed;
    this.probeInFlight = false;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.rawState = CircuitState.Open;
      this.openedAtMs = Date.now();
      this.probeInFlight = false;
    }
  }
}
