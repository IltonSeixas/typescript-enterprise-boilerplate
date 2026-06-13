import { describe, it, expect } from 'bun:test';
import { User, type UserRole } from '../user.entity.js';
import { Email } from '../../value-objects/email.vo.js';
import { PasswordHash } from '../../value-objects/password-hash.vo.js';
import { UserId } from '../../value-objects/user-id.vo.js';
import { InsufficientPermissionsError } from '../../errors/domain.errors.js';

const userWithRole = (role: UserRole): User =>
  User.reconstitute({
    id: UserId.generate(),
    name: 'Test User',
    email: Email.create('test@example.com'),
    passwordHash: PasswordHash.fromHash('$argon2id$password'),
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('User.canPromoteTo', () => {
  it('owner pode promover para qualquer papel', () => {
    const owner = userWithRole('owner');

    expect(owner.canPromoteTo('owner')).toBe(true);
    expect(owner.canPromoteTo('admin')).toBe(true);
    expect(owner.canPromoteTo('member')).toBe(true);
  });

  it('admin só pode promover para member', () => {
    const admin = userWithRole('admin');

    expect(admin.canPromoteTo('member')).toBe(true);
    expect(admin.canPromoteTo('admin')).toBe(false);
    expect(admin.canPromoteTo('owner')).toBe(false);
  });

  it('member não pode promover ninguém', () => {
    const member = userWithRole('member');

    expect(member.canPromoteTo('member')).toBe(false);
    expect(member.canPromoteTo('admin')).toBe(false);
    expect(member.canPromoteTo('owner')).toBe(false);
  });
});

describe('User.changeRole', () => {
  it('aplica a mudança de papel quando o ator tem permissão', () => {
    const owner = userWithRole('owner');
    const target = userWithRole('member');

    const updated = target.changeRole('admin', owner);

    expect(updated.role).toBe('admin');
    expect(updated.id.equals(target.id)).toBe(true);
  });

  it('lança InsufficientPermissionsError quando o ator não tem permissão', () => {
    const admin = userWithRole('admin');
    const target = userWithRole('member');

    expect(() => target.changeRole('owner', admin)).toThrow(InsufficientPermissionsError);
  });
});
