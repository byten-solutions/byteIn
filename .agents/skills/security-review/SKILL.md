---
name: security-review
description: >-
  Review and harden authentication, authorization, session lifecycle,
  cryptographic operations, rate limiting, and sensitive data handling in byteInn.
  Use whenever modifying auth, cookies, passwords, or public API boundaries.
---

# byteInn Security Specialist Skill (`security-review`)

## 1. When to Use This Skill
Activate this skill whenever:
- Adding or modifying authentication, login, logout, or session management.
- Creating new API endpoints, sensitive mutations, or role-restricted operations.
- Handling passwords, cryptographic keys, tokens, or environment secrets.
- Reviewing security posture against audit findings or OWASP guidelines.

## 2. Security Invariants & Baseline Controls

### A. Secret & Key Integrity
- `SESSION_SECRET` must be validated via `validateSessionSecret()`:
  - Mandatory, non-empty, minimum 32 characters.
  - Blacklist checks prevent placeholder defaults (`INSECURE_DEFAULT_SECRETS`).
  - Algorithm strictly pinned to `HS256` (`algorithms: ["HS256"]`).
- Never store secrets or API keys in source code or version control.

### B. Server-Side Authentication & Session Freshness
- Every protected route handler must call `await requireAuth([permittedRoles])`.
- Verification must query PostgreSQL to confirm:
  - User exists (reject deleted users with 401).
  - User status is `ACTIVE` (reject disabled users with 403).
  - User role in database permits the requested operation (prevent stale JWT claims).
- Cookies must enforce: `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, and `secure: process.env.NODE_ENV === "production"`.

### C. Password & Credential Security
- Passwords hashed with `bcryptjs` (minimum 10 salt rounds).
- Login endpoint must use constant-time dummy password hashing for non-existent users to eliminate timing leaks and account enumeration.
- Login passwords and authorization tokens must NEVER be logged in console or audit records.

### D. Abuse Prevention & Input Sanitization
- Sliding-window rate limiting on `/api/auth/login` (IP limit: 10/min, Account limit: 5/min) returning 429 with `Retry-After`.
- All endpoint query parameters and request bodies must be parsed and strictly bounded via Zod schemas.
- Pagination limits must be capped (maximum 100) to prevent denial of service.
- Date inputs must be validated for impossible calendar dates via `normalizeDate()`.

### E. Error Masking & Information Disclosure
- Use `handleApiError(error)` on all API route handlers.
- Unexpected internal server errors must return generic HTTP 500 responses without exposing stack traces, SQL queries, or connection strings.

## 3. Security Review Checklist
- [ ] No hardcoded secrets or fallbacks in code or tests
- [ ] `requireAuth` enforced on server-side handler
- [ ] Database-backed active account check executed
- [ ] Zod schema sanitizes and bounds all inputs
- [ ] No sensitive credentials printed in audit logs or console
- [ ] Automated tests cover adversarial cases (tampered tokens, expired tokens, disabled accounts)
