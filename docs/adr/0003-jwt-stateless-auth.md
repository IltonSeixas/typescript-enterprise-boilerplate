# ADR-0003: Stateless JWT Access Tokens with Server-Side Refresh Tokens

**Date:** 2026-06-06  
**Status:** Accepted

---

## Context

Authentication requires a balance between statelessness and revocability.

## Decision

Hybrid model: stateless JWT HS256 access token (TTL 15 min) + opaque UUID refresh token stored in Redis (TTL 7 days, rotated on use, HttpOnly + SameSite=Strict cookie).

## Consequences

**Positive:**
- Hot path requires no database lookup.
- Sessions are revocable by deleting the Redis key.
- HttpOnly cookie prevents XSS-based token theft.
- Refresh token rotation limits the window of exposure for a stolen token.

**Negative:**
- Access tokens cannot be revoked within their 15-minute window without a `jti` blocklist.

## Alternatives Considered

- **Pure stateless JWT** — no revocation; unacceptable for a security boilerplate.
- **Iron-session / encrypted cookies** — simpler but less portable across services.
- **OAuth2/OIDC** — correct for multi-service auth; out of scope.
