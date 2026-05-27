# PR quality rubric

Why reviewers reject AI-assisted PRs — and how **`pre_pr_quality_gate`** helps.

## Common rejection reasons

| Issue | Gate signal |
|-------|-------------|
| Lint/type errors | Blocker from `repo_lint` / yarn lint |
| Failing tests | Blocker from `repo_test` |
| Huge unrelated diff | `maxFiles` / heuristics warning |
| New patterns vs neighbors | Human-readable heuristics (warnings) |
| Missing tests on logic changes | Heuristic warnings |
| Debug logging left in | Heuristic blockers |

## Verdicts

- **`ready`** — no blockers; safe to open PR (human review still applies)
- **`not_ready`** — fix blockers first

## Not a substitute for humans

The gate catches mechanical issues. Reviewers still judge product fit, naming, and architecture.

## Workflow

1. `devkit` action `pre_pr_quality_gate`
2. Fix blockers
3. Re-run until `ready`
4. `repo_open_pr`

Read agent `pr-quality-gate.md` and rule `pr-quality-gate.mdc`.
