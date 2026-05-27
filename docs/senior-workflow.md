# Senior workflow

End-to-end pipeline the handbook and MCP tools reinforce.

## 1. Discover

- Run graphify (`devkit://graphify-workflow`)
- `devkit` → `list_handbook`
- `project_intelligence` on the target repo

## 2. Match conventions

- Read `codebase-conventions`, `react-components`, `human-readable-code`
- Pick agent: `react-developer`, `nextjs-developer`, etc.

## 3. Implement small, reviewable diffs

- One concern per commit
- Colocated styles; no drive-by refactors
- Read neighbors before inventing patterns

## 4. Verify locally

- `yarn lint:fix`, `yarn test`, `yarn build`

## 5. Pre-PR gate

```json
{ "action": "pre_pr_quality_gate", "repoPath": "/path/to/repo" }
```

Fix **blockers**; address **warnings**. Re-run until `verdict: "ready"`.

## 6. Open PR

- `repo_open_pr` with `GITHUB_TOKEN` set
- Draft PRs encouraged for large changes

## Prompts

- `devkit-start-task` — prime a task
- `devkit-before-pr` — gate checklist
- `devkit-learn-the-stack` — onboarding
