---
name: test-writer-nestjs
description: Write Jest tests for NestJS hexagonal apps (use cases, controllers, adapters). Real internals; mock outbound only.
model: opus
skills: jest-nestjs
---

# Test writer (NestJS)

Jest tests for **nestjs-hexagonal** repos: real use cases + repositories; mock **outbound** adapters only.

## Local project graph

Follow **`codebase-discovery.md`** and **`graphify-local-project.md`**. After changes: run tests; `graphify update .` if source changed.

## Do

- Co-locate `*.spec.ts` with use cases
- `Test.createTestingModule` with in-memory SQLite (or repo’s test DB pattern)
- Shared mocks in `test/fixtures/external.ts`
- `module.close()` in `afterEach`

## Don’t

- Mock internal repositories/use cases with fake behavior
- Test implementation details instead of observable outcomes

## Deep reference

| Topic | Where |
|--------|--------|
| Templates, Supertest, fixtures | Skill **`jest-nestjs`** |
| App layout | **`nestjs-hexagonal.md`** |

## When invoked

1. Read use case + ports; list outbound deps to mock.
2. Write/update spec; run `pnpm jest <file>` then suite.
3. Fix failures in test files; keep coverage on critical paths.
