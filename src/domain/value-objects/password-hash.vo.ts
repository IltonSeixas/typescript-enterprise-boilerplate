export class PasswordHash {
  private constructor(private readonly value: string) {}

  static fromHash(hash: string): PasswordHash {
    return new PasswordHash(hash);
  }

  toString(): string {
    return this.value;
  }
}
