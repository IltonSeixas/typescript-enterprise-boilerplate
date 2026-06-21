import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { User } from '../../../domain/entities/user.entity.js';
import { OwnerAlreadyExistsError } from '../../../domain/errors/domain.errors.js';
import type { PaginatedUsers, UserRepository } from '../../../domain/repositories/user.repository.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { UserId } from '../../../domain/value-objects/user-id.vo.js';

@injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();
  private ownerLock = false;

  findById(id: UserId): Promise<User | null> {
    return Promise.resolve(this.store.get(id.toString()) ?? null);
  }

  findByEmail(email: Email): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email.equals(email)) {
        return Promise.resolve(user);
      }
    }
    return Promise.resolve(null);
  }

  save(user: User): Promise<void> {
    this.store.set(user.id.toString(), user);
    return Promise.resolve();
  }

  update(user: User): Promise<void> {
    this.store.set(user.id.toString(), user);
    return Promise.resolve();
  }

  async saveFirstOwner(user: User): Promise<void> {
    if (this.ownerLock || (await this.hasOwner())) {
      throw new OwnerAlreadyExistsError();
    }
    this.ownerLock = true;
    this.store.set(user.id.toString(), user);
  }

  hasOwner(): Promise<boolean> {
    for (const user of this.store.values()) {
      if (user.role === 'owner') {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  findPaginated(offset: number, limit: number): Promise<PaginatedUsers> {
    const sorted = [...this.store.values()].sort((a, b) => {
      const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
      return byCreatedAt !== 0 ? byCreatedAt : a.id.toString().localeCompare(b.id.toString());
    });

    return Promise.resolve({
      items: sorted.slice(offset, offset + limit),
      total: sorted.length,
    });
  }

  clear(): void {
    this.store.clear();
    this.ownerLock = false;
  }
}
