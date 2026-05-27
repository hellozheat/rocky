---
name: codebase-discovery
description: Unified repo discovery — Understand Anything graph (if present), graphify AST map, or feature-folder walkthrough. Canonical policy for all project agents.
model: default
---

# Codebase discovery (local project)

You help the agent **understand the user’s repository** before large grep sessions or scattered file reads. This is the **canonical policy** for every handbook agent that edits source or config in the user’s open project on disk.

**Why:** Random file reads waste tokens, miss module boundaries, and produce wrong edits. A small amount of structured discovery first pays for itself in review quality.

## When this applies

- Starting work in a **new** repo or an unfamiliar area of a large repo
- Answering **architecture** questions (“where does auth live?”, “what depends on this module?”)
- **After substantive code changes** in the user’s repo (refresh the map before marking the task done)
- Before **refactors** that touch multiple folders

## Precedence (read before big grep)

Use the **richest available** source; do not skip straight to reading dozens of files.

### 1. Understand Anything (optional, semantic)

**If** `.understand-anything/knowledge-graph.json` exists in the repo root:

- Use it for **structure**, **business domains**, **guided tours**, and “what connects to what” at a semantic level
- Read **node summaries and relationships** only — never paste the full JSON into chat
- Point the user to **`/understand-dashboard`** for visual exploration
- Agents **never** auto-run the `/understand` LLM pipeline from MCP (cost and token control; user runs it locally)

If the graph is missing but the user needs deep onboarding, suggest installing [Understand Anything](https://github.com/Lum1104/Understand-Anything) and running `/understand` once. See **`understand-anything-onboarding.md`** and `devkit://understand-anything-workflow`.

### 2. graphify (AST map, default refresh)

**If** `graphify-out/GRAPH_REPORT.md` exists (or `graphify-out/wiki/index.md`):

- **Read it first** for communities, hub files, and dependency shape
- Use **`graphify query "…"`** for targeted structural questions when the CLI is available
- See **`graphify-local-project.md`** for post-edit refresh rules

**If graphify is not installed:** say so once; do not block the user’s work. Fall through to step 3.

### 3. Fallback — one feature folder

Walk **one feature folder** end-to-end before spreading changes:

1. Entry (page, route, or public API)
2. UI components used by that entry
3. Context, actions, services, and tests colocated with that feature

Do not impose handbook folder layouts (e.g. `atoms/connected`) without evidence from the repo.

## After substantive code work

From the **repository root** of the user’s local project, before you treat the task as **done**:

```bash
graphify update .
```

- Refreshes `graphify-out/` (AST-only; **no** LLM call)
- If `graphify` is not on `PATH`, mention it once and continue

Suggest **`/understand --mode diff`** only when the user explicitly wants a **semantic** graph refresh after large changes (Understand Anything plugin on their machine).

## MCP and resources

| Resource / tool | Use for |
| --------------- | ------- |
| `devkit://graphify-workflow` | graphify install, wiki, query |
| `devkit://understand-anything-workflow` | Plugin install, `/understand`, dashboard |
| `devkit://handbook/agents/graphify-codebase-understanding.md` | graphify-only deep dive |
| `devkit://handbook/agents/understand-anything-onboarding.md` | Semantic graph already present |
| `safe_run` with `graphify` | Allowlisted graphify commands when permitted |
| `project_intelligence` | Scripts, deps, package manager, git status |

## Do

- Prefer **summaries** (GRAPH_REPORT, graph node summaries) over bulk file reads
- Run **`graphify update .`** after you change the user’s source or config
- Match **existing** patterns in the repo (read neighbors before inventing structure)

## Do not

- Auto-invoke `/understand` from MCP
- Dump entire `knowledge-graph.json` into context
- Skip discovery and grep random paths at scale
- Replace every post-edit **`graphify update .`** with a full Understand Anything scan

## Output (when asked to “map the repo”)

Deliver a **short** map (no code changes unless asked):

- Entry points and main domains
- Where tests and Storybook live
- Hub files or communities worth reading first
- Suggested next file(s) to open for the user’s task

## Do not duplicate

Other agent files keep a **Local project graph** section that points here and to **`graphify-local-project.md`**; they should not copy this policy in full.
