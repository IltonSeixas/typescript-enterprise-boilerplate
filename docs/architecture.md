# Architecture

## Overview

This project implements Clean Architecture (also known as Hexagonal Architecture or Ports & Adapters) combined with Domain-Driven Design tactical patterns. The goal is a codebase where the business rules can be read, tested, and reasoned about without any knowledge of Fastify, Drizzle, or any other infrastructure library.

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        interfaces/                          │
│              (Fastify routes, gRPC services)                │
├─────────────────────────────────────────────────────────────┤
│                       application/                          │
│              (Use Cases, Input/Output Ports)                │
├─────────────────────────────────────────────────────────────┤
│                         domain/                             │
│          (Entities, Value Objects, Repository Interfaces)   │
├──────────────────────────┬──────────────────────────────────┤
│     infrastructure/      │         infrastructure/          │
│   (PostgreSQL adapter)   │      (In-Memory adapter)         │
└──────────────────────────┴──────────────────────────────────┘
```

**Dependency rule:** source code dependencies point inward only. The domain knows nothing about the layers outside it.

---

## Directory Structure

```
src/
├── domain/
│   ├── entities/
│   │   └── user.entity.ts           # User aggregate root
│   ├── value-objects/
│   │   ├── email.vo.ts              # Email — validated on construction
│   │   ├── password-hash.vo.ts      # Opaque wrapper around hashed string
│   │   └── user-id.vo.ts            # UUID branded type
│   ├── repositories/
│   │   └── user.repository.ts       # Interface: the only contract infra must fulfill
│   └── errors/
│       └── domain.errors.ts         # Domain error classes
│
├── application/
│   ├── use-cases/
│   │   ├── register-user.use-case.ts
│   │   ├── login-user.use-case.ts
│   │   ├── refresh-token.use-case.ts
│   │   └── logout-user.use-case.ts
│   ├── ports/
│   │   ├── password-hasher.port.ts  # Interface: hash + verify
│   │   └── token-issuer.port.ts     # Interface: issue + validate JWT
│   └── dtos/
│       ├── register-user.dto.ts     # Zod schema + inferred type
│       └── auth-output.dto.ts
│
├── infrastructure/
│   ├── persistence/
│   │   ├── in-memory/
│   │   │   └── user.repository.ts
│   │   └── postgres/
│   │       └── user.repository.ts
│   ├── security/
│   │   ├── argon2-hasher.ts
│   │   └── jwt-service.ts
│   ├── cache/
│   │   └── redis-store.ts
│   └── telemetry/
│       └── setup.ts
│
├── interfaces/
│   ├── http/
│   │   ├── server.ts
│   │   ├── plugins/
│   │   │   ├── auth.plugin.ts
│   │   │   ├── rate-limit.plugin.ts
│   │   │   └── security-headers.plugin.ts
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       └── user.routes.ts
│   └── grpc/
│       └── user.service.ts
│
└── main.ts                          # Composition root
```

---

## Domain Layer

### Entities

`User` is the aggregate root. Construction goes through a static `create` factory method that returns `Result<User, DomainError>`. Fields are private; state is exposed through getters. The entity carries no framework decorators.

### Value Objects

Value objects are immutable classes with private constructors. `Email.create('bad')` returns `Err(new InvalidEmailError())`. Once constructed, the value is always valid.

```typescript
export class Email {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<Email, DomainError> {
    // validation
    return ok(new Email(raw));
  }

  toString(): string {
    return this.value;
  }
}
```

### Repository Interfaces

```typescript
export interface UserRepository {
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

The interface lives in `domain/repositories/` — owned by the domain, not by the infrastructure that implements it. TypeScript's structural typing means any class with these methods satisfies the contract automatically.

---

## Application Layer

Each use case is a class that receives its dependencies via constructor injection (tsyringe). It exposes a single `execute` method. No infrastructure package is imported here.

```typescript
@injectable()
export class RegisterUserUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
    @inject('PasswordHasher') private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(input: RegisterUserDto): Promise<void> {
    // 1. parse + validate DTO (Zod)
    // 2. check uniqueness
    // 3. hash password
    // 4. construct entity
    // 5. persist
  }
}
```

---

## Infrastructure Layer

Classes in `infrastructure/` implement the domain/application interfaces. They are the only place where `drizzle-orm`, `argon2`, `ioredis`, or any external package is imported.

The in-memory adapter uses a `Map<string, User>` and is production-equivalent for the domain — it satisfies the same interface contract.

---

## Wiring (main.ts)

`main.ts` is the composition root. It registers concrete implementations in the tsyringe container, then builds and starts the Fastify server.

```typescript
const adapter = process.env.ADAPTER ?? 'memory';

if (adapter === 'postgres') {
  container.register<UserRepository>('UserRepository', {
    useClass: PostgresUserRepository,
  });
} else {
  container.register<UserRepository>('UserRepository', {
    useClass: InMemoryUserRepository,
  });
}
```
