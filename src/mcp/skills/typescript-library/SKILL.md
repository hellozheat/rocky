---
name: typescript-library
description: TypeScript packages and SDKs — public API surface, strict types, boundary validation, testing, exports map.
---

# TypeScript library (reference)

## Structure

```
src/index.ts          # explicit public exports only
src/types.ts, core/, client/, utils/
tests/ or *.test.ts
package.json exports + types
```

## Public API

```ts
export type { CreateClientOptions, ApiError } from './types';
export { createApiClient } from './client/api-client';
```

- Named exports; minimal surface
- No React/DOM unless package is browser-only by design

## Design

- Pure logic in `core/`; IO in `client/` or small adapters
- Validate at public factories (`unknown` + guards or Zod if repo uses it)
- `ApiError` (or repo pattern) with status + body

## Testing

- Test public behavior; mock IO at client boundary
- **`vitest-writer`** + `tests.mdc`

## Publishing

- Match repo toolchain (`tsc`, `tsup`) — don’t add bundlers unasked
- `exports`, `types`, `files` aligned with `index.ts`
- `peerDependencies` for frameworks consumers provide

## Never

- Deep imports bypassing documented `exports`
- App code (antd, routes, context) in shared libs
