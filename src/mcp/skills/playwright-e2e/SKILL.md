---
name: playwright-e2e
description: Playwright E2E — specs in e2e/, selectors, auth/storage state, timeouts, spec templates, failure troubleshooting. App code is never changed for e2e.
---

# Playwright E2E (reference)

Read **`e2e.mdc`** for project conventions.

## Golden rule

**Only edit `e2e/` and Playwright config** (`e2e.config.ts`, `playwright.config.ts`, `auth.setup.ts`). Never change app code to add `data-testid`, copy, or behavior for tests.

## Scope & commands

```
e2e/*.spec.ts
e2e.config.ts / playwright.config.ts
e2e/.auth/          # storage state when repo uses it
```

```bash
yarn e2e                          # all
yarn e2e e2e/login.spec.ts        # one file
yarn e2e:ui                       # interactive
yarn e2e:log                      # output → reports/e2e-last-run.txt
yarn playwright show-report reports/playwright-report
yarn playwright install           # missing browser binaries
yarn lint                         # if config/helpers changed
```

## Selectors

Prefer `getByRole`, `getByLabelText`, `getByText`. Use `data-testid` only if it **already exists** in the app.

Use `page.goto('/path')` with `baseURL` from config.

## Spec template

Read the real login/entry route before asserting UI (OAuth vs form vs SSO).

```ts
import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.setTimeout(20000);

  test('shows login entry', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeVisible();
  });
});
```

## Timing & auth

- After redirects: `await expect(el).toBeVisible({ timeout: 15000 })`
- URLs: `toHaveURL(/^http:\/\/localhost:3000/)`, `not.toHaveURL(/\/login$/)`
- External IdP: unauthenticated specs assert pre-redirect UI only
- Authenticated flows: repo `auth.setup.ts` + `e2e/.auth/user.json` when present
- Mock/test tenant — no real user credentials in specs

## Failures

| Symptom | Action |
|---------|--------|
| Executable doesn't exist | `yarn playwright install` — do not change tests |
| Assertion / timeout / selector | Fix spec/config only; read `reports/e2e-last-run.txt` if present |
| Cursor can't find browsers | Run from system terminal or set `PLAYWRIGHT_BROWSERS_PATH` (see `e2e.mdc`) |

## Structure

- One user flow per `test()`; group with `test.describe()`
- App must be running (`yarn dev`) or `webServer` in config

## Related

- **`vitest-writer`** — unit/component tests (not e2e)
