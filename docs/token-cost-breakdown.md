# Token & cost breakdown

## One gateway vs many tools

Listing dozens of MCP tools burns context on schemas. **mcp-devkit** exposes a single **`devkit`** tool with an `action` field. The model learns operations from `devkit://capabilities` once, then reuses one schema.

**Tradeoff:** Each call still sends the full `devkit` schema. For long sessions, that is usually cheaper than 15+ separate tool definitions.

## Graphify before grep

Reading every file to “understand the repo” is expensive. **Graphify-first** workflow:

1. `graphify update . --wiki` (when the CLI is installed)
2. Read `graphify-out/GRAPH_REPORT.md` and wiki index
3. `graphify query` for targeted questions

**Savings:** Fewer full-file reads, better structure awareness, fewer wrong edits.

## Pre-PR gate vs rework loops

`pre_pr_quality_gate` runs lint, tests, and review heuristics once. It costs tokens up front.

A typical rejection loop costs more: review comments → fix → push → re-review → context reload.

**Rule of thumb:** One gate run before PR is cheaper than two review rounds caused by style/lint failures.

## Example session (rough)

| Step | Relative cost |
|------|----------------|
| `list_handbook` + 2 rule reads | Low |
| Graphify wiki skim | Medium (one-time per repo) |
| Implement feature | High (your code) |
| `pre_pr_quality_gate` | Medium |
| `repo_open_pr` | Low |

Use **`structured: true`** on intelligence tools when the host parses JSON — avoids re-parsing markdown.

## Standalone tools

Inspector/debug tools (`project-intelligence`, `pre-pr-quality-gate`, etc.) duplicate gateway actions. Prefer **`devkit`** in chat; use standalone tools only for testing.
