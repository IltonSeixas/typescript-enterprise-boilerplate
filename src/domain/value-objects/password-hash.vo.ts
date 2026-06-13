import { InvalidPasswordError } from '../errors/domain.errors.js';

const ARGON2ID_PREFIX = '$argon2id$';

export class PasswordHash {
  private constructor(private readonly value: string) {}

  static fromHash(hash: string): PasswordHash {
    if (!hash.startsWith(ARGON2ID_PREFIX)) {
      throw new InvalidPasswordError('hash must be an Argon2id digest');
    }
    return new PasswordHash(hash);
  }

  toString(): string {
    return this.value;
  }
}
