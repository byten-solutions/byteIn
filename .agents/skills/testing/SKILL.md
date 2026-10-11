---
name: testing
description: >-
  Select, author, and execute automated tests in byteInn using the native Node.js
  test runner and isolated PostgreSQL environment. Use when writing unit,
  integration, and regression tests for services and APIs.
---

# byteInn QA & Testing Specialist Skill (`testing`)

## 1. When to Use This Skill
Activate this skill whenever:
- Adding automated tests for new features, bugfixes, or security remediations.
- Running and diagnosing test failures via `npm test`.
- Verifying regression resistance across room allocation, reservation, check-in, check-out, and billing lifecycles.

## 2. Test Environment & Toolchain
- **Test Runner**: Node.js native test runner (`node:test`) executed via `tsx` (`npm test` maps to `tsx --test tests/**/*.test.ts`).
- **Assertions**: `node:assert/strict` (`assert.equal`, `assert.ok`, `assert.rejects`, `assert.throws`).
- **Database**: Real PostgreSQL instance configured via `DATABASE_URL` in `.env`.
- **Location**: All test suites reside in `tests/<feature>.test.ts`.

## 3. Core Testing Conventions
1. **Isolated Data Lifecycles**:
   - Use `before()` to seed necessary parent records (properties, categories, users).
   - Use `after()` to clean up test audit logs, allocations, reservations, and users safely.
   - Use distinct identifiers (e.g. `test-room-101`, `auth-test@byteinn.local`) to avoid collision.
2. **Explicit Verification Points**:
   - Test happy paths and verify resulting database state via `prisma.<model>.findUnique`.
   - Test domain errors and business rule violations (e.g. double-booking, invalid status transitions) with `assert.rejects`.
   - Test boundary values (e.g., negative page numbers, limits > 100, invalid dates).
   - Test authorization guards (`requireAuth`, `enforceRole`) with both matching and non-matching roles.
3. **No Mocks for Database Transactions**:
   - Execute tests against real PostgreSQL whenever testing transactions (`prisma.$transaction`), locking, or constraints.

## 4. Test Suite Structure Template
```typescript
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { MyService } from "../src/modules/my-feature/my-feature.service";

describe("My Feature Test Suite", () => {
  let testRecordId: string;

  before(async () => {
    // Setup test fixtures
  });

  after(async () => {
    // Teardown test fixtures
    if (testRecordId) {
      await prisma.myModel.deleteMany({ where: { id: testRecordId } });
    }
  });

  it("should perform business operation successfully", async () => {
    const result = await MyService.doOperation({ ... });
    assert.ok(result.id);
    testRecordId = result.id;
  });

  it("should reject invalid inputs or concurrent conflicts", async () => {
    await assert.rejects(
      async () => {
        await MyService.doOperation({ ... });
      },
      /Expected error message/
    );
  });
});
```

## 5. Verification Commands
Always run and verify:
```bash
npm test                 # Run complete test suite
npx tsx --test tests/my.test.ts  # Run targeted test file
npm run validate         # Full gate: tsc + eslint + tests
```
Never declare tests passed without running the command and verifying zero failed tests.
