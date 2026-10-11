---
name: code-review
description: >-
  Inspect actual git diffs independently of the implementation author and report
  severity-ranked findings. Use before approving PRs, completing tasks, or
  committing significant changes in byteInn.
---

# byteInn Code Review Specialist Skill (`code-review`)

## 1. When to Use This Skill
Activate this skill whenever:
- Inspecting changes prior to git staging or committing.
- Conducting an independent review of newly implemented features or bugfixes.
- Verifying code quality, architecture compliance, security controls, and test coverage.

## 2. Review Checklist & Evaluation Dimensions

### A. Functional Correctness & Invariants
- Are stay date calculations strictly `[arrival, departure)`?
- Are financial values handled using `Decimal` / `numeric(10, 2)` without floating-point errors?
- Are double-booking prevention and room allocations protected in database transactions?
- Does checkout strictly transition rooms to `VACANT_DIRTY`?

### B. Security & Authorization
- Is `requireAuth(allowedRoles)` called server-side on every protected route handler?
- Does authorization rely on active database checks (rejecting disabled/deleted users and stale roles)?
- Are passwords, tokens, and internal error stack traces hidden from responses and client logs?
- Are inputs validated with Zod, and pagination bounded (max limit 100)?
- Is rate limiting applied to brute-force-sensitive entry points (e.g. login)?

### C. Architecture & Quality Foundation
- Is business logic kept inside domain services (`src/modules/*`) rather than inline route handlers?
- Are Server and Client component boundaries respected (`"use client"` only when necessary)?
- Is TypeScript strictness maintained with zero `any` types?
- Are unused imports, variables, or unhandled promises absent?

### D. Verification & Regression Protection
- Did `npm run validate` run with zero errors?
- Are new automated tests present proving both happy paths and edge/adversarial cases?
- Is living documentation updated if contracts or schemas changed?

## 3. Severity Ranking Standard
Categorize all review findings strictly by severity:

| Severity | Definition | Action Required |
| :--- | :--- | :--- |
| **BLOCKER / CRITICAL** | Security bypass, data loss, concurrency race condition, build breakage, or unhandled exception. | Must fix before merge/commit. |
| **HIGH** | Missing server authorization, unvalidated input, floating-point money math, stale token access, or missing regression test. | Must fix before merge/commit. |
| **MEDIUM** | Inefficient query, unpaginated response, missing UI feedback state, or code duplication across modules. | Should fix or formally defer. |
| **LOW / NIT** | Minor naming inconsistency, comment typo, or non-critical formatting improvement. | Optional cleanup. |

## 4. Review Report Format
Every code review output must cite concrete files and line numbers:

```markdown
### Review Summary: [APPROVED / CHANGES REQUESTED]

#### 1. Critical & High Severity Issues
- **[File:Line]**: Description of issue, impact, and actionable fix.

#### 2. Medium Severity Issues
- **[File:Line]**: Description and recommendation.

#### 3. Low Severity & Quality Observations
- **[File:Line]**: Suggestion.

#### 4. Architecture & Regression Verdict
- Statement confirming whether tests ran and whether changes conform to byteInn V1 standards.
```
