import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { User } from '../../../domain/entities/user.entity.js';
import { OwnerAlreadyExistsError } from '../../../domain/errors/domain.errors.js';
import { UserRepository } from '../../../domain/repositories/user.repository.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { UserId } from '../../../domain/value-objects/user-id.vo.js';

@injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();
  private ownerLock = false;

  async findById(id: UserId): Promise<User | null> {
    return this.store.get(id.toString()) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email.equals(email)) {
        return user;
      }
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id.toString(), user);
  }

  async update(user: User): Promise<void> {
    this.store.set(user.id.toString(), user);
  }

  async saveFirstOwner(user: User): Promise<void> {
    if (this.ownerLock || (await this.hasOwner())) {
      throw new OwnerAlreadyExistsError();
    }
    this.ownerLock = true;
    this.store.set(user.id.toString(), user);
  }

  async hasOwner(): Promise<boolean> {
    for (const user of this.store.values()) {
      if (user.role === 'owner') {
        return true;
      }
    }
    return false;
  }

  clear(): void {
    this.store.clear();
    this.ownerLock = false;
  }
}
