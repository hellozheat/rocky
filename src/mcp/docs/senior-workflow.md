# Senior workflow (MCP resource)

Same narrative as `docs/senior-workflow.md` — exposed at `devkit://senior-workflow`. The host LLM **implements** in the repo after reading agents; see `devkit://how-it-works`.

1. **Graphify** — understand structure before editing
2. **Handbook** — `list_handbook`, read matching rules/agents
3. **Implement** — small diffs, neighbor conventions, human-readable code
4. **Verify** — lint, test, build
5. **`pre_pr_quality_gate`** — must be `ready`
6. **`repo_open_pr`** — optional PAT

Prefer the unified **`devkit`** tool in chat over memorizing action names.
