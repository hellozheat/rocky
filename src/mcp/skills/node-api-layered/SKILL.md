---
name: node-api-layered
description: Layered Node HTTP APIs — Express/Fastify/Hono and Next.js Route Handlers; router → use case → repository.
---

# Node API layered (reference)

> For **NestJS/FastAPI hexagonal** backends use **`nestjs-hexagonal`** / **`fastapi-hexagonal`** instead.

## Flow

**Router / Route Handler → Use case → Repository** — no SQL or business rules in the router.

## Structure

```
src/routes/ | src/handlers/
src/use-cases/
src/repositories/ | src/infra/
src/middleware/, validators/, types/, config/
app/api/**/route.ts          # Next.js thin handlers
```

## Router (thin)

```ts
router.post('/users', async (req, res, next) => {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await createUser({ input });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});
```

## Use case

- One operation per module; no `req`/`res`
- Domain errors thrown; mapped at HTTP boundary

## Repository

- DB/ORM/HTTP persistence; typed methods; no status codes

## Next Route Handler

```ts
export async function POST(request: Request) {
  const input = createUserSchema.parse(await request.json());
  const user = await createUser({ input });
  return Response.json(user, { status: 201 });
}
```

## Testing

- Unit-test use cases with mocked repositories
- **`vitest-writer`** for TS tests; `tests.mdc` for conventions

## Related

- **`nextjs-app-router`** — `app/` UI + `app/api`
- `docs://architecture-style`
