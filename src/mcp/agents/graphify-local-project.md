---
name: graphify-local-project
description: After code changes in the user repo, run graphify; use GRAPH_REPORT for architecture questions. Other agents in this folder must follow this.
model: default
---

# graphify — user local project

**Applies to every agent** under `src/mcp/agents` that adds, edits, or removes **source or config** in the user’s open repository (the local project on disk).

For full discovery precedence (including optional Understand Anything), read **`codebase-discovery.md`**. This document is the **graphify-specific** contract agents rely on daily.

## 1. After substantive code work

Before you treat the task as **done**, from the **repository root** of the user’s local project run:

```bash
graphify update .
```

This refreshes `graphify-out/` (AST-only; no API / LLM call). If `graphify` is not on `PATH`, say so once; do not block the user’s work.

**What “substantive” means:** new or changed components, routes, services, tests, config that affects build or imports — not typo-only comment edits unless the user asked for a graph refresh.

## 2. Before architecture / structure questions

If `graphify-out/GRAPH_REPORT.md` exists, **read it first** (or `graphify-out/wiki/index.md` if present) when answering:

- How the codebase is organized
- Where modules or features live
- What depends on what (god nodes, communities)
- Where to add a new file so it matches existing layering

Then use **`graphify query "…"`** for targeted questions when the CLI is available.

**First-time or stale graph:** suggest `graphify update . --wiki` from the repo root. See `devkit://graphify-workflow`.

## 3. When graphify is unavailable

1. Use **`project_intelligence`** (MCP) for scripts, deps, and git status
2. Walk one **feature folder** end-to-end (entry → UI → state/services → tests)
3. Do not read the whole tree file-by-file

## 4. Relationship to Understand Anything

If `.understand-anything/knowledge-graph.json` exists, prefer it for **semantic** onboarding (domains, tours). Still run **`graphify update .`** after your edits for a cheap structural refresh. See **`codebase-discovery.md`**.

## 5. Do not duplicate

Other agent files reference this policy in their **Local project graph** section. They should not paste these steps in full.
