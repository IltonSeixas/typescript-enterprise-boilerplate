# Testing

## Philosophy

Tests are written before implementation (TDD). The test suite is organized in two strict tiers: unit tests that run in milliseconds with no external dependencies, and integration tests that run against real infrastructure.

The in-memory adapter exists precisely to make the entire business logic testable without Docker, a database, or any network call.

---

## Running Tests

```bash
# Unit tests only (fast, no external deps)
bun run test

# Watch mode
bun run test:watch

# Coverage report
bun run test:coverage

# Integration tests (in-memory adapters, no external deps)
bun run test:integration

# All tests
bun run test:all
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

Integration tests use the `.integration.spec.ts` suffix and exercise a real adapter end to end — for
example, `interfaces/grpc/server.integration.spec.ts` boots the actual gRPC server wired with the
in-memory repository and token service, then drives it through real `@grpc/grpc-js` clients. No
external infrastructure (database, message broker, container runtime) is required.

```typescript
describe('gRPC server integration', () => {
  let server: Server;
  let clients: ReturnType<typeof loadClients>;

  beforeAll(async () => {
    const userRepository = new InMemoryUserRepository();
    server = createGrpcServer({ /* use cases wired with in-memory adapters */ });

    const port = await startGrpcServer(server, '127.0.0.1', 0);
    clients = loadClients(port);
  });

  afterAll(() => stopGrpcServer(server));

  it('registers, logs in and returns the authenticated profile via GetMe', async () => {
    const registered = await call(clients.auth, 'register', { /* ... */ });
    const session = await call(clients.auth, 'login', { /* ... */ });
    const me = await call(clients.user, 'getMe', {}, bearerMetadata(session.accessToken));

    expect(me.id).toBe(registered.id);
  });
});
```

---

## TDD Workflow

1. Write a failing test that describes the expected behavior
2. Run `bun run test` — confirm it fails for the right reason
3. Write the minimum implementation to make it pass
4. Run `bun run test` — confirm green
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

Coverage reports are generated in CI via `bun test --coverage` and uploaded for review. Pull requests that drop coverage below these targets should be flagged in review.
