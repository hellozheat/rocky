# Agentic-assisted programming: token & cost breakdown

**Rocky value report (with vs without MCP):** [using-mcp-devkit-report.md](./using-mcp-devkit-report.md)  
**Handbook design (agents vs skills):** [why-agents-and-skills-are-split.md](./why-agents-and-skills-are-split.md)

This page explains the token/cost profile of the **agentic-assisted programming** workflow (human-guided, tool-augmented loops), not fully autonomous coding.

## One gateway vs many tools

Listing dozens of MCP tools burns context on schemas. **Rocky** exposes a single **`devkit`** tool with an `action` field. The model learns operations from `devkit://capabilities` once, then reuses one schema.

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

## Prompts: `devkit-start-task` (measured)

Inlining all handbook URIs in the prompt duplicated `list_handbook` and nudged models to fetch too many resources.

| Metric | Current state |
|--------|----------------|
| `devkit-start-task` prompt | Compact router prompt (no full 37-URI embed) |
| `list_handbook` JSON (if called) | ~6,400 chars (~1,600 tokens) |
| `devkit-review-code` prompt | Fixed 3-resource guidance |

**Typical good path:** `devkit-start-task` + `how-it-works` + `codebase-discovery` + **2** agent/rule reads ≈ **~4–6k tokens** handbook overhead.

**Avoid:** `list_handbook` + reading 10+ agent bodies (~10k–25k+ tokens).

## Example session (rough)

| Step | Relative cost |
|------|----------------|
| `codebase-discovery` + 1–2 agent/rule reads | Low |
| `list_handbook` (only if URI unknown) | Medium (~1.6k tokens) |
| Graphify wiki skim | Medium (one-time per repo) |
| Implement feature | High (your code) |
| `pre_pr_quality_gate` | Medium |
| `repo_open_pr` | Low |

Use **`structured: true`** on intelligence tools when the host parses JSON — avoids re-parsing markdown.

## Standalone tools

Inspector/debug tools (`project-intelligence`, `pre-pr-quality-gate`, etc.) duplicate gateway actions. Prefer **`devkit`** in chat; use standalone tools only for testing.
