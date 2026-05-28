---
name: jest-nestjs
description: Jest testing for NestJS hexagonal apps — real internal wiring, mock outbound adapters, SQLite in-memory, fixtures, Supertest patterns.
---

# Jest + NestJS hexagonal (reference)

## Golden rule

- **Real**: use cases, repositories, TypeORM entities, domain objects in `Test.createTestingModule`
- **Mock**: outbound only (Sendgrid, Stripe, S3, third-party HTTP)

## Layout

```
src/application/use-cases/**/*.spec.ts    # co-located
test/fixtures/external.ts                 # mockEmailSuccess(), mockStripeDeclined(), …
test/app.e2e-spec.ts                      # optional full HTTP
```

## Fixtures (`test/fixtures/external.ts`)

```typescript
export function mockEmailSuccess() {
  return {
    provide: SendgridEmailAdapter,
    useValue: { send: jest.fn().mockResolvedValue(true) },
  }
}
```

## Use case test (SQLite in-memory)

```typescript
module = await Test.createTestingModule({
  imports: [
    TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:', entities: [UserEntity], synchronize: true }),
    TypeOrmModule.forFeature([UserEntity]),
  ],
  providers: [CreateUserUseCase, TypeOrmUserRepository, mockEmailSuccess()],
}).compile()
```

- `afterEach` → `module.close()`
- Assert persistence via **real** repository, not only return value
- Swap external mock by rebuilding module when testing timeout/decline paths

## Controller / Supertest

- Thin controller tests: mock use case **only** if repo already does; prefer integration with real use case + mocked outbound
- `supertest` against `INestApplication` for HTTP contract tests when present in repo

## Never

- Mock internal repositories or use cases with divergent behavior
- Skip `module.close()` (connection leaks)

## Commands

```bash
pnpm jest
pnpm jest create-user.use-case.spec
pnpm jest --coverage
```

## Related

- **`nestjs-hexagonal`** agent — implementation layout
- **`test-writer-nestjs`** agent — invoke policy
