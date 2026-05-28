# Architecture profiles

Detect the user’s repo before imposing structure. Prefer **hexagonal** playbooks when `src/domain/` exists.

## Detection order

1. `app/` + Next.js deps → **nextjs-app-router** (`nextjs-developer.md`)
2. `src/domain/` + `src/application/` → **hexagonal**
   - NestJS (`@nestjs/core`) → `nestjs-hexagonal.md`
   - FastAPI / Python → `fastapi-hexagonal.md`
   - React UI → `react-hexagonal.md`
3. `src/components/atoms` + `connected/` → **layered-react-spa** (legacy handbook layout)
4. No `components/` but `src/routes` or Express → **node-api-only**
5. Else: graphify + read neighbors — do not force foreign layouts

## hexagonal (preferred when present)

```
src/
├── domain/           # entities, ports, pure logic
├── application/      # use-cases / hooks / controllers / routes
└── infrastructure/   # adapters (api, db, email, …)
```

See agents: `react-hexagonal.md`, `nestjs-hexagonal.md`, `fastapi-hexagonal.md`.

## layered-react-spa (legacy)

```
src/
├── components/atoms/
├── components/connected/
├── context/, actions/, reducers/, selectors/
├── services/, pages/, utils/, config/
```

Styling: `styles.module.less` per component. See `tailwind-ui-developer.md` when using Tailwind instead.

## nextjs-app-router

Hexagonal or layered logic; routes in `app/`. See `nextjs-developer.md` for server/client boundaries.

## node-api-only

Router → use case → repository. See `node-api-developer.md` and `docs://architecture-style`.

## Styling variants

| Profile | When |
|---------|------|
| Tailwind | `tailwindcss` in `package.json` → `tailwind-ui-developer.md` |
| LESS modules | No Tailwind → match `react-hexagonal` + repo conventions |
