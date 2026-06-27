import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createPostgresDatabase } from './connection.js';
import { PostgresUserRepository } from './user.repository.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../../domain/value-objects/password-hash.vo.js';
import { OwnerAlreadyExistsError } from '../../../domain/errors/domain.errors.js';

const ARGON2ID_SAMPLE_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$c29tZWhhc2g';

function buildOwner(email: string): User {
  return User.create({
    name: 'Owner',
    email: Email.create(email),
    passwordHash: PasswordHash.fromHash(ARGON2ID_SAMPLE_HASH),
    role: 'owner',
  });
}

describe('PostgresUserRepository.saveFirstOwner', () => {
  let container: StartedPostgreSqlContainer;
  let database: PostgresJsDatabase;
  let repository: PostgresUserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    database = await createPostgresDatabase(container.getConnectionUri(), {
      max: 5,
      idleTimeoutSeconds: 30,
      connectTimeoutSeconds: 10,
      maxLifetimeSeconds: 60,
    });
    repository = new PostgresUserRepository(database);
  }, 60_000);

  afterAll(async () => {
    await container?.stop();
  });

  it('throws OwnerAlreadyExistsError when a second owner row violates the unique index', async () => {
    await repository.saveFirstOwner(buildOwner('owner-one@example.com'));

    await expect(
      repository.saveFirstOwner(buildOwner('owner-two@example.com')),
    ).rejects.toBeInstanceOf(OwnerAlreadyExistsError);
  }, 30_000);
});
