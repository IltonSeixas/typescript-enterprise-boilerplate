# Testing

## Philosophy

Tests are written before implementation (TDD). The test suite is organized in two strict tiers: unit tests that run in milliseconds with no external dependencies, and integration tests that run against real infrastructure.

The in-memory adapter exists precisely to make the entire business logic testable without Docker, a database, or any network call.

---

## Running Tests

```bash
# Unit tests only (fast, no external deps)
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Integration tests (requires PostgreSQL and Redis)
npm run test:integration

# All tests
npm run test:all
```

---

## Test Structure

```
src/
├── domain/
│   ├── value-objects/
│   │   ├── email.vo.spec.ts          # value object tests
│   │   └── password-hash.vo.spec.ts
│   └── entities/
│       └── user.entity.spec.ts       # entity invariant tests
│
├── application/
│   └── use-cases/
│       ├── register-user.use-case.spec.ts   # use case tests with mock repos
│       └── login-user.use-case.spec.ts
│
└── infrastructure/
    └── persistence/
        └── postgres/
            └── user.repository.integration.spec.ts
```

---

## Unit Tests

Unit tests live in `*.spec.ts` files alongside the source. They cover:

- Value object construction (valid and invalid inputs)
- Entity invariant enforcement
- Use case business logic (success and failure paths)

Repository and port dependencies are replaced with plain TypeScript class implementations of the port interfaces — or `vi.fn()` for simpler cases.

### Example — Value Object

```typescript
describe('Email', () => {
  it('accepts a valid email address', () => {
    const result = Email.create('user@example.com');
    expect(result.isOk()).toBe(true);
  });

  it('rejects an address without an @ sign', () => {
    const result = Email.create('notanemail');
    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidEmailError);
  });
});
```

### Example — Use Case with Mock Repository

```typescript
describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let userRepo: UserRepository;
  let hasher: PasswordHasherPort;

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn().mockResolvedValue(null), // user does not exist
      save: vi.fn().mockResolvedValue(undefined),
    };
    hasher = {
      hash: vi.fn().mockResolvedValue('$argon2id$...'),
      verify: vi.fn(),
    };
    useCase = new RegisterUserUseCase(userRepo, hasher);
  });

  it('saves a new user when the email is not taken', async () => {
    await expect(useCase.execute(validInput())).resolves.not.toThrow();
    expect(userRepo.save).toHaveBeenCalledOnce();
  });

  it('throws when the email is already registered', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(existingUser());

    await expect(useCase.execute(validInput())).rejects.toThrow(EmailAlreadyExistsError);
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});
```

---

## Integration Tests

Integration tests use the `.integration.spec.ts` suffix and run against real infrastructure via Testcontainers.

```typescript
describe('PostgresUserRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let repo: PostgresUserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();
    repo = new PostgresUserRepository(container.getConnectionUri());
    await runMigrations(container.getConnectionUri());
  });

  afterAll(() => container.stop());

  it('saves and retrieves a user by email', async () => {
    const user = UserFactory.create();
    await repo.save(user);

    const found = await repo.findByEmail(user.email);
    expect(found?.id.toString()).toBe(user.id.toString());
  });
});
```

---

## TDD Workflow

1. Write a failing test that describes the expected behavior
2. Run `npm run test` — confirm it fails for the right reason
3. Write the minimum implementation to make it pass
4. Run `npm run test` — confirm green
5. Refactor under green

Never write implementation code without a failing test first.

---

## Coverage Target

| Layer | Target |
|---|---|
| Domain (entities + value objects) | 100% |
| Application (use cases) | 100% |
| Infrastructure adapters | 80%+ |
| HTTP handlers | 70%+ (covered by integration tests) |

Coverage is enforced in CI via Vitest's `coverage.thresholds` configuration. Builds fail if coverage drops below the defined thresholds.
