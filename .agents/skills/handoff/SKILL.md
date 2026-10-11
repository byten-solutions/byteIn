---
name: handoff
description: >-
  Prepare concise, reproducible engineering summaries and handoff artifacts for
  multi-turn sessions, subagents, or human engineering reviews in byteInn. Use
  when concluding a complex task or pausing multi-stage work.
---

# byteInn Engineering Handoff Skill (`handoff`)

## 1. When to Use This Skill
Activate this skill whenever:
- Concluding a multi-step task, feature phase, or refactor.
- Pausing work for user review between lifecycle stages.
- Preparing a context-dense handoff artifact for a subsequent agent or session.

## 2. Core Handoff Principles
1. **Evidence-Based**: Only claim what has been verified with actual command output. Distinguish verified tests from unverified scenarios.
2. **High Signal-to-Noise**: Provide exact file paths, diff statistics, and test outputs without dumping irrelevant code.
3. **Reproducibility**: List exact commands needed to run the application, run tests, or continue the task.

## 3. Standard Handoff Format Template

```markdown
# byteInn Engineering Handoff: [Feature / Task Name]

## 1. Task Objective & Scope
- **Objective**: Summary of what was requested.
- **Scope Status**: [COMPLETED / IN PROGRESS / BLOCKED]

## 2. Changes Implemented
- `path/to/file.ts`: Brief summary of changes and architectural rationale.
- `path/to/component.tsx`: UI or client adjustments.

## 3. Verification & Evidence
- `npm run validate`: [Result, error count, test pass count]
- `npm run build`: [Next.js build status, route count]
- Manual / Subagent Testing: [Screenshots, endpoints called, observed UI states]

## 4. Key Architectural Decisions
- Concrete decisions made and why alternatives were rejected.

## 5. Unresolved Questions & Next Actions
- Specific next steps for the incoming engineer or next agent turn.
- Any blocker requiring user feedback.
```

## 4. Handoff Checklist
- [ ] No uncommitted or temporary scratch files left behind
- [ ] Verification results backed by executed command outputs
- [ ] All modified files cited with links
- [ ] Clear next step defined
