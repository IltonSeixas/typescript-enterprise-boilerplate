import 'reflect-metadata';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { inject, injectable } from 'tsyringe';
import { User, UserRole } from '../../../domain/entities/user.entity.js';
import { OwnerAlreadyExistsError } from '../../../domain/errors/domain.errors.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../../domain/value-objects/password-hash.vo.js';
import { UserId } from '../../../domain/value-objects/user-id.vo.js';
import { InsertUserRow, UserRow, users } from './schema.js';

@injectable()
export class PostgresUserRepository implements UserRepository {
  constructor(
    @inject('Database') private readonly db: NodePgDatabase,
  ) {}

  async findById(id: UserId): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id.toString()))
      .limit(1);
    return rows[0] ? this.hydrate(rows[0]) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toString()))
      .limit(1);
    return rows[0] ? this.hydrate(rows[0]) : null;
  }

  async save(user: User): Promise<void> {
    await this.db.insert(users).values(this.toRow(user));
  }

  async update(user: User): Promise<void> {
    await this.db
      .update(users)
      .set({
        name: user.name,
        email: user.email.toString(),
        passwordHash: user.passwordHash.toString(),
        role: user.role,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      })
      .where(eq(users.id, user.id.toString()));
  }

  async saveFirstOwner(user: User): Promise<void> {
    try {
      await this.db.insert(users).values(this.toRow(user));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('users_owner_unique_idx')) {
        throw new OwnerAlreadyExistsError();
      }
      throw err;
    }
  }

  async hasOwner(): Promise<boolean> {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'owner'))
      .limit(1);
    return rows.length > 0;
  }

  private hydrate(row: UserRow): User {
    return User.reconstitute({
      id: UserId.create(row.id),
      name: row.name,
      email: Email.create(row.email),
      passwordHash: PasswordHash.fromHash(row.passwordHash),
      role: row.role as UserRole,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toRow(user: User): InsertUserRow {
    return {
      id: user.id.toString(),
      name: user.name,
      email: user.email.toString(),
      passwordHash: user.passwordHash.toString(),
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
