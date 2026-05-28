---
name: vitest-react
description: Vitest + React Testing Library for React apps — hexagonal (real internals, mock outbound) and layered SPA (fakeStores/context). Templates, setup, and checklists.
---

# Vitest + React Testing Library (reference)

## Detect repo style first

| Signal | Style | Mocking |
|--------|--------|---------|
| `src/domain/` + ports/adapters | **Hexagonal** | Real hooks/stores/providers; mock **outbound** APIs/SDKs only |
| `src/components/atoms` + `connected/` + `getContextStores` | **Layered SPA** | `createFakeStores` for context; mock **external** SDKs only |
| Unclear | Read neighbors + `tests.mdc`; prefer hexagonal if `domain/` exists |

## Golden rules

### Hexagonal

- Real implementations for internal code (hooks, domain utils, in-memory stores)
- `vi.mock` / MSW only at **infrastructure** boundaries (HTTP, Stripe, analytics)
- Do not replace internal hooks/components with fakes

### Layered SPA

- **Fakes**: `createFakeStores` from `test-utils/fakeStores` for `getContextStores`
- **Mocks**: third-party auth, Sentry, external APIs
- **Constraint** (when user asks tests-only): do not change component source to add `data-testid` — fix tests via queries/mocks

### Both

- **Behavior tests** over smoke: user action → visible outcome or dispatch/API call
- Query priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- Colocate `*.test.tsx` with source; reset mocks/state in `beforeEach`
- See rule **`tests.mdc`** for project query conventions

## Test layout

### Hexagonal

```
src/application/.../Component.tsx + Component.test.tsx
src/application/hooks/useX.ts + useX.test.ts
tests/setup.ts, tests/utils/render.tsx, tests/fixtures/external.ts
infrastructure/**/__mocks__/   # outbound adapters only
```

### Layered SPA

```
src/components/MyComponent/index.tsx + index.test.tsx
src/__mocks__/external-auth-sdk.ts
src/test-utils/render.tsx, fakeStores.ts
```

## Setup (hexagonal — typical)

```ts
// vitest.config.ts — jsdom, setupFiles: tests/setup.ts
// tests/utils/render.tsx — QueryClient + MemoryRouter wrapper
// tests/fixtures/external.ts — mockChargeSuccess(), etc.
```

## Templates

### Hexagonal — component (real store)

```tsx
import { render, screen, waitFor } from '@/tests/utils/render'
import userEvent from '@testing-library/user-event'
import { CartSummary } from './CartSummary'
import { useCartStore } from '@/store/cart'

beforeEach(() => useCartStore.setState({ items: [] }))

it('removes an item when remove is clicked', async () => {
  useCartStore.setState({ items: [{ id: '1', name: 'Widget', price: 10, quantity: 1 }] })
  const user = userEvent.setup()
  render(<CartSummary />)
  await user.click(screen.getByRole('button', { name: /remove widget/i }))
  await waitFor(() => expect(screen.getByText(/empty/i)).toBeInTheDocument())
})
```

### Hexagonal — hook (mock outbound)

```ts
vi.mock('@/infrastructure/api/payment-client')
// renderHook + mockChargeSuccess() from fixtures
```

### Hexagonal — MSW at API boundary

Register `setupServer` in `tests/setup.ts`; per-test `server.use(http.get(...))`.

### Layered — fakeStores

```tsx
const mockDispatch = vi.fn()
vi.mock('../../../context', () => ({
  getContextStores: () => createFakeStores({ assetManagerDispatch: mockDispatch }),
}))
```

### Layered — selector test

Mock barrel exports with `vi.mock('./index', async () => ({ ...importActual, ... }))` when `setupTests` mocks selectors.

### Layered — custom render (Link)

```tsx
import { render, screen } from '../../../test-utils/render'
```

## Never do (hexagonal)

- Fake internal store/context/hook instead of real implementation
- Mock component under test or its subtree
- Spy private functions; assert user-visible behavior

## Never do (layered, tests-only PRs)

- Change component JSX/styles to satisfy tests

## Commands (match repo)

```bash
yarn test:run          # or pnpm vitest / yarn vitest run
yarn vitest run <path>
yarn vitest run --coverage
yarn lint              # after editing tests
```

## When invoked

1. Detect hexagonal vs layered; read source + existing test-utils.
2. List external vs internal deps; choose mock vs real per table above.
3. Write/update colocated tests (AAA); prefer behavior over smoke.
4. Run targeted then full suite; fix types/lint in test files only.
5. On source changes: update colocated test + grep importers; re-run until green.

## Related

- **`playwright-writer`** — E2E
- **`react-hexagonal`** agent — implementation layout
- **`tests.mdc`** — query priority and conventions
