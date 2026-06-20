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
│   └── value-objects/
│       └── __tests__/
│           └── email.vo.spec.ts              # value object tests
│
├── application/
│   └── use-cases/
│       └── __tests__/
│           ├── register-user.use-case.spec.ts   # use case tests with hand-written port fakes
│           ├── login-user.use-case.spec.ts
│           ├── get-user.use-case.spec.ts
│           ├── update-profile.use-case.spec.ts
│           └── change-password.use-case.spec.ts
│
├── infrastructure/
│   └── persistence/
│       └── in-memory/
│           └── __tests__/
│               └── user.repository.spec.ts
│
└── interfaces/
    └── grpc/
        └── server.integration.spec.ts        # boots the real gRPC server end to end
```

---

## Unit Tests

Unit tests live in `*.spec.ts` files alongside the source. They cover:

- Value object construction (valid and invalid inputs)
- Entity invariant enforcement
- Use case business logic (success and failure paths)

Repository and port dependencies are replaced with plain object literals that implement the port interfaces — small factory functions (`makeUserRepo`, `makeHasher`) build them with sensible defaults that individual tests override per case. The suite uses Bun's built-in test runner (`bun:test`), not Vitest or Jest.

### Example — Value Object

```typescript
import { describe, it, expect } from 'bun:test';

describe('Email', () => {
  it('accepts a valid email address', () => {
    const email = Email.create('user@example.com');
    expect(email.toString()).toBe('user@example.com');
  });

  it('rejects an email without @', () => {
    expect(() => Email.create('invalidemail.com')).toThrow(InvalidEmailError);
  });

  it('normalises email to lowercase', () => {
    const email = Email.create('User@Example.COM');
    expect(email.toString()).toBe('user@example.com');
  });
});
```

### Example — Use Case with a Hand-Written Repository Fake

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

const makeUserRepo = (overrides?: Partial<UserRepository>): UserRepository => ({
  findById: async () => null,
  findByEmail: async () => null,
  save: async () => {},
  update: async () => {},
  saveFirstOwner: async () => {},
  hasOwner: async () => false,
  ...overrides,
});

const makeHasher = (): PasswordHasherPort => ({
  hash: async (plain) => `hashed:${plain}`,
  verify: async (hash, plain) => hash === `hashed:${plain}`,
});

describe('RegisterUserUseCase', () => {
  let hasher: PasswordHasherPort;

  beforeEach(() => {
    hasher = makeHasher();
  });

  it('registers a member successfully', async () => {
    const repo = makeUserRepo();
    const useCase = new RegisterUserUseCase(repo, hasher);

    const output = await useCase.execute(validInput());

    expect(output.email).toBe('user@example.com');
  });

  it('rejects registration when the email is already taken', async () => {
    const repo = makeUserRepo({ findByEmail: async () => makeExistingUser() });
    const useCase = new RegisterUserUseCase(repo, hasher);

    await expect(useCase.execute(validInput())).rejects.toThrow(EmailAlreadyExistsError);
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

## Architecture Tests

`eslint-plugin-boundaries`, configured in `eslint.config.js`, enforces the dependency rule from [ADR-0001](adr/0001-clean-architecture.md) as a real, automatically-run lint check rather than a convention checked only in review — see [ADR-0006](adr/0006-eslint-boundaries-architecture-test.md). It resolves the real module graph (via `eslint-import-resolver-typescript`) and runs as part of the default `bun run lint` step, failing the build if:

- `domain/` imports from `application/`, `infrastructure/`, or `interfaces/`
- `application/` imports from `infrastructure/` or `interfaces/`

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
