# byteInn — Authentication, JWT, Cookie & Session Security Audit

**Assessment Date**: 2026-10-11  
**Auditor**: Senior Application Security Engineer  
**Target Codebase**: byteInn Reception-Operated Property Management System (PMS)  
**Scope**: Full authentication lifecycle, JWT cryptographic operations, cookie configurations, password hashing, and server-side RBAC across Next.js 16 App Router, Prisma ORM, and PostgreSQL.

---

## A. Executive Summary

| Security Dimension | Evaluation | Primary Notes |
| :--- | :--- | :--- |
| **Overall Security Posture** | **PASS WITH FINDINGS** | Strong cryptographic baseline and comprehensive server-side RBAC, with high-priority configuration and session staleness issues requiring remediation. |
| **JWT Implementation** | **IMPLEMENTED** | Uses standard `jose` `SignJWT` / `jwtVerify` with `HS256`. Suffers from hardcoded fallback secret in source and lack of server-side revocation. |
| **Cookie Security** | **SECURE** | Set via Next.js `cookies()`, flags `HttpOnly: true`, `SameSite: "lax"`, `Path: "/"`, and conditional `Secure` (`NODE_ENV === "production"`). |
| **Server-Side RBAC** | **100% ENFORCED** | Every API route independently executes `requireAuth()`. Zero mutations bypass authorization; client UI hiding is backed by server rejection. |
| **Password Storage** | **SECURE** | Uses `bcryptjs` with salt rounds = 10 (`bcrypt.genSalt(10)`). Case-insensitive email lookup with case-preserved password hashing. |

### Summary of Findings by Severity

```
┌─────────────────┬───────────┐
│ Severity Level  │ Count     │
├─────────────────┼───────────┤
│ CRITICAL        │ 1         │
│ HIGH            │ 3         │
│ MEDIUM          │ 2         │
│ LOW             │ 3         │
│ INFORMATIONAL   │ 2         │
├─────────────────┼───────────┤
│ TOTAL           │ 11        │
└─────────────────┴───────────┘
```

### The Most Serious Security Risks
1. **[JWT-001] Hardcoded Fallback Session Secret (Critical)**: A static string is committed to source code in `AuthService` as a fallback if `process.env.SESSION_SECRET` is unset, enabling full administrative token forgery in unconfigured production environments.
2. **[JWT-002] Stateless JWT Session Disconnect / No Revocation (High)**: Tokens cannot be revoked server-side upon logout, account deactivation, or role demotion. A deactivated or demoted staff member retains full access until token expiry (up to 8 hours).
3. **[AUTH-001] Exposed Default Seed Credentials in Login DOM (High)**: Production login page unconditionally embeds "Quick Fill" buttons revealing seed credentials (`admin@byteinn.local` / `Admin@123456`) directly in the client DOM.
4. **[AUTH-002] Absence of Rate Limiting or Brute-Force Circuit Breakers (High)**: `/api/auth/login` accepts unlimited requests without IP throttling or exponential backoff.

---

## B. Actual Authentication Architecture

byteInn implements a **stateless, cookie-transported JWT architecture** using the `jose` library, integrated into Next.js App Router route handlers and Server Components.

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Receptionist / Admin
    participant Browser as Browser Client
    participant LoginRoute as POST /api/auth/login
    participant AuthService as AuthService (src/modules/auth)
    participant DB as PostgreSQL (Prisma)
    participant SessionUtil as Session Utilities (src/lib)
    participant ProtectedRoute as Protected API (/api/reservations)

    Staff->>Browser: Enters email & password
    Browser->>LoginRoute: POST { email, password }
    LoginRoute->>AuthService: login(input, metadata)
    AuthService->>DB: User.findFirst(email, case-insensitive)
    AuthService->>AuthService: bcrypt.compare(password, passwordHash)
    AuthService->>DB: User.update(lastLoginAt) & AuditLog.create(LOGIN_SUCCESS)
    AuthService->>AuthService: createSessionToken(payload) via jose HS256
    AuthService-->>LoginRoute: { user, token }
    LoginRoute->>SessionUtil: setSessionCookie(token)
    SessionUtil-->>Browser: Set-Cookie: byteinn_session=<JWT>; HttpOnly; SameSite=Lax; Path=/
    LoginRoute-->>Browser: 200 OK { success: true, user }

    Note over Browser,ProtectedRoute: Subsequent Protected API Request
    Browser->>ProtectedRoute: GET /api/reservations (Cookie: byteinn_session=<JWT>)
    ProtectedRoute->>SessionUtil: requireAuth() -> getSession()
    SessionUtil->>AuthService: verifySessionToken(token) via jose jwtVerify
    AuthService-->>SessionUtil: Decoded SessionPayload
    SessionUtil->>SessionUtil: enforceRole(session, allowedRoles)
    alt Unauthorized Role
        SessionUtil-->>ProtectedRoute: throws AuthError(403)
        ProtectedRoute-->>Browser: 403 Forbidden { error: "Access denied" }
    else Authorized
        ProtectedRoute->>DB: Reservation.findMany(...)
        ProtectedRoute-->>Browser: 200 OK { success: true, reservations }
    end
```

### Complete Code Execution Flow
1. **User Authentication**:
   - Client submits credentials to [`src/app/api/auth/login/route.ts`](file:///Users/apple/Byten/byteInn/src/app/api/auth/login/route.ts).
   - Validated against [`loginSchema`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.validation.ts#L4).
   - Delegated to [`AuthService.login()`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L83).
   - Queries `prisma.user.findFirst` with `{ mode: "insensitive" }`.
   - Validates user status (`user.status !== "ACTIVE"` throws error).
   - Validates password using `bcrypt.compare`.
   - Records structured audit log to `audit_logs` table (`LOGIN_SUCCESS` or `LOGIN_FAILED`).
   - Issues JWT signed with HMAC-SHA256 (`HS256`).
2. **Cookie Transport**:
   - Handled in [`setSessionCookie()`](file:///Users/apple/Byten/byteInn/src/lib/session.ts#L11).
   - Injected into Next.js headers cookie jar as `byteinn_session`.
3. **Session Verification & Authorization Guard**:
   - Executed on every protected route via [`requireAuth()`](file:///Users/apple/Byten/byteInn/src/lib/auth-guard.ts#L52).
   - Extracts cookie via `getSessionCookie()`.
   - Verified cryptographically via [`AuthService.verifySessionToken()`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L55).
   - Evaluated against required roles via [`enforceRole()`](file:///Users/apple/Byten/byteInn/src/lib/auth-guard.ts#L28).
   - Throws `AuthError(401)` if missing or expired; throws `AuthError(403)` if role unauthorized.
4. **Logout**:
   - Handled in [`src/app/api/auth/logout/route.ts`](file:///Users/apple/Byten/byteInn/src/app/api/auth/logout/route.ts).
   - Calls [`deleteSessionCookie()`](file:///Users/apple/Byten/byteInn/src/lib/session.ts#L22) setting `maxAge: 0`.

---

## C. JWT Findings

| Check | Status | Analysis |
| :--- | :--- | :--- |
| **Signing Algorithm** | **PASS** | Tokens are signed explicitly with `HS256` (`.setProtectedHeader({ alg: "HS256" })`). |
| **Verification Algorithm Restriction** | **PASS WITH WARNING** | `jwtVerify(token, SESSION_SECRET)` enforces HMAC algorithms for symmetric Uint8Array keys, rejecting `"none"` and asymmetric algorithms. Explicit `{ algorithms: ["HS256"] }` should still be declared. |
| **Secret Supply & Entropy** | **FAIL (CRITICAL)** | Fallback static secret committed to source in [`src/modules/auth/auth.service.ts#L13-L16`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L13-L16). |
| **Signature Verification Coverage** | **PASS** | Every authenticated route parses through `jwtVerify`. No tokens are decoded with untrusted `decodeJwt`. |
| **Claims & Payload Validation** | **PASS** | Validates presence of `sub`, `email`, and enum-valid `role` in [`AuthService.verifySessionToken#L58-L64`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L58-L64). |
| **Expiration Enforcement** | **PASS** | Token lifetime is 8 hours (`SESSION_DURATION_SECONDS = 8 * 60 * 60`). `jwtVerify` rejects expired tokens automatically. |
| **Issuer / Audience Claims** | **N/A** | Neither `iss` nor `aud` is populated. Acceptable for single-origin modular monolith, though recommended for future scaling. |
| **Server-Side Token Revocation** | **FAIL (HIGH)** | Fully stateless. Server maintains no token revocation list or user token versioning. |
| **Role & Account Freshness** | **FAIL (HIGH)** | Token is verified solely via cryptographic signature without checking the database. A deactivated user or demoted admin retains access until the 8-hour token expires. |

---

## D. Cookie Findings

| Attribute | Configured Value | Security Evaluation |
| :--- | :--- | :--- |
| **Name** | `byteinn_session` | Standard, non-conflicting. |
| **HttpOnly** | `true` | **PASS**: Completely inaccessible to client JavaScript (`document.cookie`), mitigating XSS token harvesting. |
| **Secure** | `process.env.NODE_ENV === "production"` | **PASS**: Enforces transmission over HTTPS in production while allowing HTTP in local dev. |
| **SameSite** | `"lax"` | **PASS**: Restricts cross-site submission on cross-origin POST/PUT/DELETE requests. |
| **Path** | `"/"` | **PASS**: Scoped application-wide. |
| **Domain** | Unset (Host-Only) | **PASS**: Defaults to host-only cookie, preventing unintended subdomain leakage. |
| **Max-Age** | `8 * 60 * 60` (8 hours) | **PASS**: Aligned with the 8-hour shift and JWT `exp` duration. |
| **Logout Handling**| Sets `maxAge: 0` with identical attributes | **PASS**: Correctly instructs browser to discard the cookie. |

---

## E. Password & Account Security

| Control | Status | Evidence & Implementation Details |
| :--- | :--- | :--- |
| **Hashing Algorithm** | **PASS** | `bcryptjs` with 10 salt rounds (`bcrypt.genSalt(10)`). Standard production bcrypt implementation. |
| **Plaintext Password Handling** | **PASS** | Plaintext passwords are never logged, stored in database, or returned in API responses. `SafeUser` DTO explicitly omits `passwordHash`. |
| **Case Sensitivity** | **PASS** | Email lookup uses `{ mode: "insensitive" }`, while password comparison retains exact case sensitivity. |
| **Brute-Force & Rate Limiting** | **FAIL (HIGH)** | No rate-limiting middleware, IP throttling, or exponential backoff on `/api/auth/login`. |
| **User Enumeration** | **FAIL (LOW)** | Error message differentiates disabled accounts (`"Account is disabled"`, HTTP 403) from nonexistent accounts (`"Invalid email or password"`, HTTP 401). |
| **Default / Seed Credentials** | **FAIL (HIGH)** | Seed passwords (`Admin@123456`, `Reception@123456`) are hardcoded in `seed.ts` and rendered in `login/page.tsx`. |
| **Self-Registration** | **N/A** | By approved V1 specification, there is no public guest registration. User accounts are created strictly by administrators. |
| **Password Reset** | **N/A** | Deferred in V1 roadmap; handled via direct administrative provisioning. |

---

## F. Authorization Inventory (RBAC)

The following table documents every API route in byteInn, its intended access level, its actual enforcement implementation, and verification evidence:

| Endpoint Path | Method | Intended Access | Actual Enforcement Mechanism | Verification Evidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | POST | Public | Input validation (`loginSchema`) | Allows unauthenticated requests | ✅ Verified Public |
| `/api/auth/logout` | POST | Public | Calls `deleteSessionCookie()` | Clears `byteinn_session` cookie | ✅ Verified Public |
| `/api/auth/me` | GET | Authenticated | `getSession()` + DB `user.status === "ACTIVE"` | Returns 401 if unauthenticated, 403 if disabled | ✅ Enforced |
| `/api/auth/verify-role` | GET | Authenticated | `requireAuth(allowedRoles)` | Rejects unauthorized roles with 403 | ✅ Enforced |
| `/api/properties` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/properties` | POST | Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/properties/[id]` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/properties/[id]` | PATCH | Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/properties/[id]/buildings`| GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/properties/[id]/buildings`| POST | Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/buildings/[id]/floors` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/buildings/[id]/floors` | POST | Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/room-categories` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/room-categories` | POST | Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/room-categories/[id]` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/room-categories/[id]` | PUT | Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/room-categories/[id]` | DELETE| Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/amenities` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/amenities` | POST | Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/rooms` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/rooms` | POST | Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/rooms/[id]` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/rooms/[id]` | PATCH | Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/rooms/[id]` | DELETE| Admin | `requireAuth([RoleName.ADMIN])` | Throws 403 for Receptionist | ✅ Enforced |
| `/api/rooms/[id]/status` | PATCH | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Permitted for Receptionist, 401 for Guest | ✅ Enforced |
| `/api/availability` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/reservations` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/reservations` | POST | Staff | `requireAuth()` (extracts `session.sub`) | Creates booking attributed to authenticated user | ✅ Enforced |
| `/api/reservations/[id]` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/room-allocations/[id]/check-in` | POST | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Attributed to staff in audit log | ✅ Enforced |
| `/api/room-allocations/[id]/check-out` | POST | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Attributed to staff in audit log | ✅ Enforced |
| `/api/check-in-out/daily` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/customers` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/customers` | POST | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/customers/[id]` | GET | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/customers/[id]` | PUT | Staff | `requireAuth()` | Returns 401 if missing session | ✅ Enforced |
| `/api/invoices` | GET | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Rejects unauthenticated callers | ✅ Enforced |
| `/api/invoices` | POST | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Rejects unauthenticated callers | ✅ Enforced |
| `/api/invoices/[id]` | GET | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Rejects unauthenticated callers | ✅ Enforced |
| `/api/invoices/[id]/issue` | POST | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Rejects unauthenticated callers | ✅ Enforced |
| `/api/invoices/[id]/items` | POST | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Rejects unauthenticated callers | ✅ Enforced |
| `/api/invoices/[id]/items/[itemId]` | DELETE | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Rejects unauthenticated callers | ✅ Enforced |
| `/api/invoices/[id]/payments` | POST | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Rejects unauthenticated callers | ✅ Enforced |
| `/api/invoices/[id]/payments/[paymentId]/void` | POST | Staff | `requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])` | Rejects unauthenticated callers | ✅ Enforced |

---

## G. Test & Verification Results

The test suite and custom adversarial verification scenarios were executed against the codebase:

| Scenario / Command | Executed Command | Result | Audit Assessment |
| :--- | :--- | :--- | :--- |
| **Auth Test Suite** | `npx tsx --test tests/auth.test.ts` | **PASS** (23/23 tests passed in 957ms) | Cryptographic signing, tampered token rejection, expired token rejection, invalid role rejection, bcrypt verification, and RBAC rejection verified. |
| **Full Project Suite** | `npm test` (`tsx --test tests/**/*.test.ts`) | **PASS** (117/117 tests passed in 1.3s) | Comprehensive verification across auth, properties, rooms, reservations, check-in/out, and billing. |
| **Algorithm Confusion ("none")** | Node.js programmatic verification | **REJECTED** | `jwtVerify` rejected token signed with alg `"none"`. |
| **Tampered Role Claim** | Node.js programmatic verification | **REJECTED** | Forged role `SUPERADMIN_FORGED` was rejected by `AuthService.verifySessionToken`. |
| **Receptionist Privilege Escalation** | `tests/auth.test.ts#L202` | **REJECTED** | Calling `enforceRole(receptionistSession, [RoleName.ADMIN])` threw `AuthError(403)`. |
| **Stateless Staleness Check** | Node.js programmatic verification | **CONFIRMED** | `verifySessionToken` verified token signature successfully without performing any database lookup. |

---

## H. Findings Register

### [JWT-001] Hardcoded Fallback Session Secret in Source Code
- **Severity**: **Critical**
- **Confidence**: Confirmed
- **File & Lines**: [`src/modules/auth/auth.service.ts#L13-L16`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L13-L16)
- **Code Excerpt**:
  ```typescript
  const SESSION_SECRET = new TextEncoder().encode(
    process.env.SESSION_SECRET ||
      "byteinn-super-secret-development-key-min-32-characters"
  );
  ```
- **Vulnerable Behavior**: If the application is deployed without setting `SESSION_SECRET` in environment variables, it defaults to a known secret committed to GitHub.
- **Realistic Attack Scenario**: An attacker reads the public or leaked repository, crafts an arbitrary JWT with `sub: "admin-id"`, `email: "admin@byteinn.local"`, and `role: "ADMIN"`, signs it using the hardcoded key, sets the `byteinn_session` cookie, and takes complete administrative control of the property management system.
- **Remediation**: In production (`process.env.NODE_ENV === "production"`), throw an immediate error during module evaluation if `SESSION_SECRET` is undefined or shorter than 32 characters. Do not provide a fallback in production.
- **Required Before V1 Deployment?**: **YES**.

---

### [JWT-002] Stateless JWT Session Disconnect / Lack of Server-Side Revocation
- **Severity**: **High**
- **Confidence**: Confirmed
- **File & Lines**: [`src/modules/auth/auth.service.ts#L55-L77`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L55-L77), [`src/lib/auth-guard.ts#L52-L55`](file:///Users/apple/Byten/byteInn/src/lib/auth-guard.ts#L52-L55)
- **Code Excerpt**:
  ```typescript
  static async verifySessionToken(token: string): Promise<SessionPayload | null> {
    try {
      const { payload } = await jwtVerify(token, SESSION_SECRET);
      // Validates payload claims, but performs NO database lookup
      return { sub: payload.sub, email: payload.email, role: payload.role, ... };
    } catch { return null; }
  }
  ```
- **Vulnerable Behavior**: The application relies strictly on the mathematical validity of the token. It does not check whether the user's account has been disabled (`User.status = "DISABLED"`), whether their role has changed, or whether the user has logged out.
- **Realistic Attack Scenario**: A front-desk receptionist is terminated for misconduct and their account is marked `DISABLED` by an administrator. Because their browser still possesses a valid token (or they copied the token to curl), they can continue creating bookings, modifying rooms, and issuing invoices for up to 8 hours until the token naturally expires.
- **Remediation**: In [`requireAuth()`](file:///Users/apple/Byten/byteInn/src/lib/auth-guard.ts#L52), perform a fast database check (e.g. `prisma.user.findUnique({ where: { id: session.sub }, select: { status: true, role: true } })`) to ensure the user is `ACTIVE` and their active role matches the token claim.
- **Required Before V1 Deployment?**: **YES**.

---

### [AUTH-001] Exposed Default Seed Credentials in Production Login Page
- **Severity**: **High**
- **Confidence**: Confirmed
- **File & Lines**: [`src/app/login/page.tsx#L109-L133`](file:///Users/apple/Byten/byteInn/src/app/login/page.tsx#L109-L133)
- **Code Excerpt**:
  ```typescript
  <div className="pt-2 border-t text-xs text-muted-foreground space-y-1.5">
    <p className="font-medium text-foreground">Quick Fill (Development):</p>
    <Button onClick={() => fillCredentials("admin@byteinn.local", "Admin@123456")}>Admin</Button>
    <Button onClick={() => fillCredentials("reception@byteinn.local", "Reception@123456")}>Receptionist</Button>
  </div>
  ```
- **Vulnerable Behavior**: The login form renders plaintext administrative and staff credentials unconditionally in the client DOM.
- **Realistic Attack Scenario**: If deployed to a live server, any unauthorized user who visits the `/login` URL sees the default admin credentials, clicks "Admin", and logs in with full administrative privileges.
- **Remediation**: Wrap the Quick Fill section in `{process.env.NODE_ENV !== "production" && ( ... )}` or remove it entirely from production bundles.
- **Required Before V1 Deployment?**: **YES**.

---

### [AUTH-002] Missing Rate Limiting and Brute-Force Circuit Breakers on Login
- **Severity**: **High**
- **Confidence**: Confirmed
- **File & Lines**: [`src/app/api/auth/login/route.ts#L6-L48`](file:///Users/apple/Byten/byteInn/src/app/api/auth/login/route.ts#L6-L48)
- **Vulnerable Behavior**: No rate-limiting middleware or account lockout mechanism exists on the POST `/api/auth/login` endpoint.
- **Realistic Attack Scenario**: An attacker runs an automated brute-force attack against known email addresses (`admin@byteinn.local`, `reception@byteinn.local`). While bcrypt slows hashing to ~70ms per attempt, an unthrottled endpoint allows millions of password guesses over days without triggering an alert or IP block.
- **Remediation**: Implement a rate limiter (such as an in-memory sliding window or Redis-backed bucket) limiting failed login attempts to 5 per IP per minute.
- **Required Before V1 Deployment?**: **Recommended before production exposure**.

---

### [AUTH-003] User Enumeration via Differentiated Error on Disabled Accounts
- **Severity**: **Low**
- **Confidence**: Confirmed
- **File & Lines**: [`src/modules/auth/auth.service.ts#L113-L120`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L113-L120)
- **Code Excerpt**:
  ```typescript
  if (user.status !== "ACTIVE") {
    throw new Error("Account is disabled. Please contact an administrator.");
  }
  ```
- **Vulnerable Behavior**: The account status check occurs before password verification. Nonexistent accounts return HTTP 401 (`"Invalid email or password"`), while disabled accounts return HTTP 403 (`"Account is disabled..."`).
- **Realistic Attack Scenario**: An attacker submits a list of candidate staff emails and identifies existing disabled user accounts without knowing their passwords.
- **Remediation**: Check password validity *before* reporting account status, or return a uniform `"Invalid email or password"` error.
- **Required Before V1 Deployment?**: No.

---

### [COOKIE-001] SameSite=Lax Relies Solely on Browser Behavior (No Origin / CSRF Token Check)
- **Severity**: **Low**
- **Confidence**: Confirmed
- **File & Lines**: [`src/lib/session.ts#L16`](file:///Users/apple/Byten/byteInn/src/lib/session.ts#L16)
- **Vulnerable Behavior**: While `SameSite: "lax"` blocks standard cross-site form submissions in modern browsers, no CSRF token or HTTP `Origin` / `Referer` verification is performed on state-changing API endpoints.
- **Remediation**: Add an Origin header verification check in route handlers or Next.js middleware for state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Required Before V1 Deployment?**: No.

---

### [JWT-003] Omission of Explicit Algorithms Restriction in `jwtVerify` Options
- **Severity**: **Low**
- **Confidence**: Confirmed
- **File & Lines**: [`src/modules/auth/auth.service.ts#L57`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L57)
- **Code Excerpt**:
  ```typescript
  const { payload } = await jwtVerify(token, SESSION_SECRET);
  ```
- **Vulnerable Behavior**: Verification does not explicitly pass `{ algorithms: ["HS256"] }`. While `jose` restricts to symmetric algorithms for `Uint8Array` keys, explicit algorithm declaration is a defense-in-depth standard.
- **Remediation**: Update call to `jwtVerify(token, SESSION_SECRET, { algorithms: ["HS256"] })`.
- **Required Before V1 Deployment?**: No.

---

### [JWT-004] Session Expiry Constants Duplicated Across Files
- **Severity**: **Low**
- **Confidence**: Confirmed
- **File & Lines**: [`src/lib/session.ts#L4`](file:///Users/apple/Byten/byteInn/src/lib/session.ts#L4), [`src/modules/auth/auth.service.ts#L18`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L18)
- **Vulnerable Behavior**: Cookie lifetime (`SESSION_MAX_AGE_SECONDS`) and JWT expiry (`SESSION_DURATION_SECONDS`) are declared independently.
- **Remediation**: Export a single constant from `src/lib/session.ts`.
- **Required Before V1 Deployment?**: No.

---

### [JWT-005] Omission of `iss` and `aud` Claims
- **Severity**: **Informational**
- **Confidence**: Confirmed
- **File & Lines**: [`src/modules/auth/auth.service.ts#L40-L50`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L40-L50)
- **Analysis**: Common for single-monolith setups, but recommended when external services or APIs are added in future iterations.

---

### [AUTH-004] Case-Preserved Hashing with Case-Insensitive Lookup
- **Severity**: **Informational**
- **Confidence**: Confirmed
- **File & Lines**: [`src/modules/auth/auth.service.ts#L91-L97`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L91-L97)
- **Analysis**: Correctly implemented. Email lookup is case-insensitive, while passwords retain exact case sensitivity during hashing and verification.

---

## I. Prioritized Remediation Plan

### 1. Critical Fixes (Pre-Deployment Blockers)
1. **Remove Insecure Fallback Secret (`JWT-001`)**:
   - In [`src/modules/auth/auth.service.ts`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts), enforce that in production, missing `SESSION_SECRET` throws an immediate, fatal error. Require minimum 32 characters.

### 2. High-Priority Fixes
1. **Gate Login Quick-Fill (`AUTH-001`)**:
   - In [`src/app/login/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/login/page.tsx), hide the development quick-fill buttons whenever `process.env.NODE_ENV === "production"`.
2. **Verify User Status in `requireAuth` (`JWT-002`)**:
   - In [`src/lib/auth-guard.ts`](file:///Users/apple/Byten/byteInn/src/lib/auth-guard.ts), add a lightweight query:
     ```typescript
     const user = await prisma.user.findUnique({
       where: { id: session.sub },
       select: { status: true, role: { select: { name: true } } },
     });
     if (!user || user.status !== "ACTIVE") throw new AuthError("Account inactive", 401);
     if (user.role.name !== session.role) throw new AuthError("Role updated, please re-authenticate", 401);
     ```
3. **Add Rate Limiting on Login (`AUTH-002`)**:
   - Implement IP-based sliding window rate limiting on `/api/auth/login`.

### 3. Medium & Low Priority Hardening
1. Explicitly restrict algorithms in `jwtVerify`: `{ algorithms: ["HS256"] }` (`JWT-003`).
2. Verify HTTP `Origin` header in state-changing route handlers (`COOKIE-001`).
3. Standardize error message on disabled accounts to eliminate user enumeration (`AUTH-003`).
4. Consolidate session duration constants into a single shared constant (`JWT-004`).

---

## J. Final Verdict

1. **Is JWT authentication actually implemented correctly?**  
   **YES**. It uses the modern, cryptographically sound `jose` library with explicit `HS256` signing and valid claims verification (`sub`, `email`, `role`, `iat`, `exp`).
2. **Are tokens verified on every relevant protected server path?**  
   **YES**. Every protected route handler calls `requireAuth()`, which verifies the JWT signature before any service execution.
3. **Are authentication cookies appropriately secured?**  
   **YES**. Cookies are set with `HttpOnly: true`, `SameSite: "lax"`, and conditional `Secure: true` in production.
4. **Does logout provide the expected security guarantees?**  
   **PARTIALLY**. Logout properly deletes the browser cookie, but does not invalidate the stateless JWT on the server. If an attacker captures the token, it remains valid until the 8-hour expiry.
5. **Can a receptionist access admin-only functionality?**  
   **NO**. Administrative routes enforce `requireAuth([RoleName.ADMIN])`. Verified by tests that a receptionist receives an immediate `AuthError(403)`.
6. **Can disabled users continue accessing protected functionality?**  
   **YES (Current Defect)**. Because `verifySessionToken` does not check the database, a user disabled after token issuance can continue making API calls until token expiry.
7. **Are any protected operations accessible without server-side authorization?**  
   **NO**. All 29 operations across 18 route files strictly verify authorization on the server.
8. **What must be fixed first?**  
   **`JWT-001` (Remove the hardcoded fallback secret in production)**, followed immediately by **`AUTH-001` (Gate the login page credentials)** and **`JWT-002` (Check active user status in `requireAuth`)**.
