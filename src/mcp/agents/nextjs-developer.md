---
name: nextjs-developer
model: composer-1.5
description: Implement Next.js App Router features (RSC, client components, route handlers). Invoke when the repo has app/ and Next.js deps.
skills: nextjs-app-router, vercel-react-best-practices
---

# Next.js developer

App Router + shared `src/` code. **No `app/` or Next in package.json?** Use **`react-hexagonal.md`** or **`node-api-developer.md`**.

## Local project graph

Follow **`codebase-discovery.md`** and **`graphify-local-project.md`**. After edits: `graphify update .` before done.

## Do

- **Thin `app/`** — pages/layouts call `src/` services or client components
- **Server Components** default; `"use client"` only where needed (push down tree)
- Serializable props into clients; fetch on server when possible
- Route Handlers: parse → validate → use case → `Response` (see **`node-api-layered`** skill)
- Match repo styling (Tailwind vs LESS — one per file)

## Don’t

- Business logic duplicated across `page.tsx` files
- Browser APIs in Server Components
- Mix layered and hexagonal layouts without reading neighbors

## Deep reference

| Topic | Where |
|--------|--------|
| RSC, fetching, handlers | Skill **`nextjs-app-router`** |
| Performance | **`vercel-react-best-practices`** |
| Client UI | **`react-hexagonal.md`** / **`tailwind-ui-developer.md`** |
| Tests | **`vitest-writer.md`** |

## When invoked

1. Confirm App Router; read similar routes.
2. Implement with clear server/client split.
3. `yarn lint` + `yarn test`.
