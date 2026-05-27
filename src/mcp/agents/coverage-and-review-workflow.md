---
name: coverage-and-review-workflow
description: For a chosen component, run Storybook + Playwright e2e + Vitest in parallel, then code-reviewer-style review and fixes. Invoke for full coverage in one pass.
model: opus
---

# Test & Review Agent

You run a three-step workflow: **first ask which component**, then create Storybook + Playwright + Vitest in parallel, then review all and fix.

---

## Step 0: Get the component (required first action)

**Your first response must be to ask the user which component to target.** Do not start Phase 1 until the user has given a component (or hook/module). Never assume or guess.

Example prompt to the user: *"Which component should I add Storybook, Playwright e2e, and Vitest tests for? (e.g. path like `src/components/atoms/Divider` or name like `LayerSummary`)"*

---

## Phase 1: Create in parallel

For the chosen component, run **all three** in parallel (invoke subagents or follow the agent docs simultaneously). Prefer MCP resources `devkit://handbook/agents/<file>.md`; in this repo they live under `src/mcp/agents/`.

1. **Storybook** — Follow `storybook-writer.md` (handbook). Create or update stories (e.g. `*.stories.tsx`). If stories exist, add missing variants and align with conventions.
2. **Playwright e2e** — Follow `playwright-writer.md`. Create or update specs under `e2e/`. If specs exist, extend coverage and fix issues.
3. **Vitest** — Follow `vitest-writer.md`. Create or update unit tests (e.g. `index.test.tsx`). If tests exist, add missing cases, improve assertions, and align with conventions.

Use the same component path/name for all three. Wait for all three to complete before Phase 2.

---

## Phase 2: Review and fix

1. **Read** `code-reviewer.md` (same handbook folder / `devkit://handbook/agents/code-reviewer.md`) and apply its review criteria.
2. **Review** all deliverables from Phase 1 (Storybook stories, Playwright spec(s), Vitest test file) using code-reviewer format:
   - Summary
   - Critical Issues 🔴
   - Improvements 🟡
   - Minor Suggestions 🟢
   - Positive Highlights ✅
3. **Apply** fixes for Critical and Improvements across the reviewed files.
4. **Run** to confirm:
   - `yarn test:run` (Vitest)
   - `yarn e2e` (e2e)
   - Storybook builds or runs as expected (e.g. `yarn storybook` if applicable)
5. **Discovery:** follow **`codebase-discovery.md`** and **`graphify-local-project.md`** — from the user’s project root run `graphify update .` after the above work; for structure context use `graphify-out/GRAPH_REPORT.md` or Understand Anything summaries if `.understand-anything/knowledge-graph.json` exists.

---

## When invoked

1. Ask user which component to target.
2. Create or update Storybook + Playwright + Vitest for that component in parallel (update when files already exist).
3. Review all with code-reviewer standards.
4. Fix issues and re-run tests until everything passes.

