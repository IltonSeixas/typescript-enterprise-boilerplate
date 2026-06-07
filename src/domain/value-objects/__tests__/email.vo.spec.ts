import { describe, it, expect } from 'bun:test';
import { Email } from '../email.vo.js';
import { InvalidEmailError } from '../../errors/domain.errors.js';

describe('Email', () => {
  it('accepts a valid email address', () => {
    const email = Email.create('user@example.com');
    expect(email.toString()).toBe('user@example.com');
  });

  it('rejects an email without @', () => {
    expect(() => Email.create('invalidemail.com')).toThrow(InvalidEmailError);
  });

  it('equals() returns true for identical emails', () => {
    const a = Email.create('user@example.com');
    const b = Email.create('user@example.com');
    expect(a.equals(b)).toBe(true);
  });

  it('equals() returns false for different emails', () => {
    const a = Email.create('user@example.com');
    const b = Email.create('other@example.com');
    expect(a.equals(b)).toBe(false);
  });

  it('normalises email to lowercase', () => {
    const email = Email.create('User@Example.COM');
    expect(email.toString()).toBe('user@example.com');
  });
});
