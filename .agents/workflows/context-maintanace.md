---
name: context-maintenance
description: >-
  Keep authoritative project documentation, architecture notes, READMEs,
  and agent instructions synchronized with real code changes. Use whenever
  modifying database schemas, API contracts, design patterns, or core workflows.
---

# byteInn Context Maintenance Skill (`context-maintenance`)

## 1. When to Use This Skill
Activate this skill whenever:
- Adding, altering, or removing API endpoints or request/response contracts.
- Updating the Prisma schema, migrations, or database models.
- Changing architecture boundaries, design system tokens, or coding standards.
- Completing a planned roadmap phase in [docs/byteInn_Implementation_Plan_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Implementation_Plan_v1.md).

## 2. Authoritative Document Hierarchy
Always maintain the authoritative source of truth:

| Document | Scope of Authority |
| :--- | :--- |
| `AGENTS.md` | Mandatory global rules, orchestrator loop, core invariants, index. |
| `docs/byteInn_Architecture_v1.md` | Monolithic Next.js stack, boundaries, scope exclusions. |
| `docs/byteInn_Database_Design_v1.md` | PostgreSQL schemas, models, relations, field constraints. |
| `docs/byteInn_Low_Level_Architecture_v1.md` | Route handlers, module methods, request flows, DTOs. |
| `docs/byteInn_Implementation_Plan_v1.md` | Phased roadmap status, acceptance criteria, completion logs. |
| `docs/CODING_STANDARDS.md` | TypeScript rules, linting, error patterns, file structure. |
| `docs/UI_UX_GUIDELINES.md` | Design system, visual tokens, application shell, accessibility. |
| `docs/AGENT_WORKFLOW.md` | Instruction hierarchy, specialist roles, lifecycle, handoffs. |
| `src/README.md` | Module structure, backend/frontend layout, API patterns. |
| `prisma/README.md` | Database migrations, seeding, connection configuration. |

## 3. Maintenance Principles
1. **Never Document Unimplemented Features as Completed**: If an endpoint or feature is in progress or proposed, document it as `PLANNED` or `IN_PROGRESS`, never `IMPLEMENTED`.
2. **Prevent Documentation Churn**: Update docs when contracts, schemas, or behaviors materially change. Do not rewrite documentation for trivial internal refactoring.
3. **Keep Docs Actionable & Navigable**: Use tables, bullet points, and clickable markdown links. Avoid lengthy prose that wastes token context.
4. **Identify Conflicts**: If documentation contradicts active code, identify the discrepancy explicitly and resolve it with user approval.

## 4. Maintenance Checklist
- [ ] Schema changes reflected in `docs/byteInn_Database_Design_v1.md` and `prisma/README.md`
- [ ] API endpoint updates reflected in `docs/byteInn_Low_Level_Architecture_v1.md` and `src/README.md`
- [ ] Phase progress checked off in `docs/byteInn_Implementation_Plan_v1.md`
- [ ] UI component additions noted in `docs/UI_UX_GUIDELINES.md`
- [ ] Links and line references verified
