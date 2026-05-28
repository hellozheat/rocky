# How devkit works with your LLM

Rocky is a **handbook + tooling** for the AI in your editor—not a separate code generator that replaces the model.

## What you should expect

When Rocky is connected, the model should:

1. Call **`devkit`** → `list_handbook` (or use prompt **`devkit-start-task`**).
2. Read the matching **agents** and **rules** for the task (e.g. `react-hexagonal.md`, `vitest-writer.md`, `code-reviewer.md`).
3. **Implement in the user’s repo** using normal editor tools (edit files, run terminal)—following those playbooks.
4. Use **`devkit`** for repo intelligence (`repo_diff`, `repo_test`, `change_scope_analyzer`, `test_gap_finder`, `pre_pr_quality_gate`, …) on paths the deployment can access.

So devkit **does** support:

| User goal | How |
| --------- | --- |
| Write better code | Handbook rules + agents (`react-hexagonal`, `human-readable-code`, …) — **you** apply them while editing |
| Split / refactor components | Same — follow `react-hexagonal` / `codebase-conventions`; use `change_scope_analyzer` for blast radius |
| Architecture alignment | `codebase-discovery`, graphify, `node-api-developer` / `nextjs-developer` — **you** reshape code to match |
| Write tests | `vitest-writer`, `playwright-writer`, `tests.mdc`; `test_gap_finder` finds gaps; `repo_test` runs tests |
| Review before PR | `code-reviewer`, `pre_pr_quality_gate`, `pr-quality-gate` agent |

## What Rocky is not

- **Not** a single MCP call that rewrites the whole repo without the host model editing files.
- **Not** autonomous—the connected LLM still writes and runs commands in the workspace.
- **Hosted server** may not see the user’s disk: handbook + guidance always work; `repo_*` / `pre_pr_quality_gate` need `repoPath` on an allowed root (often the user runs lint/test locally while following the handbook).

## One-line for models

**Read the handbook, then implement in the repo; use Rocky tools (`devkit` actions) to discover, test, and gate—not instead of coding.**
