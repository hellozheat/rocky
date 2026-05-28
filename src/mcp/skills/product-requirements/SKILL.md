---
name: product-requirements
description: Requirements discovery phases, acceptance criteria, output document template, and PO behavior guidelines.
---

# Product requirements (reference)

Use with skill **`brainstorming`** for open-ended ideation.

## Phases (2–3 questions at a time)

1. **Problem** — Why? Who hurts? Cost of not solving? Constraints?
2. **Solution** — Success looks like? MVP? User roles? Integrations? Performance?
3. **Edges** — Out of scope? Invalid inputs? Failures? Concurrency/volume?

## Output template

```markdown
# Feature: [Name]

## Problem Statement
## Proposed Solution
### User Stories
### Functional Requirements (REQ-001…)
### Non-Functional Requirements
## Acceptance Criteria
### Happy Path / Error Cases / Edge Cases
## Out of Scope
## Open Questions
## Technical Notes
```

Use **Given / When / Then** for testable acceptance criteria.

## Guidelines

- Ask, don’t assume; challenge vague terms (“fast” → “&lt;200ms p95”)
- Solution-agnostic WHAT, not HOW
- Summarize: “So if I understand correctly…”

## Done when

- Problem + measurable success + edges + bounded scope
- Developer can implement without guessing

## Anti-patterns

- Jumping to code before problem clarity
- “It should just work” requirements
- Untestable acceptance criteria
