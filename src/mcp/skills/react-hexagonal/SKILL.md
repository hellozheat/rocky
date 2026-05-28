---
name: react-hexagonal
description: Hexagonal (ports & adapters) React/TypeScript architecture — layer rules, SOLID/KISS, TypeScript/React patterns, responsive design, testing, and review checklists. Use when implementing or reviewing React apps with domain/application/infrastructure separation.
---

# React hexagonal architecture (reference)

Use this skill for **depth** on structure, layer boundaries, code rules, and checklists. The **`react-hexagonal`** agent is the short playbook; load this skill when implementing features, reviewing architecture, or onboarding to a hexagonal React repo.

## Project structure

```
├── src/
│   ├── application/          # UI layer
│   │   ├── components/       # Presentational + container
│   │   ├── hooks/            # Custom hooks (consume domain ports)
│   │   ├── pages/            # Route-level
│   │   └── providers/        # Context providers
│   ├── domain/               # Pure business logic
│   │   ├── entities/
│   │   ├── ports/            # Repository/service interfaces
│   │   └── lib/              # Pure utilities
│   └── infrastructure/       # Adapters
│       ├── api/
│       ├── assets/
│       └── config/
├── tests/
│   ├── unit/
│   ├── doubles/              # Port mocks
│   └── e2e/
├── package.json
├── tsconfig.json
└── vite.config.ts            # or next.config.js
```

## Core principles

### Hexagonal

- **Domain**: Pure TypeScript — no React, JSX, hooks, or UI imports
- **Application**: UI; consumes domain via hooks; React allowed
- **Infrastructure**: API clients, storage; implements domain ports

### SOLID

- **SRP**: One component / one hook = one concern
- **OCP**: Extend via new adapters; do not widen ports casually
- **LSP**: Adapters honor port contracts
- **ISP**: Small, focused ports
- **DIP**: Application depends on ports, not concrete adapters

### KISS

- Flat component trees; composition over deep nesting
- Direct props; context only when needed
- Clear names: `useUserProfile`, `UserCard`
- Minimal global state (Context → Zustand/Jotai only if justified)

## Code rules

### TypeScript

- `strict: true`; explicit types; no `any` (use `unknown`)
- Interfaces for objects; `type` for unions
- Type guards and discriminated unions where needed
- Generics for reusable hooks/components

### React

- Functional components only
- Custom hooks (`use*`) for domain interaction
- Presentational vs container; compound components when useful
- Local `useState` → `useReducer` → Context; external store only if needed
- `React.memo` / `useMemo` / `useCallback` only after measurement
- Error boundaries; loading/error in hooks
- Styling: Tailwind (preferred), CSS Modules, or styled-components — avoid inline except dynamic values

### Responsive design

- Mobile-first; Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)
- Fluid typography (`clamp()`); responsive images (`srcset`, `loading="lazy"`)
- Touch targets ≥ 44×44px on mobile
- Prefer CSS media queries over JS resize handlers
- Stack on mobile; grid/flex on desktop

### Domain

- Entities, ports, pure `lib/` functions
- **Zod** at boundaries: schemas on entities; `z.infer<>` for types
- No side effects in domain

### Application

- Hooks: `useUser()`, `useAuth()`, `useForm()` — wire to ports
- Components &lt; ~200 lines; pages compose smaller pieces
- Providers for shared state

### Infrastructure

- HTTP/GraphQL clients implement ports
- Map API DTOs → domain entities; handle errors/retries at the edge
- Env/config and storage wrappers live here

### Testing

- **Bun test** + **React Testing Library**
- Test behavior, not implementation; query by role/label
- Mock **outbound** adapters only; prefer real internal wiring
- Test doubles for domain ports in `tests/doubles/`
- Target ≥ 70% coverage on critical domain logic
- Reuse Zod schemas in tests

### File naming

- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts` (`useUserProfile.ts`)
- Utilities: `camelCase.ts`
- Types: `PascalCase.ts` or `*.types.ts`
- Tests: `*.test.tsx` / `*.spec.tsx`

## Review checklist

### Architecture

- [ ] Three layers: domain / application / infrastructure
- [ ] Domain has zero React imports
- [ ] Application uses domain via hooks
- [ ] Infrastructure implements ports

### SOLID & KISS

- [ ] SRP per component/hook
- [ ] DIP: no direct adapter imports in components
- [ ] Flat structure; clear naming

### TypeScript & React

- [ ] Strict mode; no `any`
- [ ] Hooks for business logic; accessible markup
- [ ] Responsive (mobile-first); error boundaries

### Testing & DevOps

- [ ] Domain unit tests; RTL for UI
- [ ] CI: lint, typecheck, test (Biome + tsc)

## Avoid

- React imports in `domain/`
- API calls inside components (use hooks → ports)
- Prop drilling (composition or context)
- Class components; premature optimization
- God components (&gt; ~300 lines)
- Testing implementation details
- Fixed pixel-only layouts; desktop-only UX
- `index.ts` barrel re-exports that hide dependencies

## Recommended stack

- **Runtime**: Bun (or Node)
- **Build**: Vite or Next.js
- **UI**: React 18+
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Data**: TanStack Query
- **Tests**: Bun test + React Testing Library
- **Lint/format**: Biome (or project ESLint)

## Related skills

- **`frontend-design`** — distinctive UI aesthetics (not architecture)
- **`vercel-react-best-practices`** — performance (bundle, waterfalls, rerenders)
- **`vitest-writer`** agent + **`vitest-react`** skill — Vitest/RTL for this stack
- **`feature-implementation`** — phased delivery and PR gate
