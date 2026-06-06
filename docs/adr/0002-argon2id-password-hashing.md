# ADR-0002: Use Argon2id for Password Hashing

**Date:** 2024-01-01  
**Status:** Accepted

---

## Context

Node.js/Bun password hashing options range from pure-JS implementations to native bindings. Security and performance both matter.

## Decision

**Argon2id** via the `argon2` npm package, which uses native bindings to the reference C implementation. Parameters: 64 MB memory, 3 iterations, 4 lanes (OWASP recommended).

## Consequences

**Positive:**
- Argon2id is the OWASP recommendation for new systems.
- Native bindings mean performance comparable to Rust/Go implementations.
- The `argon2` package handles salt generation and constant-time verification internally.

**Negative:**
- Native bindings require a build step (`node-gyp`) — adds complexity to Docker builds and CI. Mitigated by using pre-built binaries on supported platforms.

## Alternatives Considered

- **bcrypt (`bcryptjs`)** — pure JS, no build step, but not memory-hard and has a 72-byte input limit.
- **`node:crypto` scrypt** — available in stdlib but Argon2id is preferred by OWASP.
- **`@node-rs/argon2`** — Rust-backed alternative; viable but `argon2` has broader adoption.
