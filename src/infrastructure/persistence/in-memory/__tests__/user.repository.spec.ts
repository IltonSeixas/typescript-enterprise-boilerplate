import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'bun:test';
import { InMemoryUserRepository } from '../user.repository.js';
import { OwnerAlreadyExistsError } from '../../../../domain/errors/domain.errors.js';
import { User } from '../../../../domain/entities/user.entity.js';
import { Email } from '../../../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../../../domain/value-objects/password-hash.vo.js';
import { UserId } from '../../../../domain/value-objects/user-id.vo.js';

const makeUser = (
  id: string,
  email: string,
  role: 'owner' | 'admin' | 'member' = 'member',
): User =>
  User.reconstitute({
    id: UserId.create(id),
    name: 'Test User',
    email: Email.create(email),
    passwordHash: PasswordHash.fromHash('$argon2id$password'),
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('InMemoryUserRepository', () => {
  let repo: InMemoryUserRepository;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
  });

  describe('save e findById', () => {
    it('salva e recupera usuário pelo ID', async () => {
      const user = makeUser('00000000-0000-0000-0000-000000000001', 'alice@example.com');

      await repo.save(user);
      const found = await repo.findById(user.id);

      expect(found).not.toBeNull();
      expect(found?.id.toString()).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('retorna null para ID inexistente', async () => {
      const found = await repo.findById(UserId.create('00000000-0000-0000-0000-000000000099'));

      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('encontra usuário pelo email', async () => {
      const user = makeUser('00000000-0000-0000-0000-000000000001', 'alice@example.com');

      await repo.save(user);
      const found = await repo.findByEmail(Email.create('alice@example.com'));

      expect(found).not.toBeNull();
      expect(found?.email.toString()).toBe('alice@example.com');
    });

    it('retorna null para email inexistente', async () => {
      const found = await repo.findByEmail(Email.create('nobody@example.com'));

      expect(found).toBeNull();
    });
  });

  describe('saveFirstOwner', () => {
    it('salva o primeiro owner com sucesso', async () => {
      const owner = makeUser('00000000-0000-0000-0000-000000000001', 'owner@example.com', 'owner');

      await repo.saveFirstOwner(owner);
      const found = await repo.findById(owner.id);

      expect(found).not.toBeNull();
      expect(found?.role).toBe('owner');
    });

    it('lança OwnerAlreadyExistsError ao tentar salvar segundo owner', async () => {
      const first = makeUser('00000000-0000-0000-0000-000000000001', 'owner1@example.com', 'owner');
      const second = makeUser('00000000-0000-0000-0000-000000000002', 'owner2@example.com', 'owner');

      await repo.saveFirstOwner(first);

      await expect(repo.saveFirstOwner(second)).rejects.toBeInstanceOf(OwnerAlreadyExistsError);
    });
  });

  describe('hasOwner', () => {
    it('retorna false quando não há owner', async () => {
      const result = await repo.hasOwner();

      expect(result).toBe(false);
    });

    it('retorna true depois de salvar um owner', async () => {
      const owner = makeUser('00000000-0000-0000-0000-000000000001', 'owner@example.com', 'owner');

      await repo.saveFirstOwner(owner);
      const result = await repo.hasOwner();

      expect(result).toBe(true);
    });
  });
});
