import { InvalidUserIdError } from '../errors/domain.errors.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UserId {
  private constructor(private readonly value: string) {}

  static create(raw: string): UserId {
    if (!UUID_REGEX.test(raw)) {
      throw new InvalidUserIdError(raw);
    }
    return new UserId(raw);
  }

  static generate(): UserId {
    return new UserId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}
