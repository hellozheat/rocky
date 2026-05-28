---
name: playwright-writer
model: default
description: Write or update Playwright E2E specs under e2e/. Invoke when user flows change or e2e coverage is needed.
skills: playwright-e2e
---

# Playwright writer

E2E tests in a **real browser**. Specs live in **`e2e/`** only.

## Local project graph

Follow **`codebase-discovery.md`** and **`graphify-local-project.md`**. Optional before large flows: read app login/navigation in source. After app route changes (not spec-only): `graphify update .`.

## Do

- Read **`e2e.mdc`** + real UI before writing selectors
- User-facing locators (`getByRole`, `getByLabelText`, `getByText`)
- Match repo auth (storage state, OAuth, form login)
- Run `yarn e2e <file>`; use `reports/e2e-last-run.txt` when debugging failures

## Don’t

- Change application code for e2e (no new test IDs, copy, or behavior)
- Assume email/password login if the app uses SSO/OAuth

## Deep reference

| Topic | Where |
|--------|--------|
| Templates, timeouts, troubleshooting | Skill **`playwright-e2e`** |
| Unit tests | **`vitest-writer.md`** |

## When invoked

1. **New:** `e2e/<feature>.spec.ts` — describe user flow from real UI.
2. **Update:** align spec with current UI; re-run `yarn e2e`.
3. **Failures:** binaries → `yarn playwright install`; else fix spec/config only.
