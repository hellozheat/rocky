---
name: nestjs-hexagonal
description: Hexagonal NestJS/TypeScript backend — domain/application/infrastructure layers, Zod validation, DI tokens, NestJS patterns, testing, and review checklists.
---

# NestJS hexagonal architecture (reference)

Load this skill for layer rules, Zod/NestJS patterns, and checklists. The **`nestjs-hexagonal`** agent is the short playbook.

## Project structure

```
├── .github/workflows/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/                 # Zod-validated env
│   ├── domain/                 # entities, ports, services (no NestJS ORM)
│   ├── application/
│   │   ├── requests/           # Input DTOs (Zod)
│   │   ├── responses/          # Output DTOs when needed
│   │   ├── use-cases/
│   │   └── controllers/
│   └── infrastructure/       # postgres/, mongodb/, email/ — adapter + module each
└── test/
    ├── unit/
    ├── integration/
    └── doubles/
```

## Core principles

### Hexagonal

- **Domain**: Pure TypeScript + Zod; no NestJS, TypeORM, Mongoose
- **Application**: Use cases + thin controllers; depends only on domain
- **Infrastructure**: Adapters implement ports

### SOLID & KISS

- One use case = one business action
- Use cases depend on **ports** via injection tokens, never concrete adapters
- Direct transforms: `new Entity({ ...data })` — no `fromEntity` / `toEntity`
- Prefer returning **domain entities** from controllers (avoid extra response DTOs unless serialization requires it)

## Code rules

### TypeScript

- Strict mode; no `any`
- Async/await for all I/O
- Abstract classes for ports (runtime DI)
- Custom domain exception hierarchy
- `readonly` where immutable; composition over inheritance
- Package manager: **pnpm** (unless repo uses yarn/npm — match project)

### Zod

- Entity validation in domain; request DTOs in application
- `ZodValidationPipe` at controller boundaries
- Compose with `.extend()`, `.pick()`, `.omit()`, `.refine()`
- Config/env validated with Zod

### NestJS

- Constructor injection; one module per adapter or bounded context
- Thin controllers → use cases only
- `@Catch()` filters map domain errors → HTTP
- Guards for auth; symbols/tokens for port binding
- Swagger via `@anatine/zod-openapi` when used in repo

### Testing

- **Test doubles** for internal components (repos, use cases)
- **Mocks** only for external systems (email, Stripe, S3, …)
- Jest + `Test.createTestingModule()`; target ≥ 80% coverage on critical paths
- See agent **`test-writer-nestjs.md`** for templates

### Infrastructure

- One folder per adapter: `adapter.ts` + `entities/` or `schemas/` + `module.ts`
- Adapters implement abstract classes from `domain/ports/`

## Checklist

- [ ] Three layers; domain has no framework imports
- [ ] Use cases `@Inject(TOKEN)` ports, not adapters
- [ ] Zod at boundaries; exception filters + guards
- [ ] CI: test, lint, typecheck; Docker + `.env.example` when applicable

## Avoid

- NestJS/ORM imports in `domain/`
- `any`; mocking internal repos/services
- Response DTO proliferation; transformation helper classes
- `index.ts` barrels that hide dependencies
- Injecting adapters into use cases

## Essential dependencies (typical)

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@nestjs/testing": "^10.0.0",
    "jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Related

- **`test-writer-nestjs`** agent — Jest/Supertest patterns
- **`async-python-patterns`** — N/A (Python stack uses **`fastapi-hexagonal`**)
- **`feature-implementation`** — phased delivery / PR gate
