---
name: diagnosing-bugs
description: >-
  Reproduce, isolate, fix, and regression-test defects in byteInn. Use when
  investigating reported issues, unexpected behavior, error logs, or failing
  test suites.
---

# byteInn Bug Investigation & Remediation Skill (`diagnosing-bugs`)

## 1. When to Use This Skill
Activate this skill whenever:
- A user reports a defect, unexpected behavior, or crash in byteInn.
- An automated test fails during development or CI validation.
- Unhandled server exceptions (500) appear in route handlers.

## 2. Six-Step Investigation Lifecycle

### Step 1: Evidence Gathering & Understanding
- Inspect error messages, stack traces, and request payloads.
- Identify the exact API route handler, domain service, and database interaction.
- Cross-reference with authoritative specifications in `docs/`.

### Step 2: Minimal Reproduction
- Write a minimal failing test case in `tests/` reproducing the exact failure scenario before editing any application code.
- Run the test to confirm the reproduction.
- If an automated test cannot reproduce it, simulate the execution path with identical inputs.

### Step 3: Root-Cause Isolation
- Trace data flow and invariants.
- Determine whether the issue is:
  - Client-side validation / schema coercion failure (Zod)
  - Database constraint / transaction collision (Prisma / PostgreSQL)
  - Timezone or calendar rollover anomaly (e.g. `normalizeDate`)
  - Stale session / authorization denial (`requireAuth`)
  - Floating-point arithmetic error (must use `Decimal`)

### Step 4: Minimal Targeted Fix
- Implement the smallest correct change that addresses the root cause without refactoring unrelated files.
- Preserve existing interfaces, DTOs, and workflows.

### Step 5: Regression Testing & Edge Cases
- Run the previously failing test to prove the fix.
- Test related edge cases (boundary values, null/undefined inputs, concurrent updates).
- Run the full test suite (`npm test`).

### Step 6: Documentation & Report
- Update living documentation if the defect revealed an inaccurate specification.
- Document the root cause, fix, and verification evidence in the final task report.

## 3. Strict Prohibitions
- ❌ NEVER suppress errors using `try/catch` without handling or logging.
- ❌ NEVER use `@ts-ignore`, unsafe type assertions (`as any`), or weaken ESLint rules to hide an error.
- ❌ NEVER claim a bug is fixed without executing an automated test or verification command.
