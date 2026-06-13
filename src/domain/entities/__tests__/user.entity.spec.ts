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

describe('User.canChangeRoleOf', () => {
  it('owner pode alterar o papel de outro usuário', () => {
    const owner = userWithRole('owner');
    const target = userWithRole('member');

    expect(owner.canChangeRoleOf(target)).toBe(true);
  });

  it('owner não pode alterar o próprio papel', () => {
    const owner = userWithRole('owner');

    expect(owner.canChangeRoleOf(owner)).toBe(false);
  });

  it('admin não pode alterar papéis', () => {
    const admin = userWithRole('admin');
    const target = userWithRole('member');

    expect(admin.canChangeRoleOf(target)).toBe(false);
  });

  it('member não pode alterar papéis', () => {
    const member = userWithRole('member');
    const target = userWithRole('member');

    expect(member.canChangeRoleOf(target)).toBe(false);
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

  it('lança InsufficientPermissionsError quando o ator tenta alterar o próprio papel', () => {
    const owner = userWithRole('owner');

    expect(() => owner.changeRole('admin', owner)).toThrow(InsufficientPermissionsError);
  });
});
