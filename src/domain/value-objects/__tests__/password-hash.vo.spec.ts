import { describe, it, expect } from 'bun:test';
import { PasswordHash } from '../password-hash.vo.js';
import { InvalidPasswordError } from '../../errors/domain.errors.js';

describe('PasswordHash', () => {
  it('accepts an Argon2id digest', () => {
    const hash = PasswordHash.fromHash('$argon2id$v=19$m=65536,t=3,p=4$salt$digest');
    expect(hash.toString()).toBe('$argon2id$v=19$m=65536,t=3,p=4$salt$digest');
  });

  it('rejects a digest that is not Argon2id', () => {
    expect(() => PasswordHash.fromHash('$bcrypt$10$salt$digest')).toThrow(InvalidPasswordError);
  });

  it('rejects a plain-text value', () => {
    expect(() => PasswordHash.fromHash('plain-text-password')).toThrow(InvalidPasswordError);
  });
});
