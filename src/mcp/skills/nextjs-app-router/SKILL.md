---
name: nextjs-app-router
description: Next.js App Router — Server vs Client Components, data fetching, thin routes, Route Handlers, integration with hexagonal or layered React.
---

# Next.js App Router (reference)

## Structure

```
app/                    # layout.tsx, page.tsx, loading.tsx, error.tsx, api/**/route.ts
src/                    # shared UI + services (match repo)
```

**Thin `app/`** — logic in `src/` services/use cases/modules.

## Server vs client

| Default (Server) | `"use client"` |
|------------------|----------------|
| async fetch, DB, secrets | useState, effects, events, context |
| no browser APIs | hooks, getContextStores |

Push `"use client"` **down** the tree (small islands).

```tsx
// app/dashboard/page.tsx
export default async function Page() {
  const data = await getDashboardData();
  return <DashboardClient initialData={data} />;
}
```

## Data fetching

- Fetch in Server Components or `src/lib` / `src/services`
- Pass **serializable** props to clients (no functions unless Server Actions pattern exists in repo)

## Route Handlers

`app/api/.../route.ts` = HTTP adapter: parse → validate → use case → `Response.json`. See **`node-api-developer`** or **`nestjs-hexagonal`** for backend style.

## UI subtrees

- **Hexagonal** → **`react-hexagonal.md`** in client trees
- **Layered** → atoms (props) / connected (`getContextStores`) — only if repo uses that layout
- **Tailwind vs LESS** — one per file; see **`tailwind-ui-developer`**

## Rules

- App Router (`app/`) unless repo is Pages Router
- `next/link`, `next/image`, `metadata` / `generateMetadata` as neighbors do
- Files &lt; ~500 lines; `yarn lint` + `yarn test`

## Related

- **`vercel-react-best-practices`** — performance
- **`vitest-writer`** — component tests
