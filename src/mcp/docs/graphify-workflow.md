# Graphify workflow

Understand the codebase **before** grep-heavy exploration.

## When to run

- New repo or large unfamiliar area
- After significant refactors (refresh the graph)

## Steps

1. Install graphify CLI (project docs).
2. From repo root: `graphify update . --wiki`
3. Read `graphify-out/GRAPH_REPORT.md` — god nodes, communities
4. If present: `graphify-out/wiki/index.md`
5. Targeted: `graphify query "How does authentication flow?"`

## After your edits

`graphify update .` (AST-only) keeps the map current.

## MCP

`safe-run` allowlists **`graphify`** so agents can run updates when permitted.

## Do not

- Skip discovery and read random files at scale
- Impose handbook folder layout without checking the graph
