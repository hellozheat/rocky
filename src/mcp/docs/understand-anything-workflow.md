# Understand Anything workflow

Optional **semantic** codebase map (LLM-enriched). Complements **graphify** (cheap AST map).

## When to use

- Onboarding to a large or unfamiliar repo
- Business-domain views, guided tours, dependency paths
- After major refactors (user runs incremental refresh)

## Setup (user machine)

Install the [Understand Anything](https://github.com/Lum1104/Understand-Anything) plugin for your AI client (Claude Code, Cursor, etc.). See the repo README for marketplace install.

## Generate the graph

```text
/understand
```

Output: `.understand-anything/knowledge-graph.json` (commit optional; exclude `.understand-anything/intermediate/`).

Open the dashboard:

```text
/understand-dashboard
```

Incremental refresh after local changes (user-initiated):

```text
/understand --mode diff
```

## How devkit agents use it

- **Read** existing `knowledge-graph.json` when present — do not auto-invoke `/understand` from MCP (cost/tokens).
- **Still run** `graphify update .` after substantive edits for a fast AST refresh.
- Deep onboarding playbook: `devkit://handbook/agents/understand-anything-onboarding.md`

## Do not

- Replace graphify post-edit refresh with full `/understand` on every task
- Dump the entire knowledge graph into chat context
